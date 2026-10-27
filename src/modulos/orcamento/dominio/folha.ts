/**
 * Regras puras da Folha de Pagamento (sem acesso a planilhas).
 *
 * Valores em reais com centavos; percentuais com até duas casas.
 * Para não acumular erro de arredondamento, as contas de percentual usam
 * centésimos inteiros (100% = 10000).
 */

// ---------------------------------------------------------------------------
// Componentes do custo
// ---------------------------------------------------------------------------

/** Componentes mensais do custo de um posto, na ordem da planilha. */
export const COMPONENTES = [
  { chave: 'salario_base', nome: 'Salário base', remuneratorio: true },
  { chave: 'adicional', nome: 'Adicional', remuneratorio: true },
  { chave: 'hora_atividade', nome: 'Hora atividade', remuneratorio: true },
  { chave: 'insalubridade', nome: 'Insalubridade', remuneratorio: true },
  { chave: 'periculosidade', nome: 'Periculosidade', remuneratorio: true },
  { chave: 'gratificacao_funcao', nome: 'Gratificação de função', remuneratorio: true },
  { chave: 'ajuda_custo', nome: 'Ajuda de custo', remuneratorio: false },
  { chave: 'bolsa_estagio', nome: 'Bolsa estágio', remuneratorio: false },
  { chave: 'plano_saude', nome: 'Plano de saúde', remuneratorio: false },
  { chave: 'bolsa_estudo', nome: 'Bolsa estudo', remuneratorio: false },
  { chave: 'locomocao', nome: 'Locomoção', remuneratorio: false },
  { chave: 'alimentacao', nome: 'Alimentação', remuneratorio: false },
] as const;

export type ChaveComponente = (typeof COMPONENTES)[number]['chave'];
export type Componentes = Record<ChaveComponente, number>;

export const componentesZerados = (): Componentes =>
  Object.fromEntries(COMPONENTES.map((c) => [c.chave, 0])) as Componentes;

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

/**
 * Provisões e encargos, em % sobre a base remuneratória (salário base,
 * adicional, hora atividade, insalubridade, periculosidade e gratificação).
 * Os benefícios (ajuda de custo, bolsas, plano de saúde, locomoção,
 * alimentação) não entram na base.
 */
export const PARAMETROS = [
  { chave: 'ano', nome: 'Ano da folha', padrao: 2027, provisao: false },
  { chave: 'ferias', nome: 'Provisão de férias (%)', padrao: 8.33, provisao: true },
  { chave: 'terco_ferias', nome: 'Provisão de 1/3 de férias (%)', padrao: 2.78, provisao: true },
  { chave: 'decimo_terceiro', nome: 'Provisão de 13º salário (%)', padrao: 8.33, provisao: true },
  { chave: 'abono', nome: 'Provisão de abono (%)', padrao: 0, provisao: true },
  { chave: 'fgts', nome: 'FGTS (%)', padrao: 8, provisao: true },
  { chave: 'indenizacoes', nome: 'Provisão de indenizações (%)', padrao: 0, provisao: true },
  { chave: 'reajuste_percentual', nome: 'Reajuste salarial (%)', padrao: 0, provisao: false },
  { chave: 'reajuste_mes', nome: 'Mês do reajuste (1 a 12)', padrao: 1, provisao: false },
] as const;

export type ChaveParametro = (typeof PARAMETROS)[number]['chave'];
export type Parametros = Record<ChaveParametro, number>;

export function parametrosCom(valores: Partial<Record<string, number>>): Parametros {
  return Object.fromEntries(PARAMETROS.map((p) => [p.chave, valores[p.chave] ?? p.padrao])) as Parametros;
}

export function validarParametros(p: Parametros): string[] {
  const erros: string[] = [];
  if (!Number.isInteger(p.ano) || p.ano < 2020 || p.ano > 2100) erros.push('Ano inválido.');
  if (!Number.isInteger(p.reajuste_mes) || p.reajuste_mes < 1 || p.reajuste_mes > 12) erros.push('Mês do reajuste deve ser de 1 a 12.');
  for (const d of PARAMETROS.filter((x) => x.provisao || x.chave === 'reajuste_percentual')) {
    const v = p[d.chave];
    if (!Number.isFinite(v) || v < 0 || v > 100) erros.push(`${d.nome}: use um número entre 0 e 100.`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Custo do posto
// ---------------------------------------------------------------------------

export const centavos = (v: number) => Math.round(v * 100) / 100;

export interface CustoMensal {
  remuneracao: number;
  beneficios: number;
  provisoes: number;
  total: number;
}

/**
 * Custo de um posto em um mês (1 a 12): componentes + provisões e encargos.
 * A partir do mês do reajuste, a parte remuneratória é reajustada; benefícios não.
 */
export function custoMensal(c: Componentes, p: Parametros, mes: number): CustoMensal {
  const fator = p.reajuste_percentual > 0 && mes >= p.reajuste_mes ? 1 + p.reajuste_percentual / 100 : 1;
  let remuneracao = 0;
  let beneficios = 0;
  for (const def of COMPONENTES) {
    const v = c[def.chave] ?? 0;
    if (def.remuneratorio) remuneracao += v * fator;
    else beneficios += v;
  }
  const percentual = PARAMETROS.filter((x) => x.provisao).reduce((s, x) => s + p[x.chave], 0);
  const provisoes = (remuneracao * percentual) / 100;
  return {
    remuneracao: centavos(remuneracao),
    beneficios: centavos(beneficios),
    provisoes: centavos(provisoes),
    total: centavos(remuneracao + beneficios + provisoes),
  };
}

/** Salário pela tabela: valor do cargo no nível, proporcional à carga horária. */
export function salarioPelaTabela(valorTabela: number, cargaHoraria: number | null, cargaReferencia: number | null): number {
  if (!cargaHoraria || !cargaReferencia) return centavos(valorTabela);
  return centavos((valorTabela * cargaHoraria) / cargaReferencia);
}

// ---------------------------------------------------------------------------
// Período em que o posto custa
// ---------------------------------------------------------------------------

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
const primeiroDia = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`;

/** O posto conta no mês se começou até o fim do mês e não saiu antes do início dele. */
export function ativoNoMes(posto: { inicio: string; desligamento: string | null }, ano: number, mes: number): boolean {
  return posto.inicio <= ultimoDia(ano, mes) && (!posto.desligamento || posto.desligamento >= primeiroDia(ano, mes));
}

/** Entre vários registros com vigência, o que vale no mês (o mais recente que já começou). */
export function vigenteNoMes<T extends { vigencia: string; criado_em: string }>(lista: T[], ano: number, mes: number): T | undefined {
  const limite = ultimoDia(ano, mes);
  return lista
    .filter((x) => x.vigencia <= limite)
    .sort((a, b) => (a.vigencia === b.vigencia ? a.criado_em.localeCompare(b.criado_em) : a.vigencia.localeCompare(b.vigencia)))
    .at(-1);
}

// ---------------------------------------------------------------------------
// Rateio por centro de custo
// ---------------------------------------------------------------------------

export interface LinhaRateio {
  centro: string;
  percentual: number;
}

const paraCentesimos = (v: number) => Math.round(v * 100);

/** Problemas que impedem salvar um rateio. Lista vazia = pode salvar. */
export function validarRateio(linhas: LinhaRateio[]): string[] {
  const erros: string[] = [];
  if (linhas.length === 0) erros.push('Informe pelo menos um centro de custo.');
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (!l.centro) erros.push('Escolha o centro de custo em todas as linhas.');
    else if (vistos.has(l.centro)) erros.push(`O centro de custo "${l.centro}" aparece mais de uma vez.`);
    vistos.add(l.centro);
    if (!Number.isFinite(l.percentual) || l.percentual <= 0 || l.percentual > 100) {
      erros.push('Cada percentual deve ser maior que 0 e no máximo 100.');
    } else if (Math.abs(l.percentual * 100 - paraCentesimos(l.percentual)) > 1e-6) {
      erros.push('Use no máximo duas casas decimais nos percentuais.');
    }
  }
  const soma = somaRateio(linhas);
  if (linhas.length > 0 && soma !== 100) erros.push(`O rateio soma ${formatarPercentual(soma)}; precisa somar exatamente 100%.`);
  return [...new Set(erros)];
}

export function somaRateio(linhas: LinhaRateio[]): number {
  return linhas.reduce((s, l) => s + paraCentesimos(Number.isFinite(l.percentual) ? l.percentual : 0), 0) / 100;
}

/** Divide 100% igualmente; a última linha recebe a sobra (ex.: 33,33 + 33,33 + 33,34). */
export function dividirIgualmente(centros: string[]): LinhaRateio[] {
  if (centros.length === 0) return [];
  const parte = Math.floor(10000 / centros.length);
  return centros.map((centro, i) => ({
    centro,
    percentual: (i === centros.length - 1 ? 10000 - parte * (centros.length - 1) : parte) / 100,
  }));
}

/** Situação do rateio de um posto, para os atalhos da lista. */
export function situacaoRateio(linhas: LinhaRateio[] | undefined): 'sem_rateio' | 'fora_de_100' | 'ok' {
  if (!linhas || linhas.length === 0) return 'sem_rateio';
  return somaRateio(linhas) === 100 ? 'ok' : 'fora_de_100';
}

/**
 * Divide um valor entre os centros pelo rateio, em centavos, sem perder nem
 * criar centavos: a sobra do arredondamento fica no centro de maior percentual.
 */
export function distribuir(valor: number, linhas: LinhaRateio[]): Map<string, number> {
  const total = Math.round(valor * 100);
  const resultado = new Map<string, number>();
  let usado = 0;
  for (const l of linhas) {
    const parte = Math.floor((total * paraCentesimos(l.percentual)) / 10000);
    resultado.set(l.centro, parte);
    usado += parte;
  }
  const maior = [...linhas].sort((a, b) => b.percentual - a.percentual)[0];
  if (maior) resultado.set(maior.centro, resultado.get(maior.centro)! + (total - usado));
  return new Map([...resultado].map(([c, v]) => [c, v / 100]));
}

export function formatarPercentual(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

export function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
