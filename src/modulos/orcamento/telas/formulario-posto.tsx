'use client';

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeAtencao, IconeCerto } from '@/ui/icones';
import type { FichaPosto } from '../aplicacao/folha';
import { COMPONENTES, custoMensal, dividirIgualmente, salarioPelaTabela, somaRateio, validarRateio, type LinhaRateio } from '../dominio/folha';
import { NIVEIS } from '../dados/tabelas';
import { GridRateio } from './grid-rateio';
import { percentual, reais } from './formato';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

/** Aceita "2554,97", "2.554,97" e "2554.97". */
const numero = (t: string) => {
  const s = t.trim().replace(/\s|R\$/g, '');
  if (s === '') return 0;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie">
      <div className="border-b border-borda px-5 py-4">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Requisito({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-texto-suave' : 'font-semibold text-texto'}`}>
      <span className={`flex size-5 items-center justify-center rounded-full ${ok ? 'bg-sucesso-fundo text-sucesso' : 'bg-aviso-fundo text-aviso'}`}>
        {ok ? <IconeCerto tamanho={13} /> : <IconeAtencao tamanho={13} />}
      </span>
      {children}
    </li>
  );
}

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
  const numerosValidos = COMPONENTES.every((c) => Number.isFinite(componentes[c.chave]) && componentes[c.chave] >= 0);
  const requisitos = {
    quem: vaga || colaborador.trim().length > 1,
    cargo: Boolean(cargo),
    inicio: Boolean(inicio),
    salario: numerosValidos && componentes.salario_base + componentes.bolsa_estagio > 0,
    rateio: errosRateio.length === 0,
  };
  const pronto = Object.values(requisitos).every(Boolean);

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

  // Aviso ao sair da página com alterações não salvas.
  const inicial = useRef(dados);
  const alterado = dados !== inicial.current;
  useEffect(() => {
    if (!alterado || enviando) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [alterado, enviando]);

  const campoComponente = (c: (typeof COMPONENTES)[number]) => (
    <Campo key={c.chave} rotulo={c.nome}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-texto-suave">R$</span>
        <input
          value={valores[c.chave]}
          onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
          inputMode="decimal"
          placeholder="0,00"
          aria-invalid={!Number.isFinite(componentes[c.chave]) || undefined}
          className={`${estiloEntrada} pl-10 text-right tabular-nums aria-[invalid]:border-erro`}
        />
      </div>
      {c.chave === 'salario_base' && sugerido !== undefined && sugerido !== componentes.salario_base && podeEditar && (
        <button
          type="button"
          onClick={() => setValores({ ...valores, salario_base: String(sugerido).replace('.', ',') })}
          className="mt-1 text-xs font-semibold text-destaque underline underline-offset-2"
        >
          Usar o valor da tabela ({reais(sugerido)})
        </button>
      )}
    </Campo>
  );

  return (
    <form action={enviar} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="dados" value={dados} />
      <fieldset disabled={!podeEditar} className="min-w-0 space-y-6">
        <legend className="sr-only">Dados do posto</legend>
        <Bloco titulo="Quem ocupa o posto">
          <label className="mb-4 flex w-fit cursor-pointer items-center gap-2.5 rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm">
            <input type="checkbox" checked={vaga} onChange={(e) => setVaga(e.target.checked)} className="size-4 accent-[var(--destaque)]" />
            <span>
              É uma <strong>vaga prevista</strong> (contratação futura, ainda sem pessoa)
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-6">
            {!vaga && (
              <>
                <Campo rotulo="Colaborador" obrigatorio className="sm:col-span-4">
                  <input value={colaborador} onChange={(e) => setColaborador(e.target.value)} required autoComplete="off" className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Nº da ficha" className="sm:col-span-2">
                  <input value={numeroFicha} onChange={(e) => setNumeroFicha(e.target.value)} inputMode="numeric" className={estiloEntrada} />
                </Campo>
              </>
            )}
            <Campo rotulo="Cargo" obrigatorio className="sm:col-span-3">
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} required className={estiloEntrada}>
                <option value="">Escolha o cargo</option>
                {cad.cargos.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Nível" className="sm:col-span-1">
              <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={estiloEntrada}>
                <option value="">—</option>
                {NIVEIS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Horas por semana" className="sm:col-span-2">
              <input value={carga} onChange={(e) => setCarga(e.target.value)} type="number" min="1" max="44" className={estiloEntrada} />
            </Campo>
            <Campo rotulo={vaga ? 'Início previsto' : 'Admissão'} obrigatorio className="sm:col-span-2">
              <input value={inicio} onChange={(e) => setInicio(e.target.value)} type="date" required className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Observação" className="sm:col-span-4">
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={estiloEntrada} />
            </Campo>
          </div>
        </Bloco>

        <Bloco
          titulo="Remuneração e benefícios"
          descricao="Valores mensais. Provisões de férias, 13º e encargos são calculadas pelo app a partir dos parâmetros da folha."
        >
          <h3 className="mb-3 text-sm font-bold text-texto-suave">Remuneração</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{COMPONENTES.filter((c) => c.remuneratorio).map(campoComponente)}</div>
          <h3 className="mb-3 mt-6 text-sm font-bold text-texto-suave">Benefícios</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{COMPONENTES.filter((c) => !c.remuneratorio).map(campoComponente)}</div>
        </Bloco>

        <Bloco titulo="Rateio por centro de custo" descricao="Como o custo deste posto se divide entre os centros de custo. A soma precisa ser exatamente 100%.">
          <GridRateio
            linhas={rateio}
            onChange={setRateio}
            centros={cad.centros}
            custoMensal={custo.total}
            somenteLeitura={!podeEditar}
            onDividir={() => setRateio(dividirIgualmente(rateio.map((l) => l.centro).filter(Boolean)))}
          />
        </Bloco>
      </fieldset>

      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Resumo do posto">
        <div className="rounded-xl border border-borda bg-superficie p-5">
          <p className="text-sm text-texto-suave">Custo mensal</p>
          <p className="mt-0.5 text-[1.75rem] font-bold leading-tight tabular-nums" aria-live="polite">
            {reais(custo.total)}
          </p>
          <dl className="mt-3 space-y-1.5 border-t border-borda pt-3 text-sm">
            {[
              ['Remuneração', custo.remuneracao],
              ['Benefícios', custo.beneficios],
              ['Provisões e encargos', custo.provisoes],
            ].map(([r, v]) => (
              <div key={r as string} className="flex justify-between gap-2">
                <dt className="text-texto-suave">{r}</dt>
                <dd className="tabular-nums">{reais(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-borda pt-1.5 font-semibold">
              <dt>Em 12 meses</dt>
              <dd className="tabular-nums">{reais(custo.total * 12)}</dd>
            </div>
          </dl>
          {cad.parametros.reajuste_percentual > 0 && (
            <p className="mt-3 text-xs text-texto-suave">
              Sem o reajuste de {percentual(cad.parametros.reajuste_percentual)} previsto a partir do mês {cad.parametros.reajuste_mes}.
            </p>
          )}
        </div>

        {podeEditar ? (
          <div className="space-y-4 rounded-xl border border-borda bg-superficie p-5">
            <ul className="space-y-1.5 text-sm" aria-label="Para salvar">
              <Requisito ok={requisitos.quem}>{vaga ? 'Vaga prevista' : 'Nome do colaborador'}</Requisito>
              <Requisito ok={requisitos.cargo && requisitos.inicio}>Cargo e {vaga ? 'início' : 'admissão'}</Requisito>
              <Requisito ok={requisitos.salario}>Salário base (ou bolsa estágio)</Requisito>
              <Requisito ok={requisitos.rateio}>
                {requisitos.rateio
                  ? 'Rateio somando 100%'
                  : rateio.length === 0
                    ? 'Rateio: adicione um centro de custo'
                    : rateio.some((l) => !l.centro)
                      ? 'Rateio: escolha o centro de todas as linhas'
                      : `Rateio em ${percentual(somaRateio(rateio))}; precisa de 100%`}
              </Requisito>
            </ul>
            {posto && (
              <Campo rotulo="Os valores e o rateio valem a partir de" dica="Os meses anteriores continuam com os valores antigos.">
                <input value={vigencia} onChange={(e) => setVigencia(e.target.value)} type="month" required className={estiloEntrada} />
              </Campo>
            )}
            <BotaoEnviar pendente={enviando} disabled={!pronto} enviando="Salvando…" className="w-full">
              {posto ? 'Salvar alterações' : 'Cadastrar posto'}
            </BotaoEnviar>
            {alterado && !enviando && <p className="text-center text-xs text-texto-suave">Há alterações ainda não salvas.</p>}
          </div>
        ) : (
          <Aviso tipo="info">Você pode consultar este posto, sem alterar.</Aviso>
        )}
        {estado.erro && (
          <Aviso tipo="erro" titulo="Não foi possível salvar">
            {estado.erro}
          </Aviso>
        )}
      </aside>
    </form>
  );
}
