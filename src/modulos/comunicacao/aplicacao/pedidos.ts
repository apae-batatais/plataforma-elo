/**
 * Casos de uso do pedido de publicação: enviar, ajustar (reenviar), cancelar, listar e detalhar.
 *
 * Quem pode:
 * - comunicacao.solicitar: pedir, acompanhar os próprios, ajustar os devolvidos, cancelar;
 * - comunicacao.revisar / aprovar: as filas da Comunicação e da coordenação;
 * - comunicacao.ver_todos: ver todos os pedidos.
 *
 * Toda mudança grava uma linha no histórico e a auditoria (só nomes de colunas), pela
 * função `registrarMudanca`. Antes de qualquer regra de situação, a versão lida é conferida:
 * se outra pessoa mexeu no pedido no meio, dá ErroConflito e nada é gravado.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Areas } from '@/nucleo/estrutura/tabelas';
import { contem, MAX_RESULTADOS_POR_APP, type ItemDaAgenda, type ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import {
  AnexosComunicacao,
  CalendarioComunicacao,
  HistoricoComunicacao,
  PedidosComunicacao,
  type RegAnexo,
  type RegHistorico,
  type RegPedido,
} from '../dados/tabelas';
import {
  ACOES,
  NOME_SITUACAO,
  COMENTARIO_OBRIGATORIO,
  conferirTransicao,
  ErroComunicacao,
  proximoNumero,
  SITUACOES_FINAIS,
  TIPOS_PECA,
  type Acao,
  type Situacao,
  type TipoPeca,
} from '../dominio/pedido';
import { lerDestinatarios as lerDestinatariosDoJson } from '../dominio/envio';
import { montarEmailPronto } from '../dominio/email-pronto';
import { feriadosAtivos } from '@/nucleo/feriados/feriados';
import { dataHoraEmBrasilia, diaEmBrasilia, ehUrgente } from '../dominio/prazos';
import { cancelarEnviosPendentes, contarEnviosFalhos, sincronizarEnvioDoAgendamento } from './envios';
import { conferirAnexosDoPedido, gravarAnexos, type AnexoPedido } from './anexos';
import { dataValida, itensParaPedido, salvarItemCalendario, type DadosItemCalendario } from './calendario';
import { lerAntecedencia } from './configuracoes';
import { destinatariosDe } from './contatos';
import { conferirPublicacaoAutomatica, sincronizarPublicacao } from './publicacoes';

const PERM = {
  solicitar: 'comunicacao.solicitar',
  revisar: 'comunicacao.revisar',
  aprovar: 'comunicacao.aprovar',
  verTodos: 'comunicacao.ver_todos',
} as const;

interface Opcoes {
  agora?: Date;
  /** Pasta de anexos da instituição; sem ela, pedido com anexo é recusado. */
  arquivos?: ArmazenamentoArquivos | null;
  /** Código da instituição (só para "Publicar pelo Elo", que procura a conta do Instagram dela). */
  instituicao?: string;
}

export interface DadosPedido {
  area: string;
  calendarioId: string | null;
  tipoPeca: TipoPeca;
  titulo: string;
  descricao: string;
  dataDesejada: string;
  linkVideo: string | null;
  imagemConfirmada: boolean;
  /** Fotos e documentos do pedido. Sem a lista, os anexos que já existem ficam como estão. */
  anexos?: AnexoPedido[];
}

export type Visao = 'meus' | 'revisar' | 'aprovar' | 'agendar' | 'agendados' | 'todos';

export interface LinhaPedido {
  id: string;
  numero: string;
  titulo: string;
  tipoPeca: TipoPeca;
  situacao: Situacao;
  urgente: boolean;
  dataDesejada: string;
  tema: string | null;
  solicitanteNome: string;
  area: string;
  agendadoPara: string | null;
}

const autoriaDe = (quem: Autorizador, agora: Date) => ({ email: quem.email, agora: () => agora });

/**
 * Grava o histórico e a auditoria de uma mudança do pedido. É a única porta de saída das ações
 * (a Tarefa 6 reaproveita). `pedido.situacao` é a situação antes da ação (null no envio) e
 * `colunas` são os nomes das colunas gravadas: a auditoria nunca guarda valores.
 */
export async function registrarMudanca(
  p: Planilhas,
  quem: Autorizador,
  pedido: { id: string; situacao: Situacao | null },
  acao: Acao | 'enviar' | 'editar',
  para: Situacao,
  comentario: string | null,
  agora: Date,
  colunas: string[],
): Promise<void> {
  await inserir(
    p,
    HistoricoComunicacao,
    { pedido_id: pedido.id, em: agora.toISOString(), usuario: quem.email, acao, de: pedido.situacao, para, comentario: comentario?.trim() || null },
    autoriaDe(quem, agora),
  );
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: acao === 'enviar' ? 'inclusao' : 'alteracao', entidade: 'PedidosComunicacao', registroId: pedido.id, detalhes: { colunas } },
    agora,
  );
}

/** Confere o formulário e devolve o que gravar nas colunas do pedido (sem gravar). */
async function conferirDados(
  p: Planilhas,
  quem: Autorizador,
  d: DadosPedido,
  agora: Date,
  temaAtual: { id: string | null; tema: string | null } | null,
  permitirPassado = false,
  areaAtual: string | null = null,
  temFoto = false,
) {
  const titulo = d.titulo.trim().replace(/\s+/g, ' ');
  const descricao = d.descricao.trim();
  if (!titulo) throw new ErroComunicacao('Informe o título.');
  if (!descricao) throw new ErroComunicacao('Descreva o que deve ser publicado.');
  if (!(TIPOS_PECA as readonly string[]).includes(d.tipoPeca)) throw new ErroComunicacao('Escolha o tipo de peça.');
  const [areas, calendario] = await lerTabelas(p, [Areas, CalendarioComunicacao] as const);
  // Na revisão, a área já gravada no pedido continua valendo mesmo se foi desativada depois.
  if (d.area !== areaAtual && !areas.ativos().some((a) => a.codigo === d.area)) throw new ErroComunicacao('Escolha a área.');

  let calendarioTema: string | null = null;
  if (d.calendarioId) {
    // No ajuste, o tema que já estava no pedido pode continuar mesmo se foi desativado depois.
    if (temaAtual?.id === d.calendarioId && temaAtual.tema) calendarioTema = temaAtual.tema;
    else {
      const t = calendario.porId(d.calendarioId);
      if (!t || !t.ativo) throw new ErroComunicacao('Escolha um tema ativo do calendário ou "Fora do calendário".');
      calendarioTema = t.tema;
    }
  }

  // Primeiro o formato da data: as contas de prazo só aceitam AAAA-MM-DD de um dia que existe.
  if (!dataValida(d.dataDesejada)) throw new ErroComunicacao('Informe a data desejada no formato dia/mês/ano.');
  const hoje = diaEmBrasilia(agora);
  if (!permitirPassado && d.dataDesejada < hoje) throw new ErroComunicacao('A data desejada não pode estar no passado.');

  const link = d.linkVideo?.trim() || null;
  if (link) {
    if (!link.startsWith('https://')) throw new ErroComunicacao('Cole o link completo da pasta do vídeo (começando com https://).');
  }
  // Regra 8: foto anexada ou link de vídeo só seguem com a confirmação de uso de imagem.
  const comImagem = Boolean(link) || temFoto;
  if (comImagem && !d.imagemConfirmada) throw new ErroComunicacao('Confirme que as pessoas que aparecem têm autorização de uso de imagem.');

  return {
    hoje,
    campos: {
      area: d.area,
      calendario_id: d.calendarioId || null,
      calendario_tema: calendarioTema,
      tipo_peca: d.tipoPeca,
      titulo,
      descricao,
      data_desejada: d.dataDesejada,
      urgente: ehUrgente(d.dataDesejada, hoje, await lerAntecedencia(p), await feriadosAtivos(p)),
      link_video: link,
      imagem_confirmada_em: comImagem ? agora.toISOString() : null,
      imagem_confirmada_por: comImagem ? quem.email : null,
    },
  };
}

export async function enviarPedido(
  p: Planilhas,
  quem: Autorizador,
  d: DadosPedido & { nomeSolicitante: string },
  opcoes: Opcoes = {},
): Promise<{ id: string; numero: string; urgente: boolean }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const plano = await conferirAnexosDoPedido(p, opcoes.arquivos ?? null, d.anexos, null);
  const { hoje, campos } = await conferirDados(p, quem, d, agora, null, false, null, plano.finais.some((a) => a.tipo === 'foto'));
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  // O número é lido e depois gravado: dois envios no mesmo instante podem repetir o número (risco aceito na fase 1).
  const numero = proximoNumero(
    pedidos.todos().map((x) => x.numero),
    Number(hoje.slice(0, 4)),
  );
  const dados = {
    numero,
    solicitante: quem.email,
    solicitante_nome: d.nomeSolicitante.trim() || quem.email,
    ...campos,
    situacao: 'aguardando_revisao' as const,
    juntado_a: null,
    enviado_em: agora.toISOString(),
    agendado_para: null,
    destinatarios: null,
    link_publicacao: null,
    publicado_em: null,
    envio_automatico: false,
  };
  const novo = await inserir(p, PedidosComunicacao, dados, autoriaDe(quem, agora));
  await gravarAnexos(p, quem, plano, novo.id, agora);
  await registrarMudanca(p, quem, { id: novo.id, situacao: null }, 'enviar', 'aguardando_revisao', null, agora, [...Object.keys(dados), ...(plano.mudou ? ['anexos'] : [])]);
  return { id: novo.id, numero, urgente: campos.urgente };
}

/** Lê o pedido e confere a versão antes de qualquer regra de situação. */
async function acharComVersao(p: Planilhas, id: string, versao: number): Promise<RegPedido> {
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const r = pedidos.porId(id);
  if (!r || !r.ativo) throw new ErroComunicacao('Pedido não encontrado.');
  if (r.versao !== versao) throw new ErroConflito(id);
  return r;
}

/** Ajustar e reenviar um pedido devolvido (só quem pediu). Recalcula a urgência. */
export async function reenviarPedido(p: Planilhas, quem: Autorizador, id: string, versao: number, d: DadosPedido, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  if (r.solicitante !== quem.email) throw new ErroPermissao('Só quem fez o pedido pode ajustá-lo.');
  const para = conferirTransicao(r.situacao, 'reenviar', r.tipo_peca);
  const plano = await conferirAnexosDoPedido(p, opcoes.arquivos ?? null, d.anexos, id);
  const { campos } = await conferirDados(p, quem, d, agora, { id: r.calendario_id, tema: r.calendario_tema }, false, null, plano.finais.some((a) => a.tipo === 'foto'));
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, { ...campos, situacao: para }, autoriaDe(quem, agora));
  await gravarAnexos(p, quem, plano, id, agora);
  await registrarMudanca(p, quem, r, 'reenviar', para, null, agora, [...colunasAlteradas, ...(plano.mudou ? ['anexos'] : [])]);
}

/** Cancelar (só quem pediu, em Aguardando revisão ou Devolvido). */
export async function cancelarPedido(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  if (r.solicitante !== quem.email) throw new ErroPermissao('Só quem fez o pedido pode cancelá-lo.');
  const para = conferirTransicao(r.situacao, 'cancelar', r.tipo_peca);
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, { situacao: para }, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, r, 'cancelar', para, null, agora, colunasAlteradas);
}

// ---------------------------------------------------------------------------
// Revisão e aprovação
// ---------------------------------------------------------------------------

function exigirPermissao(quem: Autorizador, permissao: string): void {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

/** Confere a transição, o motivo (quando obrigatório) e se esta pessoa pode fazer a ação neste pedido. */
function conferirAcao(quem: Autorizador, r: RegPedido, acao: Acao, comentario: string | null): { para: Situacao; motivo: string | null } {
  const para = conferirTransicao(r.situacao, acao, r.tipo_peca);
  const motivo = comentario?.trim() || null;
  if (COMENTARIO_OBRIGATORIO.has(acao) && !motivo) throw new ErroComunicacao('Escreva o motivo para quem pediu.');
  if (!acoesPossiveis(quem, r).includes(acao)) throw new ErroPermissao();
  return { para, motivo };
}

/** Ações que cada porta aceita, e as situações em que valem (conferido no servidor, não só na tela). */
export const ACOES_DA_REVISAO = ['iniciar_revisao', 'enviar_aprovacao', 'devolver', 'recusar'] as const;
export const ACOES_DA_DECISAO = ['aprovar', 'pedir_ajustes', 'recusar'] as const;
const SITUACOES_DA_REVISAO: Situacao[] = ['aguardando_revisao', 'em_revisao'];

function exigirAcaoValida(r: RegPedido, acao: string, permitidas: readonly string[], situacoes: Situacao[]): void {
  if (!permitidas.includes(acao) || !situacoes.includes(r.situacao)) throw new ErroComunicacao('Ação inválida.');
}

async function mover(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  acao: Acao,
  comentario: string | null,
  agora: Date,
  permitidas: readonly string[],
  situacoes: Situacao[],
): Promise<void> {
  const r = await acharComVersao(p, id, versao);
  exigirAcaoValida(r, acao, permitidas, situacoes);
  const { para, motivo } = conferirAcao(quem, r, acao, comentario);
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, { situacao: para }, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, r, acao, para, motivo, agora, colunasAlteradas);
}

/** Passos da Comunicação: começar a revisão, enviar para aprovação, devolver ou recusar. */
export async function revisarPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  acao: 'iniciar_revisao' | 'enviar_aprovacao' | 'devolver' | 'recusar',
  comentario: string | null,
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  await mover(p, quem, id, versao, acao, comentario, opcoes.agora ?? new Date(), ACOES_DA_REVISAO, SITUACOES_DA_REVISAO);
}

/** Decisão da coordenação da Comunicação (inclusive sobre os próprios pedidos). */
export async function decidirPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  decisao: 'aprovar' | 'pedir_ajustes' | 'recusar',
  comentario: string | null,
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.aprovar);
  await mover(p, quem, id, versao, decisao, comentario, opcoes.agora ?? new Date(), ACOES_DA_DECISAO, ['aguardando_aprovacao']);
}

/** Junta o pedido a outro em andamento; o destino recebe a referência no histórico. */
export async function juntarPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  destinoId: string,
  comentario: string | null,
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  const { para, motivo } = conferirAcao(quem, r, 'juntar', comentario);
  if (destinoId === id) throw new ErroComunicacao('Escolha outro pedido para juntar.');
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  // O destino é lido sem conferir a versão dele: só ganha uma linha de histórico (corrida estreita, sem perda de dados).
  const destino = pedidos.porId(destinoId);
  if (!destino || !destino.ativo) throw new ErroComunicacao('Não encontramos o pedido escolhido.');
  if (SITUACOES_FINAIS.has(destino.situacao)) throw new ErroComunicacao('Este pedido já foi encerrado; escolha um pedido em andamento.');
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, { situacao: para, juntado_a: destino.numero }, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, r, 'juntar', para, motivo, agora, colunasAlteradas);
  // O destino não muda de situação; só ganha no histórico a referência do pedido juntado.
  await registrarMudanca(p, quem, destino, 'juntar', destino.situacao, `Pedido ${r.numero} foi juntado a este.`, agora, []);
}

/** Alterações da Comunicação durante a revisão. O histórico lista as colunas, nunca os valores. */
export async function editarNaRevisao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  m: Partial<Pick<DadosPedido, 'titulo' | 'descricao' | 'tipoPeca' | 'calendarioId' | 'dataDesejada' | 'anexos'>> & {
    /** Cria este tema no calendário e liga o pedido a ele (pede a permissão de gerenciar o calendário). */
    novoTema?: Omit<DadosItemCalendario, 'id' | 'versao'>;
  },
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  if (r.situacao !== 'em_revisao') throw new ErroComunicacao(`Esta ação não vale para um pedido em "${NOME_SITUACAO[r.situacao]}".`);
  const plano = await conferirAnexosDoPedido(p, opcoes.arquivos ?? null, m.anexos, id);
  // A Comunicação não confirma o uso de imagem por quem pediu: foto nova só entra se a confirmação já existe.
  if (plano.novos.some((a) => a.tipo === 'foto') && !r.imagem_confirmada_em)
    throw new ErroComunicacao('Quem pediu ainda não confirmou o uso de imagem. Para incluir uma foto, devolva o pedido para ela ajustar com a confirmação.');
  const dataMudou = m.dataDesejada !== undefined && m.dataDesejada !== r.data_desejada;
  const dadosCom = (calendarioId: string | null): DadosPedido => ({
    area: r.area,
    calendarioId,
    tipoPeca: m.tipoPeca ?? r.tipo_peca,
    titulo: m.titulo ?? r.titulo,
    descricao: m.descricao ?? r.descricao,
    dataDesejada: m.dataDesejada ?? r.data_desejada,
    linkVideo: r.link_video,
    imagemConfirmada: true,
  });
  const conferir = (calendarioId: string | null) =>
    conferirDados(p, quem, dadosCom(calendarioId), agora, { id: r.calendario_id, tema: r.calendario_tema }, !dataMudou, r.area);
  let calendarioId = m.calendarioId === undefined ? r.calendario_id : m.calendarioId;
  if (m.novoTema) {
    exigirPermissao(quem, 'comunicacao.calendario.gerenciar');
    await conferir(calendarioId); // confere o resto antes de criar o tema
    calendarioId = (await salvarItemCalendario(p, quem, m.novoTema, { agora })).id;
  }
  const { campos } = await conferir(calendarioId);
  // A urgência só é refeita quando a data muda; a confirmação de imagem fica como quem pediu deu.
  const mudancas: Record<string, unknown> = {
    titulo: campos.titulo,
    descricao: campos.descricao,
    tipo_peca: campos.tipo_peca,
    calendario_id: campos.calendario_id,
    calendario_tema: campos.calendario_tema,
    data_desejada: campos.data_desejada,
    ...(dataMudou ? { urgente: campos.urgente } : {}),
  };
  // Sem nada de novo, não grava (nem muda a versão).
  if (!plano.mudou && Object.entries(mudancas).every(([c, v]) => v === (r as unknown as Record<string, unknown>)[c]))
    throw new ErroComunicacao('Nenhuma alteração para salvar.');
  // Só anexos mudando também sobe a versão do pedido, para duas pessoas não editarem ao mesmo tempo.
  const { colunasAlteradas: alteradas } = await atualizar(p, PedidosComunicacao, id, versao, mudancas, autoriaDe(quem, agora));
  await gravarAnexos(p, quem, plano, id, agora);
  const colunasAlteradas = [...alteradas, ...(plano.mudou ? ['anexos'] : [])];
  await registrarMudanca(p, quem, r, 'editar', 'em_revisao', `Colunas alteradas: ${colunasAlteradas.join(', ')}`, agora, colunasAlteradas);
}

// ---------------------------------------------------------------------------
// Agendamento, e-mail pronto e publicação
// ---------------------------------------------------------------------------

/** Peças que saem por e-mail: pedem destinatários ao agendar. */
const SAI_POR_EMAIL: ReadonlySet<TipoPeca> = new Set<TipoPeca>(['release', 'artigo']);

const lerDestinatarios = (r: RegPedido) => lerDestinatariosDoJson(r.destinatarios);

/**
 * Agenda um pedido aprovado ou muda a data de um já agendado. `agendadoPara` é uma data e hora
 * com fuso (ex.: 2026-11-10T10:00:00-03:00); fica gravada em ISO UTC. Release e artigo pedem
 * pelo menos um contato ativo (nos grupos ou escolhido).
 */
export async function agendarPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  a: {
    agendadoPara: string;
    grupos: string[];
    contatos: string[];
    /** Release e artigo: o Elo envia na hora marcada. */
    envioAutomatico?: boolean;
    /** Post de Instagram: o Elo publica na hora marcada. */
    publicarPeloElo?: boolean;
  },
  opcoes: Opcoes & {
    /** A instituição tem e-mail de envio? Sem ele, o envio automático é recusado. */
    emailDisponivel?: boolean;
  } = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  const acao: Acao = r.situacao === 'agendado' ? 'reagendar' : 'agendar';
  const { para } = conferirAcao(quem, r, acao, null);
  const quando = new Date(a.agendadoPara);
  if (!a.agendadoPara.trim() || Number.isNaN(quando.getTime())) throw new ErroComunicacao('Informe a data e a hora do agendamento.');
  if (quando.getTime() <= agora.getTime()) throw new ErroComunicacao('Escolha uma data e hora no futuro.');
  let destinatarios: string | null = null;
  const automatico = SAI_POR_EMAIL.has(r.tipo_peca) && a.envioAutomatico === true;
  if (automatico && !opcoes.emailDisponivel) throw new ErroComunicacao('A instituição ainda não informou o e-mail de envio. Escolha abrir o e-mail pronto no seu Gmail.');
  if (SAI_POR_EMAIL.has(r.tipo_peca)) {
    const escolha = { grupos: [...new Set(a.grupos)], contatos: [...new Set(a.contatos)] };
    if ((await destinatariosDe(p, escolha)).length === 0) throw new ErroComunicacao('Escolha pelo menos um contato ativo para receber o e-mail.');
    destinatarios = JSON.stringify(escolha);
  }
  const automatica = a.publicarPeloElo === true;
  if (automatica) {
    if (!opcoes.instituicao) throw new ErroComunicacao('Não foi possível conferir o Instagram da instituição.');
    await conferirPublicacaoAutomatica(p, r, opcoes.instituicao, agora);
  }
  // Antes de gravar o pedido: se a publicação já está em andamento, nada muda.
  if (automatica || r.publicacao_automatica) await sincronizarPublicacao(p, quem, id, { automatica, previstaPara: quando.toISOString() }, agora);
  const { colunasAlteradas } = await atualizar(
    p,
    PedidosComunicacao,
    id,
    versao,
    { situacao: para, agendado_para: quando.toISOString(), destinatarios, envio_automatico: automatico, publicacao_automatica: automatica },
    autoriaDe(quem, agora),
  );
  if (SAI_POR_EMAIL.has(r.tipo_peca)) await sincronizarEnvioDoAgendamento(p, quem, r, automatico, quando, agora);
  const anterior = acao === 'reagendar' && r.agendado_para ? `Data anterior: ${dataHoraEmBrasilia(r.agendado_para)}.` : null;
  await registrarMudanca(p, quem, r, acao, para, anterior, agora, colunasAlteradas);
}

/** Dados do e-mail pronto de um release ou artigo agendado (só a Comunicação e quem tem mais permissões). */
export async function emailProntoDoPedido(p: Planilhas, quem: Autorizador, id: string): Promise<ReturnType<typeof montarEmailPronto>> {
  exigirPermissao(quem, PERM.revisar);
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const r = pedidos.porId(id);
  if (!r || !r.ativo) throw new ErroComunicacao('Pedido não encontrado.');
  if (r.situacao !== 'agendado' || !SAI_POR_EMAIL.has(r.tipo_peca)) throw new ErroComunicacao('O e-mail pronto só existe para release e artigo agendados.');
  return montarEmailPronto({ destinatarios: await destinatariosDe(p, lerDestinatarios(r)), assunto: r.titulo, corpo: r.descricao });
}

/** Contagem de quem receberá o e-mail do pedido (para a tela, sem mostrar os endereços). */
export async function destinatariosDoPedido(p: Planilhas, quem: Autorizador, id: string): Promise<{ grupos: string[]; contatos: string[] }> {
  exigirPermissao(quem, PERM.revisar);
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const r = pedidos.porId(id);
  if (!r || !r.ativo) throw new ErroComunicacao('Pedido não encontrado.');
  return lerDestinatarios(r);
}

const NOME_REDE: Partial<Record<TipoPeca, string>> = { post_instagram: 'no Instagram', reel_instagram: 'no Instagram' };

/** Marca como publicado (entrevista: realizada) um pedido agendado. Post e reel pedem o link da publicação. */
export async function publicarPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  x: { link: string | null; comentario: string | null },
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  const { para, motivo } = conferirAcao(quem, r, 'publicar', x.comentario);
  const link = x.link?.trim() || null;
  if (NOME_REDE[r.tipo_peca] && !link) throw new ErroComunicacao(`Cole o link da publicação ${NOME_REDE[r.tipo_peca]}.`);
  if (link && !link.startsWith('https://')) throw new ErroComunicacao('Cole o link completo da publicação (começando com https://).');
  // Publicar à mão encerra a publicação automática (se estiver em andamento, o Elo avisa e nada muda).
  if (r.publicacao_automatica) await sincronizarPublicacao(p, quem, id, { automatica: false, previstaPara: r.agendado_para ?? agora.toISOString() }, agora);
  const { colunasAlteradas } = await atualizar(
    p,
    PedidosComunicacao,
    id,
    versao,
    { situacao: para, link_publicacao: link, publicado_em: agora.toISOString(), publicacao_automatica: false },
    autoriaDe(quem, agora),
  );
  await cancelarEnviosPendentes(p, quem.email, id, agora);
  await registrarMudanca(p, quem, r, 'publicar', para, motivo, agora, colunasAlteradas);
}

// ---------------------------------------------------------------------------
// Quem vê e o que pode fazer
// ---------------------------------------------------------------------------

function podeVer(quem: Autorizador, r: RegPedido): boolean {
  return r.solicitante === quem.email || quem.temPermissao(PERM.verTodos);
}

/** Ações que esta pessoa pode fazer agora neste pedido (a situação e a permissão precisam combinar). */
function acoesPossiveis(quem: Autorizador, r: RegPedido): Acao[] {
  const dono = r.solicitante === quem.email;
  const permitida = (a: Acao): boolean => {
    if (a === 'reenviar' || a === 'cancelar') return dono;
    if (a === 'aprovar' || a === 'pedir_ajustes') return quem.temPermissao(PERM.aprovar);
    if (a === 'recusar') return quem.temPermissao(r.situacao === 'aguardando_aprovacao' ? PERM.aprovar : PERM.revisar);
    return quem.temPermissao(PERM.revisar);
  };
  return ACOES.filter((a) => {
    try {
      conferirTransicao(r.situacao, a, r.tipo_peca);
    } catch {
      return false;
    }
    return permitida(a);
  });
}

const FILA: Record<Exclude<Visao, 'meus' | 'todos'>, { permissao: string; situacoes: Situacao[] }> = {
  revisar: { permissao: PERM.revisar, situacoes: ['aguardando_revisao', 'em_revisao'] },
  aprovar: { permissao: PERM.aprovar, situacoes: ['aguardando_aprovacao'] },
  agendar: { permissao: PERM.revisar, situacoes: ['aprovado'] },
  agendados: { permissao: PERM.revisar, situacoes: ['agendado'] },
};

export interface FiltrosPedidos {
  situacao?: string;
  tipo?: string;
  area?: string;
  /** Tema do calendário; "fora" para os pedidos sem tema. */
  tema?: string;
}

/** Filtros da tela Pedidos (pílulas): cada um só vale quando preenchido. */
export function filtrarPedidos(linhas: LinhaPedido[], f: FiltrosPedidos): LinhaPedido[] {
  return linhas.filter(
    (r) =>
      (!f.situacao || r.situacao === f.situacao) &&
      (!f.tipo || r.tipoPeca === f.tipo) &&
      (!f.area || r.area === f.area) &&
      (!f.tema || (f.tema === 'fora' ? r.tema === null : r.tema === f.tema)),
  );
}

export async function listarPedidos(p: Planilhas, quem: Autorizador, visao: Visao): Promise<LinhaPedido[]> {
  if (visao === 'meus' ? !quem.temPermissaoAlgumEscopo(PERM.solicitar) : !quem.temPermissao(visao === 'todos' ? PERM.verTodos : FILA[visao].permissao))
    throw new ErroPermissao();
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const filtro = (r: RegPedido) => (visao === 'meus' ? r.solicitante === quem.email : visao === 'todos' ? true : FILA[visao].situacoes.includes(r.situacao));
  return pedidos
    .ativos()
    .filter(filtro)
    .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
    .map((r) => ({
      id: r.id,
      numero: r.numero,
      titulo: r.titulo,
      tipoPeca: r.tipo_peca,
      situacao: r.situacao,
      urgente: r.urgente,
      dataDesejada: r.data_desejada,
      tema: r.calendario_tema,
      solicitanteNome: r.solicitante_nome,
      area: r.area,
      agendadoPara: r.agendado_para,
    }));
}

export async function detalharPedido(
  p: Planilhas,
  quem: Autorizador,
  id: string,
): Promise<{ pedido: RegPedido; historico: RegHistorico[]; anexos: RegAnexo[]; acoes: Acao[] }> {
  const [pedidos, historico, anexos] = await lerTabelas(p, [PedidosComunicacao, HistoricoComunicacao, AnexosComunicacao] as const);
  const r = pedidos.porId(id);
  if (!r || !r.ativo) throw new ErroComunicacao('Pedido não encontrado.');
  if (!podeVer(quem, r)) throw new ErroPermissao('Você não tem acesso a este pedido.');
  return {
    pedido: r,
    historico: historico
      .todos()
      .filter((h) => h.pedido_id === id)
      .sort((a, b) => a.em.localeCompare(b.em)),
    // O código do arquivo é sensível: quem abre o anexo (rota própria, com auditoria) lê por conta própria.
    anexos: anexos
      .ativos()
      .filter((a) => a.pedido_id === id)
      .map((a) => ({ ...a, arquivo_id: '' })),
    acoes: acoesPossiveis(quem, r),
  };
}

/** O que o formulário precisa: temas para escolher, áreas, o dia de hoje e a antecedência mínima. */
export async function opcoesDoPedido(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}) {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [areas] = await lerTabelas(p, [Areas] as const);
  return {
    itens: await itensParaPedido(p, quem, { agora }),
    areas: areas
      .ativos()
      .map((a) => ({ codigo: a.codigo, nome: a.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    hoje: diaEmBrasilia(agora),
    antecedencia: await lerAntecedencia(p),
    feriados: [...(await feriadosAtivos(p))].sort(),
  };
}

/**
 * Números dos avisos (início e menu): o que espera por esta pessoa.
 * Cada número só conta para quem tem a permissão correspondente; "hoje" é o dia de Brasília.
 */
export async function contadoresComunicacao(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}) {
  const hoje = diaEmBrasilia(opcoes.agora ?? new Date());
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const ativos = pedidos.ativos();
  const aRevisar = quem.temPermissao(PERM.revisar) ? ativos.filter((r) => r.situacao === 'aguardando_revisao' || r.situacao === 'em_revisao') : [];
  return {
    devolvidos: quem.temPermissaoAlgumEscopo(PERM.solicitar) ? ativos.filter((r) => r.solicitante === quem.email && r.situacao === 'devolvido').length : 0,
    revisar: aRevisar.length,
    urgentes: aRevisar.filter((r) => r.urgente).length,
    publicarHoje: quem.temPermissao(PERM.revisar)
      ? ativos.filter((r) => r.situacao === 'agendado' && r.agendado_para !== null && diaEmBrasilia(new Date(r.agendado_para)) === hoje).length
      : 0,
    aprovar: quem.temPermissao(PERM.aprovar) ? ativos.filter((r) => r.situacao === 'aguardando_aprovacao').length : 0,
    enviosFalharam: await contarEnviosFalhos(p, quem),
  };
}

// ---------------------------------------------------------------------------
// Visão de ligação (ADR-022): publicações do serviço para a Ficha do serviço
// ---------------------------------------------------------------------------

export interface PublicacoesDoServico {
  emAndamento: number;
  /** Pedidos publicados ou realizados nos últimos 12 meses. */
  publicadosNosUltimos12Meses: number;
  /** Os últimos pedidos publicados, sem o nome de quem pediu. */
  ultimosPublicados: { numero: string; titulo: string; tipoPeca: string; publicadoEm: string | null; link: string | null }[];
}

/** Pedidos ligados ao serviço que a pessoa já pode ver. Nunca traz o nome de quem pediu. */
export async function publicacoesDoServico(p: Planilhas, quem: Autorizador, servico: string, opcoes: { agora?: Date } = {}): Promise<Ligacao<PublicacoesDoServico>> {
  if (!quem.temPermissaoAlgumEscopo('comunicacao.acessar')) return ligacaoSemPermissao();
  const agora = opcoes.agora ?? new Date();
  const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
  const doServico = pedidos.ativos().filter((r) => r.servico === servico && podeVer(quem, r));
  const limite = new Date(agora.getTime() - 365 * 86400_000).toISOString();
  const feitos = doServico.filter((r) => (r.situacao === 'publicado' || r.situacao === 'realizada') && (r.publicado_em ?? r.enviado_em) >= limite);
  return ligacaoOk({
    emAndamento: doServico.filter((r) => !SITUACOES_FINAIS.has(r.situacao)).length,
    publicadosNosUltimos12Meses: feitos.length,
    ultimosPublicados: feitos
      .sort((a, b) => (b.publicado_em ?? b.enviado_em).localeCompare(a.publicado_em ?? a.enviado_em))
      .slice(0, 5)
      .map((r) => ({ numero: r.numero, titulo: r.titulo, tipoPeca: r.tipo_peca, publicadoEm: r.publicado_em, link: r.link_publicacao })),
  });
}

// ---------------------------------------------------------------------------
// Agenda única e busca única (ADR-024): só o que a pessoa já vê em Comunicação
// ---------------------------------------------------------------------------

/** Temas do calendário (para quem o gerencia) e publicações agendadas (dos pedidos que a pessoa vê). */
export async function itensDaAgenda(p: Planilhas, quem: Autorizador): Promise<ItemDaAgenda[]> {
  if (!quem.temPermissaoAlgumEscopo('comunicacao.acessar')) return [];
  const [calendario, pedidos] = await lerTabelas(p, [CalendarioComunicacao, PedidosComunicacao] as const);
  const itens: ItemDaAgenda[] = [];
  if (quem.temPermissao('comunicacao.calendario.gerenciar'))
    for (const t of calendario.ativos())
      itens.push({
        app: 'comunicacao',
        tipo: 'Tema',
        titulo: `Tema: ${t.tema}`,
        data: t.inicio,
        ate: t.fim > t.inicio ? t.fim : null,
        mes: null,
        servico: null,
        href: '/comunicacao/calendario',
        vencivel: false,
      });
  for (const r of pedidos.ativos().filter((x) => x.situacao === 'agendado' && x.agendado_para && podeVer(quem, x)))
    itens.push({
      app: 'comunicacao',
      tipo: 'Publicação agendada',
      titulo: `Publicação agendada: ${r.titulo}`,
      data: diaEmBrasilia(new Date(r.agendado_para!)),
      ate: null,
      mes: null,
      servico: r.servico ?? null,
      href: `/comunicacao/${r.id}`,
      vencivel: true,
    });
  return itens;
}

/** Pedidos por número ou título, e temas do calendário (para quem o gerencia). Nunca o nome de quem pediu. */
export async function buscar(p: Planilhas, quem: Autorizador, termo: string): Promise<ResultadoDaBusca[]> {
  if (!quem.temPermissaoAlgumEscopo('comunicacao.acessar')) return [];
  const [calendario, pedidos] = await lerTabelas(p, [CalendarioComunicacao, PedidosComunicacao] as const);
  const doCalendario: ResultadoDaBusca[] = quem.temPermissao('comunicacao.calendario.gerenciar')
    ? calendario
        .ativos()
        .filter((t) => contem(t.tema, termo))
        .map((t) => ({ app: 'comunicacao', tipo: 'Tema', titulo: t.tema, apoio: 'Tema do calendário', href: '/comunicacao/calendario' }))
    : [];
  const dosPedidos: ResultadoDaBusca[] = pedidos
    .ativos()
    .filter((r) => (contem(r.numero, termo) || contem(r.titulo, termo)) && podeVer(quem, r))
    .map((r) => ({ app: 'comunicacao', tipo: 'Pedido', titulo: r.titulo, apoio: `${r.numero} · ${NOME_SITUACAO[r.situacao]}`, href: `/comunicacao/${r.id}` }));
  return [...dosPedidos, ...doCalendario].slice(0, MAX_RESULTADOS_POR_APP);
}
