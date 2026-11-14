/**
 * Formato comum da agenda única e da busca única (ADR-024).
 *
 * Cada módulo devolve itens neste formato; quem decide o que a pessoa pode ver é o próprio módulo.
 * A plataforma só junta, ordena e entrega às telas.
 */

/** Um compromisso da agenda. Nunca traz valor financeiro nem dado pessoal além do que o app já mostra. */
export interface ItemDaAgenda {
  /** Id do módulo de origem (`projetos`, `parcerias`…). */
  app: string;
  /** Texto curto do tipo, para o filtro e a leitura ("Fim do termo"). */
  tipo: string;
  /** Título pronto para a tela, sem rótulo técnico. */
  titulo: string;
  /** Dia (AAAA-MM-DD), ou `null` quando o item só tem o mês. */
  data: string | null;
  /** Último dia, quando o item é um período (ex.: tema do calendário). */
  ate: string | null;
  /** Mês (AAAA-MM) quando o item só tem o mês (ex.: parcela). */
  mes: string | null;
  /** Serviço (código do Núcleo), quando o item é de um serviço. */
  servico: string | null;
  /** Endereço do registro no app. */
  href: string;
  /** Prazo que, passado e ainda em aberto, é "vencido" (regra 4). Tema, início e parcela não vencem. */
  vencivel: boolean;
}

export interface OpcoesDaAgenda {
  agora: Date;
}

/** Um registro encontrado pela busca. */
export interface ResultadoDaBusca {
  app: string;
  tipo: string;
  titulo: string;
  /** Linha de apoio (situação, serviço ou código). */
  apoio: string | null;
  href: string;
}

export const MAX_RESULTADOS_POR_APP = 20;
export const MINIMO_DE_LETRAS = 2;

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Termo pronto para comparar: sem acento, minúsculo, espaços únicos. */
export const termoDeBusca = (t: string) => semAcento(t).replace(/\s+/g, ' ').trim();

/** O texto contém o termo (já normalizado por `termoDeBusca`)? Ignora maiúsculas e acentos. */
export const contem = (texto: string | null | undefined, termo: string) => !!texto && semAcento(texto).includes(termo);

/** Dia de hoje (AAAA-MM-DD) no horário de Brasília. */
export const hojeEmBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
