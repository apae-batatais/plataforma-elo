import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { painelDeEducacao } from '@/modulos/educacao/aplicacao/painel';
import { PainelEducacao } from '@/modulos/educacao/telas/painel-educacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Painel de Educação' };

const MES = /^\d{4}-\d{2}$/;

export default async function PainelDeEducacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; servico?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.painel)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  const de = sp.de && MES.test(sp.de) ? sp.de : '';
  const ate = sp.ate && MES.test(sp.ate) ? sp.ate : '';
  const servico = sp.servico ?? '';
  const p = await painelDeEducacao(app.planilhas, usuario.autorizador, { de, ate, servico });
  const filtrado = Boolean(de || ate || servico);
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Educação', href: '/educacao' }, { rotulo: 'Painel' }]}
        titulo="Painel de Educação"
        descricao={
          p.todos
            ? 'Números das avaliações de todos os serviços de Educação. Nenhuma pessoa é identificada aqui.'
            : 'Números das avaliações dos serviços de Educação do seu escopo. Nenhuma pessoa é identificada aqui.'
        }
      />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-cartao border border-borda bg-superficie px-5 py-3">
        <Campo rotulo="Serviço">
          <select name="servico" defaultValue={servico} className={`${estiloEntrada} w-64 !mt-1`}>
            <option value="">Todos</option>
            {p.servicosDisponiveis.map((s) => (
              <option key={s.codigo} value={s.codigo}>{s.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="De (mês)">
          <input type="month" name="de" defaultValue={de} className={`${estiloEntrada} w-40 !mt-1`} />
        </Campo>
        <Campo rotulo="Até (mês)">
          <input type="month" name="ate" defaultValue={ate} className={`${estiloEntrada} w-40 !mt-1`} />
        </Campo>
        <BotaoEnviar variante="secundario" enviando="Calculando…">Aplicar</BotaoEnviar>
        {filtrado && (
          <Link href="/educacao/painel" className="min-h-10 content-center px-2 text-sm font-semibold text-destaque underline-offset-2 hover:underline">
            Limpar filtros
          </Link>
        )}
      </form>
      <PainelEducacao p={p} />
    </div>
  );
}
