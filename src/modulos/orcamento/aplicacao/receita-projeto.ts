/**
 * Receita "A captar" vinda de um projeto (ligações onda 2, regras L17 e L21).
 * O Projetos pede, pela plataforma, um item de Receita na Fonte própria escolhida, com o valor da meta do evento.
 * Quem decidiu a porta 2 já foi conferido pelo Projetos (como no rascunho do termo em Parcerias); aqui a gravação
 * usa `inserir`/`atualizar` e a auditoria registra só as colunas. O item só muda por este caminho.
 * Nada é apagado: cancelar ou parar o projeto encerra o item (`ativo = FALSE`).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Exercicios, Fontes, Receitas } from '../dados/tabelas';
import { arred } from '../dominio/previsao';
import { colunasDosMeses, ErroPrevisao, exigirEmElaboracao, mesesDaDistribuicao } from './previsao';

export interface FonteParaEvento {
  id: string;
  nome: string;
}

/**
 * Fontes de natureza própria que o evento pode escolher. Só nomes; nenhum valor. Quem propõe projeto não tem
 * acesso ao Orçamento, então a lista também vale para quem tem `projetos.propor`.
 */
export async function fontesParaEvento(p: Planilhas, quem: Autorizador): Promise<Ligacao<FonteParaEvento[]>> {
  if (!quem.temPermissao('orcamento.painel.ver') && !quem.temPermissaoAlgumEscopo('projetos.propor')) return ligacaoSemPermissao();
  const [fontes] = await lerTabelas(p, [Fontes] as const);
  return ligacaoOk(
    fontes
      .ativos()
      .filter((f) => f.natureza === 'propria')
      .map((f) => ({ id: f.id, nome: f.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
}

export interface PedidoReceitaDoProjeto {
  projetoId: string;
  projetoCodigo: string;
  titulo: string;
  fonteId: string;
  /** Meta de receita do evento. */
  valor: number;
  /** Data do evento (AAAA-MM-DD): define o exercício e o mês da receita. */
  dataEvento: string;
}

/** Idempotente por projeto: chamar de novo com os mesmos dados não duplica nem altera. */
export async function registrarReceitaDoProjeto(p: Planilhas, quem: { email: string }, pedido: PedidoReceitaDoProjeto): Promise<{ receitaId: string; criada: boolean }> {
  const dia = /^(\d{4})-(\d{2})-\d{2}$/.exec(pedido.dataEvento);
  if (!dia) throw new ErroPrevisao('O evento precisa de uma data para a receita entrar no Orçamento.');
  const ano = Number(dia[1]);
  const mes = Number(dia[2]);
  if (!Number.isFinite(pedido.valor) || pedido.valor <= 0) throw new ErroPrevisao('A meta de receita precisa ser maior que zero.');
  const [exercicios, fontes, receitas] = await lerTabelas(p, [Exercicios, Fontes, Receitas] as const);
  const fonte = fontes.ativos().find((f) => f.id === pedido.fonteId);
  if (!fonte || fonte.natureza !== 'propria') throw new ErroPrevisao('Escolha uma fonte de recurso própria, cadastrada no Orçamento.');
  exigirEmElaboracao(exercicios, ano);
  const valor = arred(pedido.valor);
  const campos = {
    ano,
    fonte_id: fonte.id,
    descricao: `Evento ${pedido.projetoCodigo}: ${pedido.titulo}`.slice(0, 120),
    valor,
    captacao: 'a_captar' as const,
    area: null,
    distribuicao: 'meses' as const,
    ...colunasDosMeses(mesesDaDistribuicao(valor, { distribuicao: 'meses', meses: [mes] })),
    observacao: null,
    projeto_id: pedido.projetoId,
    projeto_codigo: pedido.projetoCodigo,
  };
  const atual = receitas.ativos().find((r) => r.projeto_id === pedido.projetoId);
  if (!atual) {
    const nova = await inserir(p, Receitas, campos as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Receitas', registroId: nova.id, detalhes: { colunas: Object.keys(campos) } });
    return { receitaId: nova.id, criada: true };
  }
  if (atual.ano !== ano) {
    // Mudou o exercício do evento: o item antigo é encerrado (se ainda em elaboração) e um novo entra.
    exigirEmElaboracao(exercicios, atual.ano);
    await atualizar(p, Receitas, atual.id, atual.versao, { ativo: false } as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Receitas', registroId: atual.id, detalhes: { colunas: ['ativo'] } });
    const nova = await inserir(p, Receitas, campos as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Receitas', registroId: nova.id, detalhes: { colunas: Object.keys(campos) } });
    return { receitaId: nova.id, criada: true };
  }
  const { colunasAlteradas } = await atualizar(p, Receitas, atual.id, atual.versao, campos as never, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Receitas', registroId: atual.id, detalhes: { colunas: colunasAlteradas } });
  return { receitaId: atual.id, criada: false };
}

/** Cancelado ou parado: o item sai do orçamento, mas fica na planilha. Devolve se havia item ativo. */
export async function encerrarReceitaDoProjeto(p: Planilhas, quem: { email: string }, projetoId: string): Promise<boolean> {
  const [exercicios, receitas] = await lerTabelas(p, [Exercicios, Receitas] as const);
  const atual = receitas.ativos().find((r) => r.projeto_id === projetoId);
  if (!atual) return false;
  exigirEmElaboracao(exercicios, atual.ano);
  await atualizar(p, Receitas, atual.id, atual.versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Receitas', registroId: atual.id, detalhes: { colunas: ['ativo'] } });
  return true;
}
