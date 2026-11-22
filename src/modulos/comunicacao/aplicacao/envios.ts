/**
 * Envios automáticos de e-mail da Comunicação (ADR-027, entrega 2): release e artigo saem na hora marcada.
 *
 * - Agendar com envio automático cria (ou atualiza) um `Envio` pendente; reagendar nunca cria um segundo.
 * - A rotina (a cada 15 minutos) envia o que já passou da hora: remonta os destinos dos contatos e grupos
 *   ATIVOS naquele momento, envia em cópia oculta com os anexos do pedido e marca "enviado".
 * - Falhou: até 3 tentativas (+15 e +60 minutos). Esgotadas, o envio fica "falhou"; o pedido segue Agendado
 *   e nunca vira Publicado sozinho. A Comunicação pode "tentar de novo" ou "enviar à mão".
 * - O mesmo envio nunca sai duas vezes: a tentativa é reservada (versão da linha) antes de enviar.
 * - O corpo do e-mail não fica gravado; o erro gravado é resumido, sem endereço nem texto da mensagem.
 * - Toda gravação registra auditoria só com colunas. Nada é apagado (envio cancelado fica "cancelado").
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { TRECHO_MAXIMO } from '@/nucleo/armazenamento/leitura-de-anexo';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ErroEmail, LIMITE_ANEXOS_BYTES, type AnexoEmail, type EnviadorDeEmail } from '@/nucleo/email/email';
import { AnexosComunicacao, EnviosComunicacao, HistoricoComunicacao, PedidosComunicacao, type RegEnvio, type RegPedido } from '../dados/tabelas';
import { assuntoDoEnvio, esperaAposTentativa, lerDestinatarios, MAX_ENVIOS_POR_RODADA, MAX_TENTATIVAS, type TipoEnvio } from '../dominio/envio';
import { ErroComunicacao } from '../dominio/pedido';
import { destinatariosDe } from './contatos';

const SISTEMA = 'rotina@elo';
const PERM_REVISAR = 'comunicacao.revisar';
const minutos = (agora: Date, n: number) => new Date(agora.getTime() + n * 60_000).toISOString();

async function auditar(p: Planilhas, usuario: string, acao: 'inclusao' | 'alteracao', id: string, colunas: string[], agora: Date) {
  await registrarAuditoria(p, { usuario, acao, entidade: 'EnviosComunicacao', registroId: id, detalhes: { colunas } }, agora);
}

async function historico(p: Planilhas, pedidoId: string, usuario: string, acao: string, para: RegPedido['situacao'], comentario: string | null, agora: Date) {
  await inserir(p, HistoricoComunicacao, { pedido_id: pedidoId, em: agora.toISOString(), usuario, acao, de: para, para, comentario }, { email: usuario, agora: () => agora });
}

// ---------------------------------------------------------------------------
// Agendamento (chamado por agendarPedido, que já conferiu a permissão e a versão)
// ---------------------------------------------------------------------------

/** Cria ou atualiza o envio do pedido agendado. Quem agenda à mão (`automatico` falso) cancela o envio pendente. */
export async function sincronizarEnvioDoAgendamento(
  p: Planilhas,
  quem: Autorizador,
  pedido: Pick<RegPedido, 'id' | 'titulo' | 'tipo_peca'>,
  automatico: boolean,
  quando: Date,
  agora: Date,
): Promise<void> {
  const [envios] = await lerTabelas(p, [EnviosComunicacao] as const);
  const doPedido = envios.ativos().filter((e) => e.pedido_id === pedido.id && (e.tipo === 'release' || e.tipo === 'artigo'));
  const aberto = doPedido.find((e) => e.situacao === 'pendente' || e.situacao === 'falhou');
  const autoria = { email: quem.email, agora: () => agora };
  if (!automatico) {
    if (aberto?.situacao === 'pendente') await cancelarEnvio(p, quem.email, aberto, agora);
    return;
  }
  const tipo = pedido.tipo_peca as TipoEnvio;
  const campos = { assunto: assuntoDoEnvio(pedido.titulo), previsto_para: quando.toISOString(), proxima_tentativa: quando.toISOString(), situacao: 'pendente' as const, tentativas: 0, erro: null, destinatarios: null };
  if (aberto) {
    const { colunasAlteradas } = await atualizar(p, EnviosComunicacao, aberto.id, aberto.versao, campos, autoria);
    await auditar(p, quem.email, 'alteracao', aberto.id, colunasAlteradas, agora);
    return;
  }
  const novo = await inserir(p, EnviosComunicacao, { pedido_id: pedido.id, tipo, enviado_em: null, modelo: null, origem: null, ...campos }, autoria);
  await auditar(p, quem.email, 'inclusao', novo.id, Object.keys(campos), agora);
}

async function cancelarEnvio(p: Planilhas, usuario: string, e: RegEnvio, agora: Date) {
  const { colunasAlteradas } = await atualizar(p, EnviosComunicacao, e.id, e.versao, { situacao: 'cancelado' }, { email: usuario, agora: () => agora });
  await auditar(p, usuario, 'alteracao', e.id, colunasAlteradas, agora);
}

/** Cancela os envios pendentes do pedido (ex.: a Comunicação marcou como publicado à mão). */
export async function cancelarEnviosPendentes(p: Planilhas, usuario: string, pedidoId: string, agora: Date): Promise<void> {
  const [envios] = await lerTabelas(p, [EnviosComunicacao] as const);
  for (const e of envios.ativos().filter((x) => x.pedido_id === pedidoId && x.situacao === 'pendente')) await cancelarEnvio(p, usuario, e, agora);
}

// ---------------------------------------------------------------------------
// Rotina
// ---------------------------------------------------------------------------

export interface MeiosDeEnvio {
  email: EnviadorDeEmail | null;
  arquivos: ArmazenamentoArquivos | null;
}

/** Texto curto do motivo, para gravar. Só mensagens do próprio Elo (ErroEmail e ErroComunicacao) passam; o resto vira genérico. */
const motivoResumido = (erro: unknown) =>
  erro instanceof ErroEmail || erro instanceof ErroComunicacao ? erro.message.slice(0, 300) : 'Erro inesperado ao enviar. Tente de novo; se repetir, avise a Operadora do Elo.';

async function anexosDoPedido(p: Planilhas, arquivos: ArmazenamentoArquivos | null, pedidoId: string): Promise<AnexoEmail[]> {
  const [anexos] = await lerTabelas(p, [AnexosComunicacao] as const);
  const lista = anexos.ativos().filter((a) => a.pedido_id === pedidoId);
  if (lista.length === 0) return [];
  if (!arquivos) throw new ErroComunicacao('A pasta de anexos da instituição não está ligada; o e-mail não pode levar os arquivos do pedido.');
  if (lista.reduce((s, a) => s + a.tamanho, 0) > LIMITE_ANEXOS_BYTES) throw new ErroEmail('Os anexos passam de 10 MB.');
  const saida: AnexoEmail[] = [];
  for (const a of lista) {
    const dados = new Uint8Array(a.tamanho);
    for (let inicio = 0; inicio < a.tamanho; inicio += TRECHO_MAXIMO) {
      const t = await arquivos.ler(a.arquivo_id, { inicio, fim: Math.min(inicio + TRECHO_MAXIMO, a.tamanho) - 1 });
      dados.set(t.dados, inicio);
    }
    saida.push({ nome: a.nome, tipo: a.mime, dados });
  }
  return saida;
}

/** Envia o que já passou da hora (no máximo 100 por rodada). Devolve só contagens. */
export async function rodarEnvios(p: Planilhas, meios: MeiosDeEnvio, agora: Date = new Date()): Promise<Record<string, number>> {
  const [envios, pedidos] = await lerTabelas(p, [EnviosComunicacao, PedidosComunicacao] as const);
  const devidos = envios
    .ativos()
    .filter((e) => e.situacao === 'pendente' && (e.tipo === 'release' || e.tipo === 'artigo') && new Date(e.proxima_tentativa).getTime() <= agora.getTime())
    .sort((a, b) => a.proxima_tentativa.localeCompare(b.proxima_tentativa))
    .slice(0, MAX_ENVIOS_POR_RODADA);
  const r = { enviados: 0, falhas: 0, esgotados: 0, cancelados: 0, adiados: 0 };
  for (const e of devidos) {
    const pedido = pedidos.porId(e.pedido_id);
    if (!pedido || !pedido.ativo || pedido.situacao !== 'agendado') {
      await cancelarEnvio(p, SISTEMA, e, agora);
      r.cancelados++;
      continue;
    }
    // Reserva a tentativa antes de enviar: se outra rodada já pegou este envio, a versão não confere e ele é pulado.
    const tentativa = e.tentativas + 1;
    let reservado: RegEnvio;
    try {
      const res = await atualizar(p, EnviosComunicacao, e.id, e.versao, { tentativas: tentativa, proxima_tentativa: minutos(agora, esperaAposTentativa(tentativa)) }, { email: SISTEMA, agora: () => agora });
      reservado = res.registro;
      await auditar(p, SISTEMA, 'alteracao', e.id, res.colunasAlteradas, agora);
    } catch (erro) {
      if (erro instanceof ErroConflito) {
        r.adiados++;
        continue;
      }
      throw erro;
    }
    let destinos: string[] = [];
    try {
      if (!meios.email) throw new ErroComunicacao('Falta informar o e-mail de envio na administração da instituição.');
      destinos = await destinatariosDe(p, lerDestinatarios(pedido.destinatarios));
      if (destinos.length === 0) throw new ErroComunicacao('Nenhum dos contatos escolhidos está ativo.');
      const anexos = await anexosDoPedido(p, meios.arquivos, pedido.id);
      await meios.email.enviar({ cco: destinos, assunto: reservado.assunto, texto: pedido.descricao, anexos });
    } catch (erro) {
      const esgotou = tentativa >= MAX_TENTATIVAS;
      const motivo = motivoResumido(erro);
      const { colunasAlteradas } = await atualizar(
        p,
        EnviosComunicacao,
        reservado.id,
        reservado.versao,
        { erro: motivo, ...(esgotou ? { situacao: 'falhou' as const } : {}) },
        { email: SISTEMA, agora: () => agora },
      );
      await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
      if (esgotou) {
        await historico(p, pedido.id, SISTEMA, 'envio_falhou', pedido.situacao, `O envio pelo Elo falhou depois de ${MAX_TENTATIVAS} tentativas: ${motivo}`, agora);
        r.esgotados++;
      } else r.falhas++;
      continue;
    }
    const { colunasAlteradas } = await atualizar(
      p,
      EnviosComunicacao,
      reservado.id,
      reservado.versao,
      { situacao: 'enviado', enviado_em: agora.toISOString(), destinatarios: destinos.join(','), erro: null },
      { email: SISTEMA, agora: () => agora },
    );
    await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
    await historico(p, pedido.id, SISTEMA, 'envio', pedido.situacao, `Enviado pelo Elo a ${destinos.length} ${destinos.length === 1 ? 'destinatário' : 'destinatários'}.`, agora);
    r.enviados++;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Consulta e "tentar de novo" (tela)
// ---------------------------------------------------------------------------

export interface EnvioDoPedido {
  id: string;
  versao: number;
  situacao: RegEnvio['situacao'];
  previstoPara: string;
  enviadoEm: string | null;
  tentativas: number;
  erro: string | null;
}

/** O envio de release ou artigo do pedido (o mais recente), só para a Comunicação. Sem envio: nulo. */
export async function envioDoPedido(p: Planilhas, quem: Autorizador, pedidoId: string): Promise<EnvioDoPedido | null> {
  if (!quem.temPermissao(PERM_REVISAR)) return null;
  const [envios] = await lerTabelas(p, [EnviosComunicacao] as const);
  const e = envios
    .ativos()
    .filter((x) => x.pedido_id === pedidoId && (x.tipo === 'release' || x.tipo === 'artigo') && x.situacao !== 'cancelado')
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    .at(-1);
  return e ? { id: e.id, versao: e.versao, situacao: e.situacao, previstoPara: e.previsto_para, enviadoEm: e.enviado_em, tentativas: e.tentativas, erro: e.erro } : null;
}

/** Quantos envios esgotaram as tentativas e ainda esperam a Comunicação (aviso da tela inicial). */
export async function contarEnviosFalhos(p: Planilhas, quem: Autorizador): Promise<number> {
  if (!quem.temPermissao(PERM_REVISAR)) return 0;
  const [envios, pedidos] = await lerTabelas(p, [EnviosComunicacao, PedidosComunicacao] as const);
  return envios.ativos().filter((e) => e.situacao === 'falhou' && pedidos.porId(e.pedido_id)?.situacao === 'agendado').length;
}

/** Põe um envio que falhou de volta na fila: a rotina tenta de novo na próxima rodada, com 3 tentativas novas. */
export async function tentarEnvioDeNovo(p: Planilhas, quem: Autorizador, envioId: string, versao: number, opcoes: { agora?: Date } = {}): Promise<void> {
  if (!quem.temPermissao(PERM_REVISAR)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [envios, pedidos] = await lerTabelas(p, [EnviosComunicacao, PedidosComunicacao] as const);
  const e = envios.porId(envioId);
  if (!e || !e.ativo) throw new ErroComunicacao('Envio não encontrado.');
  if (e.versao !== versao) throw new ErroConflito(envioId);
  if (e.situacao !== 'falhou') throw new ErroComunicacao('Só um envio que falhou pode ser tentado de novo.');
  const pedido = pedidos.porId(e.pedido_id);
  if (!pedido || !pedido.ativo || pedido.situacao !== 'agendado') throw new ErroComunicacao('O pedido não está mais agendado.');
  const { colunasAlteradas } = await atualizar(
    p,
    EnviosComunicacao,
    envioId,
    versao,
    { situacao: 'pendente', tentativas: 0, erro: null, proxima_tentativa: agora.toISOString() },
    { email: quem.email, agora: () => agora },
  );
  await auditar(p, quem.email, 'alteracao', envioId, colunasAlteradas, agora);
  await historico(p, pedido.id, quem.email, 'envio_de_novo', pedido.situacao, null, agora);
}
