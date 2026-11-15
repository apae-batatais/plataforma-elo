/**
 * Regras puras da Folha de Pagamento, no formato da aba "Estudo" da planilha
 * "Folha Pagamento 2027". Nenhuma fórmula fica na planilha: o app calcula.
 *
 * Valores mensais em reais com centavos; percentuais com até duas casas.
 * Contas de percentual de lotação usam centésimos inteiros (100% = 10000).
 */
import { validarParametrosPassivo } from './passivo';

// ---------------------------------------------------------------------------
// Campos digitados (valores mensais em R$), na ordem da aba Estudo
// ---------------------------------------------------------------------------

export const COMPONENTES = [
  { chave: 'salario_atual', nome: 'Salário atual', coluna: 'Salario Atual' },
  { chave: 'adicional_salarial', nome: 'Adicional salarial', coluna: 'Adicional Salarial' },
  { chave: 'ajuda_custo', nome: 'Ajuda de custo', coluna: 'Ajuda de Custo' },
  { chave: 'bolsa_estagio', nome: 'Bolsa estágio', coluna: 'Bolsa Estágio' },
  { chave: 'insalubridade', nome: 'Insalubridade', coluna: 'Insalubridade' },
  { chave: 'periculosidade', nome: 'Periculosidade', coluna: 'Periculosidade' },
  { chave: 'gratificacao_funcao', nome: 'Gratificação de função', coluna: 'G. Função' },
  { chave: 'plano_saude', nome: 'Plano de saúde', coluna: 'Plano de Saúde' },
  { chave: 'bolsa_estudo', nome: 'Bolsa estudo', coluna: 'Bolsa Estudo' },
  { chave: 'locomocao', nome: 'Locomoção', coluna: 'Locomoção' },
  { chave: 'alimentacao', nome: 'Alimentação', coluna: 'Alimentação' },
  { chave: 'ferias', nome: 'Férias', coluna: 'FÉRIAS' },
  { chave: 'abono', nome: 'Abono', coluna: 'ABONO' },
  { chave: 'indenizacoes', nome: 'Indenizações', coluna: 'INDEZ.' },
] as const;

export type ChaveComponente = (typeof COMPONENTES)[number]['chave'];

/** O que se digita para cada funcionário, além dos dados de identificação. */
export type Componentes = Record<ChaveComponente, number> & {
  /** Reajuste do funcionário, em % (na planilha, 5%). */
  reajuste: number;
  /** Recebe hora atividade (professores)? */
  hora_atividade: boolean;
};

export const componentesZerados = (reajuste = 0): Componentes =>
  ({ ...Object.fromEntries(COMPONENTES.map((c) => [c.chave, 0])), reajuste, hora_atividade: false }) as Componentes;


// ---------------------------------------------------------------------------
// Parâmetros (definidos pelo Financeiro)
// ---------------------------------------------------------------------------

export const PARAMETROS = [
  { chave: 'ano', nome: 'Ano da folha', padrao: 2027, grupo: 'geral' },
  { chave: 'reajuste_padrao', nome: 'Reajuste para novos funcionários (%)', padrao: 5, grupo: 'reajuste' },
  { chave: 'reajuste_mes', nome: 'Mês em que o reajuste começa (1 a 12)', padrao: 1, grupo: 'reajuste' },
  { chave: 'hora_atividade', nome: 'Hora atividade (% do salário base)', padrao: 5, grupo: 'folha' },
  { chave: 'fgts', nome: 'FGTS (%)', padrao: 8, grupo: 'encargos' },
  { chave: 'inss', nome: 'INSS empresa (%)', padrao: 20, grupo: 'encargos' },
  { chave: 'terceiros', nome: 'Terceiros (%)', padrao: 5.8, grupo: 'encargos' },
  { chave: 'fap', nome: 'FAP ajustado (RAT × FAP) (%)', padrao: 0.5, grupo: 'encargos' },
  { chave: 'aposentadoria_especial', nome: 'INSS aposentadoria especial (%)', padrao: 6, grupo: 'encargos' },
  { chave: 'pis', nome: 'PIS (%)', padrao: 0, grupo: 'encargos' },
  { chave: 'aviso_dias_base', nome: 'Aviso prévio: dias base', padrao: 30, grupo: 'passivo' },
  { chave: 'aviso_dias_por_ano', nome: 'Aviso prévio: dias por ano de casa', padrao: 3, grupo: 'passivo' },
  { chave: 'aviso_dias_max', nome: 'Aviso prévio: máximo de dias', padrao: 90, grupo: 'passivo' },
  { chave: 'multa_fgts', nome: 'Multa do FGTS na rescisão (%)', padrao: 40, grupo: 'passivo' },
  { chave: 'cessao_aviso_dias', nome: 'Avisar o fim da cessão com quantos dias de antecedência', padrao: 60, grupo: 'cessao' },
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
  if (!Number.isInteger(p.cessao_aviso_dias) || p.cessao_aviso_dias < 1 || p.cessao_aviso_dias > 365) erros.push('Aviso do fim da cessão: use um número inteiro de dias, de 1 a 365.');
  erros.push(...validarParametrosPassivo(p));
  for (const d of PARAMETROS.filter((x) => x.grupo !== 'geral' && x.grupo !== 'passivo' && x.grupo !== 'cessao' && x.chave !== 'reajuste_mes')) {
    const v = p[d.chave];
    if (!Number.isFinite(v) || v < 0 || v > 100) erros.push(`${d.nome}: use um número entre 0 e 100.`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Colunas calculadas da aba Estudo
// ---------------------------------------------------------------------------

export const centavos = (v: number) => Math.round(v * 100) / 100;

export interface LinhaCalculada {
  /** Valor Hora = Salário atual ÷ Carga horária. */
  valorHora: number;
  /** Salário Base = Salário atual × (1 + Reajuste), a partir do mês do reajuste. */
  salarioBase: number;
  /** VHora Base = Salário base ÷ Carga horária. */
  valorHoraBase: number;
  /** Hora Atividade = % do salário base (quem tem). */
  horaAtividade: number;
  /** 1/3 Férias = Salário base ÷ 3 ÷ 12. */
  tercoFerias: number;
  /** 13º = Salário base ÷ 12. */
  decimoTerceiro: number;
  /** FGTS = % de (salário base + adicional + hora atividade + insalubridade + 1/3 férias + 13º). */
  fgts: number;
  /** TOTAL = soma de Salário base até FGTS. */
  total: number;
}

/** Calcula as colunas com fórmula da aba Estudo para um funcionário, no mês (1 a 12). */
export function calcularLinha(c: Componentes, cargaHoraria: number | null, p: Parametros, mes = 12): LinhaCalculada {
  const comReajuste = mes >= p.reajuste_mes;
  const salarioBase = c.salario_atual * (1 + (comReajuste ? c.reajuste : 0) / 100);
  const horaAtividade = c.hora_atividade ? (salarioBase * p.hora_atividade) / 100 : 0;
  const tercoFerias = salarioBase / 3 / 12;
  const decimoTerceiro = salarioBase / 12;
  const fgts = ((salarioBase + c.adicional_salarial + horaAtividade + c.insalubridade + tercoFerias + decimoTerceiro) * p.fgts) / 100;
  const total =
    salarioBase +
    c.adicional_salarial +
    horaAtividade +
    c.ajuda_custo +
    c.bolsa_estagio +
    c.insalubridade +
    c.periculosidade +
    c.gratificacao_funcao +
    c.plano_saude +
    c.bolsa_estudo +
    c.locomocao +
    c.alimentacao +
    c.ferias +
    tercoFerias +
    c.abono +
    c.indenizacoes +
    decimoTerceiro +
    fgts;
  return {
    valorHora: cargaHoraria ? centavos(c.salario_atual / cargaHoraria) : 0,
    salarioBase: centavos(salarioBase),
    valorHoraBase: cargaHoraria ? centavos(salarioBase / cargaHoraria) : 0,
    horaAtividade: centavos(horaAtividade),
    tercoFerias: centavos(tercoFerias),
    decimoTerceiro: centavos(decimoTerceiro),
    fgts: centavos(fgts),
    total: centavos(total),
  };
}

// ---------------------------------------------------------------------------
// Resumo (o bloco que fica abaixo da relação de funcionários na aba Estudo)
// ---------------------------------------------------------------------------

export interface LinhaResumo {
  rotulo: string;
  valor: number;
}

export interface GrupoResumo {
  titulo: string;
  linhas: LinhaResumo[];
  total: number;
}

export interface ResumoEstudo {
  salarial: GrupoResumo;
  naoSalarial: GrupoResumo;
  beneficios: GrupoResumo;
  subtotalRemuneracao: number;
  encargos: GrupoResumo;
  subtotalComEncargos: number;
  indenizacoes: number;
  totalGeral: number;
  quadros: { totalSemEncargos: number; totalCebas: number; totalFgts: number; totalRemuneracaoMaisFgts: number };
  pessoas: number;
}

/**
 * Monta o resumo a partir das linhas dos funcionários. Cada linha pode ter um
 * peso (fração da lotação num serviço), para resumir só uma parte da folha.
 *
 * Diferenças em relação à planilha (erros corrigidos, aprovado pela Diretoria):
 * Plano de saúde entra no total de Benefícios; Bolsa estudo entra em Benefícios;
 * Indenizações sem #REF!; Total CEBAS = INSS + Terceiros + FAP + aposentadoria especial.
 */
export function resumirEstudo(itens: { c: Componentes; calc: LinhaCalculada; peso?: number }[], p: Parametros): ResumoEstudo {
  const soma = (f: (x: (typeof itens)[number]) => number) => itens.reduce((s, x) => s + f(x) * (x.peso ?? 1), 0);
  const grupo = (titulo: string, linhas: LinhaResumo[]): GrupoResumo => ({
    titulo,
    linhas: linhas.map((l) => ({ ...l, valor: centavos(l.valor) })),
    total: centavos(linhas.reduce((s, l) => s + l.valor, 0)),
  });

  const salarial = grupo('Remuneração salarial', [
    { rotulo: 'Vencimentos e salários', valor: soma((x) => x.calc.salarioBase + x.c.adicional_salarial + x.calc.horaAtividade) },
    { rotulo: 'Insalubridade e periculosidade', valor: soma((x) => x.c.insalubridade + x.c.periculosidade) },
    { rotulo: 'Gratificação por exercício de cargos e funções', valor: soma((x) => x.c.gratificacao_funcao) },
    { rotulo: 'Férias vencidas e proporcionais', valor: soma((x) => x.c.ferias + x.calc.tercoFerias + x.c.abono) },
    { rotulo: '13º salário', valor: soma((x) => x.calc.decimoTerceiro) },
  ]);
  const naoSalarial = grupo('Remuneração de natureza não salarial', [
    { rotulo: 'Ajuda de custo', valor: soma((x) => x.c.ajuda_custo) },
    { rotulo: 'Bolsa estágio', valor: soma((x) => x.c.bolsa_estagio) },
  ]);
  const beneficios = grupo('Benefícios', [
    { rotulo: 'Auxílio locomoção', valor: soma((x) => x.c.locomocao) },
    { rotulo: 'Auxílio alimentação', valor: soma((x) => x.c.alimentacao) },
    { rotulo: 'Plano de saúde', valor: soma((x) => x.c.plano_saude) },
    { rotulo: 'Bolsa estudo', valor: soma((x) => x.c.bolsa_estudo) },
  ]);
  const subtotalRemuneracao = centavos(salarial.total + naoSalarial.total + beneficios.total);

  const base = salarial.total;
  const baseEspecial = soma((x) => (x.c.insalubridade > 0 ? x.calc.salarioBase + x.c.insalubridade : 0));
  const inss = (base * p.inss) / 100;
  const terceiros = (base * p.terceiros) / 100;
  const fap = (base * p.fap) / 100;
  const especial = (baseEspecial * p.aposentadoria_especial) / 100;
  const fgts = (base * p.fgts) / 100;
  const encargos = grupo('Encargos', [
    { rotulo: `INSS empresa (${p.inss}%)`, valor: inss },
    { rotulo: `Terceiros (${p.terceiros}%)`, valor: terceiros },
    { rotulo: `FAP ajustado (${p.fap}%)`, valor: fap },
    { rotulo: `INSS aposentadoria especial (${p.aposentadoria_especial}% sobre quem tem insalubridade)`, valor: especial },
    { rotulo: `FGTS (${p.fgts}%)`, valor: fgts },
    { rotulo: `PIS (${p.pis}%)`, valor: (base * p.pis) / 100 },
  ]);
  const subtotalComEncargos = centavos(subtotalRemuneracao + encargos.total);
  const indenizacoes = centavos(soma((x) => x.c.indenizacoes));
  const totalGeral = centavos(subtotalComEncargos + indenizacoes);
  const totalCebas = centavos(inss + terceiros + fap + especial);

  return {
    salarial,
    naoSalarial,
    beneficios,
    subtotalRemuneracao,
    encargos,
    subtotalComEncargos,
    indenizacoes,
    totalGeral,
    quadros: {
      totalSemEncargos: subtotalRemuneracao,
      totalCebas,
      totalFgts: centavos(fgts),
      totalRemuneracaoMaisFgts: centavos(totalGeral - totalCebas),
    },
    pessoas: itens.length,
  };
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
