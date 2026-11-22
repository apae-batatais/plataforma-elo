/**
 * Plano de contas nos lançamentos (entrega 2 da proposta #221, ADR-036).
 *
 * Funções de apoio chamadas por casos de uso que já conferiram a permissão (Previsão e Realizado).
 * O plano só orienta: aqui só se confere erro de dado (item de outro grupo, cadastro inexistente);
 * "fora do plano" vira aviso na tela, nunca recusa.
 */
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { AreasPlano, ItensContabeis, PlanoContas } from '../dados/tabelas';
import { conferirItemEArea, versaoParaLancar, type LinhaPlano } from '../dominio/plano-contas';

export interface OpcoesPlano {
  areas: { id: string; nome: string; ativo: boolean }[];
  itens: { id: string; nome: string; codigo: string | null; grupo_id: string; ativo: boolean }[];
  /** Plano que vale para o lançamento (`null` = o exercício não tem plano: mostra tudo, sem avisos). */
  linhas: LinhaPlano[] | null;
}

const hojeBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Opções do plano para os formulários de despesa e de realizado. `data` (AAAA-MM-DD) é a do lançamento; padrão: hoje. */
export async function opcoesDoPlano(p: Planilhas, ano: number, data?: string, agora: Date = new Date()): Promise<OpcoesPlano> {
  const [areas, itens, plano] = await lerTabelas(p, [AreasPlano, ItensContabeis, PlanoContas] as const);
  const gravadas = plano.ativos().map((r) => ({ exercicio: r.exercicio, lote: r.lote, vigencia: r.vigencia, area_id: r.area_id, grupo_id: r.grupo_id, item_id: r.item_id }));
  const versao = versaoParaLancar(gravadas, ano, data ?? hojeBrasilia(agora));
  const nome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR');
  return {
    areas: areas.todos().map((a) => ({ id: a.id, nome: a.nome, ativo: a.ativo })).sort(nome),
    itens: itens.todos().map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, grupo_id: i.grupo_id, ativo: i.ativo })).sort(nome),
    linhas: versao ? versao.linhas : null,
  };
}

/** Erros de dado do item e da área escolhidos (vazio = pode gravar). */
export async function errosDoItemEDaArea(
  p: Planilhas,
  dados: { grupo_id: string | null; item_id: string | null; area_plano_id: string | null },
  atual?: { item_id: string | null; area_plano_id: string | null },
): Promise<string[]> {
  if (!dados.item_id && !dados.area_plano_id) return [];
  const [areas, itens] = await lerTabelas(p, [AreasPlano, ItensContabeis] as const);
  return conferirItemEArea(
    dados,
    itens.todos().map((i) => ({ id: i.id, grupo_id: i.grupo_id, ativo: i.ativo })),
    areas.todos().map((a) => ({ id: a.id, ativo: a.ativo })),
    atual,
  );
}
