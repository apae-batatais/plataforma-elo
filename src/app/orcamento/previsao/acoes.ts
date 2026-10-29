'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ErroValidacaoFolha } from '@/modulos/orcamento/aplicacao/folha';
import {
  abrirExercicio, cancelarItem, definirFonteDaFolha, excluirFonte, excluirGrupo, reativarFonte, reativarGrupo,
  salvarDespesa, salvarFonte, salvarGrupo, salvarReceita, type DadosDistribuicao,
} from '@/modulos/orcamento/aplicacao/previsao';
import type { Captacao, Distribuicao } from '@/modulos/orcamento/dominio/previsao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroValidacaoFolha || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const numero = (f: FormData, campo: string) => {
  const t = texto(f, campo).replace(/\s/g, '');
  if (!t) return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};

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

// ---------------------------------------------------------------------------
// Exercício e cadastros
// ---------------------------------------------------------------------------

export async function acaoAbrirExercicio(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(`/orcamento/previsao?ano=${ano}`, `Exercício ${ano} aberto.`, ({ usuario, app }) => abrirExercicio(app.planilhas, usuario.autorizador, ano));
}

export async function acaoSalvarGrupo(f: FormData) {
  const id = texto(f, 'id');
  await executar('/orcamento/previsao/grupos', id ? 'Grupo alterado.' : 'Grupo cadastrado.', ({ usuario, app }) =>
    salvarGrupo(app.planilhas, usuario.autorizador, {
      id: id || undefined,
      versao: id ? Number(texto(f, 'versao')) : undefined,
      nome: texto(f, 'nome'),
      rh: texto(f, 'rh') === 'sim',
    }),
  );
}

export async function acaoExcluirGrupo(f: FormData) {
  await executar('/orcamento/previsao/grupos', 'Grupo excluído. Ele fica guardado em “Grupos excluídos”.', ({ usuario, app }) =>
    excluirGrupo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoReativarGrupo(f: FormData) {
  await executar('/orcamento/previsao/grupos', 'Grupo reativado.', ({ usuario, app }) =>
    reativarGrupo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoSalvarFonte(f: FormData) {
  const id = texto(f, 'id');
  await executar('/orcamento/previsao/fontes', id ? 'Fonte alterada.' : 'Fonte cadastrada.', ({ usuario, app }) =>
    salvarFonte(app.planilhas, usuario.autorizador, {
      id: id || undefined,
      versao: id ? Number(texto(f, 'versao')) : undefined,
      nome: texto(f, 'nome'),
      natureza: texto(f, 'natureza') as 'publica' | 'propria',
      uso: texto(f, 'uso') as 'livre' | 'restrita',
    }),
  );
}

export async function acaoExcluirFonte(f: FormData) {
  await executar('/orcamento/previsao/fontes', 'Fonte excluída. Ela fica guardada em “Fontes excluídas”.', ({ usuario, app }) =>
    excluirFonte(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoReativarFonte(f: FormData) {
  await executar('/orcamento/previsao/fontes', 'Fonte reativada.', ({ usuario, app }) =>
    reativarFonte(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

// ---------------------------------------------------------------------------
// Despesas e receitas (formulários que mantêm o que foi digitado se houver erro)
// ---------------------------------------------------------------------------

export interface EstadoItem {
  erro?: string;
}

function distribuicaoDe(f: FormData): DadosDistribuicao {
  return {
    distribuicao: (texto(f, 'distribuicao') || 'igual') as Distribuicao,
    meses: f.getAll('meses').map((m) => Number(m)),
    manual: Array.from({ length: 12 }, (_, i) => {
      const v = numero(f, `m${i + 1}`);
      return Number.isFinite(v) ? v : null;
    }),
  };
}

async function salvarItem(f: FormData, pagina: string, gravar: (ctx: Awaited<ReturnType<typeof contexto>>, existente?: { id: string; versao: number }) => Promise<unknown>): Promise<EstadoItem> {
  const ctx = await contexto();
  const id = texto(f, 'id');
  try {
    await gravar(ctx, id ? { id, versao: Number(texto(f, 'versao')) } : undefined);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`${pagina}&ok=${encodeURIComponent(id ? 'Item alterado.' : 'Item lançado.')}`);
}

export async function acaoSalvarDespesa(_: EstadoItem, f: FormData): Promise<EstadoItem> {
  const ano = Number(texto(f, 'ano'));
  return salvarItem(f, `/orcamento/previsao/despesas?ano=${ano}`, ({ usuario, app }, existente) =>
    salvarDespesa(
      app.planilhas,
      usuario.autorizador,
      {
        ano,
        servico: texto(f, 'servico'),
        grupo_id: texto(f, 'grupo_id'),
        fonte_id: texto(f, 'fonte_id') || null,
        descricao: texto(f, 'descricao'),
        quantidade: numero(f, 'quantidade'),
        ocorrencias: numero(f, 'ocorrencias'),
        valor_unitario: numero(f, 'valor_unitario'),
        observacao: texto(f, 'observacao') || null,
        ...distribuicaoDe(f),
      },
      existente,
    ),
  );
}

export async function acaoSalvarReceita(_: EstadoItem, f: FormData): Promise<EstadoItem> {
  const ano = Number(texto(f, 'ano'));
  return salvarItem(f, `/orcamento/previsao/receitas?ano=${ano}`, ({ usuario, app }, existente) =>
    salvarReceita(
      app.planilhas,
      usuario.autorizador,
      {
        ano,
        fonte_id: texto(f, 'fonte_id'),
        descricao: texto(f, 'descricao'),
        valor: numero(f, 'valor'),
        captacao: texto(f, 'captacao') as Captacao,
        observacao: texto(f, 'observacao') || null,
        ...distribuicaoDe(f),
      },
      existente,
    ),
  );
}

export async function acaoCancelarItem(f: FormData) {
  const tipo = texto(f, 'tipo') === 'receita' ? 'receita' : 'despesa';
  const ano = texto(f, 'ano');
  await executar(`/orcamento/previsao/${tipo}s?ano=${ano}`, 'Item cancelado. Ele sai do orçamento, mas fica registrado.', ({ usuario, app }) =>
    cancelarItem(app.planilhas, usuario.autorizador, tipo, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoFonteDaFolha(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(`/orcamento/previsao/despesas?ano=${ano}`, 'Fonte da folha atualizada.', ({ usuario, app }) =>
    definirFonteDaFolha(app.planilhas, usuario.autorizador, ano, texto(f, 'servico'), texto(f, 'fonte_id') || null),
  );
}
