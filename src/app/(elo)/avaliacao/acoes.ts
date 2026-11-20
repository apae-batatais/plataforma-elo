'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { corrigirAplicacao, desistirDaAplicacao, salvarAplicacao } from '@/modulos/avaliacao/aplicacao/aplicacoes';
import type { EstadoAplicacao, ValoresAplicacao } from '@/modulos/avaliacao/telas/formulario-aplicacao';
import { ErroRespostas, retirarAvaliacao, salvarAvaliacao } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao, type DadosAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import type { EstadoFormulario } from '@/modulos/avaliacao/telas/formulario-avaliacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

export async function acaoSalvarAvaliacao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id') || undefined;
  let r: { id: string; indice: number };
  try {
    const dados = JSON.parse(texto(f, 'dados') || '{}') as Partial<DadosAvaliacao>;
    r = await salvarAvaliacao(app.planilhas, usuario.autorizador, dados, { id, versao: Number(texto(f, 'versao')) || undefined });
  } catch (erro) {
    if (erro instanceof ErroRespostas) return { erro: erro.message, faltando: erro.faltando };
    if (erro instanceof ErroConflito) return { erro: 'Outra pessoa alterou esta avaliação enquanto você editava. Abra de novo para ver a versão atual.' };
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) return { erro: erro.message };
    if (erro instanceof SyntaxError) return { erro: 'As respostas vieram incompletas. Tente de novo.' };
    throw erro;
  }
  revalidatePath('/avaliacao', 'layout');
  const msg = id ? 'Correção salva.' : `Avaliação salva. Índice de necessidade de cuidado: ${r.indice} de 12.`;
  redirect(`/avaliacao?ok=${encodeURIComponent(msg)}`);
}

export async function acaoRetirarAvaliacao(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/avaliacao?ok=${encodeURIComponent('Avaliação retirada. Ela não conta mais no painel.')}`;
  try {
    await retirarAvaliacao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo'));
  } catch (erro) {
    if (!(erro instanceof ErroAvaliacao || erro instanceof ErroConflito || erro instanceof ErroPermissao)) throw erro;
    const msg = erro instanceof ErroConflito ? 'Outra pessoa alterou esta avaliação. Abra de novo e tente outra vez.' : erro.message;
    destino = `/avaliacao/${id}?erro=${encodeURIComponent(msg)}`;
  }
  revalidatePath('/avaliacao', 'layout');
  redirect(destino);
}

const falhas = (erro: unknown) => erro instanceof ErroAvaliacao || erro instanceof ErroPermissao || erro instanceof ErroConflito;
const mensagemDe = (erro: unknown) =>
  erro instanceof ErroConflito ? 'Outra pessoa alterou esta aplicação enquanto você editava. Abra de novo para ver a versão atual.' : (erro as Error).message;

/** Salva o rascunho ou conclui e assina a aplicação de um instrumento a uma pessoa. */
export async function acaoSalvarAplicacao(_: EstadoAplicacao, f: FormData): Promise<EstadoAplicacao> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id') || undefined;
  const fechar = texto(f, 'intencao') === 'concluir';
  let resultado;
  try {
    const v = JSON.parse(texto(f, 'dados') || '{}') as ValoresAplicacao;
    resultado = await salvarAplicacao(
      app.planilhas,
      usuario.autorizador,
      {
        id,
        versao: Number(texto(f, 'versao')) || undefined,
        pessoaId: v.pessoaId ?? '',
        instrumento: texto(f, 'instrumento'),
        servico: v.servico ?? '',
        tipo: v.tipo ?? '',
        data: v.data ?? '',
        respostas: v.respostas ?? {},
        profissional: v.profissional,
        registroProfissional: v.registroProfissional,
        justificativa: v.justificativa,
      },
      fechar,
    );
  } catch (erro) {
    if (falhas(erro)) return { erro: mensagemDe(erro) };
    if (erro instanceof SyntaxError) return { erro: 'As respostas vieram incompletas. Tente de novo.' };
    throw erro;
  }
  revalidatePath('/avaliacao', 'layout');
  const msg = resultado.fechada ? 'Aplicação concluída e assinada.' : 'Rascunho salvo.';
  redirect(`/avaliacao/aplicacao/${resultado.id}?ok=${encodeURIComponent(msg)}`);
}

export async function acaoCorrigirAplicacao(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino: string;
  try {
    const nova = await corrigirAplicacao(app.planilhas, usuario.autorizador, id);
    destino = `/avaliacao/aplicacao/${nova.id}?ok=${encodeURIComponent('Correção aberta. A aplicação anterior continua no histórico.')}`;
  } catch (erro) {
    if (!falhas(erro)) throw erro;
    destino = `/avaliacao/aplicacao/${id}?erro=${encodeURIComponent(mensagemDe(erro))}`;
  }
  revalidatePath('/avaliacao', 'layout');
  redirect(destino);
}

export async function acaoDesistirAplicacao(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/avaliacao/instrumentos?ok=${encodeURIComponent('Aplicação retirada. Ela não conta mais.')}`;
  try {
    await desistirDaAplicacao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo'));
  } catch (erro) {
    if (!falhas(erro)) throw erro;
    destino = `/avaliacao/aplicacao/${id}?erro=${encodeURIComponent(mensagemDe(erro))}`;
  }
  revalidatePath('/avaliacao', 'layout');
  redirect(destino);
}
