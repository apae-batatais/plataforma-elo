import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resumoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Resumo da folha' };

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie px-5 py-4">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{valor}</dd>
      {detalhe && <dd className="mt-0.5 text-sm text-texto-suave">{detalhe}</dd>}
    </div>
  );
}

export default async function ResumoDaFolha({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const r = await resumoFolha(app.planilhas, usuario.autorizador);
  const hoje = new Date();
  const pedido = Number((await searchParams).mes);
  const mes = pedido >= 1 && pedido <= 12 ? pedido : r.ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 1;
  const i = mes - 1;
  const podeCorrigir = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const maior = Math.max(...r.centros.map((c) => c.mensal[i]), 1);
  const pendentes = (r.alertas?.semRateio ?? 0) + (r.alertas?.foraDe100 ?? 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: 'Resumo da folha' }]}
        titulo={`Folha de pagamento ${r.ano}`}
        descricao={
          r.todasAsAreas
            ? 'Custo de salários, benefícios, provisões e encargos, dividido pelos centros de custo conforme o rateio de cada posto.'
            : 'Custo da folha nos centros de custo da sua área. Valores individuais não aparecem para o seu perfil.'
        }
        acoes={podeCorrigir ? <LinkBotao href="/orcamento/postos/novo">Cadastrar posto</LinkBotao> : undefined}
      />

      {pendentes > 0 && (
        <Aviso
          tipo="atencao"
          titulo={`${pendentes} ${pendentes === 1 ? 'posto está' : 'postos estão'} sem rateio válido`}
          acao={podeCorrigir ? <LinkBotao href="/orcamento/rateio?atalho=pendentes" variante="secundario">Corrigir no rateio geral</LinkBotao> : undefined}
        >
          O custo deles ({reais(r.alertas!.custoSemRateio)} no ano) não aparece em nenhum centro de custo e fica fora dos totais abaixo.
        </Aviso>
      )}

      <nav aria-label="Escolher o mês" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1 rounded-lg border border-borda bg-superficie p-1">
          {MESES.map((m, k) => (
            <li key={m}>
              <Link
                href={`/orcamento?mes=${k + 1}`}
                scroll={false}
                aria-current={k === i ? 'true' : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm ${k === i ? 'bg-destaque font-semibold text-sobre-destaque' : 'text-texto-suave hover:bg-destaque-suave hover:text-texto'}`}
              >
                <span aria-hidden="true">{m.slice(0, 3)}</span>
                <span className="sr-only">{m}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador rotulo={`Custo em ${MESES[i].toLowerCase()}`} valor={reais(r.total.mensal[i])} />
        <Indicador rotulo={`Custo no ano de ${r.ano}`} valor={reais(r.total.anual)} detalhe={`Média de ${reais(r.total.anual / 12)} por mês`} />
        {r.alertas && (
          <Indicador
            rotulo="Postos no ano"
            valor={String(r.alertas.postosAtivos)}
            detalhe={`${r.alertas.vagasPrevistas} ${r.alertas.vagasPrevistas === 1 ? 'vaga prevista' : 'vagas previstas'}, ainda sem pessoa`}
          />
        )}
      </dl>

      {r.centros.length === 0 ? (
        r.todasAsAreas ? (
          <EstadoVazio
            titulo="Ainda não há custo de folha registrado"
            acao={podeCorrigir ? <LinkBotao href="/orcamento/importar">Importar a planilha da folha</LinkBotao> : undefined}
          >
            {podeCorrigir ? 'Comece importando a planilha da folha ou cadastrando os postos um a um.' : 'O Financeiro ou o Departamento Pessoal precisa cadastrar os postos.'}
          </EstadoVazio>
        ) : (
          <EstadoVazio titulo="Nenhum centro de custo no seu escopo">
            Seu perfil não está ligado a uma área com centros de custo. Peça à administração da plataforma para ajustar o escopo do seu perfil.
          </EstadoVazio>
        )
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Custo da folha por área e centro de custo em {MESES[i]} e no ano</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Área e centro de custo</th>
                <th scope="col" className={`${tabela.th} hidden md:table-cell`}>
                  <span className="sr-only">Proporção</span>
                </th>
                <th scope="col" className={`${tabela.th} text-right`}>{MESES[i]}</th>
                <th scope="col" className={`${tabela.th} text-right`}>No ano</th>
              </tr>
            </thead>
            {r.areas.map((a) => (
              <tbody key={a.codigo}>
                <tr className="border-b border-borda bg-destaque-suave/60">
                  <th scope="rowgroup" colSpan={2} className="px-4 py-2.5 text-left font-bold">
                    {a.nome}
                  </th>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{reais(a.mensal[i])}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{reais(a.anual)}</td>
                </tr>
                {r.centros
                  .filter((c) => (c.area ?? '') === a.codigo)
                  .map((c) => (
                    <tr key={c.codigo} className={tabela.linha}>
                      <th scope="row" className="py-2.5 pl-8 pr-4 text-left font-normal">
                        {c.nome}
                      </th>
                      <td className="hidden w-[28%] px-4 py-2.5 md:table-cell" aria-hidden="true">
                        <div className="h-2 rounded-full bg-superficie-2">
                          <div className="h-2 rounded-full bg-destaque/70" style={{ width: `${(c.mensal[i] / maior) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{reais(c.mensal[i])}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-texto-suave">{reais(c.anual)}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
            <tfoot className="border-t-2 border-borda-forte">
              <tr>
                <th scope="row" colSpan={2} className="px-4 py-3 text-left font-bold">
                  Total
                </th>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(r.total.mensal[i])}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(r.total.anual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
