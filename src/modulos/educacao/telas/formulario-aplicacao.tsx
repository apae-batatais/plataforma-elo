'use client';

/**
 * Nova avaliação / rascunho de Educação: uma tela só, em três partes (quem, período e responsável, itens).
 * As respostas ficam no navegador até salvar: um erro não apaga nada. Total e subtotais são recalculados a cada nota.
 */
import { startTransition, useActionState, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Instrumento } from '@/capacidades/motor-avaliacao';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { LEGENDA_FREQUENCIA, LEGENDA_NOTAS, ITEM_FREQUENCIA, instrumentoSugerido, notaDeFrequencia, resultadoDe } from '../dominio/educacao';

export type EstadoFormulario = { erro?: string };

export interface OpcaoPessoa {
  id: string;
  nome: string;
  servicos: string[];
}
export interface OpcaoServico {
  codigo: string;
  nome: string;
  instrumentoSugerido: string | null;
}
export interface OpcaoInstrumento {
  codigo: string;
  nome: string;
  referenciais: string | null;
  instrumento: Instrumento;
}

export interface ValoresIniciais {
  /** Aplicação aberta que está sendo editada. */
  id?: string;
  versao?: number;
  pessoaId: string;
  servico: string;
  instrumento: string;
  periodoInicio: string;
  periodoFim: string;
  dataIngresso: string;
  profissional: string;
  funcao: string;
  justificativa: string;
  respostas: Record<number, number>;
}

const entrada = `${estiloEntrada} !mt-1`;
const rotuloCampo = 'block text-sm font-semibold';

export function FormularioAplicacao({
  pessoas,
  servicos,
  instrumentos,
  inicial,
  hoje,
  nomePessoaTravada,
  acao,
}: {
  pessoas: OpcaoPessoa[];
  servicos: OpcaoServico[];
  instrumentos: OpcaoInstrumento[];
  inicial: ValoresIniciais;
  hoje: string;
  /** Ao editar um rascunho, pessoa, serviço e instrumento não mudam. */
  nomePessoaTravada?: string;
  acao: (estado: EstadoFormulario, f: FormData) => Promise<EstadoFormulario>;
}) {
  const editando = Boolean(inicial.id);
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [v, setV] = useState(inicial);
  const [busca, setBusca] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const janela = useRef<HTMLDialogElement>(null);

  const instrumento = instrumentos.find((i) => i.codigo === v.instrumento) ?? null;
  const resultado = useMemo(() => (instrumento ? resultadoDe(instrumento.instrumento, v.respostas) : null), [instrumento, v.respostas]);
  const filtradas = pessoas.filter((p) => !busca.trim() || p.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')));
  const pessoa = pessoas.find((p) => p.id === v.pessoaId) ?? null;
  const servicosDaPessoa = pessoa ? servicos.filter((s) => pessoa.servicos.includes(s.codigo)) : [];
  const respondidos = Object.keys(v.respostas).length;
  const total = instrumento?.instrumento.itens.length ?? 10;

  const mudar = (parte: Partial<ValoresIniciais>) => setV((x) => ({ ...x, ...parte }));

  function escolherPessoa(id: string) {
    const p = pessoas.find((x) => x.id === id);
    const deleS = servicos.filter((s) => p?.servicos.includes(s.codigo));
    const servico = deleS.length === 1 ? deleS[0]! : null;
    mudar({
      pessoaId: id,
      servico: servico?.codigo ?? '',
      instrumento: servico?.instrumentoSugerido ?? v.instrumento,
    });
  }
  function escolherServico(codigo: string) {
    const s = servicos.find((x) => x.codigo === codigo);
    mudar({ servico: codigo, instrumento: s ? (instrumentoSugerido(s.nome) ?? v.instrumento) : v.instrumento });
  }
  function definirNota(numero: number, valor: number) {
    mudar({ respostas: { ...v.respostas, [numero]: valor } });
  }
  function mudarFrequencia(texto: string) {
    setFrequencia(texto);
    const n = notaDeFrequencia(Number(texto.replace(',', '.')));
    if (texto.trim() !== '' && n !== null) definirNota(ITEM_FREQUENCIA, n);
  }

  function enviarForm(concluir: boolean) {
    const f = new FormData();
    f.set('dados', JSON.stringify({ ...v }));
    if (v.id) f.set('id', v.id);
    if (v.versao) f.set('versao', String(v.versao));
    if (concluir) f.set('concluir', '1');
    startTransition(() => enviar(f));
  }
  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    enviarForm(false);
  }

  const dimensoes = instrumento?.instrumento.dominios ?? [];

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-6">
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {estado.erro} Nada do que você digitou foi perdido.
        </Aviso>
      )}

      <fieldset className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
        <legend className="px-1 text-sm font-bold text-destaque">1. Quem é avaliado</legend>
        {editando ? (
          <p>
            <b>{nomePessoaTravada}</b> · {servicos.find((s) => s.codigo === v.servico)?.nome ?? v.servico} · {instrumento?.nome}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={rotuloCampo} htmlFor="busca-pessoa">
                Pessoa atendida
              </label>
              <input
                id="busca-pessoa"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite parte do nome para filtrar"
                className={entrada}
                autoComplete="off"
              />
              <select
                aria-label="Escolha a pessoa"
                value={v.pessoaId}
                onChange={(e) => escolherPessoa(e.target.value)}
                className={entrada}
                size={Math.min(6, Math.max(2, filtradas.length + 1))}
              >
                <option value="">{filtradas.length === 0 ? 'Nenhuma pessoa encontrada' : 'Escolha a pessoa…'}</option>
                {filtradas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-texto-suave">Só aparecem pessoas do Cadastro Único que você pode ver e que estão num serviço seu.</p>
            </div>
            <div>
              <label className={rotuloCampo} htmlFor="servico">
                Serviço
              </label>
              <select id="servico" value={v.servico} onChange={(e) => escolherServico(e.target.value)} className={entrada} disabled={!pessoa}>
                <option value="">{pessoa ? 'Escolha o serviço…' : 'Escolha a pessoa primeiro'}</option>
                {servicosDaPessoa.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={rotuloCampo} htmlFor="instrumento">
                Instrumento
              </label>
              <select id="instrumento" value={v.instrumento} onChange={(e) => mudar({ instrumento: e.target.value, respostas: {} })} className={entrada}>
                <option value="">Escolha o instrumento…</option>
                {instrumentos.map((i) => (
                  <option key={i.codigo} value={i.codigo}>
                    {i.nome}
                  </option>
                ))}
              </select>
              {instrumento?.referenciais && <p className="mt-1 text-xs text-texto-suave">{instrumento.referenciais}</p>}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
        <legend className="px-1 text-sm font-bold text-destaque">2. Período e responsável</legend>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={rotuloCampo} htmlFor="inicio">
              Período avaliado: início
            </label>
            <input id="inicio" type="date" max={hoje} value={v.periodoInicio} onChange={(e) => mudar({ periodoInicio: e.target.value })} className={entrada} />
          </div>
          <div>
            <label className={rotuloCampo} htmlFor="fim">
              Período avaliado: fim
            </label>
            <input id="fim" type="date" max={hoje} value={v.periodoFim} onChange={(e) => mudar({ periodoFim: e.target.value })} className={entrada} />
          </div>
          <div>
            <label className={rotuloCampo} htmlFor="ingresso">
              Data de ingresso no serviço
            </label>
            <input id="ingresso" type="date" max={hoje} value={v.dataIngresso} onChange={(e) => mudar({ dataIngresso: e.target.value })} className={entrada} />
          </div>
          <div className="md:col-span-2">
            <label className={rotuloCampo} htmlFor="profissional">
              Profissional responsável
            </label>
            <input id="profissional" value={v.profissional} onChange={(e) => mudar({ profissional: e.target.value })} className={entrada} autoComplete="off" />
          </div>
          <div>
            <label className={rotuloCampo} htmlFor="funcao">
              Função ou categoria profissional
            </label>
            <input id="funcao" value={v.funcao} onChange={(e) => mudar({ funcao: e.target.value })} className={entrada} autoComplete="off" />
          </div>
        </div>
      </fieldset>

      {instrumento && resultado ? (
        <section aria-labelledby="titulo-itens" className="space-y-4">
          <div className="sticky top-0 z-10 rounded-cartao border border-borda bg-superficie p-3 shadow-sm" aria-live="polite">
            <h2 id="titulo-itens" className="sr-only">
              3. Itens e totais
            </h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <p className="text-sm">
                <span className="text-texto-suave">Total </span>
                <b className="text-2xl tabular-nums text-destaque">{resultado.total}</b>
                <span className="text-texto-suave"> de {resultado.maximo || total * 3}</span>
              </p>
              {resultado.subtotais.map((s) => (
                <p key={s.codigo} className="text-sm">
                  <span className="text-texto-suave">{s.nome} </span>
                  <b className="tabular-nums">{s.pontos}</b>
                  <span className="text-texto-suave"> de {instrumento.instrumento.itens.filter((i) => i.dominio === s.codigo).length * 3}</span>
                </p>
              ))}
              <p className="ml-auto text-sm text-texto-suave">
                {respondidos} de {total} itens · {resultado.faixa ?? 'faixa aparece com os 10 itens'}
              </p>
            </div>
          </div>

          {dimensoes.map((d) => {
            const legenda = LEGENDA_NOTAS[d.codigo as keyof typeof LEGENDA_NOTAS];
            return (
              <fieldset key={d.codigo} className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
                <legend className="px-1 text-sm font-bold text-destaque">{d.nome}</legend>
                {legenda && <p className="text-xs text-texto-suave">Notas: {legenda.join(' · ')}</p>}
                {instrumento.instrumento.itens
                  .filter((i) => i.dominio === d.codigo)
                  .map((item) => {
                    const nota = v.respostas[item.numero];
                    const textos = item.numero === ITEM_FREQUENCIA ? LEGENDA_FREQUENCIA : legenda;
                    return (
                      <div key={item.numero} role="radiogroup" aria-labelledby={`item-${item.numero}`} className="space-y-2 border-t border-borda pt-3 first:border-0 first:pt-0">
                        <p id={`item-${item.numero}`} className="text-sm font-semibold">
                          {item.numero}. {item.texto}
                          {item.etiqueta && <span className="ml-2 rounded border border-borda px-1.5 py-0.5 text-xs font-normal text-texto-suave">CIF {item.etiqueta}</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {[0, 1, 2, 3].map((n) => (
                            <label
                              key={n}
                              className={`flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-md border px-4 text-base font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-destaque ${
                                nota === n ? 'border-destaque bg-destaque text-white' : 'border-borda-forte hover:border-texto-suave'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`item-${item.numero}`}
                                value={n}
                                checked={nota === n}
                                onChange={() => definirNota(item.numero, n)}
                                className="sr-only"
                              />
                              {n}
                            </label>
                          ))}
                          <span className="text-sm text-texto-suave">{nota === undefined ? 'Escolha de 0 a 3' : (textos?.[nota] ?? '')}</span>
                        </div>
                        {item.numero === ITEM_FREQUENCIA && (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <label htmlFor="frequencia" className="font-semibold">
                              Frequência no período (%)
                            </label>
                            <input
                              id="frequencia"
                              inputMode="decimal"
                              value={frequencia}
                              onChange={(e) => mudarFrequencia(e.target.value)}
                              className={`${estiloEntrada} !mt-0 !w-24`}
                              autoComplete="off"
                            />
                            <span className="text-texto-suave">Opcional: o Elo sugere a nota; você pode ajustar. O percentual não é guardado.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </fieldset>
            );
          })}

          <fieldset className="space-y-2 rounded-cartao border border-borda bg-superficie p-5">
            <legend className="px-1 text-sm font-bold text-destaque">Justificativa do enquadramento</legend>
            <label htmlFor="justificativa" className="text-sm text-texto-suave">
              Obrigatória para concluir: explique, em poucas linhas, por que o resultado é este.
            </label>
            <textarea
              id="justificativa"
              rows={4}
              value={v.justificativa}
              onChange={(e) => mudar({ justificativa: e.target.value })}
              className={`${estiloEntrada} !mt-1`}
            />
          </fieldset>
        </section>
      ) : (
        <Aviso tipo="info">Escolha a pessoa, o serviço e o instrumento para ver os itens.</Aviso>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <BotaoEnviar enviando="Salvando…" pendente={pendente} variante="secundario" disabled={!instrumento || !v.pessoaId || !v.servico}>
          Salvar rascunho
        </BotaoEnviar>
        <Botao type="button" disabled={!instrumento || !v.pessoaId || !v.servico || pendente} onClick={() => janela.current?.showModal()}>
          Concluir e assinar
        </Botao>
        <p className="text-sm text-texto-suave">O rascunho pode sair sem perder nada. Concluir fecha a avaliação.</p>
      </div>

      <dialog ref={janela} aria-labelledby="titulo-concluir" className="m-auto max-w-md rounded-cartao border border-borda bg-superficie p-6 text-texto backdrop:bg-black/40">
        <h2 id="titulo-concluir" className="text-lg font-bold">
          Concluir e assinar?
        </h2>
        <p className="mt-2 text-sm">
          Depois de concluída, a avaliação não pode mais ser editada. Se algo estiver errado, dá para corrigir criando uma nova avaliação; a anterior fica no histórico.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => janela.current?.close()}>
            Voltar e revisar
          </Botao>
          <Botao
            type="button"
            onClick={() => {
              janela.current?.close();
              enviarForm(true);
            }}
          >
            Concluir e assinar
          </Botao>
        </div>
      </dialog>
    </form>
  );
}
