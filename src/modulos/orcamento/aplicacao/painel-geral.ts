/**
 * Painel geral: compara os exercícios (anos) lado a lado.
 * Só leitura (orcamento.painel.ver). Usa a mesma conta da Previsão de cada ano,
 * então os números batem com as outras telas.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Exercicios } from '../dados/tabelas';
import { arred, type Indicadores } from '../dominio/previsao';
import { lerPrevisao } from './previsao';

export interface ResumoDoAno {
  ano: number;
  situacao: 'elaboracao' | 'aprovado' | 'encerrado';
  despesa: number;
  receita: number;
  resultado: number;
  /** RH total: folha (automática ou consolidada) + grupos marcados como RH. */
  rh: number;
  indicadores: Indicadores;
  despesaMensal: number[];
  receitaMensal: number[];
  porArea: Record<string, number>;
  /** Grupos de gasto, com todo o RH somado numa linha só. */
  porGrupo: Record<string, number>;
  receitaPublica: number;
  receitaPropria: number;
  receitaLivre: number;
  receitaRestrita: number;
  aDefinir: number;
}

export interface PainelGeral {
  anos: ResumoDoAno[];
  /** Áreas e grupos em ordem de tamanho no ano mais recente. */
  areas: string[];
  grupos: string[];
}

export const GRUPO_RH = 'Recursos Humanos';

export async function painelGeral(p: Planilhas, quem: Autorizador): Promise<PainelGeral> {
  if (!quem.temPermissao('orcamento.painel.ver') && !quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
  const [exercicios] = await lerTabelas(p, [Exercicios] as const);
  const lista = exercicios.ativos().sort((a, b) => a.ano - b.ano);

  const anos: ResumoDoAno[] = [];
  for (const e of lista) {
    const prev = await lerPrevisao(p, quem, e.ano);
    const t = prev.totais;
    const porArea = Object.fromEntries(t.porArea.map((g) => [g.nome, g.anual]));
    const porGrupo: Record<string, number> = {};
    const rhDoGrupo = new Map(prev.opcoes.grupos.map((g) => [g.nome, g.rh]));
    for (const g of t.porGrupo) {
      const nome = g.chave === '__folha__' || rhDoGrupo.get(g.nome) || prev.despesas.some((d) => d.grupoNome === g.nome && d.rh) ? GRUPO_RH : g.nome;
      porGrupo[nome] = arred((porGrupo[nome] ?? 0) + g.anual);
    }
    const soma = (f: (r: (typeof prev.receitas)[number]) => boolean) => arred(prev.receitas.filter(f).reduce((s, r) => s + r.valor, 0));
    anos.push({
      ano: e.ano,
      situacao: e.situacao,
      despesa: t.despesa.anual,
      receita: t.receita.anual,
      resultado: prev.indicadores.resultado,
      rh: t.rh,
      indicadores: prev.indicadores,
      despesaMensal: t.despesa.mensal,
      receitaMensal: t.receita.mensal,
      porArea,
      porGrupo,
      receitaPublica: soma((r) => r.natureza === 'publica'),
      receitaPropria: soma((r) => r.natureza === 'propria'),
      receitaLivre: soma((r) => r.uso === 'livre'),
      receitaRestrita: soma((r) => r.uso === 'restrita'),
      aDefinir: t.aDefinir.valor,
    });
  }

  const ultimo = anos.at(-1);
  const ordenar = (chave: 'porArea' | 'porGrupo') => {
    const nomes = new Set(anos.flatMap((a) => Object.keys(a[chave])));
    return [...nomes].sort((x, y) => (ultimo?.[chave][y] ?? 0) - (ultimo?.[chave][x] ?? 0));
  };
  return { anos, areas: ordenar('porArea'), grupos: ordenar('porGrupo') };
}

/** Variação percentual de um valor em relação ao ano anterior (null sem base). */
export function variacao(atual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}
