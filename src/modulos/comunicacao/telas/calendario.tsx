/**
 * Telas do calendário da Comunicação: visão de mês, visão de lista e o formulário do item.
 * Recebem os dados prontos e as ações do servidor por parâmetro (a rota decide de onde vêm).
 */
import Link from 'next/link';
import { estiloBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Etiqueta } from '@/ui/pagina';
import { NOME_TIPO_PECA, TIPOS_PECA, type TipoPeca } from '../dominio/pedido';
import { DIAS_DA_SEMANA, nomeDoMes, quandoCai, semanasDoMes } from './mes';

type Acao = (f: FormData) => void | Promise<void>;

export interface ItemDaTela {
  id: string;
  versao: number;
  ativo: boolean;
  tema: string;
  tipo_data: 'exata' | 'periodo';
  inicio: string;
  fim: string;
  tipos: TipoPeca[];
  observacao: string | null;
  pedidos: number;
  publicados: number;
}

export type Visao = 'mes' | 'lista';

const enderecoCalendario = (visao: Visao, mes: string, editar?: string) =>
  `/comunicacao/calendario?visao=${visao}&mes=${mes}${editar ? `&editar=${editar}` : ''}`;

// ---------------------------------------------------------------------------
// Controles: mês anterior/seguinte e escolha entre mês e lista
// ---------------------------------------------------------------------------

const botaoDeNavegacao = 'inline-flex min-h-11 items-center justify-center rounded-md border border-borda-forte bg-superficie px-3 text-sm font-semibold text-texto hover:bg-superficie-2';

export function Controles({ visao, mes, anterior, seguinte, atual }: { visao: Visao; mes: string; anterior: string; seguinte: string; atual: string }) {
  const opcao = (v: Visao, rotulo: string) => (
    <Link
      href={enderecoCalendario(v, mes)}
      aria-current={visao === v ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold ${visao === v ? 'bg-destaque text-sobre-destaque' : 'text-texto hover:bg-superficie-2'}`}
    >
      {rotulo}
    </Link>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Mês mostrado" className="flex flex-wrap items-center gap-2">
        <Link href={enderecoCalendario(visao, anterior)} className={botaoDeNavegacao}>
          Mês anterior
        </Link>
        <h2 className="min-w-40 px-2 text-center text-lg font-bold capitalize" aria-live="polite">
          {nomeDoMes(mes)}
        </h2>
        <Link href={enderecoCalendario(visao, seguinte)} className={botaoDeNavegacao}>
          Próximo mês
        </Link>
        <Link href={enderecoCalendario(visao, atual)} className={botaoDeNavegacao}>
          Este mês
        </Link>
      </nav>
      <nav aria-label="Forma de ver" className="inline-flex gap-1 rounded-lg border border-borda bg-superficie p-1">
        {opcao('mes', 'Mês')}
        {opcao('lista', 'Lista')}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão de mês
// ---------------------------------------------------------------------------

export function VisaoMes({ mes, itens, hoje }: { mes: string; itens: ItemDaTela[]; hoje: string }) {
  const semanas = semanasDoMes(mes);
  const ativos = itens.filter((i) => i.ativo);
  return (
    <div className="hidden overflow-x-auto rounded-cartao border border-borda bg-superficie md:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">Itens do calendário em {nomeDoMes(mes)}. Escolha um item para alterar.</caption>
        <thead>
          <tr className="border-b border-borda bg-superficie-2 text-texto-suave">
            {DIAS_DA_SEMANA.map((d) => (
              <th key={d} scope="col" className="px-2 py-2 text-left text-[0.8rem] font-semibold capitalize">
                {d.slice(0, 3)}
                <span className="sr-only">{d.slice(3)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0].dia} className="border-b border-borda last:border-0">
              {semana.map(({ dia, doMes }, coluna) => {
                const doDia = ativos.filter((i) => i.inicio <= dia && i.fim >= dia);
                return (
                  <td key={dia} className={`h-28 border-l border-borda p-1.5 align-top first:border-l-0 ${doMes ? '' : 'bg-superficie-2/60 text-texto-suave'}`}>
                    <span
                      aria-current={dia === hoje ? 'date' : undefined}
                      className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ${dia === hoje ? 'bg-destaque text-sobre-destaque' : ''}`}
                    >
                      {Number(dia.slice(8))}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {doDia.map((i) => {
                        // Item de período: o nome aparece no primeiro dia e no começo de cada semana; nos outros dias, só a faixa.
                        const mostraNome = i.inicio === dia || coluna === 0;
                        return (
                          <li key={i.id}>
                            <Link
                              href={enderecoCalendario('mes', mes, i.id)}
                              title={`${i.tema} (${quandoCai(i)})`}
                              className="block min-h-6 truncate rounded border border-destaque/30 bg-destaque-suave px-1.5 py-0.5 text-xs font-semibold text-destaque-forte hover:border-destaque"
                            >
                              {mostraNome ? i.tema : <span className="sr-only">{i.tema}</span>}
                              {mostraNome && i.tipo_data === 'periodo' && <span className="sr-only"> (período)</span>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {ativos.length === 0 && <p className="border-t border-borda px-5 py-4 text-sm text-texto-suave">Nenhum item neste mês. Use “Adicionar item”.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão de lista
// ---------------------------------------------------------------------------

export function VisaoLista({
  itens,
  visao,
  mes,
  desativar,
  reativar,
  soNoCelular = false,
}: {
  itens: ItemDaTela[];
  visao: Visao;
  mes: string;
  desativar: Acao;
  reativar: Acao;
  /** Na visão de mês, a lista aparece só no celular (a grade não cabe). */
  soNoCelular?: boolean;
}) {
  if (itens.length === 0) {
    return (
      <p className={`rounded-cartao border border-borda bg-superficie px-5 py-4 text-sm text-texto-suave ${soNoCelular ? 'md:hidden' : ''}`}>
        Nenhum item neste mês. Use “Adicionar item”.
      </p>
    );
  }
  return (
    <ul className={`space-y-3 ${soNoCelular ? 'md:hidden' : ''}`} aria-label="Itens do calendário">
      {itens.map((i) => (
        <li key={i.id} className={`rounded-cartao border border-borda bg-superficie p-4 ${i.ativo ? '' : 'opacity-80'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{i.tema}</p>
              <p className="mt-0.5 text-sm text-texto-suave">
                {i.tipo_data === 'exata' ? 'Data exata' : 'Período'}: {quandoCai(i)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!i.ativo && <Etiqueta>Desativado</Etiqueta>}
              <Link href={enderecoCalendario(visao, mes, i.id)} className={estiloBotao('secundario', '!min-h-11')}>
                Alterar
              </Link>
              {i.ativo ? (
                <FormularioConfirmado
                  acao={desativar}
                  campos={{ id: i.id, versao: i.versao, visao, mes }}
                  rotulo="Desativar"
                  variante="fantasma"
                  titulo={`Desativar “${i.tema}”?`}
                  mensagem="O item deixa de aparecer para escolha nos pedidos novos. Os pedidos que já usam o item continuam como estão, e você pode reativar depois."
                  confirmar="Desativar"
                />
              ) : (
                <FormularioConfirmado
                  acao={reativar}
                  campos={{ id: i.id, versao: i.versao, visao, mes }}
                  rotulo="Reativar"
                  variante="fantasma"
                  perigoso={false}
                  titulo={`Reativar “${i.tema}”?`}
                  mensagem="O item volta a aparecer para escolha nos pedidos novos."
                  confirmar="Reativar"
                />
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {i.tipos.map((t) => (
              <Etiqueta key={t} tipo="info">
                {NOME_TIPO_PECA[t]}
              </Etiqueta>
            ))}
          </div>
          <p className="mt-3 text-sm">
            <span className="font-semibold tabular-nums">{i.pedidos}</span> {i.pedidos === 1 ? 'pedido' : 'pedidos'} ·{' '}
            <span className="font-semibold tabular-nums">{i.publicados}</span> {i.publicados === 1 ? 'publicado' : 'publicados'}
          </p>
          {i.observacao && <p className="mt-2 text-sm text-texto-suave">{i.observacao}</p>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Formulário do item (adicionar e alterar)
// ---------------------------------------------------------------------------

export function FormularioItem({ acao, visao, mes, valor, rotuloBotao }: { acao: Acao; visao: Visao; mes: string; valor?: ItemDaTela; rotuloBotao: string }) {
  const tipoData = valor?.tipo_data ?? 'exata';
  return (
    <form action={acao} className="space-y-4">
      {valor && (
        <>
          <input type="hidden" name="id" value={valor.id} />
          <input type="hidden" name="versao" value={valor.versao} />
        </>
      )}
      <input type="hidden" name="visao" value={visao} />
      <input type="hidden" name="mes" value={mes} />
      <Campo rotulo="Tema" obrigatorio dica="Ex.: Dia Internacional da Pessoa com Deficiência.">
        <input name="tema" required defaultValue={valor?.tema} className={estiloEntrada} />
      </Campo>
      <fieldset>
        <legend className="text-sm font-semibold">Como a data cai</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['exata', 'Data exata', 'Um dia só.'],
              ['periodo', 'Período', 'Do início ao fim.'],
            ] as const
          ).map(([v, r, d]) => (
            <label key={v} className="flex min-h-11 items-start gap-2 rounded-lg border border-borda px-3 py-2.5 text-sm">
              <input type="radio" name="tipo_data" value={v} defaultChecked={tipoData === v} className="mt-0.5" />
              <span>
                <span className="font-semibold">{r}</span>
                <span className="block text-texto-suave">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Data ou início do período" obrigatorio>
          <input type="date" name="inicio" required defaultValue={valor?.inicio} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Fim do período" dica="Só para período. Em data exata, deixe em branco.">
          <input type="date" name="fim" defaultValue={valor && valor.tipo_data === 'periodo' ? valor.fim : ''} className={estiloEntrada} />
        </Campo>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">
          Tipos de peça sugeridos<span className="ml-0.5 text-erro" aria-hidden="true">*</span>
        </legend>
        <p className="mt-0.5 text-sm text-texto-suave">Marque pelo menos um. Quem pede escolhe entre estes.</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {TIPOS_PECA.map((t) => (
            <label key={t} className="flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm">
              <input type="checkbox" name="tipos" value={t} defaultChecked={valor?.tipos.includes(t) ?? false} />
              {NOME_TIPO_PECA[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <Campo rotulo="Observação" dica="Opcional. Orientação para quem for pedir.">
        <textarea name="observacao" rows={3} defaultValue={valor?.observacao ?? ''} className={estiloEntrada} />
      </Campo>
      <BotaoEnviar enviando="Salvando…" className="w-full">
        {rotuloBotao}
      </BotaoEnviar>
    </form>
  );
}
