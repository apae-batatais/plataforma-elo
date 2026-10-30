/**
 * Identidade do Elo, a plataforma de gestão das Apaes: dois elos de corrente
 * entrelaçados (amarelo e azul). O amarelo é o mesmo da faixa de destaque da
 * interface; o azul é o das ações. O nome da Apae aparece sempre junto.
 */
export const NOME_PLATAFORMA = 'Elo';

/** Só o símbolo. `fundo` é a cor por trás dele: os cruzamentos são recortados nessa cor. */
export function SimboloElo({ tamanho = 36, fundo = '#1f1f1e', comPlaca = false }: { tamanho?: number; fundo?: string; comPlaca?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false">
      {comPlaca && <rect width="64" height="64" rx="14" fill={fundo} />}
      <circle cx="24.5" cy="32" r="12.5" fill="none" stroke="#f2c230" strokeWidth="6"/>
        <circle cx="39.5" cy="32" r="12.5" fill="none" stroke="#6da7ec" strokeWidth="6"/>
        <path d="M28.78 20.25 A12.5 12.5 0 0 1 34.86 25.01" fill="none" stroke={fundo} strokeWidth="10"/>
        <path d="M27.1 19.77 A12.5 12.5 0 0 1 35.73 26.52" fill="none" stroke="#f2c230" strokeWidth="6"/>
        <path d="M35.22 43.75 A12.5 12.5 0 0 1 29.14 38.99" fill="none" stroke={fundo} strokeWidth="10"/>
        <path d="M36.9 44.23 A12.5 12.5 0 0 1 28.27 37.48" fill="none" stroke="#6da7ec" strokeWidth="6"/>
    </svg>
  );
}

/** Símbolo + "Elo" + nome da Apae, para fundos escuros (barra lateral, tela de entrada). */
export function MarcaElo({ instituicao, grande = false }: { instituicao: string; grande?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-white">
      <SimboloElo tamanho={grande ? 48 : 38} />
      <span className="leading-tight">
        <span className={`block font-bold tracking-tight ${grande ? 'text-2xl' : 'text-xl'}`}>{NOME_PLATAFORMA}</span>
        <span className={`block text-lateral-suave ${grande ? 'text-sm' : 'text-xs'}`}>{instituicao}</span>
      </span>
    </span>
  );
}

/** Versão da aplicação: número + início do código da publicação (preenchidos na montagem). */
export function textoVersao(): string {
  const versao = process.env.NEXT_PUBLIC_VERSAO ?? 'dev';
  const commit = process.env.NEXT_PUBLIC_COMMIT;
  return `versão ${versao}${commit ? ` (${commit})` : ''}`;
}
