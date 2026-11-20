/**
 * Fim do ano (1D.2, regras F1 a F7): quanto sobra ou falta em 31/12 em cinco cenários.
 * Só leitura; quem vê: orcamento.tesouraria.ver. Os valores do realizado vêm de `Realizado`;
 * a Previsão aprovada, de `lerPrevisao` (sem cedidos: cedido não tem dinheiro).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { cenarioPrevisao, cenarioRepetir, folga, pontoDePartida, type Cenario } from '../dominio/fim-do-ano';
import { mesAtualBrasilia } from '../dominio/tesouraria';
import { A_DEFINIR, lerPrevisao } from './previsao';
import { lerBase, mesesComSaldo, saldoLivreMaisReserva, totaisDoMes, type BaseExecucao } from './base-execucao';

const PERM_VER = 'orcamento.tesouraria.ver';
const c = (v: number) => Math.round(v * 100);

/** Previsão aprovada do ano, só a parte que importa para a tesouraria; null = sem previsão aprovada ou sem acesso. */
export interface PrevisaoLivre {
  receitaLivre: number[];
  despesaLivre: number[];
  /** RH e encargos do ano (folha automática e grupos de RH), sem cedidos. */
  rhAnual: number;
  receitaMensal: number[];
  despesaMensal: number[];
}

export async function previsaoDoAno(p: Planilhas, quem: Autorizador, ano: number): Promise<PrevisaoLivre | null> {
  try {
    const prev = await lerPrevisao(p, quem, ano, { incluirCedidos: false });
    if (!prev.exercicio || prev.exercicio.situacao === 'elaboracao') return null;
    const livres = new Set(prev.opcoes.fontes.filter((f) => f.uso === 'livre').map((f) => f.id));
    const soma = (listas: number[][]) => Array.from({ length: 12 }, (_, i) => listas.reduce((t, l) => t + c(l[i] ?? 0), 0) / 100);
    return {
      receitaLivre: soma(prev.receitas.filter((r) => livres.has(r.fonte_id)).map((r) => r.meses)),
      despesaLivre: soma(prev.totais.despesaPorFonte.filter((g) => g.chave !== A_DEFINIR && livres.has(g.chave)).map((g) => g.mensal)),
      rhAnual: prev.totais.rh,
      receitaMensal: prev.totais.receita.mensal,
      despesaMensal: prev.totais.despesa.mensal,
    };
  } catch (e) {
    if (e instanceof ErroPermissao) return null;
    throw e;
  }
}

export interface LinhaCenario extends Cenario {
  id: 'ano1_com' | 'ano1_sem' | 'ano2_com' | 'ano2_sem' | 'previsao';
  rotulo: string;
  folga: number | null;
}

export interface SerieDeAno {
  ano: number;
  parcial: boolean;
  /** Livre disponível + reserva no fim de cada mês; null = mês sem saldo (buraco, nunca zero). */
  valores: (number | null)[];
}

export interface FimDoAno {
  ano: number;
  /** Último mês do ano com saldo; null = sem nenhum saldo no ano. */
  partida: string | null;
  saldoPartida: number | null;
  reservaAtual: number | null;
  cenarios: LinhaCenario[];
  /** F6: o cenário que alimenta o sinal "Fim do ano". */
  folgaDoSinal: number | null;
  series: SerieDeAno[];
}

/** Calcula o fim do ano sobre a base já lida (também usada pela Visão geral). */
export function calcularFimDoAno(b: BaseExecucao, previsao: PrevisaoLivre | null, agora: Date = new Date()): FimDoAno {
  const atual = mesAtualBrasilia(agora);
  const ano = Number(atual.slice(0, 4));
  const partida = pontoDePartida(mesesComSaldo(b, ['livre_disponivel', 'reserva']), ano);
  const saldoPartida = partida ? saldoLivreMaisReserva(b, partida) : null;
  const reservaAtual = partida ? totaisDoMes(b, partida).reserva : null;
  const informados = (a: number) => new Set(b.realizado.filter((r) => r.mes.startsWith(`${a}-`)).map((r) => r.mes));
  const livres = b.realizado
    .filter((r) => b.fontesLivres.has(r.fonte_id))
    .map((r) => ({ mes: r.mes, tipo: r.tipo, valor: r.valor, naoRecorrente: r.nao_recorrente }));

  const cenarios: LinhaCenario[] = [];
  const sem = (id: LinhaCenario['id'], rotulo: string, motivo: string): LinhaCenario => ({ id, rotulo, saldoDezembro: null, faltam: [], motivo, folga: null });
  for (const [k, ref] of [[1, ano - 1], [2, ano - 2]] as const) {
    for (const com of [true, false]) {
      const id = `ano${k}_${com ? 'com' : 'sem'}` as LinhaCenario['id'];
      const rotulo = `Repetir ${ref}, ${com ? 'com' : 'sem'} não recorrentes`;
      if (partida === null || saldoPartida === null) {
        cenarios.push(sem(id, rotulo, 'Informe os saldos do mês'));
        continue;
      }
      const r = cenarioRepetir({ saldoPartida, partida, anoReferencia: ref, linhasLivres: livres, mesesInformados: informados(ref), comNaoRecorrentes: com });
      cenarios.push({ ...r, id, rotulo, folga: folga(r.saldoDezembro, reservaAtual ?? 0) });
    }
  }
  const rotuloPrevisao = `Pela Previsão de ${ano}`;
  if (partida === null || saldoPartida === null) cenarios.push(sem('previsao', rotuloPrevisao, 'Informe os saldos do mês'));
  else if (!previsao) cenarios.push(sem('previsao', rotuloPrevisao, `A Previsão de ${ano} ainda não está aprovada`));
  else {
    const r = cenarioPrevisao({ saldoPartida, partida, receitaLivre: previsao.receitaLivre, despesaLivre: previsao.despesaLivre });
    cenarios.push({ ...r, id: 'previsao', rotulo: rotuloPrevisao, folga: folga(r.saldoDezembro, reservaAtual ?? 0) });
  }

  const series: SerieDeAno[] = [ano, ano - 1, ano - 2].map((a) => ({
    ano: a,
    parcial: a === ano,
    valores: Array.from({ length: 12 }, (_, i) => saldoLivreMaisReserva(b, `${a}-${String(i + 1).padStart(2, '0')}`)),
  }));
  return {
    ano,
    partida,
    saldoPartida,
    reservaAtual,
    cenarios,
    folgaDoSinal: cenarios.find((x) => x.id === 'ano1_com')?.folga ?? null,
    series,
  };
}

export async function lerFimDoAno(p: Planilhas, quem: Autorizador, agora: Date = new Date()): Promise<FimDoAno> {
  if (!quem.temPermissao(PERM_VER)) throw new ErroPermissao();
  const ano = Number(mesAtualBrasilia(agora).slice(0, 4));
  const [b, previsao] = await Promise.all([lerBase(p), previsaoDoAno(p, quem, ano)]);
  return calcularFimDoAno(b, previsao, agora);
}
