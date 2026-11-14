/**
 * Visão de ligação do Orçamento (ADR-022): o custo de um serviço, para a Ficha do serviço.
 * Confere `orcamento.execucao.ver` no escopo do serviço. Só números do serviço; nenhum dado pessoal.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Ajustes, Despesas, Exercicios, Fontes, GruposGasto, Realizado } from '../dados/tabelas';
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

export interface GrupoDeGasto {
  id: string;
  nome: string;
}

/** Saldo do exercício para quem aprova uma requisição (L2). Só aviso: nunca bloqueia a aprovação. */
export interface SaldoParaConferencia {
  ano: number;
  /** Sem exercício aprovado não há previsto: o cartão diz "Sem orçamento aprovado para este ano". */
  previsaoAprovada: boolean;
  /** Saldo do serviço (previsto aprovado menos realizado até o último mês lançado). */
  servico: { previsto: number; realizado: number; saldo: number };
  /** Saldo do grupo de gasto, quando informado e existente. */
  grupo: { id: string; nome: string; previsto: number; realizado: number; saldo: number } | null;
  /** Grupos para o campo "Grupo de gasto". */
  grupos: GrupoDeGasto[];
  ultimoMes: string | null;
}

export async function saldoParaConferencia(
  p: Planilhas,
  quem: Autorizador,
  servico: string,
  opcoes: { grupoId?: string | null; ano?: number } = {},
): Promise<Ligacao<SaldoParaConferencia>> {
  if (!quem.temPermissao('orcamento.execucao.ver', { tipo: 'servico', codigo: servico })) return ligacaoSemPermissao();
  const ano = opcoes.ano ?? Number(mesAtualBrasilia().slice(0, 4));
  const [exercicios, despesas, ajustes, realizado, grupos] = await lerTabelas(p, [Exercicios, Despesas, Ajustes, Realizado, GruposGasto] as const);
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  const aprovada = !!ex && ex.situacao !== 'elaboracao';
  const deltas = aprovada ? deltasDosAjustes(ajustes.ativos().filter((a) => a.ano === ano && a.situacao === 'aprovado')) : new Map();
  const doServico = despesas.ativos().filter((x) => x.ano === ano && x.servico === servico && x.situacao === 'aceito');
  const previstoDe = (lista: typeof doServico) =>
    aprovada
      ? lista.reduce((soma, d) => {
          const meses = Array.from({ length: 12 }, (_, i) => Number((d as unknown as Record<string, unknown>)[`m${i + 1}`] ?? 0) || 0);
          return soma + mesesComAjuste(meses, deltas.get(d.id)).reduce((s, v) => s + v, 0);
        }, 0)
      : 0;
  const lancado = realizado.ativos().filter((r) => r.tipo === 'despesa' && r.ano === ano && r.servico === servico);
  const soma = (l: { valor: number }[]) => l.reduce((s, r) => s + r.valor, 0);
  const grupo = opcoes.grupoId ? grupos.ativos().find((g) => g.id === opcoes.grupoId) : undefined;
  const montar = (previsto: number, gasto: number) => ({ previsto: arred(previsto), realizado: arred(gasto), saldo: arred(previsto - gasto) });
  return ligacaoOk({
    ano,
    previsaoAprovada: aprovada,
    servico: montar(previstoDe(doServico), soma(lancado)),
    grupo: grupo
      ? {
          id: grupo.id,
          nome: grupo.nome,
          ...montar(
            previstoDe(doServico.filter((d) => d.grupo_id === grupo.id)),
            soma(lancado.filter((r) => r.grupo_id === grupo.id)),
          ),
        }
      : null,
    grupos: grupos
      .ativos()
      .map((g) => ({ id: g.id, nome: g.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ultimoMes: lancado.map((r) => r.mes).sort().at(-1) ?? null,
  });
}
