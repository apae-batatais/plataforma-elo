'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import {
  analisarItensEmLote,
  cadastrarItensEmLote,
  cancelarRequisicao,
  concluirRequisicao,
  decidirRequisicao,
  detalharRequisicao,
  type ConferenciaDaAprovacao,
  corrigirValorGasto,
  enviarRequisicao,
  ErroRequisicao,
  iniciarEnvioAnexo,
  mudarSituacaoItemCatalogo,
  mudarSituacaoTipo,
  receberRequisicao,
  reenviarRequisicao,
  salvarExpediente,
  salvarItemCatalogo,
  salvarTipo,
  type DadosRequisicao,
  type LinhaItemLote,
} from '@/modulos/requisicoes/aplicacao/requisicoes';
import type { TipoAnexo } from '@/modulos/requisicoes/dominio/anexos';
import type { Formulario } from '@/modulos/requisicoes/dominio/requisicao';
import { ErroArquivo } from '@/nucleo/armazenamento/arquivos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { grupoDeGastoConferido, projetosParaRequisicao } from '@/plataforma/ligacoes';
import { esquecerAlertas } from '@/plataforma/alertas';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroRequisicao || e instanceof ErroConflito || e instanceof ErroPermissao || e instanceof ErroArquivo;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const numero = (f: FormData, campo: string) => {
  const t = texto(f, campo).replace(/\s/g, '');
  return t ? Number(t.replace(',', '.')) : NaN;
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
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(destino);
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export interface EstadoFicha {
  erro?: string;
}

function lerFicha(f: FormData): DadosRequisicao {
  return JSON.parse(texto(f, 'dados') || '{}') as DadosRequisicao;
}

export async function acaoEnviarRequisicao(_: EstadoFicha, f: FormData): Promise<EstadoFicha> {
  const { usuario, app } = await contexto();
  let r: { id: string; numero: string; rota: { tipo: string } };
  try {
    r = await enviarRequisicao(app.planilhas, usuario.autorizador, { ...lerFicha(f), nomeRequisitante: usuario.nome }, {
      arquivos: app.arquivos,
      // O servidor lê a lista de novo: a da tela não vale como prova (ADR-022).
      projetos: await projetosParaRequisicao(app.planilhas, usuario.autorizador),
    });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A requisição veio incompleta. Tente de novo.' };
    throw erro;
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  const quem = r.rota.tipo === 'diretoria' ? 'a Diretoria' : 'a coordenação';
  redirect(`/requisicoes/${r.id}?ok=${encodeURIComponent(`Requisição ${r.numero} enviada. Agora aguarda ${quem}.`)}`);
}

/** Abre o envio de uma foto ou vídeo: o navegador manda o arquivo direto para a pasta de anexos. */
export async function acaoIniciarEnvioAnexo(a: {
  tipoId: string;
  tipo: TipoAnexo;
  mime: string;
  tamanho: number;
  duracao: number | null;
}): Promise<{ url?: string; erro?: string }> {
  const { usuario, app } = await contexto();
  const h = await headers();
  const origem = h.get('origin') ?? `https://${h.get('x-forwarded-host') ?? h.get('host')}`;
  try {
    return await iniciarEnvioAnexo(app.planilhas, usuario.autorizador, app.arquivos, { ...a, origem });
  } catch (erro) {
    if (conhecido(erro) || erro instanceof ErroArquivo) return { erro: (erro as Error).message };
    throw erro;
  }
}

export async function acaoReenviarRequisicao(_: EstadoFicha, f: FormData): Promise<EstadoFicha> {
  const { usuario, app } = await contexto();
  const id = texto(f, 'id');
  try {
    await reenviarRequisicao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), lerFicha(f), {
      comentario: texto(f, 'comentario'),
      arquivos: app.arquivos,
      projetos: await projetosParaRequisicao(app.planilhas, usuario.autorizador),
    });
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A requisição veio incompleta. Tente de novo.' };
    throw erro;
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(`/requisicoes/${id}?ok=${encodeURIComponent('Requisição ajustada e reenviada.')}`);
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

const MENSAGEM = {
  aprovar: 'Requisição aprovada: foi para a fila do setor.',
  devolver: 'Requisição devolvida para ajuste.',
  recusar: 'Requisição recusada.',
} as const;

export async function acaoDecidir(f: FormData) {
  const id = texto(f, 'id');
  const acao = texto(f, 'acao') as 'aprovar' | 'devolver' | 'recusar';
  await executar(`/requisicoes/${id}`, MENSAGEM[acao] ?? 'Feito.', async ({ usuario, app }) => {
    // Conferência opcional de quem aprova (R5): o grupo é conferido no cadastro do Orçamento.
    const valor = numero(f, 'valor_estimado');
    const grupoId = texto(f, 'grupo_id');
    let conferencia: ConferenciaDaAprovacao | undefined;
    if (acao === 'aprovar' && (Number.isFinite(valor) || grupoId)) {
      const d = await detalharRequisicao(app.planilhas, usuario.autorizador, id);
      const grupo = grupoId ? await grupoDeGastoConferido(app.planilhas, usuario.autorizador, d.centros.map((c) => c.servico), grupoId) : null;
      conferencia = { valorEstimado: Number.isFinite(valor) ? valor : null, grupo };
    }
    await decidirRequisicao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), acao, texto(f, 'comentario') || null, { conferencia });
  });
}

export async function acaoCancelar(f: FormData) {
  const id = texto(f, 'id');
  await executar(`/requisicoes/${id}`, 'Requisição cancelada.', ({ usuario, app }) =>
    cancelarRequisicao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'comentario') || null),
  );
}

export async function acaoReceber(f: FormData) {
  const id = texto(f, 'id');
  await executar(`/requisicoes/${id}`, 'Requisição recebida: agora está em atendimento.', ({ usuario, app }) =>
    receberRequisicao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))),
  );
}

export async function acaoConcluir(f: FormData) {
  const id = texto(f, 'id');
  const atendidos = Object.fromEntries([...f.keys()].filter((k) => k.startsWith('item_')).map((k) => [k.slice(5), numero(f, k)]));
  await executar(`/requisicoes/${id}`, 'Atendimento concluído.', ({ usuario, app }) =>
    concluirRequisicao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), atendidos, texto(f, 'comentario') || null, {
      resultado: (texto(f, 'resultado') || undefined) as 'resolvido' | 'parcial' | undefined,
      valorGasto: Number.isFinite(numero(f, 'valor_gasto')) ? numero(f, 'valor_gasto') : null,
    }),
  );
}

export async function acaoCorrigirValorGasto(f: FormData) {
  const id = texto(f, 'id');
  const valor = numero(f, 'valor_gasto');
  await executar(`/requisicoes/${id}`, 'Valor gasto atualizado.', ({ usuario, app }) =>
    corrigirValorGasto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), Number.isFinite(valor) ? valor : null),
  );
}

// ---------------------------------------------------------------------------
// Tipos e expediente
// ---------------------------------------------------------------------------

export async function acaoSalvarTipo(f: FormData) {
  const id = texto(f, 'id');
  const lista = (campo: string) => f.getAll(campo).map(String).filter(Boolean);
  await executar('/requisicoes/tipos', id ? 'Tipo alterado.' : 'Tipo cadastrado.', ({ usuario, app }) =>
    salvarTipo(
      app.planilhas,
      usuario.autorizador,
      {
        nome: texto(f, 'nome'),
        categoria: texto(f, 'categoria') as 'material' | 'servico',
        formulario: (texto(f, 'formulario') || 'materiais') as Formulario,
        perfilResponsavel: texto(f, 'perfil'),
        prazoAprovacao: numero(f, 'prazo_aprovacao'),
        prazoAtendimento: numero(f, 'prazo_atendimento'),
        descricao: texto(f, 'descricao') || null,
        areas: texto(f, 'todas_areas') === 'sim' ? [] : lista('areas'),
        anexos: texto(f, 'anexos') === 'sim',
      },
      id ? { id, versao: Number(texto(f, 'versao')) } : undefined,
    ),
  );
}

export async function acaoExcluirTipo(f: FormData) {
  await executar('/requisicoes/tipos', 'Tipo excluído. Ele fica em “Tipos excluídos” e pode ser reativado.', ({ usuario, app }) =>
    mudarSituacaoTipo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarTipo(f: FormData) {
  await executar('/requisicoes/tipos', 'Tipo reativado.', ({ usuario, app }) =>
    mudarSituacaoTipo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export async function acaoSalvarExpediente(f: FormData) {
  await executar('/requisicoes/tipos', 'Expediente salvo.', ({ usuario, app }) =>
    salvarExpediente(app.planilhas, usuario.autorizador, { inicio: numero(f, 'inicio'), fim: numero(f, 'fim') }),
  );
}

// ---------------------------------------------------------------------------
// Itens aceitos por tipo
// ---------------------------------------------------------------------------

export async function acaoSalvarItemCatalogo(f: FormData) {
  const tipo = texto(f, 'tipo');
  const id = texto(f, 'id');
  await executar(`/requisicoes/tipos/${tipo}`, id ? 'Item alterado.' : 'Item incluído na lista.', ({ usuario, app }) =>
    salvarItemCatalogo(
      app.planilhas,
      usuario.autorizador,
      tipo,
      { descricao: texto(f, 'descricao'), unidade: texto(f, 'unidade') },
      id ? { id, versao: Number(texto(f, 'versao')) } : undefined,
    ),
  );
}

export async function acaoExcluirItemCatalogo(f: FormData) {
  await executar(`/requisicoes/tipos/${texto(f, 'tipo')}`, 'Item tirado da lista. Ele fica em “Itens excluídos”.', ({ usuario, app }) =>
    mudarSituacaoItemCatalogo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarItemCatalogo(f: FormData) {
  await executar(`/requisicoes/tipos/${texto(f, 'tipo')}`, 'Item de volta na lista.', ({ usuario, app }) =>
    mudarSituacaoItemCatalogo(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export interface EstadoLoteItens {
  erro?: string;
  linhas?: LinhaItemLote[];
  texto?: string;
}

export async function acaoConferirItensEmLote(_: EstadoLoteItens, f: FormData): Promise<EstadoLoteItens> {
  const { usuario, app } = await contexto();
  const conteudo = texto(f, 'lista');
  if (!conteudo) return { erro: 'Cole a lista no campo.' };
  try {
    const linhas = await analisarItensEmLote(app.planilhas, usuario.autorizador, texto(f, 'tipo'), conteudo);
    if (linhas.length === 0) return { erro: 'Não encontrei nenhuma linha com descrição.', texto: conteudo };
    return { linhas, texto: conteudo };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message, texto: conteudo };
    throw erro;
  }
}

export async function acaoCadastrarItensEmLote(_: EstadoLoteItens, f: FormData): Promise<EstadoLoteItens> {
  const { usuario, app } = await contexto();
  const tipo = texto(f, 'tipo');
  let n: number;
  try {
    n = await cadastrarItensEmLote(app.planilhas, usuario.autorizador, tipo, JSON.parse(texto(f, 'linhas') || '[]') as LinhaItemLote[]);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A lista veio incompleta. Confira de novo.' };
    throw erro;
  }
  revalidatePath(`/requisicoes/tipos/${tipo}`);
  redirect(`/requisicoes/tipos/${tipo}?ok=${encodeURIComponent(n === 1 ? '1 item incluído na lista.' : `${n} itens incluídos na lista.`)}`);
}
