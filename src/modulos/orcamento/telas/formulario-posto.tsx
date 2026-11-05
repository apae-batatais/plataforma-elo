'use client';

/**
 * Ficha do funcionário: todas as colunas da aba Estudo. As colunas que na
 * planilha tinham fórmula aparecem como "calculado" e não se digitam.
 */
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeAtencao, IconeCerto } from '@/ui/icones';
import type { FichaPosto } from '../aplicacao/folha';
import { calcularLinha, COMPONENTES, dividirIgualmente, somaRateio, validarRateio, type ChaveComponente, type LinhaRateio } from '../dominio/folha';
import { GridRateio } from './grid-rateio';
import { percentual, reais } from './formato';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

/** Aceita "2554,97", "2.554,97" e "2554.97". */
const numero = (t: string) => {
  const s = t.trim().replace(/\s|R\$|%/g, '');
  if (s === '') return 0;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};
const paraTexto = (v: number) => (v ? String(v).replace('.', ',') : '');

const nomeDe = (chave: ChaveComponente) => COMPONENTES.find((c) => c.chave === chave)!.nome;

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="rounded-cartao border border-borda bg-superficie">
      <div className="border-b border-borda px-5 py-4">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Valor calculado pelo app (na planilha era fórmula). */
function Calculado({ rotulo, valor, formula }: { rotulo: string; valor: string; formula: string }) {
  return (
    <div className="text-sm">
      <span className="font-semibold">{rotulo}</span>
      <span className="mt-0.5 block text-texto-suave">{formula}</span>
      <output className="mt-1.5 flex min-h-10 items-center justify-end rounded-md border border-dashed border-borda-forte bg-superficie-2 px-3 py-2 tabular-nums">
        {valor}
      </output>
    </div>
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
  const p = cad.parametros;
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [vaga, setVaga] = useState(posto ? !posto.ficha : false);
  const [colaborador, setColaborador] = useState(posto?.colaborador ?? '');
  const [codigo, setCodigo] = useState(posto?.ficha ?? '');
  const [cargo, setCargo] = useState(posto?.cargo ?? '');
  const [departamento, setDepartamento] = useState(posto?.departamento ?? '');
  const [carga, setCarga] = useState(posto?.cargaHoraria ? String(posto.cargaHoraria) : '200');
  const [inicio, setInicio] = useState(posto?.inicio ?? `${cad.ano}-01-01`);
  const [observacao, setObservacao] = useState(posto?.observacao ?? '');
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(COMPONENTES.map((c) => [c.chave, paraTexto(ficha.componentes[c.chave])])),
  );
  const [reajuste, setReajuste] = useState(paraTexto(ficha.componentes.reajuste));
  const [horaAtividade, setHoraAtividade] = useState(ficha.componentes.hora_atividade);
  const [rateio, setRateio] = useState<LinhaRateio[]>(ficha.rateio.length ? ficha.rateio : []);
  const [vigencia, setVigencia] = useState(`${cad.ano}-01`);

  const componentes = useMemo(
    () =>
      ({
        ...Object.fromEntries(COMPONENTES.map((c) => [c.chave, numero(valores[c.chave] ?? '')])),
        reajuste: numero(reajuste),
        hora_atividade: horaAtividade,
      }) as FichaPosto['componentes'],
    [valores, reajuste, horaAtividade],
  );
  const cargaHoraria = carga ? Number(carga) : null;
  const calc = calcularLinha(componentes, cargaHoraria, p, 12);
  const errosRateio = validarRateio(rateio);
  const numerosValidos = COMPONENTES.every((c) => Number.isFinite(componentes[c.chave]) && componentes[c.chave] >= 0) && Number.isFinite(componentes.reajuste);
  const requisitos = {
    quem: colaborador.trim().length > 1 && (vaga || codigo.trim().length > 0),
    cargo: cargo.trim().length > 1 && Boolean(inicio),
    salario: numerosValidos && componentes.salario_atual + componentes.bolsa_estagio > 0,
    rateio: errosRateio.length === 0,
  };
  const pronto = Object.values(requisitos).every(Boolean);

  const dados = JSON.stringify({
    id: posto?.id,
    versao: posto?.versao,
    ficha: vaga ? null : codigo || null,
    colaborador: colaborador || null,
    cargo,
    departamento: departamento || null,
    cargaHoraria,
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

  const dinheiro = (chave: ChaveComponente, dica?: string) => (
    <Campo key={chave} rotulo={nomeDe(chave)} dica={dica}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-texto-suave">R$</span>
        <input
          value={valores[chave]}
          onChange={(e) => setValores({ ...valores, [chave]: e.target.value })}
          inputMode="decimal"
          placeholder="0,00"
          aria-invalid={!Number.isFinite(componentes[chave]) || undefined}
          className={`${estiloEntrada} pl-10 text-right tabular-nums aria-[invalid]:border-erro`}
        />
      </div>
    </Campo>
  );
  const grade = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <form action={enviar} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="dados" value={dados} />
      <fieldset disabled={!podeEditar} className="min-w-0 space-y-6">
        <legend className="sr-only">Dados do funcionário</legend>

        <Bloco titulo="Identificação">
          <label className="mb-4 flex w-fit cursor-pointer items-center gap-2.5 rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm">
            <input type="checkbox" checked={vaga} onChange={(e) => setVaga(e.target.checked)} className="size-4 accent-[var(--destaque)]" />
            <span>
              É uma <strong>vaga prevista</strong> (sem código: contratação futura, estagiário a contratar etc.)
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-6">
            {!vaga && (
              <Campo rotulo="Código" obrigatorio className="sm:col-span-1">
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" className={estiloEntrada} />
              </Campo>
            )}
            <Campo rotulo={vaga ? 'Descrição da vaga' : 'Nome'} obrigatorio className={vaga ? 'sm:col-span-6' : 'sm:col-span-5'}>
              <input
                value={colaborador}
                onChange={(e) => setColaborador(e.target.value)}
                required
                autoComplete="off"
                placeholder={vaga ? 'Ex.: A contratar – Fisioterapeuta' : undefined}
                className={estiloEntrada}
              />
            </Campo>
            <Campo rotulo="Cargo" obrigatorio className="sm:col-span-3">
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} required list="cargos-usados" autoComplete="off" className={estiloEntrada} />
              <datalist id="cargos-usados">
                {cad.cargos.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Departamento" className="sm:col-span-3">
              <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={estiloEntrada} />
            </Campo>
            <Campo rotulo={vaga ? 'Início previsto' : 'Admissão'} obrigatorio className="sm:col-span-2">
              <input value={inicio} onChange={(e) => setInicio(e.target.value)} type="date" required className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Carga horária" dica="Horas por mês (ex.: 200)" className="sm:col-span-2">
              <input value={carga} onChange={(e) => setCarga(e.target.value)} type="number" min="1" max="300" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Observação" dica=" " className="sm:col-span-2">
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={estiloEntrada} />
            </Campo>
          </div>
        </Bloco>

        <Bloco titulo="Salário" descricao="Valores mensais. Os campos tracejados são calculados pelo app, como as fórmulas da planilha.">
          <div className={grade}>
            {dinheiro('salario_atual')}
            <Campo rotulo="Reajuste" dica={`Padrão: ${percentual(p.reajuste_padrao)}`}>
              <div className="relative">
                <input
                  value={reajuste}
                  onChange={(e) => setReajuste(e.target.value)}
                  inputMode="decimal"
                  className={`${estiloEntrada} pr-8 text-right tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-texto-suave">%</span>
              </div>
            </Campo>
            <Calculado rotulo="Valor hora" formula="Salário atual ÷ carga horária" valor={reais(calc.valorHora)} />
            <Calculado rotulo="Salário base" formula="Salário atual + reajuste" valor={reais(calc.salarioBase)} />
            <Calculado rotulo="Valor hora base" formula="Salário base ÷ carga horária" valor={reais(calc.valorHoraBase)} />
            <div className="text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" checked={horaAtividade} onChange={(e) => setHoraAtividade(e.target.checked)} className="size-4 accent-[var(--destaque)]" />
                Recebe hora atividade
              </label>
              <span className="mt-0.5 block text-texto-suave">{percentual(p.hora_atividade)} do salário base</span>
              <output className="mt-1.5 flex min-h-10 items-center justify-end rounded-md border border-dashed border-borda-forte bg-superficie-2 px-3 py-2 tabular-nums">
                {reais(calc.horaAtividade)}
              </output>
            </div>
          </div>
        </Bloco>

        <Bloco titulo="Adicionais e gratificação">
          <div className={grade}>
            {dinheiro('adicional_salarial')}
            {dinheiro('insalubridade')}
            {dinheiro('periculosidade')}
            {dinheiro('gratificacao_funcao')}
          </div>
        </Bloco>

        <Bloco titulo="Natureza não salarial e benefícios">
          <div className={grade}>
            {dinheiro('ajuda_custo')}
            {dinheiro('bolsa_estagio')}
            {dinheiro('plano_saude')}
            {dinheiro('bolsa_estudo')}
            {dinheiro('locomocao')}
            {dinheiro('alimentacao')}
          </div>
        </Bloco>

        <Bloco titulo="Férias, 13º e FGTS">
          <div className={grade}>
            {dinheiro('ferias')}
            <Calculado rotulo="1/3 de férias" formula="Salário base ÷ 3 ÷ 12" valor={reais(calc.tercoFerias)} />
            {dinheiro('abono')}
            {dinheiro('indenizacoes')}
            <Calculado rotulo="13º salário" formula="Salário base ÷ 12" valor={reais(calc.decimoTerceiro)} />
            <Calculado
              rotulo="FGTS"
              formula={`${percentual(p.fgts)} de salário base, adicional, hora atividade, insalubridade, 1/3 e 13º`}
              valor={reais(calc.fgts)}
            />
          </div>
        </Bloco>

        <Bloco titulo="Lotação" descricao="Em quais serviços este funcionário trabalha e em que proporção. A soma precisa ser exatamente 100%.">
          <GridRateio
            linhas={rateio}
            onChange={setRateio}
            centros={cad.centros}
            custoMensal={calc.total}
            somenteLeitura={!podeEditar}
            onDividir={() => setRateio(dividirIgualmente(rateio.map((l) => l.centro).filter(Boolean)))}
          />
        </Bloco>
      </fieldset>

      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Resumo do funcionário">
        <div className="rounded-cartao border border-borda bg-superficie p-5">
          <p className="text-sm text-texto-suave">Total mensal</p>
          <p className="mt-0.5 text-[1.75rem] font-bold leading-tight tabular-nums" aria-live="polite">
            {reais(calc.total)}
          </p>
          <dl className="mt-3 space-y-1.5 border-t border-borda pt-3 text-sm">
            {[
              ['Salário base', calc.salarioBase],
              ['1/3 de férias', calc.tercoFerias],
              ['13º salário', calc.decimoTerceiro],
              ['FGTS', calc.fgts],
              ['Demais valores', calc.total - calc.salarioBase - calc.tercoFerias - calc.decimoTerceiro - calc.fgts],
            ].map(([r, v]) => (
              <div key={r as string} className="flex justify-between gap-2">
                <dt className="text-texto-suave">{r}</dt>
                <dd className="tabular-nums">{reais(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-borda pt-1.5 font-semibold">
              <dt>Em 12 meses</dt>
              <dd className="tabular-nums">{reais(calc.total * 12)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-texto-suave">
            Igual à coluna TOTAL da planilha. Encargos patronais (INSS, terceiros, FAP) entram no Resumo da folha.
          </p>
        </div>

        {podeEditar ? (
          <div className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
            <ul className="space-y-1.5 text-sm" aria-label="Para salvar">
              <Requisito ok={requisitos.quem}>{vaga ? 'Descrição da vaga' : 'Código e nome'}</Requisito>
              <Requisito ok={requisitos.cargo}>Cargo e {vaga ? 'início' : 'admissão'}</Requisito>
              <Requisito ok={requisitos.salario}>Salário atual (ou bolsa estágio)</Requisito>
              <Requisito ok={requisitos.rateio}>
                {requisitos.rateio
                  ? 'Lotação somando 100%'
                  : rateio.length === 0
                    ? 'Lotação: adicione um serviço'
                    : rateio.some((l) => !l.centro)
                      ? 'Lotação: escolha o serviço de todas as linhas'
                      : `Lotação em ${percentual(somaRateio(rateio))}; precisa de 100%`}
              </Requisito>
            </ul>
            {posto && (
              <Campo rotulo="Os valores e a lotação valem a partir de" dica="Os meses anteriores continuam com os valores antigos.">
                <input value={vigencia} onChange={(e) => setVigencia(e.target.value)} type="month" required className={estiloEntrada} />
              </Campo>
            )}
            <BotaoEnviar pendente={enviando} disabled={!pronto} enviando="Salvando…" className="w-full">
              {posto ? 'Salvar alterações' : 'Cadastrar'}
            </BotaoEnviar>
            {alterado && !enviando && <p className="text-center text-xs text-texto-suave">Há alterações ainda não salvas.</p>}
          </div>
        ) : (
          <Aviso tipo="info">Você pode consultar, sem alterar.</Aviso>
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
