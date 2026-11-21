/**
 * Painel de Educação: só números agregados, por serviço e período (regra 18).
 * Cada pessoa conta uma vez, pela aplicação fechada (e não corrigida) mais recente do período.
 * Todo número sobre pessoas passa por `numeroAgregado` (mínimo de 5 pessoas); nada aqui traz nome, iniciais ou id.
 */
import { calcularEscore, dominiosDeMenorPercentual, type Escore } from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { numeroAgregado, type NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { INSTRUMENTOS_EDUCACAO } from '../dados/instrumentos';
import { carregar, instrumentoDaAplicacao, PERM } from './avaliacoes';

const MES = /^\d{4}-\d{2}$/;
const arredonda = (n: number, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// Os três instrumentos têm as mesmas dimensões, o mesmo máximo e as mesmas faixas.
const MODELO = INSTRUMENTOS_EDUCACAO[0]!;
const MAXIMO = MODELO.itens.length * 3;

export interface FiltroPainelEducacao {
  /** Código do serviço; vazio = todos os do seu escopo. */
  servico?: string;
  /** Mês inicial e final (`AAAA-MM`), pelo fim do período avaliado. */
  de?: string;
  ate?: string;
}

/** Uma pessoa no painel: só o que entra na conta (sem identificação). */
export interface PontoDoPainel {
  servico: string;
  escore: Pick<Escore, 'total' | 'maximo' | 'dominios' | 'enquadramento'>;
}

export interface ResumoDeFaixas {
  /** Da melhor para a pior faixa; nulo quando há poucos casos. */
  faixas: { nome: string; pessoas: NumeroAgregado; percentual: NumeroAgregado }[];
}

export interface ResumoPorServico extends ResumoDeFaixas {
  servico: string;
  nome: string;
  pessoas: NumeroAgregado;
}

export interface PainelDeEducacao extends ResumoDeFaixas {
  pessoas: NumeroAgregado;
  totalMedio: NumeroAgregado;
  maximo: number;
  percentualEvoluindo: NumeroAgregado;
  /** Subtotal médio de cada dimensão, em % do máximo dela. */
  dimensoes: { codigo: string; nome: string; percentualMedio: NumeroAgregado }[];
  /** Dimensão de menor média (só com mínimo de pessoas); empate lista todas. */
  principalBarreira: string[];
  /** Quantas pessoas têm cada dimensão como a de menor pontuação (empate conta nas duas). */
  pessoasPorPrincipalBarreira: { nome: string; pessoas: NumeroAgregado }[];
  porServico: ResumoPorServico[];
  servicosDisponiveis: { codigo: string; nome: string }[];
  /** `true` quando a pessoa vê todos os serviços (Diretoria). */
  todos: boolean;
}

/** Regras puras do painel: recebe um ponto por pessoa e devolve os agregados protegidos. */
export function resumirPainel(
  pontos: PontoDoPainel[],
  nomesDeServico: Map<string, string>,
): Omit<PainelDeEducacao, 'servicosDisponiveis' | 'todos'> {
  const nomesFaixas = MODELO.faixas.map((f) => f.nome).reverse(); // da melhor para a pior
  const faixasDe = (lista: PontoDoPainel[]): ResumoDeFaixas['faixas'] =>
    nomesFaixas.map((nome) => {
      const n = lista.filter((x) => x.escore.enquadramento?.nome === nome).length;
      return {
        nome,
        pessoas: numeroAgregado({ valor: n, base: lista.length, tipo: 'contagem' }),
        percentual: numeroAgregado({ valor: lista.length ? arredonda((n / lista.length) * 100) : null, base: lista.length, tipo: 'percentual' }),
      };
    });
  const base = pontos.length;
  const mediaTotal = media(pontos.map((x) => x.escore.total));
  const evoluindo = pontos.filter((x) => x.escore.enquadramento?.nome === nomesFaixas[0]).length;
  const dimensoes = MODELO.dominios.map((d) => {
    const percentuais = pontos.map((x) => x.escore.dominios.find((e) => e.codigo === d.codigo)?.percentual).filter((v): v is number => typeof v === 'number');
    const m = media(percentuais);
    return { codigo: d.codigo, nome: d.nome, percentualMedio: numeroAgregado({ valor: m === null ? null : arredonda(m), base, tipo: 'media' }) };
  });
  const visiveis = dimensoes.filter((d) => d.percentualMedio.valor !== null);
  const menor = visiveis.length ? Math.min(...visiveis.map((d) => d.percentualMedio.valor!)) : null;
  const servicos = [...new Set(pontos.map((x) => x.servico))].sort((a, b) => (nomesDeServico.get(a) ?? a).localeCompare(nomesDeServico.get(b) ?? b, 'pt-BR'));
  return {
    pessoas: numeroAgregado({ valor: base, base, tipo: 'contagem' }),
    totalMedio: numeroAgregado({ valor: mediaTotal === null ? null : arredonda(mediaTotal), base, tipo: 'media' }),
    maximo: MAXIMO,
    percentualEvoluindo: numeroAgregado({ valor: base ? arredonda((evoluindo / base) * 100) : null, base, tipo: 'percentual' }),
    faixas: faixasDe(pontos),
    dimensoes,
    principalBarreira: menor === null ? [] : visiveis.filter((d) => d.percentualMedio.valor === menor).map((d) => d.nome),
    pessoasPorPrincipalBarreira: MODELO.dominios.map((d) => {
      const n = pontos.filter((x) => dominiosDeMenorPercentual(x.escore as Escore).some((e) => e.codigo === d.codigo)).length;
      return { nome: d.nome, pessoas: numeroAgregado({ valor: n, base, tipo: 'contagem' }) };
    }),
    porServico: servicos.map((s) => {
      const doServico = pontos.filter((x) => x.servico === s);
      return { servico: s, nome: nomesDeServico.get(s) ?? s, pessoas: numeroAgregado({ valor: doServico.length, base: doServico.length, tipo: 'contagem' }), faixas: faixasDe(doServico) };
    }),
  };
}

/**
 * Números agregados dos serviços de Educação que a pessoa acompanha (`educacao.painel`).
 * Não depende de ver cada pessoa: o painel nunca identifica ninguém.
 */
export async function painelDeEducacao(p: Planilhas, quem: Autorizador, filtro: FiltroPainelEducacao = {}, opcoes: { agora?: Date } = {}): Promise<PainelDeEducacao> {
  if (!quem.temPermissaoAlgumEscopo(PERM.painel)) throw new ErroPermissao();
  const b = await carregar(p, opcoes.agora ?? new Date());
  const nomes = new Map(b.servicos.todos().map((s) => [s.codigo, s.nome]));
  const todas = b.aplicacoes.ativos().filter((a) => quem.temPermissao(PERM.painel, { tipo: 'servico', codigo: a.servico }));
  const servicosDisponiveis = [...new Set(todas.map((a) => a.servico))]
    .map((codigo) => ({ codigo, nome: nomes.get(codigo) ?? codigo }))
    .sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR'));
  const corrigidas = new Set(todas.filter((a) => a.corrige && a.situacao === 'fechada').map((a) => a.corrige!));
  const de = filtro.de && MES.test(filtro.de) ? filtro.de : '';
  const ate = filtro.ate && MES.test(filtro.ate) ? filtro.ate : '';
  const noFiltro = todas
    .filter((a) => a.situacao === 'fechada' && !corrigidas.has(a.id))
    .filter((a) => !filtro.servico || a.servico === filtro.servico)
    .filter((a) => (!de || a.periodo_fim!.slice(0, 7) >= de) && (!ate || a.periodo_fim!.slice(0, 7) <= ate))
    .sort((a, c) => c.periodo_fim!.localeCompare(a.periodo_fim!) || (c.data_assinatura ?? '').localeCompare(a.data_assinatura ?? ''));
  // Mais recente de cada pessoa (a ordem acima já a coloca primeiro).
  const unicas = new Map<string, (typeof noFiltro)[number]>();
  for (const a of noFiltro) if (!unicas.has(a.pessoa_id)) unicas.set(a.pessoa_id, a);
  const ativas = b.respostas.ativos();
  const pontos: PontoDoPainel[] = [];
  for (const a of unicas.values()) {
    const notas: Record<number, number> = {};
    for (const l of ativas) if (l.aplicacao_id === a.id) notas[l.item] = l.valor;
    const escore = calcularEscore(instrumentoDaAplicacao(b, a), notas);
    if (escore.completo) pontos.push({ servico: a.servico, escore });
  }
  return { ...resumirPainel(pontos, new Map(servicosDisponiveis.map((s) => [s.codigo, s.nome]))), servicosDisponiveis, todos: quem.temPermissao(PERM.painel) };
}
