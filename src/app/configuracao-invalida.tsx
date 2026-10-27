/** Tela mostrada quando as variáveis da hospedagem estão incompletas ou erradas. */
export function ConfiguracaoInvalida({ mensagem }: { mensagem: string }) {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">A plataforma precisa de um ajuste na configuração</h1>
      <p role="alert" className="rounded-md bg-aviso-fundo p-4 text-aviso">
        {mensagem}
      </p>
      <p className="text-texto-suave">
        Corrija a variável no painel da Netlify (Project configuration → Environment variables) e publique de novo em
        GitHub → Actions → Publicar → Run workflow.
      </p>
    </section>
  );
}
