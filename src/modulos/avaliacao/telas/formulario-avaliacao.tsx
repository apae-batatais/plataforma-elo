'use client';

/**
 * Questionário da Avaliação de Serviços Sociais: uma tela só, em três colunas no computador.
 * As respostas ficam no navegador até salvar: um erro não apaga nada.
 * O índice de necessidade de cuidado é recalculado a cada resposta.
 */
import Link from 'next/link';
import { startTransition, useActionState, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Aviso } from '@/ui/aviso';
import { estiloBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import {
  BARREIRAS,
  conferirAvaliacao,
  CUIDADORES,
  DEFINICAO_GRAU,
  EVOLUCOES,
  fatoresDoIndice,
  geracao,
  GRAUS_DEFICIENCIA,
  GRAUS_DEPENDENCIA,
  idadeEm,
  INDICE_MAXIMO,
  NENHUMA_BARREIRA,
  normalizarIniciais,
  ROTULOS,
  TIPOS_AVALIACAO,
  SEM_CUIDADOR,
  temViolacao,
  type DadosAvaliacao,
} from '../dominio/avaliacao';

export type EstadoFormulario = { erro?: string; faltando?: (keyof DadosAvaliacao)[] };

export interface ServicoOpcao {
  codigo: string;
  nome: string;
  areaNome: string;
}

const entrada = `${estiloEntrada} !mt-1 !min-h-9 !py-1.5`;

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-bold text-destaque">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Rotulo({ texto, erro, dica }: { texto: string; erro?: boolean; dica?: string }) {
  return (
    <span className={`block text-[13px] font-semibold ${erro ? 'text-erro' : 'text-texto'}`}>
      {texto}
      {dica && <span className="font-normal text-texto-suave"> · {dica}</span>}
    </span>
  );
}

/** Botões de escolha única lado a lado (rádio acessível). */
function Escolha<T extends string>({
  nome,
  rotulo,
  opcoes,
  valor,
  aoMudar,
  erro,
  dica,
  rotulos,
}: {
  nome: string;
  rotulo: string;
  opcoes: readonly T[];
  valor: string;
  aoMudar: (v: T) => void;
  erro?: boolean;
  dica?: string;
  rotulos?: Partial<Record<T, string>>;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} aria-invalid={erro || undefined} className="min-w-0">
      <Rotulo texto={rotulo} erro={erro} dica={dica} />
      <div className="mt-1 flex gap-1">
        {opcoes.map((o) => (
          <label key={o} className="relative min-w-0 flex-1">
            <input type="radio" name={nome} value={o} checked={valor === o} onChange={() => aoMudar(o)} className="peer sr-only" />
            <span
              className={`flex min-h-9 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm leading-tight transition-colors peer-checked:border-destaque peer-checked:bg-destaque-suave peer-checked:font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque hover:border-texto-suave ${
                erro ? 'border-erro' : 'border-borda-forte'
              }`}
            >
              {rotulos?.[o] ?? o}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const SN = ['Sim', 'Não'] as const;

export function FormularioAvaliacao({
  servicos,
  inicial,
  hoje,
  acao,
  id,
  versao,
}: {
  servicos: ServicoOpcao[];
  inicial: DadosAvaliacao;
  hoje: string;
  acao: (estado: EstadoFormulario, f: FormData) => Promise<EstadoFormulario>;
  id?: string;
  versao?: number;
}) {
  const [d, setD] = useState<DadosAvaliacao>(inicial);
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [tentou, setTentou] = useState(false);
  const muda = <K extends keyof DadosAvaliacao>(k: K, v: DadosAvaliacao[K]) => setD((x) => ({ ...x, [k]: v }));

  const faltandoAgora = useMemo(() => new Set(conferirAvaliacao(d, hoje).faltando), [d, hoje]);
  const erro = (k: keyof DadosAvaliacao) => (tentou || (estado.faltando?.includes(k) ?? false)) && faltandoAgora.has(k);
  const idade = idadeEm(d.nascimento, d.data_avaliacao || hoje);
  const fatores = fatoresDoIndice(d);
  const indice = fatores.reduce((s, f) => s + f.pontos, 0);
  const nenhuma = d.barreiras.includes(NENHUMA_BARREIRA);
  const violacao = temViolacao(d.barreiras);
  const areas = [...new Set(servicos.map((s) => s.areaNome))];
  const cuidadorNaLista = !d.cuidador || d.cuidador === SEM_CUIDADOR || (CUIDADORES as readonly string[]).includes(d.cuidador);

  function alternarBarreira(codigo: string) {
    setD((x) => {
      if (codigo === NENHUMA_BARREIRA) return { ...x, barreiras: x.barreiras.includes(codigo) ? [] : [codigo] };
      const tem = x.barreiras.includes(codigo);
      return { ...x, barreiras: tem ? x.barreiras.filter((b) => b !== codigo) : [...x.barreiras.filter((b) => b !== NENHUMA_BARREIRA), codigo] };
    });
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTentou(true);
    if (faltandoAgora.size) {
      const primeiro = document.querySelector('[aria-invalid="true"]');
      primeiro?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const f = new FormData();
    f.set('dados', JSON.stringify(d));
    if (id) f.set('id', id);
    if (versao) f.set('versao', String(versao));
    startTransition(() => enviar(f));
  }

  const faltaLista = tentou ? [...faltandoAgora] : [];

  return (
    <form onSubmit={aoEnviar} noValidate className="rounded-cartao border border-borda bg-superficie">
      <div className="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2 xl:grid-cols-3">
        <Grupo titulo="Identificação">
          <Escolha nome="tipo" rotulo="Tipo de avaliação" opcoes={TIPOS_AVALIACAO} valor={d.tipo} aoMudar={(v) => muda('tipo', v)} erro={erro('tipo')} />
          <p className="-mt-2 text-xs text-texto-suave">
            Inicial: quando a pessoa é encaminhada ao serviço. Acompanhamento anual: uma vez por ano depois disso.
          </p>
          <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2">
            <label className="block" aria-invalid={erro('iniciais') || undefined}>
              <Rotulo texto="Iniciais" erro={erro('iniciais')} />
              <input
                className={entrada}
                value={d.iniciais}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                placeholder="MAS"
                onChange={(e) => muda('iniciais', normalizarIniciais(e.target.value))}
              />
            </label>
            <label className="block" aria-invalid={erro('nascimento') || undefined}>
              <Rotulo texto="Nascimento" erro={erro('nascimento')} />
              <input type="date" className={entrada} value={d.nascimento} max={hoje} onChange={(e) => muda('nascimento', e.target.value)} />
            </label>
            <label className="block" aria-invalid={erro('data_avaliacao') || undefined}>
              <Rotulo texto="Avaliação" erro={erro('data_avaliacao')} />
              <input type="date" className={entrada} value={d.data_avaliacao} max={hoje} onChange={(e) => muda('data_avaliacao', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Escolha nome="sexo" rotulo="Sexo" opcoes={['F', 'M'] as const} valor={d.sexo} aoMudar={(v) => muda('sexo', v)} erro={erro('sexo')} />
            <div>
              <Rotulo texto="Idade" />
              <p className="mt-1 flex min-h-9 items-center truncate rounded-md bg-superficie-2 px-2.5 text-sm text-texto-suave" aria-live="polite">
                {idade === null ? (
                  '—'
                ) : (
                  <>
                    <b className="mr-1 text-texto">{idade}</b> {geracao(idade).toLowerCase()}
                  </>
                )}
              </p>
            </div>
            <label className="block">
              <Rotulo texto="Prontuário" />
              <input
                className={entrada}
                value={d.prontuario}
                inputMode="numeric"
                autoComplete="off"
                placeholder="opcional"
                onChange={(e) => muda('prontuario', e.target.value)}
              />
            </label>
          </div>
          <label className="block" aria-invalid={erro('servico') || undefined}>
            <Rotulo texto="Serviço atual" erro={erro('servico')} />
            <select className={entrada} value={d.servico} onChange={(e) => muda('servico', e.target.value)}>
              <option value="">Selecione</option>
              {areas.map((a) => (
                <optgroup key={a} label={a}>
                  {servicos
                    .filter((s) => s.areaNome === a)
                    .map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Escolha
            nome="evolucao_usuario"
            rotulo="Evolução da pessoa atendida"
            opcoes={EVOLUCOES}
            valor={d.evolucao_usuario}
            aoMudar={(v) => muda('evolucao_usuario', v)}
            erro={erro('evolucao_usuario')}
          />
          <Escolha
            nome="evolucao_familia"
            rotulo="Evolução da família"
            opcoes={EVOLUCOES}
            valor={d.evolucao_familia}
            aoMudar={(v) => muda('evolucao_familia', v)}
            erro={erro('evolucao_familia')}
          />
        </Grupo>

        <Grupo titulo="Família e cuidado">
          <label className="block" aria-invalid={erro('cuidador') || undefined}>
            <Rotulo texto="Principal cuidador" erro={erro('cuidador')} />
            <select className={entrada} value={d.cuidador} onChange={(e) => muda('cuidador', e.target.value)}>
              <option value="">Selecione</option>
              {!cuidadorNaLista && <option value={d.cuidador}>{d.cuidador}</option>}
              {CUIDADORES.map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option value={SEM_CUIDADOR}>{SEM_CUIDADOR}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Escolha nome="bpc" rotulo="Recebe BPC" opcoes={SN} valor={d.bpc} aoMudar={(v) => muda('bpc', v)} erro={erro('bpc')} />
            <Escolha nome="mae_solo" rotulo="Mãe solo" opcoes={SN} valor={d.mae_solo} aoMudar={(v) => muda('mae_solo', v)} erro={erro('mae_solo')} />
            <Escolha
              nome="rede_apoio"
              rotulo="Rede de apoio"
              opcoes={SN}
              valor={d.rede_apoio}
              aoMudar={(v) => muda('rede_apoio', v)}
              erro={erro('rede_apoio')}
            />
            <Escolha
              nome="cuidador_idoso"
              rotulo="Cuidador idoso"
              dica="60+"
              opcoes={SN}
              valor={d.cuidador_idoso}
              aoMudar={(v) => muda('cuidador_idoso', v)}
              erro={erro('cuidador_idoso')}
            />
            <Escolha
              nome="nucleo_mais_pcd"
              rotulo="Mais de 1 PcD no núcleo"
              opcoes={SN}
              valor={d.nucleo_mais_pcd}
              aoMudar={(v) => muda('nucleo_mais_pcd', v)}
              erro={erro('nucleo_mais_pcd')}
            />
            <Escolha
              nome="adultos_30"
              rotulo="Adultos acima de 30"
              opcoes={SN}
              valor={d.adultos_30}
              aoMudar={(v) => muda('adultos_30', v)}
              erro={erro('adultos_30')}
            />
            <Escolha
              nome="isolamento"
              rotulo="Isolamento social"
              opcoes={SN}
              valor={d.isolamento}
              aoMudar={(v) => muda('isolamento', v)}
              erro={erro('isolamento')}
            />
            <Escolha
              nome="enfermagem"
              rotulo="Apoio de enfermagem"
              opcoes={SN}
              valor={d.enfermagem}
              aoMudar={(v) => muda('enfermagem', v)}
              erro={erro('enfermagem')}
            />
          </div>
          <Escolha
            nome="transporte"
            rotulo="Transporte"
            opcoes={['Comum', 'Rampa', 'Cadeirante'] as const}
            rotulos={{ Rampa: 'Com rampa' }}
            valor={d.transporte}
            aoMudar={(v) => muda('transporte', v)}
            erro={erro('transporte')}
          />
        </Grupo>

        <Grupo titulo="Deficiência, dependência e saúde">
          <Escolha
            nome="grau_deficiencia"
            rotulo="Grau de deficiência"
            opcoes={GRAUS_DEFICIENCIA}
            valor={d.grau_deficiencia}
            aoMudar={(v) => muda('grau_deficiencia', v)}
            erro={erro('grau_deficiencia')}
          />
          <div>
            <Escolha
              nome="grau_dependencia"
              rotulo="Grau de dependência"
              dica="RDC Anvisa 502/2021"
              opcoes={GRAUS_DEPENDENCIA}
              rotulos={{ I: 'Grau I', II: 'Grau II', III: 'Grau III' }}
              valor={d.grau_dependencia}
              aoMudar={(v) => muda('grau_dependencia', v)}
              erro={erro('grau_dependencia')}
            />
            <p className="mt-1 min-h-[2.6em] text-xs text-texto-suave" aria-live="polite">
              {d.grau_dependencia ? `Grau ${d.grau_dependencia}: ${DEFINICAO_GRAU[d.grau_dependencia]}` : 'Escolha o grau para ver a definição.'}
            </p>
          </div>
          <Escolha
            nome="ostomia"
            rotulo="Ostomia ou dispositivo"
            opcoes={['Não', 'Sim'] as const}
            valor={d.ostomia}
            aoMudar={(v) => muda('ostomia', v)}
            erro={erro('ostomia')}
          />
          {d.ostomia === 'Sim' && (
            <label className="block" aria-invalid={erro('ostomia_tipo') || undefined}>
              <Rotulo texto="Qual ostomia ou dispositivo" erro={erro('ostomia_tipo')} />
              <input
                className={entrada}
                list="dispositivos"
                value={d.ostomia_tipo}
                placeholder="Ex.: gastrostomia"
                onChange={(e) => muda('ostomia_tipo', e.target.value)}
              />
              <datalist id="dispositivos">
                {['Gastrostomia', 'Traqueostomia', 'Colostomia', 'Cateter venoso', 'Sonda'].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
          )}
          <div className="rounded-lg bg-superficie-2 p-3">
            <p className="flex items-baseline gap-2 text-sm text-texto-suave">
              Índice de necessidade de cuidado
              <b className="text-2xl text-destaque tabular-nums">{indice}</b>
              <span>de {INDICE_MAXIMO}</span>
            </p>
            <p className="mt-1 text-xs text-texto-suave">
              {fatores.length ? fatores.map((f) => (f.pontos > 1 ? `${f.nome} (+${f.pontos})` : f.nome)).join(' · ') : 'Nenhum indicador marcado ainda.'}
            </p>
          </div>
        </Grupo>

        <fieldset className="min-w-0 lg:col-span-2 xl:col-span-3" aria-invalid={erro('barreiras') || undefined}>
          <legend className={`mb-2 text-sm font-bold ${erro('barreiras') ? 'text-erro' : 'text-destaque'}`}>Barreiras identificadas</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            {[...BARREIRAS, { codigo: NENHUMA_BARREIRA, nome: 'Nenhum dos itens', violacao: false }].map((b) => {
              const marcado = d.barreiras.includes(b.codigo);
              const travado = nenhuma && b.codigo !== NENHUMA_BARREIRA;
              return (
                <label key={b.codigo} className="relative block">
                  <input type="checkbox" className="peer sr-only" checked={marcado} disabled={travado} onChange={() => alternarBarreira(b.codigo)} />
                  <span
                    className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm leading-tight peer-checked:border-destaque peer-checked:bg-destaque-suave peer-checked:font-bold peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque ${
                      erro('barreiras') ? 'border-erro' : 'border-borda-forte'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-4 shrink-0 items-center justify-center rounded border-2 text-[10px] ${marcado ? 'border-destaque bg-destaque text-superficie' : 'border-texto-suave'}`}
                    >
                      {marcado ? '✓' : ''}
                    </span>
                    {b.nome}
                  </span>
                </label>
              );
            })}
          </div>
          {violacao && (
            <div className="mt-3">
              <Aviso tipo="erro">
                Suspeita de violação de direitos: siga o fluxo de notificação da unidade e o encaminhamento ao CREAS, e registre as providências.
              </Aviso>
            </div>
          )}
        </fieldset>

        <fieldset className="min-w-0 lg:col-span-2 xl:col-span-3">
          <legend className="mb-2 text-sm font-bold text-destaque">
            Registro técnico <span className="font-normal text-texto-suave">· opcional</span>
          </legend>
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
            <label className="block">
              <span className="sr-only">Observações</span>
              <input
                className={entrada}
                value={d.observacoes}
                placeholder="Observações, justificativas e encaminhamentos"
                onChange={(e) => muda('observacoes', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="sr-only">Profissional</span>
              <input className={entrada} value={d.profissional} placeholder="Profissional" onChange={(e) => muda('profissional', e.target.value)} />
            </label>
            <label className="block">
              <span className="sr-only">Registro profissional</span>
              <input
                className={entrada}
                value={d.registro_profissional}
                placeholder="Registro (CRESS, CRP…)"
                onChange={(e) => muda('registro_profissional', e.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-borda px-5 py-3">
        <div className="min-w-0 flex-1 text-sm" aria-live="polite">
          {estado.erro && !faltaLista.length && <span className="font-semibold text-erro">{estado.erro}</span>}
          {faltaLista.length > 0 && (
            <span className="font-semibold text-erro">
              {faltaLista.length === 1 ? `Falta responder: ${ROTULOS[faltaLista[0]]}.` : `Faltam ${faltaLista.length} respostas, marcadas em vermelho.`}
            </span>
          )}
        </div>
        <Link href="/avaliacao" className={estiloBotao('secundario')}>
          Cancelar
        </Link>
        <BotaoEnviar enviando="Salvando…" pendente={pendente}>
          {id ? 'Salvar correção' : 'Salvar avaliação'}
        </BotaoEnviar>
      </div>
    </form>
  );
}
