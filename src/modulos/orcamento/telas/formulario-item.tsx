'use client';

/**
 * Formulário de item da previsão (despesa ou receita): o valor é calculado
 * na hora e a distribuição nos meses mostra se fecha com o valor.
 * O servidor confere tudo de novo antes de gravar.
 */
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
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
}: {
  tipo: 'despesa' | 'receita';
  acao: Acao;
  ano: number;
  opcoes: Previsao['opcoes'];
  item?: LinhaDespesa | LinhaReceita;
  cancelarHref: string;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const d = tipo === 'despesa' ? (item as LinhaDespesa | undefined) : undefined;
  const r = tipo === 'receita' ? (item as LinhaReceita | undefined) : undefined;

  const [qtd, setQtd] = useState(textoNumero(d?.quantidade ?? 1));
  const [ocor, setOcor] = useState(textoNumero(d?.ocorrencias ?? 1));
  const [unit, setUnit] = useState(textoNumero(d?.valor_unitario));
  const [valorReceita, setValorReceita] = useState(textoNumero(r?.valor));
  const valor = tipo === 'despesa' ? arred(num(qtd) * num(ocor) * num(unit)) : arred(num(valorReceita));

  const [modo, setModo] = useState<Distribuicao>(item?.distribuicao ?? 'igual');
  const [meses, setMeses] = useState<number[]>(item && item.distribuicao === 'meses' ? mesesUsados(item.meses) : []);
  const [manual, setManual] = useState<string[]>(item ? item.meses.map((v) => (v ? String(v) : '')) : Array(12).fill(''));
  const somaManual = arred(manual.reduce((s, v) => s + num(v), 0));
  const falta = arred(valor - somaManual);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="ano" value={ano} />
      {item && (
        <>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="versao" value={item.versao} />
        </>
      )}

      {tipo === 'despesa' ? (
        <>
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
          <Campo rotulo="Grupo de gasto" obrigatorio>
            <select name="grupo_id" required defaultValue={d?.grupo_id ?? ''} className={estiloEntrada}>
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

      <Campo rotulo="Descrição" obrigatorio>
        <input name="descricao" required defaultValue={item?.descricao} className={estiloEntrada} />
      </Campo>

      {tipo === 'despesa' ? (
        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Quantidade" obrigatorio>
            <input name="quantidade" required inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Vezes" obrigatorio>
            <input name="ocorrencias" required inputMode="decimal" value={ocor} onChange={(e) => setOcor(e.target.value)} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Valor unit. (R$)" obrigatorio>
            <input name="valor_unitario" required inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} className={estiloEntrada} />
          </Campo>
        </div>
      ) : (
        <Campo rotulo="Valor no ano (R$)" obrigatorio>
          <input name="valor" required inputMode="decimal" value={valorReceita} onChange={(e) => setValorReceita(e.target.value)} className={estiloEntrada} />
        </Campo>
      )}
      <p className="rounded-md bg-superficie-2 px-3 py-2 text-sm">
        Valor do item: <strong className="tabular-nums">{reais(valor)}</strong>
        {tipo === 'despesa' && <span className="block text-xs text-texto-suave">Quantidade × vezes × valor unitário (ex.: 60 alunos × 200 dias × R$ 7,50).</span>}
      </p>

      {tipo === 'despesa' && (
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

      <fieldset className="min-w-0 space-y-2 text-sm">
        <legend className="font-semibold">Distribuição nos meses</legend>
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

      <Campo rotulo="Observação" dica="Opcional.">
        <textarea name="observacao" rows={2} defaultValue={item?.observacao ?? ''} className={estiloEntrada} />
      </Campo>

      {estado.erro && (
        <Aviso tipo="erro" titulo="O item não foi salvo">
          {estado.erro}
        </Aviso>
      )}
      <div className="flex gap-2">
        <BotaoEnviar enviando="Salvando…" className="flex-1" disabled={(modo === 'manual' && falta !== 0) || (modo === 'meses' && meses.length === 0)}>
          {item ? 'Salvar alterações' : tipo === 'despesa' ? 'Lançar despesa' : 'Lançar receita'}
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
