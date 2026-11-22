'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ErroValidacaoFolha } from '@/modulos/orcamento/aplicacao/folha';
import {
  excluirAreaPlano, excluirItemContabil, reativarAreaPlano, reativarItemContabil, salvarAreaPlano, salvarItemContabil, salvarPlano,
} from '@/modulos/orcamento/aplicacao/plano-contas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroValidacaoFolha || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

/** Formulários simples: volta para a página com a mensagem no endereço. */
async function executar(pagina: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  const sep = pagina.includes('?') ? '&' : '?';
  try {
    await acao(ctx);
    destino = `${pagina}${sep}ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `${pagina}${sep}erro=${encodeURIComponent((erro as Error).message)}`;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(destino);
}

const AREAS = '/orcamento/previsao/areas-plano';

export async function acaoSalvarAreaPlano(f: FormData) {
  const id = texto(f, 'id');
  await executar(AREAS, id ? 'Área alterada.' : 'Área cadastrada.', ({ usuario, app }) =>
    salvarAreaPlano(app.planilhas, usuario.autorizador, { id: id || undefined, versao: id ? Number(texto(f, 'versao')) : undefined, nome: texto(f, 'nome'), codigo: texto(f, 'codigo') }),
  );
}
export async function acaoExcluirAreaPlano(f: FormData) {
  await executar(AREAS, 'Área excluída. Ela fica guardada em “Áreas excluídas”.', ({ usuario, app }) => excluirAreaPlano(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))));
}
export async function acaoReativarAreaPlano(f: FormData) {
  await executar(AREAS, 'Área reativada.', ({ usuario, app }) => reativarAreaPlano(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))));
}

export async function acaoSalvarItemContabil(f: FormData) {
  const id = texto(f, 'id');
  const grupo = texto(f, 'grupo_id');
  await executar(`/orcamento/previsao/grupos/${encodeURIComponent(grupo)}`, id ? 'Item alterado.' : 'Item cadastrado.', ({ usuario, app }) =>
    salvarItemContabil(app.planilhas, usuario.autorizador, { id: id || undefined, versao: id ? Number(texto(f, 'versao')) : undefined, grupo_id: grupo, nome: texto(f, 'nome'), codigo: texto(f, 'codigo') }),
  );
}
export async function acaoExcluirItemContabil(f: FormData) {
  await executar(`/orcamento/previsao/grupos/${encodeURIComponent(texto(f, 'grupo_id'))}`, 'Item excluído. Ele fica guardado em “Itens excluídos”.', ({ usuario, app }) =>
    excluirItemContabil(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}
export async function acaoReativarItemContabil(f: FormData) {
  await executar(`/orcamento/previsao/grupos/${encodeURIComponent(texto(f, 'grupo_id'))}`, 'Item reativado.', ({ usuario, app }) =>
    reativarItemContabil(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export interface EstadoPlano {
  erro?: string;
}

/** Salva o plano. Em erro, devolve a mensagem e a janela continua aberta com tudo o que foi marcado. */
export async function acaoSalvarPlano(_: EstadoPlano, f: FormData): Promise<EstadoPlano> {
  const { usuario, app } = await contexto();
  const ano = Number(texto(f, 'ano'));
  const marcado = f.getAll('marcado').map(String);
  const linhas = marcado.map((m) => {
    const [area_id, grupo_id, item_id] = m.split('|');
    return { area_id, grupo_id, item_id: item_id || null };
  });
  try {
    await salvarPlano(app.planilhas, usuario.autorizador, { ano, vigencia: texto(f, 'vigencia'), linhas, loteLido: texto(f, 'lote_lido') || null });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/previsao/plano?ano=${ano}&ok=${encodeURIComponent(`Plano de ${ano} salvo.`)}`);
}
