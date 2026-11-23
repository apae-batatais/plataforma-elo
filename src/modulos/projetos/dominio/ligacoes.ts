/** Ligações do projeto com outros apps (regras 26 e 27). Só texto e identificadores; nenhum cadastro é repetido. */
export const APPS_LIGACAO = ['parcerias', 'orcamento', 'requisicoes', 'avaliacao', 'comunicacao', 'termo', 'fonte_receita', 'requisicao', 'pedido_comunicacao'] as const;
export type AppLigacao = (typeof APPS_LIGACAO)[number];

export const NOME_APP_LIGACAO: Record<AppLigacao, string> = {
  parcerias: 'Parcerias',
  orcamento: 'Orçamento',
  requisicoes: 'Requisições',
  avaliacao: 'Avaliação',
  comunicacao: 'Comunicação',
  termo: 'Termo de parceria',
  fonte_receita: 'Fonte de receita',
  requisicao: 'Requisição',
  pedido_comunicacao: 'Pedido de divulgação',
};

/** Módulo da plataforma que guarda o dado de cada tipo de ligação. */
export const MODULO_DA_LIGACAO: Record<AppLigacao, string> = {
  parcerias: 'parcerias',
  orcamento: 'orcamento',
  requisicoes: 'requisicoes',
  avaliacao: 'avaliacao',
  comunicacao: 'comunicacao',
  termo: 'parcerias',
  fonte_receita: 'orcamento',
  requisicao: 'requisicoes',
  pedido_comunicacao: 'comunicacao',
};

// ---------- Termo no projeto (regra L13) ----------

export interface ParcelaDoTermo {
  mes: string;
  valor: number;
}

export interface PrazosDoTermo {
  /** Primeira parcela com valor a partir do mês de hoje (AAAA-MM). */
  proximaParcela: ParcelaDoTermo | null;
  ultimaParcela: ParcelaDoTermo | null;
  fimVigencia: string | null;
}

/** Soma o cronograma de todas as fontes por mês, em ordem. Valores em centavos para não somar erro de ponto flutuante. */
export function parcelasDoTermo(fontes: readonly { cronograma: readonly ParcelaDoTermo[] }[]): ParcelaDoTermo[] {
  const porMes = new Map<string, number>();
  for (const f of fontes) for (const x of f.cronograma) porMes.set(x.mes, (porMes.get(x.mes) ?? 0) + Math.round(x.valor * 100));
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, c]) => ({ mes, valor: c / 100 }))
    .filter((x) => x.valor > 0);
}

/** `hoje` no formato AAAA-MM-DD. */
export function prazosDoTermo(parcelas: readonly ParcelaDoTermo[], fim: string | null, hoje: string): PrazosDoTermo {
  const mesHoje = hoje.slice(0, 7);
  return {
    proximaParcela: parcelas.find((x) => x.mes >= mesHoje) ?? null,
    ultimaParcela: parcelas.at(-1) ?? null,
    fimVigencia: fim,
  };
}

export interface EventoDaLinhaDoTempo {
  /** AAAA-MM-DD; parcela do termo usa o primeiro dia do mês. */
  data: string;
  tipo: 'atividade' | 'parcela';
  texto: string;
  /** Só parcela. */
  valor: number | null;
  /** Só atividade: a data é o fim previsto. */
  situacao: string | null;
}

/** Atividades com prazo do projeto e parcelas do termo, em ordem de data (atividade antes de parcela no mesmo dia). */
export function linhaDoTempo(
  atividades: readonly { descricao: string; fim_previsto: string; situacao: string }[],
  parcelas: readonly ParcelaDoTermo[],
): EventoDaLinhaDoTempo[] {
  const eventos: EventoDaLinhaDoTempo[] = [
    ...atividades.filter((a) => a.fim_previsto && a.situacao !== 'cancelada').map((a) => ({ data: a.fim_previsto, tipo: 'atividade' as const, texto: a.descricao, valor: null, situacao: a.situacao })),
    ...parcelas.map((x) => ({ data: `${x.mes}-01`, tipo: 'parcela' as const, texto: 'Parcela do termo', valor: x.valor, situacao: null })),
  ];
  return eventos.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === 'atividade' ? -1 : 1));
}
