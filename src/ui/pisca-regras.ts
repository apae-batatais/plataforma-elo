/**
 * Regra do "pisca onde mudou" (peça `PiscaOndeMudou`), sem tela, para poder testar.
 * Pisca só quando a tela chega depois de uma gravação E o conteúdo é diferente do que a pessoa já tinha visto.
 */

/** Por quanto tempo a marca "acabou de gravar" vale (milissegundos). */
export const VALIDADE_DA_MARCA = 8000;
export const MARCA_DE_GRAVACAO = 'elo.gravou';

/** A tela chegou de uma gravação? Vale o `?ok=` no endereço ou a marca guardada há pouco. */
export function chegouDeGravacao(busca: string, marca: string | null, agora: number): boolean {
  if (new URLSearchParams(busca).has('ok')) return true;
  const quando = Number(marca);
  return Number.isFinite(quando) && quando > 0 && agora - quando >= 0 && agora - quando <= VALIDADE_DA_MARCA;
}

/** Decide se o trecho pisca. `visto` é o último texto visto desta chave nesta página (null = nunca visto). */
export function deveFicarPiscando(visto: string | null, atual: string, gravou: boolean): boolean {
  return gravou && visto !== null && visto !== atual;
}

/** Chave guardada no navegador: página + chave do trecho (a chave é id de registro, nunca nome de pessoa). */
export const chaveGuardada = (caminho: string, chave: string) => `elo.visto:${caminho}:${chave}`;
