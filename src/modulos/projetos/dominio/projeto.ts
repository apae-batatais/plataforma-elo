/**
 * Regras puras do app Projetos (entrega P1): tipos, porte, etapas, portas, pareceres e alçada.
 * Nada aqui lê nem grava planilhas.
 */

export class ErroProjetos extends Error {}

export const TIPOS_PROJETO = ['interno', 'financiado'] as const;
export type TipoProjeto = (typeof TIPOS_PROJETO)[number];
export const NOME_TIPO: Record<TipoProjeto, string> = { interno: 'Interno', financiado: 'Com financiamento externo' };

export const PORTES = ['enxuto', 'completo'] as const;
export type Porte = (typeof PORTES)[number];
export const NOME_PORTE: Record<Porte, string> = { enxuto: 'Enxuto', completo: 'Completo' };

/** Etapa do projeto. Até a entrega P2 o ciclo vai da ideia à porta 2 (Termo de Abertura); a fase 3 em diante vem nas próximas entregas. */
export const ETAPAS = ['rascunho', 'aguardando_responsavel', 'ideia', 'em_porta', 'fase_1', 'fase_2', 'fase_3', 'implementacao', 'parado', 'cancelado'] as const;
export type Etapa = (typeof ETAPAS)[number];
export const NOME_ETAPA: Record<Etapa, string> = {
  rascunho: 'Rascunho',
  aguardando_responsavel: 'Aguardando responsável',
  ideia: 'Ideia com responsável',
  em_porta: 'Em porta de decisão',
  fase_1: 'Fase 1 · Identificação e definição',
  fase_2: 'Fase 2 · Configuração',
  fase_3: 'Fase 3 · Planejamento',
  implementacao: 'Fase 4 · Implementação',
  parado: 'Parado',
  cancelado: 'Cancelado',
};
/** Etapas em que o projeto não anda mais sem uma decisão especial. */
export const ETAPAS_ENCERRADAS: ReadonlySet<Etapa> = new Set<Etapa>(['cancelado']);

export const TIPOS_PARECER = ['tecnico', 'financeiro', 'juridico'] as const;
export type TipoParecer = (typeof TIPOS_PARECER)[number];
export const NOME_PARECER: Record<TipoParecer, string> = { tecnico: 'Técnico', financeiro: 'Financeiro', juridico: 'Jurídico' };

export const RESULTADOS_PARECER = ['satisfatorio', 'com_ressalvas', 'insatisfatorio'] as const;
export type ResultadoParecer = (typeof RESULTADOS_PARECER)[number];
export const NOME_RESULTADO: Record<ResultadoParecer, string> = {
  satisfatorio: 'Satisfatório',
  com_ressalvas: 'Satisfatório com ressalvas',
  insatisfatorio: 'Insatisfatório',
};

export const DECISOES = ['seguir', 'ajustar', 'parar'] as const;
export type Decisao = (typeof DECISOES)[number];
export const NOME_DECISAO: Record<Decisao, string> = { seguir: 'Seguir', ajustar: 'Ajustar', parar: 'Parar' };

export const NIVEIS_DECISAO = ['diretoria', 'alcada'] as const;
export type NivelDecisao = (typeof NIVEIS_DECISAO)[number];

export const SITUACOES_PORTA = ['aberta', 'aguardando_alcada', 'decidida'] as const;
export type SituacaoPorta = (typeof SITUACOES_PORTA)[number];
export const NOME_SITUACAO_PORTA: Record<SituacaoPorta, string> = {
  aberta: 'Aberta, esperando pareceres e decisão',
  aguardando_alcada: 'Aguardando a Presidência ou o Conselho',
  decidida: 'Decidida',
};

/** Portas 1 (ideia) e 2 (Termo de Abertura); a 3 e a de encerramento chegam com P3 e P5. */
export const TIPOS_PORTA = ['ideia', 'termo', 'plano'] as const;
export type TipoPorta = (typeof TIPOS_PORTA)[number];
export const NOME_PORTA: Record<TipoPorta, string> = { ideia: 'Porta 1 · Ideia', termo: 'Porta 2 · Termo de Abertura', plano: 'Porta 3 · Plano' };

export const PAPEIS_DESIGNADOS = ['tecnico', 'financeiro', 'juridico', 'alcada'] as const;
export type PapelDesignado = (typeof PAPEIS_DESIGNADOS)[number];

/** Configuração da OSC (aba ConfigProjetos), já em valores prontos para uso. */
export interface ConfigProjetos {
  /** Valor acima do qual a decisão sobe para a Presidência ou o Conselho; null = sem alçada. */
  limiteAlcada: number | null;
  /** Pareceres exigidos na porta 1, por porte. */
  pareceresPorta1: Record<Porte, TipoParecer[]>;
  /** E-mails designados, por papel. */
  designados: Record<PapelDesignado, string[]>;
  /** Se quem propôs a ideia pode decidir a própria porta. */
  proponenteDecide: boolean;
  /** Tolerâncias sugeridas no Termo de Abertura (regra 15); 0 = nenhuma margem. */
  tolerancias: { custoLinhaPct: number; custoTotalPct: number; prazoFimDias: number; prazoMarcoDias: number };
}

export const CONFIG_PADRAO: ConfigProjetos = {
  limiteAlcada: null,
  pareceresPorta1: { completo: ['tecnico', 'financeiro', 'juridico'], enxuto: ['tecnico'] },
  designados: { tecnico: [], financeiro: [], juridico: [], alcada: [] },
  proponenteDecide: false,
  tolerancias: { custoLinhaPct: 0, custoTotalPct: 0, prazoFimDias: 0, prazoMarcoDias: 0 },
};

/** Código sequencial por instituição (PRJ-0001), nunca reaproveitado: `existentes` inclui os inativos. */
export function proximoCodigo(existentes: string[]): string {
  const maior = existentes.reduce((m, c) => Math.max(m, /^PRJ-(\d+)$/.exec(c) ? Number(c.slice(4)) : 0), 0);
  return `PRJ-${String(maior + 1).padStart(4, '0')}`;
}

/** Regra 8: exigência de alçada, calculada uma vez na abertura da porta. */
export function exigeAlcada(valor: number, limite: number | null): boolean {
  return limite !== null && valor > limite;
}

export function pareceresExigidos(config: ConfigProjetos, porte: Porte): TipoParecer[] {
  return [...config.pareceresPorta1[porte]];
}

/** Regra 9: `com_ressalvas` e `insatisfatorio` exigem texto. */
export function parecerExigeTexto(r: ResultadoParecer): boolean {
  return r !== 'satisfatorio';
}

/** Tipos de parecer ainda não dados. */
export function pareceresFaltando(exigidos: readonly TipoParecer[], dados: readonly TipoParecer[]): TipoParecer[] {
  return exigidos.filter((t) => !dados.includes(t));
}

/** Regra 10: quem propôs não decide a própria porta, salvo se a configuração liberar. */
export function podeDecidirPorta(decisor: string, proponente: string, config: ConfigProjetos): boolean {
  return config.proponenteDecide || decisor.toLowerCase() !== proponente.toLowerCase();
}

export interface DestinoDaDecisao {
  situacaoPorta: SituacaoPorta;
  /** Etapa do projeto depois da decisão (null = continua em porta). */
  etapa: Etapa | null;
}

/**
 * Regras 11 e 12. `seguir` da Diretoria com alçada exigida sobe e espera; `ajustar` e `parar` da
 * Diretoria valem sem subir. A decisão da alçada é final.
 */
export function destinoDaDecisao(nivel: NivelDecisao, decisao: Decisao, exigeAlcadaNaPorta: boolean, porta: TipoPorta = 'ideia'): DestinoDaDecisao {
  if (nivel === 'diretoria' && decisao === 'seguir' && exigeAlcadaNaPorta) return { situacaoPorta: 'aguardando_alcada', etapa: null };
  const [seguir, ajustar]: [Etapa, Etapa] = porta === 'ideia' ? ['fase_1', 'ideia'] : porta === 'termo' ? ['fase_3', 'fase_2'] : ['implementacao', 'fase_3'];
  return { situacaoPorta: 'decidida', etapa: decisao === 'seguir' ? seguir : decisao === 'ajustar' ? ajustar : 'parado' };
}

/** E-mails separados por vírgula, ponto e vírgula ou quebra de linha: minúsculos, sem repetição. */
export function lerEmails(texto: string): string[] {
  const lista = texto
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const e of lista) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ErroProjetos(`"${e}" não parece um e-mail válido.`);
  return [...new Set(lista)];
}

/**
 * Etapa em que o projeto aceita compras (requisição ligada ao projeto): só o projeto em implementação,
 * isto é, com o Termo aprovado. A etapa "implementacao" chega com as entregas P2 a P4; até lá nenhum projeto aceita.
 */
export const aceitaCompra = (etapa: string): boolean => etapa === 'implementacao';
