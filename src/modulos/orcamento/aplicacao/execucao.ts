/**
 * Painel de execução e Recursos livres (Entrega 1C.2). Só leitura: tudo é soma das linhas de `Realizado` e do
 * previsto da Previsão aprovada, em centavos. Nada é guardado; não há auditoria de leitura (só totais, sem dado pessoal).
 *
 * Quem vê (R8, o filtro vem ANTES de somar, para nada vazar por subtração entre totais):
 * - orcamento.execucao.ver sem escopo (Diretoria e Financeiro): tudo.
 * - orcamento.execucao.ver com escopo (Coordenação): só despesa dos serviços do escopo; sem receita nem adiantamentos.
 * - orcamento.painel.ver (Leitura): só os totais do ano e do período; não acessa Recursos livres.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { Ajustes, Despesas, Exercicios, Fontes, GruposGasto, Realizado, Receitas, type RegRealizado } from '../dados/tabelas';
import { deltasDosAjustes, mesesComAjuste } from '../dominio/ajustes';
import {
  adiantamentoEmAtencao, diasEmAberto, execucaoPercentual, mesesComparaveis, periodoDaExecucao, saldoDoTermo, somar,
  SERVICO_COMUM, variacaoPercentual, type PeriodoExecucao,
} from '../dominio/execucao';
import { ROTULO_NATUREZA, type Natureza } from '../dominio/realizado';
import { mesAtualBrasilia } from '../dominio/tesouraria';

const PERM = { ver: 'orcamento.execucao.ver', editar: 'orcamento.realizado.editar', painel: 'orcamento.painel.ver' } as const;
const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export type NivelExecucao = 'completo' | 'escopo' | 'totais';

export interface Medida {
  realizado: number;
  /** null = sem Previsão aprovada para comparar. */
  previsto: number | null;
  /** null = sem previsto (nunca 0% nem infinito). */
  execucao: number | null;
}

export interface LinhaExecucao {
  area: string;
  servico: string;
  grupo: string;
  fonte: string;
  tipo: 'despesa' | 'receita';
  previsto: number;
  realizado: number;
  /** Realizado sem linha na Previsão (R2). */
  foraDaPrevisao: boolean;
}

export interface PainelExecucao {
  ano: number;
  anos: number[];
  nivel: NivelExecucao;
  previsaoAprovada: boolean;
  periodo: PeriodoExecucao;
  /** Há alguma linha informada no ano. */
  temRealizado: boolean;
  despesa: Medida;
  /** null para a Coordenação (receita fora do escopo dela). */
  receita: Medida | null;
  resultado: Medida | null;
  /** 12 meses (só Diretoria e Financeiro); null = sem dado. */
  porMes: { mes: string; rotulo: string; informado: boolean; receita: number | null; despesa: number | null; receitaPrevista: number | null; despesaPrevista: number | null }[] | null;
  porServico: { servico: string; previsto: number; realizado: number }[];
  linhas: LinhaExecucao[];
  pendencias: { mesesSemDado: string[]; adiantamentosAcimaDoLimite: number };
  podeInformar: boolean;
}

const arred = (v: number) => Math.round(v * 100) / 100;
const anoDoMes = (mes: string) => Number(mes.slice(0, 4));
const doisDigitos = (n: number) => String(n).padStart(2, '0');

function nivelDe(quem: Autorizador): NivelExecucao {
  if (quem.temPermissao(PERM.editar) || quem.temPermissao(PERM.ver)) return 'completo';
  if (quem.temPermissaoAlgumEscopo(PERM.ver)) return 'escopo';
  if (quem.temPermissao(PERM.painel)) return 'totais';
  throw new ErroPermissao();
}

const veServico = (quem: Autorizador, nivel: NivelExecucao, codigo: string | null) =>
  nivel === 'completo' || nivel === 'totais' || (nivel === 'escopo' && !!codigo && quem.temPermissao(PERM.ver, { tipo: 'servico', codigo }));

interface Base {
  nivel: NivelExecucao;
  anos: number[];
  /** Linhas do Realizado já filtradas pelo que a pessoa pode ver (R8). */
  visiveis: RegRealizado[];
  fonteUso: Map<string, 'livre' | 'restrita'>;
  fonteNome: Map<string, string>;
  grupoNome: Map<string, string>;
  servicoNome: (codigo: string | null) => string;
  areaDe: (codigo: string | null) => string;
  /** Previsto por mês (12) de cada combinação, do ano pedido; vazio sem Previsão aprovada. */
  previsto: { tipo: 'despesa' | 'receita'; servico: string | null; grupoId: string | null; fonteId: string; meses: number[] }[];
  previsaoAprovada: boolean;
  todas: RegRealizado[];
}

async function carregar(p: Planilhas, quem: Autorizador, ano: number): Promise<Base> {
  const nivel = nivelDe(quem);
  const [exercicios, despesasT, receitasT, gruposT, fontesT, servicosT, areasT, ajustesT, realizadoT] = await lerTabelas(p, [
    Exercicios, Despesas, Receitas, GruposGasto, Fontes, Servicos, Areas, Ajustes, Realizado,
  ] as const);
  const todas = realizadoT.ativos();
  const visiveis = todas.filter((r) => (r.tipo === 'despesa' ? veServico(quem, nivel, r.servico) : nivel !== 'escopo'));
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  const previsaoAprovada = !!ex && ex.situacao !== 'elaboracao';
  const servico = new Map(servicosT.todos().map((s) => [s.codigo, s]));
  const area = new Map(areasT.todos().map((a) => [a.codigo, a.nome]));
  const previsto: Base['previsto'] = [];
  if (previsaoAprovada) {
    const deltas = deltasDosAjustes(ajustesT.ativos().filter((a) => a.ano === ano && a.situacao === 'aprovado'));
    const meses = (r: object, id: string) =>
      mesesComAjuste(Array.from({ length: 12 }, (_, i) => Number((r as Record<string, unknown>)[`m${i + 1}`] ?? 0) || 0), deltas.get(id));
    for (const d of despesasT.ativos().filter((x) => x.ano === ano && x.situacao === 'aceito' && x.fonte_id)) {
      if (!veServico(quem, nivel, d.servico)) continue;
      previsto.push({ tipo: 'despesa', servico: d.servico, grupoId: d.grupo_id, fonteId: d.fonte_id!, meses: meses(d, d.id) });
    }
    if (nivel !== 'escopo') {
      for (const r of receitasT.ativos().filter((x) => x.ano === ano)) previsto.push({ tipo: 'receita', servico: null, grupoId: null, fonteId: r.fonte_id, meses: meses(r, r.id) });
    }
  }
  const nomeArea = (c: string | null) => {
    const a = c ? servico.get(c)?.area : null;
    return a ? (area.get(a) ?? a) : 'Sem área';
  };
  return {
    nivel,
    anos: [...new Set([...todas.map((r) => r.ano), anoDoMes(mesAtualBrasilia())])].sort(),
    visiveis,
    fonteUso: new Map(fontesT.todos().map((f) => [f.id, f.uso])),
    fonteNome: new Map(fontesT.todos().map((f) => [f.id, f.nome])),
    grupoNome: new Map(gruposT.todos().map((g) => [g.id, g.nome])),
    servicoNome: (c) => (c ? (servico.get(c)?.nome ?? c) : SERVICO_COMUM),
    areaDe: nomeArea,
    previsto,
    previsaoAprovada,
    todas,
  };
}

/** Ano pedido (de 2000 a 2100); qualquer outra coisa vale o ano atual. */
const anoPedido = (pedido?: number) => (pedido && Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : anoDoMes(mesAtualBrasilia()));

const mesesInformados = (linhas: RegRealizado[], ano: number) => new Set(linhas.filter((r) => r.ano === ano).map((r) => r.mes));

const previstoNoPeriodo = (m: number[], contam: string[]) => somar(contam.map((x) => m[Number(x.slice(5)) - 1] ?? 0));

const medida = (realizado: number, previsto: number | null): Medida => ({ realizado, previsto, execucao: previsto === null ? null : execucaoPercentual(realizado, previsto) });

// ---------------------------------------------------------------------------
// Painel de execução
// ---------------------------------------------------------------------------

export async function lerPainelExecucao(p: Planilhas, quem: Autorizador, pedido: { ano?: number; mes?: string | null } = {}, hoje?: string): Promise<PainelExecucao> {
  const ano = anoPedido(pedido.ano);
  const b = await carregar(p, quem, ano);
  const informados = mesesInformados(b.visiveis, ano);
  const periodo = periodoDaExecucao(ano, informados, pedido.mes);
  const contam = new Set(periodo.contam);
  const doPeriodo = b.visiveis.filter((r) => r.ano === ano && contam.has(r.mes));
  const soma = (tipo: 'despesa' | 'receita') => somar(doPeriodo.filter((r) => r.tipo === tipo).map((r) => r.valor));
  const prev = (tipo: 'despesa' | 'receita') => (b.previsaoAprovada ? somar(b.previsto.filter((x) => x.tipo === tipo).map((x) => previstoNoPeriodo(x.meses, periodo.contam))) : null);

  const despesa = medida(soma('despesa'), prev('despesa'));
  const receita = b.nivel === 'escopo' ? null : medida(soma('receita'), prev('receita'));
  const resultado = receita
    ? medida(arred(receita.realizado - despesa.realizado), receita.previsto === null || despesa.previsto === null ? null : arred(receita.previsto - despesa.previsto))
    : null;

  let porMes: PainelExecucao['porMes'] = null;
  let linhas: LinhaExecucao[] = [];
  let porServico: PainelExecucao['porServico'] = [];
  if (b.nivel !== 'totais') {
    if (b.nivel === 'completo') {
      porMes = Array.from({ length: 12 }, (_, i) => {
        const mes = `${ano}-${doisDigitos(i + 1)}`;
        const doMes = b.visiveis.filter((r) => r.mes === mes);
        const informado = doMes.length > 0;
        const prevMes = (tipo: 'despesa' | 'receita') => (b.previsaoAprovada ? somar(b.previsto.filter((x) => x.tipo === tipo).map((x) => x.meses[i] ?? 0)) : null);
        return {
          mes,
          rotulo: NOMES_MESES[i],
          informado,
          receita: informado ? somar(doMes.filter((r) => r.tipo === 'receita').map((r) => r.valor)) : null,
          despesa: informado ? somar(doMes.filter((r) => r.tipo === 'despesa').map((r) => r.valor)) : null,
          receitaPrevista: prevMes('receita'),
          despesaPrevista: prevMes('despesa'),
        };
      });
    }
    const mapa = new Map<string, LinhaExecucao>();
    const linhaDe = (tipo: 'despesa' | 'receita', servico: string | null, grupoId: string | null, fonteId: string) => {
      const chave = [tipo, servico ?? '', grupoId ?? '', fonteId].join('|');
      let l = mapa.get(chave);
      if (!l) {
        l = {
          area: tipo === 'despesa' ? b.areaDe(servico) : '—',
          servico: tipo === 'despesa' ? b.servicoNome(servico) : 'Receita',
          grupo: grupoId ? (b.grupoNome.get(grupoId) ?? '?') : '—',
          fonte: b.fonteNome.get(fonteId) ?? '?',
          tipo,
          previsto: 0,
          realizado: 0,
          foraDaPrevisao: true,
        };
        mapa.set(chave, l);
      }
      return l;
    };
    for (const x of b.previsto) {
      const l = linhaDe(x.tipo, x.servico, x.grupoId, x.fonteId);
      l.previsto = arred(l.previsto + previstoNoPeriodo(x.meses, periodo.contam));
      l.foraDaPrevisao = false;
    }
    for (const r of doPeriodo) {
      const l = linhaDe(r.tipo, r.servico, r.grupo_id, r.fonte_id);
      l.realizado = arred(l.realizado + r.valor);
    }
    linhas = [...mapa.values()]
      .filter((l) => l.previsto !== 0 || l.realizado !== 0)
      .map((l) => ({ ...l, foraDaPrevisao: b.previsaoAprovada && l.foraDaPrevisao }))
      .sort((a, c) => a.tipo.localeCompare(c.tipo) || a.area.localeCompare(c.area, 'pt-BR') || a.servico.localeCompare(c.servico, 'pt-BR'));
    const porNome = new Map<string, { servico: string; previsto: number; realizado: number }>();
    for (const l of linhas.filter((x) => x.tipo === 'despesa')) {
      const s = porNome.get(l.servico) ?? { servico: l.servico, previsto: 0, realizado: 0 };
      s.previsto = arred(s.previsto + l.previsto);
      s.realizado = arred(s.realizado + l.realizado);
      porNome.set(l.servico, s);
    }
    porServico = [...porNome.values()].sort((a, c) => c.realizado - a.realizado);
  }

  const adiantamentos = b.nivel === 'completo' ? calcularAdiantamentos(b, hoje ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)) : null;
  return {
    ano,
    anos: b.anos,
    nivel: b.nivel,
    previsaoAprovada: b.previsaoAprovada,
    periodo,
    temRealizado: informados.size > 0,
    despesa,
    receita,
    resultado,
    porMes,
    porServico,
    linhas,
    pendencias: { mesesSemDado: periodo.semDado, adiantamentosAcimaDoLimite: adiantamentos?.termos.filter((t) => t.atencao).length ?? 0 },
    podeInformar: quem.temPermissao(PERM.editar),
  };
}

// ---------------------------------------------------------------------------
// Adiantamentos e ressarcimentos (R5)
// ---------------------------------------------------------------------------

export interface TermoAdiantado {
  /** Id da fonte restrita (termo), ou null em "Termo não informado". */
  termoId: string | null;
  nome: string;
  adiantado: number;
  ressarcido: number;
  emAberto: number;
  ressarcidoAMais: boolean;
  maisAntigoMes: string | null;
  dias: number | null;
  atencao: boolean;
}

function calcularAdiantamentos(b: Base, hoje: string): { termos: TermoAdiantado[]; totalEmAberto: number } {
  const adiantos = b.todas.filter((r) => r.tipo === 'despesa' && r.natureza === 'adiantamento_termo');
  const ressarcimentos = b.todas.filter((r) => r.tipo === 'receita' && r.natureza === 'ressarcimento');
  const ids = new Set<string>([...adiantos.map((r) => r.fonte_termo_id).filter((x): x is string => !!x), ...ressarcimentos.map((r) => r.fonte_id)]);
  const termos: TermoAdiantado[] = [...ids].map((id) => {
    const s = saldoDoTermo(
      adiantos.filter((r) => r.fonte_termo_id === id).map((r) => ({ mes: r.mes, valor: r.valor })),
      somar(ressarcimentos.filter((r) => r.fonte_id === id).map((r) => r.valor)),
    );
    const dias = s.maisAntigoMes ? diasEmAberto(s.maisAntigoMes, hoje) : null;
    return { termoId: id, nome: b.fonteNome.get(id) ?? '?', ...s, dias, atencao: dias !== null && adiantamentoEmAtencao(dias) };
  });
  termos.sort((a, c) => c.emAberto - a.emAberto || a.nome.localeCompare(c.nome, 'pt-BR'));
  const semTermo = adiantos.filter((r) => !r.fonte_termo_id);
  if (semTermo.length) {
    const valor = somar(semTermo.map((r) => r.valor));
    const antigo = semTermo.map((r) => r.mes).sort()[0];
    const dias = diasEmAberto(antigo, hoje);
    termos.push({ termoId: null, nome: 'Termo não informado — complete na grade do mês', adiantado: valor, ressarcido: 0, emAberto: valor, ressarcidoAMais: false, maisAntigoMes: antigo, dias, atencao: adiantamentoEmAtencao(dias) });
  }
  return { termos, totalEmAberto: somar(termos.filter((t) => t.emAberto > 0).map((t) => t.emAberto)) };
}

// ---------------------------------------------------------------------------
// Recursos livres
// ---------------------------------------------------------------------------

export interface ComparacaoAnos {
  anoAtual: number;
  anoAnterior: number;
  /** Meses (1 a 12) informados nos dois anos. */
  mesesComparados: number[];
  /** Sem nenhum mês informado no ano anterior. */
  semAnoAnterior: boolean;
  /** Ano atual ainda sem os 12 meses. */
  parcial: boolean;
  /** Receita e despesa livres dos meses comparados, com e sem não recorrentes (só Diretoria e Financeiro têm receita). */
  todos: { receitaAtual: number | null; receitaAnterior: number | null; despesaAtual: number; despesaAnterior: number };
  semNaoRecorrentes: { receitaAtual: number | null; receitaAnterior: number | null; despesaAtual: number; despesaAnterior: number };
  variacaoDespesa: { todos: number | null; sem: number | null };
  variacaoReceita: { todos: number | null; sem: number | null } | null;
  /** Peso da despesa livre sobre a receita livre, em %, e a diferença em pontos. */
  pesoAtual: number | null;
  pesoAnterior: number | null;
  /** Linha à parte: meses que ficaram fora (informados só em um dos anos) e não recorrentes retirados. */
  mesesFora: number[];
  naoRecorrentes: { descricao: string; valor: number }[];
}

export interface RecursosLivres {
  ano: number;
  anos: number[];
  nivel: NivelExecucao;
  periodo: PeriodoExecucao;
  temRealizado: boolean;
  /** null para a Coordenação. */
  receitaLivre: number | null;
  despesaLivre: number;
  resultado: number | null;
  porMes: { rotulo: string; informado: boolean; receita: number | null; despesa: number | null }[];
  porServico: { servico: string; total: number; peso: number | null; naturezas: Partial<Record<Natureza, number>>; naturezaDominante: string | null }[];
  naturezas: { codigo: Natureza; rotulo: string }[];
  comparacao: ComparacaoAnos | null;
  /** null para a Coordenação. */
  adiantamentos: { termos: TermoAdiantado[]; totalEmAberto: number; maisAntigoDias: number | null; termosEmAberto: number } | null;
}

const NATUREZAS_TABELA: Natureza[] = ['rh', 'encargos', 'custeio', 'investimento', 'tarifas', 'adiantamento_termo'];

export async function lerRecursosLivres(p: Planilhas, quem: Autorizador, pedido: { ano?: number } = {}, hoje?: string): Promise<RecursosLivres> {
  const nivel = nivelDe(quem);
  if (nivel === 'totais') throw new ErroPermissao();
  const ano = anoPedido(pedido.ano);
  const b = await carregar(p, quem, ano);
  const livre = (r: RegRealizado) => b.fonteUso.get(r.fonte_id) === 'livre';
  const informados = mesesInformados(b.visiveis, ano);
  const periodo = periodoDaExecucao(ano, informados);
  const contam = new Set(periodo.contam);
  const doPeriodo = b.visiveis.filter((r) => r.ano === ano && contam.has(r.mes));
  const despesas = doPeriodo.filter((r) => r.tipo === 'despesa' && livre(r));
  const receitas = nivel === 'escopo' ? [] : doPeriodo.filter((r) => r.tipo === 'receita' && livre(r));
  const despesaLivre = somar(despesas.map((r) => r.valor));
  const receitaLivre = nivel === 'escopo' ? null : somar(receitas.map((r) => r.valor));

  const porMes = Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${doisDigitos(i + 1)}`;
    const informado = informados.has(mes);
    const doMes = b.visiveis.filter((r) => r.mes === mes && livre(r));
    return {
      rotulo: NOMES_MESES[i],
      informado,
      receita: informado && nivel !== 'escopo' ? somar(doMes.filter((r) => r.tipo === 'receita').map((r) => r.valor)) : null,
      despesa: informado ? somar(doMes.filter((r) => r.tipo === 'despesa').map((r) => r.valor)) : null,
    };
  });

  const serv = new Map<string, Partial<Record<Natureza, number>>>();
  for (const r of despesas) {
    const nome = b.servicoNome(r.servico);
    const nat = serv.get(nome) ?? {};
    nat[r.natureza] = somar([nat[r.natureza] ?? 0, r.valor]);
    serv.set(nome, nat);
  }
  const porServico = [...serv.entries()]
    .map(([servico, naturezas]) => {
      const total = somar(Object.values(naturezas) as number[]);
      const dominante = (Object.entries(naturezas) as [Natureza, number][]).sort((a, c) => c[1] - a[1])[0];
      return { servico, total, peso: despesaLivre ? Math.round((total / despesaLivre) * 1000) / 10 : null, naturezas, naturezaDominante: dominante ? ROTULO_NATUREZA[dominante[0]] : null };
    })
    .sort((a, c) => c.total - a.total);

  const comparacao = comparar(b, nivel, ano, livre);
  const adiant = nivel === 'completo' ? calcularAdiantamentos(b, hoje ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)) : null;
  const abertos = adiant?.termos.filter((t) => t.emAberto > 0) ?? [];
  return {
    ano,
    anos: b.anos,
    nivel,
    periodo,
    temRealizado: informados.size > 0,
    receitaLivre,
    despesaLivre,
    resultado: receitaLivre === null ? null : arred(receitaLivre - despesaLivre),
    porMes,
    porServico,
    naturezas: NATUREZAS_TABELA.map((codigo) => ({ codigo, rotulo: ROTULO_NATUREZA[codigo] })),
    comparacao,
    adiantamentos: adiant
      ? { ...adiant, termosEmAberto: abertos.length, maisAntigoDias: abertos.reduce<number | null>((m, t) => (t.dias !== null && (m === null || t.dias > m) ? t.dias : m), null) }
      : null,
  };
}

/** R6: só os meses informados nos dois anos; o resto sai da comparação. */
function comparar(b: Base, nivel: NivelExecucao, ano: number, livre: (r: RegRealizado) => boolean): ComparacaoAnos {
  const anterior = ano - 1;
  const informadosAtual = mesesInformados(b.visiveis, ano);
  const informadosAnt = mesesInformados(b.visiveis, anterior);
  const nums = (s: Set<string>, a: number) => new Set([...s].filter((m) => m.startsWith(`${a}-`)).map((m) => Number(m.slice(5))));
  const nA = nums(informadosAtual, ano);
  const nB = nums(informadosAnt, anterior);
  const mapaAtual: Record<string, number | null> = {};
  const mapaAnt: Record<string, number | null> = {};
  for (const n of nA) mapaAtual[doisDigitos(n)] = 0;
  for (const n of nB) mapaAnt[doisDigitos(n)] = 0;
  const comuns = mesesComparaveis(mapaAtual, mapaAnt).filter((m) => m.atual !== null).map((m) => m.mes);
  const mesesFora = [...new Set([...nA, ...nB])].filter((m) => !comuns.includes(m)).sort((x, y) => x - y);
  const soma = (a: number, tipo: 'despesa' | 'receita', semNr: boolean) =>
    somar(b.visiveis.filter((r) => r.ano === a && r.tipo === tipo && livre(r) && comuns.includes(Number(r.mes.slice(5))) && !(semNr && r.nao_recorrente)).map((r) => r.valor));
  const temReceita = nivel !== 'escopo';
  const bloco = (semNr: boolean) => ({
    receitaAtual: temReceita ? soma(ano, 'receita', semNr) : null,
    receitaAnterior: temReceita ? soma(anterior, 'receita', semNr) : null,
    despesaAtual: soma(ano, 'despesa', semNr),
    despesaAnterior: soma(anterior, 'despesa', semNr),
  });
  const todos = bloco(false);
  const sem = bloco(true);
  const peso = (d: number, r: number | null) => (r ? Math.round((d / r) * 1000) / 10 : null);
  return {
    anoAtual: ano,
    anoAnterior: anterior,
    mesesComparados: comuns,
    semAnoAnterior: nB.size === 0,
    parcial: nA.size < 12,
    todos,
    semNaoRecorrentes: sem,
    variacaoDespesa: { todos: variacaoPercentual(todos.despesaAtual, todos.despesaAnterior), sem: variacaoPercentual(sem.despesaAtual, sem.despesaAnterior) },
    variacaoReceita: temReceita ? { todos: variacaoPercentual(todos.receitaAtual ?? 0, todos.receitaAnterior ?? 0), sem: variacaoPercentual(sem.receitaAtual ?? 0, sem.receitaAnterior ?? 0) } : null,
    pesoAtual: peso(todos.despesaAtual, todos.receitaAtual),
    pesoAnterior: peso(todos.despesaAnterior, todos.receitaAnterior),
    mesesFora,
    naoRecorrentes: b.visiveis
      .filter((r) => (r.ano === ano || r.ano === anterior) && r.nao_recorrente && livre(r) && comuns.includes(Number(r.mes.slice(5))) && (temReceita || r.tipo === 'despesa'))
      .map((r) => ({ descricao: `${r.ano} · ${r.tipo === 'despesa' ? b.servicoNome(r.servico) : 'Receita'} · ${r.motivo_nao_recorrente ?? 'sem motivo'}`, valor: r.valor })),
  };
}
