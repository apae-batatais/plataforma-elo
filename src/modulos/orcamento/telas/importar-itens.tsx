'use client';

/**
 * Importação de despesas ou receitas em quatro passos, como a da folha:
 * 1. escolher o arquivo; 2. DE-PARA (aba, cabeçalho, colunas e de onde vêm os
 * valores); 3. conferir o relatório; 4. dizer a qual cadastro corresponde cada
 * nome e confirmar. Nada é gravado antes do passo 4.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { IconeEnviar } from '@/ui/icones';
import type { AnaliseItens, PropostaItens } from '../aplicacao/importacao-itens';
import type { AbaResumida } from '../dominio/importacao';
import {
  cabecalhoSugeridoItens, CAMPOS_ITENS, modoSugerido, NOMES_MESES, sugerirColunasItens,
  type CampoItem, type MapeamentoItens, type ModoValores, type TipoItem,
} from '../dominio/importacao-itens';
import { CAPTACAO } from '../dominio/previsao';
import { reais } from './formato';
import { colunasDe, EscolhaCabecalho, ocupado, SeletorColuna } from './importar-folha';

type EstadoArquivo = { erro?: string; abas?: AbaResumida[]; sugestao?: MapeamentoItens | null };
type EstadoAnalise = { erro?: string; analise?: AnaliseItens };
type Acao<E> = (estado: E, f: FormData) => Promise<E>;

const ROTULO_NOME = { servico: 'Serviço', grupo: 'Grupo de gasto', fonte: 'Fonte de recurso', area: 'Área' } as const;
type ChaveNome = keyof typeof ROTULO_NOME;

export function ImportarItens({ lerArquivo, analisar, confirmar }: { lerArquivo: Acao<EstadoArquivo>; analisar: Acao<EstadoAnalise>; confirmar: Acao<EstadoAnalise> }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, despacharLeitura, lendo] = useActionState(lerArquivo, {});
  const [analise, despacharAnalise, analisando] = useActionState(analisar, {});
  const [confirmacao, enviarConfirmacao, gravando] = useActionState(confirmar, {});
  const [m, setM] = useState<MapeamentoItens | null>(null);
  const [analisadoCom, setAnalisadoCom] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (leitura.abas?.length) {
      setM(leitura.sugestao ?? { tipo: 'despesa', aba: leitura.abas[0].nome, cabecalho: leitura.abas[0].cabecalhoSugerido, colunas: {}, valores: 'total' });
      setAnalisadoCom(null);
      setEscolhas({});
    }
  }, [leitura]);

  const ler = (novo: File | null) => {
    setArquivo(novo);
    setM(null);
    setAnalisadoCom(null);
    if (!novo) return;
    const f = new FormData();
    f.set('arquivo', novo);
    startTransition(() => despacharLeitura(f));
  };
  const textoM = m ? JSON.stringify(m) : '';
  const rodarAnalise = () => {
    if (!arquivo) return;
    setAnalisadoCom(textoM);
    setEscolhas({});
    const f = new FormData();
    f.set('arquivo', arquivo);
    f.set('mapeamento', textoM);
    startTransition(() => despacharAnalise(f));
  };

  const a = analisadoCom === textoM && !analisando ? analise.analise : undefined;
  const chave = (k: ChaveNome, nome: string) => `${k}|${nome}`;
  const nomes = a
    ? (Object.fromEntries(
        (Object.keys(ROTULO_NOME) as ChaveNome[]).map((k) => [
          k,
          a.proposta.nomes[k].map((n) => {
            const e = escolhas[chave(k, n.nome)];
            return { ...n, valor: e === undefined ? n.valor : e === '__' ? null : e };
          }),
        ]),
      ) as PropostaItens['nomes'])
    : null;
  const opcional = (k: ChaveNome) => (a?.proposta.tipo === 'despesa' && k === 'fonte') || k === 'area';
  const faltam = nomes ? (Object.keys(ROTULO_NOME) as ChaveNome[]).flatMap((k) => nomes[k].filter((n) => n.valor === null || (n.valor === '' && !opcional(k)))).length : 0;
  const falta = m ? faltandoNoDePara(m) : [];
  const tipoTexto = (t: TipoItem, n: number) => (t === 'despesa' ? (n === 1 ? 'despesa' : 'despesas') : n === 1 ? 'receita' : 'receitas');

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-arquivo">
        <h2 id="t-arquivo" className="text-lg font-bold">1. Escolher o arquivo</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          No Google Drive, abra a planilha e use Arquivo › Fazer download › Microsoft Excel (.xlsx). No passo seguinte você diz se são despesas ou receitas, em
          qual aba estão e qual coluna corresponde a cada campo. Nada é gravado antes da sua confirmação.
        </p>
        <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-borda-forte bg-superficie-2 p-4 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco hover:border-destaque/60">
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => ler(e.target.files?.[0] ?? null)} className="sr-only" />
          <span className="rounded-md border border-borda-forte bg-superficie px-3 py-2 font-semibold">{arquivo ? 'Trocar arquivo' : 'Escolher arquivo .xlsx'}</span>
          <span className={arquivo ? 'font-semibold' : 'text-texto-suave'}>{arquivo ? arquivo.name : 'Nenhum arquivo escolhido'}</span>
        </label>
        {lendo && <p className="flex items-center gap-2 text-sm text-texto-suave">{ocupado('Lendo as abas do arquivo…')}</p>}
        {leitura.erro && !lendo && (
          <Aviso tipo="erro" titulo="Não deu para ler o arquivo">
            {leitura.erro}
          </Aviso>
        )}
      </section>

      {m && leitura.abas && !lendo && (
        <section className="space-y-6 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-depara">
          <div>
            <h2 id="t-depara" className="text-lg font-bold">2. Onde estão os dados (DE-PARA)</h2>
            <p className="max-w-2xl text-sm text-texto-suave">O app já sugeriu as escolhas pelos títulos das colunas. Confira e mude o que for preciso.</p>
          </div>
          <DeParaItens abas={leitura.abas} m={m} setM={setM} />
          <div className="space-y-3 border-t border-borda pt-4">
            <Botao type="button" onClick={rodarAnalise} disabled={analisando || !arquivo || falta.length > 0}>
              {analisando ? (
                ocupado('Lendo com este DE-PARA…')
              ) : (
                <>
                  <IconeEnviar tamanho={18} />
                  Ler a planilha com este DE-PARA
                </>
              )}
            </Botao>
            {falta.length > 0 && <p className="text-sm text-aviso">Falta: {falta.join('; ')}.</p>}
            {analise.erro && analisadoCom === textoM && !analisando && (
              <Aviso tipo="erro" titulo="Não deu para ler com este DE-PARA">
                {analise.erro}
              </Aviso>
            )}
            {analise.analise && analisadoCom !== null && analisadoCom !== textoM && (
              <p className="text-sm text-texto-suave">Você mudou o DE-PARA. Leia a planilha de novo para atualizar o resultado.</p>
            )}
          </div>
        </section>
      )}

      {a && <RelatorioItens analise={a} />}

      {a && nomes && (
        <form action={enviarConfirmacao} className="space-y-4 rounded-xl border border-borda bg-superficie p-5">
          <h2 className="text-lg font-bold">4. Confirmar</h2>
          {(Object.keys(ROTULO_NOME) as ChaveNome[])
            .filter((k) => nomes[k].length > 0)
            .map((k) => (
              <fieldset key={k} className="min-w-0 space-y-2">
                <legend className="mb-2 text-sm">
                  A qual <strong>{ROTULO_NOME[k]}</strong> corresponde cada nome da planilha. Os que o app reconheceu já vêm preenchidos.
                </legend>
                {nomes[k].map((n) => (
                  <label key={n.nome} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_20rem]">
                    <span className={n.valor === null ? 'font-semibold' : ''}>{n.nome}</span>
                    <select
                      value={n.valor ?? '__'}
                      onChange={(e) => setEscolhas({ ...escolhas, [chave(k, n.nome)]: e.target.value })}
                      className={`${estiloEntrada} !mt-0 ${n.valor === null ? 'border-aviso' : ''}`}
                    >
                      <option value="__">Escolha…</option>
                      {opcional(k) && <option value="">{k === 'fonte' ? 'A definir' : 'Geral (sem área)'}</option>}
                      {k === 'servico'
                        ? [...new Set(a.opcoes.servico.map((o) => o.grupo))].map((g) => (
                            <optgroup key={g} label={g}>
                              {a.opcoes.servico
                                .filter((o) => o.grupo === g)
                                .map((o) => (
                                  <option key={o.valor} value={o.valor}>
                                    {o.nome}
                                  </option>
                                ))}
                            </optgroup>
                          ))
                        : a.opcoes[k].map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.nome}
                            </option>
                          ))}
                    </select>
                  </label>
                ))}
                {a.opcoes[k].length === 0 && (
                  <Aviso tipo="atencao">
                    Nenhum cadastro de {ROTULO_NOME[k].toLowerCase()} ainda. {k === 'grupo' || k === 'fonte' ? 'Use o cadastro em lote para criar a lista de uma vez.' : ''}
                  </Aviso>
                )}
              </fieldset>
            ))}
          <input type="hidden" name="proposta" value={JSON.stringify({ ...a.proposta, nomes })} />
          <BotaoEnviar pendente={gravando} disabled={a.proposta.itens.length === 0 || faltam > 0} enviando="Importando…">
            Importar {a.proposta.itens.length} {tipoTexto(a.proposta.tipo, a.proposta.itens.length)}
            {a.relatorio.substituir > 0 ? ' e substituir a importação anterior' : ''}
          </BotaoEnviar>
          {faltam > 0 && <p className="text-sm text-aviso">Falta escolher a correspondência de {faltam} {faltam === 1 ? 'nome' : 'nomes'}.</p>}
          {confirmacao.erro && (
            <Aviso tipo="erro" titulo="A importação não foi feita">
              {confirmacao.erro}
            </Aviso>
          )}
        </form>
      )}
    </div>
  );
}

const MESES_CAMPOS = Array.from({ length: 12 }, (_, i) => `m${i + 1}` as CampoItem);

/** O que falta escolher no DE-PARA para poder ler. */
function faltandoNoDePara(m: MapeamentoItens): string[] {
  const f: string[] = [];
  for (const c of CAMPOS_ITENS[m.tipo].filter((x) => x.obrigatorio)) if (m.colunas[c.chave] === undefined) f.push(`coluna de ${c.rotulo}`);
  if (m.valores === 'meses' && !MESES_CAMPOS.some((c) => m.colunas[c] !== undefined)) f.push('coluna de pelo menos um mês');
  if (m.valores === 'total' && m.colunas.total === undefined) f.push('coluna do valor anual');
  if (m.valores === 'unitario' && m.colunas.valorUnitario === undefined) f.push('coluna do valor unitário');
  return f;
}

function DeParaItens({ abas, m, setM }: { abas: AbaResumida[]; m: MapeamentoItens; setM: (m: MapeamentoItens) => void }) {
  const aba = abas.find((x) => x.nome === m.aba);
  const cols = useMemo(() => colunasDe(aba, m.cabecalho), [aba, m.cabecalho]);
  const campos = CAMPOS_ITENS[m.tipo];

  const sugerir = (tipo: TipoItem, nomeAba: string, cabecalho?: number): MapeamentoItens => {
    const x = abas.find((y) => y.nome === nomeAba);
    const cab = cabecalho ?? (x ? cabecalhoSugeridoItens(tipo, x.linhas) : 1);
    const colunas = sugerirColunasItens(tipo, x?.linhas[cab - 1] ?? []);
    return { ...m, tipo, aba: nomeAba, cabecalho: cab, colunas, valores: modoSugerido(tipo, colunas) };
  };
  const mudarColuna = (campo: CampoItem, j: number | null) => {
    const colunas = { ...m.colunas };
    if (j === null) delete colunas[campo];
    else colunas[campo] = j;
    setM({ ...m, colunas });
  };
  const linha = (campo: CampoItem) => {
    const c = campos.find((x) => x.chave === campo)!;
    const id = `col-${campo}`;
    const faltando = c.obrigatorio && m.colunas[campo] === undefined;
    return (
      <tr key={campo} className="border-t border-borda align-top">
        <th scope="row" className="px-3 py-2 font-normal">
          <label htmlFor={id} className="font-semibold">
            {c.rotulo}
            {c.obrigatorio && <span className="text-erro"> *</span>}
          </label>
          {c.dica && <span className="block text-xs text-texto-suave">{c.dica}</span>}
        </th>
        <td className={`px-3 py-2 ${faltando ? 'bg-aviso-fundo' : ''}`}>
          <SeletorColuna id={id} colunas={cols} valor={m.colunas[campo]} aoMudar={(j) => mudarColuna(campo, j)} vazio="— não importar —" />
        </td>
      </tr>
    );
  };
  const modos: [ModoValores, string, string][] = [
    ['meses', 'Uma coluna para cada mês', 'Jan, Fev, … Dez. Meses sem coluna ficam zerados.'],
    ['total', 'Valor anual', 'Dividido igualmente nos 12 meses.'],
    ...(m.tipo === 'despesa' ? ([['unitario', 'Quantidade × vezes × valor unitário', 'Dividido igualmente nos 12 meses. Sem quantidade ou vezes, conta 1.']] as [ModoValores, string, string][]) : []),
  ];

  return (
    <>
      <fieldset className="min-w-0 space-y-2 text-sm">
        <legend className="mb-2 text-base font-bold">O que este arquivo traz</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['despesa', 'receita'] as const).map((t) => (
            <label key={t} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${m.tipo === t ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}>
              <input type="radio" name="tipo-itens" checked={m.tipo === t} onChange={() => setM(sugerir(t, m.aba))} className="mt-1" />
              <span>
                <span className="font-semibold">{t === 'despesa' ? 'Despesas' : 'Receitas'}</span>
                <span className="block text-texto-suave">{t === 'despesa' ? 'Serviço, grupo de gasto, fonte e valores.' : 'Fonte, área, situação da captação e valores.'}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold">Aba com os itens</span>
          <span className="block text-texto-suave">Uma linha por item.</span>
          <select value={m.aba} onChange={(e) => setM(sugerir(m.tipo, e.target.value))} className={estiloEntrada}>
            {abas.map((x) => (
              <option key={x.nome} value={x.nome}>
                {x.nome} ({x.totalLinhas} linhas)
              </option>
            ))}
          </select>
        </label>
        <EscolhaCabecalho id="cab-itens" aba={aba} valor={m.cabecalho} aoMudar={(n) => setM(sugerir(m.tipo, m.aba, n))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-borda">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">DE-PARA das colunas</caption>
          <thead className="bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="w-1/2 px-3 py-2 font-semibold">Campo do item (PARA)</th>
              <th scope="col" className="px-3 py-2 font-semibold">Coluna da planilha (DE)</th>
            </tr>
          </thead>
          <tbody>{campos.filter((c) => c.grupo === 'identificacao').map((c) => linha(c.chave))}</tbody>
        </table>
      </div>

      {m.tipo === 'receita' && (
        <label className="block max-w-sm text-sm">
          <span className="font-semibold">Situação da captação, quando a planilha não informar</span>
          <select value={m.captacaoPadrao ?? 'garantida'} onChange={(e) => setM({ ...m, captacaoPadrao: e.target.value as MapeamentoItens['captacaoPadrao'] })} className={estiloEntrada}>
            {Object.entries(CAPTACAO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="min-w-0 space-y-3 text-sm">
        <legend className="mb-2 text-base font-bold">De onde vêm os valores</legend>
        <div className="space-y-2">
          {modos.map(([v, rotulo, dica]) => (
            <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${m.valores === v ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}>
              <input type="radio" name="modo-valores" checked={m.valores === v} onChange={() => setM({ ...m, valores: v })} className="mt-1" />
              <span>
                <span className="font-semibold">{rotulo}</span>
                <span className="block text-texto-suave">{dica}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-borda">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Colunas dos valores</caption>
            <tbody>
              {m.valores === 'meses' && MESES_CAMPOS.map((c) => linha(c))}
              {m.valores === 'total' && linha('total')}
              {m.valores === 'unitario' && (['quantidade', 'ocorrencias', 'valorUnitario'] as CampoItem[]).map((c) => linha(c))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </>
  );
}

function RelatorioItens({ analise }: { analise: AnaliseItens }) {
  const r = analise.relatorio;
  const despesa = r.tipo === 'despesa';
  return (
    <section className="space-y-4 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-relatorio">
      <h2 id="t-relatorio" className="text-lg font-bold">3. Conferir o que será importado</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-texto-suave">{despesa ? 'Despesas' : 'Receitas'} prontas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.itens}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Total no ano</dt>
          <dd className="text-2xl font-semibold tabular-nums">{reais(r.total)}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Exercício</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.ano}</dd>
          <dd className="text-texto-suave">em elaboração</dd>
        </div>
      </dl>

      {r.substituir > 0 && (
        <Aviso tipo="atencao" titulo="Esta importação substitui a anterior">
          {r.substituir} {despesa ? (r.substituir === 1 ? 'despesa importada' : 'despesas importadas') : r.substituir === 1 ? 'receita importada' : 'receitas importadas'} antes em{' '}
          {r.ano} {r.substituir === 1 ? 'será cancelada' : 'serão canceladas'} (ficam no histórico), inclusive se tiverem sido alteradas depois. Os itens lançados à mão e as
          propostas não mudam.
        </Aviso>
      )}

      {r.problemas.length > 0 && (
        <div className="rounded-md bg-aviso-fundo p-4 text-sm text-aviso">
          <p className="font-semibold">
            {r.problemas.length} {r.problemas.length === 1 ? 'linha não será importada' : 'linhas não serão importadas'}:
          </p>
          <ul className="ml-5 mt-1 list-disc">
            {r.problemas.slice(0, 30).map((x) => (
              <li key={x.linha}>
                Linha {x.linha}
                {x.descricao ? ` (${x.descricao})` : ''}: {x.problema}
              </li>
            ))}
            {r.problemas.length > 30 && <li>e mais {r.problemas.length - 30}</li>}
          </ul>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Total de cada mês</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="text-left tabular-nums">
            <thead className="text-texto-suave">
              <tr>
                {NOMES_MESES.map((n) => (
                  <th key={n} scope="col" className="px-2 text-right font-medium">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {r.porMes.map((v, i) => (
                  <td key={i} className="px-2 text-right">
                    {reais(v)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
