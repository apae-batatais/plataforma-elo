'use client';

/**
 * Informar realizado: grade do mês montada pela Previsão (despesas e receitas), com o previsto ao lado,
 * "Copiar previsto", linhas extras e totais calculados enquanto a pessoa digita (conta feita no navegador,
 * só para acompanhar; o total oficial é o que o servidor calcula depois de salvar).
 * O que foi digitado e não salvo volta depois de um erro (guardado só neste navegador).
 */
import { useEffect, useMemo, useState } from 'react';
import { estiloBotao } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { tabela } from '@/ui/pagina';
import { diferencaPercentual, naturezasDo, naturezaSugerida, ROTULO_NATUREZA, type Natureza, type TipoRealizado } from '../dominio/realizado';
import { lerValorEmReais } from '../dominio/tesouraria';
import { percentual, reais } from './formato';

export interface LinhaGradeTela {
  chave: string;
  tipo: TipoRealizado;
  servico: string | null;
  servicoNome: string;
  grupoId: string | null;
  grupoNome: string;
  fonteId: string;
  fonteNome: string;
  natureza: Natureza;
  previsto: number;
  realizado: number | null;
  versao: number | null;
  naoRecorrente: boolean;
  motivo: string | null;
  observacao: string | null;
}

export interface OpcoesTela {
  servicos: { codigo: string; nome: string }[];
  grupos: { id: string; nome: string; rh: boolean }[];
  fontes: { id: string; nome: string }[];
}

type Acao = (f: FormData) => void | Promise<void>;
type Estado = { valor: string; nr: boolean; motivo: string; obs: string };
type Extra = { id: number; tipo: TipoRealizado; servico: string; grupoId: string; fonteId: string; natureza: Natureza } & Estado;

const MSG_VALOR = 'Use números, como 1.234,56.';
const ID_FORM = 'form-realizado';
const textoInicial = (v: number | null) => (v === null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }));
const inicial = (l: LinhaGradeTela): Estado => ({ valor: textoInicial(l.realizado), nr: l.naoRecorrente, motivo: l.motivo ?? '', obs: l.observacao ?? '' });
const numero = (t: string) => {
  const v = lerValorEmReais(t);
  return typeof v === 'number' ? v : 0;
};

export function InformarRealizado({
  mes, rotuloMes, linhas, opcoes, previsaoAprovada, podeEditar, salvouAgora, salvar,
}: {
  mes: string;
  rotuloMes: string;
  linhas: LinhaGradeTela[];
  opcoes: OpcoesTela;
  previsaoAprovada: boolean;
  podeEditar: boolean;
  salvouAgora: boolean;
  salvar: Acao;
}) {
  const [estados, setEstados] = useState<Record<string, Estado>>(() => Object.fromEntries(linhas.map((l) => [l.chave, inicial(l)])));
  const [extras, setExtras] = useState<Extra[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [recuperado, setRecuperado] = useState(false);
  const [descartadas, setDescartadas] = useState(0);
  const chaveRascunho = `elo:orcamento:realizado:${mes}`;
  const versaoDe = useMemo(() => new Map(linhas.map((l) => [l.chave, l.versao])), [linhas]);

  // Rascunho: volta o que não foi salvo; linha cujo valor gravado mudou desde a digitação é descartada.
  useEffect(() => {
    try {
      if (salvouAgora || !podeEditar) {
        sessionStorage.removeItem(chaveRascunho);
        return;
      }
      const bruto = sessionStorage.getItem(chaveRascunho);
      if (!bruto) return;
      const r = JSON.parse(bruto) as { estados?: Record<string, { e: Estado; base: number | null }>; extras?: Extra[] };
      const mantidos: Record<string, Estado> = {};
      let fora = 0;
      for (const [chave, v] of Object.entries(r.estados ?? {})) {
        if (!versaoDe.has(chave)) continue;
        if ((v.base ?? null) === (versaoDe.get(chave) ?? null)) mantidos[chave] = v.e;
        else fora++;
      }
      const ex = Array.isArray(r.extras) ? r.extras.filter((x) => x && typeof x.valor === 'string') : [];
      if (Object.keys(mantidos).length || ex.length) {
        setEstados((a) => ({ ...a, ...mantidos }));
        setExtras(ex);
        setRecuperado(true);
      }
      setDescartadas(fora);
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
    // roda só ao abrir a tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!podeEditar) return;
    try {
      const editados: Record<string, { e: Estado; base: number | null }> = {};
      for (const l of linhas) {
        const e = estados[l.chave];
        const i = inicial(l);
        if (e && (e.valor !== i.valor || e.nr !== i.nr || e.motivo !== i.motivo || e.obs !== i.obs)) editados[l.chave] = { e, base: l.versao };
      }
      if (Object.keys(editados).length || extras.length) sessionStorage.setItem(chaveRascunho, JSON.stringify({ estados: editados, extras }));
      else sessionStorage.removeItem(chaveRascunho);
    } catch {
      /* sem armazenamento */
    }
  }, [estados, extras, linhas, chaveRascunho, podeEditar]);

  const mudar = (chave: string, p: Partial<Estado>) => setEstados((a) => ({ ...a, [chave]: { ...a[chave], ...p } }));
  const mudarExtra = (id: number, p: Partial<Extra>) => setExtras((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const adicionar = (tipo: TipoRealizado) =>
    setExtras((a) => [...a, { id: Date.now() + a.length, tipo, servico: '', grupoId: '', fonteId: '', natureza: naturezaSugerida(tipo, false), valor: '', nr: false, motivo: '', obs: '' }]);
  const copiarPrevisto = (tipo: TipoRealizado) =>
    setEstados((a) => {
      const novo = { ...a };
      for (const l of linhas) if (l.tipo === tipo && l.previsto > 0 && !(novo[l.chave]?.valor ?? '').trim()) novo[l.chave] = { ...novo[l.chave], valor: textoInicial(l.previsto) };
      return novo;
    });

  const todos = [...linhas.map((l) => ({ tipo: l.tipo, valor: estados[l.chave]?.valor ?? '' })), ...extras.map((x) => ({ tipo: x.tipo, valor: x.valor }))];
  const algumInvalido = podeEditar && todos.some((t) => lerValorEmReais(t.valor) === 'invalido');
  const soma = (tipo: TipoRealizado) => todos.filter((t) => t.tipo === tipo).reduce((s, t) => s + Math.round(numero(t.valor) * 100), 0) / 100;
  const despesa = soma('despesa');
  const receita = soma('receita');
  const resultado = Math.round((receita - despesa) * 100) / 100;

  const cabecalho = (
    <tr>
      <th className={tabela.th}>Serviço</th>
      <th className={tabela.th}>Grupo</th>
      <th className={tabela.th}>Fonte</th>
      <th className={`${tabela.th} text-right`}>Previsto</th>
      <th className={tabela.th}>Realizado</th>
      <th className={tabela.th}>Observação</th>
    </tr>
  );

  let indice = -1;
  const campo = (i: number, nome: string) => `l${i}_${nome}`;

  const celulaValor = (i: number, id: string, rotulo: string, e: Estado, aoMudar: (p: Partial<Estado>) => void, previsto: number) => {
    const invalido = lerValorEmReais(e.valor) === 'invalido';
    const dif = e.valor.trim() && !invalido ? diferencaPercentual(numero(e.valor), previsto) : null;
    return (
      <>
        <td className={tabela.td}>
          <label htmlFor={`valor-${id}`} className="sr-only">
            Realizado de {rotulo}
          </label>
          <input
            id={`valor-${id}`}
            form={ID_FORM}
            name={campo(i, 'valor')}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Não informado"
            value={e.valor}
            onChange={(ev) => aoMudar({ valor: ev.target.value })}
            aria-invalid={invalido || undefined}
            className={`${estiloEntrada} !mt-0 min-w-32 text-right tabular-nums ${invalido ? '!border-erro' : ''}`}
          />
          {invalido && (
            <p role="alert" className="mt-1 text-sm text-erro">
              {MSG_VALOR}
            </p>
          )}
          {dif !== null && <p className="mt-1 text-xs text-texto-suave">{dif > 0 ? '+' : ''}{percentual(dif)} sobre o previsto</p>}
        </td>
        <td className={tabela.td}>
          <label htmlFor={`obs-${id}`} className="sr-only">
            Observação de {rotulo}
          </label>
          <input id={`obs-${id}`} form={ID_FORM} name={campo(i, 'obs')} autoComplete="off" value={e.obs} onChange={(ev) => aoMudar({ obs: ev.target.value })} className={`${estiloEntrada} !mt-0 min-w-40`} />
          <label className="mt-1 flex items-center gap-2 text-xs text-texto-suave">
            <input type="checkbox" form={ID_FORM} name={campo(i, 'nr')} checked={e.nr} onChange={(ev) => aoMudar({ nr: ev.target.checked })} />
            Não recorrente
          </label>
          {e.nr && (
            <input
              form={ID_FORM}
              name={campo(i, 'motivo')}
              aria-label={`Motivo de ${rotulo} ser não recorrente`}
              placeholder="Motivo (obrigatório)"
              autoComplete="off"
              value={e.motivo}
              onChange={(ev) => aoMudar({ motivo: ev.target.value })}
              className={`${estiloEntrada} mt-1`}
            />
          )}
        </td>
      </>
    );
  };

  const oculto = (i: number, p: Record<string, string | number | null>) =>
    Object.entries(p).map(([k, v]) => <input key={k} type="hidden" form={ID_FORM} name={campo(i, k)} value={v ?? ''} />);

  const secao = (tipo: TipoRealizado, titulo: string, vazio: string) => {
    const daSecao = linhas.filter((l) => l.tipo === tipo);
    const dasExtras = extras.filter((x) => x.tipo === tipo);
    const totalSecao = tipo === 'despesa' ? despesa : receita;
    return (
      <section aria-labelledby={`sec-${tipo}`}>
        <h2 id={`sec-${tipo}`} className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-lg font-bold">
          <span>{titulo}</span>
          <span className="text-base font-semibold text-texto-suave">
            Total em {rotuloMes}: <span className="tabular-nums text-texto">{reais(totalSecao)}</span>
          </span>
        </h2>
        {daSecao.length + dasExtras.length === 0 && <p className="mb-2 text-texto-suave">{vazio}</p>}
        {daSecao.length + dasExtras.length > 0 && (
          <div className={tabela.moldura}>
            <table className={`${tabela.tabela} min-w-[56rem]`}>
              <thead className={tabela.cabeca}>{cabecalho}</thead>
              <tbody>
                {daSecao.map((l) => {
                  indice += 1;
                  const i = indice;
                  const rotulo = `${l.servicoNome} ${l.grupoNome} ${l.fonteNome}`.trim();
                  return (
                    <tr key={l.chave} className={tabela.linha}>
                      <th scope="row" className={`${tabela.td} font-normal`}>
                        {tipo === 'despesa' ? l.servicoNome : 'Receita'}
                        <span className="mt-0.5 block text-xs text-texto-suave">{ROTULO_NATUREZA[l.natureza]}</span>
                      </th>
                      <td className={tabela.td}>{l.grupoNome}</td>
                      <td className={tabela.td}>{l.fonteNome}</td>
                      <td className={`${tabela.td} ${tabela.numero} text-texto-suave`}>{reais(l.previsto)}</td>
                      {podeEditar ? (
                        <>
                          {oculto(i, { tipo: l.tipo, servico: l.servico, grupo: l.grupoId, fonte: l.fonteId, natureza: l.natureza, versao: l.versao })}
                          {celulaValor(i, l.chave, rotulo, estados[l.chave] ?? inicial(l), (p) => mudar(l.chave, p), l.previsto)}
                        </>
                      ) : (
                        <>
                          <td className={`${tabela.td} ${tabela.numero}`}>{l.realizado === null ? 'Não informado' : reais(l.realizado)}</td>
                          <td className={tabela.td}>{l.observacao ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {dasExtras.map((x) => {
                  indice += 1;
                  const i = indice;
                  const grupoRh = opcoes.grupos.find((g) => g.id === x.grupoId)?.rh ?? false;
                  return (
                    <tr key={x.id} className={`${tabela.linha} bg-superficie-2/40`}>
                      <td className={tabela.td}>
                        {oculto(i, { tipo: x.tipo })}
                        {tipo === 'despesa' ? (
                          <select aria-label="Serviço da linha adicionada" form={ID_FORM} name={campo(i, 'servico')} value={x.servico} onChange={(e) => mudarExtra(x.id, { servico: e.target.value })} className={`${estiloEntrada} !mt-0`}>
                            <option value="">Escolha o serviço</option>
                            {opcoes.servicos.map((s) => (
                              <option key={s.codigo} value={s.codigo}>
                                {s.nome}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>Receita</span>
                        )}
                        <select
                          aria-label="Natureza da linha adicionada"
                          form={ID_FORM}
                          name={campo(i, 'natureza')}
                          value={x.natureza}
                          onChange={(e) => mudarExtra(x.id, { natureza: e.target.value as Natureza })}
                          className={`${estiloEntrada} mt-1`}
                        >
                          {naturezasDo(x.tipo).map((n) => (
                            <option key={n} value={n}>
                              {ROTULO_NATUREZA[n]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tabela.td}>
                        {tipo === 'despesa' ? (
                          <select
                            aria-label="Grupo da linha adicionada"
                            form={ID_FORM}
                            name={campo(i, 'grupo')}
                            value={x.grupoId}
                            onChange={(e) => {
                              const g = opcoes.grupos.find((y) => y.id === e.target.value);
                              mudarExtra(x.id, { grupoId: e.target.value, natureza: naturezaSugerida('despesa', g?.rh ?? false) });
                            }}
                            className={`${estiloEntrada} !mt-0`}
                          >
                            <option value="">Escolha o grupo</option>
                            {opcoes.grupos.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nome}
                              </option>
                            ))}
                          </select>
                        ) : (
                          '—'
                        )}
                        {grupoRh && <span className="sr-only">Grupo de recursos humanos</span>}
                      </td>
                      <td className={tabela.td}>
                        <select aria-label="Fonte da linha adicionada" form={ID_FORM} name={campo(i, 'fonte')} value={x.fonteId} onChange={(e) => mudarExtra(x.id, { fonteId: e.target.value })} className={`${estiloEntrada} !mt-0`}>
                          <option value="">Escolha a fonte</option>
                          {opcoes.fontes.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`${tabela.td} ${tabela.numero} text-texto-suave`}>
                        <button type="button" className={estiloBotao('fantasma')} onClick={() => setExtras((a) => a.filter((y) => y.id !== x.id))}>
                          Tirar linha
                        </button>
                      </td>
                      {celulaValor(i, `extra-${x.id}`, 'linha adicionada', x, (p) => mudarExtra(x.id, p), 0)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {podeEditar && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={estiloBotao('secundario')} onClick={() => adicionar(tipo)}>
              <IconeMais tamanho={14} /> Adicionar linha
            </button>
            {daSecao.some((l) => l.previsto > 0) && (
              <button type="button" className={estiloBotao('secundario')} onClick={() => copiarPrevisto(tipo)}>
                Copiar previsto
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <form
        id={ID_FORM}
        action={async (f) => {
          setEnviando(true);
          try {
            await salvar(f);
          } finally {
            setEnviando(false);
          }
        }}
        onSubmit={(e) => {
          if (algumInvalido) e.preventDefault();
        }}
      >
        <input type="hidden" name="mes" value={mes} />
        <input type="hidden" name="quantidade" value={linhas.length + extras.length} />
      </form>

      <section aria-labelledby="titulo-totais" className={tabela.moldura}>
        <table className={`${tabela.tabela} min-w-[24rem]`}>
          <caption id="titulo-totais" className="px-4 py-3 text-left text-base font-bold">
            Totais de {rotuloMes}
          </caption>
          <tbody>
            <tr className={tabela.linha}>
              <th scope="row" className={`${tabela.td} font-semibold`}>Despesa</th>
              <td className={`${tabela.td} ${tabela.numero}`}>{reais(despesa)}</td>
            </tr>
            <tr className={tabela.linha}>
              <th scope="row" className={`${tabela.td} font-semibold`}>Receita</th>
              <td className={`${tabela.td} ${tabela.numero}`}>{reais(receita)}</td>
            </tr>
            <tr className="bg-superficie-2 font-bold">
              <th scope="row" className={tabela.td}>Resultado do mês</th>
              <td className={`${tabela.td} ${tabela.numero}`}>{reais(resultado)}</td>
            </tr>
          </tbody>
        </table>
        {podeEditar && <p className="border-t border-borda px-4 py-2 text-sm text-texto-suave">Os totais mudam enquanto você digita. O total oficial é calculado pelo Elo quando você salva.</p>}
      </section>

      {!previsaoAprovada && (
        <p role="status" className="rounded-md border border-borda bg-superficie-2 px-4 py-2 text-sm">
          A Previsão deste ano ainda não está aprovada, então a grade não vem montada. {podeEditar ? 'Use “Adicionar linha” para informar o que foi gasto e recebido.' : ''}
        </p>
      )}
      {recuperado && (
        <p role="status" className="rounded-md border border-borda bg-superficie-2 px-4 py-2 text-sm">
          Recuperamos os valores que você digitou e ainda não salvou.
          {descartadas > 0 && ` ${descartadas} ${descartadas === 1 ? 'linha foi alterada' : 'linhas foram alteradas'} por outra pessoa e voltou ao valor gravado.`}
        </p>
      )}
      {podeEditar && <p className="text-sm text-texto-suave">Apagar o valor de uma linha já salva remove a linha (ela fica registrada, não é apagada).</p>}

      {secao('despesa', 'Despesas', 'Nenhuma despesa prevista para este mês.')}
      {secao('receita', 'Receitas', 'Nenhuma receita prevista para este mês.')}

      {podeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" form={ID_FORM} disabled={algumInvalido || enviando} aria-busy={enviando || undefined} className={estiloBotao('primario')}>
            {enviando ? 'Salvando…' : 'Salvar mês'}
          </button>
          {algumInvalido && <span className="text-sm text-erro">{MSG_VALOR} Corrija os campos marcados para salvar.</span>}
        </div>
      )}
    </div>
  );
}

