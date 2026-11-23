/**
 * Visão de ligação do Orçamento para o Projetos (ligações onda 2, L18 e L21): o que foi realizado com um projeto.
 * Confere `orcamento.painel.ver`. Só valores e contagem; nenhum dado pessoal. O Projetos confere antes que a
 * pessoa vê o projeto.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Realizado } from '../dados/tabelas';

export interface ResultadoDoProjeto {
  /** Sem nenhuma linha do projeto no Realizado: não é "zero", é "sem lançamentos" (L19). */
  semLancamentos: boolean;
  lancamentos: number;
  receita: number;
  custo: number;
  /** Receita − custo; negativo é prejuízo. */
  resultado: number;
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Quem pode ver os valores do projeto: a permissão de painel do Orçamento (Financeiro, Diretoria e Leitura). */
export const podeVerResultadoDoProjeto = (quem: Autorizador) => quem.temPermissao('orcamento.painel.ver');

export async function resultadoDoProjeto(p: Planilhas, quem: Autorizador, projetoId: string): Promise<Ligacao<ResultadoDoProjeto>> {
  if (!podeVerResultadoDoProjeto(quem)) return ligacaoSemPermissao();
  const linhas = (await lerTabela(p, Realizado)).ativos().filter((r) => r.projeto_id === projetoId);
  let receita = 0;
  let custo = 0;
  for (const r of linhas) {
    if (r.tipo === 'receita') receita += Math.round(r.valor * 100);
    else custo += Math.round(r.valor * 100);
  }
  return ligacaoOk({
    semLancamentos: linhas.length === 0,
    lancamentos: linhas.length,
    receita: arred(receita / 100),
    custo: arred(custo / 100),
    resultado: arred((receita - custo) / 100),
  });
}
