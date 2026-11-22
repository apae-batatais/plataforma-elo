'use client';

/** Ficha de manutenção. */
import { useEffect, useState } from 'react';
import { Campo, estiloEntrada } from '@/ui/campo';
import {
  SERVICOS_MANUTENCAO,
  URGENCIAS,
  type DetalhesManutencao,
  type ServicoManutencao,
  type Urgencia,
} from '../dominio/requisicao';
import type { PropsFicha } from './ficha';

export function FichaManutencao({ inicial, aoMudar }: PropsFicha) {
  const detMan = (inicial?.detalhes ?? {}) as Partial<DetalhesManutencao>;
  const [man, setMan] = useState({
    servico: detMan.servico ?? '',
    local: detMan.local ?? '',
    equipamento: detMan.equipamento ?? '',
    patrimonio: detMan.patrimonio ?? '',
    problema: detMan.problema ?? '',
    urgencia: detMan.urgencia ?? '',
    horario: detMan.horario ?? '',
    contato: detMan.contato ?? '',
  });

  useEffect(() => {
    aoMudar({ itens: [], detalhes: { ...man, servico: man.servico || undefined, urgencia: man.urgencia || undefined } });
  }, [man, aoMudar]);

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Manutenção</h2>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">
          Tipo de serviço <span className="text-erro">*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {Object.entries(SERVICOS_MANUTENCAO).map(([v, r]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${man.servico === v ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}
            >
              <input
                type="radio"
                name="servico-manutencao"
                checked={man.servico === v}
                onChange={() => setMan({ ...man, servico: v as ServicoManutencao })}
              />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Onde é o serviço" obrigatorio dica="Unidade, sala ou setor. Ex.: Sede, banheiro do pátio." className="sm:col-span-2">
          <input value={man.local} onChange={(e) => setMan({ ...man, local: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Contato" dica="Ramal ou telefone.">
          <input value={man.contato} onChange={(e) => setMan({ ...man, contato: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Equipamento" dica="Se for um aparelho. Ex.: geladeira da cozinha." className="sm:col-span-2">
          <input value={man.equipamento} onChange={(e) => setMan({ ...man, equipamento: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Nº de patrimônio" dica="A etiqueta, se houver.">
          <input value={man.patrimonio} onChange={(e) => setMan({ ...man, patrimonio: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
      <Campo
        rotulo="Qual é o problema"
        obrigatorio
        dica="Descreva com detalhes: o que aconteceu, desde quando, se há risco. Fotos ainda não podem ser anexadas."
      >
        <textarea value={man.problema} onChange={(e) => setMan({ ...man, problema: e.target.value })} rows={4} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Melhor horário para o serviço" dica="Ex.: depois das 16h, quando a sala está vazia.">
        <input value={man.horario} onChange={(e) => setMan({ ...man, horario: e.target.value })} className={estiloEntrada} />
      </Campo>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">
          Urgência <span className="text-erro">*</span>
        </legend>
        <div className="mt-2 space-y-1.5">
          {Object.entries(URGENCIAS).map(([v, r]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="urgencia-manutencao" checked={man.urgencia === v} onChange={() => setMan({ ...man, urgencia: v as Urgencia })} />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
