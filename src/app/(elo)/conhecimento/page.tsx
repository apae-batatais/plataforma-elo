import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarBiblioteca, type ResumoPublicacao } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { EtiquetaDaPessoa, FALTA, formatarData } from '@/modulos/conhecimento/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Base de Conhecimento' };

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pilula = (ativa: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${ativa ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie text-texto hover:bg-superficie-2'}`;

export default async function Biblioteca({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const { q = '', categoria = '' } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const todas = await listarBiblioteca(planilhas, usuario.autorizador);
  const pendentes = todas.filter((x) => x.minhaSituacao === 'pendente' || x.minhaSituacao === 'precisa_renovar');
  const categorias = [...new Map(todas.map((x) => [x.categoria, x.categoriaNome])).entries()];
  const busca = normal(q.trim());
  const lista = todas.filter((x) => (!categoria || x.categoria === categoria) && (!busca || normal(x.titulo).includes(busca)));
  const publica = usuario.autorizador.temPermissao('conhecimento.publicar');
  const endereco = (cat: string) => {
    const s = new URLSearchParams();
    if (cat) s.set('categoria', cat);
    if (q) s.set('q', q);
    return `/conhecimento${s.size ? `?${s}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento' }]}
        titulo="Base de Conhecimento"
        descricao="Comunicados, normas e material de referência da instituição."
        acoes={publica ? <LinkBotao href="/conhecimento/publicacoes/nova">Nova publicação</LinkBotao> : undefined}
      />

      {pendentes.length > 0 && (
        <Secao titulo="Falta você" id="t-falta" descricao="Documentos que pedem a sua ciência.">
          <ul className="divide-y divide-borda">
            {pendentes.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block font-semibold">{x.titulo}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                    {FALTA[x.minhaSituacao]}
                    <EtiquetaDaPessoa situacao={x.minhaSituacao} vencida={x.vencida} />
                  </span>
                </span>
                <LinkBotao href={`/conhecimento/${x.id}`} variante="secundario">
                  Abrir
                </LinkBotao>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {todas.length === 0 ? (
        <EstadoVazio
          titulo="Ainda não há publicações para você"
          acao={publica ? <LinkBotao href="/conhecimento/publicacoes/nova">Nova publicação</LinkBotao> : undefined}
        >
          Quando alguém publicar, aparece aqui.
        </EstadoVazio>
      ) : (
        <>
          <div className="space-y-3">
            <form action="/conhecimento" method="get" role="search" className="flex flex-wrap items-end gap-2">
              {categoria && <input type="hidden" name="categoria" value={categoria} />}
              <label className="block text-sm">
                <span className="font-semibold">Buscar pelo título</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  className="mt-1.5 block min-h-11 w-72 max-w-full rounded-md border border-borda-forte bg-superficie px-3 py-2 text-texto"
                />
              </label>
              <button type="submit" className="min-h-11 rounded-md border border-borda-forte bg-superficie px-4 text-sm font-semibold hover:bg-destaque-suave">
                Buscar
              </button>
            </form>
            <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
              <Link href={endereco('')} aria-current={!categoria ? 'page' : undefined} className={pilula(!categoria)}>
                Todas
              </Link>
              {categorias.map(([codigo, nome]) => (
                <Link key={codigo} href={endereco(codigo)} aria-current={categoria === codigo ? 'page' : undefined} className={pilula(categoria === codigo)}>
                  {nome}
                </Link>
              ))}
            </nav>
          </div>
          {lista.length === 0 ? (
            <EstadoVazio titulo="Nenhuma publicação com esse texto">Limpe a busca para ver todas.</EstadoVazio>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {lista.map((x: ResumoPublicacao) => (
                <li key={x.id} className="cartao-brilho rounded-cartao border border-borda bg-superficie">
                  <Link href={`/conhecimento/${x.id}`} className="block space-y-2 rounded-cartao p-5">
                    <span className="text-xs font-semibold text-texto-suave">{x.categoriaNome}</span>
                    <span className="block text-lg font-bold">{x.titulo}</span>
                    {x.resumo && <span className="block text-sm text-texto-suave">{x.resumo}</span>}
                    <span className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                      <EtiquetaDaPessoa situacao={x.minhaSituacao} vencida={x.vencida} />
                      {x.minhaCienciaEm ? `Ciência em ${formatarData(x.minhaCienciaEm)}` : `Publicada em ${formatarData(x.publicadaEm)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
