'use client';

/**
 * Ficha de reserva de espaço: data, horário, espaço (só os livres na data), pessoas,
 * finalidade e se é cessão para fora da instituição. Os centros de custo ficam no casco.
 */
import { useEffect, useMemo, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { DetalhesEspaco } from '../dominio/espaco';
import type { PropsFicha } from './ficha';

export function FichaEspaco({ inicial, espacos = [], aoMudar }: PropsFicha) {
  const det = (inicial?.detalhes ?? {}) as Partial<DetalhesEspaco>;
  const [f, setF] = useState({
    data: det.data ?? '',
    inicio: det.inicio ?? '',
    fim: det.fim ?? '',
    espacoId: det.espacoId ?? '',
    pessoas: det.pessoas ? String(det.pessoas) : '',
    finalidade: det.finalidade ?? '',
    usoExterno: det.usoExterno ?? false,
    organizacaoExterna: det.organizacaoExterna ?? '',
  });

  // Só os espaços sem período de indisponibilidade na data escolhida.
  const livres = useMemo(
    () => espacos.filter((e) => !f.data || !e.indisponiveis.some((x) => x.inicio <= f.data && f.data <= x.fim)),
    [espacos, f.data],
  );
  const escolhido = livres.find((e) => e.id === f.espacoId);
  const pessoas = Number(f.pessoas);
  const acima = Boolean(escolhido && Number.isInteger(pessoas) && pessoas > escolhido.capacidade);

  useEffect(() => {
    aoMudar({
      itens: [],
      semCentros: f.usoExterno,
      detalhes: {
        espacoId: escolhido ? escolhido.id : '',
        data: f.data,
        inicio: f.inicio,
        fim: f.fim,
        finalidade: f.finalidade,
        pessoas: f.pessoas.trim() === '' ? undefined : pessoas,
        usoExterno: f.usoExterno,
        organizacaoExterna: f.usoExterno ? f.organizacaoExterna : null,
      },
    });
  }, [f, escolhido, pessoas, aoMudar]);

  const semEspaco = Boolean(f.data) && livres.length === 0;

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Reserva</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Data" obrigatorio dica="Dia da reserva (uma data só).">
          <input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Hora de início" obrigatorio dica="Ex.: 14:00">
          <input type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Hora de fim" obrigatorio dica="Ex.: 16:00">
          <input type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Espaço" obrigatorio dica="Só aparecem os espaços livres na data escolhida." className="sm:col-span-2">
          <select value={escolhido ? f.espacoId : ''} onChange={(e) => setF({ ...f, espacoId: e.target.value })} className={estiloEntrada}>
            <option value="">Escolha…</option>
            {livres.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
                {e.local ? ` · ${e.local}` : ''} (até {e.capacidade} pessoas)
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Pessoas esperadas" obrigatorio>
          <input inputMode="numeric" value={f.pessoas} onChange={(e) => setF({ ...f, pessoas: e.target.value.replace(/\D/g, '') })} className={estiloEntrada} />
        </Campo>
      </div>
      {semEspaco && <Aviso tipo="atencao">Nenhum espaço está disponível nesta data. Escolha outra data.</Aviso>}
      {acima && escolhido && (
        <Aviso tipo="atencao">
          Você informou {pessoas} pessoas e o espaço comporta {escolhido.capacidade}. Dá para enviar, mas quem decide vai ver este aviso.
        </Aviso>
      )}
      <Campo rotulo="Finalidade ou evento" obrigatorio dica="Para que o espaço será usado (mínimo de 5 letras).">
        <input value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })} className={estiloEntrada} />
      </Campo>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">É uma cessão para fora da instituição?</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="uso-externo" checked={!f.usoExterno} onChange={() => setF({ ...f, usoExterno: false })} /> Não, é uso interno
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="uso-externo" checked={f.usoExterno} onChange={() => setF({ ...f, usoExterno: true })} /> Sim, para parceiro, organização ou pessoa de fora
          </label>
        </div>
      </fieldset>
      {f.usoExterno && (
        <Campo rotulo="Organização ou pessoa" obrigatorio dica="Quem vai usar o espaço. Não há centro de custo neste caso.">
          <input value={f.organizacaoExterna} onChange={(e) => setF({ ...f, organizacaoExterna: e.target.value })} className={estiloEntrada} />
        </Campo>
      )}
    </section>
  );
}
