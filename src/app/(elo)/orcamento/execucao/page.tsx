import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerRealizadoDoAno } from '@/modulos/orcamento/aplicacao/realizado';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Realizado do ano' };

export default async function RealizadoDoAnoPagina({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const r = await lerRealizadoDoAno(app.planilhas, usuario.autorizador, Number((await searchParams).ano) || undefined);
  const podeInformar = usuario.autorizador.temPermissao('orcamento.realizado.editar');

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Execução' }, { rotulo: 'Realizado do ano' }]}
        titulo={`Realizado de ${r.ano}`}
        descricao="Mês a mês: despesa, receita e resultado do que foi informado. Mês sem informação aparece como “sem dado”, nunca como zero."
        acoes={
          <>
            <LinkBotao href={`/orcamento/execucao/painel?ano=${r.ano}`} variante="secundario">
              Ver o painel
            </LinkBotao>
            {r.anos.length > 1 ? (
            <nav aria-label="Ano" className="flex gap-2">
              {r.anos.map((a) => (
                <Link key={a} href={`/orcamento/execucao?ano=${a}`} aria-current={a === r.ano ? 'page' : undefined} className={a === r.ano ? 'font-bold underline' : 'underline'}>
                  {a}
                </Link>
              ))}
            </nav>
            ) : null}
          </>
        }
      />
      {r.escopoParcial && <Aviso tipo="info">Você vê só o realizado dos serviços do seu escopo. As receitas não aparecem.</Aviso>}
      <div className={tabela.moldura}>
        <table className={`${tabela.tabela} min-w-[36rem]`}>
          <thead className={tabela.cabeca}>
            <tr>
              <th className={tabela.th}>Mês</th>
              <th className={`${tabela.th} text-right`}>Despesa</th>
              {r.incluiReceita && <th className={`${tabela.th} text-right`}>Receita</th>}
              {r.incluiReceita && <th className={`${tabela.th} text-right`}>Resultado</th>}
              <th className={tabela.th}>Números</th>
            </tr>
          </thead>
          <tbody>
            {r.meses.map((m, i) => (
              <tr key={m.mes} className={tabela.linha}>
                <th scope="row" className={`${tabela.td} font-normal`}>{MESES[i]}</th>
                {m.totais ? (
                  <>
                    <td className={`${tabela.td} ${tabela.numero}`}>{reais(m.totais.despesa)}</td>
                    {r.incluiReceita && <td className={`${tabela.td} ${tabela.numero}`}>{reais(m.totais.receita)}</td>}
                    {r.incluiReceita && <td className={`${tabela.td} ${tabela.numero}`}>{reais(m.totais.resultado)}</td>}
                  </>
                ) : (
                  <td colSpan={r.incluiReceita ? 3 : 1} className={`${tabela.td} text-texto-suave`}>sem dado</td>
                )}
                <td className={tabela.td}>
                  {m.informado && !r.escopoParcial ? (
                    <Link href={`/orcamento/execucao/realizado?mes=${m.mes}`} className="underline">
                      Ver os números
                    </Link>
                  ) : podeInformar ? (
                    <Link href={`/orcamento/execucao/realizado?mes=${m.mes}`} className="underline">
                      Informar
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-superficie-2 font-bold">
              <th scope="row" className={tabela.td}>Total dos meses informados</th>
              <td className={`${tabela.td} ${tabela.numero}`}>{reais(r.total.despesa)}</td>
              {r.incluiReceita && <td className={`${tabela.td} ${tabela.numero}`}>{reais(r.total.receita)}</td>}
              {r.incluiReceita && <td className={`${tabela.td} ${tabela.numero}`}>{reais(r.total.resultado)}</td>}
              <td className={tabela.td} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
