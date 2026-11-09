/**
 * Regras puras do Histórico (Entrega 1E): leitura da aba de receitas de um ano
 * fechado, conferência do total em centavos e indicadores de 2017 até hoje.
 * Nada aqui lê ou grava dados.
 */
import { normalizar, paraNumero, type AbaImportada, type CelulaImportada } from './importacao';

const arred = (v: number) => Math.round(v * 100) / 100;
const arred1 = (v: number) => Math.round(v * 10) / 10;
const centavos = (v: number) => Math.round(v * 100);

/** Primeiro ano com dados históricos possíveis. */
export const PRIMEIRO_ANO = 2017;

/** Ano atual no horário de Brasília (UTC−3). */
export function anoAtualBrasilia(agora: Date = new Date()): number {
  return Number(new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 4));
}

// ---------------------------------------------------------------------------
// Leitura da planilha
// ---------------------------------------------------------------------------

export interface MapeamentoHistorico {
  aba: string;
  /** Linha do cabeçalho, contando de 1 como na planilha. */
  cabecalho: number;
  colunas: { descricao: number; valor: number };
}

const SIN_DESCRICAO = ['descricao', 'receita', 'receitas', 'item', 'origem', 'fonte', 'historico', 'discriminacao', 'especificacao'];
const SIN_VALOR = ['realizado', 'valor realizado', 'receita realizada', 'arrecadado', 'total realizado', 'executado'];

const textoDe = (v: CelulaImportada) => (v instanceof Date ? '' : String(v ?? '').trim().replace(/\s+/g, ' '));
const ehTotal = (t: string) => /^(total|subtotal|soma)\b/.test(normalizar(t));
/** A linha "Total das receitas" da planilha de origem. */
const ehTotalDasReceitas = (t: string) => /^total (geral )?(das |de )?receitas?\b/.test(normalizar(t)) || normalizar(t) === 'total';

function colunasSugeridas(cabecalho: CelulaImportada[]): Partial<MapeamentoHistorico['colunas']> {
  const cab = cabecalho.map(normalizar);
  const r: Partial<MapeamentoHistorico['colunas']> = {};
  const d = cab.findIndex((t) => t !== '' && SIN_DESCRICAO.includes(t));
  if (d >= 0) r.descricao = d;
  const v = cab.findIndex((t, k) => k !== d && t !== '' && SIN_VALOR.includes(t));
  if (v >= 0) r.valor = v;
  return r;
}

/** DE-PARA sugerido: a aba e a linha com mais títulos conhecidos. */
export function mapeamentoSugeridoHistorico(abas: AbaImportada[]): MapeamentoHistorico | null {
  let melhor: { aba: string; cabecalho: number; n: number; colunas: Partial<MapeamentoHistorico['colunas']> } | null = null;
  for (const a of abas) {
    const bonus = /realizado|receita|previsao/.test(normalizar(a.nome)) ? 1 : 0;
    a.linhas.slice(0, 15).forEach((l, i) => {
      const colunas = colunasSugeridas(l);
      const n = Object.keys(colunas).length + (Object.keys(colunas).length ? bonus : 0);
      if (n > (melhor?.n ?? 0)) melhor = { aba: a.nome, cabecalho: i + 1, n, colunas };
    });
  }
  const m = melhor as { aba: string; cabecalho: number; colunas: Partial<MapeamentoHistorico['colunas']> } | null;
  if (!m) {
    if (abas.length === 0) return null;
    return { aba: abas[0].nome, cabecalho: 1, colunas: { descricao: 0, valor: 1 } };
  }
  return { aba: m.aba, cabecalho: m.cabecalho, colunas: { descricao: m.colunas.descricao ?? 0, valor: m.colunas.valor ?? (m.colunas.descricao === 1 ? 2 : 1) } };
}

export function conferirMapeamentoHistorico(abas: AbaImportada[], m: MapeamentoHistorico): string[] {
  const aba = abas.find((a) => a.nome === m.aba);
  if (!aba) return [`A aba "${m.aba}" não existe no arquivo.`];
  const erros: string[] = [];
  if (!Number.isInteger(m.cabecalho) || m.cabecalho < 1 || m.cabecalho > aba.linhas.length) erros.push('Escolha a linha do cabeçalho.');
  if (!Number.isInteger(m.colunas.descricao) || m.colunas.descricao < 0) erros.push('Escolha a coluna da descrição da receita.');
  if (!Number.isInteger(m.colunas.valor) || m.colunas.valor < 0) erros.push('Escolha a coluna do valor realizado.');
  if (erros.length === 0 && m.colunas.descricao === m.colunas.valor) erros.push('A descrição e o valor não podem ser a mesma coluna.');
  return erros;
}

export interface LinhaReceitaLida {
  /** Linha na planilha (de 1 em diante). */
  linha: number;
  descricao: string;
  valor: number;
}

export interface LeituraHistorico {
  linhas: LinhaReceitaLida[];
  /** Valor da linha "Total das receitas" da planilha (null = não encontrada). */
  totalPlanilha: number | null;
  problemas: { linha: number; descricao: string; problema: string }[];
}

/** Lê as linhas de receita realizada. Linhas em branco, de subtotal e de valor zero são puladas. */
export function lerReceitasHistorico(abas: AbaImportada[], m: MapeamentoHistorico): LeituraHistorico {
  const aba = abas.find((a) => a.nome === m.aba)!;
  const r: LeituraHistorico = { linhas: [], totalPlanilha: null, problemas: [] };
  aba.linhas.slice(m.cabecalho).forEach((linha, k) => {
    const numero = m.cabecalho + k + 1;
    const descricao = textoDe(linha[m.colunas.descricao]);
    const bruto = linha[m.colunas.valor];
    const valor = paraNumero(bruto);
    if (!descricao && (valor === null || valor === 0)) return;
    if (ehTotalDasReceitas(descricao)) {
      if (valor !== null) r.totalPlanilha = arred(valor);
      return;
    }
    if (ehTotal(descricao)) return;
    if (!descricao) return void r.problemas.push({ linha: numero, descricao, problema: 'Falta a descrição.' });
    if (valor === null) {
      if (textoDe(bruto)) r.problemas.push({ linha: numero, descricao, problema: 'Valor não reconhecido.' });
      return;
    }
    if (valor === 0) return;
    if (valor < 0) return void r.problemas.push({ linha: numero, descricao, problema: 'Valor negativo.' });
    r.linhas.push({ linha: numero, descricao, valor: arred(valor) });
  });
  return r;
}

/** Soma das linhas, em centavos exatos. */
export const somaReceitas = (linhas: { valor: number }[]) => arred(linhas.reduce((s, l) => s + centavos(l.valor), 0) / 100);

/** Regra 24: o total importado tem de bater, em centavos, com o total da planilha. Mensagem vazia = confere. */
export function conferirTotal(linhas: { valor: number }[], totalPlanilha: number | null): string {
  if (totalPlanilha === null || !Number.isFinite(totalPlanilha)) return 'Informe o "Total das receitas" da planilha de origem para conferir.';
  const dif = centavos(somaReceitas(linhas)) - centavos(totalPlanilha);
  if (dif === 0) return '';
  const f = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `O total das linhas (${f(somaReceitas(linhas))}) não bate com o total da planilha (${f(totalPlanilha)}): diferença de ${f(Math.abs(dif) / 100)}. Nada foi gravado.`;
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export interface ReceitaDeFonte {
  fonteId: string;
  nome: string;
  natureza: 'publica' | 'propria';
  valor: number;
}

export interface AnoHistorico {
  ano: number;
  receita: number;
  despesa: number;
  folha: number;
  /** Saldo livre em 1º de janeiro (null = não informado). */
  saldoLivreInicial: number | null;
  porFonte: ReceitaDeFonte[];
}

export interface IndicadoresAno {
  ano: number;
  /** Ano em andamento (ou futuro): fica fora dos cálculos de crescimento. */
  parcial: boolean;
  receita: number;
  despesa: number;
  resultado: number;
  /** Resultado ÷ receita, em %. */
  margem: number | null;
  folhaSobreReceita: number | null;
  crescimentoReceita: number | null;
  crescimentoFolha: number | null;
  /** Saldo livre no fim do ano = saldo livre de 1º de janeiro do ano seguinte. */
  saldoLivreFim: number | null;
  variacaoSaldoLivre: number | null;
  /** Saldo livre no fim do ano ÷ despesa média mensal do ano (em meses). */
  coberturaSaldoLivre: number | null;
  /** Receita de fontes de natureza própria ÷ receita total, em %. */
  pesoRecursosProprios: number | null;
}

const razao = (a: number, b: number) => (b > 0 ? arred1((a / b) * 100) : null);

/** Calcula os indicadores de cada ano, do mais antigo para o mais novo. */
export function calcularIndicadores(anos: AnoHistorico[], anoAtual: number): IndicadoresAno[] {
  const ordenados = [...anos].sort((a, b) => a.ano - b.ano);
  const porAno = new Map(ordenados.map((a) => [a.ano, a]));
  return ordenados.map((a) => {
    const parcial = a.ano >= anoAtual;
    const ant = porAno.get(a.ano - 1);
    const completos = !parcial && ant !== undefined && ant.ano < anoAtual;
    const proximo = porAno.get(a.ano + 1);
    const fim = proximo?.saldoLivreInicial ?? null;
    const cresce = (atual: number, antes: number) => (completos && antes > 0 ? arred1(((atual - antes) / antes) * 100) : null);
    const propria = arred(a.porFonte.filter((f) => f.natureza === 'propria').reduce((s, f) => s + centavos(f.valor), 0) / 100);
    return {
      ano: a.ano,
      parcial,
      receita: a.receita,
      despesa: a.despesa,
      resultado: arred(a.receita - a.despesa),
      margem: razao(a.receita - a.despesa, a.receita),
      folhaSobreReceita: razao(a.folha, a.receita),
      crescimentoReceita: ant ? cresce(a.receita, ant.receita) : null,
      crescimentoFolha: ant ? cresce(a.folha, ant.folha) : null,
      saldoLivreFim: fim,
      variacaoSaldoLivre: fim !== null && a.saldoLivreInicial !== null ? arred(fim - a.saldoLivreInicial) : null,
      coberturaSaldoLivre: fim !== null && a.despesa > 0 ? arred1(fim / (a.despesa / 12)) : null,
      pesoRecursosProprios: razao(propria, a.receita),
    };
  });
}

export interface LinhaFonteHistorico {
  fonteId: string;
  nome: string;
  natureza: 'publica' | 'propria';
  /** Receita por ano (0 onde não houve). */
  porAno: Record<number, number>;
  /** Peso no último ano completo, em %. */
  peso: number | null;
  /** Variação da receita do último ano completo sobre o anterior (em %; null sem base). */
  variacao: number | null;
}

/** Receita por fonte ano a ano, com o peso e a variação do último ano completo. */
export function fontesPorAno(anos: AnoHistorico[], anoAtual: number): { anos: number[]; ultimoCompleto: number | null; linhas: LinhaFonteHistorico[]; publicaPropria: { ano: number; publica: number; propria: number }[] } {
  const ordenados = [...anos].sort((a, b) => a.ano - b.ano);
  const completos = ordenados.filter((a) => a.ano < anoAtual);
  const ultimo = completos.at(-1);
  const anterior = ultimo ? completos.find((a) => a.ano === ultimo.ano - 1) : undefined;
  const mapa = new Map<string, LinhaFonteHistorico>();
  for (const a of ordenados) {
    for (const f of a.porFonte) {
      const l = mapa.get(f.fonteId) ?? { fonteId: f.fonteId, nome: f.nome, natureza: f.natureza, porAno: {}, peso: null, variacao: null };
      l.porAno[a.ano] = arred((l.porAno[a.ano] ?? 0) + f.valor);
      mapa.set(f.fonteId, l);
    }
  }
  for (const l of mapa.values()) {
    if (ultimo) {
      l.peso = razao(l.porAno[ultimo.ano] ?? 0, ultimo.receita);
      const antes = anterior ? (l.porAno[anterior.ano] ?? 0) : 0;
      l.variacao = anterior && antes > 0 ? arred1((((l.porAno[ultimo.ano] ?? 0) - antes) / antes) * 100) : null;
    }
  }
  const soma = (a: AnoHistorico, n: 'publica' | 'propria') => arred(a.porFonte.filter((f) => f.natureza === n).reduce((s, f) => s + centavos(f.valor), 0) / 100);
  return {
    anos: ordenados.map((a) => a.ano),
    ultimoCompleto: ultimo?.ano ?? null,
    linhas: [...mapa.values()].sort((x, y) => (ultimo ? (y.porAno[ultimo.ano] ?? 0) - (x.porAno[ultimo.ano] ?? 0) : 0) || x.nome.localeCompare(y.nome, 'pt-BR')),
    publicaPropria: ordenados.map((a) => ({ ano: a.ano, publica: soma(a, 'publica'), propria: soma(a, 'propria') })),
  };
}
