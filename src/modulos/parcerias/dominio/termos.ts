/**
 * Regras puras do módulo Parcerias (sem acesso a planilha): valores em centavos,
 * per capita, cronograma de desembolso, conferências, ocupação e alerta de vagas ociosas.
 */

export const TIPOS_INSTRUMENTO = ['colaboracao', 'fomento', 'convenio', 'acordo_cooperacao', 'outro'] as const;
export type TipoInstrumento = (typeof TIPOS_INSTRUMENTO)[number];
export const NOME_TIPO: Record<TipoInstrumento, string> = {
  colaboracao: 'Termo de colaboração',
  fomento: 'Termo de fomento',
  convenio: 'Termo de convênio',
  acordo_cooperacao: 'Acordo de cooperação',
  outro: 'Outro',
};
export const TIPOS_APORTE = ['aditivo', 'emenda', 'suplementacao', 'outro'] as const;
export const NOME_APORTE: Record<(typeof TIPOS_APORTE)[number], string> = {
  aditivo: 'Aditivo',
  emenda: 'Emenda parlamentar',
  suplementacao: 'Suplementação',
  outro: 'Outro',
};
export const CATEGORIAS_SUGERIDAS = ['Pessoal', 'Administrativas', 'Utilidades públicas', 'Material de consumo', 'Serviços de terceiros'];
/** Unidades de meta em que o Núcleo consegue contar atendidos (pessoas). */
export const UNIDADES_PESSOA = ['pessoa', 'pessoas', 'usuario', 'usuarios', 'usuário', 'usuários', 'aluno', 'alunos'];
export const LIMITE_OCUPACAO_PADRAO = 85;

export class ErroTermo extends Error {}

export const nomeComparavel = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// --- dinheiro ---------------------------------------------------------------
export const emCentavos = (v: number) => Math.round(v * 100);
export const emReais = (c: number) => c / 100;
export const arredondar = (v: number) => emReais(emCentavos(v));
export const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- meses ------------------------------------------------------------------
export const mesDe = (data: string) => data.slice(0, 7);
export const MES = /^\d{4}-\d{2}$/;
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const i = a * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}
/** Meses de `de` a `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
  const r: string[] = [];
  for (let m = de; m <= ate && r.length < 600; m = somarMeses(m, 1)) r.push(m);
  return r;
}
/** Meses de cobertura = meses da vigência (do mês do início ao do fim, inclusive). */
export const mesesDeCobertura = (inicio: string, fim: string) => mesesEntre(mesDe(inicio), mesDe(fim)).length;
export const nomeMes = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

// --- valor da fonte ---------------------------------------------------------
export interface FormaValor {
  forma: 'global' | 'per_capita';
  valorInicial: number | null;
  perCapita: number | null;
  periodicidade: 'mensal' | 'anual' | null;
}

/**
 * Valor inicial da fonte (regra 10). Global: o digitado. Per capita: per capita ×
 * quantidade custeada × fator de cobertura (mensal: meses; anual: meses ÷ 12).
 * O número de parcelas nunca entra na conta.
 */
export function valorInicialDaFonte(f: FormaValor, quantidadeCusteada: number, mesesCobertura: number): number {
  if (f.forma === 'global') return arredondar(f.valorInicial ?? 0);
  const fator = f.periodicidade === 'anual' ? mesesCobertura / 12 : mesesCobertura;
  return arredondar((f.perCapita ?? 0) * quantidadeCusteada * fator);
}

/** Texto da conta per capita mostrada na tela ("R$ 1.000,00 por ano × 100 alunos × 12 ÷ 12 meses = ..."). */
export function textoDaConta(f: FormaValor, quantidade: number, meses: number, unidade: string): string {
  if (f.forma === 'global') return dinheiro(f.valorInicial ?? 0);
  const total = valorInicialDaFonte(f, quantidade, meses);
  const por = f.periodicidade === 'anual' ? 'por ano' : 'por mês';
  const fator = f.periodicidade === 'anual' ? `${meses} ÷ 12 meses` : `${meses} meses`;
  return `${dinheiro(f.perCapita ?? 0)} ${por} × ${quantidade} ${unidade} × ${fator} = ${dinheiro(total)}`;
}

// --- cronograma -------------------------------------------------------------
export interface Parcela {
  mes: string;
  valor: number;
}

/** Divide em partes iguais; os centavos que sobram vão para a última parcela (regra 12). */
export function dividirEmPartesIguais(valor: number, meses: string[]): Parcela[] {
  const ordenados = [...new Set(meses)].sort();
  if (ordenados.length === 0) return [];
  const total = emCentavos(valor);
  const base = Math.trunc(total / ordenados.length);
  const resto = total - base * ordenados.length;
  return ordenados.map((mes, i) => ({ mes, valor: emReais(base + (i === ordenados.length - 1 ? resto : 0)) }));
}

export const somaParcelas = (ps: readonly Parcela[]) => emReais(ps.reduce((s, p) => s + emCentavos(p.valor), 0));

/** Aviso da regra 13: null quando a soma bate. */
export function avisoDeSoma(rotulo: string, ps: readonly Parcela[], esperado: number): string | null {
  const soma = somaParcelas(ps);
  const dif = emReais(emCentavos(esperado) - emCentavos(soma));
  if (dif === 0) return null;
  return `O cronograma ${rotulo} soma ${dinheiro(soma)}; o valor é ${dinheiro(esperado)} (diferença ${dinheiro(dif)}).`;
}

/** Previsto a receber por mês: parcelas das fontes + parcelas dos aportes ativos. */
export function previstoPorMes(...listas: (readonly Parcela[])[]): Parcela[] {
  const m = new Map<string, number>();
  for (const l of listas) for (const p of l) m.set(p.mes, (m.get(p.mes) ?? 0) + emCentavos(p.valor));
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([mes, c]) => ({ mes, valor: emReais(c) }));
}

// --- conferências de cadastro -------------------------------------------------
export function conferirVigencia(inicio: string, fim: string) {
  if (fim <= inicio) throw new ErroTermo('A vigência precisa terminar depois de começar.');
}

export function conferirParcelasNaVigencia(ps: readonly Parcela[], inicio: string, fim: string, rotulo: string) {
  for (const p of ps) {
    if (!MES.test(p.mes)) throw new ErroTermo(`Mês inválido no cronograma ${rotulo}: ${p.mes}.`);
    if (p.mes < mesDe(inicio) || p.mes > mesDe(fim)) {
      throw new ErroTermo(`O mês ${nomeMes(p.mes)} do cronograma ${rotulo} está fora da vigência.`);
    }
  }
  if (new Set(ps.map((p) => p.mes)).size !== ps.length) throw new ErroTermo(`O cronograma ${rotulo} repete um mês.`);
}

// --- ocupação ---------------------------------------------------------------
export const unidadeEhPessoa = (unidade: string) => UNIDADES_PESSOA.includes(nomeComparavel(unidade)) || UNIDADES_PESSOA.includes(unidade.trim().toLowerCase());

export interface ServicoDoTermo {
  servico: string;
  vagasOferecidas: number | null;
  vagasCusteadas: number | null;
}

export interface LinhaOcupacao {
  mes: string;
  vagasCusteadas: number | null;
  vagasOferecidas: number | null;
  /** Nulo: "sem contagem automática" (unidade que não é pessoa). */
  atendidos: number | null;
  /** Em %, nulo quando não há vagas ou atendidos. */
  ocupacao: number | null;
  valorPrevisto: number;
  perCapitaMeta: number | null;
  perCapitaAtendidos: number | null;
}

/**
 * Quadro "Per capita e ocupação" de um serviço (regras 15, 16, 18, 19): o valor do termo no mês
 * é atribuído ao serviço na proporção das vagas custeadas.
 */
export function quadroDoServico(
  servico: ServicoDoTermo,
  totalCusteadas: number,
  previstoMes: readonly Parcela[],
  atendidosPorMes: Map<string, number> | null,
  meses: string[],
): LinhaOcupacao[] {
  const vagas = servico.vagasCusteadas && servico.vagasCusteadas > 0 ? servico.vagasCusteadas : null;
  const parte = vagas && totalCusteadas > 0 ? vagas / totalCusteadas : 0;
  const prev = new Map(previstoMes.map((p) => [p.mes, p.valor]));
  return meses.map((mes) => {
    const valor = arredondar((prev.get(mes) ?? 0) * parte);
    const at = atendidosPorMes ? (atendidosPorMes.get(mes) ?? 0) : null;
    return {
      mes,
      vagasCusteadas: vagas,
      vagasOferecidas: servico.vagasOferecidas,
      atendidos: at,
      ocupacao: vagas && at !== null ? Math.round((at / vagas) * 1000) / 10 : null,
      valorPrevisto: valor,
      perCapitaMeta: vagas ? arredondar(valor / vagas) : null,
      perCapitaAtendidos: at ? arredondar(valor / at) : null,
    };
  });
}

/** Acumulado da vigência até o último mês do quadro. */
export function acumulado(linhas: readonly LinhaOcupacao[]) {
  const valor = arredondar(linhas.reduce((s, l) => s + l.valorPrevisto, 0));
  const vagas = linhas[0]?.vagasCusteadas ?? null;
  const comAtendidos = linhas.filter((l) => l.atendidos !== null);
  const media = comAtendidos.length ? comAtendidos.reduce((s, l) => s + (l.atendidos ?? 0), 0) / comAtendidos.length : null;
  return {
    valor,
    perCapitaMeta: vagas ? arredondar(valor / vagas) : null,
    perCapitaAtendidos: media ? arredondar(valor / media) : null,
  };
}

export interface AlertaOciosas {
  vagasOciosas: number;
  valorMensal: number;
  meses: [string, string];
}

/** Regra 20: ocupação abaixo do limite por 2 meses seguidos, até o último mês do quadro. */
export function alertaDeOciosas(linhas: readonly LinhaOcupacao[], limite: number, perCapitaMensal: number | null): AlertaOciosas | null {
  if (linhas.length < 2) return null;
  const [a, b] = linhas.slice(-2);
  if (a.ocupacao === null || b.ocupacao === null || a.vagasCusteadas === null || b.atendidos === null) return null;
  if (!(a.ocupacao < limite && b.ocupacao < limite)) return null;
  const ociosas = Math.max(0, (b.vagasCusteadas ?? 0) - b.atendidos);
  return { vagasOciosas: ociosas, valorMensal: arredondar(ociosas * (perCapitaMensal ?? 0)), meses: [a.mes, b.mes] };
}

// --- meta com número do cadastro (ADR-023) -------------------------------------------
export const FONTES_NUMERO = ['manual', 'vinculos_ativos', 'indice_cuidado', 'reavaliacao_em_dia'] as const;
export type FonteNumero = (typeof FONTES_NUMERO)[number];
export const NOME_FONTE_NUMERO: Record<FonteNumero, string> = {
  manual: 'Digitado à mão',
  vinculos_ativos: 'Pessoas com vínculo ativo no serviço',
  indice_cuidado: 'Índice médio de necessidade de cuidado do serviço',
  reavaliacao_em_dia: '% de pessoas com reavaliação em dia',
};
