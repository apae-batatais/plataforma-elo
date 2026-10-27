'use client';

import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { IconeEnviar } from '@/ui/icones';
import type { Analise } from '../aplicacao/importacao';
import { percentual, reais } from './formato';

type Estado = { erro?: string; analise?: Analise };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

const quem = (x: { ficha: string | null; colaborador: string | null }) =>
  `${x.colaborador ?? 'Vaga prevista'}${x.ficha ? ` (ficha ${x.ficha})` : ''}`;

export function ImportarFolha({ analisar, confirmar }: { analisar: Acao; confirmar: Acao }) {
  const [analise, enviarArquivo, analisando] = useActionState(analisar, {});
  const [confirmacao, enviarConfirmacao, gravando] = useActionState(confirmar, {});
  const a = analise.analise;
  const [areas, setAreas] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <form action={enviarArquivo} className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
        <h2 className="text-lg font-bold">1. Enviar o arquivo</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          No Google Drive, abra a planilha da folha e use Arquivo › Fazer download › Microsoft Excel (.xlsx). O app usa as abas Tabela
          Salarial, Estudo e Rateio, ligadas pelo nº da ficha. Nada é gravado antes da sua confirmação.
        </p>
        <input
          type="file"
          name="arquivo"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full rounded-lg border border-dashed border-borda-forte bg-superficie-2 p-4 text-sm file:mr-3 file:rounded-md file:border file:border-borda-forte file:bg-superficie file:px-3 file:py-2 file:font-semibold"
        />
        <BotaoEnviar pendente={analisando} enviando="Lendo o arquivo…">
          <IconeEnviar tamanho={18} />
          Analisar arquivo
        </BotaoEnviar>
        {analise.erro && (
          <Aviso tipo="erro" titulo="Não deu para ler o arquivo">
            {analise.erro}
          </Aviso>
        )}
      </form>

      {a && <Relatorio analise={a} />}

      {a && (
        <form action={enviarConfirmacao} className="space-y-4 rounded-xl border border-borda bg-superficie p-5">
          <h2 className="text-lg font-bold">3. Confirmar</h2>
          {a.proposta.centrosNovos.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm">
                Estes centros de custo ainda não existem e serão criados. Escolha a área de cada um:
              </legend>
              {a.proposta.centrosNovos.map((c) => (
                <label key={c.codigo} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_16rem]">
                  <span>{c.nome}</span>
                  <select
                    required
                    value={areas[c.codigo] ?? ''}
                    onChange={(e) => setAreas({ ...areas, [c.codigo]: e.target.value })}
                    className={`${estiloEntrada} !mt-0`}
                  >
                    <option value="">Área…</option>
                    {a.areas.map((x) => (
                      <option key={x.codigo} value={x.codigo}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          )}
          <input
            type="hidden"
            name="proposta"
            value={JSON.stringify({ ...a.proposta, centrosNovos: a.proposta.centrosNovos.map((c) => ({ ...c, area: areas[c.codigo] || null })) })}
          />
          <BotaoEnviar pendente={gravando} disabled={a.proposta.postos.length === 0} enviando="Importando…">
            Importar {a.proposta.postos.length} postos
          </BotaoEnviar>
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

function Relatorio({ analise }: { analise: Analise }) {
  const r = analise.relatorio;
  const problemas = r.rateiosForaDe100.length + r.postosSemRateio.length;
  return (
    <section className="space-y-4 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-relatorio">
      <h2 id="t-relatorio" className="text-lg font-bold">2. Conferir o que será importado</h2>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-texto-suave">Postos</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.total}</dd>
          <dd className="text-texto-suave">{r.postos.vagas} {r.postos.vagas === 1 ? 'vaga prevista' : 'vagas previstas'}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Com rateio válido</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.comRateio}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Cargos novos</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.cargos.novos}</dd>
          <dd className="text-texto-suave">{r.cargos.valores} valores na tabela salarial</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Custo mensal calculado</dt>
          <dd className="text-2xl font-semibold tabular-nums">{reais(r.custoMensalApp)}</dd>
          {r.custoMensalPlanilha !== null && <dd className="text-texto-suave">Na planilha: {reais(r.custoMensalPlanilha)}</dd>}
        </div>
      </dl>

      {problemas > 0 && (
        <div className="rounded-md bg-aviso-fundo p-4 text-sm text-aviso">
          <p className="font-semibold">
            {problemas} {problemas === 1 ? 'posto vai' : 'postos vão'} entrar sem rateio e precisarão de ajuste depois.
          </p>
          {r.rateiosForaDe100.length > 0 && (
            <>
              <p className="mt-2">Rateio que não soma 100% (não é gravado):</p>
              <ul className="ml-5 list-disc">
                {r.rateiosForaDe100.map((x) => (
                  <li key={x.ficha}>
                    {quem(x)}: soma {percentual(x.soma)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.postosSemRateio.length > 0 && (
            <>
              <p className="mt-2">Sem rateio na planilha:</p>
              <ul className="ml-5 list-disc">
                {r.postosSemRateio.map((x, i) => (
                  <li key={i}>{quem(x)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {r.diferencasCusto.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            {r.diferencasCusto.length} {r.diferencasCusto.length === 1 ? 'posto tem' : 'postos têm'} custo diferente do total da planilha
          </summary>
          <p className="mt-2 text-texto-suave">
            O app calcula provisões e encargos pelos parâmetros da folha. Diferenças grandes podem indicar parâmetro ou componente a conferir.
          </p>
          <table className="mt-2 text-left">
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="pr-4 font-medium">Posto</th>
                <th scope="col" className="pr-4 text-right font-medium">Planilha</th>
                <th scope="col" className="text-right font-medium">App</th>
              </tr>
            </thead>
            <tbody>
              {r.diferencasCusto.slice(0, 30).map((d, i) => (
                <tr key={i}>
                  <td className="pr-4">{quem(d)}</td>
                  <td className="pr-4 text-right tabular-nums">{reais(d.planilha)}</td>
                  <td className="text-right tabular-nums">{reais(d.app)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Detalhes da leitura</summary>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Abas usadas: {[r.abas.tabela, r.abas.estudo, r.abas.rateio].filter(Boolean).join(', ') || 'nenhuma'}.
          </li>
          {r.fichasJaCadastradas.length > 0 && <li>Fichas já cadastradas, ignoradas: {r.fichasJaCadastradas.join(', ')}.</li>}
          {r.semAdmissao > 0 && <li>{r.semAdmissao} postos sem data de admissão: entram com 1º de janeiro.</li>}
          {r.colunasCalculadas.length > 0 && <li>Colunas calculadas pelo app, não importadas: {r.colunasCalculadas.join(', ')}.</li>}
          {r.colunasIgnoradas.map((c) => (
            <li key={c.aba}>
              Colunas não reconhecidas na aba {c.aba}: {c.colunas.join(', ')}.
            </li>
          ))}
          {r.avisos.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
