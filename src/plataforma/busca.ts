/**
 * Busca única (ADR-024): chama a busca de cada app e agrupa. Cada app devolve só o que a pessoa já vê.
 * O termo nunca é gravado: nem em auditoria, nem em log.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { MINIMO_DE_LETRAS, termoDeBusca, type ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import { buscarPessoas } from '@/nucleo/pessoas/busca';
import { FONTES } from './fontes-agenda-busca';
import { MODULOS } from './registro-modulos';

export const APP_PESSOAS = 'nucleo';

export interface GrupoDaBusca {
  app: string;
  nome: string;
  resultados: ResultadoDaBusca[];
}

export interface BuscaFeita {
  /** `curto`: menos de 2 letras (nada foi lido). */
  estado: 'curto' | 'ok';
  grupos: GrupoDaBusca[];
  total: number;
  /** Nomes dos apps que não puderam ser lidos. */
  falhas: string[];
}

export async function buscarTudo(
  p: Planilhas,
  quem: Autorizador,
  digitado: string,
  opcoes: { agora?: Date; desligados?: ReadonlySet<string> } = {},
): Promise<BuscaFeita> {
  const termo = termoDeBusca(digitado);
  if (termo.replace(/\s/g, '').length < MINIMO_DE_LETRAS) return { estado: 'curto', grupos: [], total: 0, falhas: [] };
  const fontes = FONTES.filter((f) => f.busca && !opcoes.desligados?.has(f.id) && MODULOS.some((m) => m.id === f.id));
  const nomes = [...fontes.map((f) => MODULOS.find((m) => m.id === f.id)!.nome), 'Pessoas'];
  const ids = [...fontes.map((f) => f.id), APP_PESSOAS];
  const lidas = await Promise.allSettled([...fontes.map((f) => f.busca!(p, quem, termo)), buscarPessoas(p, quem, termo, opcoes.agora)]);
  const grupos: GrupoDaBusca[] = [];
  const falhas: string[] = [];
  lidas.forEach((r, i) => {
    if (r.status === 'rejected') falhas.push(nomes[i]);
    else if (r.value.length) grupos.push({ app: ids[i], nome: nomes[i], resultados: r.value });
  });
  return { estado: 'ok', grupos, total: grupos.reduce((s, g) => s + g.resultados.length, 0), falhas };
}
