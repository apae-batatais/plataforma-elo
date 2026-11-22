'use client';

/**
 * Montar o plano de contas de um exercício: por Área, marca os Grupos de Contas e, em cada Grupo, os Itens habilitados.
 * Tudo o que foi marcado fica na tela se der erro. Marcar um item marca o grupo; desmarcar o grupo tira os itens.
 */
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';

interface Cad {
  id: string;
  nome: string;
  codigo: string | null;
}
export interface GrupoDoFormulario extends Cad {
  itens: Cad[];
}
type Estado = { erro?: string };

const rotulo = (c: Cad) => (c.codigo ? `${c.nome} (${c.codigo})` : c.nome);

export function FormularioPlano({
  ano, loteLido, vigenciaInicial, areas, grupos, inicial, acao,
}: {
  ano: number;
  loteLido: string | null;
  vigenciaInicial: string;
  areas: Cad[];
  grupos: GrupoDoFormulario[];
  /** Linhas já marcadas: `area|grupo|item` (item vazio = grupo sem itens). */
  inicial: string[];
  acao: (estado: Estado, f: FormData) => Promise<Estado>;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const [grupoMarcado, setGrupoMarcado] = useState(() => new Set(inicial.map((k) => k.split('|').slice(0, 2).join('|'))));
  const [itemMarcado, setItemMarcado] = useState(() => new Set(inicial.filter((k) => k.split('|')[2]).map((k) => k)));
  const [vigencia, setVigencia] = useState(vigenciaInicial);

  const chaveItem = (a: string, g: string, i: string) => `${a}|${g}|${i}`;
  function alternarGrupo(a: string, g: GrupoDoFormulario, marcar: boolean) {
    const k = `${a}|${g.id}`;
    setGrupoMarcado((s) => {
      const n = new Set(s);
      if (marcar) n.add(k);
      else n.delete(k);
      return n;
    });
    if (!marcar) setItemMarcado((s) => new Set([...s].filter((x) => !x.startsWith(`${k}|`))));
  }
  function alternarItem(a: string, g: GrupoDoFormulario, i: Cad, marcar: boolean) {
    setItemMarcado((s) => {
      const n = new Set(s);
      if (marcar) n.add(chaveItem(a, g.id, i.id));
      else n.delete(chaveItem(a, g.id, i.id));
      return n;
    });
    if (marcar) setGrupoMarcado((s) => new Set(s).add(`${a}|${g.id}`));
  }
  function todosOsItens(a: string, g: GrupoDoFormulario) {
    const todos = g.itens.every((i) => itemMarcado.has(chaveItem(a, g.id, i.id)));
    setItemMarcado((s) => {
      const n = new Set(s);
      for (const i of g.itens) {
        if (todos) n.delete(chaveItem(a, g.id, i.id));
        else n.add(chaveItem(a, g.id, i.id));
      }
      return n;
    });
    if (!todos) setGrupoMarcado((s) => new Set(s).add(`${a}|${g.id}`));
  }

  // O que vai para o servidor: grupo com itens marcados vai item por item; sem itens, vai sozinho.
  const enviados: string[] = [];
  for (const k of grupoMarcado) {
    const itens = [...itemMarcado].filter((x) => x.startsWith(`${k}|`));
    if (itens.length) enviados.push(...itens);
    else enviados.push(`${k}|`);
  }

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="lote_lido" value={loteLido ?? ''} />
      {enviados.map((k) => (
        <input key={k} type="hidden" name="marcado" value={k} />
      ))}
      {estado.erro && (
        <Aviso tipo="erro" titulo="O plano não foi salvo">
          {estado.erro} O que você marcou continua aqui.
        </Aviso>
      )}
      <Campo rotulo="Vale a partir de" obrigatorio dica={`Dentro do ano de ${ano}. O plano anterior continua valendo até esta data.`}>
        <input type="date" name="vigencia" required min={`${ano}-01-01`} max={`${ano}-12-31`} value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={estiloEntrada} />
      </Campo>
      <div className="space-y-2">
        {areas.map((a) => {
          const n = grupos.filter((g) => grupoMarcado.has(`${a.id}|${g.id}`)).length;
          return (
            <details key={a.id} open={n > 0} className="rounded-lg border border-borda bg-superficie-2">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2 font-semibold">
                <span>{rotulo(a)}</span>
                <span className="text-sm font-normal text-texto-suave">{n === 0 ? 'Nenhum grupo' : n === 1 ? '1 grupo' : `${n} grupos`}</span>
              </summary>
              <div className="space-y-3 border-t border-borda px-4 py-3">
                {grupos.map((g) => {
                  const marcado = grupoMarcado.has(`${a.id}|${g.id}`);
                  return (
                    <fieldset key={g.id} className="text-sm">
                      <legend className="sr-only">{g.nome}</legend>
                      <label className="flex min-h-11 items-center gap-2 font-semibold">
                        <input type="checkbox" className="size-5" checked={marcado} onChange={(e) => alternarGrupo(a.id, g, e.target.checked)} />
                        {rotulo(g)}
                      </label>
                      {g.itens.length > 0 && marcado && (
                        <div className="ml-7 space-y-0.5">
                          <Botao type="button" variante="fantasma" className="!min-h-9 !px-2 text-sm" onClick={() => todosOsItens(a.id, g)}>
                            {g.itens.every((i) => itemMarcado.has(chaveItem(a.id, g.id, i.id))) ? 'Desmarcar todos' : 'Marcar todos'}
                          </Botao>
                          {g.itens.map((i) => (
                            <label key={i.id} className="flex min-h-11 items-center gap-2">
                              <input type="checkbox" className="size-5" checked={itemMarcado.has(chaveItem(a.id, g.id, i.id))} onChange={(e) => alternarItem(a.id, g, i, e.target.checked)} />
                              {rotulo(i)}
                            </label>
                          ))}
                        </div>
                      )}
                      {g.itens.length > 0 && !marcado && <p className="ml-7 text-texto-suave">{g.itens.length === 1 ? '1 item' : `${g.itens.length} itens`}. Marque o grupo para escolher os itens.</p>}
                    </fieldset>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      <BotaoEnviar enviando="Gravando…" className="w-full">
        Salvar plano
      </BotaoEnviar>
    </form>
  );
}
