/**
 * Publicação automática no Instagram (ADR-028, entrega 2: post com imagem).
 *
 * - Ao agendar com "Publicar pelo Elo", nasce uma `Publicacao` pendente (só uma viva por pedido).
 * - A rotina (`rodarPublicacoes`) publica na hora marcada, em duas etapas da Meta, e nunca publica o mesmo
 *   pedido duas vezes: a linha vira "publicando" antes de falar com a Meta, com a versão lida.
 * - A mídia vai à Meta por um endereço temporário (`abrirMidiaTemporaria`), de uso único e até 1 hora.
 * - O token nunca sai desta camada: tela, rota, log, erro e auditoria não o mostram.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { TRECHO_MAXIMO } from '@/nucleo/armazenamento/leitura-de-anexo';
import { atualizar, ErroConflito, inserir, lerTabelas, type Autoria, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { segredoDaCredencial, situacaoPublicaDaCredencial } from '@/nucleo/credenciais/credenciais';
import { ErroInstagram } from '@/nucleo/credenciais/instagram';
import { MENSAGEM_SEM_RESPOSTA, type PublicadorInstagram } from '@/nucleo/credenciais/instagram-publicacao';
import {
  AnexosComunicacao,
  HistoricoComunicacao,
  PedidosComunicacao,
  PublicacoesComunicacao,
  type RegPedido,
  type RegPublicacao,
} from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';
import {
  ATRASO_PARA_AVISAR_MIN,
  conferirLegenda,
  imagemAceita,
  MAX_POR_CONTA_EM_24H,
  MAX_POR_RODADA,
  proximaTentativa,
  venceMidiaEm,
} from '../dominio/publicacao';

const PERM_REVISAR = 'comunicacao.revisar';
const SISTEMA = 'sistema';
const MIN = 60_000;
const DIA = 24 * 60 * MIN;

export const MENSAGEM_SEM_MIDIA = 'O pedido não tem a foto exigida pelo Instagram.';
export const MENSAGEM_SO_JPG = 'A foto precisa ser JPG para o Instagram. Ajuste o pedido e anexe a foto de novo.';

const resumo = (codigo: string) => createHash('sha256').update(codigo).digest('hex');

/** A foto do pedido que vai para o Instagram (a primeira foto ativa). */
async function fotoDoPedido(p: Planilhas, pedidoId: string) {
  const [anexos] = await lerTabelas(p, [AnexosComunicacao] as const);
  return anexos.ativos().find((a) => a.pedido_id === pedidoId && a.tipo === 'foto') ?? null;
}

/** Confere se o pedido pode sair pelo Elo. Chamado ao agendar. Nada é gravado. */
export async function conferirPublicacaoAutomatica(p: Planilhas, r: RegPedido, instituicao: string, agora: Date): Promise<void> {
  if (r.tipo_peca !== 'post_instagram') throw new ErroComunicacao('A publicação pelo Elo ainda vale só para post com imagem. Publique este pedido à mão.');
  const situacao = await situacaoPublicaDaCredencial(p, instituicao, 'instagram', agora);
  if (situacao === 'nenhuma' || situacao === 'expirada') {
    throw new ErroComunicacao('O Instagram da instituição não está conectado. A coordenação conecta em Configurações.');
  }
  const foto = await fotoDoPedido(p, r.id);
  if (!foto) throw new ErroComunicacao(MENSAGEM_SEM_MIDIA);
  if (!imagemAceita(foto.mime)) throw new ErroComunicacao(MENSAGEM_SO_JPG);
  const erro = conferirLegenda(r.descricao);
  if (erro) throw new ErroComunicacao(erro);
}

/** Pode oferecer "Publicar pelo Elo" neste pedido? (para a tela; não revela conta nem segredo) */
export async function publicacaoAutomaticaDisponivel(
  p: Planilhas,
  quem: Autorizador,
  r: RegPedido,
  instituicao: string,
  agora = new Date(),
): Promise<{ disponivel: true } | { disponivel: false; motivo: string }> {
  if (!quem.temPermissao(PERM_REVISAR)) throw new ErroPermissao();
  try {
    await conferirPublicacaoAutomatica(p, r, instituicao, agora);
    return { disponivel: true };
  } catch (e) {
    if (e instanceof ErroComunicacao) return { disponivel: false, motivo: e.message };
    throw e;
  }
}

const autoriaDe = (email: string, agora: Date): Autoria => ({ email, agora: () => agora });
const VIVAS: ReadonlySet<string> = new Set(['pendente', 'publicando', 'falhou']);

/**
 * Depois de agendar ou reagendar: cria ou atualiza a publicação pendente (automática) ou encerra as vivas
 * (à mão). Reagendar nunca cria segunda publicação.
 */
export async function sincronizarPublicacao(
  p: Planilhas,
  quem: Autorizador,
  pedidoId: string,
  d: { automatica: boolean; previstaPara: string },
  agora: Date,
): Promise<void> {
  const [tabela] = await lerTabelas(p, [PublicacoesComunicacao] as const);
  const vivas = tabela.ativos().filter((x) => x.pedido_id === pedidoId && VIVAS.has(x.situacao));
  if (vivas.some((x) => x.situacao === 'publicando')) {
    throw new ErroComunicacao('A publicação no Instagram está em andamento. Espere terminar para mudar o agendamento.');
  }
  const pendente = vivas.find((x) => x.situacao === 'pendente');
  const autoria = autoriaDe(quem.email, agora);
  for (const x of vivas) {
    if (d.automatica && x === pendente) continue;
    const r = await atualizar(p, PublicacoesComunicacao, x.id, x.versao, { situacao: 'cancelada', codigo_midia: null, midia_vence_em: null }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'PublicacoesComunicacao', registroId: x.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
  }
  if (!d.automatica) return;
  if (pendente) {
    const r = await atualizar(p, PublicacoesComunicacao, pendente.id, pendente.versao, { prevista_para: d.previstaPara, tentativas: 0, proxima_tentativa: null, erro: null }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'PublicacoesComunicacao', registroId: pendente.id, detalhes: { colunas: r.colunasAlteradas } }, agora);
    return;
  }
  const nova = await inserir(
    p,
    PublicacoesComunicacao,
    { pedido_id: pedidoId, tipo: 'post', prevista_para: d.previstaPara, situacao: 'pendente', tentativas: 0, proxima_tentativa: null, container_id: null, post_id: null, link: null, erro: null, publicada_em: null, codigo_midia: null, midia_vence_em: null },
    autoria,
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'PublicacoesComunicacao', registroId: nova.id, detalhes: { colunas: ['pedido_id', 'tipo', 'prevista_para', 'situacao', 'tentativas'] } }, agora);
}

/** Visão da publicação de um pedido para a tela (sem códigos). Só `comunicacao.revisar`. */
export interface VisaoDaPublicacao {
  situacao: RegPublicacao['situacao'];
  previstaPara: string;
  tentativas: number;
  erro: string | null;
  link: string | null;
  publicadaEm: string | null;
  /** Passou de 1 hora da hora marcada e ainda não saiu. */
  atrasada: boolean;
  versao: number;
}

export async function publicacaoDoPedido(p: Planilhas, quem: Autorizador, pedidoId: string, agora = new Date()): Promise<VisaoDaPublicacao | null> {
  if (!quem.temPermissao(PERM_REVISAR)) return null;
  const [tabela] = await lerTabelas(p, [PublicacoesComunicacao] as const);
  const todas = tabela.ativos().filter((x) => x.pedido_id === pedidoId && x.situacao !== 'cancelada');
  const x = todas.sort((a, b) => a.criado_em.localeCompare(b.criado_em)).at(-1);
  if (!x) return null;
  return {
    situacao: x.situacao,
    previstaPara: x.prevista_para,
    tentativas: x.tentativas,
    erro: x.erro,
    link: x.link,
    publicadaEm: x.publicada_em,
    atrasada: (x.situacao === 'pendente' || x.situacao === 'publicando') && new Date(x.prevista_para).getTime() + ATRASO_PARA_AVISAR_MIN * MIN < agora.getTime(),
    versao: x.versao,
  };
}

/** Quantas publicações falharam ou estão atrasadas, e se a conta precisa ser reconectada (aviso no início). */
export async function problemasDePublicacao(p: Planilhas, quem: Autorizador, instituicao: string, agora = new Date()) {
  if (!quem.temPermissao(PERM_REVISAR)) return { falharam: 0, atrasadas: 0, reconectar: false };
  const [pubs, pedidos] = await lerTabelas(p, [PublicacoesComunicacao, PedidosComunicacao] as const);
  const agendados = new Set(pedidos.ativos().filter((r) => r.situacao === 'agendado').map((r) => r.id));
  const vivas = pubs.ativos().filter((x) => agendados.has(x.pedido_id));
  const situacao = await situacaoPublicaDaCredencial(p, instituicao, 'instagram', agora);
  return {
    falharam: vivas.filter((x) => x.situacao === 'falhou').length,
    atrasadas: vivas.filter((x) => (x.situacao === 'pendente' || x.situacao === 'publicando') && new Date(x.prevista_para).getTime() + ATRASO_PARA_AVISAR_MIN * MIN < agora.getTime()).length,
    reconectar: vivas.length > 0 && (situacao === 'expirada' || situacao === 'expirando'),
  };
}

/** "Tentar de novo": volta a publicação que falhou para a fila, com as tentativas zeradas. */
export async function tentarDeNovo(p: Planilhas, quem: Autorizador, pedidoId: string, instituicao: string, agora = new Date()): Promise<void> {
  if (!quem.temPermissao(PERM_REVISAR)) throw new ErroPermissao();
  const [pubs, pedidos] = await lerTabelas(p, [PublicacoesComunicacao, PedidosComunicacao] as const);
  const r = pedidos.porId(pedidoId);
  if (!r || !r.ativo) throw new ErroComunicacao('Pedido não encontrado.');
  const x = pubs.ativos().find((y) => y.pedido_id === pedidoId && y.situacao === 'falhou');
  if (r.situacao !== 'agendado' || !x) throw new ErroComunicacao('Não há publicação que tenha falhado neste pedido.');
  await conferirPublicacaoAutomatica(p, r, instituicao, agora);
  const res = await atualizar(p, PublicacoesComunicacao, x.id, x.versao, { situacao: 'pendente', tentativas: 0, proxima_tentativa: null, erro: null, container_id: null, codigo_midia: null, midia_vence_em: null }, autoriaDe(quem.email, agora));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'PublicacoesComunicacao', registroId: x.id, detalhes: { colunas: res.colunasAlteradas } }, agora);
  await inserir(p, HistoricoComunicacao, { pedido_id: pedidoId, em: agora.toISOString(), usuario: quem.email, acao: 'tentar_de_novo', de: 'agendado', para: 'agendado', comentario: null }, autoriaDe(quem.email, agora));
}

// ---------------------------------------------------------------------------
// Mídia temporária (rota pública, sem login)
// ---------------------------------------------------------------------------

/** Código aleatório (32 bytes) da mídia temporária; leva a instituição na frente para a rota achar a planilha certa. */
export const novoCodigoDeMidia = (instituicao: string): string => `${instituicao}.${randomBytes(32).toString('base64url')}`;

/** Instituição de um código (só para a rota escolher a planilha); não prova nada. */
export const instituicaoDoCodigo = (codigo: string): string | null => {
  const i = codigo.indexOf('.');
  return i > 0 ? codigo.slice(0, i) : null;
};

/**
 * Abre a mídia de um código temporário. Código inexistente, vencido ou encerrado devolve null (sem pista do
 * motivo). Cada entrega vai para a auditoria como leitura de dado sensível.
 */
export async function abrirMidiaTemporaria(p: Planilhas, arquivos: ArmazenamentoArquivos | null, codigo: string, agora = new Date()) {
  if (!arquivos || codigo.length < 40 || codigo.length > 200) return null;
  const [pubs] = await lerTabelas(p, [PublicacoesComunicacao] as const);
  const h = resumo(codigo);
  const x = pubs.ativos().find((y) => y.codigo_midia === h);
  if (!x || x.situacao !== 'publicando' || !x.midia_vence_em || new Date(x.midia_vence_em).getTime() <= agora.getTime()) return null;
  const foto = await fotoDoPedido(p, x.pedido_id);
  if (!foto) return null;
  await registrarAuditoria(p, { usuario: 'midia-temporaria', acao: 'leitura', entidade: 'AnexosComunicacao', registroId: foto.id }, agora);
  return {
    tipo: foto.mime,
    total: foto.tamanho,
    lerTrecho: (inicio: number) => arquivos.ler(foto.arquivo_id, { inicio, fim: Math.min(inicio + TRECHO_MAXIMO, foto.tamanho) - 1 }),
  };
}

// ---------------------------------------------------------------------------
// Rotina
// ---------------------------------------------------------------------------

export interface ContextoDaPublicacao {
  instituicao: string;
  publicador: PublicadorInstagram;
  /** Endereço público do Elo (sem barra no fim), de onde a Meta baixa a mídia. */
  urlBase: string;
  /** Chave mestra das credenciais (só nos testes; em produção vem do ambiente). */
  segredo?: string;
}

const motivoDe = (e: unknown) => (e instanceof ErroInstagram ? e.message : MENSAGEM_SEM_RESPOSTA);

/**
 * Uma rodada da rotina para uma instituição: publica o que chegou na hora, acompanha o que está sendo
 * publicado e trata as falhas (até 3 tentativas, +15 e +60 minutos). Devolve só contagens.
 */
export async function rodarPublicacoes(p: Planilhas, ctx: ContextoDaPublicacao, agora = new Date()): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  const conta = (k: string) => {
    r[k] = (r[k] ?? 0) + 1;
  };
  const [tabela] = await lerTabelas(p, [PublicacoesComunicacao] as const);
  const abertas = tabela
    .ativos()
    .filter((x) => x.situacao === 'pendente' || x.situacao === 'publicando')
    .sort((a, b) => a.prevista_para.localeCompare(b.prevista_para));
  if (abertas.length === 0) return r;
  const autoria = autoriaDe(SISTEMA, agora);
  const credencial = await segredoDaCredencial(p, ctx.instituicao, 'instagram', { agora, segredo: ctx.segredo });
  const publicadasEm24h = tabela.ativos().filter((x) => x.situacao === 'publicada' && x.publicada_em && agora.getTime() - new Date(x.publicada_em).getTime() < DIA).length;
  let noDia = publicadasEm24h;
  let iniciadas = 0;

  const gravar = async (x: RegPublicacao, mudancas: Parameters<typeof atualizar<typeof PublicacoesComunicacao.esquema>>[4]): Promise<RegPublicacao> => {
    const res = await atualizar(p, PublicacoesComunicacao, x.id, x.versao, mudancas, autoria);
    await registrarAuditoria(p, { usuario: SISTEMA, acao: 'alteracao', entidade: 'PublicacoesComunicacao', registroId: x.id, detalhes: { colunas: res.colunasAlteradas } }, agora);
    return res.registro;
  };

  const falhar = async (x: RegPublicacao, motivo: string) => {
    const prox = proximaTentativa(x.tentativas, agora);
    const limpa = { erro: motivo, codigo_midia: null, midia_vence_em: null, container_id: null };
    if (prox) {
      await gravar(x, { ...limpa, situacao: 'pendente', proxima_tentativa: prox.toISOString() });
      conta('novas_tentativas');
      return;
    }
    await gravar(x, { ...limpa, situacao: 'falhou', proxima_tentativa: null });
    await inserir(p, HistoricoComunicacao, { pedido_id: x.pedido_id, em: agora.toISOString(), usuario: SISTEMA, acao: 'publicacao_falhou', de: 'agendado', para: 'agendado', comentario: motivo }, autoria);
    conta('falharam');
  };

  for (const original of abertas) {
    try {
      let x = original;
      // Pedido que deixou de valer (publicado à mão, por exemplo): encerra a publicação.
      const [pedidos] = await lerTabelas(p, [PedidosComunicacao] as const);
      const pedido = pedidos.porId(x.pedido_id);
      if (!pedido || !pedido.ativo || pedido.situacao !== 'agendado' || !pedido.publicacao_automatica) {
        await gravar(x, { situacao: 'cancelada', codigo_midia: null, midia_vence_em: null });
        conta('canceladas');
        continue;
      }
      if (x.situacao === 'pendente') {
        if (new Date(x.prevista_para).getTime() > agora.getTime()) continue;
        if (x.proxima_tentativa && new Date(x.proxima_tentativa).getTime() > agora.getTime()) continue;
        if (!credencial) {
          conta('aguardando_conta');
          continue;
        }
        if (noDia >= MAX_POR_CONTA_EM_24H || iniciadas >= MAX_POR_RODADA) {
          conta('adiadas');
          continue;
        }
        iniciadas += 1;
        noDia += 1;
        const codigo = novoCodigoDeMidia(ctx.instituicao);
        // Primeiro marca "publicando" (com a versão lida): se outra rodada pegou antes, dá conflito e esta desiste.
        x = await gravar(x, {
          situacao: 'publicando',
          tentativas: x.tentativas + 1,
          codigo_midia: resumo(codigo),
          midia_vence_em: venceMidiaEm(agora).toISOString(),
          erro: null,
          proxima_tentativa: null,
        });
        // Confere que a linha ficou mesmo com esta rodada (a planilha não tem trava): se outra rodada gravou
        // por cima, esta desiste e nada é enviado à Meta.
        const [conferida] = await lerTabelas(p, [PublicacoesComunicacao] as const);
        if (conferida.porId(x.id)?.codigo_midia !== resumo(codigo)) {
          conta('conflitos');
          continue;
        }
        try {
          const foto = await fotoDoPedido(p, x.pedido_id);
          if (!foto) throw new ErroInstagram(MENSAGEM_SEM_MIDIA);
          if (!imagemAceita(foto.mime)) throw new ErroInstagram(MENSAGEM_SO_JPG);
          const id = await ctx.publicador.criarContainerDeImagem(credencial.valor, `${ctx.urlBase}/api/midia-temporaria/${codigo}`, pedido.descricao);
          x = await gravar(x, { container_id: id });
        } catch (e) {
          await falhar(x, motivoDe(e));
          continue;
        }
      } else if (!credencial) {
        conta('aguardando_conta');
        continue;
      }

      // Publicando: acompanha o contêiner e publica quando a Meta terminar de processar.
      try {
        if (!x.container_id) {
          // Parou entre marcar e criar o contêiner: espera o código vencer e tenta de novo.
          if (x.midia_vence_em && new Date(x.midia_vence_em).getTime() <= agora.getTime()) await falhar(x, MENSAGEM_SEM_RESPOSTA);
          continue;
        }
        let postId = x.post_id;
        if (!postId) {
          const status = await ctx.publicador.statusDoContainer(credencial!.valor, x.container_id);
          if (status === 'processando') {
            if (x.midia_vence_em && new Date(x.midia_vence_em).getTime() <= agora.getTime()) await falhar(x, MENSAGEM_SEM_RESPOSTA);
            else conta('processando');
            continue;
          }
          if (status === 'erro') {
            await falhar(x, 'A imagem não foi aceita pelo Instagram.');
            continue;
          }
          postId = await ctx.publicador.publicar(credencial!.valor, x.container_id);
          x = await gravar(x, { post_id: postId });
        }
        // Já publicado na Meta: só consulta o link, nunca recria.
        const link = await ctx.publicador.linkDoPost(credencial!.valor, postId);
        x = await gravar(x, { situacao: 'publicada', link, publicada_em: agora.toISOString(), codigo_midia: null, midia_vence_em: null, erro: null });
        const [peds] = await lerTabelas(p, [PedidosComunicacao] as const);
        const atual = peds.porId(x.pedido_id)!;
        const res = await atualizar(p, PedidosComunicacao, atual.id, atual.versao, { situacao: 'publicado', link_publicacao: link, publicado_em: agora.toISOString() }, autoria);
        await inserir(p, HistoricoComunicacao, { pedido_id: x.pedido_id, em: agora.toISOString(), usuario: SISTEMA, acao: 'publicar', de: 'agendado', para: 'publicado', comentario: 'Publicado pelo Elo no Instagram.' }, autoria);
        await registrarAuditoria(p, { usuario: SISTEMA, acao: 'alteracao', entidade: 'PedidosComunicacao', registroId: atual.id, detalhes: { colunas: res.colunasAlteradas } }, agora);
        conta('publicadas');
      } catch (e) {
        if (e instanceof ErroConflito) throw e;
        // Se a Meta já devolveu o post, nunca falha nem recria: a próxima rodada só consulta o link.
        if (x.post_id) conta('aguardando_link');
        else await falhar(x, motivoDe(e));
      }
    } catch (e) {
      if (e instanceof ErroConflito) {
        conta('conflitos');
        continue;
      }
      throw e;
    }
  }
  return r;
}
