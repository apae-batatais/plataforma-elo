/**
 * Comparar exercícios e divergência de área (entrega 3 da proposta #221, ADR-036). Só leitura.
 *
 * Quem pode:
 * - Comparar: quem vê o plano (`orcamento.painel.ver` ou `orcamento.previsao.editar`).
 * - Divergências: Financeiro e Diretoria veem tudo e as linhas; Coordenação (`orcamento.execucao.ver` com escopo)
 *   vê só os serviços do seu escopo; Leitura (`painel.ver`) vê só os totais, sem as linhas.
 *   O filtro de escopo vem ANTES de somar.
 * O plano não muda nenhum total do orçamento.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { AreasPlano, Despesas, GruposGasto, ItensContabeis, PlanoContas, Realizado } from '../dados/tabelas';
import { chaveCodigoConta } from '../dominio/codigo-conta';
import {
  compararPlanos, divergenciasDeArea, versaoDoFimDoAno,
  type ComparacaoPlanos, type LancamentoParaDivergencia, type LinhaGravada,
} from '../dominio/plano-contas';
import { nomeComparavel, valorDoItem } from '../dominio/previsao';
import { ErroPrevisao } from './previsao';

const PERM = { ver: 'orcamento.painel.ver', editar: 'orcamento.previsao.editar', execucao: 'orcamento.execucao.ver' } as const;

const nomePt = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR');

function exigirVerPlano(quem: Autorizador) {
  if (!quem.temPermissao(PERM.ver) && !quem.temPermissao(PERM.editar)) throw new ErroPermissao();
}

function anoValido(ano: number): boolean {
  return Number.isInteger(ano) && ano >= 2020 && ano <= 2100;
}

interface Nomeado {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface ComparacaoLida {
  anoAntes: number;
  anoDepois: number;
  anos: number[];
  /** Falta plano em um dos lados: a tela explica em vez de comparar. */
  semPlano: { antes: boolean; depois: boolean };
  comparacao: ComparacaoPlanos | null;
  areas: Record<string, Nomeado>;
  grupos: Record<string, Nomeado>;
  itens: Record<string, Nomeado>;
}

const mapa = (l: { id: string; nome: string; ativo: boolean }[]) => Object.fromEntries(l.map((x) => [x.id, { id: x.id, nome: x.nome, ativo: x.ativo }]));

/** Compara o plano que valia no fim de dois exercícios. */
export async function compararExercicios(p: Planilhas, quem: Autorizador, anoAntes: number, anoDepois: number): Promise<ComparacaoLida> {
  exigirVerPlano(quem);
  if (!anoValido(anoAntes) || !anoValido(anoDepois)) throw new ErroPrevisao('Ano inválido.');
  const [plano, areas, grupos, itens] = await lerTabelas(p, [PlanoContas, AreasPlano, GruposGasto, ItensContabeis] as const);
  const gravadas: LinhaGravada[] = plano.ativos().map((r) => ({ exercicio: r.exercicio, lote: r.lote, vigencia: r.vigencia, area_id: r.area_id, grupo_id: r.grupo_id, item_id: r.item_id }));
  const a = versaoDoFimDoAno(gravadas, anoAntes);
  const d = versaoDoFimDoAno(gravadas, anoDepois);
  const anos = [...new Set([...gravadas.map((g) => g.exercicio), anoAntes, anoDepois])].sort((x, y) => x - y);
  return {
    anoAntes,
    anoDepois,
    anos,
    semPlano: { antes: !a, depois: !d },
    comparacao: a && d ? compararPlanos(a.linhas, d.linhas) : null,
    areas: mapa(areas.todos()),
    grupos: mapa(grupos.todos()),
    itens: mapa(itens.todos()),
  };
}

export interface LinhaDivergente {
  origem: 'despesa' | 'realizado';
  id: string;
  servico: string;
  servicoNome: string;
  centavos: number;
}

export interface ParDivergenteLido {
  areaPlanoId: string;
  areaPlanoNome: string;
  areaServicoCodigo: string;
  areaServicoNome: string;
  centavos: number;
  quantidade: number;
  /** Vazio para quem vê só totais (Leitura). */
  lancamentos: LinhaDivergente[];
}

export interface DivergenciasLidas {
  ano: number;
  pares: ParDivergenteLido[];
  totalCentavos: number;
  semAreaDoPlano: number;
  /** `false` = só totais (Leitura). */
  comLinhas: boolean;
  /** `true` = só o escopo da pessoa (Coordenação). */
  escopoParcial: boolean;
}

const centavosDe = (v: number) => Math.round(v * 100);

/** Despesas e realizado do exercício cuja Área do plano difere da Área do serviço. */
export async function lerDivergencias(p: Planilhas, quem: Autorizador, ano: number): Promise<DivergenciasLidas> {
  if (!anoValido(ano)) throw new ErroPrevisao('Ano inválido.');
  const veTudo = quem.temPermissao(PERM.editar) || quem.temPermissao(PERM.execucao);
  const veEscopo = !veTudo && quem.temPermissaoAlgumEscopo(PERM.execucao);
  const soTotais = !veTudo && !veEscopo && quem.temPermissao(PERM.ver);
  if (!veTudo && !veEscopo && !soTotais) throw new ErroPermissao();

  const [despesas, realizado, servicos, areasNucleo, areasPlano] = await lerTabelas(p, [Despesas, Realizado, Servicos, Areas, AreasPlano] as const);
  const servicoPorCodigo = new Map(servicos.todos().map((s) => [s.codigo, s]));
  const areaNucleo = new Map(areasNucleo.todos().map((a) => [a.codigo, a]));
  const planoPorId = new Map(areasPlano.todos().map((a) => [a.id, a]));

  // Escopo antes de somar.
  const noEscopo = (servico: string | null) => veTudo || soTotais || (servico !== null && quem.temPermissao(PERM.execucao, { tipo: 'servico', codigo: servico }));

  const lancs: LancamentoParaDivergencia[] = [
    ...despesas.ativos()
      .filter((d) => d.ano === ano && d.situacao === 'aceito' && noEscopo(d.servico))
      .map((d) => ({ origem: 'despesa' as const, id: d.id, servico: d.servico, area_plano_id: d.area_plano_id, centavos: centavosDe(valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario)) })),
    ...realizado.ativos()
      .filter((r) => r.ano === ano && r.tipo === 'despesa' && noEscopo(r.servico))
      .map((r) => ({ origem: 'realizado' as const, id: r.id, servico: r.servico, area_plano_id: r.area_plano_id, centavos: centavosDe(r.valor) })),
  ];

  const coincide = (areaPlanoId: string, codigoArea: string) => {
    const ap = planoPorId.get(areaPlanoId);
    const an = areaNucleo.get(codigoArea);
    if (!ap || !an) return false;
    if (nomeComparavel(ap.nome) === nomeComparavel(an.nome)) return true;
    return Boolean(ap.codigo && chaveCodigoConta(ap.codigo) === chaveCodigoConta(an.codigo));
  };
  const r = divergenciasDeArea(lancs, (s) => (s ? (servicoPorCodigo.get(s)?.area ?? null) : null), coincide);

  return {
    ano,
    pares: r.pares
      .map((x) => ({
        areaPlanoId: x.area_plano_id,
        areaPlanoNome: planoPorId.get(x.area_plano_id)?.nome ?? 'Área',
        areaServicoCodigo: x.area_servico,
        areaServicoNome: areaNucleo.get(x.area_servico)?.nome ?? x.area_servico,
        centavos: x.centavos,
        quantidade: x.lancamentos.length,
        lancamentos: soTotais
          ? []
          : x.lancamentos.map((l) => ({
              origem: l.origem,
              id: l.id,
              servico: l.servico as string,
              servicoNome: servicoPorCodigo.get(l.servico as string)?.nome ?? (l.servico as string),
              centavos: l.centavos,
            })),
      }))
      .sort((a, b) => b.centavos - a.centavos || nomePt({ nome: a.areaPlanoNome }, { nome: b.areaPlanoNome })),
    totalCentavos: r.totalCentavos,
    semAreaDoPlano: r.semAreaDoPlano,
    comLinhas: !soTotais,
    escopoParcial: veEscopo,
  };
}
