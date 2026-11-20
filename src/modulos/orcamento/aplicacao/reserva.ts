/**
 * Reserva (1D.2, regras R1 a R8): política (meses de folha e faixas dos sinais) e pedidos de uso.
 *
 * Quem pode:
 * - orcamento.tesouraria.ver (Diretoria e Financeiro): ver a política e os pedidos.
 * - orcamento.tesouraria.editar (Financeiro): propor política, pedir uso, cancelar pedido, marcar recomposição.
 * - orcamento.reserva.aprovar (Diretoria): aprovar ou recusar a política e os usos. Quem propôs não aprova (R3).
 *
 * Nada é apagado: pedido errado é cancelado (ativo = FALSE) e, depois de decidido, não muda.
 * A auditoria guarda as colunas alteradas, nunca os valores.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { PoliticaReserva, UsosReserva, type RegPoliticaReserva, type RegUsoReserva } from '../dados/tabelas';
import {
  CAMPOS_FAIXAS, conferirFaixas, conferirPedidoDeUso, FAIXAS_DE_FABRICA, minimoDaReserva, percentualDoMinimo, politicaVigente,
  recomposicaoVencida, type Faixas,
} from '../dominio/reserva';
import { mesAtualBrasilia, mesValido } from '../dominio/tesouraria';
import { lerBase, mesesComSaldo, totaisDoMes } from './base-execucao';
import { previsaoDoAno } from './fim-do-ano';
import { ErroTesouraria } from './tesouraria';

/** Mesmo tipo de erro da Tesouraria: as telas já sabem mostrá-lo. */
export const ErroReserva = ErroTesouraria;

const PERM = { ver: 'orcamento.tesouraria.ver', editar: 'orcamento.tesouraria.editar', aprovar: 'orcamento.reserva.aprovar' } as const;

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

const limpar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ');

export const faixasDe = (l: Faixas): Faixas => Object.fromEntries(CAMPOS_FAIXAS.map((k) => [k, l[k]])) as unknown as Faixas;

/** Faixas em vigor no mês: as da política aprovada, ou as de fábrica (R2). */
export function faixasEmVigor(linhas: RegPoliticaReserva[], mes: string): { faixas: Faixas; aprovada: boolean; vigencia: string | null } {
  const v = politicaVigente(linhas.filter((l) => l.ativo), mes);
  return v ? { faixas: faixasDe(v), aprovada: true, vigencia: v.vigencia } : { faixas: FAIXAS_DE_FABRICA, aprovada: false, vigencia: null };
}

export interface UsoListado extends RegUsoReserva {
  vencido: boolean;
}

export interface ReservaDaTela {
  mesAtual: string;
  faixas: Faixas;
  /** Há política aprovada em vigor? Sem ela, valem as faixas de fábrica e o mínimo não existe. */
  aprovada: boolean;
  vigencia: string | null;
  /** Mínimo em R$ da política aprovada (R1); null sem política aprovada ou sem Previsão aprovada. */
  minimo: number | null;
  /** Saldo da classe reserva no último mês com saldo, e esse mês. */
  reservaAtual: number | null;
  mesDoSaldo: string | null;
  percentual: number | null;
  proposta: RegPoliticaReserva | null;
  usos: UsoListado[];
  podeEditar: boolean;
  podeAprovar: boolean;
  /** O usuário atual propôs a política pendente (não pode aprová-la, R3). */
  propostaEhMinha: boolean;
}

export async function lerReserva(p: Planilhas, quem: Autorizador, agora: Date = new Date()): Promise<ReservaDaTela> {
  exigir(quem, PERM.ver);
  const atual = mesAtualBrasilia(agora);
  const [politicaT, usosT] = await lerTabelas(p, [PoliticaReserva, UsosReserva] as const);
  const b = await lerBase(p);
  const { faixas, aprovada, vigencia } = faixasEmVigor(politicaT.todos(), atual);
  const mesDoSaldo = mesesComSaldo(b, ['reserva']).filter((m) => m <= atual).at(-1) ?? null;
  const reservaAtual = mesDoSaldo ? totaisDoMes(b, mesDoSaldo).reserva : null;
  const previsao = aprovada ? await previsaoDoAno(p, quem, Number(atual.slice(0, 4))) : null;
  const minimo = aprovada && previsao ? minimoDaReserva(previsao.rhAnual, faixas.meses_minimo) : null;
  const proposta = politicaT.ativos().filter((l) => l.situacao === 'proposta').sort((x, y) => y.criado_em.localeCompare(x.criado_em))[0] ?? null;
  return {
    mesAtual: atual,
    faixas,
    aprovada,
    vigencia,
    minimo,
    reservaAtual,
    mesDoSaldo,
    percentual: reservaAtual !== null && minimo !== null ? percentualDoMinimo(reservaAtual, minimo) : null,
    proposta,
    usos: usosT.ativos().sort((x, y) => y.criado_em.localeCompare(x.criado_em)).map((u) => ({ ...u, vencido: recomposicaoVencida(u, atual) })),
    podeEditar: quem.temPermissao(PERM.editar),
    podeAprovar: quem.temPermissao(PERM.aprovar),
    propostaEhMinha: !!proposta && proposta.criado_por === quem.email,
  };
}

// ---------------------------------------------------------------------------
// Política
// ---------------------------------------------------------------------------

/** R2: o Financeiro propõe; só vale depois de aprovada pela Diretoria. Uma proposta pendente por vez. */
export async function proporPolitica(p: Planilhas, quem: Autorizador, faixas: Faixas, agora: Date = new Date()): Promise<string> {
  exigir(quem, PERM.editar);
  const erros = conferirFaixas(faixas);
  if (erros.length) throw new ErroReserva(erros.join(' '));
  const [politicaT] = await lerTabelas(p, [PoliticaReserva] as const);
  if (politicaT.ativos().some((l) => l.situacao === 'proposta')) {
    throw new ErroReserva('Já existe uma proposta aguardando a Diretoria. Espere a decisão antes de propor outra.');
  }
  const campos = { vigencia: mesAtualBrasilia(agora), situacao: 'proposta' as const, motivo: null, ...faixasDe(faixas) };
  const nova = await inserir(p, PoliticaReserva, campos, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'PoliticaReserva', registroId: nova.id });
  return nova.id;
}

/** R3: quem propôs não decide o próprio pedido. */
function exigirOutraPessoa(quem: Autorizador, criadoPor: string) {
  if (criadoPor === quem.email) throw new ErroReserva('Quem fez o pedido não pode decidir o próprio pedido. Peça a outra pessoa da Diretoria.');
}

export async function decidirPolitica(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  decisao: 'aprovada' | 'recusada',
  motivo?: string,
): Promise<void> {
  exigir(quem, PERM.aprovar);
  const [politicaT] = await lerTabelas(p, [PoliticaReserva] as const);
  const alvo = politicaT.porId(id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'proposta') throw new ErroReserva('Esta proposta já foi decidida ou não existe mais.');
  exigirOutraPessoa(quem, alvo.criado_por);
  const m = limpar(motivo);
  if (decisao === 'recusada' && !m) throw new ErroReserva('Informe o motivo da recusa.');
  const { colunasAlteradas } = await atualizar(p, PoliticaReserva, id, versao, { situacao: decisao, motivo: decisao === 'recusada' ? m : null } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'PoliticaReserva', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Uso da reserva
// ---------------------------------------------------------------------------

/** R4: pedido de uso; não move saldo. O valor não passa do saldo da reserva do último mês com saldo. */
export async function pedirUsoDaReserva(
  p: Planilhas,
  quem: Autorizador,
  e: { valor: number; motivo: string; prazo: string },
  agora: Date = new Date(),
): Promise<string> {
  exigir(quem, PERM.editar);
  const atual = mesAtualBrasilia(agora);
  const b = await lerBase(p);
  const mes = mesesComSaldo(b, ['reserva']).filter((m) => m <= atual).at(-1) ?? null;
  const saldoReserva = mes ? totaisDoMes(b, mes).reserva : null;
  const erros = conferirPedidoDeUso({ valor: e.valor, motivo: e.motivo, prazo: e.prazo, mesPedido: atual, saldoReserva });
  if (erros.length) throw new ErroReserva(erros.join(' '));
  const novo = await inserir(
    p,
    UsosReserva,
    { mes_pedido: atual, valor: Math.round(e.valor * 100) / 100, motivo: limpar(e.motivo), prazo_recomposicao: e.prazo, situacao: 'pedido', motivo_decisao: null, mes_recomposicao: null },
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'UsosReserva', registroId: novo.id });
  return novo.id;
}

async function usoEm(p: Planilhas, id: string, situacoes: string[], mensagem: string): Promise<RegUsoReserva> {
  const [usosT] = await lerTabelas(p, [UsosReserva] as const);
  const alvo = usosT.porId(id);
  if (!alvo || !alvo.ativo || !situacoes.includes(alvo.situacao)) throw new ErroReserva(mensagem);
  return alvo;
}

/** R6: o Financeiro cancela o pedido enquanto está em `pedido` (encerra, nada é apagado). */
export async function cancelarPedidoDeUso(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, PERM.editar);
  await usoEm(p, id, ['pedido'], 'Só dá para cancelar um pedido que ainda não foi decidido.');
  await atualizar(p, UsosReserva, id, versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'UsosReserva', registroId: id, detalhes: { colunas: ['ativo'] } });
}

/** R4 e R7: a Diretoria aprova ou recusa (recusa pede motivo). */
export async function decidirUsoDaReserva(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  decisao: 'aprovado' | 'recusado',
  motivo?: string,
): Promise<void> {
  exigir(quem, PERM.aprovar);
  const alvo = await usoEm(p, id, ['pedido'], 'Este pedido já foi decidido, cancelado ou não existe mais.');
  exigirOutraPessoa(quem, alvo.criado_por);
  const m = limpar(motivo);
  if (decisao === 'recusado' && !m) throw new ErroReserva('Informe o motivo da recusa.');
  const { colunasAlteradas } = await atualizar(p, UsosReserva, id, versao, { situacao: decisao, motivo_decisao: decisao === 'recusado' ? m : null } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'UsosReserva', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/** R4: o Financeiro marca quando devolveu à reserva, com o mês. */
export async function marcarRecomposicao(p: Planilhas, quem: Autorizador, id: string, versao: number, mes: string, agora: Date = new Date()): Promise<void> {
  exigir(quem, PERM.editar);
  await usoEm(p, id, ['aprovado'], 'Só um uso aprovado pode ser marcado como recomposto.');
  if (!mesValido(mes) || mes > mesAtualBrasilia(agora)) throw new ErroReserva('Escolha o mês da recomposição, até o mês atual.');
  const { colunasAlteradas } = await atualizar(p, UsosReserva, id, versao, { situacao: 'recomposto', mes_recomposicao: mes } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'UsosReserva', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

