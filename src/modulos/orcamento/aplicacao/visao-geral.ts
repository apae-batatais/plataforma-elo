/**
 * Visão geral (1D.2, regra 22 e S1 a S10): seis sinais (ok, atenção, crítico) e as pendências, numa tela só.
 *
 * Quem vê: Diretoria e Financeiro veem os seis; quem só tem orcamento.painel.ver (Leitura) vê apenas os três
 * que não dependem de saldo (execução, folha sobre a receita e gasto com recurso livre). Coordenação não vê.
 * Só leitura; nada é guardado: tudo é calculado do realizado, dos saldos e da Previsão aprovada.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { PoliticaReserva, UsosReserva } from '../dados/tabelas';
import {
  classificarExecucao, classificarFimDoAno, classificarFolha, classificarGasto, classificarLivre, classificarReserva, desatualizado,
  mesesDeLivre, minimoDaReserva, ordenarSinais, percentualDoMinimo, pontosDeGasto, recomposicaoVencida, type Faixas, type SituacaoSinal,
} from '../dominio/reserva';
import { contasSemSaldo, mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { mesesComDiferenca } from './conferencia';
import { calcularFimDoAno, previsaoDoAno, type PrevisaoLivre } from './fim-do-ano';
import { faixasEmVigor } from './reserva';
import { lerBase, mesesComRealizado, mesesComSaldo, totaisDoMes, type BaseExecucao } from './base-execucao';

const PERM = { saldos: 'orcamento.tesouraria.ver', painel: 'orcamento.painel.ver', realizado: 'orcamento.realizado.editar' } as const;
const c = (v: number) => Math.round(v * 100);
const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const rs = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export type ChaveSinal = 'livre' | 'fim' | 'execucao' | 'folha' | 'gasto' | 'reserva';

export interface Sinal {
  chave: ChaveSinal;
  nome: string;
  situacao: SituacaoSinal;
  /** null = sem dado. */
  valor: number | null;
  unidade: 'meses' | 'moeda' | 'percentual' | 'pontos';
  /** A regra em uma linha, com as faixas em vigor. */
  regra: string;
  /** De que dado veio e até quando (S10). */
  dado: string | null;
  /** Por que não há dado, quando é o caso. */
  motivo: string | null;
  desatualizado: boolean;
  /** Calculado sobre o previsto, não sobre o realizado. */
  previsto: boolean;
  /** As faixas ainda não foram aprovadas (valem as de fábrica). */
  faixaProposta: boolean;
  href: string;
}

export interface Pendencia {
  texto: string;
  href: string;
  acao: string;
}

export interface VisaoGeral {
  mesAtual: string;
  sinais: Sinal[];
  pendencias: Pendencia[];
  faixasAprovadas: boolean;
  /** Sem saldos e sem realizado: a tela explica o que informar. */
  vazia: boolean;
  podeVerSaldos: boolean;
  podeInformarRealizado: boolean;
}

const nomeDoMes = (mes: string) => ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(mes.slice(5)) - 1];
const ate = (rotulo: string, mes: string | null) => (mes ? `${rotulo} até ${nomeDoMes(mes)}` : null);

/** Monta os sinais sobre os dados já lidos. `verSaldos` falso omite os três sinais de saldo (S8). */
export function montarSinais(e: {
  b: BaseExecucao;
  previsao: PrevisaoLivre | null;
  faixas: Faixas;
  faixasAprovadas: boolean;
  verSaldos: boolean;
  agora: Date;
}): Sinal[] {
  const { b, previsao, faixas, faixasAprovadas, verSaldos } = e;
  const atual = mesAtualBrasilia(e.agora);
  const ano = Number(atual.slice(0, 4));
  const informados = [...mesesComRealizado(b)].filter((m) => m.startsWith(`${ano}-`) && m <= atual).sort();
  const ultimoRealizado = informados.at(-1) ?? null;
  const base = { faixaProposta: !faixasAprovadas, previsto: false, motivo: null as string | null };
  const sinais: Sinal[] = [];
  const livresDoAno = (a: number, meses?: Set<string>, semNaoRecorrente = false) => {
    let receita = 0;
    let despesa = 0;
    for (const r of b.realizado) {
      if (!r.mes.startsWith(`${a}-`) || !b.fontesLivres.has(r.fonte_id)) continue;
      if (meses && !meses.has(r.mes.slice(5))) continue;
      if (semNaoRecorrente && r.nao_recorrente) continue;
      if (r.tipo === 'receita') receita += c(r.valor);
      else despesa += c(r.valor);
    }
    return { receita: receita / 100, despesa: despesa / 100 };
  };

  // S2 Livre disponível ------------------------------------------------------------------
  if (verSaldos) {
    const mesLivre = mesesComSaldo(b, ['livre_disponivel']).filter((m) => m <= atual).at(-1) ?? null;
    const saldo = mesLivre ? totaisDoMes(b, mesLivre).livre_disponivel : null;
    const despesaLivre = livresDoAno(ano).despesa;
    const valor = mesesDeLivre(saldo, despesaLivre, informados.length);
    sinais.push({
      ...base,
      chave: 'livre',
      nome: 'Livre disponível',
      unidade: 'meses',
      valor,
      situacao: classificarLivre(valor, faixas),
      regra: `Saldo livre ÷ gasto médio mensal com recurso livre. Ok: ${um(faixas.livre_ok)} meses ou mais; atenção: de ${um(faixas.livre_atencao)} a ${um(faixas.livre_ok)}; crítico: menos de ${um(faixas.livre_atencao)}.`,
      dado: [ate('saldos', mesLivre), ate('realizado', ultimoRealizado)].filter(Boolean).join(' · ') || null,
      motivo: valor === null ? (saldo === null ? 'Informe os saldos do mês' : 'Informe o realizado do mês') : null,
      desatualizado: desatualizado(mesLivre, atual) || desatualizado(ultimoRealizado, atual),
      href: '/orcamento/tesouraria',
    });

    // S3 Fim do ano ----------------------------------------------------------------------
    const fim = calcularFimDoAno(b, previsao, e.agora);
    sinais.push({
      ...base,
      chave: 'fim',
      nome: 'Fim do ano',
      unidade: 'moeda',
      valor: fim.folgaDoSinal,
      situacao: classificarFimDoAno(fim.folgaDoSinal, faixas),
      regra: `Folga em dezembro se o ano anterior se repetir, com não recorrentes. Ok: ${rs(faixas.fim_ok)} ou mais; atenção: de zero a ${rs(faixas.fim_ok)}; crítico: abaixo de zero.`,
      dado: ate('saldos', fim.partida),
      motivo: fim.folgaDoSinal === null ? (fim.partida === null ? 'Informe os saldos do mês' : `Falta o realizado de ${ano - 1} nos meses que restam`) : null,
      desatualizado: desatualizado(fim.partida, atual),
      href: '/orcamento/tesouraria/fim-do-ano',
    });
  }

  // S4 Execução --------------------------------------------------------------------------
  {
    let valor: number | null = null;
    let receitaPrevista = 0;
    if (ultimoRealizado && previsao) {
      const n = Number(ultimoRealizado.slice(5));
      let receita = 0;
      let despesa = 0;
      for (const r of b.realizado) {
        if (!r.mes.startsWith(`${ano}-`) || r.mes > ultimoRealizado) continue;
        if (r.tipo === 'receita') receita += c(r.valor);
        else despesa += c(r.valor);
      }
      const prevR = previsao.receitaMensal.slice(0, n).reduce((t, v) => t + c(v), 0);
      const prevD = previsao.despesaMensal.slice(0, n).reduce((t, v) => t + c(v), 0);
      valor = (receita - despesa - (prevR - prevD)) / 100;
      receitaPrevista = prevR / 100;
    }
    sinais.push({
      ...base,
      chave: 'execucao',
      nome: 'Execução',
      unidade: 'moeda',
      valor,
      situacao: classificarExecucao(valor, receitaPrevista, faixas),
      regra: `Resultado realizado − resultado previsto até o último mês informado. Ok: zero ou mais; atenção: até −${um(faixas.exec_atencao)}% da receita prevista; crítico: abaixo disso.`,
      dado: ate('realizado', ultimoRealizado),
      motivo: valor === null ? (!ultimoRealizado ? 'Informe o realizado do mês' : 'A Previsão do ano ainda não está aprovada') : null,
      desatualizado: desatualizado(ultimoRealizado, atual),
      href: '/orcamento/execucao',
    });
  }

  // S5 Folha sobre a receita -------------------------------------------------------------
  {
    let pct: number | null = null;
    let previstoMarca = false;
    if (ultimoRealizado) {
      let rh = 0;
      let receita = 0;
      for (const r of b.realizado) {
        if (!r.mes.startsWith(`${ano}-`) || r.mes > ultimoRealizado) continue;
        if (r.tipo === 'receita') receita += c(r.valor);
        else if (r.natureza === 'rh' || r.natureza === 'encargos') rh += c(r.valor);
      }
      pct = receita > 0 ? Math.round((rh / receita) * 1000) / 10 : null;
    }
    if (pct === null && previsao) {
      const receita = previsao.receitaMensal.reduce((t, v) => t + c(v), 0);
      pct = receita > 0 ? Math.round((c(previsao.rhAnual) / receita) * 1000) / 10 : null;
      previstoMarca = pct !== null;
    }
    sinais.push({
      ...base,
      chave: 'folha',
      nome: 'Folha sobre a receita',
      unidade: 'percentual',
      valor: pct,
      situacao: classificarFolha(pct, faixas),
      regra: `RH e encargos ÷ receita no ano. Ok: até ${um(faixas.folha_ok)}%; atenção: até ${um(faixas.folha_atencao)}%; crítico: acima disso.`,
      dado: previstoMarca ? 'previsto do ano' : ate('realizado', ultimoRealizado),
      motivo: pct === null ? 'Informe o realizado do mês' : null,
      desatualizado: !previstoMarca && desatualizado(ultimoRealizado, atual),
      previsto: previstoMarca,
      href: ultimoRealizado && !previstoMarca ? '/orcamento/execucao' : '/orcamento/previsao',
    });
  }

  // S6 Gasto com recurso livre -----------------------------------------------------------
  {
    const doAnoAnterior = new Set(b.realizado.filter((r) => r.mes.startsWith(`${ano - 1}-`)).map((r) => r.mes.slice(5)));
    const nosDois = new Set(informados.map((m) => m.slice(5)).filter((m) => doAnoAnterior.has(m)));
    let valor: number | null = null;
    if (nosDois.size > 0) {
      const a = livresDoAno(ano, nosDois, true);
      const ant = livresDoAno(ano - 1, nosDois, true);
      valor = pontosDeGasto(a.despesa, ant.despesa, a.receita, ant.receita);
    }
    sinais.push({
      ...base,
      chave: 'gasto',
      nome: 'Gasto com recurso livre',
      unidade: 'pontos',
      valor,
      situacao: classificarGasto(valor, faixas),
      regra: `Variação do gasto livre − variação da receita livre recorrente, contra o mesmo período do ano anterior. Ok: até ${um(faixas.gasto_ok)} pontos; atenção: até ${um(faixas.gasto_atencao)}; crítico: acima disso.`,
      dado: ate('realizado', ultimoRealizado),
      motivo: valor === null ? 'Falta realizado dos mesmos meses do ano anterior' : null,
      desatualizado: desatualizado(ultimoRealizado, atual),
      href: '/orcamento/execucao',
    });
  }

  // S7 Reserva ---------------------------------------------------------------------------
  if (verSaldos) {
    const mesReserva = mesesComSaldo(b, ['reserva']).filter((m) => m <= atual).at(-1) ?? null;
    const reserva = mesReserva ? totaisDoMes(b, mesReserva).reserva : null;
    const minimo = faixasAprovadas && previsao ? minimoDaReserva(previsao.rhAnual, faixas.meses_minimo) : null;
    const pct = reserva !== null && minimo !== null ? percentualDoMinimo(reserva, minimo) : null;
    sinais.push({
      ...base,
      chave: 'reserva',
      nome: 'Reserva',
      unidade: 'percentual',
      valor: pct,
      situacao: classificarReserva(pct, faixas),
      regra: `Saldo da reserva ÷ mínimo aprovado (${faixas.meses_minimo} meses de folha). Ok: ${um(faixas.reserva_ok)}% ou mais; atenção: de ${um(faixas.reserva_atencao)}% a ${um(faixas.reserva_ok)}%; crítico: abaixo de ${um(faixas.reserva_atencao)}%.`,
      dado: ate('saldos', mesReserva),
      motivo: !faixasAprovadas ? 'Sem política aprovada' : reserva === null ? 'Informe os saldos do mês' : !previsao ? 'A Previsão do ano ainda não está aprovada' : null,
      desatualizado: desatualizado(mesReserva, atual),
      faixaProposta: false,
      href: '/orcamento/tesouraria/reserva',
    });
  }
  return ordenarSinais(sinais);
}

export async function lerVisaoGeral(p: Planilhas, quem: Autorizador, agora: Date = new Date()): Promise<VisaoGeral> {
  const verSaldos = quem.temPermissao(PERM.saldos);
  if (!verSaldos && !quem.temPermissao(PERM.painel)) throw new ErroPermissao();
  const atual = mesAtualBrasilia(agora);
  const ano = Number(atual.slice(0, 4));
  const b = await lerBase(p);
  const [politicaT, usosT] = await lerTabelas(p, [PoliticaReserva, UsosReserva] as const);
  const previsao = await previsaoDoAno(p, quem, ano);
  const { faixas, aprovada } = faixasEmVigor(politicaT.todos(), atual);
  const sinais = montarSinais({ b, previsao, faixas, faixasAprovadas: aprovada, verSaldos, agora });

  const pendencias: Pendencia[] = [];
  const podeInformarRealizado = quem.temPermissao(PERM.realizado);
  const fechado = mesAnterior(atual);
  if (verSaldos) {
    const semSaldo = contasSemSaldo(b.contas.filter((x) => x.ativo), b.saldos, fechado).length;
    if (semSaldo > 0) {
      pendencias.push({ texto: `${semSaldo} ${semSaldo === 1 ? 'conta sem saldo' : 'contas sem saldo'} em ${nomeDoMes(fechado)}`, href: `/orcamento/tesouraria?mes=${fechado}`, acao: 'Informar saldos' });
    }
    const dif = mesesComDiferenca(b, agora);
    if (dif.length > 0) {
      pendencias.push({ texto: `${dif.length} ${dif.length === 1 ? 'mês com diferença' : 'meses com diferença'} na conferência`, href: `/orcamento/tesouraria/conferencia?mes=${dif[0]}`, acao: 'Conferir' });
    }
  }
  if (podeInformarRealizado && !mesesComRealizado(b).has(fechado)) {
    pendencias.push({ texto: `Falta informar o realizado de ${nomeDoMes(fechado)}`, href: `/orcamento/execucao/realizado?mes=${fechado}`, acao: 'Informar realizado' });
  }
  if (verSaldos && usosT.ativos().some((u) => recomposicaoVencida(u, atual))) {
    pendencias.push({ texto: 'Recomposição da reserva vencida', href: '/orcamento/tesouraria/reserva', acao: 'Ver a reserva' });
  }
  return {
    mesAtual: atual,
    sinais,
    pendencias,
    faixasAprovadas: aprovada,
    vazia: b.saldos.length === 0 && b.realizado.length === 0,
    podeVerSaldos: verSaldos,
    podeInformarRealizado,
  };
}
