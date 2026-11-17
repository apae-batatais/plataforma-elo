'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { corrigirAplicacao, darCiente, desistirAplicacao, salvarAplicacao, type EntradaAplicacao } from '@/modulos/educacao/aplicacao/avaliacoes';
import { ErroEducacao } from '@/modulos/educacao/dominio/educacao';
import type { EstadoFormulario, ValoresIniciais } from '@/modulos/educacao/telas/formulario-aplicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const MSG_CONFLITO = 'Outra pessoa alterou esta avaliação enquanto você editava. Abra de novo para ver a versão atual.';

/** Salva o rascunho ou, com `concluir`, fecha e assina. Em erro, devolve o texto e a tela mantém tudo o que foi digitado. */
export async function acaoSalvarAplicacao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id') || undefined;
  const concluir = texto(f, 'concluir') === '1';
  let r;
  try {
    const d = JSON.parse(texto(f, 'dados') || '{}') as Partial<ValoresIniciais>;
    const entrada: EntradaAplicacao = {
      pessoaId: d.pessoaId ?? '',
      instrumento: d.instrumento ?? '',
      servico: d.servico ?? '',
      periodoInicio: d.periodoInicio,
      periodoFim: d.periodoFim,
      dataIngresso: d.dataIngresso,
      profissional: d.profissional,
      funcao: d.funcao,
      justificativa: d.justificativa,
      respostas: (d.respostas ?? {}) as Record<string, unknown>,
    };
    r = await salvarAplicacao(app.planilhas, usuario.autorizador, entrada, { id, versao: Number(texto(f, 'versao')) || undefined, concluir });
  } catch (erro) {
    if (erro instanceof ErroConflito) return { erro: MSG_CONFLITO };
    if (erro instanceof ErroEducacao || erro instanceof ErroPermissao) return { erro: erro.message };
    if (erro instanceof SyntaxError) return { erro: 'As respostas vieram incompletas. Tente de novo.' };
    throw erro;
  }
  revalidatePath('/educacao', 'layout');
  const msg = concluir ? `Avaliação concluída: ${r.resultado.total} de ${r.resultado.maximo} pontos.` : 'Rascunho salvo.';
  redirect(`/educacao/${r.id}?ok=${encodeURIComponent(msg)}`);
}

export async function acaoCorrigirAplicacao(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino: string;
  try {
    const nova = await corrigirAplicacao(app.planilhas, usuario.autorizador, id);
    destino = `/educacao/${nova.id}?ok=${encodeURIComponent('Correção criada. Ajuste o que precisar e conclua; a avaliação anterior fica no histórico.')}`;
  } catch (erro) {
    if (!(erro instanceof ErroEducacao || erro instanceof ErroPermissao)) throw erro;
    destino = `/educacao/${id}?erro=${encodeURIComponent(erro.message)}`;
  }
  revalidatePath('/educacao', 'layout');
  redirect(destino);
}

export async function acaoDesistirAplicacao(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/educacao?ok=${encodeURIComponent('Avaliação aberta descartada. O motivo ficou registrado.')}`;
  try {
    await desistirAplicacao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo'));
  } catch (erro) {
    if (!(erro instanceof ErroEducacao || erro instanceof ErroConflito || erro instanceof ErroPermissao)) throw erro;
    destino = `/educacao/${id}?erro=${encodeURIComponent(erro instanceof ErroConflito ? MSG_CONFLITO : erro.message)}`;
  }
  revalidatePath('/educacao', 'layout');
  redirect(destino);
}

export async function acaoDarCiente(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/educacao/${id}?ok=${encodeURIComponent('Ciente registrado.')}`;
  try {
    await darCiente(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')));
  } catch (erro) {
    if (!(erro instanceof ErroEducacao || erro instanceof ErroConflito || erro instanceof ErroPermissao)) throw erro;
    destino = `/educacao/${id}?erro=${encodeURIComponent(erro instanceof ErroConflito ? MSG_CONFLITO : erro.message)}`;
  }
  revalidatePath('/educacao', 'layout');
  redirect(destino);
}
