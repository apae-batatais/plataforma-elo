/**
 * Identidade do Elo, a plataforma de gestão das organizações: dois elos de
 * corrente entrelaçados, em grafite (ADR-015). A marca é neutra; a cor de cada
 * tela vem do app aberto. O nome da instituição aparece sempre junto.
 */
export const NOME_PLATAFORMA = 'Elo';

/** Tons dos dois elos: no tema da página ou sobre o painel grafite (tela de entrada, rede). */
const TONS = {
  tema: { elo1: 'var(--elo-1)', elo2: 'var(--elo-2)', fundo: 'var(--superficie)' },
  escuro: { elo1: '#e6eaf2', elo2: '#8a93a6', fundo: 'var(--lateral)' },
} as const;

export type TomMarca = keyof typeof TONS;

/** Só o símbolo. Os cruzamentos são recortados na cor do fundo por trás dele. */
export function SimboloElo({ tamanho = 36, tom = 'tema', comPlaca = false }: { tamanho?: number; tom?: TomMarca; comPlaca?: boolean }) {
  const { elo1, elo2, fundo } = TONS[tom];
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false" className="shrink-0">
      {comPlaca && <rect width="64" height="64" rx="14" fill={fundo} />}
      <circle cx="24.5" cy="32" r="12.5" fill="none" stroke={elo1} strokeWidth="6" />
      <circle cx="39.5" cy="32" r="12.5" fill="none" stroke={elo2} strokeWidth="6" />
      <path d="M28.78 20.25 A12.5 12.5 0 0 1 34.86 25.01" fill="none" stroke={fundo} strokeWidth="10" />
      <path d="M27.1 19.77 A12.5 12.5 0 0 1 35.73 26.52" fill="none" stroke={elo1} strokeWidth="6" />
      <path d="M35.22 43.75 A12.5 12.5 0 0 1 29.14 38.99" fill="none" stroke={fundo} strokeWidth="10" />
      <path d="M36.9 44.23 A12.5 12.5 0 0 1 28.27 37.48" fill="none" stroke={elo2} strokeWidth="6" />
    </svg>
  );
}

/** Símbolo + "Elo" + nome da instituição. `tom="escuro"` para o painel grafite; `tema` para a barra lateral. */
export function MarcaElo({
  instituicao,
  grande = false,
  tom = 'escuro',
  soSimbolo = false,
}: {
  instituicao: string;
  grande?: boolean;
  tom?: TomMarca;
  soSimbolo?: boolean;
}) {
  const escuro = tom === 'escuro';
  return (
    <span className={`flex items-center gap-2.5 ${escuro ? 'text-white' : 'text-texto'}`}>
      <SimboloElo tamanho={grande ? 48 : 38} tom={tom} />
      {!soSimbolo && (
        <span className="min-w-0 leading-tight">
          <span className={`block font-bold tracking-tight ${grande ? 'text-2xl' : 'text-xl'}`}>{NOME_PLATAFORMA}</span>
          <span className={`block truncate ${escuro ? 'text-lateral-suave' : 'text-texto-suave'} ${grande ? 'text-sm' : 'text-xs'}`}>{instituicao}</span>
        </span>
      )}
    </span>
  );
}

/** Versão da aplicação: número + início do código da publicação (preenchidos na montagem). */
export function textoVersao(): string {
  const versao = process.env.NEXT_PUBLIC_VERSAO ?? 'dev';
  const commit = process.env.NEXT_PUBLIC_COMMIT;
  return `versão ${versao}${commit ? ` (${commit})` : ''}`;
}
