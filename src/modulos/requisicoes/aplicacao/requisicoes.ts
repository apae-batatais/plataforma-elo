/**
 * Casos de uso das requisições.
 *
 * Quem pode:
 * - qualquer pessoa com acesso (requisicoes.solicitar): abrir, acompanhar as
 *   próprias, ajustar e reenviar as devolvidas, cancelar enquanto não aprovada;
 * - a coordenação dos centros de custo (requisicoes.aprovar no escopo): aprovar,
 *   devolver ou recusar; a Diretoria (requisicoes.aprovar global) também, e é
 *   quem aprova os pedidos da própria coordenação e os de serviços sem coordenação;
 * - o setor do tipo (perfil responsável + requisicoes.atender): receber e concluir;
 * - requisicoes.ver_todas: ver tudo.
 *
 * Cada mudança de etapa grava uma linha no histórico e a auditoria (só colunas).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Atribuicoes, PerfilPermissoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  ParametrosRequisicoes, RequisicaoCentros, RequisicaoHistorico, RequisicaoItens, Requisicoes, TiposRequisicao,
  type RegCentro, type RegItem, type RegRequisicao, type RegTipo,
} from '../dados/tabelas';
import {
  conferirCentros, conferirItens, conferirTransicao, coordenadoresDoServico, ErroRequisicao, esquemaDetalhesMateriais, NOME_SITUACAO, proximoNumero,
  rotaDeAprovacao, SITUACOES_ENCERRADAS,
  type Acao, type AtribuicaoAprovacao, type Centro, type ItemPedido, type RotaAprovacao, type Situacao,
} from '../dominio/requisicao';
import { EXPEDIENTE_PADRAO, prazoDaEtapa, type Expediente, type SituacaoPrazo } from '../dominio/sla';

/** Grupos de gasto do Orçamento, entregues pela plataforma (um módulo não lê as abas de outro). */
export interface CatalogoOrcamento {
  gruposDeGasto(): Promise<{ id: string; nome: string }[]>;
}

export { ErroRequisicao };

const PERM = {
  solicitar: 'requisicoes.solicitar',
  aprovar: 'requisicoes.aprovar',
  atender: 'requisicoes.atender',
  verTodas: 'requisicoes.ver_todas',
  tipos: 'requisicoes.tipos.gerenciar',
} as const;

const hoje = (agora: Date) => agora.toISOString().slice(0, 10);
const vigente = (r: { ativo: boolean; inicio: string | null; fim: string | null }, dia: string) =>
  r.ativo && (!r.inicio || r.inicio <= dia) && (!r.fim || r.fim >= dia);

// ---------------------------------------------------------------------------
// Leitura de tudo o que as regras precisam (uma ida a cada planilha)
// ---------------------------------------------------------------------------

async function ler(p: Planilhas, agora: Date) {
  const [tipos, requisicoes, centros, itens, parametros, usuarios, atribuicoes, perfilPermissoes, servicos, areas, perfis] = await lerTabelas(p, [
    TiposRequisicao, Requisicoes, RequisicaoCentros, RequisicaoItens, ParametrosRequisicoes, Usuarios, Atribuicoes, PerfilPermissoes, Servicos, Areas, Perfis,
  ] as const);
  const dia = hoje(agora);
  const ativos = new Set(usuarios.ativos().map((u) => u.email));
  const atribs: AtribuicaoAprovacao[] = atribuicoes
    .ativos()
    .filter((a) => ativos.has(a.usuario_email) && vigente(a, dia))
    .map((a) => ({ email: a.usuario_email, perfil: a.perfil, escopoTipo: a.escopo_tipo, escopo: a.escopo }));
  const perfisCom = (permissao: string) => new Set(perfilPermissoes.ativos().filter((x) => x.permissao === permissao).map((x) => x.perfil));
  const aprovam = perfisCom(PERM.aprovar);
  const servicoPorCodigo = new Map(servicos.todos().map((s) => [s.codigo, s]));
  const centrosPor = agrupar(centros.ativos(), (c) => c.requisicao_id);
  const itensPor = agrupar(itens.ativos(), (i) => i.requisicao_id);
  const valor = (chave: string, padrao: number) => parametros.ativos().find((x) => x.chave === chave)?.valor ?? padrao;
  const expediente: Expediente = { inicio: valor('expediente_inicio', EXPEDIENTE_PADRAO.inicio), fim: valor('expediente_fim', EXPEDIENTE_PADRAO.fim) };

  const coordenacao = (codigo: string) => {
    const s = servicoPorCodigo.get(codigo);
    return s ? coordenadoresDoServico({ codigo: s.codigo, area: s.area, unidade: s.unidade }, atribs, aprovam) : new Set<string>();
  };
  const perfisDe = (email: string) => new Set(atribs.filter((a) => a.email === email).map((a) => a.perfil));
  return {
    tipos, requisicoes, centros, itens, parametros, servicos, areas, perfis, perfilPermissoes,
    tipoPorId: new Map(tipos.todos().map((t) => [t.id, t])),
    servicoPorCodigo, centrosPor, itensPor, expediente, coordenacao, perfisDe, perfisCom,
  };
}
type Dados = Awaited<ReturnType<typeof ler>>;

function agrupar<T>(lista: T[], chave: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of lista) m.set(chave(x), [...(m.get(chave(x)) ?? []), x]);
  return m;
}

// ---------------------------------------------------------------------------
// Quem pode o quê numa requisição
// ---------------------------------------------------------------------------

function coordenacaoAtual(d: Dados, r: RegRequisicao): Set<string> {
  const sets = (d.centrosPor.get(r.id) ?? []).map((c) => d.coordenacao(c.servico));
  if (sets.length === 0) return new Set();
  return new Set([...sets[0]].filter((e) => sets.every((s) => s.has(e))));
}

function podeAprovar(quem: Autorizador, d: Dados, r: RegRequisicao): boolean {
  if (quem.temPermissao(PERM.aprovar)) return true; // Diretoria (global)
  if (r.aprovacao !== 'coordenacao' || !quem.temPermissaoAlgumEscopo(PERM.aprovar)) return false;
  return coordenacaoAtual(d, r).has(quem.email) && r.requisitante !== quem.email;
}

function podeAtender(quem: Autorizador, d: Dados, r: RegRequisicao): boolean {
  const tipo = d.tipoPorId.get(r.tipo_id);
  return Boolean(tipo && quem.temPermissaoAlgumEscopo(PERM.atender) && d.perfisDe(quem.email).has(tipo.perfil_responsavel));
}

function podeVer(quem: Autorizador, d: Dados, r: RegRequisicao): boolean {
  if (r.requisitante === quem.email || quem.temPermissao(PERM.verTodas)) return true;
  if (quem.temPermissaoAlgumEscopo(PERM.aprovar) && (r.aprovacao === 'coordenacao' ? coordenacaoAtual(d, r).has(quem.email) : quem.temPermissao(PERM.aprovar))) return true;
  return podeAtender(quem, d, r) && !['enviada', 'devolvida', 'recusada', 'cancelada'].includes(r.situacao);
}

function acoesPossiveis(quem: Autorizador, d: Dados, r: RegRequisicao): Acao[] {
  const a: Acao[] = [];
  const s = r.situacao;
  if (r.requisitante === quem.email && s === 'devolvida') a.push('reenviar');
  if (r.requisitante === quem.email && (s === 'enviada' || s === 'devolvida')) a.push('cancelar');
  if (s === 'enviada' && podeAprovar(quem, d, r)) a.push('aprovar', 'devolver', 'recusar');
  if (s === 'aprovada' && podeAtender(quem, d, r)) a.push('receber');
  if (s === 'em_atendimento' && podeAtender(quem, d, r)) a.push('concluir');
  return a;
}

/** SLA da etapa atual (ou da última, se encerrada). */
function sla(d: Dados, r: RegRequisicao, agora: Date) {
  const tipo = d.tipoPorId.get(r.tipo_id);
  if (!tipo) return null;
  const agoraISO = agora.toISOString();
  const aprovacao = prazoDaEtapa(r.enviada_em, r.decidida_em, tipo.prazo_aprovacao, agoraISO, d.expediente);
  const atendimento =
    r.situacao === 'aprovada' || r.situacao === 'em_atendimento' || r.situacao === 'atendida' || r.situacao === 'atendida_parcial'
      ? prazoDaEtapa(r.decidida_em!, r.concluida_em, tipo.prazo_atendimento, agoraISO, d.expediente)
      : null;
  return {
    aprovacao: { ...aprovacao, prazo: tipo.prazo_aprovacao },
    atendimento: atendimento ? { ...atendimento, prazo: tipo.prazo_atendimento } : null,
  };
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

export interface DadosRequisicao {
  tipoId: string;
  area: string;
  grupoId: string;
  centros: Centro[];
  itens: ItemPedido[];
  /** Campos próprios da ficha (entrega, evento, utensílios). */
  detalhes: unknown;
  observacao?: string | null;
}

export async function opcoesDoFormulario(p: Planilhas, quem: Autorizador, catalogo: CatalogoOrcamento) {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const nomeArea = new Map(d.areas.ativos().map((a) => [a.codigo, a.nome]));
  return {
    tipos: d.tipos
      .ativos()
      .map((t) => ({ id: t.id, nome: t.nome, formulario: t.formulario, descricao: t.descricao }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    areas: d.areas.ativos().map((a) => ({ codigo: a.codigo, nome: a.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    servicos: d.servicos
      .ativos()
      .map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area, areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
      .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
    grupos: (await catalogo.gruposDeGasto()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

/** Confere a ficha e devolve o que gravar (sem gravar). */
async function conferirFicha(d: Dados, catalogo: CatalogoOrcamento, requisitante: string, dados: DadosRequisicao) {
  const erros: string[] = [];
  const tipo = d.tipos.ativos().find((t) => t.id === dados.tipoId);
  if (!tipo) erros.push('Escolha o tipo de requisição.');
  if (!d.areas.ativos().some((a) => a.codigo === dados.area)) erros.push('Escolha a área.');
  const grupo = (await catalogo.gruposDeGasto()).find((g) => g.id === dados.grupoId);
  if (!grupo) erros.push('Escolha o grupo de despesa do orçamento.');
  erros.push(...conferirCentros(dados.centros));
  if (dados.centros.some((c) => c.servico && !d.servicos.ativos().some((s) => s.codigo === c.servico))) erros.push('Há centro de custo que não existe mais.');
  let detalhes: unknown = null;
  if (tipo?.formulario === 'materiais') {
    erros.push(...conferirItens(dados.itens));
    const r = esquemaDetalhesMateriais.safeParse(dados.detalhes ?? {});
    if (!r.success) erros.push(...r.error.issues.map((i) => i.message));
    else detalhes = r.data;
  }
  if (erros.length) throw new ErroRequisicao([...new Set(erros)].join(' '));
  const rota = rotaDeAprovacao(
    requisitante,
    dados.centros.map((c) => d.coordenacao(c.servico)),
  );
  return { tipo: tipo!, grupo: grupo!, detalhes, rota };
}

async function gravarHistorico(p: Planilhas, requisicaoId: string, quem: string, acao: Acao, de: Situacao | null, para: Situacao, agora: Date, comentario?: string | null) {
  await inserir(p, RequisicaoHistorico, { requisicao_id: requisicaoId, em: agora.toISOString(), usuario: quem, acao, de, para, comentario: comentario?.trim() || null }, { email: quem, agora: () => agora });
}

const textoRota = (rota: RotaAprovacao) =>
  rota.tipo === 'coordenacao'
    ? null
    : rota.motivo === 'propria_coordenacao'
      ? 'Pedido da própria coordenação: aprovação da Diretoria.'
      : 'Serviço sem coordenação cadastrada: aprovação da Diretoria.';

export async function enviarRequisicao(
  p: Planilhas,
  quem: Autorizador,
  catalogo: CatalogoOrcamento,
  dados: DadosRequisicao & { nomeRequisitante: string },
  opcoes: { agora?: Date } = {},
): Promise<{ id: string; numero: string; rota: RotaAprovacao }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  conferirTransicao('enviar', null);
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const { grupo, detalhes, rota } = await conferirFicha(d, catalogo, quem.email, dados);
  const numero = proximoNumero(agora.getUTCFullYear(), d.requisicoes.todos().map((r) => r.numero));
  const autoria = { email: quem.email, agora: () => agora };
  const r = await inserir(
    p,
    Requisicoes,
    {
      numero,
      tipo_id: dados.tipoId,
      requisitante: quem.email,
      requisitante_nome: dados.nomeRequisitante.trim() || quem.email,
      area: dados.area,
      grupo_id: grupo.id,
      grupo_nome: grupo.nome,
      situacao: 'enviada',
      aprovacao: rota.tipo,
      detalhes: detalhes ? JSON.stringify(detalhes) : null,
      observacao: dados.observacao?.trim() || null,
      enviada_em: agora.toISOString(),
    },
    autoria,
  );
  await gravarFilhos(p, d, r.id, dados, autoria);
  await gravarHistorico(p, r.id, quem.email, 'enviar', null, 'enviada', agora, textoRota(rota));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Requisicoes', registroId: r.id });
  return { id: r.id, numero, rota };
}

async function gravarFilhos(p: Planilhas, d: Dados, id: string, dados: DadosRequisicao, autoria: { email: string; agora: () => Date }) {
  await inserirRegistros(p, d.centros, dados.centros.map((c) => ({ requisicao_id: id, servico: c.servico, percentual: c.percentual })), autoria);
  const tipo = d.tipoPorId.get(dados.tipoId);
  if (tipo?.formulario === 'materiais') {
    await inserirRegistros(
      p,
      d.itens,
      dados.itens.map((x, i) => ({ requisicao_id: id, ordem: i + 1, quantidade: x.quantidade, unidade: x.unidade.trim(), descricao: x.descricao.trim(), atendido: null })),
      autoria,
    );
  }
}

function acharComVersao(d: Dados, id: string, versao: number) {
  const r = d.requisicoes.porId(id);
  if (!r || !r.ativo) throw new ErroRequisicao('Requisição não encontrada.');
  if (r.versao !== versao) throw new ErroRequisicao('Esta requisição mudou enquanto você olhava. Recarregue a página e confira.');
  return r;
}

/** Ajustar e reenviar uma requisição devolvida (só quem pediu). */
export async function reenviarRequisicao(
  p: Planilhas,
  quem: Autorizador,
  catalogo: CatalogoOrcamento,
  id: string,
  versao: number,
  dados: DadosRequisicao,
  opcoes: { agora?: Date; comentario?: string } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  if (r.requisitante !== quem.email) throw new ErroPermissao('Só quem fez a requisição pode ajustá-la.');
  conferirTransicao('reenviar', r.situacao);
  if (dados.tipoId !== r.tipo_id) throw new ErroRequisicao('O tipo da requisição não pode mudar. Cancele e abra outra.');
  const { grupo, detalhes, rota } = await conferirFicha(d, catalogo, quem.email, dados);
  const autoria = { email: quem.email, agora: () => agora };
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    id,
    versao,
    {
      area: dados.area,
      grupo_id: grupo.id,
      grupo_nome: grupo.nome,
      situacao: 'enviada',
      aprovacao: rota.tipo,
      detalhes: detalhes ? JSON.stringify(detalhes) : null,
      observacao: dados.observacao?.trim() || null,
      enviada_em: agora.toISOString(),
      decidida_em: null,
      decidida_por: null,
    },
    autoria,
  );
  // Centros e itens antigos ficam no histórico (ativo = FALSE); os novos entram.
  const encerrar = <T extends { id: string; versao: number }>(l: T[]) => l.map((x) => ({ id: x.id, versao: x.versao, mudancas: { ativo: false } }));
  await atualizarVarios(p, RequisicaoCentros, encerrar(d.centrosPor.get(id) ?? []), autoria);
  await atualizarVarios(p, RequisicaoItens, encerrar(d.itensPor.get(id) ?? []), autoria);
  await gravarFilhos(p, d, id, dados, autoria);
  await gravarHistorico(p, id, quem.email, 'reenviar', 'devolvida', 'enviada', agora, [opcoes.comentario, textoRota(rota)].filter(Boolean).join(' ') || null);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: [...colunasAlteradas, 'centros', 'itens'] } });
}

/** Aprovar, devolver para ajuste ou recusar (coordenação ou Diretoria). */
export async function decidirRequisicao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  acao: 'aprovar' | 'devolver' | 'recusar',
  comentario: string | null,
  opcoes: { agora?: Date } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  conferirTransicao(acao, r.situacao);
  if (!podeAprovar(quem, d, r)) {
    throw new ErroPermissao(
      r.requisitante === quem.email ? 'Você não pode aprovar a própria requisição.' : r.aprovacao === 'diretoria' ? 'Esta requisição é aprovada pela Diretoria.' : 'Só a coordenação destes centros de custo pode decidir.',
    );
  }
  if (acao !== 'aprovar' && !comentario?.trim()) throw new ErroRequisicao(acao === 'devolver' ? 'Escreva o que precisa ser ajustado.' : 'Escreva o motivo da recusa.');
  const para: Situacao = acao === 'aprovar' ? 'aprovada' : acao === 'devolver' ? 'devolvida' : 'recusada';
  const autoria = { email: quem.email, agora: () => agora };
  const { colunasAlteradas } = await atualizar(p, Requisicoes, id, versao, { situacao: para, decidida_em: agora.toISOString(), decidida_por: quem.email }, autoria);
  await gravarHistorico(p, id, quem.email, acao, r.situacao, para, agora, comentario);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

export async function cancelarRequisicao(p: Planilhas, quem: Autorizador, id: string, versao: number, comentario: string | null, opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  if (r.requisitante !== quem.email) throw new ErroPermissao('Só quem fez a requisição pode cancelá-la.');
  conferirTransicao('cancelar', r.situacao);
  const { colunasAlteradas } = await atualizar(p, Requisicoes, id, versao, { situacao: 'cancelada' }, { email: quem.email, agora: () => agora });
  await gravarHistorico(p, id, quem.email, 'cancelar', r.situacao, 'cancelada', agora, comentario);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/** O setor recebe a requisição aprovada e passa a atendê-la. */
export async function receberRequisicao(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  conferirTransicao('receber', r.situacao);
  if (!podeAtender(quem, d, r)) throw new ErroPermissao('Só o setor responsável por este tipo de requisição pode atendê-la.');
  const { colunasAlteradas } = await atualizar(p, Requisicoes, id, versao, { situacao: 'em_atendimento', recebida_em: agora.toISOString(), recebida_por: quem.email }, { email: quem.email, agora: () => agora });
  await gravarHistorico(p, id, quem.email, 'receber', 'aprovada', 'em_atendimento', agora, null);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/** Conclui o atendimento, com a quantidade entregue de cada item (materiais). */
export async function concluirRequisicao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  atendidos: Record<string, number>,
  comentario: string | null,
  opcoes: { agora?: Date } = {},
): Promise<Situacao> {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  conferirTransicao('concluir', r.situacao);
  if (!podeAtender(quem, d, r)) throw new ErroPermissao('Só o setor responsável por este tipo de requisição pode atendê-la.');
  const itens = (d.itensPor.get(id) ?? []).sort((a, b) => a.ordem - b.ordem);
  for (const i of itens) {
    const v = atendidos[i.id];
    if (!Number.isFinite(v) || v < 0 || v > i.quantidade) throw new ErroRequisicao(`Informe quanto foi entregue de "${i.descricao}" (de 0 a ${i.quantidade.toLocaleString('pt-BR')}).`);
  }
  const completa = itens.every((i) => atendidos[i.id] === i.quantidade);
  if (!completa && !comentario?.trim()) throw new ErroRequisicao('Explique por que a requisição foi atendida só em parte.');
  const para: Situacao = completa ? 'atendida' : 'atendida_parcial';
  const autoria = { email: quem.email, agora: () => agora };
  await atualizarVarios(p, RequisicaoItens, itens.map((i) => ({ id: i.id, versao: i.versao, mudancas: { atendido: atendidos[i.id] } })), autoria);
  const { colunasAlteradas } = await atualizar(p, Requisicoes, id, versao, { situacao: para, concluida_em: agora.toISOString(), executada_por: quem.email }, autoria);
  await gravarHistorico(p, id, quem.email, 'concluir', 'em_atendimento', para, agora, comentario);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: [...colunasAlteradas, 'itens.atendido'] } });
  return para;
}

// ---------------------------------------------------------------------------
// Listas, detalhe e contadores
// ---------------------------------------------------------------------------

export type Visao = 'minhas' | 'aprovar' | 'atender' | 'todas';

export interface LinhaRequisicao {
  id: string;
  versao: number;
  numero: string;
  tipo: string;
  situacao: Situacao;
  situacaoNome: string;
  requisitante: string;
  enviadaEm: string;
  centros: string;
  aprovacao: 'coordenacao' | 'diretoria';
  prazo: { etapa: 'aprovação' | 'atendimento'; situacao: SituacaoPrazo; horas: number; limite: number } | null;
}

export async function listarRequisicoes(p: Planilhas, quem: Autorizador, visao: Visao, opcoes: { agora?: Date } = {}): Promise<LinhaRequisicao[]> {
  const agora = opcoes.agora ?? new Date();
  const exigido = { minhas: PERM.solicitar, aprovar: PERM.aprovar, atender: PERM.atender, todas: PERM.verTodas }[visao];
  if (visao === 'todas' ? !quem.temPermissao(exigido) : !quem.temPermissaoAlgumEscopo(exigido)) throw new ErroPermissao();
  const d = await ler(p, agora);
  const filtro: Record<Visao, (r: RegRequisicao) => boolean> = {
    minhas: (r) => r.requisitante === quem.email,
    aprovar: (r) => podeVer(quem, d, r) && (podeAprovar(quem, d, r) || r.decidida_por === quem.email) && r.requisitante !== quem.email,
    atender: (r) => podeAtender(quem, d, r) && !['enviada', 'devolvida', 'recusada', 'cancelada'].includes(r.situacao),
    todas: () => true,
  };
  return d.requisicoes
    .ativos()
    .filter(filtro[visao])
    .sort((a, b) => b.enviada_em.localeCompare(a.enviada_em))
    .map((r) => linha(d, r, agora));
}

function linha(d: Dados, r: RegRequisicao, agora: Date): LinhaRequisicao {
  const s = sla(d, r, agora);
  const emAprovacao = r.situacao === 'enviada';
  const emAtendimento = r.situacao === 'aprovada' || r.situacao === 'em_atendimento';
  const etapa = emAprovacao && s ? { etapa: 'aprovação' as const, ...s.aprovacao } : emAtendimento && s?.atendimento ? { etapa: 'atendimento' as const, ...s.atendimento } : null;
  return {
    id: r.id,
    versao: r.versao,
    numero: r.numero,
    tipo: d.tipoPorId.get(r.tipo_id)?.nome ?? '—',
    situacao: r.situacao,
    situacaoNome: NOME_SITUACAO[r.situacao],
    requisitante: r.requisitante_nome,
    enviadaEm: r.enviada_em,
    centros: (d.centrosPor.get(r.id) ?? []).map((c) => d.servicoPorCodigo.get(c.servico)?.nome ?? c.servico).join(', '),
    aprovacao: r.aprovacao,
    prazo: etapa ? { etapa: etapa.etapa, situacao: etapa.situacao, horas: etapa.horas, limite: etapa.prazo } : null,
  };
}

export async function detalharRequisicao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = d.requisicoes.porId(id);
  if (!r || !r.ativo) throw new ErroRequisicao('Requisição não encontrada.');
  if (!podeVer(quem, d, r)) throw new ErroPermissao('Você não tem acesso a esta requisição.');
  const [historico] = await lerTabelas(p, [RequisicaoHistorico] as const);
  const tipo = d.tipoPorId.get(r.tipo_id);
  return {
    requisicao: r,
    tipo: tipo ? { id: tipo.id, nome: tipo.nome, formulario: tipo.formulario, perfil: d.perfis.ativos().find((x) => x.codigo === tipo.perfil_responsavel)?.nome ?? tipo.perfil_responsavel } : null,
    area: d.areas.todos().find((a) => a.codigo === r.area)?.nome ?? r.area,
    centros: (d.centrosPor.get(id) ?? []).map((c: RegCentro) => ({ servico: c.servico, nome: d.servicoPorCodigo.get(c.servico)?.nome ?? c.servico, percentual: c.percentual })),
    itens: (d.itensPor.get(id) ?? []).sort((a: RegItem, b: RegItem) => a.ordem - b.ordem),
    detalhes: r.detalhes ? (JSON.parse(r.detalhes) as unknown) : null,
    historico: historico.todos().filter((h) => h.requisicao_id === id).sort((a, b) => a.em.localeCompare(b.em)),
    acoes: acoesPossiveis(quem, d, r),
    sla: sla(d, r, agora),
    expediente: d.expediente,
    encerrada: SITUACOES_ENCERRADAS.includes(r.situacao),
  };
}

/** Quantas esperam por esta pessoa (para a tela inicial e o menu). */
export async function contadoresRequisicoes(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const ativas = d.requisicoes.ativos();
  return {
    aprovar: quem.temPermissaoAlgumEscopo(PERM.aprovar) ? ativas.filter((r) => r.situacao === 'enviada' && podeAprovar(quem, d, r)).length : 0,
    atender: quem.temPermissaoAlgumEscopo(PERM.atender) ? ativas.filter((r) => (r.situacao === 'aprovada' || r.situacao === 'em_atendimento') && podeAtender(quem, d, r)).length : 0,
    devolvidas: ativas.filter((r) => r.requisitante === quem.email && r.situacao === 'devolvida').length,
  };
}

// ---------------------------------------------------------------------------
// Tipos de requisição e expediente
// ---------------------------------------------------------------------------

export interface DadosTipo {
  nome: string;
  categoria: 'material' | 'servico';
  formulario: 'materiais';
  perfilResponsavel: string;
  prazoAprovacao: number;
  prazoAtendimento: number;
  descricao?: string | null;
}

export async function listarTipos(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const elegiveis = d.perfisCom(PERM.atender);
  const nomePerfil = new Map(d.perfis.todos().map((x) => [x.codigo, x.nome]));
  const uso = agrupar(d.requisicoes.ativos(), (r) => r.tipo_id);
  const ordem = (l: RegTipo[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    ativos: ordem(d.tipos.ativos()).map((t) => ({ ...t, perfilNome: nomePerfil.get(t.perfil_responsavel) ?? t.perfil_responsavel, requisicoes: uso.get(t.id)?.length ?? 0 })),
    excluidos: ordem(d.tipos.todos().filter((t) => !t.ativo)),
    perfis: d.perfis
      .ativos()
      .filter((x) => elegiveis.has(x.codigo))
      .map((x) => ({ codigo: x.codigo, nome: x.nome })),
    expediente: d.expediente,
  };
}

export async function salvarTipo(p: Planilhas, quem: Autorizador, dados: DadosTipo, existente?: { id: string; versao: number }) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const erros: string[] = [];
  if (!nome) erros.push('Informe o nome do tipo.');
  const igual = d.tipos.todos().find((t) => t.id !== existente?.id && t.nome.toLowerCase() === nome.toLowerCase());
  if (igual) erros.push(igual.ativo ? `Já existe o tipo "${igual.nome}".` : `"${igual.nome}" está entre os excluídos: reative em vez de cadastrar de novo.`);
  if (!['material', 'servico'].includes(dados.categoria)) erros.push('Escolha se é material ou serviço.');
  if (dados.formulario !== 'materiais') erros.push('Escolha a ficha.');
  if (!d.perfisCom(PERM.atender).has(dados.perfilResponsavel)) erros.push('Escolha o setor (perfil) que atende.');
  for (const [v, rotulo] of [[dados.prazoAprovacao, 'aprovação'], [dados.prazoAtendimento, 'atendimento']] as const) {
    if (!Number.isFinite(v) || v <= 0) erros.push(`O prazo de ${rotulo} precisa ser maior que zero (em horas úteis).`);
  }
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  const campos = {
    nome,
    categoria: dados.categoria,
    formulario: dados.formulario,
    perfil_responsavel: dados.perfilResponsavel,
    prazo_aprovacao: dados.prazoAprovacao,
    prazo_atendimento: dados.prazoAtendimento,
    descricao: dados.descricao?.trim() || null,
  };
  if (!existente) {
    const t = await inserir(p, TiposRequisicao, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'TiposRequisicao', registroId: t.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, TiposRequisicao, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'TiposRequisicao', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
}

export async function mudarSituacaoTipo(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  const t = tipos.porId(id);
  if (!t || t.ativo === ativo) throw new ErroRequisicao('Tipo não encontrado.');
  await atualizar(p, TiposRequisicao, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'TiposRequisicao', registroId: id, detalhes: { colunas: ['ativo'] } });
}

export async function salvarExpediente(p: Planilhas, quem: Autorizador, e: Expediente) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const { conferirExpediente } = await import('../dominio/sla');
  const erros = conferirExpediente(e);
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  const [parametros] = await lerTabelas(p, [ParametrosRequisicoes] as const);
  for (const [chave, valor] of [['expediente_inicio', e.inicio], ['expediente_fim', e.fim]] as const) {
    const atual = parametros.ativos().find((x) => x.chave === chave);
    if (!atual) await inserir(p, ParametrosRequisicoes, { chave, valor }, { email: quem.email });
    else if (atual.valor !== valor) await atualizar(p, ParametrosRequisicoes, atual.id, atual.versao, { valor }, { email: quem.email });
  }
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ParametrosRequisicoes', detalhes: { colunas: ['expediente'] } });
}
