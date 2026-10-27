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
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const servicos = a ? a.proposta.servicos.map((m) => ({ ...m, servico: escolhas[m.nome] ?? m.servico })) : [];
  const faltam = servicos.filter((m) => !m.servico).length;

  return (
    <div className="space-y-6">
      <form action={enviarArquivo} className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
        <h2 className="text-lg font-bold">1. Enviar o arquivo</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          No Google Drive, abra a planilha da folha e use Arquivo › Fazer download › Microsoft Excel (.xlsx). O app usa as abas Estudo e
          Rateio, ligadas pelo nº da ficha. Nada é gravado antes da sua confirmação.
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
          {servicos.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm">
                Confira a qual <strong>Serviço</strong> corresponde cada lotação da planilha. Os que o app reconheceu já vêm preenchidos.
              </legend>
              {servicos.map((m) => (
                <label key={m.nome} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_20rem]">
                  <span className={m.servico ? '' : 'font-semibold'}>{m.nome}</span>
                  <select
                    required
                    value={m.servico ?? ''}
                    onChange={(e) => setEscolhas({ ...escolhas, [m.nome]: e.target.value })}
                    className={`${estiloEntrada} !mt-0 ${m.servico ? '' : 'border-aviso'}`}
                  >
                    <option value="">Escolha o serviço…</option>
                    {[...new Set(a.opcoes.map((o) => o.area))].map((area) => (
                      <optgroup key={area} label={area}>
                        {a.opcoes
                          .filter((o) => o.area === area)
                          .map((o) => (
                            <option key={o.codigo} value={o.codigo}>
                              {o.nome}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ))}
              {a.opcoes.length === 0 && (
                <Aviso tipo="atencao">Nenhum serviço cadastrado. Cadastre os serviços em Administração › Serviços antes de importar.</Aviso>
              )}
            </fieldset>
          )}
          <input type="hidden" name="proposta" value={JSON.stringify({ ...a.proposta, servicos })} />
          <BotaoEnviar pendente={gravando} disabled={a.proposta.postos.length === 0 || faltam > 0} enviando="Importando…">
            Importar {a.proposta.postos.length} {a.proposta.postos.length === 1 ? 'funcionário' : 'funcionários'}
          </BotaoEnviar>
          {faltam > 0 && (
            <p className="text-sm text-aviso">
              Falta escolher o serviço de {faltam} {faltam === 1 ? 'lotação' : 'lotações'}.
            </p>
          )}
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
  const problemas = r.lotacoesForaDe100.length + r.semLotacao.length;
  return (
    <section className="space-y-4 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-relatorio">
      <h2 id="t-relatorio" className="text-lg font-bold">2. Conferir o que será importado</h2>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-texto-suave">Funcionários</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.total}</dd>
          <dd className="text-texto-suave">{r.postos.vagas} {r.postos.vagas === 1 ? 'vaga prevista' : 'vagas previstas'}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Com lotação válida</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.comLotacao}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Lotações reconhecidas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.servicos.reconhecidos}</dd>
          <dd className="text-texto-suave">{r.servicos.aEscolher} para você escolher</dd>
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
            {problemas} {problemas === 1 ? 'funcionário vai' : 'funcionários vão'} entrar sem lotação e precisarão de ajuste depois, na tela Lotação.
          </p>
          {r.lotacoesForaDe100.length > 0 && (
            <>
              <p className="mt-2">Lotação que não soma 100% (não é gravada):</p>
              <ul className="ml-5 list-disc">
                {r.lotacoesForaDe100.map((x) => (
                  <li key={x.ficha}>
                    {quem(x)}: soma {percentual(x.soma)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.semLotacao.length > 0 && (
            <>
              <p className="mt-2">Sem lotação na planilha:</p>
              <ul className="ml-5 list-disc">
                {r.semLotacao.map((x, i) => (
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
            {r.diferencasCusto.length} {r.diferencasCusto.length === 1 ? 'funcionário tem' : 'funcionários têm'} custo diferente do total da planilha
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
            Abas usadas: {[r.abas.estudo, r.abas.rateio].filter(Boolean).join(', ') || 'nenhuma'}.
          </li>
          {r.fichasJaCadastradas.length > 0 && <li>Códigos já cadastrados, ignorados: {r.fichasJaCadastradas.join(', ')}.</li>}
          {r.vagasJaCadastradas > 0 && <li>{r.vagasJaCadastradas} vagas previstas já cadastradas, ignoradas.</li>}
          {r.semAdmissao > 0 && <li>{r.semAdmissao} funcionários sem data de admissão: entram com 1º de janeiro.</li>}
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
