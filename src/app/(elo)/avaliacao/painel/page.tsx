import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { painelDaAvaliacao, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { PainelCompleto } from '@/modulos/avaliacao/telas/painel-completo';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Painel da Avaliação de Serviços Sociais' };

const MES = /^\d{4}-\d{2}$/;

export default async function PainelAvaliacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; servico?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.painel)) redirect('/avaliacao');
  const app = await obterAplicacao();
  const de = sp.de && MES.test(sp.de) ? sp.de : '';
  const ate = sp.ate && MES.test(sp.ate) ? sp.ate : '';
  const servico = sp.servico ?? '';
  const p = await painelDaAvaliacao(app.planilhas, usuario.autorizador, { de, ate, servico });
  const filtros = new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(servico ? { servico } : {}) });
  const filtrado = Boolean(de || ate || servico);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' }, { rotulo: 'Painel' }]}
        titulo="Painel por serviço atual"
        descricao={
          p.todos
            ? 'Números das avaliações de todos os serviços. Nenhuma pessoa é identificada aqui.'
            : 'Números das avaliações dos serviços do seu escopo. Nenhuma pessoa é identificada aqui.'
        }
        acoes={
          p.total > 0 && (
            <LinkBotao href={`/avaliacao/painel/imprimir${filtros.size ? `?${filtros}` : ''}`} variante="secundario">
              Imprimir painel
            </LinkBotao>
          )
        }
      />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-cartao border border-borda bg-superficie px-5 py-3">
        <Campo rotulo="Serviço">
          <select name="servico" defaultValue={servico} className={`${estiloEntrada} w-64 !mt-1`}>
            <option value="">Todos</option>
            {p.servicosDisponiveis.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="De (mês)">
          <input type="month" name="de" defaultValue={de} className={`${estiloEntrada} w-40 !mt-1`} />
        </Campo>
        <Campo rotulo="Até (mês)">
          <input type="month" name="ate" defaultValue={ate} className={`${estiloEntrada} w-40 !mt-1`} />
        </Campo>
        <BotaoEnviar variante="secundario" enviando="Calculando…">
          Aplicar
        </BotaoEnviar>
        {filtrado && (
          <Link href="/avaliacao/painel" className="min-h-10 content-center px-2 text-sm font-semibold text-destaque underline-offset-2 hover:underline">
            Limpar filtros
          </Link>
        )}
      </form>

      {p.total === 0 ? (
        <EstadoVazio titulo={filtrado ? 'Nenhuma avaliação com esses filtros' : 'Nenhuma avaliação salva ainda'}>
          {filtrado ? 'Mude o serviço ou o período.' : 'Os números aparecem aqui assim que as primeiras avaliações forem salvas.'}
        </EstadoVazio>
      ) : (
        <PainelCompleto p={p} />
      )}
    </div>
  );
}
