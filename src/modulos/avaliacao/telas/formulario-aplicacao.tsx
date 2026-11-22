'use client';

/**
 * Aplicar um instrumento a uma pessoa do Cadastro Único: escolha da pessoa, um bloco por domínio com os
 * itens em botões de 0 a 3, rascunho e "Concluir e assinar". As respostas ficam no navegador até
 * gravar: um erro não apaga nada.
 */
import { useActionState, useMemo, useRef, useState } from 'react';
import { calcularEscore, itensSemResposta, NAO_SE_APLICA, type Instrumento, type Respostas } from '@/capacidades/motor-avaliacao';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { TIPOS_APLICACAO } from '../dados/tabelas';

export type EstadoAplicacao = { erro?: string };

export interface PessoaOpcao {
  id: string;
  nome: string;
  iniciais: string;
  servicos: { codigo: string; nome: string }[];
}

export interface ValoresAplicacao {
  pessoaId: string;
  servico: string;
  tipo: string;
  data: string;
  respostas: Respostas;
  profissional: string;
  registroProfissional: string;
  justificativa: string;
}

const VALORES = [0, 1, 2, 3] as const;

export function FormularioAplicacao({
  instrumento,
  pessoas,
  inicial,
  acao,
  id,
  versao,
  hoje,
}: {
  instrumento: Instrumento;
  /** Pessoas que podem ser escolhidas; ao continuar um rascunho, só a pessoa da aplicação. */
  pessoas: PessoaOpcao[];
  inicial: ValoresAplicacao;
  acao: (estado: EstadoAplicacao, f: FormData) => Promise<EstadoAplicacao>;
  id?: string;
  versao?: number;
  hoje: string;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const [valores, setValores] = useState<ValoresAplicacao>(inicial);
  const [busca, setBusca] = useState('');
  const janela = useRef<HTMLDialogElement>(null);
  const continuando = Boolean(id);
  const pessoa = pessoas.find((p) => p.id === valores.pessoaId);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    return pessoas.filter((p) => !q || p.nome.toLocaleLowerCase('pt-BR').includes(q));
  }, [pessoas, busca]);
  const escore = useMemo(() => calcularEscore(instrumento, valores.respostas), [instrumento, valores.respostas]);
  const faltam = itensSemResposta(instrumento, valores.respostas);
  const muda = <K extends keyof ValoresAplicacao>(k: K, v: ValoresAplicacao[K]) => setValores((x) => ({ ...x, [k]: v }));
  const escolher = (pessoaId: string) => {
    const p = pessoas.find((x) => x.id === pessoaId);
    setValores((x) => ({ ...x, pessoaId, servico: p?.servicos.some((s) => s.codigo === x.servico) ? x.servico : (p?.servicos[0]?.codigo ?? '') }));
  };
  const responder = (numero: number, v: number | typeof NAO_SE_APLICA) => setValores((x) => ({ ...x, respostas: { ...x.respostas, [numero]: v } }));

  return (
    <form action={enviar} onSubmit={() => janela.current?.close()} noValidate className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      {versao !== undefined && <input type="hidden" name="versao" value={versao} />}
      <input type="hidden" name="instrumento" value={instrumento.codigo} />
      <input type="hidden" name="dados" value={JSON.stringify(valores)} />

      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {estado.erro} O que você respondeu continua na tela.
        </Aviso>
      )}

      <section aria-labelledby="titulo-pessoa" className="rounded-cartao border border-borda bg-superficie p-5">
        <h2 id="titulo-pessoa" className="mb-3 text-sm font-bold text-destaque">
          Quem e quando
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {continuando ? (
            <Campo rotulo="Pessoa" obrigatorio dica="Iniciais da pessoa avaliada; o nome não é mostrado.">
              <input value={pessoa?.iniciais ?? '—'} disabled readOnly className={estiloEntrada} />
            </Campo>
          ) : (
            <>
              <Campo rotulo="Buscar pessoa pelo nome" dica="Só aparecem as pessoas dos serviços em que você avalia.">
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={estiloEntrada} autoComplete="off" />
              </Campo>
              <Campo rotulo="Pessoa" obrigatorio dica={pessoa ? `Iniciais que aparecem na avaliação: ${pessoa.iniciais}. O nome não é mostrado nas telas da avaliação.` : undefined}>
                <select value={valores.pessoaId} onChange={(e) => escolher(e.target.value)} className={estiloEntrada}>
                  <option value="">Escolha uma pessoa</option>
                  {filtradas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}
          <Campo rotulo="Serviço" obrigatorio>
            <select value={valores.servico} onChange={(e) => muda('servico', e.target.value)} className={estiloEntrada} disabled={continuando || !pessoa}>
              {!pessoa && <option value="">Escolha a pessoa primeiro</option>}
              {(pessoa?.servicos ?? []).map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tipo" obrigatorio>
            <select value={valores.tipo} onChange={(e) => muda('tipo', e.target.value)} className={estiloEntrada}>
              {TIPOS_APLICACAO.map((t) => (
                <option key={t} value={t}>
                  {t === 'Anual' ? 'Acompanhamento anual' : 'Inicial'}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data" obrigatorio>
            <input type="date" max={hoje} value={valores.data} onChange={(e) => muda('data', e.target.value)} className={estiloEntrada} />
          </Campo>
        </div>
        {!continuando && filtradas.length === 0 && <p className="mt-3 text-sm text-texto-suave">Nenhuma pessoa com esse nome nos seus serviços.</p>}
      </section>

      {instrumento.dominios.map((d) => (
        <fieldset key={d.codigo} className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
          <legend className="px-1 text-lg font-bold">{d.nome}</legend>
          {instrumento.itens
            .filter((i) => i.dominio === d.codigo)
            .map((item) => {
              const atual = valores.respostas[item.numero];
              return (
                <div key={item.numero} role="radiogroup" aria-label={`Item ${item.numero}: ${item.texto}`} className="space-y-2 border-t border-borda pt-3 first:border-t-0 first:pt-0">
                  <p className="font-semibold">
                    {item.numero}. {item.texto}
                    {item.etiqueta && <span className="ml-2 text-sm font-normal text-texto-suave">({item.etiqueta})</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...VALORES, ...(item.permiteNaoSeAplica ? [NAO_SE_APLICA] : [])].map((v) => (
                      <label key={v} className="relative">
                        <input type="radio" name={`item-${item.numero}`} checked={atual === v} onChange={() => responder(item.numero, v)} className="peer sr-only" />
                        <span className="flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-md border border-borda-forte px-3 text-center peer-checked:border-destaque peer-checked:bg-destaque-suave peer-checked:font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque hover:border-texto-suave">
                          {v === NAO_SE_APLICA ? 'Não se aplica' : v}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
        </fieldset>
      ))}

      <section aria-labelledby="titulo-fecho" className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
        <h2 id="titulo-fecho" className="text-lg font-bold">
          Resultado e assinatura
        </h2>
        <p aria-live="polite">
          Pontos até agora: <b>{escore.total}</b> de {escore.maximo} possíveis nos itens respondidos.{' '}
          {faltam.length > 0 ? `Faltam ${faltam.length} item(ns): ${faltam.join(', ')}.` : escore.enquadramento ? `Enquadramento: ${escore.enquadramento.nome}.` : ''}
        </p>
        <Campo rotulo="Justificativa do enquadramento" dica="Obrigatória para concluir." obrigatorio>
          <textarea rows={3} value={valores.justificativa} onChange={(e) => muda('justificativa', e.target.value)} className={estiloEntrada} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Profissional que aplicou">
            <input value={valores.profissional} onChange={(e) => muda('profissional', e.target.value)} className={estiloEntrada} autoComplete="off" />
          </Campo>
          <Campo rotulo="Registro profissional">
            <input value={valores.registroProfissional} onChange={(e) => muda('registroProfissional', e.target.value)} className={estiloEntrada} autoComplete="off" />
          </Campo>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <BotaoEnviar variante="secundario" name="intencao" value="rascunho" enviando="Salvando…">
            Salvar rascunho
          </BotaoEnviar>
          <Botao type="button" onClick={() => janela.current?.showModal()}>
            Concluir e assinar
          </Botao>
        </div>
      </section>

      <dialog
        ref={janela}
        aria-labelledby="titulo-concluir"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-cartao border border-borda bg-superficie p-6 text-texto shadow-2xl backdrop:bg-black/40"
      >
        <div className="space-y-4">
          <h2 id="titulo-concluir" className="text-lg font-bold">
            Concluir e assinar?
          </h2>
          <p className="text-texto-suave">
            Depois de concluída, a aplicação não pode mais ser editada. Se algo estiver errado, a correção cria uma nova aplicação e a anterior fica no histórico.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => janela.current?.close()}>
              Voltar e revisar
            </Botao>
            <BotaoEnviar name="intencao" value="concluir" enviando="Concluindo…">
              Concluir e assinar
            </BotaoEnviar>
          </div>
        </div>
      </dialog>
    </form>
  );
}
