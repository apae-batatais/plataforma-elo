/**
 * Painel de Saúde: só números agregados, por serviço e período (regra 17).
 * Cada pessoa conta uma vez, pela aplicação fechada (e não corrigida) mais recente do período.
 * Todo número sobre pessoas passa por `numeroAgregado` (mínimo de 5 pessoas); nada aqui traz nome, iniciais ou id.
 */
import { calcularEscore, type Escore } from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { numeroAgregado, type NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { Aplicacoes, Instrumentos, Respostas } from '../dados/tabelas';
import { CODIGO_CER, INSTRUMENTO_CER } from '../dominio/cer';
import { instrumentosDoCer, PERM } from './avaliacoes';

const MES = /^\d{4}-\d{2}$/;
const arredonda = (n: number, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;

export interface FiltroPainelSaude {
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
  /** Nome da faixa e % das pessoas nela (nulo quando há poucos casos). */
  faixas: { nome: string; pessoas: NumeroAgregado; percentual: NumeroAgregado }[];
}

export interface ResumoPorServico extends ResumoDeFaixas {
  servico: string;
  nome: string;
  pessoas: NumeroAgregado;
}

export interface PainelDeSaude extends ResumoDeFaixas {
  pessoas: NumeroAgregado;
  totalMedio: NumeroAgregado;
  maximo: number;
  percentualEvoluindo: NumeroAgregado;
  /** Subtotal médio de cada dimensão, em % do máximo dela. */
  dimensoes: { codigo: string; nome: string; percentualMedio: NumeroAgregado }[];
  /** Dimensão de menor média (só com mínimo de pessoas); empate lista todas. */
  principalBarreira: string[];
  porServico: ResumoPorServico[];
  servicosDisponiveis: { codigo: string; nome: string }[];
  /** `true` quando a pessoa vê todos os serviços (Diretoria). */
  todos: boolean;
}

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Regras puras do painel: recebe um ponto por pessoa e devolve os agregados protegidos. */
export function resumirPainel(
  pontos: PontoDoPainel[],
  nomesDeServico: Map<string, string>,
): Omit<PainelDeSaude, 'servicosDisponiveis' | 'todos'> {
  const nomesFaixas = INSTRUMENTO_CER.faixas.map((f) => f.nome).reverse(); // da melhor para a pior
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
  const codigos = INSTRUMENTO_CER.dominios;
  const dimensoes = codigos.map((d) => {
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
    maximo: INSTRUMENTO_CER.itens.length * 3,
    percentualEvoluindo: numeroAgregado({ valor: base ? arredonda((evoluindo / base) * 100) : null, base, tipo: 'percentual' }),
    faixas: faixasDe(pontos),
    dimensoes,
    principalBarreira: menor === null ? [] : visiveis.filter((d) => d.percentualMedio.valor === menor).map((d) => d.nome),
    porServico: servicos.map((s) => {
      const doServico = pontos.filter((x) => x.servico === s);
      return { servico: s, nome: nomesDeServico.get(s) ?? s, pessoas: numeroAgregado({ valor: doServico.length, base: doServico.length, tipo: 'contagem' }), faixas: faixasDe(doServico) };
    }),
  };
}

/**
 * Números agregados dos serviços de Saúde que a pessoa acompanha (`saude.painel`).
 * Não depende de ver cada pessoa: o painel nunca identifica ninguém.
 */
export async function painelDeSaude(p: Planilhas, quem: Autorizador, filtro: FiltroPainelSaude = {}): Promise<PainelDeSaude> {
  if (!quem.temPermissaoAlgumEscopo(PERM.painel)) throw new ErroPermissao();
  const [aplicacoes, respostas] = await lerTabelas(p, [Aplicacoes, Respostas, Instrumentos] as const);
  const { porVersao } = await instrumentosDoCer(p);
  const todas = aplicacoes.ativos().filter((a) => a.instrumento === CODIGO_CER && quem.temPermissao(PERM.painel, { tipo: 'servico', codigo: a.servico }));
  const servicosDisponiveis = [...new Map(todas.map((a) => [a.servico, a.servico_nome])).entries()]
    .map(([codigo, nome]) => ({ codigo, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const corrigidas = new Set(todas.map((a) => a.corrige).filter((x): x is string => !!x));
  const de = filtro.de && MES.test(filtro.de) ? filtro.de : '';
  const ate = filtro.ate && MES.test(filtro.ate) ? filtro.ate : '';
  const noFiltro = todas
    .filter((a) => a.situacao === 'fechada' && !corrigidas.has(a.id))
    .filter((a) => !filtro.servico || a.servico === filtro.servico)
    .filter((a) => (!de || a.periodo_fim.slice(0, 7) >= de) && (!ate || a.periodo_fim.slice(0, 7) <= ate))
    .sort((a, b) => b.periodo_fim.localeCompare(a.periodo_fim) || (b.data_assinatura ?? '').localeCompare(a.data_assinatura ?? ''));
  // Mais recente de cada pessoa (a ordem acima já a coloca primeiro).
  const unicas = new Map<string, (typeof noFiltro)[number]>();
  for (const a of noFiltro) if (!unicas.has(a.pessoa_id)) unicas.set(a.pessoa_id, a);
  const ativas = respostas.ativos();
  const pontos: PontoDoPainel[] = [];
  for (const a of unicas.values()) {
    const inst = porVersao.get(a.versao_instrumento);
    if (!inst) continue;
    const notas: Record<number, number> = {};
    for (const l of ativas) if (l.aplicacao_id === a.id) notas[l.item] = l.valor;
    const escore = calcularEscore(inst, notas);
    if (escore.completo) pontos.push({ servico: a.servico, escore });
  }
  const nomes = new Map(servicosDisponiveis.map((s) => [s.codigo, s.nome]));
  return { ...resumirPainel(pontos, nomes), servicosDisponiveis, todos: quem.temPermissao(PERM.painel) };
}
