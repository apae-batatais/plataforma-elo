/**
 * Casos de uso da Previsão (Entrega 1B.1).
 *
 * Quem pode:
 * - orcamento.painel.ver: ver a previsão (despesas, receitas, painel).
 * - orcamento.previsao.editar: cadastros (grupos e fontes), abrir o
 *   exercício, lançar despesas e receitas, escolher a fonte da folha.
 *
 * O exercício aprovado não muda por aqui: na Entrega 1B.2, só por
 * remanejamento ou suplementação aprovados pela Diretoria.
 * Nada é apagado: itens cancelados e cadastros excluídos ficam com ativo = FALSE.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import {
  arred, calcularIndicadores, distribuir, ErroDistribuicao, nomeComparavel, valorDoItem,
  COTACAO, PRIORIDADE,
  type Captacao, type Categoria, type Cotacao, type Distribuicao, type Indicadores, type Prioridade,
} from '../dominio/previsao';
import { acharCodigoRepetido, ErroCodigoConta, limparCodigoConta } from '../dominio/codigo-conta';
import { deltasDosAjustes, mesesComAjuste } from '../dominio/ajustes';
import {
  Ajustes, Despesas, Exercicios, Fontes, FontesFolha, GruposGasto, Receitas, Parametros, RegrasRateio,
  type RegDespesa, type RegFonte, type RegGrupo, type RegReceita,
} from '../dados/tabelas';
import { parametrosCom } from '../dominio/folha';
import { ErroValidacaoFolha, resumoFolha } from './folha';

/** Mesmo tipo de erro da folha: as telas já sabem mostrá-lo. */
export const ErroPrevisao = ErroValidacaoFolha;

const PERM = { ver: 'orcamento.painel.ver', editar: 'orcamento.previsao.editar' } as const;

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}
function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERM.ver) && !quem.temPermissao(PERM.editar)) throw new ErroPermissao();
}

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const mesesDe = (r: object) => MESES.map((m) => Number((r as Record<string, unknown>)[`m${m}`] ?? 0) || 0);
const colunasMeses = (lista: number[]) => Object.fromEntries(lista.map((v, i) => [`m${i + 1}`, v]));

// ---------------------------------------------------------------------------
// Ano e exercício
// ---------------------------------------------------------------------------

/** Ano padrão: o da folha (Parâmetros), que é o ano em elaboração. */
async function anoPadrao(p: Planilhas): Promise<number> {
  const [parametros] = await lerTabelas(p, [Parametros] as const);
  return parametrosCom(Object.fromEntries(parametros.ativos().map((x) => [x.chave, x.valor]))).ano;
}

export async function abrirExercicio(p: Planilhas, quem: Autorizador, ano: number): Promise<void> {
  exigir(quem, PERM.editar);
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) throw new ErroPrevisao('Ano inválido.');
  const [exercicios] = await lerTabelas(p, [Exercicios] as const);
  if (exercicios.ativos().some((e) => e.ano === ano)) throw new ErroPrevisao(`O exercício ${ano} já está aberto.`);
  const e = await inserir(p, Exercicios, { ano, situacao: 'elaboracao', aprovado_em: null, aprovado_por: null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Exercicios', registroId: e.id });
}

function exigirEmElaboracao(exercicios: { ativos(): { ano: number; situacao: string }[] }, ano: number) {
  const e = exercicios.ativos().find((x) => x.ano === ano);
  if (!e) throw new ErroPrevisao(`Abra o exercício ${ano} antes de lançar itens.`);
  if (e.situacao !== 'elaboracao') {
    throw new ErroPrevisao(`O exercício ${ano} já foi aprovado. Mudanças só por remanejamento ou suplementação aprovados pela Diretoria.`);
  }
}

// ---------------------------------------------------------------------------
// Cadastros: grupos de gasto e fontes de recurso
// ---------------------------------------------------------------------------

export interface Cadastros {
  grupos: { ativos: RegGrupo[]; excluidos: RegGrupo[]; uso: Record<string, number> };
  fontes: { ativos: RegFonte[]; excluidos: RegFonte[]; uso: Record<string, number> };
}

/** Itens que contam como "em uso": não cancelados, de exercícios não encerrados. */
async function usoDosCadastros(p: Planilhas) {
  const [despesas, receitas, fontesFolha, exercicios] = await lerTabelas(p, [Despesas, Receitas, FontesFolha, Exercicios] as const);
  const abertos = new Set(exercicios.ativos().filter((e) => e.situacao !== 'encerrado').map((e) => e.ano));
  const grupos: Record<string, number> = {};
  const fontes: Record<string, number> = {};
  const conta = (m: Record<string, number>, id: string | null) => {
    if (id) m[id] = (m[id] ?? 0) + 1;
  };
  for (const d of despesas.ativos()) {
    if (!abertos.has(d.ano) || d.situacao === 'recusada') continue;
    conta(grupos, d.grupo_id);
    conta(fontes, d.fonte_id);
  }
  for (const r of receitas.ativos()) if (abertos.has(r.ano)) conta(fontes, r.fonte_id);
  for (const f of fontesDaFolhaVigentes(fontesFolha.ativos())) if (abertos.has(f.ano)) conta(fontes, f.fonte_id);
  return { grupos, fontes };
}

export async function listarCadastros(p: Planilhas, quem: Autorizador): Promise<Cadastros> {
  exigirVer(quem);
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const uso = await usoDosCadastros(p);
  const ordem = <T extends { nome: string }>(l: T[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    grupos: { ativos: ordem(grupos.ativos()), excluidos: ordem(grupos.todos().filter((g) => !g.ativo)), uso: uso.grupos },
    fontes: { ativos: ordem(fontes.ativos()), excluidos: ordem(fontes.todos().filter((f) => !f.ativo)), uso: uso.fontes },
  };
}

function conferirNome(lista: { id: string; nome: string; ativo: boolean }[], nome: string, oQue: string, ignorarId?: string) {
  if (!nome) throw new ErroPrevisao(`Informe o nome ${oQue}.`);
  const igual = lista.find((x) => x.id !== ignorarId && nomeComparavel(x.nome) === nomeComparavel(nome));
  if (igual) {
    throw new ErroPrevisao(
      igual.ativo ? `Já existe "${igual.nome}". O nome não pode se repetir.` : `Já existe "${igual.nome}" entre os excluídos. Reative em vez de cadastrar de novo.`,
    );
  }
}
const limparNome = (t: string) => t.trim().replace(/\s+/g, ' ');

/** Limpa e confere o código da conta: formato e unicidade entre os ativos do cadastro. */
function conferirCodigo(lista: { id: string; nome: string; ativo: boolean; codigo_conta: string | null }[], bruto: string | null | undefined, oQue: 'grupo' | 'fonte', ignorarId?: string): string | null {
  let codigo: string | null;
  try {
    codigo = limparCodigoConta(bruto);
  } catch (e) {
    if (e instanceof ErroCodigoConta) throw new ErroPrevisao(e.message);
    throw e;
  }
  const outro = acharCodigoRepetido(lista, codigo, ignorarId);
  if (outro) {
    throw new ErroPrevisao(`O código ${codigo} já é d${oQue === 'grupo' ? 'o grupo' : 'a fonte'} "${outro.nome}". Altere o código ${oQue === 'grupo' ? 'deste grupo' : 'desta fonte'} ou d${oQue === 'grupo' ? 'aquele' : 'aquela'}.`);
  }
  return codigo;
}

export async function salvarGrupo(p: Planilhas, quem: Autorizador, dados: { id?: string; versao?: number; nome: string; rh: boolean; regra_rateio_id?: string | null; codigo_conta?: string | null }): Promise<void> {
  exigir(quem, PERM.editar);
  const nome = limparNome(dados.nome);
  const [grupos, regras] = await lerTabelas(p, [GruposGasto, RegrasRateio] as const);
  conferirNome(grupos.todos(), nome, 'do grupo', dados.id);
  if (dados.regra_rateio_id && !regras.ativos().some((r) => r.id === dados.regra_rateio_id)) throw new ErroPrevisao('Regra de rateio não encontrada.');
  const codigo_conta = dados.codigo_conta === undefined && dados.id ? (grupos.porId(dados.id)?.codigo_conta ?? null) : conferirCodigo(grupos.todos(), dados.codigo_conta, 'grupo', dados.id);
  if (!dados.id) {
    const g = await inserir(p, GruposGasto, { nome, rh: dados.rh, regra_rateio_id: dados.regra_rateio_id || null, codigo_conta }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'GruposGasto', registroId: g.id });
    return;
  }
  const alvo = grupos.porId(dados.id);
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Grupo não encontrado.');
  const { colunasAlteradas } = await atualizar(p, GruposGasto, dados.id, dados.versao ?? alvo.versao, { nome, rh: dados.rh, regra_rateio_id: dados.regra_rateio_id === undefined ? alvo.regra_rateio_id : dados.regra_rateio_id || null, codigo_conta }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'GruposGasto', registroId: dados.id, detalhes: { colunas: colunasAlteradas } });
}

export async function salvarFonte(
  p: Planilhas,
  quem: Autorizador,
  dados: { id?: string; versao?: number; nome: string; natureza: 'publica' | 'propria'; uso: 'livre' | 'restrita'; codigo_conta?: string | null },
): Promise<void> {
  exigir(quem, PERM.editar);
  const nome = limparNome(dados.nome);
  if (!['publica', 'propria'].includes(dados.natureza)) throw new ErroPrevisao('Escolha se a fonte é pública ou própria.');
  if (!['livre', 'restrita'].includes(dados.uso)) throw new ErroPrevisao('Escolha se o uso é livre ou restrito.');
  const [fontes] = await lerTabelas(p, [Fontes] as const);
  conferirNome(fontes.todos(), nome, 'da fonte', dados.id);
  const codigo_conta = dados.codigo_conta === undefined && dados.id ? (fontes.porId(dados.id)?.codigo_conta ?? null) : conferirCodigo(fontes.todos(), dados.codigo_conta, 'fonte', dados.id);
  const campos = { nome, natureza: dados.natureza, uso: dados.uso, codigo_conta };
  if (!dados.id) {
    const f = await inserir(p, Fontes, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Fontes', registroId: f.id });
    return;
  }
  const alvo = fontes.porId(dados.id);
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Fonte não encontrada.');
  const { colunasAlteradas } = await atualizar(p, Fontes, dados.id, dados.versao ?? alvo.versao, campos, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Fontes', registroId: dados.id, detalhes: { colunas: colunasAlteradas } });
}

async function encerrarCadastro(p: Planilhas, quem: Autorizador, tipo: 'grupo' | 'fonte', id: string, versao: number, ativo: boolean) {
  exigir(quem, PERM.editar);
  const tabela = (tipo === 'grupo' ? GruposGasto : Fontes) as typeof GruposGasto;
  const [lida] = await lerTabelas(p, [tabela] as const);
  const alvo = lida.porId(id);
  const nome = tipo === 'grupo' ? 'Grupo' : 'Fonte';
  if (!alvo || alvo.ativo === ativo) throw new ErroPrevisao(`${nome} não encontrad${tipo === 'grupo' ? 'o' : 'a'}.`);
  if (!ativo) {
    const uso = (await usoDosCadastros(p))[tipo === 'grupo' ? 'grupos' : 'fontes'][id] ?? 0;
    if (uso > 0) {
      throw new ErroPrevisao(
        `Não dá para excluir "${alvo.nome}": ${uso} ${uso === 1 ? 'item do orçamento usa' : 'itens do orçamento usam'} ${tipo === 'grupo' ? 'este grupo' : 'esta fonte'}. Troque nos itens antes.`,
      );
    }
  } else if (lida.ativos().some((x) => nomeComparavel(x.nome) === nomeComparavel(alvo.nome))) {
    throw new ErroPrevisao(`Já existe "${alvo.nome}" ativo.`);
  } else {
    const outro = acharCodigoRepetido((lida as unknown as { todos(): { id: string; nome: string; ativo: boolean; codigo_conta: string | null }[] }).todos(), alvo.codigo_conta, id);
    if (outro) {
      throw new ErroPrevisao(`Não dá para reativar "${alvo.nome}": o código ${alvo.codigo_conta} agora é d${tipo === 'grupo' ? 'o grupo' : 'a fonte'} "${outro.nome}". Altere o código d${tipo === 'grupo' ? 'esse grupo' : 'essa fonte'} em uso antes de reativar.`);
    }
  }
  await atualizar(p, tabela, id, versao, { ativo } as never, { email: quem.email });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: ativo ? 'alteracao' : 'encerramento',
    entidade: tipo === 'grupo' ? 'GruposGasto' : 'Fontes',
    registroId: id,
    detalhes: { colunas: ['ativo'] },
  });
}

export const excluirGrupo = (p: Planilhas, q: Autorizador, id: string, v: number) => encerrarCadastro(p, q, 'grupo', id, v, false);
export const reativarGrupo = (p: Planilhas, q: Autorizador, id: string, v: number) => encerrarCadastro(p, q, 'grupo', id, v, true);
export const excluirFonte = (p: Planilhas, q: Autorizador, id: string, v: number) => encerrarCadastro(p, q, 'fonte', id, v, false);
export const reativarFonte = (p: Planilhas, q: Autorizador, id: string, v: number) => encerrarCadastro(p, q, 'fonte', id, v, true);

// ---------------------------------------------------------------------------
// Despesas e receitas
// ---------------------------------------------------------------------------

export interface DadosDistribuicao {
  distribuicao: Distribuicao;
  /** Meses escolhidos (1 a 12), quando distribuicao = 'meses'. */
  meses?: number[];
  /** Valores digitados de jan a dez, quando distribuicao = 'manual'. */
  manual?: (number | null)[];
}

export interface DadosDespesa extends DadosDistribuicao {
  ano: number;
  servico: string;
  grupo_id: string;
  fonte_id: string | null;
  descricao: string;
  quantidade: number;
  ocorrencias: number;
  valor_unitario: number;
  /** Regra de rateio do item (vazio = a do grupo). undefined mantém a atual. */
  regra_rateio_id?: string | null;
  categoria?: Categoria;
  prioridade?: Prioridade | null;
  cotacao?: Cotacao | null;
  observacao?: string | null;
}

function mesesDaDistribuicao(valor: number, d: DadosDistribuicao): number[] {
  try {
    return distribuir(valor, d.distribuicao, { meses: d.meses, manual: d.manual });
  } catch (erro) {
    if (erro instanceof ErroDistribuicao) throw new ErroPrevisao(erro.message);
    throw erro;
  }
}

export async function salvarDespesa(p: Planilhas, quem: Autorizador, dados: DadosDespesa, existente?: { id: string; versao: number }): Promise<string> {
  exigir(quem, PERM.editar);
  const [exercicios, servicos, grupos, fontes, despesas, regras] = await lerTabelas(p, [Exercicios, Servicos, GruposGasto, Fontes, Despesas, RegrasRateio] as const);
  exigirEmElaboracao(exercicios, dados.ano);
  if (dados.regra_rateio_id && !regras.ativos().some((r) => r.id === dados.regra_rateio_id)) throw new ErroPrevisao('Regra de rateio não encontrada.');
  if (!servicos.ativos().some((s) => s.codigo === dados.servico)) throw new ErroPrevisao('Escolha o serviço (centro de custo).');
  if (!grupos.ativos().some((g) => g.id === dados.grupo_id)) throw new ErroPrevisao('Escolha o grupo de gasto.');
  if (dados.fonte_id && !fontes.ativos().some((f) => f.id === dados.fonte_id)) throw new ErroPrevisao('Escolha a fonte de recurso (ou "a definir").');
  const descricao = limparNome(dados.descricao);
  if (!descricao) throw new ErroPrevisao('Descreva o item.');
  for (const [v, rotulo] of [[dados.quantidade, 'Quantidade'], [dados.ocorrencias, 'Ocorrências']] as const) {
    if (!Number.isFinite(v) || v <= 0) throw new ErroPrevisao(`${rotulo} precisa ser maior que zero.`);
  }
  if (!Number.isFinite(dados.valor_unitario) || dados.valor_unitario < 0) throw new ErroPrevisao('Valor unitário inválido.');
  const valor = valorDoItem(dados.quantidade, dados.ocorrencias, dados.valor_unitario);
  const meses = mesesDaDistribuicao(valor, dados);
  const campos = {
    ano: dados.ano,
    servico: dados.servico,
    grupo_id: dados.grupo_id,
    fonte_id: dados.fonte_id || null,
    descricao,
    regra_rateio_id: dados.regra_rateio_id === undefined ? (existente ? (despesas.porId(existente.id)?.regra_rateio_id ?? null) : null) : dados.regra_rateio_id || null,
    quantidade: dados.quantidade,
    ocorrencias: dados.ocorrencias,
    valor_unitario: dados.valor_unitario,
    distribuicao: dados.distribuicao,
    ...colunasMeses(meses),
    categoria: dados.categoria === 'projetos' ? 'projetos' : 'operacional',
    prioridade: dados.prioridade && dados.prioridade in PRIORIDADE ? dados.prioridade : null,
    cotacao: dados.cotacao && dados.cotacao in COTACAO ? dados.cotacao : null,
    observacao: dados.observacao?.trim() || null,
  };
  if (!existente) {
    const d = await inserir(p, Despesas, { ...campos, situacao: 'aceito' } as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Despesas', registroId: d.id });
    return d.id;
  }
  const alvo = despesas.porId(existente.id);
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Item não encontrado.');
  if (alvo.ano !== dados.ano) throw new ErroPrevisao('O item é de outro exercício.');
  const { colunasAlteradas } = await atualizar(p, Despesas, existente.id, existente.versao, campos as never, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Despesas', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  return existente.id;
}

export interface DadosReceita extends DadosDistribuicao {
  ano: number;
  fonte_id: string;
  descricao: string;
  valor: number;
  captacao: Captacao;
  /** Área (código) a que a receita se destina; null = geral. */
  area?: string | null;
  observacao?: string | null;
}

export async function salvarReceita(p: Planilhas, quem: Autorizador, dados: DadosReceita, existente?: { id: string; versao: number }): Promise<string> {
  exigir(quem, PERM.editar);
  const [exercicios, fontes, receitas, areas] = await lerTabelas(p, [Exercicios, Fontes, Receitas, Areas] as const);
  exigirEmElaboracao(exercicios, dados.ano);
  if (dados.area && !areas.ativos().some((a) => a.codigo === dados.area)) throw new ErroPrevisao('Área não encontrada.');
  if (!fontes.ativos().some((f) => f.id === dados.fonte_id)) throw new ErroPrevisao('Escolha a fonte de recurso.');
  const descricao = limparNome(dados.descricao);
  if (!descricao) throw new ErroPrevisao('Descreva a receita.');
  if (!['garantida', 'negociacao', 'a_captar'].includes(dados.captacao)) throw new ErroPrevisao('Escolha a situação da captação.');
  if (!Number.isFinite(dados.valor) || dados.valor <= 0) throw new ErroPrevisao('O valor precisa ser maior que zero.');
  const valor = arred(dados.valor);
  const meses = mesesDaDistribuicao(valor, dados);
  const campos = {
    ano: dados.ano,
    fonte_id: dados.fonte_id,
    descricao,
    valor,
    captacao: dados.captacao,
    area: dados.area || null,
    distribuicao: dados.distribuicao,
    ...colunasMeses(meses),
    observacao: dados.observacao?.trim() || null,
  };
  if (!existente) {
    const r = await inserir(p, Receitas, campos as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Receitas', registroId: r.id });
    return r.id;
  }
  const alvo = receitas.porId(existente.id);
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Receita não encontrada.');
  if (alvo.ano !== dados.ano) throw new ErroPrevisao('A receita é de outro exercício.');
  const { colunasAlteradas } = await atualizar(p, Receitas, existente.id, existente.versao, campos as never, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Receitas', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  return existente.id;
}

/** Cancelar um item: sai do orçamento (ativo = FALSE), mas fica na planilha. */
export async function cancelarItem(p: Planilhas, quem: Autorizador, tipo: 'despesa' | 'receita', id: string, versao: number): Promise<void> {
  exigir(quem, PERM.editar);
  const tabela = (tipo === 'despesa' ? Despesas : Receitas) as typeof Despesas;
  const [exercicios, lida] = await lerTabelas(p, [Exercicios, tabela] as const);
  const alvo = lida.porId(id) as { ano: number; ativo: boolean } | undefined;
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Item não encontrado.');
  exigirEmElaboracao(exercicios, alvo.ano);
  await atualizar(p, tabela, id, versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: tipo === 'despesa' ? 'Despesas' : 'Receitas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

// ---------------------------------------------------------------------------
// Fonte da folha por serviço
// ---------------------------------------------------------------------------

/** A escolha mais recente de cada (ano, serviço). */
function fontesDaFolhaVigentes<T extends { ano: number; servico: string; criado_em: string }>(lista: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of [...lista].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) m.set(`${x.ano}|${x.servico}`, x);
  return [...m.values()];
}

export async function definirFonteDaFolha(p: Planilhas, quem: Autorizador, ano: number, servico: string, fonteId: string | null): Promise<void> {
  exigir(quem, PERM.editar);
  const [exercicios, fontes, servicos] = await lerTabelas(p, [Exercicios, Fontes, Servicos] as const);
  exigirEmElaboracao(exercicios, ano);
  if (servico !== SEM_LOTACAO && !servicos.todos().some((s) => s.codigo === servico)) throw new ErroPrevisao('Serviço não encontrado.');
  if (fonteId && !fontes.ativos().some((f) => f.id === fonteId)) throw new ErroPrevisao('Fonte não encontrada.');
  const r = await inserir(p, FontesFolha, { ano, servico, fonte_id: fonteId }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'FontesFolha', registroId: r.id });
}

// ---------------------------------------------------------------------------
// Leitura da previsão e painel
// ---------------------------------------------------------------------------

const SEM_LOTACAO = '__sem_lotacao__';
export const A_DEFINIR = '__a_definir__';

export interface LinhaDespesa {
  id: string;
  versao: number;
  servico: string;
  servicoNome: string;
  area: string;
  areaNome: string;
  grupo_id: string;
  grupoNome: string;
  /** Código da conta contábil do grupo (rótulo; vazio = sem código). */
  grupoCodigo: string | null;
  /** Regra de rateio do item (vazio = a do grupo). */
  regra_rateio_id?: string | null;
  rh: boolean;
  fonte_id: string | null;
  fonteNome: string;
  fonteCodigo: string | null;
  descricao: string;
  quantidade: number;
  ocorrencias: number;
  valor_unitario: number;
  valor: number;
  /** Valor antes dos remanejamentos e suplementações aprovados. */
  valorOriginal: number;
  distribuicao: Distribuicao;
  meses: number[];
  categoria: Categoria;
  prioridade: Prioridade | null;
  cotacao: Cotacao | null;
  observacao: string | null;
}

export interface LinhaReceita {
  id: string;
  versao: number;
  fonte_id: string;
  fonteNome: string;
  fonteCodigo: string | null;
  natureza: 'publica' | 'propria';
  uso: 'livre' | 'restrita';
  descricao: string;
  valor: number;
  /** Valor antes das suplementações aprovadas. */
  valorOriginal: number;
  captacao: Captacao;
  area: string | null;
  areaNome: string | null;
  distribuicao: Distribuicao;
  meses: number[];
  observacao: string | null;
}

export interface LinhaFolha {
  servico: string;
  nome: string;
  area: string;
  areaNome: string;
  mensal: number[];
  anual: number;
  fonte_id: string | null;
  fonteNome: string;
}

export interface Grupamento {
  chave: string;
  nome: string;
  mensal: number[];
  anual: number;
}

export interface Previsao {
  ano: number;
  anos: number[];
  exercicio: { id: string; versao: number; situacao: 'elaboracao' | 'aprovado' | 'encerrado'; aprovadoEm: string | null } | null;
  podeEditar: boolean;
  /** Propostas das coordenações aguardando o Financeiro. */
  propostasPendentes: number;
  /** Remanejamentos e suplementações aguardando a Diretoria. */
  ajustesPendentes: number;
  opcoes: {
    servicos: { codigo: string; nome: string; areaNome: string }[];
    areas: { codigo: string; nome: string }[];
    grupos: { id: string; nome: string; rh: boolean; regra_rateio_id?: string | null; codigo_conta?: string | null }[];
    regras?: { id: string; nome: string }[];
    fontes: { id: string; nome: string; natureza: 'publica' | 'propria'; uso: 'livre' | 'restrita'; codigo_conta?: string | null }[];
  };
  despesas: LinhaDespesa[];
  receitas: LinhaReceita[];
  /** RH automático da folha, por serviço da lotação. null = a folha é de outro ano ou sem acesso. */
  folha: { linhas: LinhaFolha[]; mensal: number[]; anual: number } | null;
  avisoFolha: string | null;
  totais: {
    despesa: { mensal: number[]; anual: number };
    receita: { mensal: number[]; anual: number };
    rh: number;
    aDefinir: { itens: number; valor: number };
    porArea: Grupamento[];
    porGrupo: Grupamento[];
    despesaPorFonte: Grupamento[];
    receitaPorFonte: Grupamento[];
    porCaptacao: Record<Captacao, number>;
  };
  indicadores: Indicadores;
}

const soma12 = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
const zeros = () => Array(12).fill(0) as number[];

function agrupar<T>(lista: T[], chave: (x: T) => string, nome: (x: T) => string, meses: (x: T) => number[]): Grupamento[] {
  const m = new Map<string, Grupamento>();
  for (const x of lista) {
    const k = chave(x);
    const g = m.get(k) ?? { chave: k, nome: nome(x), mensal: zeros(), anual: 0 };
    g.mensal = soma12(g.mensal, meses(x));
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, mensal: g.mensal.map(arred), anual: arred(g.mensal.reduce((s, v) => s + v, 0)) }))
    .sort((a, b) => b.anual - a.anual);
}

export async function lerPrevisao(p: Planilhas, quem: Autorizador, anoEscolhido?: number): Promise<Previsao> {
  exigirVer(quem);
  const [exercicios, despesasT, receitasT, gruposT, fontesT, fontesFolhaT, servicosT, areasT, ajustesT, regrasT] = await lerTabelas(p, [
    Exercicios, Despesas, Receitas, GruposGasto, Fontes, FontesFolha, Servicos, Areas, Ajustes, RegrasRateio,
  ] as const);
  const anos = [...new Set(exercicios.ativos().map((e) => e.ano))].sort();
  const ano = anoEscolhido && Number.isInteger(anoEscolhido) ? anoEscolhido : (anos.at(-1) ?? (await anoPadrao(p)));
  const ex = exercicios.ativos().find((e) => e.ano === ano) ?? null;

  const nomeArea = new Map(areasT.todos().map((a) => [a.codigo, a.nome]));
  const servico = new Map(servicosT.todos().map((s) => [s.codigo, s]));
  const grupo = new Map(gruposT.todos().map((g) => [g.id, g]));
  const fonte = new Map(fontesT.todos().map((f) => [f.id, f]));
  const nomeFonte = (id: string | null) => (id ? (fonte.get(id)?.nome ?? '?') : 'A definir');
  // Remanejamentos e suplementações aprovados mudam os meses dos itens (o item original fica como está).
  const deltas = deltasDosAjustes(ajustesT.ativos().filter((a) => a.ano === ano && a.situacao === 'aprovado'));
  const somaMeses = (l: number[]) => arred(l.reduce((t, v) => t + v, 0));

  const despesas: LinhaDespesa[] = despesasT
    .ativos()
    .filter((d) => d.ano === ano && d.situacao === 'aceito')
    .map((d: RegDespesa) => {
      const s = servico.get(d.servico);
      const g = grupo.get(d.grupo_id);
      return {
        id: d.id,
        versao: d.versao,
        servico: d.servico,
        servicoNome: s?.nome ?? d.servico,
        area: s?.area ?? '',
        areaNome: s?.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área',
        grupo_id: d.grupo_id,
        grupoNome: g?.nome ?? '?',
        grupoCodigo: g?.codigo_conta ?? null,
        regra_rateio_id: d.regra_rateio_id ?? null,
        rh: g?.rh ?? false,
        fonte_id: d.fonte_id,
        fonteNome: nomeFonte(d.fonte_id),
        fonteCodigo: d.fonte_id ? (fonte.get(d.fonte_id)?.codigo_conta ?? null) : null,
        descricao: d.descricao,
        quantidade: d.quantidade,
        ocorrencias: d.ocorrencias,
        valor_unitario: d.valor_unitario,
        valor: deltas.has(d.id) ? somaMeses(mesesComAjuste(mesesDe(d), deltas.get(d.id))) : valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario),
        valorOriginal: valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario),
        distribuicao: d.distribuicao,
        meses: mesesComAjuste(mesesDe(d), deltas.get(d.id)),
        categoria: d.categoria,
        prioridade: d.prioridade,
        cotacao: d.cotacao,
        observacao: d.observacao,
      };
    })
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.servicoNome.localeCompare(b.servicoNome, 'pt-BR') || a.descricao.localeCompare(b.descricao, 'pt-BR'));

  const receitas: LinhaReceita[] = receitasT
    .ativos()
    .filter((r) => r.ano === ano)
    .map((r: RegReceita) => {
      const f = fonte.get(r.fonte_id);
      return {
        id: r.id,
        versao: r.versao,
        fonte_id: r.fonte_id,
        fonteNome: f?.nome ?? '?',
        fonteCodigo: f?.codigo_conta ?? null,
        natureza: f?.natureza ?? 'propria',
        uso: f?.uso ?? 'livre',
        descricao: r.descricao,
        valor: deltas.has(r.id) ? somaMeses(mesesComAjuste(mesesDe(r), deltas.get(r.id))) : r.valor,
        valorOriginal: r.valor,
        captacao: r.captacao,
        area: r.area,
        areaNome: r.area ? (nomeArea.get(r.area) ?? r.area) : null,
        distribuicao: r.distribuicao,
        meses: mesesComAjuste(mesesDe(r), deltas.get(r.id)),
        observacao: r.observacao,
      };
    })
    .sort((a, b) => a.fonteNome.localeCompare(b.fonteNome, 'pt-BR') || a.descricao.localeCompare(b.descricao, 'pt-BR'));

  // RH da folha (custo com encargos × lotação, mês a mês) -------------------------
  let folha: Previsao['folha'] = null;
  let avisoFolha: string | null = null;
  if (quem.temPermissao('orcamento.folha.ver')) {
    const r = await resumoFolha(p, quem);
    if (r.ano !== ano) {
      avisoFolha = `A folha cadastrada é de ${r.ano}; o RH automático entra só no exercício ${r.ano}.`;
    } else {
      const fontesFolha = new Map(fontesDaFolhaVigentes(fontesFolhaT.ativos().filter((f) => f.ano === ano)).map((f) => [f.servico, f.fonte_id]));
      const linhas: LinhaFolha[] = r.centros.map((c) => {
        const fonteId = fontesFolha.get(c.codigo) ?? null;
        return { servico: c.codigo, nome: c.nome, area: c.area ?? (c.codigo === SEM_LOTACAO ? SEM_LOTACAO : '—'), areaNome: c.areaNome, mensal: c.mensal, anual: c.anual, fonte_id: fonteId, fonteNome: nomeFonte(fonteId) };
      });
      // Os encargos arredondados por serviço podem diferir em centavos do total da folha:
      // a diferença vai para o maior serviço do mês, para tudo fechar com o Resumo da folha.
      for (let m = 0; m < 12; m++) {
        const dif = arred(r.total.mensal[m] - linhas.reduce((s, l) => s + l.mensal[m], 0));
        if (dif !== 0 && linhas.length) {
          const maior = linhas.reduce((a, b) => (b.mensal[m] > a.mensal[m] ? b : a));
          maior.mensal = maior.mensal.map((v, i) => (i === m ? arred(v + dif) : v));
        }
      }
      for (const l of linhas) l.anual = arred(l.mensal.reduce((s, v) => s + v, 0));
      folha = { linhas, mensal: r.total.mensal, anual: r.total.anual };
      if (r.alertas && r.alertas.semRateio + r.alertas.foraDe100 > 0) {
        avisoFolha = `${r.alertas.semRateio + r.alertas.foraDe100} funcionário(s) sem lotação válida: o custo deles aparece em "Sem lotação".`;
      }
    }
  } else {
    avisoFolha = 'O seu perfil não vê a folha: o RH automático não aparece.';
  }

  // Totais -----------------------------------------------------------------------
  type Parte = { area: string; areaNome: string; grupo: string; grupoNome: string; rh: boolean; fonte: string; fonteNome: string; meses: number[] };
  const partes: Parte[] = [
    ...despesas.map((d) => ({
      area: d.area || '—', areaNome: d.areaNome, grupo: d.grupo_id, grupoNome: d.grupoNome, rh: d.rh,
      fonte: d.fonte_id ?? A_DEFINIR, fonteNome: d.fonteNome, meses: d.meses,
    })),
    ...(folha?.linhas ?? []).map((l) => ({
      area: l.area, areaNome: l.areaNome, grupo: '__folha__', grupoNome: 'Folha de pagamento (automática)', rh: true,
      fonte: l.fonte_id ?? A_DEFINIR, fonteNome: l.fonteNome, meses: l.mensal,
    })),
  ];
  const despesaMensal = partes.reduce((acc, x) => soma12(acc, x.meses), zeros()).map(arred);
  const receitaMensal = receitas.reduce((acc, x) => soma12(acc, x.meses), zeros()).map(arred);
  const anual = (l: number[]) => arred(l.reduce((s, v) => s + v, 0));
  const rh = arred(partes.filter((x) => x.rh).reduce((s, x) => s + x.meses.reduce((a, b) => a + b, 0), 0));
  const aDefinir = partes.filter((x) => x.fonte === A_DEFINIR);
  const somaReceita = (f: (r: LinhaReceita) => boolean) => arred(receitas.filter(f).reduce((s, r) => s + r.valor, 0));
  const porCaptacao = {
    garantida: somaReceita((r) => r.captacao === 'garantida'),
    negociacao: somaReceita((r) => r.captacao === 'negociacao'),
    a_captar: somaReceita((r) => r.captacao === 'a_captar'),
  };
  const despesaAnual = anual(despesaMensal);
  const receitaAnual = anual(receitaMensal);

  return {
    ano,
    anos: anos.includes(ano) ? anos : [...anos, ano].sort(),
    exercicio: ex ? { id: ex.id, versao: ex.versao, situacao: ex.situacao, aprovadoEm: ex.aprovado_em } : null,
    podeEditar: quem.temPermissao(PERM.editar) && ex?.situacao === 'elaboracao',
    propostasPendentes: despesasT.ativos().filter((d) => d.ano === ano && d.situacao === 'proposta').length,
    ajustesPendentes: ajustesT.ativos().filter((a) => a.ano === ano && a.situacao === 'pendente').length,
    opcoes: {
      areas: areasT.ativos().map((a) => ({ codigo: a.codigo, nome: a.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      servicos: servicosT
        .ativos()
        .map((s) => ({ codigo: s.codigo, nome: s.nome, areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
        .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
      grupos: gruposT.ativos().map((g) => ({ id: g.id, nome: g.nome, rh: g.rh, regra_rateio_id: g.regra_rateio_id ?? null, codigo_conta: g.codigo_conta ?? null })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      regras: regrasT.ativos().map((r) => ({ id: r.id, nome: r.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      fontes: fontesT.ativos().map((f) => ({ id: f.id, nome: f.nome, natureza: f.natureza, uso: f.uso })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    },
    despesas,
    receitas,
    folha,
    avisoFolha,
    totais: {
      despesa: { mensal: despesaMensal, anual: despesaAnual },
      receita: { mensal: receitaMensal, anual: receitaAnual },
      rh,
      aDefinir: { itens: aDefinir.length, valor: arred(aDefinir.reduce((s, x) => s + x.meses.reduce((a, b) => a + b, 0), 0)) },
      porArea: agrupar(partes, (x) => x.area, (x) => x.areaNome, (x) => x.meses),
      porGrupo: agrupar(partes, (x) => x.grupo, (x) => x.grupoNome, (x) => x.meses),
      despesaPorFonte: agrupar(partes, (x) => x.fonte, (x) => x.fonteNome, (x) => x.meses),
      receitaPorFonte: agrupar(receitas, (x) => x.fonte_id, (x) => x.fonteNome, (x) => x.meses),
      porCaptacao,
    },
    indicadores: calcularIndicadores({
      despesa: despesaAnual,
      receita: receitaAnual,
      rh,
      receitaPublica: somaReceita((r) => r.natureza === 'publica'),
      receitaLivre: somaReceita((r) => r.uso === 'livre'),
      receitaGarantida: porCaptacao.garantida,
    }),
  };
}


// ---------------------------------------------------------------------------
// Árvore mês a mês: Receita › fonte › item  e  Despesa › grupo › item
// ---------------------------------------------------------------------------

export interface NoArvore {
  id: string;
  nome: string;
  /** Texto curto abaixo do nome (ex.: o serviço do item). */
  detalhe?: string;
  mensal: number[];
  anual: number;
  filhos?: NoArvore[];
}

function no(id: string, nome: string, filhos: NoArvore[]): NoArvore {
  const ordenados = [...filhos].sort((a, b) => b.anual - a.anual);
  const mensal = ordenados.reduce((acc, f) => soma12(acc, f.mensal), zeros()).map(arred);
  return { id, nome, mensal, anual: arred(mensal.reduce((s, v) => s + v, 0)), filhos: ordenados };
}
const folhaNo = (id: string, nome: string, mensal: number[], detalhe?: string): NoArvore => ({
  id,
  nome,
  detalhe,
  mensal: mensal.map(arred),
  anual: arred(mensal.reduce((s, v) => s + v, 0)),
});

/** Monta a árvore da tabela mês a mês. Os totais de cada nível são a soma dos filhos. */
export function arvoreMensal(prev: Pick<Previsao, 'despesas' | 'receitas' | 'folha'>): { receita: NoArvore; despesa: NoArvore } {
  const porChave = <T,>(lista: T[], chave: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of lista) m.set(chave(x), [...(m.get(chave(x)) ?? []), x]);
    return m;
  };

  const fontes = [...porChave(prev.receitas, (r) => r.fonte_id)].map(([fonte, itens]) =>
    no(`r:${fonte}`, itens[0].fonteNome, itens.map((r) => folhaNo(`r:${fonte}:${r.id}`, r.descricao, r.meses, CAPTACAO_TEXTO[r.captacao]))),
  );

  const grupos = [...porChave(prev.despesas, (d) => d.grupo_id)].map(([grupo, itens]) =>
    no(`d:${grupo}`, itens[0].grupoNome, itens.map((d) => folhaNo(`d:${grupo}:${d.id}`, d.descricao, d.meses, d.servicoNome))),
  );
  if (prev.folha && prev.folha.linhas.length) {
    grupos.push(no('d:__folha__', 'Folha de pagamento (automática)', prev.folha.linhas.map((l) => folhaNo(`d:__folha__:${l.servico}`, l.nome, l.mensal, l.areaNome))));
  }

  return { receita: no('receita', 'Receita', fontes), despesa: no('despesa', 'Despesa', grupos) };
}

const CAPTACAO_TEXTO: Record<Captacao, string> = { garantida: 'Garantida', negociacao: 'Em negociação', a_captar: 'A captar' };
