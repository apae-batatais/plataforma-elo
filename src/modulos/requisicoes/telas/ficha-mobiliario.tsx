'use client';

/** Ficha de mobiliário. */
import { useEffect, useState } from 'react';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeLixeira, IconeMais } from '@/ui/icones';
import {
  SERVICOS_MOBILIARIO,
  type DetalhesMobiliario,
  type ServicoMobiliario,
} from '../dominio/requisicao';
import type { PropsFicha } from './ficha';
const paraNumero = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));

export function FichaMobiliario({ inicial, aoMudar }: PropsFicha) {
  const detMob = (inicial?.detalhes ?? {}) as Partial<DetalhesMobiliario>;
  const [mob, setMob] = useState({
    servico: detMob.servico ?? '',
    origem: detMob.origem ?? '',
    destino: detMob.destino ?? '',
    data: detMob.data ?? '',
    horario: detMob.horario ?? '',
    devolucao: detMob.devolucao ?? '',
    contato: detMob.contato ?? '',
  });
  const [moveis, setMoveis] = useState(
    detMob.moveis?.map((m) => ({ quantidade: String(m.quantidade), descricao: m.descricao, patrimonio: m.patrimonio ?? '' })) ?? [
      { quantidade: '1', descricao: '', patrimonio: '' },
    ],
  );

  useEffect(() => {
    aoMudar({
      itens: [],
      detalhes: {
        ...mob,
        servico: mob.servico || undefined,
        data: mob.data || undefined,
        devolucao: mob.servico === 'emprestimo' ? mob.devolucao || null : null,
        moveis: moveis
          .filter((m) => m.descricao.trim() || m.patrimonio.trim())
          .map((m) => ({ quantidade: paraNumero(m.quantidade), descricao: m.descricao, patrimonio: m.patrimonio })),
      },
    });
  }, [mob, moveis, aoMudar]);

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Mobiliário</h2>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">
          O que precisa ser feito <span className="text-erro">*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {Object.entries(SERVICOS_MOBILIARIO).map(([v, r]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${mob.servico === v ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}
            >
              <input
                type="radio"
                name="servico-mobiliario"
                checked={mob.servico === v}
                onChange={() => setMob({ ...mob, servico: v as ServicoMobiliario })}
              />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          Móveis <span className="text-erro">*</span>
        </p>
        <div className="hidden grid-cols-[6rem_1fr_10rem_auto] gap-2 text-sm text-texto-suave sm:grid">
          <span>Quantidade</span>
          <span>Móvel</span>
          <span>Nº de patrimônio</span>
          <span className="w-10" />
        </div>
        <ul className="space-y-2">
          {moveis.map((m, i) => {
            const mudar = (campo: keyof typeof m, v: string) => setMoveis(moveis.map((y, k) => (k === i ? { ...y, [campo]: v } : y)));
            return (
              <li key={i} className="grid grid-cols-[4.5rem_1fr_auto] gap-2 sm:grid-cols-[6rem_1fr_10rem_auto]">
                <input
                  aria-label={`Quantidade do móvel ${i + 1}`}
                  inputMode="numeric"
                  value={m.quantidade}
                  onChange={(e) => mudar('quantidade', e.target.value.replace(/\D/g, ''))}
                  className={`${estiloEntrada} !mt-0 text-right`}
                />
                <input
                  aria-label={`Móvel ${i + 1}`}
                  value={m.descricao}
                  onChange={(e) => mudar('descricao', e.target.value)}
                  placeholder="Ex.: mesa de escritório"
                  className={`${estiloEntrada} !mt-0`}
                />
                <input
                  aria-label={`Patrimônio do móvel ${i + 1}`}
                  value={m.patrimonio}
                  onChange={(e) => mudar('patrimonio', e.target.value)}
                  placeholder="Se houver"
                  className={`${estiloEntrada} !mt-0 col-span-2 sm:col-span-1`}
                />
                <Botao
                  type="button"
                  variante="icone"
                  aria-label={`Tirar o móvel ${i + 1}`}
                  disabled={moveis.length === 1}
                  onClick={() => setMoveis(moveis.filter((_, k) => k !== i))}
                >
                  <IconeLixeira tamanho={16} />
                </Botao>
              </li>
            );
          })}
        </ul>
        <Botao type="button" variante="fantasma" onClick={() => setMoveis([...moveis, { quantidade: '1', descricao: '', patrimonio: '' }])}>
          <IconeMais tamanho={16} /> Outro móvel
        </Botao>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="De onde" obrigatorio dica="Sala, setor ou unidade onde os móveis estão.">
          <input value={mob.origem} onChange={(e) => setMob({ ...mob, origem: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo
          rotulo="Para onde"
          obrigatorio={mob.servico === 'movimentacao' || mob.servico === 'emprestimo'}
          dica={mob.servico === 'recolhimento' ? 'Se já souber para onde levar.' : 'Sala, setor, unidade ou local do evento.'}
        >
          <input value={mob.destino} onChange={(e) => setMob({ ...mob, destino: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Campo rotulo="Para quando" obrigatorio>
          <input type="date" value={mob.data} onChange={(e) => setMob({ ...mob, data: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Horário">
          <input value={mob.horario} onChange={(e) => setMob({ ...mob, horario: e.target.value })} placeholder="Ex.: 14:00" className={estiloEntrada} />
        </Campo>
        {mob.servico === 'emprestimo' && (
          <Campo rotulo="Devolução" obrigatorio dica="Quando os móveis voltam.">
            <input type="date" value={mob.devolucao} onChange={(e) => setMob({ ...mob, devolucao: e.target.value })} className={estiloEntrada} />
          </Campo>
        )}
        <Campo rotulo="Contato" dica="Ramal ou telefone.">
          <input value={mob.contato} onChange={(e) => setMob({ ...mob, contato: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
    </section>
  );
}
