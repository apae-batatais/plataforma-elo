import { Aviso } from '@/ui/aviso';

/** Tela mostrada quando a configuração ou o acesso às planilhas tem problema. */
export function ConfiguracaoInvalida({ mensagem, titulo = 'A plataforma precisa de um ajuste na configuração' }: { mensagem: string; titulo?: string }) {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-[1.75rem] font-bold leading-tight">{titulo}</h1>
      <Aviso tipo="atencao">{mensagem}</Aviso>
      <p className="text-texto-suave">Depois de corrigir, recarregue esta página. Se a correção foi numa variável da Netlify, é preciso publicar de novo.</p>
    </section>
  );
}
