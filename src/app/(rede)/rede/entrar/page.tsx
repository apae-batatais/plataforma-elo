import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { configGeral } from '@/plataforma/instituicao';
import { administradorDaRedeLogado, aplicacaoDaRedeAtual } from '@/plataforma/sessao-rede';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { BotaoGoogle } from '../../../(elo)/entrar/botao-google';
import { acaoEntrarRedeComGoogle, acaoEntrarRedeDemonstracao } from '../acoes';

export const metadata: Metadata = { title: 'Entrar' };

export default async function EntrarNaRede() {
  if (await administradorDaRedeLogado()) redirect('/rede');
  const g = configGeral();
  const app = await aplicacaoDaRedeAtual();
  return (
    <section className="mx-auto max-w-md space-y-5 py-8">
      <div>
        <h1 className="text-2xl font-bold">Administração da rede</h1>
        <p className="mt-1.5 text-texto-suave">
          Cadastro e acompanhamento das instituições que usam o Elo. Só para a equipe da Operadora; quem trabalha numa instituição entra pelo endereço dela.
        </p>
      </div>
      {g.modo === 'producao' && app ? (
        <>
          <p className="text-sm text-texto-suave">Use a sua conta Google da Operadora, terminada em @{app.rede.dominio}.</p>
          <BotaoGoogle clientId={g.googleClientId} dominio={app.rede.dominio} acao={acaoEntrarRedeComGoogle} destino="/rede" />
        </>
      ) : (
        <form action={acaoEntrarRedeDemonstracao}>
          <BotaoEnviar enviando="Entrando…" className="w-full">
            Entrar como Administração da rede (fictícia)
          </BotaoEnviar>
        </form>
      )}
    </section>
  );
}
