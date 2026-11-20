'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import {
  cancelarPedidoDeUso, decidirPolitica, decidirUsoDaReserva, ErroReserva, marcarRecomposicao, pedirUsoDaReserva, proporPolitica,
} from '@/modulos/orcamento/aplicacao/reserva';
import { CAMPOS_FAIXAS, type Faixas } from '@/modulos/orcamento/dominio/reserva';
import { lerValorEmReais } from '@/modulos/orcamento/dominio/tesouraria';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const PAGINA = '/orcamento/tesouraria/reserva';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroReserva || e instanceof ErroConflito || e instanceof ErroPermissao;
const mensagem = (e: unknown) => (e instanceof ErroConflito ? 'Alguém alterou este registro enquanto você olhava. Abra a página de novo.' : (e as Error).message);
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

/** Estado devolvido aos formulários: o erro fica na tela e o que a pessoa digitou não se apaga. */
export interface EstadoForm {
  erro?: string;
  ok?: string;
  /** O que a pessoa digitou, devolvido quando dá erro, para os campos não se apagarem. */
  valores?: Record<string, string>;
}

const digitado = (f: FormData, campos: string[]) => Object.fromEntries(campos.map((c) => [c, texto(f, c)]));

/** Ações de um botão só (aprovar, recusar, cancelar, recompor): voltam à página com `?ok=` ou `?erro=`. */
async function direto(sucesso: string, acao: (c: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  try {
    await acao(ctx);
    destino = `${PAGINA}?ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `${PAGINA}?erro=${encodeURIComponent(mensagem(erro))}`;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(destino);
}

export async function acaoProporPolitica(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const { usuario, app } = await contexto();
  const faixas = {} as Record<keyof Faixas, number>;
  for (const k of CAMPOS_FAIXAS) {
    const v = lerValorEmReais(texto(f, k));
    faixas[k] = v === null || v === 'invalido' ? Number.NaN : v;
  }
  try {
    await proporPolitica(app.planilhas, usuario.autorizador, faixas);
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    return { erro: mensagem(erro), valores: digitado(f, [...CAMPOS_FAIXAS]) };
  }
  revalidatePath('/orcamento', 'layout');
  return { ok: 'Proposta enviada para a Diretoria.' };
}

export async function acaoPedirUso(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const { usuario, app } = await contexto();
  const valor = lerValorEmReais(texto(f, 'valor'));
  const campos = ['valor', 'motivo', 'prazo'];
  if (valor === null || valor === 'invalido') return { erro: 'Informe o valor com números, como 1.500,00.', valores: digitado(f, campos) };
  const mes = texto(f, 'prazo');
  try {
    await pedirUsoDaReserva(app.planilhas, usuario.autorizador, { valor, motivo: texto(f, 'motivo'), prazo: mes });
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    return { erro: mensagem(erro), valores: digitado(f, campos) };
  }
  revalidatePath('/orcamento', 'layout');
  return { ok: 'Pedido enviado para a Diretoria.' };
}

export const acaoAprovarPolitica = (f: FormData) =>
  direto('Política aprovada. Ela vale a partir deste mês.', ({ usuario, app }) => decidirPolitica(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), 'aprovada'));
export const acaoRecusarPolitica = (f: FormData) =>
  direto('Proposta recusada.', ({ usuario, app }) => decidirPolitica(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), 'recusada', texto(f, 'motivo')));
export const acaoAprovarUso = (f: FormData) =>
  direto('Uso da reserva aprovado.', ({ usuario, app }) => decidirUsoDaReserva(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), 'aprovado'));
export const acaoRecusarUso = (f: FormData) =>
  direto('Pedido recusado.', ({ usuario, app }) => decidirUsoDaReserva(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), 'recusado', texto(f, 'motivo')));
export const acaoCancelarUso = (f: FormData) =>
  direto('Pedido cancelado.', ({ usuario, app }) => cancelarPedidoDeUso(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))));
export const acaoMarcarRecomposto = (f: FormData) =>
  direto('Recomposição registrada.', ({ usuario, app }) => marcarRecomposicao(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), texto(f, 'mes')));
