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
import { atualizar, atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { CentrosCusto, Despesas, Exercicios, Fontes, GruposGasto, LancamentosRateio, RegrasRateio, type RegLancamentoRateio } from '../dados/tabelas';
import { ratearMeses, totalDosMeses } from '../dominio/lancamento-rateio';
import { arred, valorDoItem, type Categoria, type Distribuicao } from '../dominio/previsao';
import { conferirRegra, ErroRegra, ratearPelaRegra, type CentroRateio, type RegraRateio } from '../dominio/rateio-custos';
import { profissionaisPorServico } from './folha';
import { exigirEmElaboracao, ErroPrevisao, mesesDaDistribuicao, type DadosDistribuicao } from './previsao';
import { regrasParaCalculo } from './regras-rateio';

const PERM_EDITAR = 'orcamento.previsao.editar';
const PERM_VER = 'orcamento.painel.ver';

function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}
function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERM_VER) && !quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const mesesDe = (r: object) => MESES.map((m) => Number((r as Record<string, unknown>)[`m${m}`] ?? 0) || 0);
const colunasMeses = (lista: number[]) => Object.fromEntries(lista.map((v, i) => [`m${i + 1}`, v]));
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
// Cálculo (usa o R1 sem mudá-lo)
// ---------------------------------------------------------------------------

interface ContextoCalculo {
  centros: CentroRateio[];
  regras: Map<string, RegraRateio>;
  basesDoAno: (ano: number) => Map<string, Map<string, number>>;
  custoDireto: (ano: number) => Map<string, number>;
  nomeServico: Map<string, string>;
}

async function contextoDeCalculo(p: Planilhas): Promise<ContextoCalculo> {
  const [servicos, centrosT, despesas] = await lerTabelas(p, [Servicos, CentrosCusto, Despesas] as const);
  const prof = await profissionaisPorServico(p);
  const porServ = new Map(centrosT.ativos().map((c) => [c.servico, c]));
  const centros: CentroRateio[] = servicos.ativos().map((s) => {
    const c = porServ.get(s.codigo);
    return { codigo: s.codigo, area: s.area ?? null, tipo: c?.tipo ?? 'direto', atendidos: c?.atendidos ?? s.vagas ?? null, vagas: c?.vagas ?? s.vagas ?? null, m2: c?.area_m2 ?? null, profissionais: prof.get(s.codigo) ?? 0, regraId: c?.regra_rateio_id ?? null };
  });
  const { regras, basesDoAno } = await regrasParaCalculo(p);
  return {
    centros,
    regras: new Map(regras.map((r) => [r.id, r])),
    basesDoAno,
    // Base "custo direto": só as despesas lançadas à mão (as geradas por rateio não entram, senão a conta giraria em círculo).
    custoDireto: (ano) => {
      const m = new Map<string, number>();
      for (const d of despesas.ativos().filter((x) => x.ano === ano && x.situacao === 'aceito' && !x.lancamento_rateio_id)) {
        m.set(d.servico, arred((m.get(d.servico) ?? 0) + valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario)));
      }
      return m;
    },
    nomeServico: new Map(servicos.ativos().map((s) => [s.codigo, s.nome])),
  };
}

/** Quanto cada serviço participante recebe em cada mês (mesmos pesos em todos os meses). */
function partesPorServico(ctx: ContextoCalculo, regraId: string, ano: number, meses: number[]): Map<string, number[]> {
  const regra = ctx.regras.get(regraId);
  if (!regra) return new Map();
  const base = { centros: ctx.centros, custoDireto: ctx.custoDireto(ano), basesProprias: ctx.basesDoAno(ano) };
  try {
    conferirRegra(regra, ctx.centros);
  } catch (e) {
    if (e instanceof ErroRegra) return new Map();
    throw e;
  }
  return ratearMeses(meses, (valor) => ratearPelaRegra(valor, regra, base, () => true));
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
  const ctx = await contextoDeCalculo(p);
  const partes = partesPorServico(ctx, dados.regra_rateio_id, dados.ano, meses);
  const linhas = [...partes]
    .map(([codigo, lista]) => ({ codigo, nome: ctx.nomeServico.get(codigo) ?? codigo, valor: totalDosMeses(lista), percentual: valor > 0 ? totalDosMeses(lista) / valor : 0 }))
    .sort((a, b) => b.valor - a.valor);
  return { valor, linhas };
}

// ---------------------------------------------------------------------------
// Geração e recálculo das despesas
// ---------------------------------------------------------------------------

/** Chave de comparação: mesmos serviços e mesmos meses = nada a regravar. */
const assinatura = (m: Map<string, number[]>) => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));

/**
 * Deixa as despesas geradas de um lançamento como o cálculo atual manda. Só mexe se algo mudou.
 * Devolve quantas despesas foram geradas e quantas encerradas.
 */
async function sincronizar(p: Planilhas, quem: Autorizador, lanc: RegLancamentoRateio, ctx: ContextoCalculo): Promise<{ geradas: number; encerradas: number; semDespesa: boolean }> {
  const [despesasT] = await lerTabelas(p, [Despesas] as const);
  const atuais = despesasT.ativos().filter((d) => d.lancamento_rateio_id === lanc.id);
  const novas = partesPorServico(ctx, lanc.regra_rateio_id, lanc.ano, mesesDe(lanc));
  const antes = new Map(atuais.map((d) => [d.servico, mesesDe(d)]));
  if (assinatura(antes) === assinatura(novas)) return { geradas: 0, encerradas: 0, semDespesa: novas.size === 0 };
  const autoria = { email: quem.email };
  if (atuais.length) {
    await atualizarVarios(p, Despesas, atuais.map((d) => ({ id: d.id, versao: d.versao, mudancas: { ativo: false } })), autoria);
    for (const d of atuais) {
      await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Despesas', registroId: d.id, detalhes: { colunas: ['ativo'], lancamento_rateio_id: lanc.id } });
    }
  }
  const criadas = await inserirRegistros(
    p,
    despesasT,
    [...novas].map(([servico, meses]) => ({
      ano: lanc.ano,
      servico,
      grupo_id: lanc.grupo_id,
      fonte_id: lanc.fonte_id,
      descricao: lanc.descricao,
      regra_rateio_id: null,
      quantidade: 1,
      ocorrencias: 1,
      valor_unitario: totalDosMeses(meses),
      distribuicao: 'manual' as const,
      ...colunasMeses(meses),
      categoria: lanc.categoria,
      situacao: 'aceito' as const,
      lancamento_rateio_id: lanc.id,
    })) as never[],
    autoria,
  );
  for (const d of criadas) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Despesas', registroId: d.id, detalhes: { lancamento_rateio_id: lanc.id } });
  }
  return { geradas: criadas.length, encerradas: atuais.length, semDespesa: novas.size === 0 };
}

export interface Gatilho {
  /** Regra de rateio que foi salva. */
  regraId?: string;
  /** Base própria cujos valores mudaram. */
  baseId?: string;
  /** Serviço cujos números (atendidos, m², vagas ou lotação) mudaram. */
  servico?: string;
}

/**
 * Único ponto de recálculo (ADR-038): chamado depois de salvar a regra, os valores de uma base, os números
 * de um serviço ou a lotação. Só atinge lançamentos de exercício em elaboração; os de exercício aprovado
 * ficam congelados. Não pede permissão de lançar: quem alterou a origem já foi autorizado lá.
 */
export async function recalcularLancamentosAfetados(p: Planilhas, quem: Autorizador, gatilho: Gatilho): Promise<number> {
  const [exercicios, lancT, servicos] = await lerTabelas(p, [Exercicios, LancamentosRateio, Servicos] as const);
  const abertos = new Set(exercicios.ativos().filter((e) => e.situacao === 'elaboracao').map((e) => e.ano));
  const candidatos = lancT.ativos().filter((l) => abertos.has(l.ano));
  if (candidatos.length === 0) return 0;
  const ctx = await contextoDeCalculo(p);
  const area = gatilho.servico ? (servicos.ativos().find((s) => s.codigo === gatilho.servico)?.area ?? null) : null;
  const atinge = (l: RegLancamentoRateio) => {
    const r = ctx.regras.get(l.regra_rateio_id);
    if (!r) return false;
    if (gatilho.regraId && r.id === gatilho.regraId) return true;
    if (gatilho.baseId && (r.base1 === `propria:${gatilho.baseId}` || r.base2 === `propria:${gatilho.baseId}`)) return true;
    if (gatilho.servico) return r.participantes.includes(gatilho.servico) || (r.tipo === 'area' && area !== null && r.participantes.includes(area));
    return false;
  };
  let mudou = 0;
  for (const l of candidatos.filter(atinge)) {
    const r = await sincronizar(p, quem, l, ctx);
    mudou += r.geradas + r.encerradas;
  }
  return mudou;
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
  const r = await sincronizar(p, quem, lanc, await contextoDeCalculo(p));
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
