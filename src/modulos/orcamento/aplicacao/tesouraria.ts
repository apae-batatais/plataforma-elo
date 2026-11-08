/**
 * Casos de uso da tesouraria (Entrega 1D.1): cadastro de contas e, na
 * sequência, saldos de fim de mês.
 *
 * Quem pode:
 * - orcamento.tesouraria.ver: Diretoria e Financeiro.
 * - orcamento.tesouraria.editar: só o Financeiro.
 *
 * Nada é apagado: conta excluída fica com ativo = FALSE e os saldos já
 * gravados continuam valendo.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, atualizarVarios, ErroConflito, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Unidades } from '@/nucleo/estrutura/tabelas';
import { AjustesConciliacao, Contas, Fontes, Saldos, type RegAjusteConciliacao, type RegConta, type RegFonte, type RegSaldo } from '../dados/tabelas';
import { CLASSES, conferirConta, contasSemSaldo, mesAnterior, mesAtualBrasilia, mesValido, totaisPorClasse, type Classe, type DadosConta } from '../dominio/tesouraria';
import { nomeComparavel } from '../dominio/previsao';
import { ErroValidacaoFolha } from './folha';

/** Mesmo tipo de erro da folha: as telas já sabem mostrá-lo. */
export const ErroTesouraria = ErroValidacaoFolha;

const PERM = { ver: 'orcamento.tesouraria.ver', editar: 'orcamento.tesouraria.editar' } as const;

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

const limpar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ');
const vazioParaNulo = (t: string | null | undefined) => limpar(t) || null;
const chave = (c: { banco: string; agencia: string | null; conta: string | null }) =>
  [c.banco, c.agencia, c.conta].map((x) => nomeComparavel(limpar(x))).join('|');

export interface ContasListadas {
  ativas: RegConta[];
  excluidas: RegConta[];
  /** id → nome de todas as fontes, inclusive as excluídas. */
  fontes: Record<string, string>;
  /** Fontes ativas de uso restrito: as únicas aceitas em conta vinculada. */
  fontesRestritas: RegFonte[];
  unidades: { codigo: string; nome: string }[];
}

export async function listarContas(p: Planilhas, quem: Autorizador): Promise<ContasListadas> {
  exigir(quem, PERM.ver);
  const [contas, fontes, unidades] = await lerTabelas(p, [Contas, Fontes, Unidades] as const);
  const ordem = (a: RegConta, b: RegConta) => a.banco.localeCompare(b.banco, 'pt-BR') || (a.conta ?? '').localeCompare(b.conta ?? '', 'pt-BR');
  return {
    ativas: contas.ativos().sort(ordem),
    excluidas: contas.todos().filter((c) => !c.ativo).sort(ordem),
    fontes: Object.fromEntries(fontes.todos().map((f) => [f.id, f.nome])),
    fontesRestritas: fontes.ativos().filter((f) => f.uso === 'restrita').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    unidades: unidades.ativos().map((u) => ({ codigo: u.codigo, nome: u.nome })),
  };
}

export async function salvarConta(
  p: Planilhas,
  quem: Autorizador,
  dados: DadosConta,
  existente?: { id: string; versao: number },
): Promise<string> {
  exigir(quem, PERM.editar);
  const limpa: DadosConta = {
    ...dados,
    banco: limpar(dados.banco),
    agencia: limpar(dados.agencia),
    conta: limpar(dados.conta),
    fonteId: dados.fonteId || null,
    unidade: dados.unidade || null,
  };
  const [contas, fontes] = await lerTabelas(p, [Contas, Fontes] as const);
  const erros = conferirConta(limpa, fontes.todos());
  if (erros.length === 0 && limpa.fonteId && !fontes.porId(limpa.fonteId)) erros.push('A fonte escolhida não existe.');
  if (erros.length) throw new ErroTesouraria(erros.join(' '));

  const campos = {
    banco: limpa.banco,
    agencia: vazioParaNulo(limpa.agencia),
    conta: vazioParaNulo(limpa.conta),
    tipo: limpa.tipo,
    classe: limpa.classe,
    fonte_id: limpa.fonteId,
    unidade: limpa.unidade,
  };
  const igual = contas.todos().find((c) => c.id !== existente?.id && chave(c) === chave(campos));
  if (igual) {
    throw new ErroTesouraria(
      igual.ativo ? 'Já existe esta conta cadastrada.' : 'Já existe esta conta entre as excluídas. Reative em vez de cadastrar de novo.',
    );
  }

  if (!existente) {
    const c = await inserir(p, Contas, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Contas', registroId: c.id });
    return c.id;
  }
  const alvo = contas.porId(existente.id);
  if (!alvo || !alvo.ativo) throw new ErroTesouraria('Conta não encontrada.');
  const { colunasAlteradas } = await atualizar(p, Contas, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Contas', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  }
  return existente.id;
}

async function mudarSituacao(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  exigir(quem, PERM.editar);
  const [contas] = await lerTabelas(p, [Contas] as const);
  const alvo = contas.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroTesouraria('Conta não encontrada.');
  if (ativo) {
    const repetida = contas.ativos().some((c) => chave(c) === chave(alvo));
    if (repetida) throw new ErroTesouraria('Já existe esta conta cadastrada.');
  }
  await atualizar(p, Contas, id, versao, { ativo } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Contas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

export const excluirConta = (p: Planilhas, quem: Autorizador, id: string, versao: number) => mudarSituacao(p, quem, id, versao, false);
export const reativarConta = (p: Planilhas, quem: Autorizador, id: string, versao: number) => mudarSituacao(p, quem, id, versao, true);

// ---------------------------------------------------------------------------
// Saldos do mês e ajustes de conciliação
// ---------------------------------------------------------------------------

export interface LinhaSaldo {
  conta: RegConta;
  saldo: RegSaldo | null;
  saldoAnterior: number | null;
  ajustes: RegAjusteConciliacao[];
}

export interface SaldosDoMes {
  mes: string;
  mesAtual: string;
  linhas: LinhaSaldo[];
  totais: Record<Classe, number>;
  totaisAnterior: Record<Classe, number>;
  pendentes: { id: string; nome: string }[];
}

function exigirMes(mes: string) {
  if (!mesValido(mes) || mes > mesAtualBrasilia()) throw new ErroTesouraria('Escolha um mês até o mês atual.');
}

const nomeConta = (c: RegConta) => [c.banco, c.conta].filter(Boolean).join(' ');

export async function lerSaldosDoMes(p: Planilhas, quem: Autorizador, mes: string): Promise<SaldosDoMes> {
  exigir(quem, PERM.ver);
  exigirMes(mes);
  const [contas, saldos, ajustes] = await lerTabelas(p, [Contas, Saldos, AjustesConciliacao] as const);
  const anterior = mesAnterior(mes);
  const saldosAtivos = saldos.ativos();
  const ajustesAtivos = ajustes.ativos();
  // Todas as contas (ativas e excluídas): uma excluída com saldo no mês ainda conta.
  const todas = contas.todos();
  const ativas = todas.filter((c) => c.ativo);
  const saldoDoMes = new Map(saldosAtivos.filter((s) => s.mes === mes).map((s) => [s.conta_id, s]));
  const saldoAnterior = new Map(saldosAtivos.filter((s) => s.mes === anterior).map((s) => [s.conta_id, s.saldo]));

  const ordem = (a: RegConta, b: RegConta) =>
    CLASSES.indexOf(a.classe) - CLASSES.indexOf(b.classe) || a.banco.localeCompare(b.banco, 'pt-BR') || (a.conta ?? '').localeCompare(b.conta ?? '', 'pt-BR');
  const linhas = todas
    .filter((c) => c.ativo || saldoDoMes.has(c.id))
    .sort(ordem)
    .map<LinhaSaldo>((conta) => ({
      conta,
      saldo: saldoDoMes.get(conta.id) ?? null,
      saldoAnterior: saldoAnterior.get(conta.id) ?? null,
      ajustes: ajustesAtivos.filter((a) => a.conta_id === conta.id && a.mes === mes),
    }));

  const porId = new Map(ativas.map((c) => [c.id, c]));
  return {
    mes,
    mesAtual: mesAtualBrasilia(),
    linhas,
    totais: totaisPorClasse(todas, saldosAtivos, ajustesAtivos, mes),
    totaisAnterior: totaisPorClasse(todas, saldosAtivos, ajustesAtivos, anterior),
    pendentes: contasSemSaldo(ativas, saldosAtivos, mes).map((id) => ({ id, nome: nomeConta(porId.get(id)!) })),
  };
}

export async function salvarSaldosDoMes(
  p: Planilhas,
  quem: Autorizador,
  mes: string,
  linhas: { contaId: string; valor: number | null; versao?: number }[],
): Promise<{ gravados: number }> {
  exigir(quem, PERM.editar);
  exigirMes(mes);
  const [contas, saldos] = await lerTabelas(p, [Contas, Saldos] as const);
  const existentes = new Map(saldos.ativos().filter((s) => s.mes === mes).map((s) => [s.conta_id, s]));

  type Passo = { contaId: string; valor: number; existente: RegSaldo | null };
  const passos: Passo[] = [];
  const vistas = new Set<string>();
  for (const l of linhas) {
    if (vistas.has(l.contaId)) throw new ErroTesouraria('A mesma conta apareceu duas vezes. Abra a página de novo.');
    vistas.add(l.contaId);
    if (l.valor === null) continue;
    if (!Number.isFinite(l.valor)) throw new ErroTesouraria('Valor de saldo inválido.');
    const valor = Math.round(l.valor * 100) / 100;
    const alvo = contas.porId(l.contaId);
    const existente = existentes.get(l.contaId) ?? null;
    if (!alvo || (!alvo.ativo && !existente)) throw new ErroTesouraria('Conta não encontrada.');
    // Tudo ou nada: toda versão lida é conferida antes de gravar qualquer linha.
    if (existente ? existente.versao !== l.versao : l.versao !== undefined) throw new ErroConflito(existente?.id ?? l.contaId);
    if (existente && existente.saldo === valor) continue;
    passos.push({ contaId: l.contaId, valor, existente });
  }

  // Leitura nova na hora de gravar: um saldo novo para (conta, mês) que já
  // existe vira conflito, e as versões das alterações são conferidas juntas.
  const [saldosAgora] = await lerTabelas(p, [Saldos] as const);
  const jaTem = new Set(saldosAgora.ativos().filter((s) => s.mes === mes).map((s) => s.conta_id));
  const novos = passos.filter((x) => !x.existente);
  const alterados = passos.filter((x) => x.existente);
  for (const n of novos) if (jaTem.has(n.contaId)) throw new ErroConflito(n.contaId);

  const feitos = await atualizarVarios(
    p,
    Saldos,
    alterados.map((x) => ({ id: x.existente!.id, versao: x.existente!.versao, mudancas: { saldo: x.valor } })),
    { email: quem.email },
  );
  const inseridos = await inserirRegistros(p, saldosAgora, novos.map((n) => ({ conta_id: n.contaId, mes, saldo: n.valor })), { email: quem.email });

  for (const r of inseridos) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Saldos', registroId: r.id });
  }
  for (const r of feitos) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Saldos', registroId: r.id, detalhes: { colunas: r.colunasAlteradas } });
  }
  return { gravados: passos.length };
}

export async function incluirAjuste(
  p: Planilhas,
  quem: Autorizador,
  a: { contaId: string; mes: string; valor: number; motivo: string },
): Promise<string> {
  exigir(quem, PERM.editar);
  exigirMes(a.mes);
  const motivo = limpar(a.motivo);
  if (!motivo) throw new ErroTesouraria('Informe o motivo do ajuste.');
  if (!Number.isFinite(a.valor) || Math.round(a.valor * 100) === 0) throw new ErroTesouraria('O ajuste não pode ser zero.');
  const [contas] = await lerTabelas(p, [Contas] as const);
  const alvo = contas.porId(a.contaId);
  if (!alvo || !alvo.ativo) throw new ErroTesouraria('Conta não encontrada.');
  const novo = await inserir(p, AjustesConciliacao, { conta_id: a.contaId, mes: a.mes, valor: Math.round(a.valor * 100) / 100, motivo }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'AjustesConciliacao', registroId: novo.id });
  return novo.id;
}

export async function tirarAjuste(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, PERM.editar);
  const [ajustes] = await lerTabelas(p, [AjustesConciliacao] as const);
  const alvo = ajustes.porId(id);
  if (!alvo || !alvo.ativo) throw new ErroTesouraria('Ajuste não encontrado.');
  await atualizar(p, AjustesConciliacao, id, versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'AjustesConciliacao', registroId: id, detalhes: { colunas: ['ativo'] } });
}
