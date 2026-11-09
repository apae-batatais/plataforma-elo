'use client';

/**
 * Importar ano fechado em passos: 1. arquivo; 2. DE-PARA de colunas; 3. conferir as
 * linhas, escolher a fonte de cada uma e informar os totais do ano. Nada é gravado
 * antes da confirmação, e o Elo só grava se o total bater em centavos.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { IconeEnviar } from '@/ui/icones';
import type { AnaliseHistorico } from '../aplicacao/historico';
import { conferirTotal, somaReceitas, type MapeamentoHistorico } from '../dominio/historico';
import type { AbaResumida } from '../dominio/importacao';
import { reais } from './formato';
import { colunasDe, EscolhaCabecalho, ocupado, SeletorColuna } from './importar-folha';

type EstadoArquivo = { erro?: string; abas?: AbaResumida[]; sugestao?: MapeamentoHistorico | null };
type EstadoAnalise = { erro?: string; analise?: AnaliseHistorico };
type Acao<E> = (estado: E, f: FormData) => Promise<E>;

/** Lê "1.234,56", "1234.56" ou "1234,5"; vazio = null; inválido = NaN. */
export function lerValor(t: string): number | null {
  const s = t.replace(/R\$|\s/g, '');
  if (!s) return null;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}

export function ImportarHistorico({
  anoMin,
  anoMax,
  lerArquivo,
  analisar,
  confirmar,
}: {
  anoMin: number;
  anoMax: number;
  lerArquivo: Acao<EstadoArquivo>;
  analisar: Acao<EstadoAnalise>;
  confirmar: Acao<{ erro?: string }>;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, despacharLeitura, lendo] = useActionState(lerArquivo, {});
  const [analise, despacharAnalise, analisando] = useActionState(analisar, {});
  const [confirmacao, enviar, gravando] = useActionState(confirmar, {});
  const [m, setM] = useState<MapeamentoHistorico | null>(null);
  const [analisadoCom, setAnalisadoCom] = useState<string | null>(null);
  const [fontes, setFontes] = useState<Record<number, string>>({});
  const [obs, setObs] = useState<Record<number, string>>({});
  const [campos, setCampos] = useState({ ano: String(anoMax), despesa: '', folha: '', saldo: '', total: '' });

  useEffect(() => {
    if (leitura.abas?.length) {
      const a = leitura.abas[0];
      setM(leitura.sugestao ?? { aba: a.nome, cabecalho: a.cabecalhoSugerido, colunas: { descricao: 0, valor: 1 } });
      setAnalisadoCom(null);
    }
  }, [leitura]);

  const a = analisadoCom === JSON.stringify(m) && !analisando ? analise.analise : undefined;
  useEffect(() => {
    if (!a) return;
    setFontes(Object.fromEntries(a.linhas.flatMap((l) => (l.fonteId ? [[l.linha, l.fonteId]] : []))));
    setObs({});
    setCampos((c) => ({ ...c, total: a.totalPlanilha === null ? '' : String(a.totalPlanilha).replace('.', ',') }));
  }, [a]);

  const ler = (novo: File | null) => {
    setArquivo(novo);
    setM(null);
    setAnalisadoCom(null);
    if (!novo) return;
    const f = new FormData();
    f.set('arquivo', novo);
    startTransition(() => despacharLeitura(f));
  };
  const rodarAnalise = () => {
    if (!arquivo || !m) return;
    setAnalisadoCom(JSON.stringify(m));
    const f = new FormData();
    f.set('arquivo', arquivo);
    f.set('mapeamento', JSON.stringify(m));
    startTransition(() => despacharAnalise(f));
  };

  const aba = leitura.abas?.find((x) => x.nome === m?.aba);
  const cols = useMemo(() => colunasDe(aba, m?.cabecalho ?? 1), [aba, m?.cabecalho]);

  const ano = Number(campos.ano);
  const despesa = lerValor(campos.despesa);
  const folha = lerValor(campos.folha);
  const saldo = lerValor(campos.saldo);
  const total = lerValor(campos.total);
  const semFonte = a ? a.linhas.filter((l) => !fontes[l.linha]).length : 0;
  const erroTotal = a ? conferirTotal(a.linhas, total) : '';
  const erroAno = !Number.isInteger(ano) || ano < anoMin || ano > anoMax ? `Informe um ano de ${anoMin} a ${anoMax}.` : '';
  const faltam = [
    erroAno,
    despesa === null || Number.isNaN(despesa) || despesa < 0 ? 'Informe a despesa total do ano.' : '',
    folha === null || Number.isNaN(folha) || folha < 0 ? 'Informe a folha do ano.' : '',
    saldo !== null && Number.isNaN(saldo) ? 'O saldo livre de 1º de janeiro não é um número.' : '',
    semFonte ? `Escolha a fonte de ${semFonte} ${semFonte === 1 ? 'linha' : 'linhas'}.` : '',
  ].filter(Boolean);
  const dados = a
    ? JSON.stringify({
        ano,
        totalPlanilha: total ?? 0,
        despesaTotal: despesa ?? 0,
        folha: folha ?? 0,
        saldoLivreInicial: saldo,
        linhas: a.linhas.map((l) => ({ linha: l.linha, descricao: l.descricao, valor: l.valor, fonteId: fontes[l.linha] ?? null, observacao: obs[l.linha]?.trim() || null })),
      })
    : '';
  const campo = (id: keyof typeof campos, rotulo: string, dica: string) => (
    <label className="block text-sm" htmlFor={`h-${id}`}>
      <span className="font-semibold">{rotulo}</span>
      <span className="block text-texto-suave">{dica}</span>
      <input id={`h-${id}`} inputMode="decimal" value={campos[id]} onChange={(e) => setCampos({ ...campos, [id]: e.target.value })} className={estiloEntrada} />
    </label>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="h-arquivo">
        <h2 id="h-arquivo" className="text-lg font-bold">1. Escolher o arquivo</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          Use a planilha de Previsão do ano fechado (aba de orçado × realizado). No Google Drive: Arquivo › Fazer download › Microsoft Excel (.xlsx). Um ano por vez. Nada é gravado antes da sua confirmação.
        </p>
        <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-borda-forte bg-superficie-2 p-4 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-destaque hover:border-destaque/60">
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => ler(e.target.files?.[0] ?? null)} className="sr-only" />
          <span className="rounded-md border border-borda-forte bg-superficie px-3 py-2 font-semibold">{arquivo ? 'Trocar arquivo' : 'Escolher arquivo .xlsx'}</span>
          <span className={arquivo ? 'font-semibold' : 'text-texto-suave'}>{arquivo ? arquivo.name : 'Nenhum arquivo escolhido'}</span>
        </label>
        {lendo && <p className="flex items-center gap-2 text-sm text-texto-suave">{ocupado('Lendo as abas do arquivo…')}</p>}
        {leitura.erro && !lendo && <Aviso tipo="erro" titulo="Não deu para ler o arquivo">{leitura.erro}</Aviso>}
      </section>

      {m && leitura.abas && !lendo && (
        <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="h-depara">
          <div>
            <h2 id="h-depara" className="text-lg font-bold">2. Onde estão as receitas (DE-PARA)</h2>
            <p className="max-w-2xl text-sm text-texto-suave">O Elo sugeriu as escolhas pelos títulos. Confira: use a coluna do valor <strong>realizado</strong>, não a do orçado.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm" htmlFor="h-aba">
              <span className="font-semibold">Aba</span>
              <select
                id="h-aba"
                value={m.aba}
                onChange={(e) => {
                  const x = leitura.abas!.find((y) => y.nome === e.target.value)!;
                  setM({ aba: x.nome, cabecalho: x.cabecalhoSugerido, colunas: { descricao: 0, valor: 1 } });
                }}
                className={estiloEntrada}
              >
                {leitura.abas.map((x) => (
                  <option key={x.nome} value={x.nome}>{x.nome}</option>
                ))}
              </select>
            </label>
            <EscolhaCabecalho aba={aba} valor={m.cabecalho} aoMudar={(n) => setM({ ...m, cabecalho: n })} id="h-cab" />
            <div className="text-sm">
              <label htmlFor="h-desc" className="font-semibold">Descrição da receita <span className="text-erro">*</span></label>
              <SeletorColuna id="h-desc" colunas={cols} valor={m.colunas.descricao} aoMudar={(j) => setM({ ...m, colunas: { ...m.colunas, descricao: j ?? 0 } })} vazio="Escolha…" />
            </div>
            <div className="text-sm">
              <label htmlFor="h-valor" className="font-semibold">Valor realizado <span className="text-erro">*</span></label>
              <SeletorColuna id="h-valor" colunas={cols} valor={m.colunas.valor} aoMudar={(j) => setM({ ...m, colunas: { ...m.colunas, valor: j ?? 0 } })} vazio="Escolha…" />
            </div>
          </div>
          <Botao type="button" onClick={rodarAnalise} disabled={analisando || !arquivo}>
            {analisando ? ocupado('Lendo com este DE-PARA…') : (<><IconeEnviar tamanho={18} /> Ler a planilha com este DE-PARA</>)}
          </Botao>
          {analise.erro && analisadoCom === JSON.stringify(m) && !analisando && <Aviso tipo="erro" titulo="Não deu para ler com este DE-PARA">{analise.erro}</Aviso>}
          {analise.analise && analisadoCom !== null && analisadoCom !== JSON.stringify(m) && (
            <p className="text-sm text-texto-suave">Você mudou o DE-PARA. Leia a planilha de novo para atualizar o resultado.</p>
          )}
        </section>
      )}

      {a && (
        <form action={enviar} className="space-y-5 rounded-cartao border border-borda bg-superficie p-5">
          <div>
            <h2 className="text-lg font-bold">3. Conferir e confirmar</h2>
            <p className="max-w-2xl text-sm text-texto-suave">
              {a.linhas.length} {a.linhas.length === 1 ? 'linha de receita' : 'linhas de receita'}, somando {reais(somaReceitas(a.linhas))}. Escolha a fonte de cada linha. Linhas que misturam origens ficam numa fonte à sua escolha; se quiser, explique na observação.
            </p>
          </div>
          {a.problemas.length > 0 && (
            <Aviso tipo="atencao" titulo={`${a.problemas.length} ${a.problemas.length === 1 ? 'linha pulada' : 'linhas puladas'}`}>
              {a.problemas.map((p) => `Linha ${p.linha}${p.descricao ? ` (${p.descricao})` : ''}: ${p.problema}`).join(' ')}
            </Aviso>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Linhas de receita e a fonte de cada uma</caption>
              <thead>
                <tr className="text-left text-texto-suave">
                  <th scope="col" className="px-2 py-1">Linha</th>
                  <th scope="col" className="px-2 py-1">Receita na planilha</th>
                  <th scope="col" className="px-2 py-1 text-right">Realizado</th>
                  <th scope="col" className="px-2 py-1">Fonte</th>
                  <th scope="col" className="px-2 py-1">Observação</th>
                </tr>
              </thead>
              <tbody>
                {a.linhas.map((l) => (
                  <tr key={l.linha} className="border-t border-borda align-top">
                    <td className="px-2 py-2 tabular-nums">{l.linha}</td>
                    <td className="px-2 py-2">{l.descricao}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{reais(l.valor)}</td>
                    <td className="px-2 py-2">
                      <select aria-label={`Fonte de ${l.descricao}`} value={fontes[l.linha] ?? ''} onChange={(e) => setFontes({ ...fontes, [l.linha]: e.target.value })} className={`${estiloEntrada} !mt-0 ${fontes[l.linha] ? '' : 'border-aviso'}`}>
                        <option value="">Escolha…</option>
                        {a.fontes.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input aria-label={`Observação de ${l.descricao}`} value={obs[l.linha] ?? ''} onChange={(e) => setObs({ ...obs, [l.linha]: e.target.value })} className={`${estiloEntrada} !mt-0`} maxLength={200} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.fontes.length === 0 && <Aviso tipo="atencao">Não há fontes cadastradas. Cadastre as fontes em Previsão › Fontes de recurso e leia a planilha de novo.</Aviso>}
          <div className="grid gap-4 md:grid-cols-2">
            {campo('ano', 'Ano fechado', `De ${anoMin} a ${anoMax}.`)}
            {campo('total', 'Total das receitas da planilha', a.totalPlanilha === null ? 'Não achei a linha "Total das receitas": digite o valor.' : 'Achei na planilha. Confira.')}
            {campo('despesa', 'Despesa total do ano', 'Total realizado das despesas.')}
            {campo('folha', 'Folha do ano', 'Parte da despesa que foi folha de pagamento.')}
            {campo('saldo', 'Saldo livre em 1º de janeiro (opcional)', 'Sem ele, não dá para calcular o saldo livre do ano anterior.')}
          </div>
          {erroTotal && <Aviso tipo="erro" titulo="O total não confere">{erroTotal}</Aviso>}
          {!erroTotal && total !== null && <Aviso tipo="sucesso">O total das linhas bate com o total da planilha ({reais(total)}).</Aviso>}
          {a.anosImportados.includes(ano) && <Aviso tipo="atencao">{ano} já foi importado. Se você confirmar, a importação anterior é substituída e fica guardada no histórico.</Aviso>}
          <input type="hidden" name="dados" value={dados} />
          <BotaoEnviar pendente={gravando} disabled={Boolean(erroTotal) || faltam.length > 0} enviando="Importando…">
            Importar {Number.isInteger(ano) ? ano : 'ano'}{a.anosImportados.includes(ano) ? ' e substituir' : ''}
          </BotaoEnviar>
          {faltam.length > 0 && <p className="text-sm text-aviso">Falta: {faltam.join(' ')}</p>}
          {confirmacao.erro && <Aviso tipo="erro" titulo="A importação não foi feita">{confirmacao.erro}</Aviso>}
        </form>
      )}
    </div>
  );
}
