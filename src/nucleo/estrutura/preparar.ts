/**
 * "Preparar estrutura": cria as abas que faltam, com o cabeçalho, e grava a
 * configuração inicial nas abas vazias. Pode rodar quantas vezes for preciso:
 * nunca apaga nem altera o que já existe.
 *
 * Feito com poucas chamadas ao Google (cerca de 4 por planilha + 5), para
 * caber no limite de tempo das funções da hospedagem.
 */
import type { z } from 'zod';
import { atualizar, cabecalhoDe, inserirVarios, lerTabelas, type DefinicaoTabela, type Entrada, type Planilhas, type TabelaLida } from '@/nucleo/armazenamento/tabela';
import { AREAS_INICIAIS, PERFIS_INICIAIS, PERMISSOES_INICIAIS, UNIDADES_INICIAIS } from './dados-iniciais';
import { Areas, PerfilPermissoes, Perfis, Servicos, TABELAS_DO_NUCLEO, Unidades } from './tabelas';

export interface ResultadoPreparacao {
  abasCriadas: string[];
  registrosIniciais: number;
  /** Ajustes de configuração aplicados em planilhas já preparadas antes. */
  ajustes: string[];
}

/** Nomes antigos das unidades, trocados pelos nomes definidos pela Diretoria (27/10/2026). */
const NOMES_ANTIGOS_UNIDADES: Record<string, string> = { sede: 'Sede', rural: 'APAE Rural' };

export async function prepararEstrutura(
  p: Planilhas,
  tabelasDosModulos: readonly DefinicaoTabela<z.ZodObject>[] = [],
  autor = 'sistema',
): Promise<ResultadoPreparacao> {
  const porPlanilha = new Map<string, { aba: string; cabecalho: string[] }[]>();
  for (const def of [...TABELAS_DO_NUCLEO, ...tabelasDosModulos] as DefinicaoTabela<z.ZodObject>[]) {
    porPlanilha.set(def.planilha, [...(porPlanilha.get(def.planilha) ?? []), { aba: def.aba, cabecalho: cabecalhoDe(def) }]);
  }
  const abasCriadas: string[] = [];
  for (const [chave, abas] of porPlanilha) {
    const criadas = await p.armazenamento.garantirAbas(p.idDe(chave), abas);
    abasCriadas.push(...criadas.map((a) => `${chave} › ${a}`));
  }

  const [unidades, areas, perfis, permissoes, servicos] = await lerTabelas(p, [Unidades, Areas, Perfis, PerfilPermissoes, Servicos] as const);
  const semear = async <E extends z.ZodObject>(tabela: TabelaLida<E>, linhas: Entrada<E>[]) =>
    tabela.todos().length > 0 ? 0 : inserirVarios(p, tabela, linhas, { email: autor });
  const registrosIniciais =
    (await semear(unidades, UNIDADES_INICIAIS)) +
    (await semear(areas, AREAS_INICIAIS)) +
    (await semear(perfis, PERFIS_INICIAIS)) +
    (await semear(permissoes, PERMISSOES_INICIAIS));

  // Ajustes: só mudam o que ainda está como a configuração antiga, e nada é apagado.
  const ajustes: string[] = [];
  const autoria = { email: autor };
  for (const u of unidades.ativos()) {
    const novo = UNIDADES_INICIAIS.find((x) => x.codigo === u.codigo);
    if (novo && NOMES_ANTIGOS_UNIDADES[u.codigo] === u.nome) {
      await atualizar(p, Unidades, u.id, u.versao, { nome: novo.nome }, autoria);
      ajustes.push(`unidade "${u.nome}" renomeada para "${novo.nome}"`);
    }
  }
  const cer = unidades.ativos().find((u) => u.codigo === 'cer');
  if (cer && !servicos.ativos().some((s) => s.unidade === 'cer')) {
    await atualizar(p, Unidades, cer.id, cer.versao, { ativo: false }, autoria);
    ajustes.push('unidade "CER" desativada');
  }

  return { abasCriadas, registrosIniciais, ajustes };
}
