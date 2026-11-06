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
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas } from '@/nucleo/estrutura/tabelas';
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
import { diaEmBrasilia, ehUrgente } from '../dominio/prazos';
import { dataValida, itensParaPedido, salvarItemCalendario, type DadosItemCalendario } from './calendario';
import { lerAntecedencia } from './configuracoes';

const PERM = {
  solicitar: 'comunicacao.solicitar',
  revisar: 'comunicacao.revisar',
  aprovar: 'comunicacao.aprovar',
  verTodos: 'comunicacao.ver_todos',
} as const;

interface Opcoes {
  agora?: Date;
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
    if (!d.imagemConfirmada) throw new ErroComunicacao('Confirme que as pessoas que aparecem têm autorização de uso de imagem.');
  }

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
      urgente: ehUrgente(d.dataDesejada, hoje, await lerAntecedencia(p)),
      link_video: link,
      imagem_confirmada_em: link ? agora.toISOString() : null,
      imagem_confirmada_por: link ? quem.email : null,
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
  const { hoje, campos } = await conferirDados(p, quem, d, agora, null);
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
  };
  const novo = await inserir(p, PedidosComunicacao, dados, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, { id: novo.id, situacao: null }, 'enviar', 'aguardando_revisao', null, agora, Object.keys(dados));
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
  const { campos } = await conferirDados(p, quem, d, agora, { id: r.calendario_id, tema: r.calendario_tema });
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, { ...campos, situacao: para }, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, r, 'reenviar', para, null, agora, colunasAlteradas);
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
  m: Partial<Pick<DadosPedido, 'titulo' | 'descricao' | 'tipoPeca' | 'calendarioId' | 'dataDesejada'>> & {
    /** Cria este tema no calendário e liga o pedido a ele (pede a permissão de gerenciar o calendário). */
    novoTema?: Omit<DadosItemCalendario, 'id' | 'versao'>;
  },
  opcoes: Opcoes = {},
): Promise<void> {
  exigirPermissao(quem, PERM.revisar);
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  if (r.situacao !== 'em_revisao') throw new ErroComunicacao(`Esta ação não vale para um pedido em "${NOME_SITUACAO[r.situacao]}".`);
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
  if (Object.entries(mudancas).every(([c, v]) => v === (r as unknown as Record<string, unknown>)[c]))
    throw new ErroComunicacao('Nenhuma alteração para salvar.');
  const { colunasAlteradas } = await atualizar(p, PedidosComunicacao, id, versao, mudancas, autoriaDe(quem, agora));
  await registrarMudanca(p, quem, r, 'editar', 'em_revisao', `Colunas alteradas: ${colunasAlteradas.join(', ')}`, agora, colunasAlteradas);
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
  };
}
