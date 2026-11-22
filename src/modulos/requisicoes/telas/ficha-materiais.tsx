'use client';

/** Ficha de materiais: itens, utensílios, retirada ou entrega e evento. */
import { useEffect, useState } from 'react';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeLixeira, IconeMais } from '@/ui/icones';
import type { DadosRequisicao } from '../aplicacao/requisicoes';
import type { DetalhesMateriais } from '../dominio/requisicao';
import type { PropsFicha } from './ficha';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'resma', 'dúzia', 'fardo', 'rolo', 'par', 'frasco', 'galão'];

const SEM_ITENS: NonNullable<PropsFicha['tipo']>['itens'] = [];
const vazioItem = () => ({ quantidade: '', unidade: 'un', descricao: '' });
const comparavel = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const paraNumero = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));

export function FichaMateriais({ inicial, tipo, aoMudar }: PropsFicha) {
  const det = (inicial?.detalhes ?? {}) as DetalhesMateriais;
  const lista = tipo?.itens ?? SEM_ITENS;
  const [itens, setItens] = useState(
    inicial?.itens.map((x) => ({ quantidade: String(x.quantidade), unidade: x.unidade, descricao: x.descricao })) ?? [vazioItem(), vazioItem()],
  );
  const [modo, setModo] = useState<'retirada' | 'entrega' | ''>(det.entrega?.modo ?? 'retirada');
  const [entrega, setEntrega] = useState({ horario: det.entrega?.horario ?? '', local: det.entrega?.local ?? '', responsavel: det.entrega?.responsavel ?? '' });
  const [temEvento, setTemEvento] = useState(Boolean(det.evento));
  const [evento, setEvento] = useState({
    nome: det.evento?.nome ?? '',
    data: det.evento?.data ?? '',
    horario: det.evento?.horario ?? '',
    local: det.evento?.local ?? '',
    publico: det.evento?.publico ?? '',
    participantes: det.evento?.participantes != null ? String(det.evento.participantes) : '',
  });
  const [utensilios, setUtensilios] = useState(det.utensilios ?? '');
  const daLista = (descricao: string) => lista.find((c) => comparavel(c.descricao) === comparavel(descricao));

  // Ao trocar para outro tipo de materiais, a unidade passa a vir da lista do novo tipo.
  const [tipoAnterior, setTipoAnterior] = useState(tipo?.id);
  if (tipo?.id !== tipoAnterior) {
    setTipoAnterior(tipo?.id);
    if (lista.length) {
      const porNome = new Map(lista.map((c) => [comparavel(c.descricao), c]));
      setItens(itens.map((x) => ({ ...x, unidade: porNome.get(comparavel(x.descricao))?.unidade ?? (x.descricao ? x.unidade : '') })));
    }
  }

  useEffect(() => {
    const dados: Pick<DadosRequisicao, 'itens' | 'detalhes'> = {
      itens: itens
        .filter((x) => x.descricao.trim() || x.quantidade.trim())
        .map((x) => ({
          quantidade: paraNumero(x.quantidade),
          unidade: x.unidade,
          descricao: x.descricao,
          catalogoId: lista.find((c) => comparavel(c.descricao) === comparavel(x.descricao))?.id ?? null,
        })),
      detalhes: {
        entrega: modo ? { modo, ...entrega } : null,
        evento: temEvento ? { ...evento, participantes: evento.participantes ? Number(evento.participantes) : null } : null,
        utensilios,
      },
    };
    aoMudar(dados);
  }, [itens, modo, entrega, temEvento, evento, utensilios, lista, aoMudar]);

  return (
    <>
    <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Itens solicitados</h2>
      {lista.length > 0 && (
        <p className="text-sm text-texto-suave">
          Este tipo tem uma lista de itens: comece a digitar e escolha o item na lista. A unidade vem preenchida.
        </p>
      )}
      <datalist id="itens-do-tipo">
        {lista.map((c) => (
          <option key={c.id} value={c.descricao}>
            {c.unidade}
          </option>
        ))}
      </datalist>
      <datalist id="unidades">
        {UNIDADES.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="hidden grid-cols-[6rem_8rem_1fr_auto] gap-2 text-sm font-semibold text-texto-suave sm:grid">
        <span>Quantidade</span>
        <span>Unidade</span>
        <span>Item</span>
        <span className="w-10" />
      </div>
      <ul className="space-y-2">
        {itens.map((x, i) => {
          const mudar = (campo: keyof typeof x, v: string) =>
            setItens(
              itens.map((y, k) => {
                if (k !== i) return y;
                const novo = { ...y, [campo]: v };
                // Item da lista: a unidade vem dela.
                if (campo === 'descricao' && lista.length) novo.unidade = daLista(v)?.unidade ?? '';
                return novo;
              }),
            );
          const foraDaLista = lista.length > 0 && x.descricao.trim() !== '' && !daLista(x.descricao);
          return (
            <li key={i} className="grid grid-cols-[5rem_6rem_1fr_auto] gap-2 sm:grid-cols-[6rem_8rem_1fr_auto]">
              <input
                aria-label={`Quantidade do item ${i + 1}`}
                inputMode="decimal"
                value={x.quantidade}
                onChange={(e) => mudar('quantidade', e.target.value)}
                className={`${estiloEntrada} !mt-0 text-right`}
              />
              <input
                aria-label={`Unidade do item ${i + 1}`}
                list="unidades"
                value={x.unidade}
                readOnly={lista.length > 0}
                tabIndex={lista.length > 0 ? -1 : undefined}
                onChange={(e) => mudar('unidade', e.target.value)}
                className={`${estiloEntrada} !mt-0 ${lista.length > 0 ? 'bg-superficie-2' : ''}`}
              />
              <input
                aria-label={`Descrição do item ${i + 1}`}
                value={x.descricao}
                list={lista.length ? 'itens-do-tipo' : undefined}
                onChange={(e) => mudar('descricao', e.target.value)}
                placeholder={lista.length ? 'Digite e escolha da lista' : 'Ex.: Detergente neutro 500 ml'}
                aria-invalid={foraDaLista || undefined}
                title={foraDaLista ? 'Este item não está na lista deste tipo' : undefined}
                className={`${estiloEntrada} !mt-0 ${foraDaLista ? 'border-erro' : ''}`}
              />
              <Botao
                type="button"
                variante="icone"
                aria-label={`Tirar o item ${i + 1}`}
                disabled={itens.length === 1}
                onClick={() => setItens(itens.filter((_, k) => k !== i))}
              >
                <IconeLixeira tamanho={16} />
              </Botao>
            </li>
          );
        })}
      </ul>
      <Botao type="button" variante="fantasma" onClick={() => setItens([...itens, vazioItem()])}>
        <IconeMais tamanho={16} /> Adicionar item
      </Botao>
      <Campo rotulo="Utensílios" dica="Panelas, travessas, copos… se o pedido for para cozinha ou evento.">
        <textarea value={utensilios} onChange={(e) => setUtensilios(e.target.value)} rows={2} className={estiloEntrada} />
      </Campo>
    </section>

    <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Retirada ou entrega</h2>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {(
          [
            ['retirada', 'Retirada no almoxarifado'],
            ['entrega', 'Entrega no local'],
          ] as const
        ).map(([v, r]) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="modo-entrega" checked={modo === v} onChange={() => setModo(v)} /> {r}
          </label>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Horário" dica={modo === 'retirada' ? 'Ex.: 08:10 ou 13:40' : undefined}>
          <input value={entrega.horario} onChange={(e) => setEntrega({ ...entrega, horario: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Local">
          <input value={entrega.local} onChange={(e) => setEntrega({ ...entrega, local: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo={modo === 'retirada' ? 'Quem vai retirar' : 'Quem vai receber'}>
          <input value={entrega.responsavel} onChange={(e) => setEntrega({ ...entrega, responsavel: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
    </section>

    <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={temEvento} onChange={(e) => setTemEvento(e.target.checked)} />É para um evento
      </label>
      {temEvento && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Evento" obrigatorio className="sm:col-span-2">
            <input value={evento.nome} onChange={(e) => setEvento({ ...evento, nome: e.target.value })} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Data do evento" obrigatorio>
            <input type="date" value={evento.data} onChange={(e) => setEvento({ ...evento, data: e.target.value })} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Horário">
            <input value={evento.horario} onChange={(e) => setEvento({ ...evento, horario: e.target.value })} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Local">
            <input value={evento.local} onChange={(e) => setEvento({ ...evento, local: e.target.value })} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Participantes">
            <input
              inputMode="numeric"
              value={evento.participantes}
              onChange={(e) => setEvento({ ...evento, participantes: e.target.value.replace(/\D/g, '') })}
              className={estiloEntrada}
            />
          </Campo>
          <Campo rotulo="Público-alvo" className="sm:col-span-3">
            <input value={evento.publico} onChange={(e) => setEvento({ ...evento, publico: e.target.value })} className={estiloEntrada} />
          </Campo>
        </div>
      )}
    </section>
    </>
  );
}
