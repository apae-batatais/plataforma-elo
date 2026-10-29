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
  /** Receita por situação da captação (garantida, em negociação, a captar). */
  porCaptacao: Record<'garantida' | 'negociacao' | 'a_captar', number>;
  /** Cada fonte de recurso: quanto entra (receita) e quanto já está comprometido (despesa). */
  porFonte: { nome: string; receita: number; despesa: number }[];
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
      porCaptacao: t.porCaptacao,
      porFonte: fontesDoAno(t.receitaPorFonte, t.despesaPorFonte),
    });
  }

  const ultimo = anos.at(-1);
  const ordenar = (chave: 'porArea' | 'porGrupo') => {
    const nomes = new Set(anos.flatMap((a) => Object.keys(a[chave])));
    return [...nomes].sort((x, y) => (ultimo?.[chave][y] ?? 0) - (ultimo?.[chave][x] ?? 0));
  };
  return { anos, areas: ordenar('porArea'), grupos: ordenar('porGrupo') };
}

/** Junta receita e despesa por fonte; "A definir" (despesa sem fonte) fica por último. */
function fontesDoAno(receita: { nome: string; anual: number }[], despesa: { chave: string; nome: string; anual: number }[]) {
  const mapa = new Map<string, { nome: string; receita: number; despesa: number }>();
  for (const r of receita) mapa.set(r.nome, { nome: r.nome, receita: r.anual, despesa: 0 });
  for (const d of despesa) {
    const atual = mapa.get(d.nome) ?? { nome: d.nome, receita: 0, despesa: 0 };
    atual.despesa = arred(atual.despesa + d.anual);
    mapa.set(d.nome, atual);
  }
  return [...mapa.values()].sort((a, b) => (a.receita === 0 && a.despesa > 0 ? 1 : 0) - (b.receita === 0 && b.despesa > 0 ? 1 : 0) || b.receita - a.receita);
}

/** Variação percentual de um valor em relação ao ano anterior (null sem base). */
export function variacao(atual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}
