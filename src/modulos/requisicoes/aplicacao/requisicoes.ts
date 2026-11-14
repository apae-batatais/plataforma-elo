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
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { atualizar, atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Areas, Atribuicoes, PerfilPermissoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  CatalogoItens,
  FeriadosRequisicoes,
  ParametrosRequisicoes,
  RequisicaoAnexos,
  RequisicaoCentros,
  RequisicaoHistorico,
  RequisicaoItens,
  Requisicoes,
  TiposRequisicao,
  type RegCentro,
  type RegItem,
  type RegRequisicao,
  type RegTipo,
} from '../dados/tabelas';
import {
  conferirCentros,
  conferirItens,
  conferirTransicao,
  coordenadoresDoServico,
  ErroRequisicao,
  ESQUEMA_DETALHES,
  FICHA_DE_SERVICO,
  FORMULARIOS,
  type Formulario,
  urgenciaDe,
  type Urgencia,
  itensDaLista,
  juntarLista,
  lerLista,
  nomeComparavel,
  NOME_SITUACAO,
  permitido,
  proximoNumero,
  rotaDeAprovacao,
  SITUACOES_ENCERRADAS,
  type Acao,
  type AtribuicaoAprovacao,
  type Centro,
  type ItemPedido,
  type RotaAprovacao,
  type Situacao,
} from '../dominio/requisicao';
import { aceitaAnexos, conferirArquivo, conferirQuantidade, type TipoAnexo } from '../dominio/anexos';
import { conferirFeriado, feriadosNacionais } from '../dominio/feriados';
import { mesDe, montarPainel } from '../dominio/painel';
import { EXPEDIENTE_PADRAO, prazoDaEtapa, type Expediente, type SituacaoPrazo } from '../dominio/sla';

export { ErroRequisicao };

const PERM = {
  solicitar: 'requisicoes.solicitar',
  aprovar: 'requisicoes.aprovar',
  atender: 'requisicoes.atender',
  verTodas: 'requisicoes.ver_todas',
  tipos: 'requisicoes.tipos.gerenciar',
  painel: 'requisicoes.painel',
} as const;

const hoje = (agora: Date) => agora.toISOString().slice(0, 10);
const vigente = (r: { ativo: boolean; inicio: string | null; fim: string | null }, dia: string) =>
  r.ativo && (!r.inicio || r.inicio <= dia) && (!r.fim || r.fim >= dia);

// ---------------------------------------------------------------------------
// Leitura de tudo o que as regras precisam (uma ida a cada planilha)
// ---------------------------------------------------------------------------

async function ler(p: Planilhas, agora: Date) {
  const [tipos, catalogoItens, requisicoes, centros, itens, parametros, feriados, usuarios, atribuicoes, perfilPermissoes, servicos, areas, perfis] =
    await lerTabelas(p, [
      TiposRequisicao,
      CatalogoItens,
      Requisicoes,
      RequisicaoCentros,
      RequisicaoItens,
      ParametrosRequisicoes,
      FeriadosRequisicoes,
      Usuarios,
      Atribuicoes,
      PerfilPermissoes,
      Servicos,
      Areas,
      Perfis,
    ] as const);
  const dia = hoje(agora);
  const ativos = new Set(usuarios.ativos().map((u) => u.email));
  const atribs: AtribuicaoAprovacao[] = atribuicoes
    .ativos()
    .filter((a) => ativos.has(a.usuario_email) && vigente(a, dia))
    .map((a) => ({ email: a.usuario_email, perfil: a.perfil, escopoTipo: a.escopo_tipo, escopo: a.escopo }));
  const perfisCom = (permissao: string) =>
    new Set(
      perfilPermissoes
        .ativos()
        .filter((x) => x.permissao === permissao)
        .map((x) => x.perfil),
    );
  const aprovam = perfisCom(PERM.aprovar);
  const servicoPorCodigo = new Map(servicos.todos().map((s) => [s.codigo, s]));
  const centrosPor = agrupar(centros.ativos(), (c) => c.requisicao_id);
  const itensPor = agrupar(itens.ativos(), (i) => i.requisicao_id);
  const valor = (chave: string, padrao: number) => parametros.ativos().find((x) => x.chave === chave)?.valor ?? padrao;
  const expediente: Expediente = {
    inicio: valor('expediente_inicio', EXPEDIENTE_PADRAO.inicio),
    fim: valor('expediente_fim', EXPEDIENTE_PADRAO.fim),
    feriados: new Set(feriados.ativos().map((f) => f.data)),
  };

  const coordenacao = (codigo: string) => {
    const s = servicoPorCodigo.get(codigo);
    return s ? coordenadoresDoServico({ codigo: s.codigo, area: s.area, unidade: s.unidade }, atribs, aprovam) : new Set<string>();
  };
  const perfisDe = (email: string) => new Set(atribs.filter((a) => a.email === email).map((a) => a.perfil));
  const catalogoPor = agrupar(catalogoItens.ativos(), (c) => c.tipo_id);
  return {
    tipos,
    catalogoItens,
    catalogoPor,
    requisicoes,
    centros,
    itens,
    parametros,
    feriados,
    servicos,
    areas,
    perfis,
    perfilPermissoes,
    tipoPorId: new Map(tipos.todos().map((t) => [t.id, t])),
    servicoPorCodigo,
    centrosPor,
    itensPor,
    expediente,
    coordenacao,
    perfisDe,
    perfisCom,
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
  if (quem.temPermissaoAlgumEscopo(PERM.aprovar) && (r.aprovacao === 'coordenacao' ? coordenacaoAtual(d, r).has(quem.email) : quem.temPermissao(PERM.aprovar)))
    return true;
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
  centros: Centro[];
  itens: ItemPedido[];
  /** Campos próprios da ficha (entrega, evento, utensílios). */
  detalhes: unknown;
  observacao?: string | null;
  /** Fotos e vídeo já enviados à pasta de anexos (ADR-014). */
  anexos?: AnexoPedido[];
}

export interface AnexoPedido {
  arquivoId: string;
  tipo: TipoAnexo;
  nome: string;
  duracao?: number | null;
}

export async function opcoesDoFormulario(p: Planilhas, quem: Autorizador, opcoes: { anexosAtivos?: boolean } = {}) {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const nomeArea = new Map(d.areas.ativos().map((a) => [a.codigo, a.nome]));
  return {
    tipos: d.tipos
      .ativos()
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        formulario: t.formulario,
        descricao: t.descricao,
        areas: lerLista(t.areas),
        anexos: aceitaAnexos(t),
        itens: (d.catalogoPor.get(t.id) ?? [])
          .map((c) => ({ id: c.id, descricao: c.descricao, unidade: c.unidade }))
          .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    areas: d.areas
      .ativos()
      .map((a) => ({ codigo: a.codigo, nome: a.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    servicos: d.servicos
      .ativos()
      .map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area, areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
      .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
    anexosAtivos: Boolean(opcoes.anexosAtivos),
  };
}

/** Confere a ficha e devolve o que gravar (sem gravar). */
function conferirFicha(d: Dados, requisitante: string, dados: DadosRequisicao) {
  const erros: string[] = [];
  const tipo = d.tipos.ativos().find((t) => t.id === dados.tipoId);
  if (!tipo) erros.push('Escolha o tipo de requisição.');
  const area = d.areas.ativos().find((a) => a.codigo === dados.area);
  if (!area) erros.push('Escolha a área.');
  else if (tipo && !permitido(lerLista(tipo.areas), area.codigo)) erros.push(`O tipo "${tipo.nome}" não pode ser usado pela área ${area.nome}.`);
  erros.push(...conferirCentros(dados.centros));
  if (dados.centros.some((c) => c.servico && !d.servicos.ativos().some((s) => s.codigo === c.servico))) erros.push('Há centro de custo que não existe mais.');
  let detalhes: unknown = null;
  let itens: (ItemPedido & { catalogoId: string | null })[] = [];
  if (tipo?.formulario === 'materiais') {
    const lista = itensDaLista(dados.itens, d.catalogoPor.get(tipo.id) ?? []);
    itens = lista.itens;
    erros.push(...conferirItens(itens), ...lista.erros);
  }
  if (tipo) {
    const r = ESQUEMA_DETALHES[tipo.formulario].safeParse(dados.detalhes ?? {});
    if (!r.success) erros.push(...r.error.issues.map((i) => i.message));
    else detalhes = r.data;
  }
  if (erros.length) throw new ErroRequisicao([...new Set(erros)].join(' '));
  const rota = rotaDeAprovacao(
    requisitante,
    dados.centros.map((c) => d.coordenacao(c.servico)),
  );
  return { tipo: tipo!, detalhes, rota, itens };
}

async function gravarHistorico(
  p: Planilhas,
  requisicaoId: string,
  quem: string,
  acao: Acao,
  de: Situacao | null,
  para: Situacao,
  agora: Date,
  comentario?: string | null,
) {
  await inserir(
    p,
    RequisicaoHistorico,
    { requisicao_id: requisicaoId, em: agora.toISOString(), usuario: quem, acao, de, para, comentario: comentario?.trim() || null },
    { email: quem, agora: () => agora },
  );
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
  dados: DadosRequisicao & { nomeRequisitante: string },
  opcoes: { agora?: Date; arquivos?: ArmazenamentoArquivos | null } = {},
): Promise<{ id: string; numero: string; rota: RotaAprovacao }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  conferirTransicao('enviar', null);
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const { tipo, detalhes, rota, itens } = conferirFicha(d, quem.email, dados);
  const anexos = await conferirAnexosDaFicha(p, opcoes.arquivos ?? null, tipo, dados.anexos ?? [], null);
  const numero = proximoNumero(
    agora.getUTCFullYear(),
    d.requisicoes.todos().map((r) => r.numero),
  );
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
      // Grupo de despesa saiu da ficha (04/11/2026); as colunas ficam para os pedidos antigos.
      grupo_id: null,
      grupo_nome: null,
      situacao: 'enviada',
      aprovacao: rota.tipo,
      detalhes: detalhes ? JSON.stringify(detalhes) : null,
      observacao: dados.observacao?.trim() || null,
      enviada_em: agora.toISOString(),
    },
    autoria,
  );
  await gravarFilhos(p, d, r.id, { ...dados, itens }, autoria);
  if (anexos.linhas.length && anexos.tabela)
    await inserirRegistros(
      p,
      anexos.tabela,
      anexos.linhas.map((l) => ({ ...l, requisicao_id: r.id })),
      autoria,
    );
  await gravarHistorico(p, r.id, quem.email, 'enviar', null, 'enviada', agora, textoRota(rota));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Requisicoes', registroId: r.id });
  return { id: r.id, numero, rota };
}

async function gravarFilhos(p: Planilhas, d: Dados, id: string, dados: DadosRequisicao, autoria: { email: string; agora: () => Date }) {
  await inserirRegistros(
    p,
    d.centros,
    dados.centros.map((c) => ({ requisicao_id: id, servico: c.servico, percentual: c.percentual })),
    autoria,
  );
  const tipo = d.tipoPorId.get(dados.tipoId);
  if (tipo?.formulario === 'materiais') {
    await inserirRegistros(
      p,
      d.itens,
      dados.itens.map((x, i) => ({
        requisicao_id: id,
        ordem: i + 1,
        quantidade: x.quantidade,
        unidade: x.unidade.trim(),
        descricao: x.descricao.trim(),
        catalogo_id: x.catalogoId ?? null,
        atendido: null,
      })),
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
  id: string,
  versao: number,
  dados: DadosRequisicao,
  opcoes: { agora?: Date; comentario?: string; arquivos?: ArmazenamentoArquivos | null } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  if (r.requisitante !== quem.email) throw new ErroPermissao('Só quem fez a requisição pode ajustá-la.');
  conferirTransicao('reenviar', r.situacao);
  if (dados.tipoId !== r.tipo_id) throw new ErroRequisicao('O tipo da requisição não pode mudar. Cancele e abra outra.');
  const { tipo, detalhes, rota, itens } = conferirFicha(d, quem.email, dados);
  // Anexos: os que continuam ficam; os tirados são encerrados; os novos entram.
  const anexos = dados.anexos ? await conferirAnexosDaFicha(p, opcoes.arquivos ?? null, tipo, dados.anexos, id) : null;
  const autoria = { email: quem.email, agora: () => agora };
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    id,
    versao,
    {
      area: dados.area,
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
  await gravarFilhos(p, d, id, { ...dados, itens }, autoria);
  if (anexos?.tabela) {
    const atuais = anexos.tabela.ativos().filter((a) => a.requisicao_id === id);
    const ficam = new Set(anexos.linhas.map((l) => l.arquivo_id));
    await atualizarVarios(p, RequisicaoAnexos, encerrar(atuais.filter((a) => !ficam.has(a.arquivo_id))), autoria);
    const ja = new Set(atuais.map((a) => a.arquivo_id));
    const novos = anexos.linhas.filter((l) => !ja.has(l.arquivo_id));
    if (novos.length)
      await inserirRegistros(
        p,
        anexos.tabela,
        novos.map((l) => ({ ...l, requisicao_id: id })),
        autoria,
      );
  }
  await gravarHistorico(p, id, quem.email, 'reenviar', 'devolvida', 'enviada', agora, [opcoes.comentario, textoRota(rota)].filter(Boolean).join(' ') || null);
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'alteracao',
    entidade: 'Requisicoes',
    registroId: id,
    detalhes: { colunas: [...colunasAlteradas, 'centros', 'itens'] },
  });
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
      r.requisitante === quem.email
        ? 'Você não pode aprovar a própria requisição.'
        : r.aprovacao === 'diretoria'
          ? 'Esta requisição é aprovada pela Diretoria.'
          : 'Só a coordenação destes centros de custo pode decidir.',
    );
  }
  if (acao !== 'aprovar' && !comentario?.trim())
    throw new ErroRequisicao(acao === 'devolver' ? 'Escreva o que precisa ser ajustado.' : 'Escreva o motivo da recusa.');
  const para: Situacao = acao === 'aprovar' ? 'aprovada' : acao === 'devolver' ? 'devolvida' : 'recusada';
  const autoria = { email: quem.email, agora: () => agora };
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    id,
    versao,
    { situacao: para, decidida_em: agora.toISOString(), decidida_por: quem.email },
    autoria,
  );
  await gravarHistorico(p, id, quem.email, acao, r.situacao, para, agora, comentario);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

export async function cancelarRequisicao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  comentario: string | null,
  opcoes: { agora?: Date } = {},
) {
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
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    id,
    versao,
    { situacao: 'em_atendimento', recebida_em: agora.toISOString(), recebida_por: quem.email },
    { email: quem.email, agora: () => agora },
  );
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
  opcoes: { agora?: Date; resultado?: 'resolvido' | 'parcial' } = {},
): Promise<Situacao> {
  const agora = opcoes.agora ?? new Date();
  const d = await ler(p, agora);
  const r = acharComVersao(d, id, versao);
  conferirTransicao('concluir', r.situacao);
  if (!podeAtender(quem, d, r)) throw new ErroPermissao('Só o setor responsável por este tipo de requisição pode atendê-la.');
  const tipo = d.tipoPorId.get(r.tipo_id);
  if (tipo && FICHA_DE_SERVICO[tipo.formulario]) return concluirServico(p, quem, r, comentario, opcoes.resultado, agora);
  const itens = (d.itensPor.get(id) ?? []).sort((a, b) => a.ordem - b.ordem);
  for (const i of itens) {
    const v = atendidos[i.id];
    if (!Number.isFinite(v) || v < 0 || v > i.quantidade)
      throw new ErroRequisicao(`Informe quanto foi entregue de "${i.descricao}" (de 0 a ${i.quantidade.toLocaleString('pt-BR')}).`);
  }
  const completa = itens.every((i) => atendidos[i.id] === i.quantidade);
  if (!completa && !comentario?.trim()) throw new ErroRequisicao('Explique por que a requisição foi atendida só em parte.');
  const para: Situacao = completa ? 'atendida' : 'atendida_parcial';
  const autoria = { email: quem.email, agora: () => agora };
  await atualizarVarios(
    p,
    RequisicaoItens,
    itens.map((i) => ({ id: i.id, versao: i.versao, mudancas: { atendido: atendidos[i.id] } })),
    autoria,
  );
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    id,
    versao,
    { situacao: para, concluida_em: agora.toISOString(), executada_por: quem.email },
    autoria,
  );
  await gravarHistorico(p, id, quem.email, 'concluir', 'em_atendimento', para, agora, comentario);
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'alteracao',
    entidade: 'Requisicoes',
    registroId: id,
    detalhes: { colunas: [...colunasAlteradas, 'itens.atendido'] },
  });
  return para;
}

/** Chamado (TI, manutenção…): concluído com o que foi feito e se resolveu tudo. */
async function concluirServico(
  p: Planilhas,
  quem: Autorizador,
  r: RegRequisicao,
  comentario: string | null,
  resultado: 'resolvido' | 'parcial' | undefined,
  agora: Date,
): Promise<Situacao> {
  if (resultado !== 'resolvido' && resultado !== 'parcial') throw new ErroRequisicao('Diga se o problema foi resolvido.');
  if (!comentario?.trim())
    throw new ErroRequisicao(resultado === 'resolvido' ? 'Descreva o que foi feito.' : 'Explique o que foi feito e o que ficou pendente.');
  const para: Situacao = resultado === 'resolvido' ? 'atendida' : 'atendida_parcial';
  const { colunasAlteradas } = await atualizar(
    p,
    Requisicoes,
    r.id,
    r.versao,
    { situacao: para, concluida_em: agora.toISOString(), executada_por: quem.email },
    { email: quem.email, agora: () => agora },
  );
  await gravarHistorico(p, r.id, quem.email, 'concluir', 'em_atendimento', para, agora, comentario);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Requisicoes', registroId: r.id, detalhes: { colunas: colunasAlteradas } });
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
  /** Chamados com urgência (TI): para ordenar a fila. */
  urgencia: Urgencia | null;
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
  const etapa =
    emAprovacao && s
      ? { etapa: 'aprovação' as const, ...s.aprovacao }
      : emAtendimento && s?.atendimento
        ? { etapa: 'atendimento' as const, ...s.atendimento }
        : null;
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
    urgencia: urgenciaDe(r.detalhes),
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
    tipo: tipo
      ? {
          id: tipo.id,
          nome: tipo.nome,
          formulario: tipo.formulario,
          perfil: d.perfis.ativos().find((x) => x.codigo === tipo.perfil_responsavel)?.nome ?? tipo.perfil_responsavel,
        }
      : null,
    area: d.areas.todos().find((a) => a.codigo === r.area)?.nome ?? r.area,
    centros: (d.centrosPor.get(id) ?? []).map((c: RegCentro) => ({
      servico: c.servico,
      nome: d.servicoPorCodigo.get(c.servico)?.nome ?? c.servico,
      percentual: c.percentual,
    })),
    itens: (d.itensPor.get(id) ?? []).sort((a: RegItem, b: RegItem) => a.ordem - b.ordem),
    detalhes: r.detalhes ? (JSON.parse(r.detalhes) as unknown) : null,
    historico: historico
      .todos()
      .filter((h) => h.requisicao_id === id)
      .sort((a, b) => a.em.localeCompare(b.em)),
    anexos: ((await lerAnexos(p))?.ativos() ?? [])
      .filter((a) => a.requisicao_id === id)
      .map((a) => ({ id: a.id, tipo: a.tipo, nome: a.nome, tamanho: a.tamanho, duracao: a.duracao, arquivoId: a.arquivo_id })),
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
    atender: quem.temPermissaoAlgumEscopo(PERM.atender)
      ? ativas.filter((r) => (r.situacao === 'aprovada' || r.situacao === 'em_atendimento') && podeAtender(quem, d, r)).length
      : 0,
    devolvidas: ativas.filter((r) => r.requisitante === quem.email && r.situacao === 'devolvida').length,
  };
}

// ---------------------------------------------------------------------------
// Tipos de requisição e expediente
// ---------------------------------------------------------------------------

export interface DadosTipo {
  nome: string;
  categoria: 'material' | 'servico';
  formulario: Formulario;
  perfilResponsavel: string;
  prazoAprovacao: number;
  prazoAtendimento: number;
  descricao?: string | null;
  /** Áreas (códigos) que podem usar o tipo. Vazio = todas. */
  areas?: string[];
  /** Aceita foto e vídeo (sem informar, mantém o que estava). */
  anexos?: boolean;
}

export async function listarTipos(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const nomeArea = new Map(d.areas.todos().map((a) => [a.codigo, a.nome]));
  const elegiveis = d.perfisCom(PERM.atender);
  const nomePerfil = new Map(d.perfis.todos().map((x) => [x.codigo, x.nome]));
  const uso = agrupar(d.requisicoes.ativos(), (r) => r.tipo_id);
  const ordem = (l: RegTipo[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    ativos: ordem(d.tipos.ativos()).map((t) => ({
      ...t,
      perfilNome: nomePerfil.get(t.perfil_responsavel) ?? t.perfil_responsavel,
      requisicoes: uso.get(t.id)?.length ?? 0,
      listaAreas: lerLista(t.areas),
      aceitaAnexos: aceitaAnexos(t),
      nomesAreas: lerLista(t.areas).map((c) => nomeArea.get(c) ?? c),
      itensAceitos: d.catalogoPor.get(t.id)?.length ?? 0,
    })),
    excluidos: ordem(d.tipos.todos().filter((t) => !t.ativo)),
    perfis: d.perfis
      .ativos()
      .filter((x) => elegiveis.has(x.codigo))
      .map((x) => ({ codigo: x.codigo, nome: x.nome })),
    areas: d.areas
      .ativos()
      .map((a) => ({ codigo: a.codigo, nome: a.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    expediente: d.expediente,
    feriados: d.feriados
      .ativos()
      .map((f) => ({ id: f.id, versao: f.versao, data: f.data, nome: f.nome }))
      .sort((a, b) => a.data.localeCompare(b.data)),
  };
}

export async function salvarTipo(p: Planilhas, quem: Autorizador, dados: DadosTipo, existente?: { id: string; versao: number }) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const d = await ler(p, new Date());
  const areasValidas = new Set(d.areas.ativos().map((a) => a.codigo));
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const erros: string[] = [];
  if (!nome) erros.push('Informe o nome do tipo.');
  const igual = d.tipos.todos().find((t) => t.id !== existente?.id && t.nome.toLowerCase() === nome.toLowerCase());
  if (igual) erros.push(igual.ativo ? `Já existe o tipo "${igual.nome}".` : `"${igual.nome}" está entre os excluídos: reative em vez de cadastrar de novo.`);
  if (!['material', 'servico'].includes(dados.categoria)) erros.push('Escolha se é material ou serviço.');
  if (!FORMULARIOS.includes(dados.formulario)) erros.push('Escolha a ficha.');
  if (!d.perfisCom(PERM.atender).has(dados.perfilResponsavel)) erros.push('Escolha o setor (perfil) que atende.');
  if ((dados.areas ?? []).some((a) => !areasValidas.has(a))) erros.push('Há área marcada que não existe mais.');
  for (const [v, rotulo] of [
    [dados.prazoAprovacao, 'aprovação'],
    [dados.prazoAtendimento, 'atendimento'],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) erros.push(`O prazo de ${rotulo} precisa ser maior que zero (em horas úteis).`);
  }
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  const campos = {
    nome,
    // Chamados (TI, manutenção…) são sempre serviço.
    categoria: FICHA_DE_SERVICO[dados.formulario] ? ('servico' as const) : dados.categoria,
    formulario: dados.formulario,
    perfil_responsavel: dados.perfilResponsavel,
    prazo_aprovacao: dados.prazoAprovacao,
    prazo_atendimento: dados.prazoAtendimento,
    descricao: dados.descricao?.trim() || null,
    areas: juntarLista(dados.areas ?? []),
    // Grupos de despesa não são mais usados nas requisições: limpa a marcação antiga.
    grupos: null,
    ...(dados.anexos === undefined ? {} : { anexos: dados.anexos ? 'sim' : 'nao' }),
  };
  if (!existente) {
    const t = await inserir(p, TiposRequisicao, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'TiposRequisicao', registroId: t.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, TiposRequisicao, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length)
    await registrarAuditoria(p, {
      usuario: quem.email,
      acao: 'alteracao',
      entidade: 'TiposRequisicao',
      registroId: existente.id,
      detalhes: { colunas: colunasAlteradas },
    });
}

export async function mudarSituacaoTipo(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  const t = tipos.porId(id);
  if (!t || t.ativo === ativo) throw new ErroRequisicao('Tipo não encontrado.');
  await atualizar(p, TiposRequisicao, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: ativo ? 'alteracao' : 'encerramento',
    entidade: 'TiposRequisicao',
    registroId: id,
    detalhes: { colunas: ['ativo'] },
  });
}

export async function salvarExpediente(p: Planilhas, quem: Autorizador, e: Expediente) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const { conferirExpediente } = await import('../dominio/sla');
  const erros = conferirExpediente(e);
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  const [parametros] = await lerTabelas(p, [ParametrosRequisicoes] as const);
  for (const [chave, valor] of [
    ['expediente_inicio', e.inicio],
    ['expediente_fim', e.fim],
  ] as const) {
    const atual = parametros.ativos().find((x) => x.chave === chave);
    if (!atual) await inserir(p, ParametrosRequisicoes, { chave, valor }, { email: quem.email });
    else if (atual.valor !== valor) await atualizar(p, ParametrosRequisicoes, atual.id, atual.versao, { valor }, { email: quem.email });
  }
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ParametrosRequisicoes', detalhes: { colunas: ['expediente'] } });
}

// ---------------------------------------------------------------------------
// Fotos e vídeo (ADR-014)
// ---------------------------------------------------------------------------

/** Maior trecho entregue de uma vez (o servidor da hospedagem limita o tamanho da resposta). */
export const TRECHO_MAXIMO = 4 * 1024 * 1024;

async function lerAnexos(p: Planilhas) {
  try {
    const [tabela] = await lerTabelas(p, [RequisicaoAnexos] as const);
    return tabela;
  } catch (erro) {
    // Antes de "Preparar estrutura" criar a aba, a requisição funciona sem anexos.
    if (erro instanceof ErroEstruturaAusente) return null;
    throw erro;
  }
}

/** Confere os arquivos que vão ficar ligados à requisição (já enviados à pasta). */
async function conferirAnexosDaFicha(p: Planilhas, arquivos: ArmazenamentoArquivos | null, tipo: RegTipo, anexos: AnexoPedido[], requisicaoId: string | null) {
  const tabela = await lerAnexos(p);
  if (!anexos.length) return { tabela, linhas: [] };
  if (!aceitaAnexos(tipo)) throw new ErroRequisicao(`O tipo "${tipo.nome}" não aceita foto nem vídeo.`);
  if (!arquivos || !tabela) throw new ErroRequisicao('Fotos e vídeos ainda não estão ativos nesta instituição. Envie sem anexo e descreva o problema.');
  const erros = conferirQuantidade(anexos);
  const usados = new Set(
    tabela
      .ativos()
      .filter((a) => a.requisicao_id !== requisicaoId)
      .map((a) => a.arquivo_id),
  );
  const linhas: { tipo: TipoAnexo; arquivo_id: string; nome: string; mime: string; tamanho: number; duracao: number | null }[] = [];
  for (const a of anexos) {
    if (usados.has(a.arquivoId)) {
      erros.push('Um dos arquivos já pertence a outra requisição.');
      continue;
    }
    const f = await arquivos.conferir(a.arquivoId);
    if (!f) {
      erros.push(`O arquivo "${a.nome}" não chegou à pasta de anexos. Envie de novo.`);
      continue;
    }
    erros.push(...conferirArquivo({ tipo: a.tipo, mime: f.tipo, tamanho: f.tamanho, duracao: a.duracao }));
    linhas.push({ tipo: a.tipo, arquivo_id: f.id, nome: (a.nome || f.nome).slice(0, 120), mime: f.tipo, tamanho: f.tamanho, duracao: a.duracao ?? null });
  }
  if (erros.length) throw new ErroRequisicao([...new Set(erros)].join(' '));
  return { tabela, linhas };
}

/**
 * Abre o envio de uma foto ou vídeo para a pasta de anexos. O navegador manda
 * o arquivo direto para lá; o vínculo com a requisição só nasce no envio da ficha.
 */
export async function iniciarEnvioAnexo(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  a: { tipoId: string; tipo: TipoAnexo; mime: string; tamanho: number; duracao?: number | null; origem: string },
): Promise<{ url: string }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  if (!arquivos) throw new ErroRequisicao('Fotos e vídeos ainda não estão ativos nesta instituição.');
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  const tipo = tipos.ativos().find((t) => t.id === a.tipoId);
  if (!tipo) throw new ErroRequisicao('Escolha o tipo de requisição antes de anexar.');
  if (!aceitaAnexos(tipo)) throw new ErroRequisicao(`O tipo "${tipo.nome}" não aceita foto nem vídeo.`);
  const erros = conferirArquivo(a);
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  // Nome sem dados pessoais: só a data e o tipo.
  const ext = a.mime.split('/')[1]?.replace('quicktime', 'mov').replace('jpeg', 'jpg') ?? 'bin';
  const nome = `requisicao-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${a.tipo}.${ext}`;
  return arquivos.iniciarEnvio({ nome, tipo: a.mime, tamanho: a.tamanho, origem: a.origem });
}

/**
 * Lê um trecho de um anexo para mostrar no Elo, só para quem pode ver a
 * requisição. A primeira leitura de cada abertura fica na auditoria.
 */
export async function lerAnexo(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  anexoId: string,
  pedido: { inicio: number; fim: number | null },
) {
  if (!arquivos) throw new ErroRequisicao('Fotos e vídeos não estão ativos nesta instituição.');
  const tabela = await lerAnexos(p);
  const anexo = tabela?.porId(anexoId);
  if (!anexo || !anexo.ativo) throw new ErroRequisicao('Anexo não encontrado.');
  const d = await ler(p, new Date());
  const r = d.requisicoes.porId(anexo.requisicao_id);
  if (!r || !r.ativo || !podeVer(quem, d, r)) throw new ErroPermissao('Você não tem acesso a este anexo.');
  const inicio = Math.max(0, Math.min(pedido.inicio, anexo.tamanho - 1));
  const fim = Math.min(pedido.fim ?? anexo.tamanho - 1, inicio + TRECHO_MAXIMO - 1, anexo.tamanho - 1);
  const trecho = await arquivos.ler(anexo.arquivo_id, { inicio, fim });
  if (inicio === 0) await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'RequisicaoAnexos', registroId: anexo.id });
  return { ...trecho, tipo: anexo.mime };
}

// ---------------------------------------------------------------------------
// Feriados (não contam nas horas úteis)
// ---------------------------------------------------------------------------

export async function salvarFeriado(p: Planilhas, quem: Autorizador, dados: { data: string; nome: string }) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const f = conferirFeriado(dados);
  const [feriados] = await lerTabelas(p, [FeriadosRequisicoes] as const);
  const igual = feriados.ativos().find((x) => x.data === f.data);
  if (igual) throw new ErroRequisicao(`Já há feriado em ${f.data.split('-').reverse().join('/')}: ${igual.nome}.`);
  const novo = await inserir(p, FeriadosRequisicoes, f, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'FeriadosRequisicoes', registroId: novo.id });
}

/** Inclui os feriados nacionais (e o de SP) do ano que ainda não estão cadastrados. Devolve quantos entraram. */
export async function incluirFeriadosNacionais(p: Planilhas, quem: Autorizador, ano: number): Promise<number> {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroRequisicao('Escolha o ano.');
  const [feriados] = await lerTabelas(p, [FeriadosRequisicoes] as const);
  const ja = new Set(feriados.ativos().map((f) => f.data));
  const novos = feriadosNacionais(ano).filter((f) => !ja.has(f.data));
  if (!novos.length) return 0;
  await inserirRegistros(p, feriados, novos, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'FeriadosRequisicoes', detalhes: { colunas: ['data', 'nome'] } });
  return novos.length;
}

export async function tirarFeriado(p: Planilhas, quem: Autorizador, id: string, versao: number) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [feriados] = await lerTabelas(p, [FeriadosRequisicoes] as const);
  const f = feriados.porId(id);
  if (!f || !f.ativo) throw new ErroRequisicao('Feriado não encontrado.');
  await atualizar(p, FeriadosRequisicoes, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'FeriadosRequisicoes', registroId: id, detalhes: { colunas: ['ativo'] } });
}

// ---------------------------------------------------------------------------
// Painel de prazos (SLA)
// ---------------------------------------------------------------------------

/** Últimos 6 meses até o atual (AAAA-MM), no horário de Brasília. */
export function periodoPadrao(agora: Date) {
  const ate = mesDe(agora.toISOString());
  let [a, m] = ate.split('-').map(Number);
  m -= 5;
  if (m < 1) {
    m += 12;
    a -= 1;
  }
  return { de: `${a}-${String(m).padStart(2, '0')}`, ate };
}

/**
 * Painel com as requisições que a pessoa pode ver: a Diretoria vê todas; a
 * coordenação, as do seu escopo; o setor, as dos seus tipos depois de aprovadas.
 */
export async function painelDePrazos(p: Planilhas, quem: Autorizador, periodo: { de?: string; ate?: string } = {}, opcoes: { agora?: Date } = {}) {
  if (!quem.temPermissaoAlgumEscopo(PERM.painel)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const padrao = periodoPadrao(agora);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/;
  let de = periodo.de && mes.test(periodo.de) ? periodo.de : padrao.de;
  let ate = periodo.ate && mes.test(periodo.ate) ? periodo.ate : padrao.ate;
  if (de > ate) [de, ate] = [ate, de];
  const d = await ler(p, agora);
  const nomePerfil = new Map(d.perfis.todos().map((x) => [x.codigo, x.nome]));
  const lista = d.requisicoes
    .ativos()
    .filter((r) => podeVer(quem, d, r))
    .flatMap((r) => {
      const t = d.tipoPorId.get(r.tipo_id);
      if (!t) return [];
      return [
        {
          id: r.id,
          numero: r.numero,
          tipoId: t.id,
          tipoNome: t.nome,
          setor: nomePerfil.get(t.perfil_responsavel) ?? t.perfil_responsavel,
          situacao: r.situacao,
          enviadaEm: r.enviada_em,
          decididaEm: r.decidida_em,
          concluidaEm: r.concluida_em,
          prazoAprovacao: t.prazo_aprovacao,
          prazoAtendimento: t.prazo_atendimento,
        },
      ];
    });
  return {
    de,
    ate,
    todas: quem.temPermissao(PERM.verTodas),
    expediente: { inicio: d.expediente.inicio, fim: d.expediente.fim },
    feriadosNoPeriodo: d.feriados.ativos().filter((f) => f.data.slice(0, 7) >= de && f.data.slice(0, 7) <= ate).length,
    ...montarPainel(lista, de, ate, agora.toISOString(), d.expediente),
  };
}

// ---------------------------------------------------------------------------
// Itens aceitos por tipo (lista que quem pede escolhe)
// ---------------------------------------------------------------------------

export async function itensDoTipo(p: Planilhas, quem: Autorizador, tipoId: string) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [tipos, catalogo, itens] = await lerTabelas(p, [TiposRequisicao, CatalogoItens, RequisicaoItens] as const);
  const tipo = tipos.porId(tipoId);
  if (!tipo) throw new ErroRequisicao('Tipo não encontrado.');
  const uso = agrupar(
    itens.ativos().filter((i) => i.catalogo_id),
    (i) => i.catalogo_id!,
  );
  const ordem = <T extends { descricao: string }>(l: T[]) => l.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  const doTipo = catalogo.todos().filter((c) => c.tipo_id === tipoId);
  return {
    tipo,
    ativos: ordem(doTipo.filter((c) => c.ativo)).map((c) => ({ ...c, pedidos: uso.get(c.id)?.length ?? 0 })),
    excluidos: ordem(doTipo.filter((c) => !c.ativo)),
  };
}

function conferirItemCatalogo(
  existentes: { id: string; descricao: string; ativo: boolean }[],
  descricao: string,
  unidade: string,
  ignorarId?: string,
): string[] {
  const erros: string[] = [];
  if (!descricao) erros.push('Descreva o item.');
  if (!unidade) erros.push('Informe a unidade (un, kg, L, pacote…).');
  const igual = existentes.find((c) => c.id !== ignorarId && nomeComparavel(c.descricao) === nomeComparavel(descricao));
  if (igual)
    erros.push(igual.ativo ? `"${igual.descricao}" já está na lista.` : `"${igual.descricao}" está entre os excluídos: reative em vez de cadastrar de novo.`);
  return erros;
}

const limpar = (t: string) => t.trim().replace(/\s+/g, ' ');

export async function salvarItemCatalogo(
  p: Planilhas,
  quem: Autorizador,
  tipoId: string,
  dados: { descricao: string; unidade: string },
  existente?: { id: string; versao: number },
) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [tipos, catalogo] = await lerTabelas(p, [TiposRequisicao, CatalogoItens] as const);
  if (!tipos.porId(tipoId)?.ativo) throw new ErroRequisicao('Tipo não encontrado.');
  const descricao = limpar(dados.descricao);
  const unidade = limpar(dados.unidade);
  const erros = conferirItemCatalogo(
    catalogo.todos().filter((c) => c.tipo_id === tipoId),
    descricao,
    unidade,
    existente?.id,
  );
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  if (!existente) {
    const c = await inserir(p, CatalogoItens, { tipo_id: tipoId, descricao, unidade }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'CatalogoItens', registroId: c.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, CatalogoItens, existente.id, existente.versao, { descricao, unidade }, { email: quem.email });
  if (colunasAlteradas.length)
    await registrarAuditoria(p, {
      usuario: quem.email,
      acao: 'alteracao',
      entidade: 'CatalogoItens',
      registroId: existente.id,
      detalhes: { colunas: colunasAlteradas },
    });
}

export async function mudarSituacaoItemCatalogo(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [catalogo] = await lerTabelas(p, [CatalogoItens] as const);
  const c = catalogo.porId(id);
  if (!c || c.ativo === ativo) throw new ErroRequisicao('Item não encontrado.');
  await atualizar(p, CatalogoItens, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: ativo ? 'alteracao' : 'encerramento',
    entidade: 'CatalogoItens',
    registroId: id,
    detalhes: { colunas: ['ativo'] },
  });
}

export interface LinhaItemLote {
  linha: number;
  descricao: string;
  unidade: string;
  situacao: 'ok' | 'ja_existe' | 'erro';
  problema: string | null;
}

/** Lista colada da planilha (Descrição; Unidade). Não grava nada. */
export async function analisarItensEmLote(p: Planilhas, quem: Autorizador, tipoId: string, texto: string): Promise<LinhaItemLote[]> {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [catalogo] = await lerTabelas(p, [CatalogoItens] as const);
  const existentes = new Map(
    catalogo
      .todos()
      .filter((c) => c.tipo_id === tipoId)
      .map((c) => [nomeComparavel(c.descricao), c]),
  );
  const naLista = new Set<string>();
  const r: LinhaItemLote[] = [];
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const [d = '', u = ''] = bruta.split(/\t|;/).map((x) => x.trim());
    const descricao = limpar(d);
    const unidade = limpar(u);
    if (!descricao) return;
    const chave = nomeComparavel(descricao);
    if (i === 0 && ['item', 'itens', 'descricao', 'produto'].includes(chave)) return; // cabeçalho
    const linha: LinhaItemLote = { linha: i + 1, descricao, unidade, situacao: 'ok', problema: null };
    const existe = existentes.get(chave);
    if (existe)
      Object.assign(linha, { situacao: 'ja_existe', problema: existe.ativo ? 'Já está na lista: será ignorado.' : 'Está entre os excluídos: reative.' });
    else if (naLista.has(chave)) Object.assign(linha, { situacao: 'ja_existe', problema: 'Repetido na lista: será ignorado.' });
    else if (!unidade) Object.assign(linha, { situacao: 'erro', problema: 'Falta a unidade.' });
    naLista.add(chave);
    r.push(linha);
  });
  return r;
}

export async function cadastrarItensEmLote(p: Planilhas, quem: Autorizador, tipoId: string, linhas: LinhaItemLote[]): Promise<number> {
  if (!quem.temPermissao(PERM.tipos)) throw new ErroPermissao();
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  if (!tipos.porId(tipoId)?.ativo) throw new ErroRequisicao('Tipo não encontrado.');
  const texto = linhas
    .filter((l) => l.situacao === 'ok')
    .map((l) => `${l.descricao};${l.unidade}`)
    .join('\n');
  const conferidas = (await analisarItensEmLote(p, quem, tipoId, texto)).filter((l) => l.situacao === 'ok');
  if (conferidas.length === 0) throw new ErroRequisicao('Nenhum item pronto para cadastrar. Confira a lista de novo.');
  const [catalogo] = await lerTabelas(p, [CatalogoItens] as const);
  await inserirRegistros(
    p,
    catalogo,
    conferidas.map((l) => ({ tipo_id: tipoId, descricao: l.descricao, unidade: l.unidade })),
    { email: quem.email },
  );
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'CatalogoItens',
    registroId: tipoId,
    detalhes: { emLote: conferidas.length },
  });
  return conferidas.length;
}

// ---------------------------------------------------------------------------
// Visão de ligação (ADR-022): números do serviço para a Ficha do serviço
// ---------------------------------------------------------------------------

export interface RequisicoesDoServico {
  ano: number;
  abertas: number;
  esperandoAprovacao: number;
  atrasadas: number;
  atendidasNoAno: number;
}

/**
 * Contagens das requisições que têm o serviço entre os centros de custo, só das que a pessoa já pode ver.
 * Nunca traz o nome de quem pediu.
 */
export async function requisicoesDoServico(
  p: Planilhas,
  quem: Autorizador,
  servico: string,
  opcoes: { agora?: Date } = {},
): Promise<Ligacao<RequisicoesDoServico>> {
  if (!quem.temPermissaoAlgumEscopo('requisicoes.acessar')) return ligacaoSemPermissao();
  const agora = opcoes.agora ?? new Date();
  const ano = Number(hoje(agora).slice(0, 4));
  const d = await ler(p, agora);
  const doServico = d.requisicoes
    .ativos()
    .filter((r) => (d.centrosPor.get(r.id) ?? []).some((c) => c.servico === servico) && podeVer(quem, d, r));
  const abertas = doServico.filter((r) => !SITUACOES_ENCERRADAS.includes(r.situacao));
  return ligacaoOk({
    ano,
    abertas: abertas.length,
    esperandoAprovacao: abertas.filter((r) => r.situacao === 'enviada').length,
    atrasadas: abertas.filter((r) => linha(d, r, agora).prazo?.situacao === 'atrasada').length,
    atendidasNoAno: doServico.filter((r) => (r.situacao === 'atendida' || r.situacao === 'atendida_parcial') && (r.concluida_em ?? '').startsWith(String(ano))).length,
  });
}
