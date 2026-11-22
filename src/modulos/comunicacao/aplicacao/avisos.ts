/**
 * Avisos e lembrete por e-mail da Comunicação (ADR-027, entrega 3).
 *
 * - Aviso de pedido (devolvido, aguardando aprovação, publicado): nasce junto com a mudança de situação, como um
 *   `Envio` pendente do tipo "aviso". Se a criação falhar, a mudança do pedido NÃO é desfeita.
 * - Resumos (aguardando revisão) e o lembrete do dia (8h de Brasília) e o aviso de falha de envio nascem na rotina.
 * - A rotina (tarefa `comunicacao.avisos`) envia, com 3 tentativas. Falha de aviso nunca mexe na situação do pedido.
 * - Nada é criado nem enviado com os avisos desligados ou sem e-mail de envio da instituição.
 * - Texto fixo (`dominio/aviso.ts`): só número do pedido, o que fazer e o link. O corpo não fica gravado, o erro
 *   gravado é resumido e a auditoria guarda só colunas. Nada é apagado (aviso sem efeito fica "cancelado").
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { emailValido, ErroEmail, type EnviadorDeEmail } from '@/nucleo/email/email';
import { EnviosComunicacao, HistoricoComunicacao, PedidosComunicacao, type RegEnvio, type RegPedido } from '../dados/tabelas';
import { avisoAindaVale, conteudoDoAviso, DESTINO_DO_AVISO, MODELOS_AVISO, NOME_DO_DESTINO, type ModeloAviso } from '../dominio/aviso';
import { esperaAposTentativa, MAX_ENVIOS_POR_RODADA, MAX_TENTATIVAS } from '../dominio/envio';
import { ErroComunicacao } from '../dominio/pedido';
import { diaEmBrasilia } from '../dominio/prazos';
import { lerAvisosPorEmail } from './configuracoes';

const SISTEMA = 'rotina@elo';
const RESUMO = 'resumo';
const HORA_DO_LEMBRETE = 8;
/** Pedidos cujos posts, reels e entrevistas a Comunicação publica à mão (entram no lembrete do dia). */
const TIPOS_DO_LEMBRETE = ['post_instagram', 'reel_instagram', 'entrevista'];
const DIAS_DE_AVISO_FALHO = 7;

const minutos = (agora: Date, n: number) => new Date(agora.getTime() + n * 60_000).toISOString();
const ehAviso = (e: RegEnvio) => e.tipo === 'aviso' || e.tipo === 'lembrete';
const modeloDe = (e: RegEnvio): ModeloAviso | null => (MODELOS_AVISO as readonly string[]).includes(e.modelo ?? '') ? (e.modelo as ModeloAviso) : null;

async function auditar(p: Planilhas, usuario: string, acao: 'inclusao' | 'alteracao', id: string, colunas: string[], agora: Date) {
  await registrarAuditoria(p, { usuario, acao, entidade: 'EnviosComunicacao', registroId: id, detalhes: { colunas } }, agora);
}

async function historico(p: Planilhas, pedido: RegPedido, acao: string, comentario: string, agora: Date) {
  await inserir(p, HistoricoComunicacao, { pedido_id: pedido.id, em: agora.toISOString(), usuario: SISTEMA, acao, de: pedido.situacao, para: pedido.situacao, comentario }, { email: SISTEMA, agora: () => agora });
}

async function novoAviso(
  p: Planilhas,
  usuario: string,
  d: { pedidoId: string; modelo: ModeloAviso; assunto: string; origem?: string | null; tipo?: 'aviso' | 'lembrete'; previstoPara?: string },
  agora: Date,
): Promise<void> {
  const previsto = d.previstoPara ?? agora.toISOString();
  const campos = {
    pedido_id: d.pedidoId,
    tipo: d.tipo ?? ('aviso' as const),
    assunto: d.assunto,
    destinatarios: null,
    previsto_para: previsto,
    proxima_tentativa: agora.toISOString(),
    situacao: 'pendente' as const,
    tentativas: 0,
    enviado_em: null,
    erro: null,
    modelo: d.modelo,
    origem: d.origem ?? null,
  };
  const novo = await inserir(p, EnviosComunicacao, campos, { email: usuario, agora: () => agora });
  await auditar(p, usuario, 'inclusao', novo.id, Object.keys(campos), agora);
}

// ---------------------------------------------------------------------------
// Aviso que nasce com a mudança de situação do pedido
// ---------------------------------------------------------------------------

/**
 * Cria o aviso do pedido (pendente). Não faz nada com os avisos desligados ou sem e-mail de envio. Nunca lança:
 * se falhar, a mudança de situação já gravada continua valendo (o aviso dentro do Elo é o principal).
 */
export async function criarAvisoDoPedido(
  p: Planilhas,
  quem: Autorizador,
  pedido: Pick<RegPedido, 'id' | 'numero'>,
  modelo: ModeloAviso | null,
  emailDisponivel: boolean | undefined,
  agora: Date,
): Promise<void> {
  if (!modelo || !emailDisponivel) return;
  try {
    if (!(await lerAvisosPorEmail(p)).ligado) return;
    await novoAviso(p, quem.email, { pedidoId: pedido.id, modelo, assunto: conteudoDoAviso(modelo, { numero: pedido.numero, id: pedido.id, base: '' }).assunto }, agora);
  } catch {
    // O erro fica de fora de propósito: o pedido já mudou e o aviso dentro do Elo vale.
  }
}

// ---------------------------------------------------------------------------
// Rotina
// ---------------------------------------------------------------------------

export interface MeiosDeAviso {
  email: EnviadorDeEmail | null;
  /** Endereço público do Elo, para o link do e-mail. */
  urlBase: string | null;
}

const motivoResumido = (erro: unknown) =>
  erro instanceof ErroEmail || erro instanceof ErroComunicacao ? erro.message.slice(0, 300) : 'Erro inesperado ao enviar. A rotina tenta de novo; se repetir, avise a Operadora do Elo.';

async function cancelar(p: Planilhas, e: RegEnvio, motivo: string, agora: Date) {
  const { colunasAlteradas } = await atualizar(p, EnviosComunicacao, e.id, e.versao, { situacao: 'cancelado', erro: motivo }, { email: SISTEMA, agora: () => agora });
  await auditar(p, SISTEMA, 'alteracao', e.id, colunasAlteradas, agora);
}

/** Cria o aviso de falha (um por envio que falhou, e de novo só se falhar outra vez) e os resumos do dia. */
async function criarAvisosDaRodada(p: Planilhas, agora: Date): Promise<number> {
  const [envios, pedidos, historicos] = await lerTabelas(p, [EnviosComunicacao, PedidosComunicacao, HistoricoComunicacao] as const);
  const todos = envios.ativos();
  let criados = 0;

  // 1. Envio de release ou artigo que esgotou as tentativas.
  const jaAvisados = new Set(todos.filter((e) => e.modelo === 'falha').map((e) => e.origem));
  for (const f of todos.filter((e) => e.situacao === 'falhou' && (e.tipo === 'release' || e.tipo === 'artigo'))) {
    const origem = `${f.id}:${f.versao}`;
    const pedido = pedidos.porId(f.pedido_id);
    if (jaAvisados.has(origem) || !pedido || !pedido.ativo) continue;
    await novoAviso(p, SISTEMA, { pedidoId: pedido.id, modelo: 'falha', origem, assunto: conteudoDoAviso('falha', { numero: pedido.numero, id: pedido.id, base: '' }).assunto }, agora);
    criados++;
  }

  // 2. Resumo de pedidos aguardando revisão: só quando chegou pedido novo desde o último resumo (nunca um por rodada).
  const naFila = pedidos.ativos().filter((x) => x.situacao === 'aguardando_revisao');
  if (naFila.length > 0) {
    const ultimo = todos.filter((e) => e.modelo === 'revisao').map((e) => e.previsto_para).sort().at(-1) ?? '';
    const chegouNovo = naFila.some((x) => historicos.ativos().some((h) => h.pedido_id === x.id && h.para === 'aguardando_revisao' && h.em > ultimo));
    if (chegouNovo) {
      await novoAviso(p, SISTEMA, { pedidoId: RESUMO, modelo: 'revisao', assunto: conteudoDoAviso('revisao', { n: naFila.length, base: '' }).assunto }, agora);
      criados++;
    }
  }

  // 3. Lembrete do dia: a partir das 8h de Brasília, uma vez por dia, só se houver pedido.
  const dia = diaEmBrasilia(agora);
  const hora = new Date(agora.getTime() - 3 * 3_600_000).getUTCHours();
  const horaDoLembrete = new Date(`${dia}T0${HORA_DO_LEMBRETE}:00:00-03:00`).toISOString();
  if (hora >= HORA_DO_LEMBRETE && !todos.some((e) => e.modelo === 'lembrete' && e.previsto_para === horaDoLembrete) && contarDoDia(pedidos.ativos(), dia) > 0) {
    await novoAviso(p, SISTEMA, { pedidoId: RESUMO, modelo: 'lembrete', tipo: 'lembrete', previstoPara: horaDoLembrete, assunto: conteudoDoAviso('lembrete', { n: contarDoDia(pedidos.ativos(), dia), base: '' }).assunto }, agora);
    criados++;
  }
  return criados;
}

function contarDoDia(pedidos: RegPedido[], dia: string): number {
  return pedidos.filter((x) => x.situacao === 'agendado' && TIPOS_DO_LEMBRETE.includes(x.tipo_peca) && !x.publicacao_automatica && x.agendado_para && diaEmBrasilia(new Date(x.agendado_para)) === dia).length;
}

/** E-mails de quem tem a permissão (ou de quem pediu), só de contas ativas, sem repetir. */
async function destinatariosDoAviso(p: Planilhas, modelo: ModeloAviso, pedido: RegPedido | undefined): Promise<string[]> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  const dados = { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() };
  const destino = DESTINO_DO_AVISO[modelo];
  const contas = dados.usuarios.map((u) => u.email.trim().toLowerCase());
  const lista =
    'solicitante' in destino
      ? contas.filter((e) => e === pedido?.solicitante.trim().toLowerCase())
      : contas.filter((e) => new Autorizador(e, dados).temPermissao(destino.permissao));
  return [...new Set(lista.filter(emailValido))].sort();
}

/** Cria o que a rodada pede e envia o que está pendente. Devolve só contagens. */
export async function rodarAvisos(p: Planilhas, meios: MeiosDeAviso, agora: Date = new Date()): Promise<Record<string, number>> {
  const r = { criados: 0, enviados: 0, falhas: 0, esgotados: 0, cancelados: 0, adiados: 0 };
  const ligado = (await lerAvisosPorEmail(p)).ligado;
  if (!ligado || !meios.email) {
    const motivo = !ligado ? 'Os avisos por e-mail estão desligados.' : 'Falta informar o e-mail de envio na administração da instituição.';
    const [envios] = await lerTabelas(p, [EnviosComunicacao] as const);
    for (const e of envios.ativos().filter((x) => ehAviso(x) && x.situacao === 'pendente')) {
      await cancelar(p, e, motivo, agora);
      r.cancelados++;
    }
    return r;
  }
  if (!meios.urlBase) return { ...r, sem_endereco_publico: 1 };

  r.criados = await criarAvisosDaRodada(p, agora);
  const [envios, pedidos] = await lerTabelas(p, [EnviosComunicacao, PedidosComunicacao] as const);
  const devidos = envios
    .ativos()
    .filter((e) => ehAviso(e) && e.situacao === 'pendente' && new Date(e.proxima_tentativa).getTime() <= agora.getTime())
    .sort((a, b) => a.proxima_tentativa.localeCompare(b.proxima_tentativa))
    .slice(0, MAX_ENVIOS_POR_RODADA);

  for (const e of devidos) {
    const modelo = modeloDe(e);
    const pedido = e.pedido_id === RESUMO ? undefined : pedidos.porId(e.pedido_id);
    if (!modelo || (e.pedido_id !== RESUMO && (!pedido || !pedido.ativo))) {
      await cancelar(p, e, 'O pedido deste aviso não existe mais.', agora);
      r.cancelados++;
      continue;
    }
    if (pedido && !avisoAindaVale(modelo, pedido.situacao)) {
      await cancelar(p, e, 'O pedido já mudou de situação.', agora);
      r.cancelados++;
      continue;
    }
    // Resumos refazem a conta na hora de enviar; sem nada a avisar, não sai e-mail.
    const dia = diaEmBrasilia(agora);
    const n = modelo === 'revisao' ? pedidos.ativos().filter((x) => x.situacao === 'aguardando_revisao').length : modelo === 'lembrete' ? contarDoDia(pedidos.ativos(), dia) : undefined;
    if (n === 0) {
      await cancelar(p, e, 'Não há mais nada a avisar.', agora);
      r.cancelados++;
      continue;
    }
    // Reserva a tentativa antes de enviar: se outra rodada já pegou este aviso, a versão não confere e ele é pulado.
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
      destinos = await destinatariosDoAviso(p, modelo, pedido);
      if (destinos.length === 0) {
        await cancelar(p, reservado, 'Ninguém com e-mail cadastrado para receber este aviso.', agora);
        if (pedido) await historico(p, pedido, 'aviso_nao_enviado', 'Aviso por e-mail não enviado: ninguém com e-mail cadastrado para receber.', agora);
        r.cancelados++;
        continue;
      }
      const { assunto, texto } = conteudoDoAviso(modelo, { numero: pedido?.numero, id: pedido?.id, n, base: meios.urlBase });
      await meios.email.enviar(destinos.length === 1 ? { para: destinos, assunto, texto } : { cco: destinos, assunto, texto });
    } catch (erro) {
      const esgotou = tentativa >= MAX_TENTATIVAS;
      const motivo = motivoResumido(erro);
      const { colunasAlteradas } = await atualizar(p, EnviosComunicacao, reservado.id, reservado.versao, { erro: motivo, ...(esgotou ? { situacao: 'falhou' as const } : {}) }, { email: SISTEMA, agora: () => agora });
      await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
      if (esgotou) {
        if (pedido) await historico(p, pedido, 'aviso_nao_enviado', `Aviso por e-mail não enviado: ${motivo}`, agora);
        r.esgotados++;
      } else r.falhas++;
      continue;
    }
    const { colunasAlteradas } = await atualizar(p, EnviosComunicacao, reservado.id, reservado.versao, { situacao: 'enviado', enviado_em: agora.toISOString(), destinatarios: destinos.join(','), erro: null }, { email: SISTEMA, agora: () => agora });
    await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
    if (pedido) await historico(p, pedido, 'aviso_enviado', `Aviso enviado por e-mail a ${NOME_DO_DESTINO[modelo]}.`, agora);
    r.enviados++;
  }
  return r;
}

/** Quantos avisos esgotaram as tentativas nos últimos dias (somam ao "e-mails não saíram" da tela inicial). */
export async function contarAvisosFalhos(p: Planilhas, quem: Autorizador, agora: Date = new Date()): Promise<number> {
  if (!quem.temPermissao('comunicacao.revisar')) return 0;
  const [envios] = await lerTabelas(p, [EnviosComunicacao] as const);
  const desde = agora.getTime() - DIAS_DE_AVISO_FALHO * 86_400_000;
  return envios.ativos().filter((e) => ehAviso(e) && e.situacao === 'falhou' && new Date(e.criado_em).getTime() >= desde).length;
}
