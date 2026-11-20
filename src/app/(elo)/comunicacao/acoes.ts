'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroArquivo } from '@/nucleo/armazenamento/arquivos';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { iniciarEnvioAnexoComunicacao, type AnexoPedido } from '@/modulos/comunicacao/aplicacao/anexos';
import { mudarSituacaoItemCalendario, salvarItemCalendario } from '@/modulos/comunicacao/aplicacao/calendario';
import { mudarSituacaoContato, mudarSituacaoGrupo, salvarContato, salvarGrupo } from '@/modulos/comunicacao/aplicacao/contatos';
import { tentarEnvioDeNovo } from '@/modulos/comunicacao/aplicacao/envios';
import { salvarAntecedencia } from '@/modulos/comunicacao/aplicacao/configuracoes';
import { tentarDeNovo } from '@/modulos/comunicacao/aplicacao/publicacoes';
import { desconectarInstagram, iniciarConexaoInstagram } from '@/modulos/comunicacao/aplicacao/instagram';
import {
  ACOES_DA_DECISAO,
  ACOES_DA_REVISAO,
  cancelarPedido,
  decidirPedido,
  editarNaRevisao,
  enviarPedido,
  agendarPedido,
  juntarPedido,
  publicarPedido,
  reenviarPedido,
  revisarPedido,
  type DadosPedido,
} from '@/modulos/comunicacao/aplicacao/pedidos';
import type { TipoAnexo } from '@/modulos/comunicacao/dominio/anexos';
import { ErroComunicacao, TIPOS_PECA, type TipoPeca } from '@/modulos/comunicacao/dominio/pedido';
import { diaEmBrasilia } from '@/modulos/comunicacao/dominio/prazos';
import { mesValido } from '@/modulos/comunicacao/telas/mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { esquecerAlertas } from '@/plataforma/alertas';
import { configGeral } from '@/plataforma/instituicao';
import { provedorDeInstagram, retornoDoInstagram } from '@/plataforma/instagram';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroComunicacao || e instanceof ErroConflito || e instanceof ErroPermissao || e instanceof ErroArquivo;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

const comMensagem = (pagina: string, chave: 'ok' | 'erro', mensagem: string) =>
  `${pagina}${pagina.includes('?') ? '&' : '?'}${chave}=${encodeURIComponent(mensagem)}`;

/** Executa e volta para a página com a mensagem no endereço (a notificação lê ?ok= e ?erro=). */
async function executar(
  pagina: (resultado: unknown) => string,
  erroEm: string,
  sucesso: string,
  acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>,
) {
  const ctx = await contexto();
  let destino: string;
  try {
    const resultado = await acao(ctx);
    destino = `${comMensagem(pagina(resultado), 'ok', sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = comMensagem(erroEm, 'erro', (erro as Error).message);
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(destino);
}

/** Endereço do calendário que a pessoa estava vendo (mês e forma de ver vêm escondidos no formulário). */
function calendarioEm(f: FormData, mes?: string | null) {
  const visao = texto(f, 'visao') === 'lista' ? 'lista' : 'mes';
  const m = mes ?? mesValido(texto(f, 'mes')) ?? diaEmBrasilia(new Date()).slice(0, 7);
  return `/comunicacao/calendario?visao=${visao}&mes=${m}`;
}

export async function acaoSalvarItemCalendario(f: FormData) {
  const id = texto(f, 'id');
  const tipoData = texto(f, 'tipo_data') === 'periodo' ? 'periodo' : 'exata';
  const inicio = texto(f, 'inicio');
  // Em data exata o fim é o próprio dia; o campo de fim só vale para período.
  const fim = tipoData === 'exata' ? inicio : texto(f, 'fim');
  const dados = {
    id: id || undefined,
    versao: id ? Number(texto(f, 'versao')) : undefined,
    tema: texto(f, 'tema'),
    tipoData: tipoData as 'exata' | 'periodo',
    inicio,
    fim,
    tipos: f
      .getAll('tipos')
      .map(String)
      .filter((t): t is TipoPeca => (TIPOS_PECA as readonly string[]).includes(t)),
    observacao: texto(f, 'observacao') || null,
  };
  const mesDoItem = mesValido(inicio.slice(0, 7));
  await executar(
    () => calendarioEm(f, mesDoItem),
    `${calendarioEm(f)}${id ? `&editar=${id}` : ''}`,
    id ? 'Item do calendário salvo.' : 'Item adicionado ao calendário.',
    ({ usuario, app }) => salvarItemCalendario(app.planilhas, usuario.autorizador, dados),
  );
}

export async function acaoDesativarItemCalendario(f: FormData) {
  await executar(
    () => calendarioEm(f),
    calendarioEm(f),
    'Item desativado. Ele fica guardado e pode ser reativado.',
    ({ usuario, app }) => mudarSituacaoItemCalendario(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarItemCalendario(f: FormData) {
  await executar(
    () => calendarioEm(f),
    calendarioEm(f),
    'Item reativado.',
    ({ usuario, app }) => mudarSituacaoItemCalendario(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export async function acaoSalvarAntecedencia(f: FormData) {
  const t = texto(f, 'dias').replace(',', '.');
  const v = texto(f, 'versao');
  await executar(
    () => '/comunicacao/configuracoes',
    '/comunicacao/configuracoes',
    'Antecedência mínima salva.',
    ({ usuario, app }) => salvarAntecedencia(app.planilhas, usuario.autorizador, t === '' ? Number.NaN : Number(t), { versao: v === '' ? null : Number(v) }),
  );
}

/** Leva a pessoa à Meta para autorizar (na demonstração, volta direto com uma conta fictícia). */
export async function acaoConectarInstagram() {
  const { usuario, app } = await contexto();
  const pagina = '/comunicacao/configuracoes';
  const provedor = provedorDeInstagram(configGeral());
  if (!provedor) redirect(comMensagem(pagina, 'erro', 'A ligação com o Instagram ainda não foi configurada pela Operadora do Elo.'));
  let destino: string;
  try {
    destino = await iniciarConexaoInstagram(provedor, app.config.segredoSessao, usuario.autorizador, app.instituicao.codigo, await retornoDoInstagram());
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = comMensagem(pagina, 'erro', (erro as Error).message);
  }
  redirect(destino);
}

export async function acaoDesconectarInstagram() {
  await executar(
    () => '/comunicacao/configuracoes',
    '/comunicacao/configuracoes',
    'Instagram desconectado. O Elo deixa de publicar até você conectar de novo.',
    ({ usuario, app }) => desconectarInstagram(app.planilhas, usuario.autorizador, app.instituicao.codigo),
  );
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export interface EstadoPedido {
  erro?: string;
}

/** Anexos que o formulário manda (JSON). Sem o campo, os anexos que já existem ficam como estão. */
function lerAnexos(f: FormData): AnexoPedido[] | undefined {
  const t = texto(f, 'anexos');
  if (!t) return undefined;
  const incompleto = new ErroComunicacao('Os anexos vieram incompletos. Tente de novo.');
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    throw incompleto;
  }
  if (!Array.isArray(v)) throw incompleto;
  return v.map((x: { arquivoId?: unknown; tipo?: unknown; nome?: unknown }) => {
    if (typeof x?.arquivoId !== 'string' || (x.tipo !== 'foto' && x.tipo !== 'documento')) throw incompleto;
    return { arquivoId: x.arquivoId, tipo: x.tipo, ...(typeof x.nome === 'string' ? { nome: x.nome } : {}) };
  });
}

/** Abre o envio de uma foto ou documento: o navegador manda o arquivo direto para a pasta de anexos. */
export async function acaoIniciarEnvioAnexo(a: { tipo: TipoAnexo; mime: string; tamanho: number }): Promise<{ url?: string; erro?: string }> {
  const { usuario, app } = await contexto();
  const h = await headers();
  const origem = h.get('origin') ?? `https://${h.get('x-forwarded-host') ?? h.get('host')}`;
  try {
    return await iniciarEnvioAnexoComunicacao(app.planilhas, usuario.autorizador, app.arquivos, { ...a, origem });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}

function lerPedido(f: FormData): DadosPedido {
  return {
    area: texto(f, 'area'),
    calendarioId: texto(f, 'calendario_id') || null,
    tipoPeca: texto(f, 'tipo_peca') as TipoPeca,
    titulo: texto(f, 'titulo'),
    descricao: texto(f, 'descricao'),
    dataDesejada: texto(f, 'data_desejada'),
    linkVideo: texto(f, 'link_video') || null,
    imagemConfirmada: f.get('imagem_confirmada') === 'on',
    anexos: lerAnexos(f),
  };
}

export async function acaoEnviarPedido(_: EstadoPedido, f: FormData): Promise<EstadoPedido> {
  const { usuario, app } = await contexto();
  let r: { id: string; numero: string; urgente: boolean };
  try {
    r = await enviarPedido(app.planilhas, usuario.autorizador, { ...lerPedido(f), nomeSolicitante: usuario.nome }, { arquivos: app.arquivos });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  const aviso = r.urgente ? ' Ele foi marcado como urgente.' : '';
  redirect(`/comunicacao/${r.id}?ok=${encodeURIComponent(`Pedido ${r.numero} enviado. Agora aguarda a revisão da Comunicação.${aviso}`)}`);
}

export async function acaoReenviarPedido(_: EstadoPedido, f: FormData): Promise<EstadoPedido> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  try {
    await reenviarPedido(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), lerPedido(f), { arquivos: app.arquivos });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(`/comunicacao/${id}?ok=${encodeURIComponent('Pedido ajustado e reenviado. Ele volta para a revisão da Comunicação.')}`);
}

export async function acaoCancelarPedido(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => '/comunicacao',
    `/comunicacao/${id}`,
    'Pedido cancelado. Ele fica guardado no histórico.',
    ({ usuario, app }) => cancelarPedido(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))),
  );
}

// ---------------------------------------------------------------------------
// Revisão e aprovação
// ---------------------------------------------------------------------------

const MENSAGEM_ACAO: Record<string, string> = {
  iniciar_revisao: 'Revisão iniciada. O pedido está com você.',
  enviar_aprovacao: 'Pedido enviado para aprovação da coordenação.',
  devolver: 'Pedido devolvido para quem pediu ajustar.',
  recusar: 'Pedido recusado. Ele fica guardado no histórico.',
  aprovar: 'Pedido aprovado. Agora ele aguarda o agendamento.',
  pedir_ajustes: 'Ajustes pedidos. O pedido volta para a revisão da Comunicação.',
};

export async function acaoRevisarPedido(f: FormData) {
  const id = texto(f, 'id');
  const acao = texto(f, 'acao');
  if (!(ACOES_DA_REVISAO as readonly string[]).includes(acao)) return void redirect(comMensagem(`/comunicacao/${id}`, 'erro', 'Ação inválida.'));
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    MENSAGEM_ACAO[acao] ?? 'Feito.',
    ({ usuario, app }) =>
      revisarPedido(
        app.planilhas,
        usuario.autorizador,
        id,
        Number(texto(f, 'versao')),
        acao as (typeof ACOES_DA_REVISAO)[number],
        texto(f, 'comentario') || null,
      ),
  );
}

export async function acaoDecidirPedido(f: FormData) {
  const id = texto(f, 'id');
  const decisao = texto(f, 'acao');
  if (!(ACOES_DA_DECISAO as readonly string[]).includes(decisao)) return void redirect(comMensagem(`/comunicacao/${id}`, 'erro', 'Ação inválida.'));
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    MENSAGEM_ACAO[decisao] ?? 'Feito.',
    ({ usuario, app }) =>
      decidirPedido(
        app.planilhas,
        usuario.autorizador,
        id,
        Number(texto(f, 'versao')),
        decisao as (typeof ACOES_DA_DECISAO)[number],
        texto(f, 'comentario') || null,
      ),
  );
}

export async function acaoJuntarPedido(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    'Pedido juntado. Ele fica guardado com o número do pedido de destino.',
    ({ usuario, app }) =>
      juntarPedido(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'destino_id'), texto(f, 'comentario') || null),
  );
}

const NOVO_TEMA = '__novo__';

export async function acaoEditarNaRevisao(_: EstadoPedido, f: FormData): Promise<EstadoPedido> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  const novo = texto(f, 'calendario_id') === NOVO_TEMA;
  const tipoData = texto(f, 'tipo_data') === 'periodo' ? 'periodo' : 'exata';
  const inicio = texto(f, 'inicio');
  const novoTema = {
    tema: texto(f, 'novo_tema'),
    tipoData: tipoData as 'exata' | 'periodo',
    inicio,
    fim: tipoData === 'exata' ? inicio : texto(f, 'fim'),
    tipos: f
      .getAll('tipos')
      .map(String)
      .filter((t): t is TipoPeca => (TIPOS_PECA as readonly string[]).includes(t)),
    observacao: null,
  };
  try {
    await editarNaRevisao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), {
      titulo: texto(f, 'titulo'),
      descricao: texto(f, 'descricao'),
      tipoPeca: texto(f, 'tipo_peca') as TipoPeca,
      calendarioId: novo ? null : texto(f, 'calendario_id') || null,
      dataDesejada: texto(f, 'data_desejada'),
      anexos: lerAnexos(f),
      ...(novo ? { novoTema } : {}),
    }, { arquivos: app.arquivos });
  } catch (erro) {
    if (conhecido(erro)) {
      const aviso =
        novo && erro instanceof ErroConflito
          ? ' Se o tema novo chegou a ser criado, ele já está no calendário: abra o pedido de novo e escolha-o na lista.'
          : '';
      return { erro: (erro as Error).message + aviso };
    }
    throw erro;
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(`/comunicacao/${id}?ok=${encodeURIComponent('Alterações salvas no histórico do pedido.')}`);
}

// ---------------------------------------------------------------------------
// Contatos da imprensa
// ---------------------------------------------------------------------------

const CONTATOS = '/comunicacao/contatos';

export async function acaoSalvarContato(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => CONTATOS,
    `${CONTATOS}${id ? `?contato=${id}` : ''}`,
    id ? 'Contato salvo.' : 'Contato adicionado.',
    ({ usuario, app }) =>
      salvarContato(app.planilhas, usuario.autorizador, {
        id: id || undefined,
        versao: id ? Number(texto(f, 'versao')) : undefined,
        nome: texto(f, 'nome'),
        veiculo: texto(f, 'veiculo') || null,
        email: texto(f, 'email'),
        grupos: f.getAll('grupos').map(String),
      }),
  );
}

export async function acaoSalvarGrupo(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => CONTATOS,
    `${CONTATOS}${id ? `?grupo=${id}` : ''}`,
    id ? 'Grupo salvo.' : 'Grupo adicionado.',
    ({ usuario, app }) =>
      salvarGrupo(app.planilhas, usuario.autorizador, { id: id || undefined, versao: id ? Number(texto(f, 'versao')) : undefined, nome: texto(f, 'nome') }),
  );
}

const situacaoContato = (ativo: boolean, mensagem: string) => async (f: FormData) =>
  executar(
    () => CONTATOS,
    CONTATOS,
    mensagem,
    ({ usuario, app }) => mudarSituacaoContato(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), ativo),
  );
const situacaoGrupo = (ativo: boolean, mensagem: string) => async (f: FormData) =>
  executar(
    () => CONTATOS,
    CONTATOS,
    mensagem,
    ({ usuario, app }) => mudarSituacaoGrupo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), ativo),
  );

export async function acaoDesativarContato(f: FormData) {
  await situacaoContato(false, 'Contato desativado. Ele fica guardado e pode ser reativado.')(f);
}
export async function acaoReativarContato(f: FormData) {
  await situacaoContato(true, 'Contato reativado.')(f);
}
export async function acaoDesativarGrupo(f: FormData) {
  await situacaoGrupo(false, 'Grupo desativado. Ele fica guardado e pode ser reativado.')(f);
}
export async function acaoReativarGrupo(f: FormData) {
  await situacaoGrupo(true, 'Grupo reativado.')(f);
}

// ---------------------------------------------------------------------------
// Agendamento e publicação
// ---------------------------------------------------------------------------

export async function acaoAgendarPedido(f: FormData) {
  const id = texto(f, 'id');
  const quando = texto(f, 'quando');
  // O campo do navegador manda AAAA-MM-DDTHH:mm, sem fuso: vale o horário de Brasília.
  const comFuso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando) ? `${quando}:00-03:00` : '';
  const reagendando = texto(f, 'reagendando') === '1';
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    reagendando ? 'Data do agendamento alterada.' : 'Pedido agendado.',
    ({ usuario, app }) =>
      agendarPedido(
        app.planilhas,
        usuario.autorizador,
        id,
        Number(texto(f, 'versao')),
        {
          agendadoPara: comFuso,
          grupos: f.getAll('grupos').map(String),
          contatos: f.getAll('contatos').map(String),
          envioAutomatico: texto(f, 'como_enviar') === 'elo',
          publicarPeloElo: texto(f, 'como') === 'elo',
        },
        { emailDisponivel: app.email !== null, instituicao: app.instituicao.codigo },
      ),
  );
}

/** Põe de novo na fila a publicação do Instagram que falhou. */
export async function acaoTentarDeNovoPublicacao(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    'Publicação colocada na fila de novo. Ela sai na próxima rodada, em até 15 minutos.',
    ({ usuario, app }) => tentarDeNovo(app.planilhas, usuario.autorizador, id, app.instituicao.codigo),
  );
}

export async function acaoTentarEnvioDeNovo(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    'Envio na fila. O Elo tenta de novo na próxima rodada (até 15 minutos).',
    ({ usuario, app }) => tentarEnvioDeNovo(app.planilhas, usuario.autorizador, texto(f, 'envio'), Number(texto(f, 'versao_envio'))),
  );
}

export async function acaoPublicarPedido(f: FormData) {
  const id = texto(f, 'id');
  await executar(
    () => `/comunicacao/${id}`,
    `/comunicacao/${id}`,
    'Publicação registrada.',
    ({ usuario, app }) =>
      publicarPedido(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), { link: texto(f, 'link') || null, comentario: texto(f, 'comentario') || null }),
  );
}
