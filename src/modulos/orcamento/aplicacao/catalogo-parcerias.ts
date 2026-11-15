/**
 * Catálogo de Parcerias visto pelo Orçamento (ADR-020). O Orçamento define a forma; quem entrega os dados é a
 * plataforma (`src/plataforma/catalogos.ts`), porque um módulo nunca importa outro. Sem dados pessoais.
 * Parcerias desligado = catálogo vazio: o Orçamento funciona só com recurso próprio.
 */
export interface ParcelaDoCatalogo {
  mes: string;
  valor: number;
}

export interface FonteDoCatalogo {
  id: string;
  nome: string;
  valorAtual: number;
  parcelas: ParcelaDoCatalogo[];
  aportesParcelas: ParcelaDoCatalogo[];
  recursosProprios: number | null;
  permiteRemanejar: boolean;
  categorias: { categoria: string; valor: number }[];
}

export interface TermoDoCatalogo {
  id: string;
  parceiro: string;
  numero: string;
  tipo: string;
  inicio: string;
  fim: string;
  unidadeMeta: string;
  servicos: string[];
  recursosProprios: number | null;
  equipe: { funcao: string; pessoas: number; horasSemanais: number }[];
  fontes: FonteDoCatalogo[];
}

/** Os termos em vigor. A leitura é feita na hora, para refletir aportes novos sem mexer no Orçamento. */
export type CatalogoParcerias = () => Promise<TermoDoCatalogo[]>;

export const SEM_CATALOGO: CatalogoParcerias = async () => [];
