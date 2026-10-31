'use client';

/**
 * Ficha da requisição de materiais (com base no modelo usado hoje):
 * tipo, área, grupo de despesa, centros de custo com percentual, itens,
 * retirada ou entrega, evento (se houver), utensílios e observações.
 * Os dados ficam no navegador até o envio: um erro não apaga nada.
 */
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeLixeira, IconeMais } from '@/ui/icones';
import type { DadosRequisicao } from '../aplicacao/requisicoes';
import type { DetalhesMateriais } from '../dominio/requisicao';

type Estado = { erro?: string };

export interface OpcoesFicha {
  tipos: {
    id: string;
    nome: string;
    formulario: string;
    descricao: string | null;
    /** Áreas e grupos permitidos (vazio = todos) e itens aceitos (vazio = texto livre). */
    areas: string[];
    grupos: string[];
    itens: { id: string; descricao: string; unidade: string }[];
  }[];
  areas: { codigo: string; nome: string }[];
  servicos: { codigo: string; nome: string; area: string | null; areaNome: string }[];
  grupos: { id: string; nome: string }[];
}

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'resma', 'dúzia', 'fardo', 'rolo', 'par', 'frasco', 'galão'];

const vazioItem = () => ({ quantidade: '', unidade: 'un', descricao: '' });
const comparavel = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const vazioCentro = () => ({ servico: '', percentual: '' });
const paraNumero = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));

export function FormularioRequisicao({
  opcoes,
  acao,
  inicial,
  oculto,
  rotuloEnviar = 'Enviar requisição',
  comComentario,
}: {
  opcoes: OpcoesFicha;
  acao: (estado: Estado, f: FormData) => Promise<Estado>;
  inicial?: DadosRequisicao;
  oculto?: Record<string, string | number>;
  rotuloEnviar?: string;
  comComentario?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const det = (inicial?.detalhes ?? {}) as DetalhesMateriais;
  const [tipoId, setTipoId] = useState(inicial?.tipoId ?? (opcoes.tipos.length === 1 ? opcoes.tipos[0].id : ''));
  const [area, setArea] = useState(inicial?.area ?? '');
  const [grupoId, setGrupoId] = useState(inicial?.grupoId ?? '');
  const [centros, setCentros] = useState(
    inicial?.centros.map((c) => ({ servico: c.servico, percentual: String(c.percentual) })) ?? [{ servico: '', percentual: '100' }],
  );
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
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '');

  const tipo = opcoes.tipos.find((t) => t.id === tipoId);
  const areasDoTipo = tipo?.areas.length ? opcoes.areas.filter((a) => tipo.areas.includes(a.codigo)) : opcoes.areas;
  const gruposDoTipo = tipo?.grupos.length ? opcoes.grupos.filter((g) => tipo.grupos.includes(g.id)) : opcoes.grupos;
  const lista = tipo?.itens ?? [];
  const daLista = (descricao: string) => lista.find((c) => comparavel(c.descricao) === comparavel(descricao));
  const mudarTipo = (id: string) => {
    setTipoId(id);
    const t = opcoes.tipos.find((x) => x.id === id);
    if (!t) return;
    // Área e grupo que o tipo não aceita saem; se só há uma opção, ela já vem marcada.
    const areasOk = t.areas.length ? opcoes.areas.filter((a) => t.areas.includes(a.codigo)) : opcoes.areas;
    const gruposOk = t.grupos.length ? opcoes.grupos.filter((g) => t.grupos.includes(g.id)) : opcoes.grupos;
    if (!areasOk.some((a) => a.codigo === area)) setArea(areasOk.length === 1 ? areasOk[0].codigo : '');
    if (!gruposOk.some((g) => g.id === grupoId)) setGrupoId(gruposOk.length === 1 ? gruposOk[0].id : '');
    if (t.itens.length) {
      const porNome = new Map(t.itens.map((c) => [comparavel(c.descricao), c]));
      setItens(itens.map((x) => ({ ...x, unidade: porNome.get(comparavel(x.descricao))?.unidade ?? (x.descricao ? x.unidade : '') })));
    }
  };
  const soma = centros.reduce((s, c) => s + Math.round((paraNumero(c.percentual) || 0) * 100), 0) / 100;
  const areasDosServicos = [...new Set(opcoes.servicos.map((s) => s.areaNome))];

  const mudarCentro = (i: number, campo: 'servico' | 'percentual', valor: string) => {
    const novos = centros.map((c, k) => (k === i ? { ...c, [campo]: valor } : c));
    setCentros(novos);
    // Primeiro serviço escolhido sugere a área, se ela ainda estiver em branco.
    if (campo === 'servico' && !area) {
      const s = opcoes.servicos.find((x) => x.codigo === valor);
      if (s?.area && areasDoTipo.some((a) => a.codigo === s.area)) setArea(s.area);
    }
  };
  const dividirIgual = () => {
    const n = centros.length;
    const parte = Math.floor(10000 / n) / 100;
    setCentros(centros.map((c, i) => ({ ...c, percentual: String(i === n - 1 ? Math.round((100 - parte * (n - 1)) * 100) / 100 : parte) })));
  };

  const dados: DadosRequisicao = {
    tipoId,
    area,
    grupoId,
    centros: centros.map((c) => ({ servico: c.servico, percentual: paraNumero(c.percentual) })),
    itens: itens
      .filter((x) => x.descricao.trim() || x.quantidade.trim())
      .map((x) => ({ quantidade: paraNumero(x.quantidade), unidade: x.unidade, descricao: x.descricao, catalogoId: daLista(x.descricao)?.id ?? null })),
    detalhes: {
      entrega: modo ? { modo, ...entrega } : null,
      evento: temEvento ? { ...evento, participantes: evento.participantes ? Number(evento.participantes) : null } : null,
      utensilios,
    },
    observacao,
  };

  return (
    <form action={enviar} className="space-y-6">
      {oculto && Object.entries(oculto).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="dados" value={JSON.stringify(dados)} />

      <section className="space-y-4 rounded-xl border border-borda bg-superficie p-5">
        <h2 className="text-lg font-bold">Pedido</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Tipo de requisição" obrigatorio dica={tipo?.descricao ?? undefined}>
            <select value={tipoId} onChange={(e) => mudarTipo(e.target.value)} disabled={Boolean(inicial)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {opcoes.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Área" obrigatorio>
            <select value={area} onChange={(e) => setArea(e.target.value)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {areasDoTipo.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Grupo de despesa" obrigatorio dica="Como está no orçamento.">
            <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {gruposDoTipo.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {opcoes.grupos.length === 0 && <Aviso tipo="atencao">Nenhum grupo de despesa cadastrado no Orçamento. Peça ao Financeiro para cadastrar.</Aviso>}
      </section>

      <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Centros de custo</h2>
          <span className={`text-sm font-semibold tabular-nums ${soma === 100 ? 'text-sucesso' : 'text-aviso'}`}>Soma: {soma.toLocaleString('pt-BR')}%</span>
        </div>
        <p className="text-sm text-texto-suave">Um ou mais serviços da mesma coordenação, somando 100%.</p>
        <ul className="space-y-2">
          {centros.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <label className="block text-sm">
                <span className="sr-only">Serviço {i + 1}</span>
                <select value={c.servico} onChange={(e) => mudarCentro(i, 'servico', e.target.value)} className={`${estiloEntrada} !mt-0`}>
                  <option value="">Escolha o serviço…</option>
                  {areasDosServicos.map((a) => (
                    <optgroup key={a} label={a}>
                      {opcoes.servicos
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
              <label className="block text-sm">
                <span className="sr-only">Percentual do serviço {i + 1}</span>
                <span className="relative block">
                  <input
                    inputMode="decimal"
                    value={c.percentual}
                    onChange={(e) => mudarCentro(i, 'percentual', e.target.value)}
                    className={`${estiloEntrada} !mt-0 pr-7 text-right`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave">%</span>
                </span>
              </label>
              <Botao
                type="button"
                variante="icone"
                aria-label={`Tirar o centro ${i + 1}`}
                disabled={centros.length === 1}
                onClick={() => setCentros(centros.filter((_, k) => k !== i))}
              >
                <IconeLixeira tamanho={16} />
              </Botao>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Botao type="button" variante="fantasma" onClick={() => setCentros([...centros, vazioCentro()])}>
            <IconeMais tamanho={16} /> Outro centro de custo
          </Botao>
          {centros.length > 1 && (
            <Botao type="button" variante="fantasma" onClick={dividirIgual}>
              Dividir igualmente
            </Botao>
          )}
        </div>
      </section>

      {(!tipo || tipo.formulario === 'materiais') && (
        <>
          <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
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

          <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
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

          <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
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
      )}

      <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
        <Campo rotulo="Observações">
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={estiloEntrada} />
        </Campo>
        {comComentario && (
          <Campo rotulo="O que você ajustou" dica="Aparece no histórico para a coordenação.">
            <textarea name="comentario" rows={2} className={estiloEntrada} />
          </Campo>
        )}
      </section>

      {estado.erro && (
        <Aviso tipo="erro" titulo="A requisição não foi enviada">
          {estado.erro}
        </Aviso>
      )}
      <BotaoEnviar pendente={enviando} enviando="Enviando…">
        {rotuloEnviar}
      </BotaoEnviar>
    </form>
  );
}
