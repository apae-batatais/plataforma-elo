import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarProjetos } from '@/modulos/projetos/aplicacao/ideias';
import { pendenciasDe } from '@/modulos/projetos/aplicacao/portas';
import { ListaProjetos } from '@/modulos/projetos/telas/lista-projetos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Meus projetos e ideias' };

export default async function MeusProjetos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const [linhas, pendencias] = await Promise.all([listarProjetos(planilhas, usuario.autorizador, 'meus'), pendenciasDe(planilhas, usuario.autorizador)]);
  const nova = usuario.autorizador.temPermissaoAlgumEscopo('projetos.propor') ? (
    <LinkBotao href="/projetos/nova" variante="primario">
      Nova ideia
    </LinkBotao>
  ) : undefined;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos' }]}
        titulo="Meus projetos e ideias"
        descricao="As ideias que você propôs e os projetos de que você é responsável."
        acoes={linhas.length > 0 ? nova : undefined}
      />
      {pendencias.length > 0 && (
        <Secao id="t-espera" titulo="Espera uma ação sua" descricao="Pareceres e decisões que dependem de você.">
          <ul className="divide-y divide-borda">
            {pendencias.map((x) => (
              <li key={`${x.portaId}-${x.detalhe}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{x.codigo}</span> · {x.titulo}
                  <span className="block text-sm text-texto-suave">{x.detalhe}</span>
                </span>
                <Link href={`/projetos/${x.projetoId}`} className="font-semibold text-destaque hover:underline">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {linhas.length === 0 ? (
        <EstadoVazio titulo="Você ainda não tem ideias nem projetos" acao={nova}>
          Cadastre uma ideia de projeto. Uma coordenação assume como responsável e a ideia segue para as portas de decisão.
        </EstadoVazio>
      ) : (
        <ListaProjetos linhas={linhas} legenda="Meus projetos e ideias" vazio="Nenhum projeto." />
      )}
    </div>
  );
}
