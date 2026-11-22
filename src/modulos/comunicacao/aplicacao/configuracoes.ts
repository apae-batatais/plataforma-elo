/**
 * Configurações da Comunicação: antecedência mínima dos pedidos, em dias úteis.
 * Só a coordenação (comunicacao.configurar) altera; quem usa o módulo só lê.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ParametrosComunicacao } from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';

const CHAVE_ANTECEDENCIA = 'antecedencia_minima';
export const ANTECEDENCIA_PADRAO = 5;

const valida = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 30;

/** Antecedência e a versão da linha (null enquanto ainda não foi salva). Valor fora de 0 a 30 é ignorado: vale o padrão. */
export async function lerAntecedenciaComVersao(p: Planilhas): Promise<{ dias: number; versao: number | null }> {
  const [parametros] = await lerTabelas(p, [ParametrosComunicacao] as const);
  const linha = parametros.ativos().find((x) => x.chave === CHAVE_ANTECEDENCIA);
  return { dias: linha && valida(linha.valor) ? linha.valor : ANTECEDENCIA_PADRAO, versao: linha?.versao ?? null };
}

export async function lerAntecedencia(p: Planilhas): Promise<number> {
  return (await lerAntecedenciaComVersao(p)).dias;
}

/** `versao` é a que a pessoa viu na tela; obrigatória quando a linha já existe (outra gravação no meio dá ErroConflito). */
export async function salvarAntecedencia(p: Planilhas, quem: Autorizador, dias: number, opcoes: { agora?: Date; versao?: number | null } = {}): Promise<void> {
  if (!quem.temPermissao('comunicacao.configurar')) throw new ErroPermissao();
  if (!Number.isInteger(dias) || dias < 0 || dias > 30) throw new ErroComunicacao('A antecedência mínima vai de 0 a 30 dias úteis.');
  const agora = opcoes.agora ?? new Date();
  const autoria = { email: quem.email, agora: () => agora };
  const [parametros] = await lerTabelas(p, [ParametrosComunicacao] as const);
  const atual = parametros.ativos().find((x) => x.chave === CHAVE_ANTECEDENCIA);
  if (!atual) {
    const novo = await inserir(p, ParametrosComunicacao, { chave: CHAVE_ANTECEDENCIA, valor: dias }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'ParametrosComunicacao', registroId: novo.id, detalhes: { colunas: ['valor'] } }, agora);
    return;
  }
  if (opcoes.versao === undefined || opcoes.versao === null || !Number.isInteger(opcoes.versao)) throw new ErroComunicacao('Abra a página de novo para salvar.');
  if (atual.versao !== opcoes.versao) throw new ErroConflito(atual.id);
  if (atual.valor === dias) return;
  await atualizar(p, ParametrosComunicacao, atual.id, opcoes.versao, { valor: dias }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ParametrosComunicacao', registroId: atual.id, detalhes: { colunas: ['valor'] } }, agora);
}

// ---------------------------------------------------------------------------
// Avisos por e-mail (ADR-027, entrega 3): liga e desliga da instituição. Começa desligado.
// ---------------------------------------------------------------------------

const CHAVE_AVISOS = 'avisos_por_email';

/** Os avisos por e-mail estão ligados? E a versão da linha (null enquanto nunca foi salvo). */
export async function lerAvisosPorEmail(p: Planilhas): Promise<{ ligado: boolean; versao: number | null }> {
  const [parametros] = await lerTabelas(p, [ParametrosComunicacao] as const);
  const linha = parametros.ativos().find((x) => x.chave === CHAVE_AVISOS);
  return { ligado: linha?.valor === 1, versao: linha?.versao ?? null };
}

/** Só a coordenação (comunicacao.configurar). `versao` é a que a pessoa viu; obrigatória quando a linha já existe. */
export async function salvarAvisosPorEmail(p: Planilhas, quem: Autorizador, ligado: boolean, opcoes: { agora?: Date; versao?: number | null } = {}): Promise<void> {
  if (!quem.temPermissao('comunicacao.configurar')) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const autoria = { email: quem.email, agora: () => agora };
  const [parametros] = await lerTabelas(p, [ParametrosComunicacao] as const);
  const atual = parametros.ativos().find((x) => x.chave === CHAVE_AVISOS);
  const valor = ligado ? 1 : 0;
  if (!atual) {
    const novo = await inserir(p, ParametrosComunicacao, { chave: CHAVE_AVISOS, valor }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'ParametrosComunicacao', registroId: novo.id, detalhes: { colunas: ['valor'] } }, agora);
    return;
  }
  if (opcoes.versao === undefined || opcoes.versao === null || !Number.isInteger(opcoes.versao)) throw new ErroComunicacao('Abra a página de novo para salvar.');
  if (atual.versao !== opcoes.versao) throw new ErroConflito(atual.id);
  if (atual.valor === valor) return;
  await atualizar(p, ParametrosComunicacao, atual.id, opcoes.versao, { valor }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ParametrosComunicacao', registroId: atual.id, detalhes: { colunas: ['valor'] } }, agora);
}
