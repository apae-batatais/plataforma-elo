'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { darCiente, desistirDaAplicacao, salvarAplicacao, type DadosAplicacao } from '@/modulos/saude/aplicacao/avaliacoes';
import { ErroSaude } from '@/modulos/saude/dominio/cer';
import type { EstadoFormulario } from '@/modulos/saude/telas/formulario-aplicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const CONFLITO = 'Outra pessoa alterou esta avaliação enquanto você editava. Abra de novo para ver a versão atual.';

export async function acaoSalvarAplicacao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id') || undefined;
  const concluir = texto(f, 'modo') === 'concluir';
  let r: { id: string; total: number | null; fechada: boolean };
  try {
    const dados = JSON.parse(texto(f, 'dados') || '{}') as DadosAplicacao;
    r = await salvarAplicacao(app.planilhas, usuario.autorizador, dados, {
      id,
      versao: Number(texto(f, 'versao')) || undefined,
      corrige: texto(f, 'corrige') || undefined,
      concluir,
    });
  } catch (erro) {
    if (erro instanceof ErroConflito) return { erro: CONFLITO };
    if (erro instanceof ErroSaude || erro instanceof ErroPermissao) return { erro: erro.message };
    if (erro instanceof SyntaxError) return { erro: 'As respostas vieram incompletas. Tente de novo.' };
    throw erro;
  }
  revalidatePath('/saude', 'layout');
  const msg = r.fechada ? `Avaliação concluída: ${r.total} de 30 pontos.` : 'Rascunho salvo.';
  redirect(`/saude/${r.id}?ok=${encodeURIComponent(msg)}`);
}

export async function acaoDarCiente(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/saude/${id}?ok=${encodeURIComponent('Ciente registrado.')}`;
  try {
    await darCiente(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')));
  } catch (erro) {
    if (!(erro instanceof ErroSaude || erro instanceof ErroConflito || erro instanceof ErroPermissao)) throw erro;
    destino = `/saude/${id}?erro=${encodeURIComponent(erro instanceof ErroConflito ? CONFLITO : erro.message)}`;
  }
  revalidatePath('/saude', 'layout');
  redirect(destino);
}

export async function acaoDesistir(f: FormData): Promise<void> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  let destino = `/saude?ok=${encodeURIComponent('Avaliação desistida. Ela continua guardada, com o motivo.')}`;
  try {
    await desistirDaAplicacao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo'));
  } catch (erro) {
    if (!(erro instanceof ErroSaude || erro instanceof ErroConflito || erro instanceof ErroPermissao)) throw erro;
    destino = `/saude/${id}?erro=${encodeURIComponent(erro instanceof ErroConflito ? CONFLITO : erro.message)}`;
  }
  revalidatePath('/saude', 'layout');
  redirect(destino);
}
