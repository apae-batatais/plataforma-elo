/** Mensagem de resultado de uma ação (sucesso ou erro), vinda do endereço da página. */
export function Mensagem({ ok, erro }: { ok?: string; erro?: string }) {
  if (erro) {
    return (
      <p role="alert" className="rounded-md bg-aviso-fundo p-3 text-sm text-aviso">
        {erro}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="rounded-md bg-destaque-suave p-3 text-sm">
        {ok}
      </p>
    );
  }
  return null;
}

export const estiloCampo = 'w-full rounded-md border border-borda bg-superficie px-3 py-2';
export const estiloBotao = 'rounded-md bg-destaque px-4 py-2 font-medium text-white hover:opacity-90';
export const estiloBotaoSecundario = 'rounded-md border border-borda px-3 py-1.5 text-sm hover:bg-destaque-suave';
