/**
 * Instagram da Comunicação (ADR-028, fase 3, entrega 1): conectar, reconectar e desconectar a conta da
 * instituição. Só a coordenação (`comunicacao.configurar`). O token fica cifrado na peça de credenciais do
 * Núcleo e nunca chega à tela.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import {
  conectarCredencial,
  desconectarCredencial,
  ErroCredencial,
  situacaoDaCredencial,
  type SituacaoDaCredencial,
} from '@/nucleo/credenciais/credenciais';
import {
  assinarEstadoDaConexao,
  conferirEstadoDaConexao,
  ErroInstagram,
  MENSAGEM_NAO_CONECTOU,
  MENSAGEM_NAO_LIBERADO,
  type ProvedorInstagram,
} from '@/nucleo/credenciais/instagram';
import { ErroComunicacao } from '../dominio/pedido';

const PERMISSAO = 'comunicacao.configurar';

export function situacaoDoInstagram(p: Planilhas, quem: Autorizador, instituicao: string, agora = new Date()): Promise<SituacaoDaCredencial> {
  return situacaoDaCredencial(p, quem, PERMISSAO, instituicao, 'instagram', agora);
}

/** Endereço da Meta para a pessoa autorizar (a volta passa pelo `estado`, assinado e preso a quem começou). */
export async function iniciarConexaoInstagram(
  provedor: ProvedorInstagram,
  segredoSessao: string,
  quem: Autorizador,
  instituicao: string,
  retorno: string,
): Promise<string> {
  if (!quem.temPermissao(PERMISSAO)) throw new ErroPermissao();
  return provedor.urlDeAutorizacao(await assinarEstadoDaConexao(segredoSessao, quem.email, instituicao), retorno);
}

export interface RetornoDaMeta {
  codigo: string | null;
  estado: string | null;
  /** Parâmetro `error` que a Meta devolve quando a pessoa cancela ou o app não está liberado. */
  erro: string | null;
}

/** Recebe a volta da Meta e grava a conta. Erros conhecidos viram `ErroComunicacao` com texto para a pessoa. */
export async function concluirConexaoInstagram(
  p: Planilhas,
  quem: Autorizador,
  provedor: ProvedorInstagram,
  segredoSessao: string,
  instituicao: string,
  retorno: string,
  recebido: RetornoDaMeta,
  agora = new Date(),
): Promise<void> {
  if (!quem.temPermissao(PERMISSAO)) throw new ErroPermissao();
  if (!(await conferirEstadoDaConexao(segredoSessao, recebido.estado, quem.email, instituicao))) {
    throw new ErroComunicacao('A conexão expirou ou não foi iniciada por você. Clique em "Conectar Instagram" de novo.');
  }
  if (recebido.erro) throw new ErroComunicacao(`A conexão não foi concluída. Se você não cancelou, ${MENSAGEM_NAO_LIBERADO.charAt(0).toLowerCase()}${MENSAGEM_NAO_LIBERADO.slice(1)}`);
  if (!recebido.codigo) throw new ErroComunicacao(MENSAGEM_NAO_CONECTOU);
  try {
    const conta = await provedor.conectar(recebido.codigo, retorno);
    await conectarCredencial(p, quem, PERMISSAO, { instituicao, servico: 'instagram', conta: conta.usuario, valor: conta.token, venceEm: conta.venceEm }, { agora });
  } catch (e) {
    if (e instanceof ErroInstagram || e instanceof ErroCredencial) throw new ErroComunicacao(e.message);
    throw e;
  }
}

export function desconectarInstagram(p: Planilhas, quem: Autorizador, instituicao: string, agora = new Date()): Promise<void> {
  return desconectarCredencial(p, quem, PERMISSAO, instituicao, 'instagram', agora).catch((e) => {
    if (e instanceof ErroCredencial) throw new ErroComunicacao(e.message);
    throw e;
  });
}
