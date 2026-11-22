'use client';

/**
 * Formulário de item da previsão (despesa ou receita): o valor é calculado
 * na hora e a distribuição nos meses mostra se fecha com o valor.
 * O servidor confere tudo de novo antes de gravar.
 */
import { useActionState, useRef, useState, useTransition } from 'react';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { PreviaLancamento } from '../aplicacao/lancamentos-rateio';
import type { OpcoesPlano } from '../aplicacao/plano-lancamento';
import { CamposPlano } from './campos-plano';
import type { LinhaDespesa, LinhaReceita, Previsao } from '../aplicacao/previsao';
import { CAPTACAO, CATEGORIA, COTACAO, mesesUsados, PRIORIDADE, type Distribuicao } from '../dominio/previsao';
import { MESES, reais } from './formato';

type Estado = { erro?: string };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

const num = (t: string) => {
  const s = t.replace(/\s/g, '');
  if (!s) return 0;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : 0;
};
const arred = (v: number) => Math.round(v * 100) / 100;
const textoNumero = (v: number | undefined) => (v === undefined ? '' : String(v));

export function FormularioItem({
  tipo,
  acao,
  ano,
  opcoes,
  item,
  cancelarHref,
  proposta = false,
  cotacao = false,
  rateio = false,
  previa,
  plano,
}: {
  tipo: 'despesa' | 'receita';
  acao: Acao;
  ano: number;
  opcoes: Previsao['opcoes'];
  item?: LinhaDespesa | LinhaReceita;
  cancelarHref: string;
  /** Proposta da coordenação: valores e distribuição são opcionais (o Financeiro completa). */
  proposta?: boolean;
  /** Cotação do Setor de Compras: só valores, situação da cotação, observação e meses. */
  cotacao?: boolean;
  /** Lançamento de despesa por rateio (#225): sem serviço (a regra decide) e com a Regra de rateio obrigatória. */
  rateio?: boolean;
  /** Mostra "como ficaria" antes de salvar (só no lançamento por rateio). */
  previa?: (f: FormData) => Promise<PreviaLancamento | { erro: string }>;
  /** Plano de contas (#221): mostra Item contábil e Área do plano. Só na despesa comum, nunca em proposta nem rateio. */
  plano?: OpcoesPlano;
}) {
  const [grupo, setGrupo] = useState(((item as LinhaDespesa | undefined)?.grupo_id) ?? '');
  const [estado, enviar] = useActionState(acao, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = useState<PreviaLancamento | { erro: string } | null>(null);
  const [calculando, calcular] = useTransition();
  const d = tipo === 'despesa' ? (item as LinhaDespesa | undefined) : undefined;
  const r = tipo === 'receita' ? (item as LinhaReceita | undefined) : undefined;

  const [qtd, setQtd] = useState(textoNumero(d?.quantidade ?? 1));
  const [ocor, setOcor] = useState(textoNumero(d?.ocorrencias ?? 1));
  const [unit, setUnit] = useState(textoNumero(d?.valor_unitario || undefined));
  const [valorReceita, setValorReceita] = useState(textoNumero(r?.valor));
  const valor = tipo === 'despesa' ? arred(num(qtd) * num(ocor) * num(unit)) : arred(num(valorReceita));

  const [modo, setModo] = useState<Distribuicao>(item?.distribuicao ?? 'igual');
  const [meses, setMeses] = useState<number[]>(item && item.distribuicao === 'meses' ? mesesUsados(item.meses) : []);
  const [manual, setManual] = useState<string[]>(item ? item.meses.map((v) => (v ? String(v) : '')) : Array(12).fill(''));
  const somaManual = arred(manual.reduce((s, v) => s + num(v), 0));
  const falta = arred(valor - somaManual);

  return (
    <form ref={formRef} action={enviar} className="space-y-4" onChange={() => setResultado(null)}>
      <input type="hidden" name="ano" value={ano} />
      {item && (
        <>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="versao" value={item.versao} />
        </>
      )}

      {cotacao && d && (
        <>
          <input type="hidden" name="modo" value="cotacao" />
          <div className="rounded-md bg-superficie-2 px-3 py-2 text-sm">
            <p className="font-semibold">{d.descricao}</p>
            <p className="text-texto-suave">
              {d.servicoNome} · {d.grupoNome}
            </p>
            {d.observacao && <p className="mt-1 italic text-texto-suave">“{d.observacao}”</p>}
          </div>
        </>
      )}

      {cotacao ? null : tipo === 'despesa' ? (
        <>
          {rateio ? (
            <Campo
              rotulo="Regra de rateio"
              obrigatorio
              dica="Decide quais serviços recebem e quanto. Cadastre ou ajuste em Cadastros › Regras de rateio."
            >
              <select name="regra_rateio_id" required defaultValue={d?.regra_rateio_id ?? ''} className={estiloEntrada}>
                <option value="" disabled>
                  Escolha a regra
                </option>
                {(opcoes.regras ?? []).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
          <Campo rotulo="Serviço (centro de custo)" obrigatorio>
            <select name="servico" required defaultValue={d?.servico ?? ''} className={estiloEntrada}>
              <option value="" disabled>
                Escolha o serviço
              </option>
              {[...new Set(opcoes.servicos.map((s) => s.areaNome))].map((area) => (
                <optgroup key={area} label={area}>
                  {opcoes.servicos
                    .filter((s) => s.areaNome === area)
                    .map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>
          )}
          <Campo rotulo="Grupo de contas" obrigatorio>
            <select name="grupo_id" required value={grupo} onChange={(e) => setGrupo(e.target.value)} className={estiloEntrada}>
              <option value="" disabled>
                Escolha o grupo
              </option>
              {opcoes.grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                  {g.rh ? ' (RH)' : ''}
                </option>
              ))}
            </select>
          </Campo>
          {plano && !proposta && !rateio && !cotacao && (
            <CamposPlano plano={plano} ano={ano} grupoId={grupo} itemInicial={d?.item_id ?? null} areaInicial={d?.area_plano_id ?? null} />
          )}
          {!proposta && !rateio && (opcoes.regras?.length ?? 0) > 0 && (
            <Campo rotulo="Regra de rateio do item" dica="Deixe em “Regra do grupo” para seguir o padrão do grupo (ou do serviço).">
              <select name="regra_rateio_id" defaultValue={d?.regra_rateio_id ?? ''} className={estiloEntrada}>
                <option value="">Regra do grupo</option>
                {opcoes.regras!.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Fonte de recurso" dica="Pode ficar “a definir” durante a elaboração.">
            <select name="fonte_id" defaultValue={d?.fonte_id ?? ''} className={estiloEntrada}>
              <option value="">A definir</option>
              {opcoes.fontes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </Campo>
        </>
      ) : (
        <Campo rotulo="Fonte de recurso" obrigatorio>
          <select name="fonte_id" required defaultValue={r?.fonte_id ?? ''} className={estiloEntrada}>
            <option value="" disabled>
              Escolha a fonte
            </option>
            {opcoes.fontes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {!cotacao && (
        <Campo rotulo="Descrição" obrigatorio>
          <input name="descricao" required defaultValue={item?.descricao} className={estiloEntrada} />
        </Campo>
      )}

      {tipo === 'despesa' ? (
        <div className="space-y-1">
          {proposta && <p className="text-sm font-semibold">Valores (opcional)</p>}
          {proposta && <p className="text-sm text-texto-suave">Se não souber, deixe em branco: o Setor de Compras cota e o Financeiro confere antes de aceitar.</p>}
          <div className="grid grid-cols-3 gap-2">
            <Campo rotulo="Quantidade" obrigatorio={!proposta}>
              <input name="quantidade" required={!proposta} inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Vezes" obrigatorio={!proposta}>
              <input name="ocorrencias" required={!proposta} inputMode="decimal" value={ocor} onChange={(e) => setOcor(e.target.value)} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Valor unit. (R$)" obrigatorio={!proposta}>
              <input name="valor_unitario" required={!proposta} inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} className={estiloEntrada} />
            </Campo>
          </div>
        </div>
      ) : (
        <Campo rotulo="Valor no ano (R$)" obrigatorio>
          <input name="valor" required inputMode="decimal" value={valorReceita} onChange={(e) => setValorReceita(e.target.value)} className={estiloEntrada} />
        </Campo>
      )}
      <p className="rounded-md bg-superficie-2 px-3 py-2 text-sm">
        Valor do item: <strong className="tabular-nums">{proposta && valor === 0 ? 'a definir (cotação)' : reais(valor)}</strong>
        {tipo === 'despesa' && <span className="block text-xs text-texto-suave">Quantidade × vezes × valor unitário (ex.: 60 alunos × 200 dias × R$ 7,50).</span>}
      </p>

      {cotacao && (
        <Campo rotulo="Situação da cotação" obrigatorio>
          <select name="cotacao" required defaultValue={d?.cotacao ?? 'ok'} className={estiloEntrada}>
            {(Object.keys(COTACAO) as (keyof typeof COTACAO)[]).map((k) => (
              <option key={k} value={k}>
                {COTACAO[k]}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {rateio && previa && (
        <div className="space-y-2 text-sm">
          <button
            type="button"
            disabled={calculando}
            className="rounded-md border border-borda px-3 py-1.5 font-semibold hover:bg-superficie-2 disabled:opacity-60"
            onClick={() => {
              const dados = new FormData(formRef.current!);
              calcular(async () => setResultado(await previa(dados)));
            }}
          >
            {calculando ? 'Calculando…' : 'Ver como ficaria'}
          </button>
          {resultado && 'erro' in resultado && <Aviso tipo="atencao">{resultado.erro}</Aviso>}
          {resultado && !('erro' in resultado) &&
            (resultado.linhas.length === 0 ? (
              <Aviso tipo="atencao">Nenhuma despesa seria gerada: ajuste a Regra de rateio. Você ainda pode salvar o lançamento.</Aviso>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <caption className="mb-1 text-left text-xs text-texto-suave">Como ficaria, com os números atuais dos serviços (valor no ano)</caption>
                  <thead>
                    <tr className="text-xs text-texto-suave">
                      <th className="py-1 pr-2 font-semibold">Serviço</th>
                      <th className="py-1 pr-2 text-right font-semibold">Valor</th>
                      <th className="py-1 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((l) => (
                      <tr key={l.codigo} className="border-t border-borda">
                        <td className="py-1 pr-2">{l.nome}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{reais(l.valor)}</td>
                        <td className="py-1 text-right tabular-nums">{(l.percentual * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}

      {tipo === 'despesa' && !cotacao && !rateio && (
        <>
          <fieldset className="text-sm">
            <legend className="font-semibold">Categoria</legend>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(CATEGORIA) as (keyof typeof CATEGORIA)[]).map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input type="radio" name="categoria" value={c} defaultChecked={(d?.categoria ?? 'operacional') === c} />
                  {CATEGORIA[c]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Prioridade">
              <select name="prioridade" defaultValue={d?.prioridade ?? ''} className={estiloEntrada}>
                <option value="">Não informada</option>
                {(Object.keys(PRIORIDADE) as (keyof typeof PRIORIDADE)[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORIDADE[k]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Cotação">
              <select name="cotacao" defaultValue={d?.cotacao ?? ''} className={estiloEntrada}>
                <option value="">Não informada</option>
                {(Object.keys(COTACAO) as (keyof typeof COTACAO)[]).map((k) => (
                  <option key={k} value={k}>
                    {COTACAO[k]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </>
      )}

      {tipo === 'receita' && (
        <Campo rotulo="Área" dica="Para quem a receita se destina. Em branco = receita geral.">
          <select name="area" defaultValue={r?.area ?? ''} className={estiloEntrada}>
            <option value="">Geral (sem área)</option>
            {opcoes.areas.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {tipo === 'receita' && (
        <fieldset className="text-sm">
          <legend className="font-semibold">Situação da captação</legend>
          {(Object.keys(CAPTACAO) as (keyof typeof CAPTACAO)[]).map((c) => (
            <label key={c} className="mt-1.5 flex items-center gap-2">
              <input type="radio" name="captacao" value={c} required defaultChecked={(r?.captacao ?? 'garantida') === c} />
              {CAPTACAO[c]}
              <span className="text-texto-suave">
                {c === 'garantida' ? '— termo ou contrato assinado' : c === 'negociacao' ? '— em conversa com o financiador' : '— ainda a buscar'}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <Opcional ativo={proposta && valor === 0} rotulo="Distribuição nos meses (opcional)">
      <fieldset className="min-w-0 space-y-2 text-sm">
        <legend className="font-semibold">Distribuição nos meses{proposta ? ' (opcional)' : ''}</legend>
        <input type="hidden" name="distribuicao" value={modo} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ['igual', 'Igual nos 12 meses'],
              ['meses', 'Só em alguns meses'],
              ['manual', 'Mês a mês'],
            ] as const
          ).map(([v, rotulo]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" checked={modo === v} onChange={() => setModo(v)} />
              {rotulo}
            </label>
          ))}
        </div>
        {modo === 'meses' && (
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {MESES.map((m, i) => (
              <label key={m} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="meses"
                  value={i + 1}
                  checked={meses.includes(i + 1)}
                  onChange={(e) => setMeses(e.target.checked ? [...meses, i + 1] : meses.filter((x) => x !== i + 1))}
                />
                {m.slice(0, 3)}
              </label>
            ))}
            {meses.length > 0 && (
              <p className="col-span-full text-xs text-texto-suave">
                {reais(valor / meses.length)} em cada mês marcado (os centavos que sobram vão para o último).
              </p>
            )}
          </div>
        )}
        {modo === 'manual' && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {MESES.map((m, i) => (
                <label key={m} className="block text-xs">
                  {m.slice(0, 3)}
                  <input
                    name={`m${i + 1}`}
                    inputMode="decimal"
                    value={manual[i]}
                    onChange={(e) => setManual(manual.map((v, k) => (k === i ? e.target.value : v)))}
                    className={`${estiloEntrada} !mt-0.5 !min-h-8 !px-2 !py-1 text-sm`}
                  />
                </label>
              ))}
            </div>
            <p className={`text-xs ${falta === 0 ? 'text-sucesso' : 'text-aviso'}`}>
              Soma dos meses: {reais(somaManual)}. {falta === 0 ? 'Fecha com o valor do item.' : falta > 0 ? `Faltam ${reais(falta)}.` : `Passou ${reais(-falta)}.`}
            </p>
          </>
        )}
      </fieldset>
      </Opcional>

      <Campo rotulo="Observação" dica={cotacao ? 'Ex.: 3 orçamentos, menor preço da loja X.' : 'Opcional.'}>
        <textarea name="observacao" rows={2} defaultValue={item?.observacao ?? ''} className={estiloEntrada} />
      </Campo>

      {estado.erro && (
        <Aviso tipo="erro" titulo="O item não foi salvo">
          {estado.erro}
        </Aviso>
      )}
      <div className="flex gap-2">
        <BotaoEnviar enviando="Salvando…" className="flex-1" disabled={(modo === 'manual' && falta !== 0) || (modo === 'meses' && meses.length === 0)}>
          {cotacao ? 'Salvar cotação' : item ? 'Salvar alterações' : rateio ? 'Salvar lançamento' : tipo === 'despesa' ? 'Lançar despesa' : 'Lançar receita'}
        </BotaoEnviar>
        {item && (
          <LinkBotao href={cancelarHref} variante="secundario">
            Cancelar
          </LinkBotao>
        )}
      </div>
    </form>
  );
}

/** Recolhe um trecho opcional do formulário (ex.: distribuição numa proposta sem valor). */
function Opcional({ ativo, rotulo, children }: { ativo: boolean; rotulo: string; children: React.ReactNode }) {
  if (!ativo) return <>{children}</>;
  return (
    <div className="rounded-md border border-borda px-3 py-2 text-sm">
      <input type="hidden" name="distribuicao" value="igual" />
      <p className="font-semibold">{rotulo}</p>
      <p className="mt-1 text-texto-suave">
        Sem valor, a distribuição nos meses é feita na cotação. Se a compra tem mês certo, escreva na observação (ex.: “precisa em março”).
      </p>
    </div>
  );
}
