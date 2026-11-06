'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { mudarSituacaoItemCalendario, salvarItemCalendario } from '@/modulos/comunicacao/aplicacao/calendario';
import { salvarAntecedencia } from '@/modulos/comunicacao/aplicacao/configuracoes';
import { ErroComunicacao, TIPOS_PECA, type TipoPeca } from '@/modulos/comunicacao/dominio/pedido';
import { diaEmBrasilia } from '@/modulos/comunicacao/dominio/prazos';
import { mesValido } from '@/modulos/comunicacao/telas/mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { esquecerAlertas } from '@/plataforma/alertas';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroComunicacao || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

const comMensagem = (pagina: string, chave: 'ok' | 'erro', mensagem: string) =>
  `${pagina}${pagina.includes('?') ? '&' : '?'}${chave}=${encodeURIComponent(mensagem)}`;

/** Executa e volta para a página com a mensagem no endereço (a notificação lê ?ok= e ?erro=). */
async function executar(pagina: (resultado: unknown) => string, erroEm: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
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
    tipos: f.getAll('tipos').map(String).filter((t): t is TipoPeca => (TIPOS_PECA as readonly string[]).includes(t)),
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
