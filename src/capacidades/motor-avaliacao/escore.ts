/**
 * Respostas, escore por domínio e total, enquadramento e principal barreira.
 * Tudo é calculado na leitura; nada disso é guardado.
 */
import { VALOR_MAXIMO, VALOR_MINIMO, type Faixa, type Instrumento } from './instrumento';

export const NAO_SE_APLICA = 'nao_se_aplica' as const;
export type Resposta = number | typeof NAO_SE_APLICA;
/** Respostas por número do item. */
export type Respostas = Record<number, Resposta | undefined>;

/** Confere uma resposta isolada; devolve o motivo da recusa ou null. */
export function recusaDeResposta(instrumento: Instrumento, numero: number, valor: unknown): string | null {
  const item = instrumento.itens.find((i) => i.numero === numero);
  if (!item) return `O item ${numero} não existe neste instrumento.`;
  if (valor === NAO_SE_APLICA) return item.permiteNaoSeAplica ? null : `O item ${numero} não aceita "não se aplica".`;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < VALOR_MINIMO || valor > VALOR_MAXIMO) {
    return `A resposta do item ${numero} deve ser um número inteiro de ${VALOR_MINIMO} a ${VALOR_MAXIMO}.`;
  }
  return null;
}

/** Números dos itens ainda sem resposta (aplicação só fecha quando a lista está vazia). */
export function itensSemResposta(instrumento: Instrumento, respostas: Respostas): number[] {
  return instrumento.itens.filter((i) => respostas[i.numero] === undefined).map((i) => i.numero);
}

export interface EscoreDominio {
  codigo: string;
  nome: string;
  pontos: number;
  /** Itens que entraram na soma (sem os "não se aplica"). */
  itensConsiderados: number;
  /** Pontos máximos possíveis considerando só os itens considerados. */
  maximo: number;
  /** Percentual dos pontos possíveis (0 a 100); null se nenhum item foi considerado. */
  percentual: number | null;
}

export interface Escore {
  dominios: EscoreDominio[];
  total: number;
  itensConsiderados: number;
  maximo: number;
  /** Faixa em que o total cai, ou null se houver item sem resposta ou total fora das faixas. */
  enquadramento: Faixa | null;
  completo: boolean;
}

/** Calcula o escore. Itens sem resposta não somam e deixam o escore "incompleto". */
export function calcularEscore(instrumento: Instrumento, respostas: Respostas): Escore {
  for (const item of instrumento.itens) {
    const motivo = respostas[item.numero] === undefined ? null : recusaDeResposta(instrumento, item.numero, respostas[item.numero]);
    if (motivo) throw new Error(motivo);
  }
  const dominios = instrumento.dominios.map<EscoreDominio>((d) => {
    let pontos = 0;
    let considerados = 0;
    for (const item of instrumento.itens.filter((i) => i.dominio === d.codigo)) {
      const r = respostas[item.numero];
      if (typeof r === 'number') {
        pontos += r;
        considerados += 1;
      }
    }
    const maximo = considerados * VALOR_MAXIMO;
    return {
      codigo: d.codigo,
      nome: d.nome,
      pontos,
      itensConsiderados: considerados,
      maximo,
      percentual: maximo === 0 ? null : (pontos / maximo) * 100,
    };
  });
  const total = dominios.reduce((s, d) => s + d.pontos, 0);
  const completo = itensSemResposta(instrumento, respostas).length === 0;
  const naFaixa = instrumento.faixas.find((f) => total >= f.de && total <= f.ate) ?? null;
  return {
    dominios,
    total,
    itensConsiderados: dominios.reduce((s, d) => s + d.itensConsiderados, 0),
    maximo: dominios.reduce((s, d) => s + d.maximo, 0),
    enquadramento: completo ? naFaixa : null,
    completo,
  };
}

/**
 * Domínio(s) de menor percentual do máximo ("principal barreira" de Educação e Saúde/CER).
 * Em empate devolve todos; ignora domínios sem item considerado.
 */
export function dominiosDeMenorPercentual(escore: Escore): EscoreDominio[] {
  const validos = escore.dominios.filter((d) => d.percentual !== null);
  if (validos.length === 0) return [];
  const menor = Math.min(...validos.map((d) => d.percentual!));
  return validos.filter((d) => Math.abs(d.percentual! - menor) < 1e-9);
}

/** Regra 5: fechar exige justificativa do enquadramento não vazia. */
export function recusaDeFechamento(instrumento: Instrumento, respostas: Respostas, justificativa: string): string | null {
  const faltam = itensSemResposta(instrumento, respostas);
  if (faltam.length > 0) return `Faltam responder os itens: ${faltam.join(', ')}.`;
  if (justificativa.trim() === '') return 'Escreva a justificativa do enquadramento.';
  return null;
}
