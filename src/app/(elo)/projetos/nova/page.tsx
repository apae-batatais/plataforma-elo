import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { seriesDeEventos, servicosParaEscolher } from '@/modulos/projetos/aplicacao/ideias';
import { FormularioIdeia } from '@/modulos/projetos/telas/formulario-ideia';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoDeReceitas } from '@/plataforma/ligacoes';
import Link from 'next/link';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarIdeia } from '../acoes';

export const metadata: Metadata = { title: 'Nova ideia' };

export default async function NovaIdeia({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const curto = (await searchParams).tipo === 'captacao';
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('projetos.propor')) redirect('/projetos');
  const { planilhas } = await obterAplicacao();
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Nova ideia' }]}
        titulo="Nova ideia"
        descricao={curto ? 'Evento de captação: modelo curto. Você pode salvar como rascunho ou enviar para uma coordenação assumir como responsável.' : 'Conte a ideia. Você pode salvar como rascunho ou enviar para uma coordenação assumir como responsável.'}
      />
      <p className="mb-4 text-sm">
        {curto ? (
          <Link href="/projetos/nova" className="font-medium text-destaque hover:underline">Não é um evento de captação? Voltar ao formulário completo</Link>
        ) : (
          <Link href="/projetos/nova?tipo=captacao" className="font-medium text-destaque hover:underline">É um evento de captação (leilão, bazar, festa, campanha)? Use o modelo curto</Link>
        )}
      </p>
      <FormularioIdeia
        acao={acaoSalvarIdeia}
        servicos={await servicosParaEscolher(planilhas)}
        evento={curto ? await opcoesDoEvento(planilhas, usuario.autorizador) : undefined}
        valores={curto ? { titulo: '', resumo: '', tipo: 'captacao', porte: 'enxuto', valorEstimado: null, servico: null } : undefined}
      />
    </div>
  );
}

async function opcoesDoEvento(planilhas: Awaited<ReturnType<typeof obterAplicacao>>['planilhas'], quem: NonNullable<Awaited<ReturnType<typeof usuarioLogado>>>['autorizador']) {
  const fontes = await catalogoDeReceitas(planilhas)?.fontesProprias(quem).catch(() => null);
  return { series: await seriesDeEventos(planilhas, quem), fontes: fontes ?? null };
}
