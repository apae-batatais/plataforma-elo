/**
 * Lançamento de despesas por rateio (#225, ADR-038).
 *
 * Um Lançamento é uma despesa que não pertence a nenhum serviço: a Regra de rateio (R1) decide quem recebe.
 * Ao salvar, o Elo grava uma despesa por serviço participante (coluna `lancamento_rateio_id`), travada no
 * cadastro comum. Enquanto o exercício está em elaboração, essas despesas se recalculam sozinhas quando
 * muda o lançamento, a regra, uma base própria, os números de um serviço ou a lotação (lista fechada,
 * ADR-038). Com o exercício aprovado, ficam congeladas.
 *
 * - orcamento.previsao.editar (Financeiro): cadastrar, alterar e excluir.
 * - orcamento.painel.ver: ver os lançamentos.
 * Nada é apagado: excluir e recalcular encerram (ativo = FALSE). Auditoria registra colunas, nunca valores.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, atualizarVarios, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Despesas, Exercicios, Fontes, GruposGasto, LancamentosRateio, RegrasRateio } from '../dados/tabelas';
import { totalDosMeses } from '../dominio/lancamento-rateio';
import { valorDoItem, type Categoria, type Distribuicao } from '../dominio/previsao';
import { profissionaisPorServico } from './folha';
import { exigirEmElaboracao, ErroPrevisao, mesesDaDistribuicao, type DadosDistribuicao } from './previsao';
import { colunasMeses, contextoDeCalculo, mesesDe, partesPorServico, sincronizar } from './recalculo-rateio';

const PERM_EDITAR = 'orcamento.previsao.editar';
const PERM_VER = 'orcamento.painel.ver';

function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}
function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERM_VER) && !quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}

const limpar = (t: string) => t.trim().replace(/\s+/g, ' ');

export interface DadosLancamento extends DadosDistribuicao {
  ano: number;
  grupo_id: string;
  fonte_id: string | null;
  descricao: string;
  regra_rateio_id: string;
  quantidade: number;
  ocorrencias: number;
  valor_unitario: number;
  categoria?: Categoria;
  observacao?: string | null;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface LinhaLancamento {
  id: string;
  versao: number;
  descricao: string;
  grupo_id: string;
  grupoNome: string;
  fonte_id: string | null;
  regra_rateio_id: string;
  regraNome: string;
  quantidade: number;
  ocorrencias: number;
  valor_unitario: number;
  valor: number;
  distribuicao: Distribuicao;
  meses: number[];
  categoria: Categoria;
  observacao: string | null;
  /** Quantos serviços recebem hoje (despesas geradas ativas). */
  servicos: number;
}

export interface ListaLancamentos {
  ano: number;
  anos: number[];
  /** O exercício existe e está em elaboração. */
  emElaboracao: boolean;
  exercicioAberto: boolean;
  podeEditar: boolean;
  lancamentos: LinhaLancamento[];
}

export async function listarLancamentos(p: Planilhas, quem: Autorizador, anoEscolhido?: number): Promise<ListaLancamentos> {
  exigirVer(quem);
  const [exercicios, lancT, despesas, grupos, regras] = await lerTabelas(p, [Exercicios, LancamentosRateio, Despesas, GruposGasto, RegrasRateio] as const);
  const anos = [...new Set(exercicios.ativos().map((e) => e.ano))].sort();
  const ano = anoEscolhido && Number.isInteger(anoEscolhido) ? anoEscolhido : (anos.at(-1) ?? new Date().getFullYear());
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  const nomeGrupo = new Map(grupos.todos().map((g) => [g.id, g.nome]));
  const nomeRegra = new Map(regras.todos().map((r) => [r.id, r.nome]));
  const geradas = despesas.ativos().filter((d) => d.ano === ano && d.lancamento_rateio_id);
  const lancamentos = lancT
    .ativos()
    .filter((l) => l.ano === ano)
    .map((l): LinhaLancamento => ({
      id: l.id,
      versao: l.versao,
      descricao: l.descricao,
      grupo_id: l.grupo_id,
      grupoNome: nomeGrupo.get(l.grupo_id) ?? '?',
      fonte_id: l.fonte_id,
      regra_rateio_id: l.regra_rateio_id,
      regraNome: nomeRegra.get(l.regra_rateio_id) ?? '?',
      quantidade: l.quantidade,
      ocorrencias: l.ocorrencias,
      valor_unitario: l.valor_unitario,
      valor: valorDoItem(l.quantidade, l.ocorrencias, l.valor_unitario),
      distribuicao: l.distribuicao,
      meses: mesesDe(l),
      categoria: l.categoria,
      observacao: l.observacao,
      servicos: geradas.filter((d) => d.lancamento_rateio_id === l.id).length,
    }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  return { ano, anos, emElaboracao: ex?.situacao === 'elaboracao', exercicioAberto: Boolean(ex), podeEditar: quem.temPermissao(PERM_EDITAR), lancamentos };
}

export interface PreviaLancamento {
  valor: number;
  linhas: { codigo: string; nome: string; valor: number; percentual: number }[];
}

function validar(dados: DadosLancamento, t: { grupos: { ativos(): { id: string }[] }; fontes: { ativos(): { id: string }[] }; regras: { ativos(): { id: string }[] } }) {
  if (!t.regras.ativos().some((r) => r.id === dados.regra_rateio_id)) throw new ErroPrevisao('Escolha uma Regra de rateio ativa (Cadastros › Regras de rateio).');
  if (!t.grupos.ativos().some((g) => g.id === dados.grupo_id)) throw new ErroPrevisao('Escolha o grupo de gasto.');
  if (dados.fonte_id && !t.fontes.ativos().some((f) => f.id === dados.fonte_id)) throw new ErroPrevisao('Escolha a fonte de recurso (ou "a definir").');
  const descricao = limpar(dados.descricao);
  if (!descricao) throw new ErroPrevisao('Descreva o lançamento.');
  for (const [v, rotulo] of [[dados.quantidade, 'Quantidade'], [dados.ocorrencias, 'Ocorrências']] as const) {
    if (!Number.isFinite(v) || v <= 0) throw new ErroPrevisao(`${rotulo} precisa ser maior que zero.`);
  }
  if (!Number.isFinite(dados.valor_unitario) || dados.valor_unitario < 0) throw new ErroPrevisao('Valor unitário inválido.');
  const valor = valorDoItem(dados.quantidade, dados.ocorrencias, dados.valor_unitario);
  return { descricao, valor, meses: mesesDaDistribuicao(valor, dados) };
}

/** "Como ficaria": quanto cada serviço recebe, com os números atuais das bases. Não grava nada. */
export async function previaDoLancamento(p: Planilhas, quem: Autorizador, dados: DadosLancamento): Promise<PreviaLancamento> {
  exigirEditar(quem);
  const [grupos, fontes, regras] = await lerTabelas(p, [GruposGasto, Fontes, RegrasRateio] as const);
  const { valor, meses } = validar(dados, { grupos, fontes, regras });
  const ctx = await contextoDeCalculo(p, () => profissionaisPorServico(p));
  const partes = partesPorServico(ctx, dados.regra_rateio_id, dados.ano, meses);
  const linhas = [...partes]
    .map(([codigo, lista]) => ({ codigo, nome: ctx.nomeServico.get(codigo) ?? codigo, valor: totalDosMeses(lista), percentual: valor > 0 ? totalDosMeses(lista) / valor : 0 }))
    .sort((a, b) => b.valor - a.valor);
  return { valor, linhas };
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export interface ResultadoLancamento {
  id: string;
  geradas: number;
  /** Nenhum serviço recebeu: a Regra de rateio precisa de ajuste (não bloqueia salvar). */
  semDespesa: boolean;
}

export async function salvarLancamentoRateio(p: Planilhas, quem: Autorizador, dados: DadosLancamento, existente?: { id: string; versao: number }): Promise<ResultadoLancamento> {
  exigirEditar(quem);
  const [exercicios, grupos, fontes, regras, lancT] = await lerTabelas(p, [Exercicios, GruposGasto, Fontes, RegrasRateio, LancamentosRateio] as const);
  exigirEmElaboracao(exercicios, dados.ano);
  const { descricao, meses } = validar(dados, { grupos, fontes, regras });
  const campos = {
    ano: dados.ano,
    grupo_id: dados.grupo_id,
    fonte_id: dados.fonte_id || null,
    descricao,
    regra_rateio_id: dados.regra_rateio_id,
    quantidade: dados.quantidade,
    ocorrencias: dados.ocorrencias,
    valor_unitario: dados.valor_unitario,
    distribuicao: dados.distribuicao,
    ...colunasMeses(meses),
    categoria: dados.categoria === 'projetos' ? ('projetos' as const) : ('operacional' as const),
    observacao: dados.observacao?.trim() || null,
  };
  let id: string;
  if (!existente) {
    const l = await inserir(p, LancamentosRateio, campos as never, { email: quem.email });
    id = l.id;
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'LancamentosRateio', registroId: id });
  } else {
    const alvo = lancT.porId(existente.id);
    if (!alvo || !alvo.ativo) throw new ErroPrevisao('Lançamento não encontrado.');
    if (alvo.ano !== dados.ano) throw new ErroPrevisao('O lançamento é de outro exercício.');
    id = alvo.id;
    const { colunasAlteradas } = await atualizar(p, LancamentosRateio, id, existente.versao, campos as never, { email: quem.email });
    if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'LancamentosRateio', registroId: id, detalhes: { colunas: colunasAlteradas } });
  }
  const [lida] = await lerTabelas(p, [LancamentosRateio] as const);
  const lanc = lida.porId(id)!;
  const r = await sincronizar(p, quem, lanc, await contextoDeCalculo(p, () => profissionaisPorServico(p)));
  return { id, geradas: r.geradas, semDespesa: r.semDespesa };
}

/** Exclui o lançamento e encerra todas as despesas que ele gerou (só com o exercício em elaboração). */
export async function excluirLancamentoRateio(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<number> {
  exigirEditar(quem);
  const [exercicios, lancT, despesasT] = await lerTabelas(p, [Exercicios, LancamentosRateio, Despesas] as const);
  const alvo = lancT.porId(id);
  if (!alvo || !alvo.ativo) throw new ErroPrevisao('Lançamento não encontrado.');
  exigirEmElaboracao(exercicios, alvo.ano);
  const geradas = despesasT.ativos().filter((d) => d.lancamento_rateio_id === id);
  const autoria = { email: quem.email };
  await atualizar(p, LancamentosRateio, id, versao, { ativo: false } as never, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'LancamentosRateio', registroId: id, detalhes: { colunas: ['ativo'] } });
  await atualizarVarios(p, Despesas, geradas.map((d) => ({ id: d.id, versao: d.versao, mudancas: { ativo: false } })), autoria);
  for (const d of geradas) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Despesas', registroId: d.id, detalhes: { colunas: ['ativo'], lancamento_rateio_id: id } });
  }
  return geradas.length;
}
