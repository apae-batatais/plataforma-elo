/**
 * Visão de ligação do Orçamento (ADR-022): o custo de um serviço, para a Ficha do serviço.
 * Confere `orcamento.execucao.ver` no escopo do serviço. Só números do serviço; nenhum dado pessoal.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Ajustes, Despesas, Exercicios, Fontes, Realizado } from '../dados/tabelas';
import { deltasDosAjustes, mesesComAjuste } from '../dominio/ajustes';
import { mesAtualBrasilia } from '../dominio/tesouraria';

export interface CustoPorFonte {
  fonte: string;
  previsto: number;
  realizado: number;
}

export interface CustoDoServico {
  ano: number;
  /** O exercício está aprovado (ou encerrado): só então há previsto para mostrar. */
  previsaoAprovada: boolean;
  previsto: number;
  realizado: number;
  saldo: number;
  /** Último mês (AAAA-MM) com realizado informado no serviço; nulo se nenhum. */
  ultimoMes: string | null;
  porFonte: CustoPorFonte[];
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** O realizado do serviço é visível a quem informa o realizado ou tem `orcamento.execucao.ver` no serviço. */
export const podeVerCustoDoServico = (quem: Autorizador, servico: string) =>
  quem.temPermissao('orcamento.realizado.editar') || quem.temPermissao('orcamento.execucao.ver', { tipo: 'servico', codigo: servico });

export async function custoDoServico(p: Planilhas, quem: Autorizador, servico: string, opcoes: { ano?: number } = {}): Promise<Ligacao<CustoDoServico>> {
  if (!podeVerCustoDoServico(quem, servico)) return ligacaoSemPermissao();
  const ano = opcoes.ano ?? Number(mesAtualBrasilia().slice(0, 4));
  const [exercicios, despesas, ajustes, realizado, fontes] = await lerTabelas(p, [Exercicios, Despesas, Ajustes, Realizado, Fontes] as const);
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  const aprovada = !!ex && ex.situacao !== 'elaboracao';
  const nomeFonte = new Map(fontes.todos().map((f) => [f.id, f.nome]));
  const porFonte = new Map<string, CustoPorFonte>();
  const linha = (id: string) => {
    let l = porFonte.get(id);
    if (!l) porFonte.set(id, (l = { fonte: nomeFonte.get(id) ?? '?', previsto: 0, realizado: 0 }));
    return l;
  };

  if (aprovada) {
    const deltas = deltasDosAjustes(ajustes.ativos().filter((a) => a.ano === ano && a.situacao === 'aprovado'));
    for (const d of despesas.ativos().filter((x) => x.ano === ano && x.servico === servico && x.situacao === 'aceito' && x.fonte_id)) {
      const meses = Array.from({ length: 12 }, (_, i) => Number((d as unknown as Record<string, unknown>)[`m${i + 1}`] ?? 0) || 0);
      const total = mesesComAjuste(meses, deltas.get(d.id)).reduce((s, v) => s + v, 0);
      linha(d.fonte_id!).previsto += total;
    }
  }
  const lancado = realizado.ativos().filter((r) => r.tipo === 'despesa' && r.ano === ano && r.servico === servico);
  for (const r of lancado) linha(r.fonte_id).realizado += r.valor;

  const previsto = arred([...porFonte.values()].reduce((s, l) => s + l.previsto, 0));
  const total = arred(lancado.reduce((s, r) => s + r.valor, 0));
  return ligacaoOk({
    ano,
    previsaoAprovada: aprovada,
    previsto,
    realizado: total,
    saldo: arred(previsto - total),
    ultimoMes: lancado.map((r) => r.mes).sort().at(-1) ?? null,
    porFonte: [...porFonte.values()]
      .map((l) => ({ ...l, previsto: arred(l.previsto), realizado: arred(l.realizado) }))
      .sort((a, b) => b.previsto - a.previsto || b.realizado - a.realizado),
  });
}
