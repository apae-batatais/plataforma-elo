/**
 * Conferência dos termos e do recurso livre (1D.2, regras C1 a C8). Só leitura; quem vê: orcamento.tesouraria.ver
 * (Diretoria e Financeiro). O Elo não corrige nada nem aceita justificativa digitada.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { conferirRecursoLivre, conferirTermo, type ResultadoConferencia } from '../dominio/conferencia';
import { mesAnterior, mesAtualBrasilia, mesValido } from '../dominio/tesouraria';
import { ErroTesouraria } from './tesouraria';
import { classeDaContaNoMes, fonteDaContaNoMes, lerBase, mesesComRealizado, resultadoDoMes, saldoDaConta, saldoLivreMaisReserva, type BaseExecucao } from './base-execucao';

const PERM_VER = 'orcamento.tesouraria.ver';

export interface LinhaTermo extends ResultadoConferencia {
  fonteId: string;
  fonteNome: string;
  /** Contas vinculadas da mesma fonte, somadas (C4). */
  contas: string[];
  saldoMes: number | null;
  saldoAnterior: number | null;
  entradas: number;
  saidas: number;
}

export interface LinhaRecursoLivre extends ResultadoConferencia {
  saldoMes: number | null;
  saldoAnterior: number | null;
  variacao: number | null;
  resultadoLivre: number;
}

export interface ConferenciaDoMes {
  mes: string;
  mesAtual: string;
  termos: LinhaTermo[];
  recursoLivre: LinhaRecursoLivre;
}

const nomeConta = (c: { banco: string; conta: string | null }) => [c.banco, c.conta].filter(Boolean).join(' ');

/** Conferência de um mês sobre a base já lida (também usada pela Visão geral). */
export function conferirMes(b: BaseExecucao, mes: string): Omit<ConferenciaDoMes, 'mesAtual'> {
  const anterior = mesAnterior(mes);
  const realizadoInformado = mesesComRealizado(b).has(mes);
  const vinculadas = b.contas.filter((conta) => {
    if (classeDaContaNoMes(b, conta, mes) !== 'vinculada') return false;
    return conta.ativo || saldoDaConta(b, conta.id, mes) !== null;
  });
  const porFonte = new Map<string, typeof vinculadas>();
  for (const conta of vinculadas) {
    const fonteId = fonteDaContaNoMes(b, conta, mes);
    if (!fonteId) continue;
    porFonte.set(fonteId, [...(porFonte.get(fonteId) ?? []), conta]);
  }
  const termos: LinhaTermo[] = [...porFonte.entries()]
    .map(([fonteId, contas]) => {
      const soma = (m: string) => {
        const valores = contas.map((x) => saldoDaConta(b, x.id, m));
        return valores.some((v) => v === null) ? null : valores.reduce<number>((t, v) => t + Math.round((v as number) * 100), 0) / 100;
      };
      const saldoMes = soma(mes);
      const saldoAnterior = soma(anterior);
      const { receita, despesa } = resultadoDoMes(b, mes, (id) => id === fonteId);
      const r = conferirTermo({ mes, saldoMes, saldoAnterior, receita, despesa, realizadoInformado });
      return { ...r, fonteId, fonteNome: b.nomeFonte.get(fonteId) ?? '?', contas: contas.map(nomeConta), saldoMes, saldoAnterior };
    })
    .sort((x, y) => x.fonteNome.localeCompare(y.fonteNome, 'pt-BR'));
  const livre = resultadoDoMes(b, mes, (id) => b.fontesLivres.has(id));
  const recursoLivre = {
    ...conferirRecursoLivre({
      mes,
      saldoMes: saldoLivreMaisReserva(b, mes),
      saldoAnterior: saldoLivreMaisReserva(b, anterior),
      receitaLivre: livre.receita,
      despesaLivre: livre.despesa,
      realizadoInformado,
    }),
    saldoMes: saldoLivreMaisReserva(b, mes),
    saldoAnterior: saldoLivreMaisReserva(b, anterior),
  };
  return { mes, termos, recursoLivre };
}

export async function lerConferencia(p: Planilhas, quem: Autorizador, mes: string, agora: Date = new Date()): Promise<ConferenciaDoMes> {
  if (!quem.temPermissao(PERM_VER)) throw new ErroPermissao();
  const atual = mesAtualBrasilia(agora);
  if (!mesValido(mes) || mes > atual) throw new ErroTesouraria('Escolha um mês até o mês atual.');
  const b = await lerBase(p);
  return { ...conferirMes(b, mes), mesAtual: atual };
}

/** C5: meses do ano em andamento (até o mês anterior ao atual) com diferença, do mais antigo ao mais novo. */
export function mesesComDiferenca(b: BaseExecucao, agora: Date = new Date()): string[] {
  const atual = mesAtualBrasilia(agora);
  const ultimo = mesAnterior(atual);
  const meses: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const mes = `${atual.slice(0, 4)}-${String(m).padStart(2, '0')}`;
    if (mes > ultimo) break;
    const r = conferirMes(b, mes);
    if (r.termos.some((t) => t.situacao === 'diferenca') || r.recursoLivre.situacao === 'diferenca') meses.push(mes);
  }
  return meses;
}
