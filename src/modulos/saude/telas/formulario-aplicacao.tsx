'use client';

/**
 * Formulário da avaliação do CER: pessoa e serviço, período, os 10 itens por dimensão (botões de 0 a 3,
 * CIF ao lado) e as assinaturas. Total e subtotais mudam ao vivo, fixos no alto.
 * Tudo fica no navegador até gravar: um erro não apaga nada.
 */
import Link from 'next/link';
import { startTransition, useActionState, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { calcularEscore, dominiosDeMenorPercentual, itensSemResposta, type Instrumento } from '@/capacidades/motor-avaliacao';
import { Aviso } from '@/ui/aviso';
import { Botao, estiloBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { ENCAMINHAMENTO_POR_FAIXA, ITEM_FREQUENCIA, LEGENDA_NIVEIS, notaDaFrequencia } from '../dominio/cer';

export type EstadoFormulario = { erro?: string };

export interface PessoaOpcao {
  id: string;
  nome: string;
  servicos: { codigo: string; nome: string; entrada: string | null }[];
}

export interface ValoresIniciais {
  pessoaId: string;
  servico: string;
  periodoInicio: string;
  periodoFim: string;
  dataIngresso: string;
  profissional: string;
  funcao: string;
  justificativa: string;
  respostas: Record<number, number | undefined>;
}

const entrada = `${estiloEntrada} !mt-1 !min-h-11`;

export function FormularioAplicacao({
  pessoas,
  instrumento,
  inicial,
  acao,
  id,
  versao,
  corrige,
  pessoaFixa,
}: {
  pessoas: PessoaOpcao[];
  instrumento: Instrumento;
  inicial: ValoresIniciais;
  acao: (estado: EstadoFormulario, f: FormData) => Promise<EstadoFormulario>;
  id?: string;
  versao?: number;
  /** Id da avaliação fechada que esta corrige. */
  corrige?: string;
  /** Pessoa que não pode ser trocada (editar rascunho ou corrigir). */
  pessoaFixa?: boolean;
}) {
  const [d, setD] = useState<ValoresIniciais>(inicial);
  const [frequencia, setFrequencia] = useState('');
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [tentou, setTentou] = useState(false);
  const janela = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const muda = <K extends keyof ValoresIniciais>(k: K, v: ValoresIniciais[K]) => setD((x) => ({ ...x, [k]: v }));

  const pessoa = pessoas.find((x) => x.id === d.pessoaId);
  const escore = useMemo(() => calcularEscore(instrumento, d.respostas as Record<number, number>), [instrumento, d.respostas]);
  const semResposta = itensSemResposta(instrumento, d.respostas as Record<number, number>);
  const principal = escore.completo ? dominiosDeMenorPercentual(escore) : [];
  const faltaParaConcluir = [
    !d.pessoaId && 'a pessoa',
    !d.servico && 'o serviço',
    semResposta.length > 0 && `${semResposta.length === 1 ? 'o item' : 'os itens'} ${semResposta.join(', ')}`,
    !d.justificativa.trim() && 'a justificativa do enquadramento',
    !d.profissional.trim() && 'o profissional',
    !d.funcao.trim() && 'a função',
  ].filter(Boolean) as string[];

  function escolherPessoa(novoId: string) {
    const p = pessoas.find((x) => x.id === novoId);
    const unico = p?.servicos.length === 1 ? p.servicos[0]! : undefined;
    setD((x) => ({
      ...x,
      pessoaId: novoId,
      servico: unico?.codigo ?? '',
      dataIngresso: unico?.entrada && !x.dataIngresso ? unico.entrada : x.dataIngresso,
    }));
  }

  function escolherServico(codigo: string) {
    const s = pessoa?.servicos.find((x) => x.codigo === codigo);
    setD((x) => ({ ...x, servico: codigo, dataIngresso: x.dataIngresso || s?.entrada || '' }));
  }

  function gravar(modo: 'rascunho' | 'concluir') {
    const f = new FormData();
    f.set('dados', JSON.stringify(d));
    f.set('modo', modo);
    if (id) f.set('id', id);
    if (versao) f.set('versao', String(versao));
    if (corrige) f.set('corrige', corrige);
    startTransition(() => enviar(f));
  }

  function aoRascunho(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (!d.pessoaId || !d.servico) {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    gravar('rascunho');
  }

  function aoConcluir() {
    setTentou(true);
    if (faltaParaConcluir.length) return;
    janela.current?.showModal();
  }

  const mostrarFalta = tentou && faltaParaConcluir.length > 0;

  return (
    <form onSubmit={aoRascunho} noValidate className="space-y-5">
      {/* Totais ao vivo, fixos no alto. */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-cartao border border-borda bg-superficie px-4 py-2.5 shadow-sm"
        aria-live="polite"
      >
        <p className="text-sm">
          <span className="text-2xl font-bold tabular-nums">{escore.total}</span>
          <span className="text-texto-suave"> de {escore.maximo || instrumento.itens.length * 3} pontos</span>
        </p>
        {escore.dominios.map((x) => (
          <p key={x.codigo} className="text-sm">
            <span className="text-texto-suave">{x.nome}: </span>
            <b className="tabular-nums">
              {x.pontos}/{instrumento.itens.filter((i) => i.dominio === x.codigo).length * 3}
            </b>
          </p>
        ))}
        <p className="text-sm font-semibold">
          {escore.enquadramento ? escore.enquadramento.nome : <span className="font-normal text-texto-suave">{semResposta.length} itens sem resposta</span>}
        </p>
      </div>

      <section className="rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="sec-quem">
        <h2 id="sec-quem" className="mb-3 text-sm font-bold text-destaque">
          Quem e quando
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Campo rotulo="Pessoa" obrigatorio dica={pessoaFixa ? undefined : 'Só aparecem as pessoas que você pode ver.'}>
            <select
              className={entrada}
              value={d.pessoaId}
              disabled={pessoaFixa}
              aria-invalid={(tentou && !d.pessoaId) || undefined}
              onChange={(e) => escolherPessoa(e.target.value)}
            >
              <option value="">Escolha a pessoa</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Serviço" obrigatorio>
            <select
              className={entrada}
              value={d.servico}
              disabled={pessoaFixa || !pessoa}
              aria-invalid={(tentou && !d.servico) || undefined}
              onChange={(e) => escolherServico(e.target.value)}
            >
              <option value="">{pessoa ? 'Escolha o serviço' : 'Escolha a pessoa primeiro'}</option>
              {(pessoa?.servicos ?? []).map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de ingresso" obrigatorio>
            <input type="date" className={entrada} value={d.dataIngresso} onChange={(e) => muda('dataIngresso', e.target.value)} />
          </Campo>
          <Campo rotulo="Início do período avaliado" obrigatorio>
            <input type="date" className={entrada} value={d.periodoInicio} onChange={(e) => muda('periodoInicio', e.target.value)} />
          </Campo>
          <Campo rotulo="Fim do período avaliado" obrigatorio>
            <input type="date" className={entrada} value={d.periodoFim} onChange={(e) => muda('periodoFim', e.target.value)} />
          </Campo>
        </div>
      </section>

      <section className="rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="sec-notas">
        <h2 id="sec-notas" className="mb-1 text-sm font-bold text-destaque">
          Notas de 0 a 3
        </h2>
        <p className="mb-4 text-sm text-texto-suave">
          {LEGENDA_NIVEIS.map((n) => `${n.nota} = ${n.evolucao.toLowerCase()}`).join(' · ')}. Em Barreira, 0 = barreira severa e 3 = barreira ausente.
        </p>
        <div className="space-y-6">
          {instrumento.dominios.map((dom) => (
            <fieldset key={dom.codigo} className="min-w-0">
              <legend className="mb-2 text-sm font-bold">
                {dom.nome}{' '}
                <span className="font-normal text-texto-suave">
                  · {escore.dominios.find((x) => x.codigo === dom.codigo)?.pontos}/{instrumento.itens.filter((i) => i.dominio === dom.codigo).length * 3}
                </span>
              </legend>
              <ul className="divide-y divide-borda">
                {instrumento.itens
                  .filter((i) => i.dominio === dom.codigo)
                  .map((item) => {
                    const falta = tentou && d.respostas[item.numero] === undefined;
                    return (
                      <li key={item.numero} className="py-3">
                        <div role="radiogroup" aria-label={`Item ${item.numero}: ${item.texto}`} aria-invalid={falta || undefined}>
                          <p className={`text-[0.95rem] ${falta ? 'font-semibold text-erro' : ''}`}>
                            <b>{item.numero}.</b> {item.texto}
                            {item.etiqueta && <span className="ml-2 rounded border border-borda px-1.5 py-0.5 text-xs text-texto-suave">CIF {item.etiqueta}</span>}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {[0, 1, 2, 3].map((n) => (
                              <label key={n} className="relative">
                                <input
                                  type="radio"
                                  name={`item-${item.numero}`}
                                  value={n}
                                  checked={d.respostas[item.numero] === n}
                                  onChange={() => muda('respostas', { ...d.respostas, [item.numero]: n })}
                                  className="peer sr-only"
                                />
                                <span
                                  className={`flex size-11 cursor-pointer items-center justify-center rounded-md border text-base font-semibold peer-checked:border-destaque peer-checked:bg-destaque-suave peer-checked:font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque hover:border-texto-suave ${falta ? 'border-erro' : 'border-borda-forte'}`}
                                >
                                  {n}
                                </span>
                              </label>
                            ))}
                            {item.numero === ITEM_FREQUENCIA && (
                              <label className="ml-2 flex items-center gap-2 text-sm">
                                <span className="text-texto-suave">Frequência no período (%), opcional</span>
                                <input
                                  inputMode="numeric"
                                  className={`${estiloEntrada} !mt-0 !w-24`}
                                  value={frequencia}
                                  onChange={(e) => {
                                    setFrequencia(e.target.value);
                                    const nota = e.target.value.trim() === '' ? null : notaDaFrequencia(Number(e.target.value.replace(',', '.')));
                                    if (nota !== null) muda('respostas', { ...d.respostas, [item.numero]: nota });
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          {item.numero === ITEM_FREQUENCIA && (
                            <p className="mt-1 text-xs text-texto-suave">0 = menos de 40% · 1 = 40 a 59% · 2 = 60 a 79% · 3 = 80% ou mais. O percentual só sugere a nota e não é guardado.</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="sec-fecho">
        <h2 id="sec-fecho" className="mb-3 text-sm font-bold text-destaque">
          Enquadramento e assinatura
        </h2>
        {escore.enquadramento && (
          <p className="mb-3 text-sm">
            <b>{escore.enquadramento.nome}.</b> {ENCAMINHAMENTO_POR_FAIXA[escore.enquadramento.nome]}
            {principal.length > 0 && (
              <>
                {' '}
                Principal barreira: <b>{principal.map((x) => x.nome).join(' e ')}</b>.
              </>
            )}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Campo rotulo="Justificativa do enquadramento" obrigatorio className="md:col-span-2" dica="Obrigatória para concluir.">
            <textarea className={`${entrada} min-h-24`} value={d.justificativa} onChange={(e) => muda('justificativa', e.target.value)} />
          </Campo>
          <Campo rotulo="Profissional responsável" obrigatorio>
            <input className={entrada} value={d.profissional} onChange={(e) => muda('profissional', e.target.value)} autoComplete="off" />
          </Campo>
          <Campo rotulo="Função ou categoria profissional" obrigatorio>
            <input className={entrada} value={d.funcao} onChange={(e) => muda('funcao', e.target.value)} autoComplete="off" />
          </Campo>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-cartao border border-borda bg-superficie px-5 py-3">
        <div className="min-w-0 flex-1 text-sm" aria-live="polite">
          {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          {mostrarFalta && !estado.erro && <span className="font-semibold text-erro">Para concluir, falta: {faltaParaConcluir.join('; ')}.</span>}
        </div>
        <Link href="/saude" className={estiloBotao('secundario')}>
          Cancelar
        </Link>
        <BotaoEnviar variante="secundario" enviando="Salvando…" pendente={pendente}>
          Salvar rascunho
        </BotaoEnviar>
        <Botao onClick={aoConcluir} disabled={pendente}>
          Concluir e assinar
        </Botao>
      </div>

      <dialog
        ref={janela}
        aria-labelledby={idTitulo}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-cartao border border-borda bg-superficie p-0 text-left text-texto shadow-2xl backdrop:bg-black/40"
      >
        <div className="space-y-4 p-6">
          <h2 id={idTitulo} className="text-lg font-bold">
            Concluir e assinar esta avaliação?
          </h2>
          <p className="text-texto-suave">
            Depois de concluída, a avaliação não pode mais ser editada. Se algo estiver errado, dá para corrigir criando uma nova avaliação; a anterior fica guardada no histórico.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="secundario" onClick={() => janela.current?.close()}>
              Voltar e revisar
            </Botao>
            <Botao
              onClick={() => {
                janela.current?.close();
                gravar('concluir');
              }}
            >
              Concluir e assinar
            </Botao>
          </div>
        </div>
      </dialog>
    </form>
  );
}
