/**
 * Passivo trabalhista (P2 da #126): quanto a instituição deveria se desligasse uma pessoa
 * sem justa causa na data. Funções puras, sem leitura de planilha.
 *
 * Fica de fora, por decisão da Diretoria: reflexos do aviso, encargos patronais sobre a
 * rescisão, rescisão antecipada de contrato por prazo determinado e cedidos.
 */
const centavos = (v: number) => Math.round(v * 100) / 100;

export interface ParametrosPassivo {
  aviso_dias_base: number;
  aviso_dias_por_ano: number;
  aviso_dias_max: number;
  /** % sobre o saldo do FGTS. */
  multa_fgts: number;
}

export interface FeriasGozadas {
  /** AAAA-MM-DD */
  inicio: string;
  dias: number;
}

const partes = (d: string) => d.split('-').map(Number) as [number, number, number];
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Soma meses a uma data (dia limitado ao último do mês de destino). */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = partes(data);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, Math.min(d, ultimo));
}

/** Meses completos entre duas datas; fração de 15 dias ou mais conta como mês. */
export function mesesTrabalhados(de: string, ate: string): number {
  if (ate < de) return 0;
  const [ai, mi, di] = partes(de);
  const [af, mf, df] = partes(ate);
  let meses = (af - ai) * 12 + (mf - mi);
  let dias = df - di + 1;
  if (dias < 0) {
    meses -= 1;
    dias += 30;
  }
  if (dias >= 15) meses += 1;
  return Math.max(0, meses);
}

/** Anos completos de casa (12 meses cheios, sem a regra dos 15 dias). */
export function anosCompletos(inicio: string, ate: string): number {
  let anos = 0;
  while (somarMeses(inicio, 12 * (anos + 1)) <= ate) anos += 1;
  return anos;
}

export interface FeriasDoPassivo {
  /** Dias de períodos vencidos ainda não gozados (para exibir). */
  diasVencidos: number;
  valorVencidas: number;
  /** Algum período vencido passou do prazo de concessão (12 meses depois de completo). */
  emDobro: boolean;
  /** Meses do período aquisitivo em aberto (0 a 12). */
  mesesProporcionais: number;
  valorProporcionais: number;
}

/**
 * Férias: cada 12 meses a partir da admissão é um período. Os dias gozados abatem os períodos
 * mais antigos primeiro (até 30 por período). Período vencido com prazo de concessão
 * passado conta em dobro.
 */
export function calcularFerias(inicio: string, ate: string, remuneracao: number, gozadas: FeriasGozadas[]): FeriasDoPassivo {
  const completos = anosCompletos(inicio, ate);
  let gozados = gozadas.filter((g) => g.inicio <= ate).reduce((s, g) => s + g.dias, 0);
  let valorVencidas = 0;
  let diasVencidos = 0;
  let emDobro = false;
  for (let k = 0; k < completos; k++) {
    const usados = Math.min(30, gozados);
    gozados -= usados;
    const pendentes = 30 - usados;
    if (pendentes <= 0) continue;
    diasVencidos += pendentes;
    const base = (remuneracao / 30) * pendentes * (4 / 3);
    const prazo = somarMeses(inicio, 12 * (k + 2));
    const dobro = ate > prazo;
    if (dobro) emDobro = true;
    valorVencidas += dobro ? base * 2 : base;
  }
  const inicioEmAberto = somarMeses(inicio, 12 * completos);
  const mesesProporcionais = Math.min(12, mesesTrabalhados(inicioEmAberto, ate));
  // O gozo que sobrou depois dos períodos vencidos abate o período em aberto.
  const diasProporcionais = Math.max(0, (30 * mesesProporcionais) / 12 - gozados);
  const valorProporcionais = (remuneracao / 30) * diasProporcionais * (4 / 3);
  return {
    diasVencidos,
    valorVencidas: centavos(valorVencidas),
    emDobro,
    mesesProporcionais,
    valorProporcionais: centavos(valorProporcionais),
  };
}

/** 13º proporcional do ano da data, menos o que o calendário já pagou nos meses anteriores ao da data. */
export function decimoProporcional(inicio: string, ate: string, remuneracao: number, pesosDoCalendario: number[]): number {
  const [anoAte, mesAte] = partes(ate);
  const inicioDoAno = `${anoAte}-01-01`;
  const meses = mesesTrabalhados(inicio > inicioDoAno ? inicio : inicioDoAno, ate);
  const pago = pesosDoCalendario.slice(0, mesAte - 1).reduce((s, x) => s + x, 0);
  const faltaPagar = Math.max(0, 100 - pago) / 100;
  return centavos(((remuneracao * Math.min(12, meses)) / 12) * faltaPagar);
}

export function diasDeAviso(anos: number, p: ParametrosPassivo): number {
  return Math.min(p.aviso_dias_max, p.aviso_dias_base + p.aviso_dias_por_ano * anos);
}

export interface SaldoDoFgts {
  /** Data do extrato (AAAA-MM-DD) e valor, quando o ajuste manual existe. */
  extrato?: { referencia: string; valor: number } | null;
  /** Base do FGTS no mês (valor vigente da folha naquele mês). */
  baseDoMes: (ano: number, mes: number) => number;
  /** % do FGTS (8). */
  aliquota: number;
}

/**
 * Saldo estimado: soma, de cada mês desde a admissão até o mês da data, do FGTS sobre a base do mês.
 * Com extrato, vale o valor dele mais os meses depois do mês do extrato.
 */
export function saldoDoFgts(inicio: string, ate: string, s: SaldoDoFgts): number {
  const [ai, mi] = partes(inicio);
  const [af, mf] = partes(ate);
  const mesDoExtrato = s.extrato ? partes(s.extrato.referencia) : null;
  let total = s.extrato ? s.extrato.valor : 0;
  for (let a = ai, m = mi; a < af || (a === af && m <= mf); m === 12 ? ((m = 1), (a += 1)) : (m += 1)) {
    if (mesDoExtrato && (a < mesDoExtrato[0] || (a === mesDoExtrato[0] && m <= mesDoExtrato[1]))) continue;
    total += (s.baseDoMes(a, m) * s.aliquota) / 100;
  }
  return centavos(total);
}

export interface EntradaPassivo {
  inicio: string;
  /** Data de referência (AAAA-MM-DD). */
  ate: string;
  /** Remuneração salarial mensal (sem benefícios e ajuda de custo). */
  remuneracao: number;
  gozadas: FeriasGozadas[];
  /** Pesos (soma 100) do 13º por mês, do calendário da instituição. */
  decimoCalendario: number[];
  fgts: SaldoDoFgts;
  parametros: ParametrosPassivo;
}

export interface PassivoDaPessoa {
  ferias: FeriasDoPassivo;
  /** Férias vencidas + proporcionais, já com o dobro quando for o caso. */
  valorFerias: number;
  decimo: number;
  diasAviso: number;
  aviso: number;
  saldoFgts: number;
  multaFgts: number;
  total: number;
}

export function calcularPassivo(e: EntradaPassivo): PassivoDaPessoa {
  const ferias = calcularFerias(e.inicio, e.ate, e.remuneracao, e.gozadas);
  const valorFerias = centavos(ferias.valorVencidas + ferias.valorProporcionais);
  const decimo = decimoProporcional(e.inicio, e.ate, e.remuneracao, e.decimoCalendario);
  const dias = diasDeAviso(anosCompletos(e.inicio, e.ate), e.parametros);
  const aviso = centavos((e.remuneracao / 30) * dias);
  const saldo = saldoDoFgts(e.inicio, e.ate, e.fgts);
  const multa = centavos((saldo * e.parametros.multa_fgts) / 100);
  return { ferias, valorFerias, decimo, diasAviso: dias, aviso, saldoFgts: saldo, multaFgts: multa, total: centavos(valorFerias + decimo + aviso + multa) };
}

// ---------------------------------------------------------------------------
// Ajustes digitados
// ---------------------------------------------------------------------------

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function validarFeriasTiradas(d: { inicio: string; dias: number }, admissao: string): string[] {
  const erros: string[] = [];
  if (!DATA.test(d.inicio)) erros.push('Informe o início das férias.');
  else if (d.inicio < admissao) erros.push('As férias não podem começar antes da admissão.');
  if (!Number.isInteger(d.dias) || d.dias < 1 || d.dias > 30) erros.push('Os dias de férias devem ser de 1 a 30.');
  return erros;
}

export function validarSaldoFgts(d: { referencia: string; valor: number }, admissao: string): string[] {
  const erros: string[] = [];
  if (!DATA.test(d.referencia)) erros.push('Informe a data do extrato.');
  else if (d.referencia < admissao) erros.push('A data do extrato não pode ser antes da admissão.');
  if (!Number.isFinite(d.valor) || d.valor < 0) erros.push('O saldo do FGTS não pode ser negativo.');
  return erros;
}

/** Limites dos parâmetros do passivo (dias inteiros e multa de 0 a 100). */
export function validarParametrosPassivo(p: ParametrosPassivo): string[] {
  const erros: string[] = [];
  const dias = (v: number, max: number, nome: string) => {
    if (!Number.isInteger(v) || v < 0 || v > max) erros.push(`${nome}: use um número inteiro de dias entre 0 e ${max}.`);
  };
  dias(p.aviso_dias_base, 365, 'Aviso prévio (dias base)');
  dias(p.aviso_dias_por_ano, 30, 'Aviso prévio (dias por ano de casa)');
  dias(p.aviso_dias_max, 365, 'Aviso prévio (máximo de dias)');
  if (!Number.isFinite(p.multa_fgts) || p.multa_fgts < 0 || p.multa_fgts > 100) erros.push('Multa do FGTS: use um número entre 0 e 100.');
  return erros;
}
