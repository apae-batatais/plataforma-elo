'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroArquivo } from '@/nucleo/armazenamento/arquivos';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { iniciarEnvioAnexo } from '@/modulos/conhecimento/aplicacao/anexos';
import { criarCategoria, mudarSituacaoCategoria } from '@/modulos/conhecimento/aplicacao/categorias';
import { darCiencia, mudarArquivamento, salvarPublicacao } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { enviarTeste } from '@/modulos/conhecimento/aplicacao/teste';
import { ErroConhecimento, PUBLICOS, type PerguntaEntrada, type PublicoTipo } from '@/modulos/conhecimento/dominio/publicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { esquecerAlertas } from '@/plataforma/alertas';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroConhecimento || e instanceof ErroConflito || e instanceof ErroPermissao || e instanceof ErroArquivo;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const comMensagem = (pagina: string, chave: 'ok' | 'erro', mensagem: string) => `${pagina}${pagina.includes('?') ? '&' : '?'}${chave}=${encodeURIComponent(mensagem)}`;

/** Executa e volta para a página com a mensagem no endereço (a notificação lê ?ok= e ?erro=). */
async function executar(destino: string, erroEm: string, sucesso: string, acao: (c: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let ir: string;
  try {
    await acao(ctx);
    ir = comMensagem(destino, 'ok', sucesso);
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    ir = comMensagem(erroEm, 'erro', (erro as Error).message);
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(ir);
}

/** Salvar rascunho ou publicar. Em erro, devolve a frase para o formulário (que mantém o que foi digitado). */
export async function acaoSalvarPublicacao(f: FormData): Promise<{ erro: string } | undefined> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  const tipo = texto(f, 'publico_tipo');
  const anexoBruto = texto(f, 'anexo');
  let anexo: { arquivoId: string; nome?: string } | null | undefined;
  if (anexoBruto === 'tirar') anexo = null;
  else if (anexoBruto) {
    try {
      const j = JSON.parse(anexoBruto) as { arquivoId?: string; nome?: string };
      if (j.arquivoId) anexo = { arquivoId: String(j.arquivoId), nome: j.nome ? String(j.nome) : undefined };
    } catch {
      return { erro: 'O anexo não foi lido. Envie o arquivo de novo.' };
    }
  }
  const temTeste = f.get('tem_teste') === 'on';
  let perguntas: PerguntaEntrada[] | undefined;
  if (temTeste) {
    try {
      const bruto = JSON.parse(texto(f, 'perguntas') || '[]') as { texto?: unknown; opcoes?: unknown; correta?: unknown }[];
      perguntas = bruto
        .map((q) => ({
          texto: String(q.texto ?? ''),
          opcoes: Array.isArray(q.opcoes) ? q.opcoes.map((o) => String(o ?? '')) : [],
          correta: Number(q.correta),
        }))
        // Pergunta em branco (só o esqueleto do formulário) é ignorada.
        .filter((q) => q.texto.trim() || q.opcoes.some((o) => o.trim()));
    } catch {
      return { erro: 'As perguntas não foram lidas. Confira o teste e tente de novo.' };
    }
  }
  const publicar = texto(f, 'intencao') === 'publicar';
  const edicao = texto(f, 'tipo_edicao');
  let destino: string;
  try {
    await salvarPublicacao(app.planilhas, usuario.autorizador, app.arquivos, {
      id: id || undefined,
      versao: id ? Number(texto(f, 'versao')) : undefined,
      titulo: texto(f, 'titulo'),
      categoria: texto(f, 'categoria'),
      resumo: texto(f, 'resumo') || null,
      corpo: String(f.get('corpo') ?? ''),
      publicoTipo: ((PUBLICOS as readonly string[]).includes(tipo) ? tipo : 'todos') as PublicoTipo,
      publicoValor: texto(f, 'publico_valor') || null,
      exigeCiencia: f.get('exige_ciencia') === 'on',
      temTeste,
      perguntas,
      anexo,
      publicar,
      tipoEdicao: edicao === 'pequena' || edicao === 'nova' ? edicao : undefined,
    });
    destino = comMensagem('/conhecimento/publicacoes', 'ok', publicar ? 'Publicação publicada.' : 'Publicação salva.');
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    return { erro: (erro as Error).message };
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(destino);
}

export async function acaoArquivar(f: FormData) {
  await executar('/conhecimento/publicacoes', '/conhecimento/publicacoes', 'Publicação arquivada.', ({ usuario, app }) =>
    mudarArquivamento(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export async function acaoReativar(f: FormData) {
  await executar('/conhecimento/publicacoes', '/conhecimento/publicacoes', 'Publicação reativada.', ({ usuario, app }) =>
    mudarArquivamento(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoDarCiencia(f: FormData) {
  const id = texto(f, 'id');
  await executar(`/conhecimento/${id}`, `/conhecimento/${id}`, 'Ciência registrada.', ({ usuario, app }) => darCiencia(app.planilhas, usuario.autorizador, id));
}

/** Envia as respostas do teste; devolve o resultado para a tela (sem a resposta certa). */
export async function acaoEnviarTeste(id: string, respostas: (number | null)[]): Promise<{ erro: string } | { acertos: number; total: number; aprovada: boolean; erradas: number[] }> {
  const { usuario, app } = await contexto();
  try {
    const r = await enviarTeste(app.planilhas, usuario.autorizador, id, respostas);
    esquecerAlertas();
    revalidatePath('/', 'layout');
    return r;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    return { erro: (erro as Error).message };
  }
}

export async function acaoCriarCategoria(f: FormData) {
  await executar('/conhecimento/categorias', '/conhecimento/categorias', 'Categoria adicionada.', ({ usuario, app }) =>
    criarCategoria(app.planilhas, usuario.autorizador, texto(f, 'nome')),
  );
}

export async function acaoDesativarCategoria(f: FormData) {
  await executar('/conhecimento/categorias', '/conhecimento/categorias', 'Categoria desativada.', ({ usuario, app }) =>
    mudarSituacaoCategoria(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarCategoria(f: FormData) {
  await executar('/conhecimento/categorias', '/conhecimento/categorias', 'Categoria reativada.', ({ usuario, app }) =>
    mudarSituacaoCategoria(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

/** Abre o envio do anexo: o navegador manda o arquivo direto para a pasta de anexos. */
export async function acaoIniciarEnvioAnexo(a: { mime: string; tamanho: number }): Promise<{ url?: string; erro?: string }> {
  const { usuario, app } = await contexto();
  const h = await headers();
  const origem = h.get('origin') ?? `https://${h.get('x-forwarded-host') ?? h.get('host')}`;
  try {
    return await iniciarEnvioAnexo(usuario.autorizador, app.arquivos, { ...a, origem });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}
