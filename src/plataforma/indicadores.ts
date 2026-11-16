/**
 * Painel de indicadores da Diretoria (ADR-025): junta o que cada módulo calcula.
 * Só a plataforma conhece todos os módulos; cada um confere o próprio acesso.
 * Para um app novo entrar, exporte `indicadoresDaPlataforma` no `index.ts` dele e liste aqui.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import type { IndicadorCalculado, PeriodoDoPainel } from '@/capacidades/indicadores';
import { indicadoresComunicacaoDaPlataforma } from '@/modulos/comunicacao';
import { indicadoresOrcamento } from '@/modulos/orcamento';
import { indicadoresRequisicoes } from '@/modulos/requisicoes';

export const PERMISSAO_INDICADORES = 'plataforma.indicadores.ver';

export interface FonteDeIndicadores {
  /** Id do módulo (o mesmo do manifesto). */
  id: string;
  nome: string;
  rota: string;
  calcular: (p: Planilhas, quem: Autorizador, periodo: PeriodoDoPainel) => Promise<IndicadorCalculado[]>;
}

/** Na ordem do menu dos apps. */
export const FONTES_DE_INDICADORES: readonly FonteDeIndicadores[] = [
  { id: 'orcamento', nome: 'Orçamento', rota: '/orcamento/previsao/geral', calcular: indicadoresOrcamento },
  { id: 'requisicoes', nome: 'Requisições', rota: '/requisicoes/painel', calcular: indicadoresRequisicoes },
  { id: 'comunicacao', nome: 'Comunicação', rota: '/comunicacao/indicadores', calcular: indicadoresComunicacaoDaPlataforma },
];

export interface BlocoDoPainel {
  id: string;
  nome: string;
  rota: string;
  estado: 'ok' | 'sem_acesso' | 'falhou';
  indicadores: IndicadorCalculado[];
}

/** Lança `ErroPermissao` se a pessoa não é da Diretoria. Um app que falha ou não é permitido não derruba os outros. */
export async function painelDeIndicadores(
  p: Planilhas,
  quem: Autorizador,
  periodo: PeriodoDoPainel,
  opcoes: { fontes?: readonly FonteDeIndicadores[]; desligados?: ReadonlySet<string> } = {},
): Promise<BlocoDoPainel[]> {
  if (!quem.temPermissao(PERMISSAO_INDICADORES)) throw new ErroPermissao();
  const fontes = (opcoes.fontes ?? FONTES_DE_INDICADORES).filter((f) => !opcoes.desligados?.has(f.id));
  return Promise.all(
    fontes.map(async (f): Promise<BlocoDoPainel> => {
      const bloco = { id: f.id, nome: f.nome, rota: f.rota };
      try {
        return { ...bloco, estado: 'ok', indicadores: await f.calcular(p, quem, periodo) };
      } catch (e) {
        return { ...bloco, estado: e instanceof ErroPermissao ? 'sem_acesso' : 'falhou', indicadores: [] };
      }
    }),
  );
}

/** Ano da tela: o do endereço se for válido, senão o atual (Brasília). */
export function anoDoPainel(texto: string | undefined, agora: Date): number {
  const atual = new Date(agora.getTime() - 3 * 3600_000).getUTCFullYear();
  const n = Number(texto);
  return /^\d{4}$/.test(texto ?? '') && n >= 2000 && n <= atual + 1 ? n : atual;
}
