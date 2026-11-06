/**
 * Configurações da Comunicação: antecedência mínima dos pedidos, em dias úteis.
 * Só a coordenação (comunicacao.configurar) altera; quem usa o módulo só lê.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ParametrosComunicacao } from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';

const CHAVE_ANTECEDENCIA = 'antecedencia_minima';
export const ANTECEDENCIA_PADRAO = 5;

export async function lerAntecedencia(p: Planilhas): Promise<number> {
  const [parametros] = await lerTabelas(p, [ParametrosComunicacao] as const);
  return parametros.ativos().find((x) => x.chave === CHAVE_ANTECEDENCIA)?.valor ?? ANTECEDENCIA_PADRAO;
}

export async function salvarAntecedencia(p: Planilhas, quem: Autorizador, dias: number, opcoes: { agora?: Date } = {}): Promise<void> {
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
  if (atual.valor === dias) return;
  await atualizar(p, ParametrosComunicacao, atual.id, atual.versao, { valor: dias }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ParametrosComunicacao', registroId: atual.id, detalhes: { colunas: ['valor'] } }, agora);
}
