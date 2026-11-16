/**
 * Comparação entre ciclos da mesma pessoa e instrumento (regra 2: só soma
 * ciclos da mesma versão e avisa quando as versões diferem).
 */
import { calcularEscore, type Escore, type Respostas } from './escore';
import type { Instrumento } from './instrumento';

export interface CicloFechado {
  id: string;
  /** Data do ciclo, AAAA-MM-DD. */
  data: string;
  versao: number;
  respostas: Respostas;
}

export interface PontoDoComparativo {
  id: string;
  data: string;
  versao: number;
  escore: Escore;
}

export interface Comparativo {
  /** Do mais antigo ao mais recente, só da versão comparada. */
  pontos: PontoDoComparativo[];
  /** Versão usada na comparação (a mais recente). */
  versao: number | null;
  /** Ciclos de outras versões, deixados de fora. */
  deOutraVersao: number;
  avisoDeVersoes: string | null;
  /** Último total menos o primeiro; positivo = total maior. null com menos de 2 ciclos. */
  diferencaDoTotal: number | null;
}

/** `instrumentos` traz o instrumento de cada versão usada pelos ciclos. */
export function compararCiclos(instrumentos: Instrumento[], ciclos: CicloFechado[]): Comparativo {
  const ordenados = [...ciclos].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  if (ordenados.length === 0) {
    return { pontos: [], versao: null, deOutraVersao: 0, avisoDeVersoes: null, diferencaDoTotal: null };
  }
  const versao = ordenados[ordenados.length - 1]!.versao;
  const instrumento = instrumentos.find((i) => i.versao === versao);
  if (!instrumento) throw new Error(`Falta o instrumento na versão ${versao}.`);
  const mesmos = ordenados.filter((c) => c.versao === versao);
  const pontos = mesmos.map((c) => ({ id: c.id, data: c.data, versao: c.versao, escore: calcularEscore(instrumento, c.respostas) }));
  const deOutraVersao = ordenados.length - mesmos.length;
  return {
    pontos,
    versao,
    deOutraVersao,
    avisoDeVersoes: deOutraVersao > 0 ? `${deOutraVersao} avaliação(ões) usaram outra versão do instrumento e não entram na comparação.` : null,
    diferencaDoTotal: pontos.length >= 2 ? pontos[pontos.length - 1]!.escore.total - pontos[0]!.escore.total : null,
  };
}

/** Regra 9: a reavaliação vence 12 meses após a última aplicação fechada (datas AAAA-MM-DD). */
export function vencimentoDaReavaliacao(ultimaFechada: string): string {
  const [a, m, d] = ultimaFechada.split('-').map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a + 1, m - 1, d));
  // 29/02 em ano seguinte não bissexto vira 28/02, não 01/03.
  if (alvo.getUTCMonth() !== m - 1) alvo.setUTCDate(0);
  return alvo.toISOString().slice(0, 10);
}
