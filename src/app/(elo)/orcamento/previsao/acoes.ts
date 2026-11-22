'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { ErroValidacaoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { excluirLancamentoRateio, previaDoLancamento, salvarLancamentoRateio, type DadosLancamento, type PreviaLancamento } from '@/modulos/orcamento/aplicacao/lancamentos-rateio';
import {
  abrirExercicio, cancelarItem, definirFonteDaFolha, excluirFonte, excluirGrupo, reativarFonte, reativarGrupo,
  salvarDespesa, salvarFonte, salvarGrupo, salvarReceita, type DadosDistribuicao,
} from '@/modulos/orcamento/aplicacao/previsao';
import type { Captacao, Cotacao, Distribuicao, Prioridade } from '@/modulos/orcamento/dominio/previsao';
import { encerrarBase, encerrarRegra, salvarBase, salvarRegra, salvarValoresDaBase } from '@/modulos/orcamento/aplicacao/regras-rateio';
import type { BaseRegra, TipoParticipante } from '@/modulos/orcamento/dominio/rateio-custos';
import { alterarOrigem, removerLimite, salvarLimite } from '@/modulos/orcamento/aplicacao/sustentabilidade';
import { ErroSustentabilidade, type Origem } from '@/modulos/orcamento/dominio/sustentabilidade';
import { salvarCentro } from '@/modulos/orcamento/aplicacao/analise-area';
import { lerXlsx } from '@/modulos/orcamento/aplicacao/importacao';
import { analisarImportacaoItens, descreverArquivoItens, importarItens, lerMapeamentoItens, type AnaliseItens } from '@/modulos/orcamento/aplicacao/importacao-itens';
import type { AbaResumida } from '@/modulos/orcamento/dominio/importacao';
import type { MapeamentoItens } from '@/modulos/orcamento/dominio/importacao-itens';
import { analisarCadastrosEmLote, cadastrarEmLote, type LinhaCadastroLote, type TipoCadastro } from '@/modulos/orcamento/aplicacao/cadastros-em-lote';
import {
  aprovarExercicio, cotarProposta, decidirAjuste, decidirProposta, encerrarExercicio, proporDespesa, retirarProposta, solicitarAjuste,
} from '@/modulos/orcamento/aplicacao/aprovacao';
import type { TipoCentro } from '@/modulos/orcamento/dominio/analise-area';
import { salvarLigacao, salvarOrigensDoPlano } from '@/modulos/orcamento/aplicacao/fontes-termo';
import { catalogoParcerias } from '@/plataforma/catalogos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroValidacaoFolha || e instanceof ErroSustentabilidade || e instanceof ErroConflito || e instanceof ErroPermissao;
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
      regra_rateio_id: f.has('regra_rateio_id') ? texto(f, 'regra_rateio_id') || null : undefined,
      codigo_conta: f.has('codigo_conta') ? texto(f, 'codigo_conta') : undefined,
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
      codigo_conta: f.has('codigo_conta') ? texto(f, 'codigo_conta') : undefined,
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

function dadosDespesa(f: FormData) {
  return {
    ano: Number(texto(f, 'ano')),
    servico: texto(f, 'servico'),
    grupo_id: texto(f, 'grupo_id'),
    fonte_id: texto(f, 'fonte_id') || null,
    descricao: texto(f, 'descricao'),
    quantidade: numero(f, 'quantidade'),
    ocorrencias: numero(f, 'ocorrencias'),
    valor_unitario: numero(f, 'valor_unitario'),
    categoria: (texto(f, 'categoria') === 'projetos' ? 'projetos' : 'operacional') as 'projetos' | 'operacional',
    prioridade: (texto(f, 'prioridade') || null) as Prioridade | null,
    cotacao: (texto(f, 'cotacao') || null) as Cotacao | null,
    observacao: texto(f, 'observacao') || null,
    ...distribuicaoDe(f),
  };
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
        categoria: texto(f, 'categoria') === 'projetos' ? 'projetos' : 'operacional',
        prioridade: (texto(f, 'prioridade') || null) as Prioridade | null,
        cotacao: (texto(f, 'cotacao') || null) as Cotacao | null,
        observacao: texto(f, 'observacao') || null,
        regra_rateio_id: f.has('regra_rateio_id') ? texto(f, 'regra_rateio_id') || null : undefined,
        item_id: f.has('item_id') ? texto(f, 'item_id') || null : undefined,
        area_plano_id: f.has('area_plano_id') ? texto(f, 'area_plano_id') || null : undefined,
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
        area: texto(f, 'area') || null,
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

export async function acaoSalvarCentro(f: FormData) {
  const opcional = (c: string) => {
    const v = numero(f, c);
    return Number.isFinite(v) ? v : null;
  };
  await executar('/orcamento/previsao/centros', 'Centro de custo atualizado.', ({ usuario, app }) =>
    salvarCentro(app.planilhas, usuario.autorizador, {
      servico: texto(f, 'servico'),
      tipo: texto(f, 'tipo') as TipoCentro,
      atendidos: opcional('atendidos'),
      sessoes: opcional('sessoes'),
      area_m2: opcional('area_m2'),
      vagas: opcional('vagas'),
      regra_rateio_id: texto(f, 'regra_rateio_id') || null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Propostas, aprovação do exercício e remanejamentos (Entrega 1B.2)
// ---------------------------------------------------------------------------

/**
 * Coordenação: propõe ou altera a proposta. Financeiro: ajusta a proposta antes de aceitar.
 * Compras: informa a cotação (só valores, situação da cotação, observação e meses).
 */
export async function acaoSalvarProposta(_: EstadoItem, f: FormData): Promise<EstadoItem> {
  const dados = dadosDespesa(f);
  return salvarItem(f, `/orcamento/previsao/propostas?ano=${dados.ano}`, ({ usuario, app }, existente) => {
    const a = usuario.autorizador;
    if (existente && a.temPermissao('orcamento.previsao.editar')) return salvarDespesa(app.planilhas, a, dados, existente);
    if (existente && texto(f, 'modo') === 'cotacao') return cotarProposta(app.planilhas, a, existente.id, existente.versao, dados);
    return proporDespesa(app.planilhas, a, dados, existente);
  });
}

export async function acaoRetirarProposta(f: FormData) {
  await executar(`/orcamento/previsao/propostas?ano=${texto(f, 'ano')}`, 'Proposta retirada.', ({ usuario, app }) =>
    retirarProposta(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoDecidirProposta(f: FormData) {
  const decisao = texto(f, 'decisao') === 'recusar' ? 'recusar' : 'aceitar';
  await executar(`/orcamento/previsao/propostas?ano=${texto(f, 'ano')}`, decisao === 'aceitar' ? 'Proposta aceita: entrou no orçamento.' : 'Proposta recusada.', ({ usuario, app }) =>
    decidirProposta(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), decisao, texto(f, 'motivo')),
  );
}

export async function acaoAprovarExercicio(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(`/orcamento/previsao?ano=${ano}`, `Exercício ${ano} aprovado.`, ({ usuario, app }) => aprovarExercicio(app.planilhas, usuario.autorizador, ano));
}

export async function acaoEncerrarExercicio(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(`/orcamento/previsao?ano=${ano}`, `Exercício ${ano} encerrado.`, ({ usuario, app }) => encerrarExercicio(app.planilhas, usuario.autorizador, ano));
}

export async function acaoSolicitarAjuste(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  const tipo = texto(f, 'tipo') === 'suplementacao' ? 'suplementacao' : 'remanejamento';
  const [destinoTipo, destinoId] = texto(f, 'destino').split(':');
  await executar(`/orcamento/previsao/ajustes?ano=${ano}`, 'Pedido enviado para a Diretoria.', ({ usuario, app }) =>
    solicitarAjuste(app.planilhas, usuario.autorizador, {
      ano,
      tipo,
      origem_id: texto(f, 'origem') || null,
      destino_tipo: destinoTipo === 'receita' ? 'receita' : 'despesa',
      destino_id: destinoId ?? '',
      mes: Number(texto(f, 'mes')),
      valor: numero(f, 'valor') * (texto(f, 'sentido') === 'reduzir' ? -1 : 1),
      justificativa: texto(f, 'justificativa'),
    }),
  );
}

export async function acaoDecidirAjuste(f: FormData) {
  const aprovar = texto(f, 'decisao') === 'aprovar';
  await executar(`/orcamento/previsao/ajustes?ano=${texto(f, 'ano')}`, aprovar ? 'Pedido aprovado: o orçamento foi atualizado.' : 'Pedido recusado.', ({ usuario, app }) =>
    decidirAjuste(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), aprovar, texto(f, 'motivo')),
  );
}

// ---------------------------------------------------------------------------
// Grupos e fontes em lote
// ---------------------------------------------------------------------------

export interface EstadoLoteOrcamento {
  erro?: string;
  linhas?: LinhaCadastroLote[];
  texto?: string;
}

async function conferirLote(tipo: TipoCadastro, f: FormData): Promise<EstadoLoteOrcamento> {
  const { usuario, app } = await contexto();
  const conteudo = texto(f, 'lista');
  if (!conteudo) return { erro: 'Cole a lista no campo.' };
  try {
    const linhas = await analisarCadastrosEmLote(app.planilhas, usuario.autorizador, tipo, conteudo);
    if (linhas.length === 0) return { erro: 'Não encontrei nenhuma linha com nome.', texto: conteudo };
    return { linhas, texto: conteudo };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message, texto: conteudo };
    throw erro;
  }
}

async function gravarLote(tipo: TipoCadastro, f: FormData): Promise<EstadoLoteOrcamento> {
  const { usuario, app } = await contexto();
  let n: number;
  try {
    n = await cadastrarEmLote(app.planilhas, usuario.autorizador, tipo, JSON.parse(texto(f, 'linhas') || '[]') as LinhaCadastroLote[]);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A lista veio incompleta. Confira de novo.' };
    throw erro;
  }
  const pagina = tipo === 'grupo' ? '/orcamento/previsao/grupos' : '/orcamento/previsao/fontes';
  const mensagem = tipo === 'grupo' ? (n === 1 ? '1 grupo cadastrado.' : `${n} grupos cadastrados.`) : n === 1 ? '1 fonte cadastrada.' : `${n} fontes cadastradas.`;
  revalidatePath(pagina);
  redirect(`${pagina}?ok=${encodeURIComponent(mensagem)}`);
}

export async function acaoConferirGruposEmLote(_: EstadoLoteOrcamento, f: FormData) {
  return conferirLote('grupo', f);
}
export async function acaoCadastrarGruposEmLote(_: EstadoLoteOrcamento, f: FormData) {
  return gravarLote('grupo', f);
}
export async function acaoConferirFontesEmLote(_: EstadoLoteOrcamento, f: FormData) {
  return conferirLote('fonte', f);
}
export async function acaoCadastrarFontesEmLote(_: EstadoLoteOrcamento, f: FormData) {
  return gravarLote('fonte', f);
}

// ---------------------------------------------------------------------------
// Importar despesas e receitas
// ---------------------------------------------------------------------------

async function abasDoArquivo(f: FormData) {
  const arquivo = f.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroValidacaoFolha('Escolha o arquivo .xlsx.');
  if (arquivo.size > 5 * 1024 * 1024) throw new ErroValidacaoFolha('O arquivo passa de 5 MB. Apague abas que não são do orçamento e tente de novo.');
  return lerXlsx(await arquivo.arrayBuffer());
}

export async function acaoLerArquivoItens(_: { erro?: string; abas?: AbaResumida[]; sugestao?: MapeamentoItens | null }, f: FormData) {
  const { usuario } = await contexto();
  try {
    return descreverArquivoItens(usuario.autorizador, await abasDoArquivo(f));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}

export async function acaoAnalisarItens(_: { erro?: string; analise?: AnaliseItens }, f: FormData): Promise<{ erro?: string; analise?: AnaliseItens }> {
  const { usuario, app } = await contexto();
  try {
    const m = lerMapeamentoItens(JSON.parse(texto(f, 'mapeamento') || 'null'));
    return { analise: await analisarImportacaoItens(app.planilhas, usuario.autorizador, await abasDoArquivo(f), m) };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof ErroEstruturaAusente) return { erro: 'Esta versão do Elo trouxe uma aba nova no Orçamento. Peça à Administração para rodar Preparar estrutura e tente de novo.' };
    if (erro instanceof SyntaxError) return { erro: 'O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.' };
    throw erro;
  }
}

export async function acaoConfirmarItens(_: { erro?: string; analise?: AnaliseItens }, f: FormData): Promise<{ erro?: string; analise?: AnaliseItens }> {
  const { usuario, app } = await contexto();
  let r: { itens: number; substituidos: number };
  let tipo: string;
  try {
    const proposta = JSON.parse(texto(f, 'proposta'));
    tipo = proposta?.tipo === 'receita' ? 'receitas' : 'despesas';
    r = await importarItens(app.planilhas, usuario.autorizador, proposta);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A importação veio incompleta. Envie o arquivo de novo.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  const texto2 = `${r.itens} ${tipo === 'receitas' ? (r.itens === 1 ? 'receita importada' : 'receitas importadas') : r.itens === 1 ? 'despesa importada' : 'despesas importadas'}${
    r.substituidos ? `; ${r.substituidos} da importação anterior foram para o histórico` : ''
  }.`;
  redirect(`/orcamento/previsao/${tipo}?ok=${encodeURIComponent(texto2)}`);
}

// ---------------------------------------------------------------------------
// Regras de rateio e bases próprias (R1, proposta #91)
// ---------------------------------------------------------------------------

export async function acaoSalvarRegra(f: FormData) {
  const id = texto(f, 'id');
  await executar('/orcamento/previsao/regras', id ? 'Regra alterada.' : 'Regra cadastrada.', ({ usuario, app }) =>
    salvarRegra(app.planilhas, usuario.autorizador, {
      id: id || undefined,
      versao: id ? Number(texto(f, 'versao')) : undefined,
      nome: texto(f, 'nome'),
      tipo: texto(f, 'tipo') as TipoParticipante,
      base1: texto(f, 'base1') as BaseRegra,
      base2: (texto(f, 'base2') || null) as BaseRegra | null,
      participantes: f.getAll('participantes').map(String),
    }),
  );
}

export async function acaoExcluirRegra(f: FormData) {
  await executar('/orcamento/previsao/regras', 'Regra excluída. Ela fica guardada em “Regras excluídas”.', ({ usuario, app }) =>
    encerrarRegra(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarRegra(f: FormData) {
  await executar('/orcamento/previsao/regras', 'Regra reativada.', ({ usuario, app }) =>
    encerrarRegra(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export async function acaoSalvarBase(f: FormData) {
  const id = texto(f, 'id');
  await executar('/orcamento/previsao/bases', id ? 'Base alterada.' : 'Base cadastrada.', ({ usuario, app }) =>
    salvarBase(app.planilhas, usuario.autorizador, { id: id || undefined, versao: id ? Number(texto(f, 'versao')) : undefined, nome: texto(f, 'nome') }),
  );
}

export async function acaoExcluirBase(f: FormData) {
  await executar('/orcamento/previsao/bases', 'Base excluída. Ela fica guardada em “Bases excluídas”.', ({ usuario, app }) =>
    encerrarBase(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), false),
  );
}

export async function acaoReativarBase(f: FormData) {
  await executar('/orcamento/previsao/bases', 'Base reativada.', ({ usuario, app }) =>
    encerrarBase(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), true),
  );
}

export async function acaoSalvarValoresBase(f: FormData) {
  const base = texto(f, 'base');
  const ano = Number(texto(f, 'ano'));
  const lista = f.getAll('servico').map((s) => {
    const v = numero(f, `valor_${String(s)}`);
    return { servico: String(s), valor: Number.isFinite(v) ? v : null };
  });
  await executar('/orcamento/previsao/bases', 'Valores da base salvos.', ({ usuario, app }) => salvarValoresDaBase(app.planilhas, usuario.autorizador, base, ano, lista));
}

// ---------------------------------------------------------------------------
// Fontes dos termos (R3a, #140)
// ---------------------------------------------------------------------------

export async function acaoSalvarLigacaoFonteTermo(f: FormData) {
  await executar('/orcamento/previsao/fontes-termo', 'Ligação salva.', ({ usuario, app }) =>
    salvarLigacao(app.planilhas, usuario.autorizador, catalogoParcerias(app.planilhas), {
      fonteTermoId: texto(f, 'fonte_termo'),
      fonteId: texto(f, 'fonte'),
      contaId: texto(f, 'conta') || null,
      versao: Number(texto(f, 'versao')) || 0,
    }),
  );
}

export async function acaoSalvarOrigensDoPlano(f: FormData) {
  const categorias = f.getAll('categoria').map((c, i) => ({ categoria: String(c), origens: f.getAll(`origem_${i}`).map(String) }));
  await executar('/orcamento/previsao/fontes-termo', 'Origens das categorias salvas.', ({ usuario, app }) =>
    salvarOrigensDoPlano(app.planilhas, usuario.autorizador, catalogoParcerias(app.planilhas), texto(f, 'fonte_termo'), categorias),
  );
}

// ---------------------------------------------------------------------------
// Painel de sustentabilidade financeira (#131)
// ---------------------------------------------------------------------------

export async function acaoAlterarOrigem(f: FormData) {
  const origem = texto(f, 'origem');
  const volta = texto(f, 'volta') || '/orcamento/sustentabilidade';
  await executar(volta, 'Origem salva.', ({ usuario, app }) =>
    alterarOrigem(app.planilhas, usuario.autorizador, { servico: texto(f, 'servico'), origem: origem === '' ? null : (origem as Origem) }),
  );
}

export async function acaoSalvarLimite(f: FormData) {
  const valor = numero(f, 'valor');
  await executar('/orcamento/previsao/limites', 'Limite salvo.', ({ usuario, app }) =>
    salvarLimite(app.planilhas, usuario.autorizador, { indicador: texto(f, 'indicador'), servico: texto(f, 'servico') || null, valor }),
  );
}

export async function acaoRemoverLimite(f: FormData) {
  await executar('/orcamento/previsao/limites', 'Limite removido.', ({ usuario, app }) => removerLimite(app.planilhas, usuario.autorizador, texto(f, 'id')));
}

// ---------------------------------------------------------------------------
// Lançamento de despesas por rateio (#225)
// ---------------------------------------------------------------------------

function dadosLancamento(f: FormData): DadosLancamento {
  return {
    ano: Number(texto(f, 'ano')),
    grupo_id: texto(f, 'grupo_id'),
    fonte_id: texto(f, 'fonte_id') || null,
    descricao: texto(f, 'descricao'),
    regra_rateio_id: texto(f, 'regra_rateio_id'),
    quantidade: numero(f, 'quantidade'),
    ocorrencias: numero(f, 'ocorrencias'),
    valor_unitario: numero(f, 'valor_unitario'),
    categoria: texto(f, 'categoria') === 'projetos' ? 'projetos' : 'operacional',
    observacao: texto(f, 'observacao') || null,
    ...distribuicaoDe(f),
  };
}

export async function acaoSalvarLancamento(_: EstadoItem, f: FormData): Promise<EstadoItem> {
  const ctx = await contexto();
  const ano = Number(texto(f, 'ano'));
  const id = texto(f, 'id');
  let mensagem: string;
  try {
    const r = await salvarLancamentoRateio(ctx.app.planilhas, ctx.usuario.autorizador, dadosLancamento(f), id ? { id, versao: Number(texto(f, 'versao')) } : undefined);
    mensagem = r.semDespesa
      ? 'Lançamento salvo, mas nenhuma despesa foi gerada: ajuste a Regra de rateio.'
      : r.geradas === 0
        ? 'Lançamento salvo. As despesas já estavam certas.'
        : `Lançamento salvo: ${r.geradas} ${r.geradas === 1 ? 'despesa gerada' : 'despesas geradas'}.`;
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/previsao/rateio?ano=${ano}&ok=${encodeURIComponent(mensagem)}`);
}

export async function acaoExcluirLancamento(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(`/orcamento/previsao/rateio?ano=${ano}`, 'Lançamento excluído. As despesas geradas por ele foram encerradas.', ({ usuario, app }) =>
    excluirLancamentoRateio(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

/** "Como ficaria": só calcula, não grava. */
export async function acaoPreviaLancamento(f: FormData): Promise<PreviaLancamento | { erro: string }> {
  const { usuario, app } = await contexto();
  try {
    return await previaDoLancamento(app.planilhas, usuario.autorizador, dadosLancamento(f));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}
