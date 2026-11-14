import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MINIMO_DE_LETRAS } from '@/nucleo/modulos/agenda-busca';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { APP_PESSOAS, buscarTudo } from '@/plataforma/busca';
import { iconeDoApp } from '@/plataforma/icones-dos-apps';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { estiloBotao } from '@/ui/botao';
import { ICONES } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Busca' };

const POR_APP = 5;

export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string; todos?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const { planilhas } = await obterAplicacao();
  const { q = '', todos } = await searchParams;
  const termo = q.trim().slice(0, 100);
  const busca = termo ? await buscarTudo(planilhas, usuario.autorizador, termo) : null;
  const href = (extra: Record<string, string>) => `/busca?${new URLSearchParams({ q: termo, ...extra })}`;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Busca' }]}
        titulo="Busca"
        descricao="Projetos, termos, requisições, pedidos e pessoas que o seu perfil já pode ver. Use o campo no alto da página."
      />

      {!busca && (
        <EstadoVazio titulo="O que você procura?">
          Digite no campo de busca, no alto da página, parte do título, do número ou do nome. Dica: aperte a tecla “/” para ir direto ao campo.
        </EstadoVazio>
      )}

      {busca?.estado === 'curto' && (
        <Aviso tipo="info" titulo={`Digite ao menos ${MINIMO_DE_LETRAS} letras.`}>
          Com menos letras a busca traria resultado demais.
        </Aviso>
      )}

      {busca?.falhas.map((f) => (
        <Aviso key={f} tipo="atencao">
          Não foi possível ler: {f}. Os outros apps aparecem normalmente.
        </Aviso>
      ))}

      {busca?.estado === 'ok' && busca.total === 0 && (
        <EstadoVazio titulo={`Nada encontrado para “${termo}”.`}>Tente com menos letras ou outra grafia.</EstadoVazio>
      )}

      {busca?.estado === 'ok' && busca.total > 0 && (
        <>
          <p role="status" className="text-texto-suave">
            {busca.total} {busca.total === 1 ? 'resultado' : 'resultados'} para “{termo}”.
          </p>
          {busca.grupos.map((g) => {
            const Icone = ICONES[g.app === APP_PESSOAS ? 'pessoas' : iconeDoApp(g.app)];
            const aberto = todos === g.app;
            const mostrados = aberto ? g.resultados : g.resultados.slice(0, POR_APP);
            return (
              <div key={g.app} data-app={g.app === APP_PESSOAS ? undefined : g.app}>
                <Secao
                  id={`grupo-${g.app}`}
                  titulo={
                    <span className="inline-flex items-center gap-2 text-destaque">
                      <Icone tamanho={20} />
                      <span className="text-texto">{g.nome}</span>
                    </span>
                  }
                >
                  <ul className="space-y-2">
                    {mostrados.map((r, i) => (
                      <li key={`${r.href}-${i}`}>
                        <Link href={r.href} className="cartao-brilho flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-borda bg-superficie px-3 py-2 hover:bg-superficie-2">
                          <span className="min-w-0 flex-1 font-medium text-texto">{r.titulo}</span>
                          {r.apoio && <span className="text-sm text-texto-suave">{r.apoio}</span>}
                          <Etiqueta>{r.tipo}</Etiqueta>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {!aberto && g.resultados.length > POR_APP && (
                    <div className="mt-3">
                      <Link href={href({ todos: g.app })} className={estiloBotao('secundario')}>
                        Mostrar todos os {g.resultados.length}
                      </Link>
                    </div>
                  )}
                </Secao>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
