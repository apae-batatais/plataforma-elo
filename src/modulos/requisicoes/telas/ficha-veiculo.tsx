'use client';

/**
 * Ficha de pedido de veículo: veículo, saída e volta, destino, finalidade e condutor.
 * Os centros de custo ficam no casco (só para estatística de uso, sem rateio de despesa).
 * Conflito de horário só avisa; veículo em manutenção no período some da lista.
 */
import { useEffect, useMemo, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Campo, estiloEntrada } from '@/ui/campo';
import { emManutencaoNoPeriodo, periodosSeCruzam, type DetalhesVeiculo } from '../dominio/veiculo';
import type { PropsFicha } from './ficha';

export function FichaVeiculo({ inicial, veiculos = [], nomeDoUsuario = '', aoMudar }: PropsFicha) {
  const det = (inicial?.detalhes ?? {}) as Partial<DetalhesVeiculo>;
  const [f, setF] = useState({
    veiculoId: det.veiculoId ?? '',
    saida: det.saida ?? '',
    volta: det.volta ?? '',
    destino: det.destino ?? '',
    finalidade: det.finalidade ?? '',
    condutor: det.condutor ?? nomeDoUsuario,
  });

  const periodoCompleto = Boolean(f.saida && f.volta && f.volta > f.saida);
  // Em manutenção para o período: do dia da data prevista em diante (regra 8).
  const disponiveis = useMemo(
    () => veiculos.filter((v) => !f.volta || !emManutencaoNoPeriodo(v.manutencaoPrevista, f.volta.slice(0, 10))),
    [veiculos, f.volta],
  );
  const escondidos = veiculos.length - disponiveis.length;
  const escolhido = disponiveis.find((v) => v.id === f.veiculoId);
  const conflito = Boolean(
    escolhido && periodoCompleto && escolhido.ocupado.some((o) => periodosSeCruzam({ saida: f.saida, volta: f.volta }, o)),
  );

  useEffect(() => {
    aoMudar({
      itens: [],
      detalhes: { veiculoId: escolhido ? escolhido.id : '', saida: f.saida, volta: f.volta, destino: f.destino, finalidade: f.finalidade, condutor: f.condutor },
    });
  }, [f, escolhido, aoMudar]);

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Veículo</h2>
      {veiculos.length === 0 ? (
        <Aviso tipo="atencao">Nenhum veículo disponível. Peça à Administração para cadastrar.</Aviso>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Saída" obrigatorio dica="dia/mês/ano hora:minuto">
              <input type="datetime-local" value={f.saida} onChange={(e) => setF({ ...f, saida: e.target.value })} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Volta prevista" obrigatorio dica="dia/mês/ano hora:minuto. Pode ser em outro dia.">
              <input type="datetime-local" value={f.volta} onChange={(e) => setF({ ...f, volta: e.target.value })} className={estiloEntrada} />
            </Campo>
          </div>
          <Campo rotulo="Veículo" obrigatorio dica="Informe a saída e a volta antes: veículos em manutenção nessas datas não aparecem.">
            <select value={escolhido ? f.veiculoId : ''} onChange={(e) => setF({ ...f, veiculoId: e.target.value })} className={estiloEntrada}>
              <option value="">Escolha…</option>
              {disponiveis.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} · {v.placa} (até {v.capacidade} passageiros)
                </option>
              ))}
            </select>
          </Campo>
          {escondidos > 0 && <p className="text-sm text-texto-suave">Alguns veículos não aparecem porque estão em manutenção nessas datas.</p>}
          {conflito && (
            <Aviso tipo="atencao">Este veículo já tem pedido nesse horário. Dá para enviar: o Transporte decide.</Aviso>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Destino" obrigatorio>
              <input value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value })} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Condutor" obrigatorio dica="Quem vai dirigir. Já vem com o seu nome; troque se for outra pessoa.">
              <input value={f.condutor} onChange={(e) => setF({ ...f, condutor: e.target.value })} className={estiloEntrada} />
            </Campo>
          </div>
          <Campo rotulo="Finalidade" obrigatorio dica="Para que será usado (mínimo de 10 letras).">
            <textarea value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })} rows={3} className={estiloEntrada} />
          </Campo>
        </>
      )}
    </section>
  );
}
