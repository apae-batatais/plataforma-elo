import { estiloBotao, pequeno } from '@/ui/botao';

/** Link de download (CSV). Desligado, com dica, quando não há nada para baixar. */
export function BotaoBaixar({ href, rotulo, vazio }: { href: string; rotulo: string; vazio?: boolean }) {
  if (vazio) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title="Nada para baixar ainda"
        className={estiloBotao('fantasma', `${pequeno} cursor-not-allowed opacity-50`)}
      >
        {rotulo}
      </span>
    );
  }
  return (
    <a href={href} download className={estiloBotao('fantasma', pequeno)}>
      {rotulo}
    </a>
  );
}
