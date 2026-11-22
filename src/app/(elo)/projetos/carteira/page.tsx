import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerCarteira, VISOES_CARTEIRA, type VisaoCarteira } from '@/modulos/projetos/aplicacao/carteira';
import { EtiquetaEtapa } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { NumeroQueConta } from '@/ui/numero-que-conta';

export const metadata: Metadata = { title: 'Carteira de projetos' };

const ROTULO: Record<VisaoCarteira, { numero: string; lista: string; vazio: string }> = {
  portas: { numero: 'Portas esperando decisão', lista: 'Projetos com porta esperando decisão', vazio: 'Nenhuma porta esperando decisão.' },
  fora: { numero: 'Fora da tolerância', lista: 'Projetos fora da tolerância', vazio: 'Nenhum projeto fora da tolerância.' },
  problemas: { numero: 'Com problema de gravidade alta', lista: 'Projetos com problema de gravidade alta ainda sem solução', vazio: 'Nenhum problema de gravidade alta em aberto.' },
  atrasados: { numero: 'Encerramentos atrasados', lista: 'Projetos com encerramento atrasado', vazio: 'Nenhum encerramento atrasado.' },
  andamento: { numero: 'Projetos em andamento', lista: 'Projetos em andamento', vazio: 'Nenhum projeto em andamento.' },
};
const ORDEM: VisaoCarteira[] = ['portas', 'fora', 'problemas', 'atrasados', 'andamento'];

export default async function Carteira({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('projetos.carteira')) redirect('/projetos');
  const { ver } = await searchParams;
  const visao = (VISOES_CARTEIRA as readonly string[]).includes(ver ?? '') ? (ver as VisaoCarteira) : 'andamento';
  const { planilhas } = await obterAplicacao();
  const carteira = await lerCarteira(planilhas, usuario.autorizador);
  const linhas = carteira.listas[visao];
  return (
    <div className="space-y-6">
      <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Carteira' }]} titulo="Carteira de projetos" descricao="O que pede ação agora. Escolha um número para ver os projetos." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ORDEM.map((v) => (
          <li key={v}>
            <Link href={`/projetos/carteira?ver=${v}`} aria-current={v === visao ? 'true' : undefined} className={`block h-full rounded-cartao border px-4 py-3 hover:border-destaque ${v === visao ? 'border-destaque bg-superficie-2' : 'border-borda bg-superficie'}`}>
              <span className="block text-3xl font-bold">
                <NumeroQueConta texto={String(carteira.numeros[v])} />
              </span>
              <span className="block text-sm text-texto-suave">{ROTULO[v].numero}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Secao id="t-lista" titulo={ROTULO[visao].lista} descricao="Só aparecem os projetos que você pode ver. Os pareceres não aparecem aqui.">
        {linhas.length === 0 ? (
          <EstadoVazio titulo="Nada aqui.">{ROTULO[visao].vazio}</EstadoVazio>
        ) : (
          <ul className="divide-y divide-borda">
            {linhas.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/projetos/${r.id}`} className="font-semibold text-destaque hover:underline">
                    {r.codigo}
                  </Link>
                  <span>{r.titulo}</span>
                  <EtiquetaEtapa etapa={r.etapa} />
                </div>
                <p className="text-sm text-texto-suave">Responsável: {r.responsavel ?? 'sem responsável'}</p>
                {r.motivos.length > 0 && (
                  <ul className="list-disc pl-5 text-sm">
                    {r.motivos.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
