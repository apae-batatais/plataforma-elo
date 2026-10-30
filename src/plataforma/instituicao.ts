/**
 * Dados da instituição (Apae) que está usando a plataforma.
 * Hoje há uma só (Apae Batatais). Quando a plataforma atender várias Apaes,
 * este é o único ponto que passa a descobrir a Apae pelo endereço acessado.
 */
export interface Instituicao {
  /** Nome curto, como aparece na interface (ex.: "Apae Batatais"). */
  nome: string;
  /** Razão social. */
  nomeCompleto: string;
}

export function instituicaoAtual(): Instituicao {
  return { nome: 'Apae Batatais', nomeCompleto: 'Associação de Pais e Amigos dos Excepcionais de Batatais' };
}
