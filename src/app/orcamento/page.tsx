import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resumoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloCampo } from '../admin/mensagem';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Custo da folha por centro de custo · {r.ano}</h2>
          <p className="mt-1 max-w-2xl text-texto-suave">
            Salários, benefícios, provisões e encargos de cada posto, divididos pelo rateio.
            {!r.todasAsAreas && ' Você vê os centros de custo da sua área.'}
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm">
            Mês
            <select name="mes" defaultValue={mes} className={estiloCampo}>
              {MESES.map((m, k) => (
                <option key={m} value={k + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md border border-borda px-3 py-2 text-sm hover:bg-destaque-suave">Ver</button>
        </form>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-borda bg-superficie p-5">
          <dt className="text-sm text-texto-suave">Custo em {MESES[i].toLowerCase()}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">{reais(r.total.mensal[i])}</dd>
        </div>
        <div className="rounded-lg border border-borda bg-superficie p-5">
          <dt className="text-sm text-texto-suave">Custo no ano</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">{reais(r.total.anual)}</dd>
        </div>
      </dl>

      {r.alertas && (r.alertas.semRateio > 0 || r.alertas.foraDe100 > 0) && (
        <div role="alert" className="rounded-md bg-aviso-fundo p-4 text-sm text-aviso">
          <p className="font-semibold">
            {r.alertas.semRateio + r.alertas.foraDe100} {r.alertas.semRateio + r.alertas.foraDe100 === 1 ? 'posto está' : 'postos estão'} sem
            rateio válido.
          </p>
          <p className="mt-1">
            O custo deles ({reais(r.alertas.custoSemRateio)} no ano) não aparece em nenhum centro de custo e não entra nos totais acima.
            {podeCorrigir && (
              <>
                {' '}
                <Link href="/orcamento/rateio?atalho=pendentes" className="font-semibold underline">
                  Corrigir no rateio geral
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {r.alertas && (
        <p className="text-sm text-texto-suave">
          {r.alertas.postosAtivos} postos no ano, dos quais {r.alertas.vagasPrevistas} são vagas previstas (contratações ainda sem pessoa).
        </p>
      )}

      {r.centros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-borda p-6">
          {r.todasAsAreas ? (
            <p>
              Ainda não há custo de folha registrado.{' '}
              {podeCorrigir ? (
                <Link href="/orcamento/importar" className="font-semibold text-destaque underline">
                  Importe a planilha da folha
                </Link>
              ) : (
                'O Financeiro ou o Departamento Pessoal precisa cadastrar os postos.'
              )}
            </p>
          ) : (
            <p>Seu perfil não está ligado a uma área com centros de custo. Peça à administração da plataforma para ajustar o escopo do seu perfil.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Custo da folha por área e centro de custo</caption>
            <thead className="border-b border-borda text-texto-suave">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Centro de custo</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{MESES[i]}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">No ano</th>
              </tr>
            </thead>
            {r.areas.map((a) => (
              <tbody key={a.codigo} className="border-b border-borda last:border-0">
                <tr className="bg-destaque-suave">
                  <th scope="rowgroup" className="px-4 py-2 font-semibold">{a.nome}</th>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{reais(a.mensal[i])}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{reais(a.anual)}</td>
                </tr>
                {r.centros
                  .filter((c) => (c.area ?? '') === a.codigo)
                  .map((c) => (
                    <tr key={c.codigo}>
                      <th scope="row" className="py-2 pl-8 pr-4 font-normal">{c.nome}</th>
                      <td className="px-4 py-2 text-right tabular-nums">{reais(c.mensal[i])}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{reais(c.anual)}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
            <tfoot className="border-t-2 border-borda">
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold">Total</th>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{reais(r.total.mensal[i])}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{reais(r.total.anual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
