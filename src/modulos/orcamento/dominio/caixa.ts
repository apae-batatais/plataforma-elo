/**
 * Folha em caixa (P1): em que mês o dinheiro sai, sem mudar o custo do mês (1/12).
 *
 * O custo do mês continua sendo o de `calcularLinha` e do Resumo da folha. Aqui só se calcula
 * quanto cada mês pesa a mais ou a menos no caixa, porque 13º, 1/3 de férias e abono saem em
 * meses próprios. Funções puras, sem leitura de planilha.
 */
import { centavos, type LinhaCalculada, type Componentes, type Parametros } from './folha';

export const CONTRATOS = ['indeterminado', 'determinado'] as const;
export type Contrato = (typeof CONTRATOS)[number];

export interface LinhaCalendario {
  /** 1 a 12 */
  mes: number;
  ferias_coletivas: boolean;
  /** % do 13º pago neste mês (0 a 100) */
  decimo_pct: number;
  /** % do abono pago neste mês (0 a 100) */
  abono_pct: number;
}

export interface Calendario {
  /** Pesos (soma 100) do 13º por mês. */
  decimo: number[];
  /** Pesos do abono; null = 1/12 por mês (como no custo). */
  abono: number[] | null;
  coletivas: boolean[];
  /** false = nenhum calendário foi salvo pela instituição (vale o padrão). */
  configurado: boolean;
}

const MESES = Array.from({ length: 12 }, (_, i) => i);

/** Padrão: 13º em novembro e dezembro (50% cada), sem férias coletivas, abono 1/12 por mês. */
export const CALENDARIO_PADRAO: Calendario = {
  decimo: MESES.map((i) => (i === 10 || i === 11 ? 50 : 0)),
  abono: null,
  coletivas: MESES.map(() => false),
  configurado: false,
};

const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

/** Erros que impedem salvar o calendário. Lista vazia = pode salvar. */
export function validarCalendario(linhas: LinhaCalendario[]): string[] {
  const erros: string[] = [];
  if (linhas.length !== 12 || new Set(linhas.map((l) => l.mes)).size !== 12 || linhas.some((l) => !Number.isInteger(l.mes) || l.mes < 1 || l.mes > 12)) {
    erros.push('O calendário precisa ter os 12 meses.');
    return erros;
  }
  for (const l of linhas) {
    for (const v of [l.decimo_pct, l.abono_pct]) {
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        erros.push('Cada percentual deve estar entre 0 e 100.');
        break;
      }
    }
  }
  const d = Math.round(soma(linhas.map((l) => l.decimo_pct)) * 100) / 100;
  const a = Math.round(soma(linhas.map((l) => l.abono_pct)) * 100) / 100;
  if (d !== 100) erros.push(`Os percentuais do 13º somam ${d.toLocaleString('pt-BR')}%; precisam somar 100%.`);
  if (a !== 100 && a !== 0) erros.push(`Os percentuais do abono somam ${a.toLocaleString('pt-BR')}%; precisam somar 100% (ou deixe tudo em branco para 1/12 por mês).`);
  return [...new Set(erros)];
}

/** Calendário a partir das linhas salvas (as 12 de uma vigência). Sem linhas, o padrão. */
export function calendarioDe(linhas: LinhaCalendario[] | undefined): Calendario {
  if (!linhas || linhas.length === 0) return CALENDARIO_PADRAO;
  const por = new Map(linhas.map((l) => [l.mes, l]));
  const decimo = MESES.map((i) => por.get(i + 1)?.decimo_pct ?? 0);
  const abono = MESES.map((i) => por.get(i + 1)?.abono_pct ?? 0);
  return {
    decimo: soma(decimo) > 0 ? decimo : CALENDARIO_PADRAO.decimo,
    abono: soma(abono) > 0 ? abono : null,
    coletivas: MESES.map((i) => por.get(i + 1)?.ferias_coletivas ?? false),
    configurado: true,
  };
}

/**
 * Divide `total` (reais) pelos meses, proporcional aos pesos, em centavos exatos.
 * Só recebem os meses em que a pessoa trabalha (`ativos`); quando `mesFinal` é informado, o que
 * cairia depois dele vai para ele. Sem nenhum peso aproveitável, devolve null.
 */
export function repartir(total: number, pesos: number[], ativos: boolean[], mesFinal: number | null = null): number[] | null {
  const efetivos = pesos.map((p, i) => {
    if (mesFinal !== null && i > mesFinal) return 0;
    return ativos[i] ? p : 0;
  });
  if (mesFinal !== null) {
    const resto = pesos.slice(mesFinal + 1).reduce((s, x) => s + x, 0);
    const alvo = ativos[mesFinal] ? mesFinal : efetivos.findLastIndex((p, i) => i <= mesFinal && ativos[i]);
    if (alvo >= 0) efetivos[alvo] += resto;
  }
  const peso = soma(efetivos);
  if (peso <= 0) return null;
  const cent = Math.round(total * 100);
  const partes = efetivos.map((p) => Math.floor((cent * p) / peso));
  const sobra = cent - soma(partes);
  const maior = efetivos.indexOf(Math.max(...efetivos));
  partes[maior] += sobra;
  return partes.map((c) => c / 100);
}

/** Meses completos desde a admissão até a data, contando fração de 15 dias ou mais como mês. */
export function mesesAquisitivosEmAberto(inicio: string, ate: string): number {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = ate.split('-').map(Number);
  let meses = (af - ai) * 12 + (mf - mi);
  let dias = df - di + 1;
  if (dias < 0) {
    meses -= 1;
    dias += 30;
  }
  if (dias >= 15) meses += 1;
  return Math.max(0, meses) % 12;
}

export interface MesDaPessoa {
  c: Componentes;
  calc: LinhaCalculada;
}

export interface EntradaCaixa {
  /** 12 posições; null = a pessoa não trabalha no mês. */
  meses: (MesDaPessoa | null)[];
  contrato: Contrato;
  /** 1 a 12 */
  mesFerias: number | null;
  inicio: string;
  desligamento: string | null;
  /** Ano da folha (para saber se o desligamento cai nele). */
  ano: number;
}

export interface DeslocamentoCaixa {
  /** Quanto o caixa do mês passa do custo (13º, 1/3 e abono), antes dos encargos. Soma zero no ano. */
  delta: number[];
  /** Verbas do término de contrato por prazo determinado, sem encargos. */
  termino: number[];
}

const zeros = () => MESES.map(() => 0);

/**
 * O que muda de mês entre custo e caixa para uma pessoa. O custo do mês não é alterado: o
 * Resumo soma `delta` (com os encargos que acompanham) e `termino` ao custo de cada mês.
 */
export function deslocamentoDeCaixa(e: EntradaCaixa, cal: Calendario): DeslocamentoCaixa {
  const ativos = e.meses.map((m) => m !== null);
  const delta = zeros();
  const termino = zeros();
  if (!ativos.some(Boolean)) return { delta, termino };

  const doAno = e.desligamento && e.desligamento.startsWith(`${e.ano}-`) ? e.desligamento : null;
  const determinado = e.contrato === 'determinado' && doAno !== null;
  // Contrato por prazo indeterminado que termina no ano: nada se desloca (sem verba de término na previsão).
  if (doAno && !determinado) return { delta, termino };
  const mesFinal = determinado ? Number(doAno!.slice(5, 7)) - 1 : null;

  const acumulado = (campo: (m: MesDaPessoa) => number) => e.meses.map((m) => (m ? campo(m) : 0));
  const aplicar = (acum: number[], pesos: number[] | null) => {
    const total = centavos(soma(acum));
    const pago = pesos ? repartir(total, pesos, ativos, mesFinal) : null;
    if (!pago) return;
    for (const i of MESES) delta[i] += pago[i] - acum[i];
  };

  aplicar(acumulado((m) => m.calc.decimoTerceiro), cal.decimo);
  aplicar(acumulado((m) => m.c.abono), cal.abono);

  let pesosFerias: number[] | null = null;
  if (e.mesFerias && e.mesFerias >= 1 && e.mesFerias <= 12) pesosFerias = MESES.map((i) => (i === e.mesFerias! - 1 ? 1 : 0));
  else if (cal.coletivas.some(Boolean)) pesosFerias = cal.coletivas.map((x) => (x ? 1 : 0));
  aplicar(acumulado((m) => m.calc.tercoFerias), pesosFerias);

  if (determinado && mesFinal !== null && e.meses[mesFinal]) {
    const { c, calc } = e.meses[mesFinal]!;
    const remuneracao = calc.salarioBase + c.adicional_salarial + calc.horaAtividade + c.insalubridade + c.periculosidade + c.gratificacao_funcao;
    const meses = mesesAquisitivosEmAberto(e.inicio, doAno!);
    termino[mesFinal] = centavos((remuneracao * meses) / 12);
  }
  return { delta: delta.map(centavos), termino };
}

/** Percentual de encargos que acompanham 13º, 1/3 e abono (todos incidem sobre a remuneração salarial). */
export const taxaDeEncargosSobreSalarial = (p: Parametros) => (p.inss + p.terceiros + p.fap + p.fgts + p.pis) / 100;

export interface PicoDeCaixa {
  /** 1 a 12 */
  mes: number;
  valor: number;
  /** Média mensal do ano. */
  media: number;
}

export function picoDeCaixa(mensal: number[]): PicoDeCaixa {
  const valor = Math.max(...mensal);
  return { mes: mensal.indexOf(valor) + 1, valor, media: centavos(soma(mensal) / 12) };
}
