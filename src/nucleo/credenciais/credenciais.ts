/**
 * Credenciais de serviços externos por instituição (ADR-028). Guarda o segredo cifrado na aba `Credenciais`.
 *
 * - O valor nunca volta para a tela, para log nem para a auditoria (a auditoria registra só colunas).
 * - Só uma conta ativa por instituição e serviço; trocar de conta exige desconectar a atual.
 * - Nada é apagado: desconectar encerra a linha (`ativo = FALSE`), zera o valor cifrado e marca "desconectada".
 * - Quem chama passa a permissão que autoriza conectar e desconectar (cada app tem a sua).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Credenciais, type RegCredencial, type SERVICOS_DE_CREDENCIAL } from '@/nucleo/estrutura/tabelas';
import { cifrar, decifrar } from './cifra';

export type ServicoDeCredencial = (typeof SERVICOS_DE_CREDENCIAL)[number];

export class ErroCredencial extends Error {}

/** Renova o token quando faltam menos dias que isto. */
export const DIAS_PARA_RENOVAR = 15;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface SituacaoDaCredencial {
  situacao: 'nenhuma' | 'conectada' | 'expirando' | 'expirada';
  /** Nome da conta no serviço (nunca o segredo). */
  conta: string | null;
  venceEm: string | null;
  conectadoEm: string | null;
}

const contexto = (instituicao: string, servico: string) => `${instituicao}|${servico}`;

function ativa(todos: RegCredencial[], instituicao: string, servico: ServicoDeCredencial): RegCredencial | undefined {
  return todos.find((c) => c.ativo && c.instituicao === instituicao && c.servico === servico && c.situacao !== 'desconectada');
}

function situacaoEfetiva(c: RegCredencial, agora: Date): SituacaoDaCredencial['situacao'] {
  if (c.vence_em && new Date(c.vence_em).getTime() <= agora.getTime()) return 'expirada';
  return c.situacao === 'expirando' || c.situacao === 'expirada' ? c.situacao : 'conectada';
}

/** Estado da conta, sem o segredo. Só quem tem a permissão informada vê. */
export async function situacaoDaCredencial(
  p: Planilhas,
  quem: Autorizador,
  permissao: string,
  instituicao: string,
  servico: ServicoDeCredencial,
  agora = new Date(),
): Promise<SituacaoDaCredencial> {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
  const c = ativa((await lerTabela(p, Credenciais)).todos(), instituicao, servico);
  if (!c) return { situacao: 'nenhuma', conta: null, venceEm: null, conectadoEm: null };
  return { situacao: situacaoEfetiva(c, agora), conta: c.conta, venceEm: c.vence_em, conectadoEm: c.conectado_em };
}

/**
 * Só a situação da conta (sem nome de usuário e sem segredo), para quem usa o serviço sem administrá-lo
 * (ex.: a Comunicação decide se oferece "Publicar pelo Elo").
 */
export async function situacaoPublicaDaCredencial(
  p: Planilhas,
  instituicao: string,
  servico: ServicoDeCredencial,
  agora = new Date(),
): Promise<SituacaoDaCredencial['situacao']> {
  const c = ativa((await lerTabela(p, Credenciais)).todos(), instituicao, servico);
  return c ? situacaoEfetiva(c, agora) : 'nenhuma';
}

export interface DadosDaConexao {
  instituicao: string;
  servico: ServicoDeCredencial;
  conta: string;
  /** O segredo em texto: cifrado antes de gravar. */
  valor: string;
  venceEm: Date;
}

/** Conecta (ou reconecta a mesma conta). Outra conta, com uma já ativa, exige desconectar antes. */
export async function conectarCredencial(
  p: Planilhas,
  quem: Autorizador,
  permissao: string,
  d: DadosDaConexao,
  opcoes: { agora?: Date; segredo?: string } = {},
): Promise<void> {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
  if (!d.valor || !d.conta.trim()) throw new ErroCredencial('A conexão não trouxe os dados da conta.');
  const agora = opcoes.agora ?? new Date();
  const autoria = { email: quem.email, agora: () => agora };
  const atual = ativa((await lerTabela(p, Credenciais)).todos(), d.instituicao, d.servico);
  const dados = {
    conta: d.conta.trim(),
    valor_cifrado: cifrar(d.valor, contexto(d.instituicao, d.servico), opcoes.segredo),
    vence_em: d.venceEm.toISOString(),
    situacao: 'conectada' as const,
    conectado_por: quem.email,
    conectado_em: agora.toISOString(),
  };
  if (atual) {
    if ((atual.conta ?? '').toLowerCase() !== dados.conta.toLowerCase()) {
      throw new ErroCredencial('Já há outra conta conectada. Desconecte a atual antes de conectar esta.');
    }
    const r = await atualizar(p, Credenciais, atual.id, atual.versao, dados, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Credenciais', registroId: atual.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
    return;
  }
  const novo = await inserir(p, Credenciais, { instituicao: d.instituicao, servico: d.servico, ...dados }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Credenciais', registroId: novo.id, detalhes: { colunas: ['conta', 'valor_cifrado', 'vence_em', 'situacao', 'conectado_por', 'conectado_em'] } }, agora);
}

/** Encerra a conexão: zera o valor cifrado e marca "desconectada". A linha fica. */
export async function desconectarCredencial(
  p: Planilhas,
  quem: Autorizador,
  permissao: string,
  instituicao: string,
  servico: ServicoDeCredencial,
  agora = new Date(),
): Promise<void> {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
  const atual = ativa((await lerTabela(p, Credenciais)).todos(), instituicao, servico);
  if (!atual) throw new ErroCredencial('Não há conta conectada.');
  const r = await atualizar(p, Credenciais, atual.id, atual.versao, { valor_cifrado: null, situacao: 'desconectada', ativo: false }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Credenciais', registroId: atual.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

export interface SegredoLido {
  valor: string;
  conta: string;
  venceEm: Date;
}

/**
 * Uso interno da camada de aplicação (adaptadores e rotina): devolve o segredo decifrado da instituição, ou null
 * se não há conta conectada ou se venceu. O valor nunca deve ser repassado a telas, rotas, logs nem erros.
 */
export async function segredoDaCredencial(
  p: Planilhas,
  instituicao: string,
  servico: ServicoDeCredencial,
  opcoes: { agora?: Date; segredo?: string } = {},
): Promise<SegredoLido | null> {
  const agora = opcoes.agora ?? new Date();
  const c = ativa((await lerTabela(p, Credenciais)).todos(), instituicao, servico);
  if (!c?.valor_cifrado || !c.vence_em || !c.conta) return null;
  if (new Date(c.vence_em).getTime() <= agora.getTime()) return null;
  return { valor: decifrar(c.valor_cifrado, contexto(instituicao, servico), opcoes.segredo), conta: c.conta, venceEm: new Date(c.vence_em) };
}

export type ResultadoDaRenovacao = 'nenhuma' | 'em_dia' | 'renovada' | 'expirando' | 'expirada';

/**
 * Rotina: renova o token que vence em menos de 15 dias. Falhou: situação "expirando"; vencido: "expirada".
 * Idempotente: sem nada a fazer, não grava.
 */
export async function renovarCredencial(
  p: Planilhas,
  instituicao: string,
  servico: ServicoDeCredencial,
  renovar: (valor: string) => Promise<{ valor: string; venceEm: Date }>,
  opcoes: { agora?: Date; segredo?: string } = {},
): Promise<ResultadoDaRenovacao> {
  const agora = opcoes.agora ?? new Date();
  const autoria = { email: 'sistema', agora: () => agora };
  const c = ativa((await lerTabela(p, Credenciais)).todos(), instituicao, servico);
  if (!c) return 'nenhuma';
  const marcar = async (situacao: 'expirando' | 'expirada', resultado: ResultadoDaRenovacao) => {
    if (c.situacao === situacao) return resultado;
    const r = await atualizar(p, Credenciais, c.id, c.versao, { situacao }, autoria);
    await registrarAuditoria(p, { usuario: 'sistema', acao: 'alteracao', entidade: 'Credenciais', registroId: c.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
    return resultado;
  };
  const vence = c.vence_em ? new Date(c.vence_em).getTime() : 0;
  if (vence <= agora.getTime()) return marcar('expirada', 'expirada');
  if (vence - agora.getTime() >= DIAS_PARA_RENOVAR * DIA_MS) return 'em_dia';
  try {
    if (!c.valor_cifrado) throw new ErroCredencial('sem valor');
    const novo = await renovar(decifrar(c.valor_cifrado, contexto(instituicao, servico), opcoes.segredo));
    const r = await atualizar(
      p,
      Credenciais,
      c.id,
      c.versao,
      { valor_cifrado: cifrar(novo.valor, contexto(instituicao, servico), opcoes.segredo), vence_em: novo.venceEm.toISOString(), situacao: 'conectada' },
      autoria,
    );
    await registrarAuditoria(p, { usuario: 'sistema', acao: 'alteracao', entidade: 'Credenciais', registroId: c.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
    return 'renovada';
  } catch {
    return marcar('expirando', 'expirando');
  }
}
