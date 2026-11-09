'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ErroValidacaoFolha } from '@/modulos/orcamento/aplicacao/folha';
import {
  analisarHistorico, desfazerImportacaoHistorico, descreverArquivoHistorico, importarHistorico, lerMapeamentoHistorico,
  type AnaliseHistorico,
} from '@/modulos/orcamento/aplicacao/historico';
import { lerXlsx } from '@/modulos/orcamento/aplicacao/importacao';
import type { AbaResumida } from '@/modulos/orcamento/dominio/importacao';
import type { MapeamentoHistorico } from '@/modulos/orcamento/dominio/historico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroValidacaoFolha || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

async function abasDoArquivo(f: FormData) {
  const arquivo = f.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroValidacaoFolha('Escolha o arquivo .xlsx.');
  if (arquivo.size > 5 * 1024 * 1024) throw new ErroValidacaoFolha('O arquivo passa de 5 MB. Apague abas que não são do orçamento e tente de novo.');
  return lerXlsx(await arquivo.arrayBuffer());
}

export async function acaoLerArquivoHistorico(_: { erro?: string; abas?: AbaResumida[]; sugestao?: MapeamentoHistorico | null }, f: FormData) {
  const { usuario } = await contexto();
  try {
    return descreverArquivoHistorico(usuario.autorizador, await abasDoArquivo(f));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}

export async function acaoAnalisarHistorico(_: { erro?: string; analise?: AnaliseHistorico }, f: FormData): Promise<{ erro?: string; analise?: AnaliseHistorico }> {
  const { usuario, app } = await contexto();
  try {
    const m = lerMapeamentoHistorico(JSON.parse(texto(f, 'mapeamento') || 'null'));
    return { analise: await analisarHistorico(app.planilhas, usuario.autorizador, await abasDoArquivo(f), m) };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof ErroEstruturaAusente) return { erro: 'Esta versão do Elo trouxe uma aba nova no Orçamento. Peça à Administração para rodar Preparar estrutura e tente de novo.' };
    if (erro instanceof SyntaxError) return { erro: 'O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.' };
    throw erro;
  }
}

export async function acaoConfirmarHistorico(_: { erro?: string }, f: FormData): Promise<{ erro?: string }> {
  const { usuario, app } = await contexto();
  let ano: number;
  let resumo: { linhas: number; substituido: boolean };
  try {
    const dados = JSON.parse(texto(f, 'dados'));
    ano = Number(dados?.ano);
    resumo = await importarHistorico(app.planilhas, usuario.autorizador, dados);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A importação veio incompleta. Envie o arquivo de novo.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  const msg = `${ano} importado: ${resumo.linhas} ${resumo.linhas === 1 ? 'linha de receita' : 'linhas de receita'}${resumo.substituido ? '; a importação anterior foi para o histórico' : ''}.`;
  redirect(`/orcamento/historico?ok=${encodeURIComponent(msg)}`);
}

export async function acaoDesfazerHistorico(f: FormData) {
  const { usuario, app } = await contexto();
  const ano = Number(texto(f, 'ano'));
  let destino: string;
  try {
    await desfazerImportacaoHistorico(app.planilhas, usuario.autorizador, ano);
    destino = `/orcamento/historico/importar?ok=${encodeURIComponent(`Importação de ${ano} desfeita. As linhas ficam guardadas no histórico.`)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `/orcamento/historico/importar?erro=${encodeURIComponent((erro as Error).message)}`;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(destino);
}
