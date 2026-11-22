/**
 * "Baixar planilha" (CSV) dos cadastros e das despesas/receitas do exercício, com o código da conta contábil.
 *
 * Quem pode: quem já vê a lista (mesmas regras de `listarCadastros` e `lerPrevisao`). O RH automático da
 * folha entra só como total por serviço, e só para quem vê a folha. Só lê: não grava nem audita
 * (sem dado sensível).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { montarCsv } from '../dominio/codigo-conta';
import { lerPlano } from './plano-contas';
import { opcoesDoPlano } from './plano-lancamento';
import { ErroPrevisao, lerPrevisao, listarCadastros } from './previsao';

export interface ArquivoCsv {
  nome: string;
  conteudo: string;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAPTACAO = { garantida: 'Garantida', negociacao: 'Em negociação', a_captar: 'A captar' } as const;

export async function baixarCadastrosCsv(p: Planilhas, quem: Autorizador, tipo: 'grupo' | 'fonte'): Promise<ArquivoCsv> {
  const { grupos, fontes } = await listarCadastros(p, quem);
  if (tipo === 'grupo') {
    return {
      nome: 'grupos-de-gasto.csv',
      conteudo: montarCsv(['Nome', 'Código da conta', 'Tipo'], grupos.ativos.map((g) => [g.nome, g.codigo_conta, g.rh ? 'Recursos Humanos' : 'Despesa geral'])),
    };
  }
  return {
    nome: 'fontes-de-recurso.csv',
    conteudo: montarCsv(
      ['Nome', 'Código da conta', 'Natureza', 'Uso'],
      fontes.ativos.map((f) => [f.nome, f.codigo_conta, f.natureza === 'publica' ? 'Pública' : 'Própria', f.uso === 'livre' ? 'Livre' : 'Restrita']),
    ),
  };
}

export async function baixarItensCsv(p: Planilhas, quem: Autorizador, tipo: 'despesa' | 'receita', ano?: number): Promise<ArquivoCsv> {
  const prev = await lerPrevisao(p, quem, ano, { incluirCedidos: false });
  const meses = (l: number[]) => l.map((v) => v);
  if (tipo === 'despesa') {
    const plano = await opcoesDoPlano(p, prev.ano);
    const nomeItem = new Map(plano.itens.map((i) => [i.id, i.nome]));
    const nomeArea = new Map(plano.areas.map((a) => [a.id, a.nome]));
    const linhas: (string | number | null)[][] = prev.despesas.map((d) => [
      d.servicoNome, d.grupoNome, d.grupoCodigo, d.item_id ? (nomeItem.get(d.item_id) ?? null) : null, d.area_plano_id ? (nomeArea.get(d.area_plano_id) ?? null) : null,
      d.fonte_id ? d.fonteNome : 'A definir', d.fonteCodigo, d.descricao, d.valor, ...meses(d.meses),
    ]);
    for (const l of prev.folha?.linhas ?? []) {
      if (l.anual > 0) linhas.push([l.nome, 'Recursos Humanos (folha)', null, null, null, l.fonte_id ? l.fonteNome : 'A definir', null, 'RH automático da folha', l.anual, ...meses(l.mensal)]);
    }
    if (linhas.length === 0) throw new ErroPrevisao('Nada para baixar ainda.');
    return {
      nome: `despesas-${prev.ano}.csv`,
      conteudo: montarCsv(['Serviço', 'Grupo de contas', 'Código da conta do grupo', 'Item contábil', 'Área do plano', 'Fonte', 'Código da conta da fonte', 'Descrição', 'Valor anual', ...MESES], linhas),
    };
  }
  if (prev.receitas.length === 0) throw new ErroPrevisao('Nada para baixar ainda.');
  return {
    nome: `receitas-${prev.ano}.csv`,
    conteudo: montarCsv(
      ['Fonte', 'Código da conta da fonte', 'Descrição', 'Captação', 'Valor anual', ...MESES],
      prev.receitas.map((r) => [r.fonteNome, r.fonteCodigo, r.descricao, CAPTACAO[r.captacao], r.valor, ...meses(r.meses)]),
    ),
  };
}

/** Plano de contas de um exercício (um arquivo por exercício): a versão mais recente, uma linha por área, grupo e item. */
export async function baixarPlanoCsv(p: Planilhas, quem: Autorizador, ano?: number): Promise<ArquivoCsv> {
  const plano = await lerPlano(p, quem, ano);
  if (!plano.atual) throw new ErroPrevisao('Nada para baixar ainda.');
  const { areas, itens, grupos } = plano.cadastros;
  const area = new Map([...areas.ativos, ...areas.excluidos].map((a) => [a.id, a]));
  const grupo = new Map(grupos.map((g) => [g.id, g]));
  const item = new Map([...itens.ativos, ...itens.excluidos].map((i) => [i.id, i]));
  const linhas = plano.atual.linhas.map((l) => [
    area.get(l.area_id)?.nome ?? '', area.get(l.area_id)?.codigo ?? null,
    grupo.get(l.grupo_id)?.nome ?? '', grupo.get(l.grupo_id)?.codigo_conta ?? null,
    l.item_id ? (item.get(l.item_id)?.nome ?? '') : null, l.item_id ? (item.get(l.item_id)?.codigo ?? null) : null,
    plano.atual!.vigencia,
  ]);
  linhas.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR') || String(a[2]).localeCompare(String(b[2]), 'pt-BR') || String(a[4] ?? '').localeCompare(String(b[4] ?? ''), 'pt-BR'));
  return {
    nome: `plano-de-contas-${plano.ano}.csv`,
    conteudo: montarCsv(['Área', 'Código da área', 'Grupo de contas', 'Código do grupo', 'Item contábil', 'Código do item', 'Vale desde'], linhas),
  };
}
