'use client';

import { useActionState, useMemo, useState } from 'react';
import type { FichaPosto } from '../aplicacao/folha';
import { COMPONENTES, custoMensal, dividirIgualmente, salarioPelaTabela, validarRateio, type LinhaRateio } from '../dominio/folha';
import { NIVEIS } from '../dados/tabelas';
import { GridRateio } from './grid-rateio';
import { reais } from './formato';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

const campo = 'mt-1 w-full rounded-md border border-borda bg-superficie px-3 py-2 disabled:opacity-70';
/** Aceita "2554,97", "2.554,97" e "2554.97". */
const numero = (t: string) => {
  const s = t.trim().replace(/\s|R\$/g, '');
  if (s === '') return 0;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};

export function FormularioPosto({ ficha, acao }: { ficha: FichaPosto; acao: Acao }) {
  const { posto, cadastros: cad, podeEditar } = ficha;
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [vaga, setVaga] = useState(posto ? !posto.colaborador : false);
  const [colaborador, setColaborador] = useState(posto?.colaborador ?? '');
  const [numeroFicha, setNumeroFicha] = useState(posto?.ficha ?? '');
  const [cargo, setCargo] = useState(posto?.cargo ?? '');
  const [nivel, setNivel] = useState(posto?.nivel ?? '');
  const [carga, setCarga] = useState(posto?.cargaHoraria ? String(posto.cargaHoraria) : '');
  const [inicio, setInicio] = useState(posto?.inicio ?? `${cad.ano}-01-01`);
  const [observacao, setObservacao] = useState(posto?.observacao ?? '');
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(COMPONENTES.map((c) => [c.chave, ficha.componentes[c.chave] ? String(ficha.componentes[c.chave]).replace('.', ',') : ''])),
  );
  const [rateio, setRateio] = useState<LinhaRateio[]>(ficha.rateio.length ? ficha.rateio : []);
  const [vigencia, setVigencia] = useState(`${cad.ano}-01`);

  const componentes = useMemo(
    () => Object.fromEntries(COMPONENTES.map((c) => [c.chave, numero(valores[c.chave] ?? '')])) as FichaPosto['componentes'],
    [valores],
  );
  const custo = custoMensal(componentes, cad.parametros, 1);
  const cargoEscolhido = cad.cargos.find((c) => c.codigo === cargo);
  const valorTabela = cargo && nivel ? cad.tabela[`${cargo}|${nivel}`] : undefined;
  const sugerido = valorTabela !== undefined ? salarioPelaTabela(valorTabela, carga ? Number(carga) : null, cargoEscolhido?.cargaReferencia ?? null) : undefined;
  const errosRateio = validarRateio(rateio);
  const pronto = cargo && inicio && errosRateio.length === 0 && componentes.salario_base + componentes.bolsa_estagio > 0;

  const dados = JSON.stringify({
    id: posto?.id,
    versao: posto?.versao,
    ficha: vaga ? null : numeroFicha || null,
    colaborador: vaga ? null : colaborador || null,
    cargo,
    nivel: nivel || null,
    cargaHoraria: carga ? Number(carga) : null,
    inicio,
    observacao: observacao || null,
    componentes,
    rateio,
    vigencia: posto ? vigencia : inicio.slice(0, 7),
  });

  return (
    <form action={enviar} className="space-y-6">
      <input type="hidden" name="dados" value={dados} />
      <fieldset disabled={!podeEditar} className="min-w-0 space-y-6">
        <section className="rounded-lg border border-borda bg-superficie p-5">
          <h3 className="text-lg font-semibold">Quem ocupa o posto</h3>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vaga} onChange={(e) => setVaga(e.target.checked)} />
            Vaga prevista (contratação futura, ainda sem pessoa)
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {!vaga && (
              <>
                <label className="text-sm sm:col-span-2">
                  Colaborador
                  <input value={colaborador} onChange={(e) => setColaborador(e.target.value)} required className={campo} autoComplete="off" />
                </label>
                <label className="text-sm">
                  Nº da ficha
                  <input value={numeroFicha} onChange={(e) => setNumeroFicha(e.target.value)} className={campo} inputMode="numeric" />
                </label>
              </>
            )}
            <label className="text-sm">
              Cargo
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} required className={campo}>
                <option value="">Escolha…</option>
                {cad.cargos.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Nível
              <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={campo}>
                <option value="">—</option>
                {NIVEIS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Carga horária semanal
              <input value={carga} onChange={(e) => setCarga(e.target.value)} type="number" min="1" max="44" className={campo} />
            </label>
            <label className="text-sm">
              {vaga ? 'Início previsto' : 'Admissão'}
              <input value={inicio} onChange={(e) => setInicio(e.target.value)} type="date" required className={campo} />
            </label>
            <label className="text-sm sm:col-span-2">
              Observação
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-borda bg-superficie p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold">Custo mensal</h3>
            <p className="text-2xl font-semibold tabular-nums">{reais(custo.total)}</p>
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            Remuneração {reais(custo.remuneracao)} + benefícios {reais(custo.beneficios)} + provisões e encargos {reais(custo.provisoes)}.
            {cad.parametros.reajuste_percentual > 0 &&
              ` A partir do mês ${cad.parametros.reajuste_mes}, a remuneração tem reajuste de ${cad.parametros.reajuste_percentual}%.`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {COMPONENTES.map((c) => (
              <label key={c.chave} className="text-sm">
                {c.nome}
                <input
                  value={valores[c.chave]}
                  onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${campo} text-right tabular-nums`}
                />
                {c.chave === 'salario_base' && sugerido !== undefined && sugerido !== componentes.salario_base && (
                  <button
                    type="button"
                    onClick={() => setValores({ ...valores, salario_base: String(sugerido).replace('.', ',') })}
                    className="mt-1 text-xs text-destaque underline"
                  >
                    Usar o valor da tabela: {reais(sugerido)}
                  </button>
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-borda bg-superficie p-5">
          <h3 className="text-lg font-semibold">Rateio por centro de custo</h3>
          <p className="mt-1 text-sm text-texto-suave">Como o custo deste posto se divide entre os centros de custo. A soma precisa ser exatamente 100%.</p>
          <GridRateio
            linhas={rateio}
            onChange={setRateio}
            centros={cad.centros}
            custoMensal={custo.total}
            somenteLeitura={!podeEditar}
            onDividir={() => setRateio(dividirIgualmente(rateio.map((l) => l.centro).filter(Boolean)))}
          />
        </section>

        {podeEditar && (
          <div className="flex flex-wrap items-end gap-4">
            {posto && (
              <label className="text-sm">
                Valores e rateio valem a partir de
                <input value={vigencia} onChange={(e) => setVigencia(e.target.value)} type="month" required className={campo} />
              </label>
            )}
            <button
              disabled={!pronto || enviando}
              className="rounded-md bg-destaque px-5 py-2 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Salvando…' : 'Salvar posto'}
            </button>
            {!pronto && (
              <p className="text-sm text-texto-suave">
                {errosRateio.length ? `Rateio: ${errosRateio[0]}` : 'Preencha cargo, início e salário base para salvar.'}
              </p>
            )}
          </div>
        )}
        {estado.erro && (
          <p role="alert" className="rounded-md bg-aviso-fundo p-3 text-sm text-aviso">
            {estado.erro}
          </p>
        )}
      </fieldset>
    </form>
  );
}
