/**
 * Resultado das postagens do Instagram (Fase 4, #65): alcance, curtidas, comentários e salvamentos.
 *
 * - A rotina (`rodarResultados`) busca uma vez por dia, pela mesma conta e token da publicação (ADR-028), as
 *   publicações publicadas há até 90 dias. Só a rotina grava; o resultado nunca muda o pedido nem o histórico.
 * - A tela do pedido e o painel de Indicadores só leem (`comunicacao.revisar` e `comunicacao.indicadores`).
 * - O token nunca sai desta camada.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, lerTabelas, type Autoria, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { segredoDaCredencial } from '@/nucleo/credenciais/credenciais';
import { ErroInstagram } from '@/nucleo/credenciais/instagram';
import { MENSAGEM_RECONECTAR, MENSAGEM_SEM_PERMISSAO_RESULTADO, type PublicadorInstagram } from '@/nucleo/credenciais/instagram-publicacao';
import { PedidosComunicacao, PublicacoesComunicacao, type RegPublicacao } from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';
import type { PeriodoIndicadores } from '../dominio/indicadores';
import { diaEmBrasilia } from '../dominio/prazos';
import type { TipoPublicacao } from '../dominio/publicacao';
import {
  alcanceMedioPorTipo,
  dentroDoPrazoDeBusca,
  juntarNumeros,
  MENSAGEM_RESULTADO_INDISPONIVEL,
  MENSAGEM_RESULTADO_SEM_PERMISSAO,
  type MediaPorTipo,
  type NumerosDaPostagem,
} from '../dominio/resultado';
import { dataValida } from './calendario';

const SISTEMA = 'sistema';
const SEM_PERMISSAO = 'sem_permissao';

export interface ContextoDosResultados {
  instituicao: string;
  publicador: PublicadorInstagram;
  /** Chave mestra das credenciais (só nos testes; em produção vem do ambiente). */
  segredo?: string;
}

const numerosDe = (x: RegPublicacao): NumerosDaPostagem => ({ alcance: x.alcance ?? null, curtidas: x.curtidas ?? null, comentarios: x.comentarios ?? null, salvamentos: x.salvamentos ?? null });
const temNumero = (n: NumerosDaPostagem) => Object.values(n).some((v) => v !== null);

/**
 * Uma rodada para uma instituição. Falha de uma publicação (post apagado) só a pula; recusa de permissão em
 * todas registra o aviso da conta uma vez. Rodar de novo no mesmo dia não busca de novo o que já foi buscado.
 */
export async function rodarResultados(p: Planilhas, ctx: ContextoDosResultados, agora = new Date()): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  const conta = (k: string) => {
    r[k] = (r[k] ?? 0) + 1;
  };
  const [tabela] = await lerTabelas(p, [PublicacoesComunicacao] as const);
  const hoje = diaEmBrasilia(agora);
  const candidatas = tabela
    .ativos()
    .filter((x) => x.situacao === 'publicada' && x.post_id && dentroDoPrazoDeBusca(x.publicada_em, agora))
    .filter((x) => !x.metricas_em || diaEmBrasilia(new Date(x.metricas_em)) !== hoje || x.metricas_aviso === SEM_PERMISSAO)
    .sort((a, b) => (a.publicada_em ?? '').localeCompare(b.publicada_em ?? ''));
  if (candidatas.length === 0) return r;
  // Conta expirada ou desconectada: fica de fora da rodada, sem erro.
  const credencial = await segredoDaCredencial(p, ctx.instituicao, 'instagram', { agora, segredo: ctx.segredo });
  if (!credencial) {
    r.aguardando_conta = candidatas.length;
    return r;
  }
  const autoria: Autoria = { email: SISTEMA, agora: () => agora };
  const gravar = async (x: RegPublicacao, mudancas: Parameters<typeof atualizar<typeof PublicacoesComunicacao.esquema>>[4]) => {
    const res = await atualizar(p, PublicacoesComunicacao, x.id, x.versao, mudancas, autoria);
    await registrarAuditoria(p, { usuario: SISTEMA, acao: 'alteracao', entidade: 'PublicacoesComunicacao', registroId: x.id, detalhes: { colunas: res.colunasAlteradas } }, agora);
  };
  const semPermissao: RegPublicacao[] = [];
  let tentadas = 0;
  for (const x of candidatas) {
    tentadas += 1;
    try {
      const n = await ctx.publicador.buscarResultado(credencial.valor, x.post_id!);
      const juntos = juntarNumeros(numerosDe(x), n);
      await gravar(x, { ...juntos, metricas_em: agora.toISOString(), metricas_aviso: null });
      conta('atualizadas');
    } catch (e) {
      if (e instanceof ErroConflito) {
        conta('conflitos');
        continue;
      }
      const msg = e instanceof ErroInstagram ? e.message : '';
      if (msg === MENSAGEM_RECONECTAR) {
        // O token não vale mais: vale para a conta toda; as outras publicações esperam a reconexão.
        conta('aguardando_conta');
        return r;
      }
      if (msg === MENSAGEM_SEM_PERMISSAO_RESULTADO) semPermissao.push(x);
      else conta('puladas');
    }
  }
  // A Meta recusou a leitura de todas pelo mesmo motivo: registra uma vez e a tela explica.
  if (tentadas > 0 && semPermissao.length === tentadas) {
    for (const x of semPermissao) {
      if (x.metricas_aviso === SEM_PERMISSAO) continue;
      try {
        await gravar(x, { metricas_aviso: SEM_PERMISSAO });
      } catch (e) {
        if (!(e instanceof ErroConflito)) throw e;
      }
    }
    r.sem_permissao = 1;
  }
  return r;
}

/** Números de uma publicação para a tela do pedido (sem códigos). */
export interface ResultadoDaPublicacao {
  numeros: NumerosDaPostagem | null;
  atualizadoEm: string | null;
  /** Texto para mostrar no lugar dos números (nunca "0"). */
  aviso: string | null;
}

export function resultadoDaPublicacao(x: RegPublicacao): ResultadoDaPublicacao {
  const n = numerosDe(x);
  if (temNumero(n) && x.metricas_em) return { numeros: n, atualizadoEm: x.metricas_em, aviso: null };
  return { numeros: null, atualizadoEm: null, aviso: x.metricas_aviso === SEM_PERMISSAO ? MENSAGEM_RESULTADO_SEM_PERMISSAO : MENSAGEM_RESULTADO_INDISPONIVEL };
}

export interface LinhaDeResultado extends NumerosDaPostagem {
  id: string;
  /** Dia da publicação (AAAA-MM-DD, Brasília). */
  data: string;
  tipo: TipoPublicacao;
  /** Número do pedido (COM-AAAA-NNNN). */
  pedido: string;
}

export interface ResultadoDasPostagens {
  linhas: LinhaDeResultado[];
  medias: MediaPorTipo[];
}

/** Painel de Indicadores: uma linha por postagem publicada no período e com resultado. `comunicacao.indicadores`. */
export async function resultadoDasPostagens(p: Planilhas, quem: Autorizador, periodo: PeriodoIndicadores): Promise<ResultadoDasPostagens> {
  if (!quem.temPermissao('comunicacao.indicadores')) throw new ErroPermissao();
  if (!dataValida(periodo.inicio) || !dataValida(periodo.fim) || periodo.fim < periodo.inicio) throw new ErroComunicacao('Informe um período válido.');
  const [pubs, pedidos] = await lerTabelas(p, [PublicacoesComunicacao, PedidosComunicacao] as const);
  const linhas: LinhaDeResultado[] = [];
  for (const x of pubs.ativos()) {
    if (x.situacao !== 'publicada' || !x.publicada_em || !x.metricas_em) continue;
    const n = numerosDe(x);
    if (!temNumero(n)) continue;
    const data = diaEmBrasilia(new Date(x.publicada_em));
    if (data < periodo.inicio || data > periodo.fim) continue;
    const pedido = pedidos.porId(x.pedido_id);
    if (!pedido?.ativo) continue;
    linhas.push({ id: x.id, data, tipo: x.tipo, pedido: pedido.numero, ...n });
  }
  linhas.sort((a, b) => b.data.localeCompare(a.data) || a.pedido.localeCompare(b.pedido));
  return { linhas, medias: alcanceMedioPorTipo(linhas) };
}
