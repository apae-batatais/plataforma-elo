/**
 * Casos de uso do Histórico (Entrega 1E).
 *
 * Quem pode:
 * - orcamento.historico.ver: Diretoria, Financeiro e Leitura.
 * - orcamento.historico.editar: só o Financeiro (importar e desfazer).
 *
 * Importar é em passos: descrever (abas), analisar (relatório, sem gravar) e
 * importar (confere de novo e grava). Nada é apagado: reimportar um ano ou
 * desfazê-lo cancela as linhas anteriores (ativo = FALSE).
 */
import { z } from 'zod';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizarVarios, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Fontes, Historico, HistoricoAnos } from '../dados/tabelas';
import {
  anoAtualBrasilia, calcularIndicadores, conferirMapeamentoHistorico, conferirTotal, fontesPorAno, lerReceitasHistorico,
  mapeamentoSugeridoHistorico, PRIMEIRO_ANO, somaReceitas,
  type AnoHistorico, type IndicadoresAno, type LinhaReceitaLida, type MapeamentoHistorico,
} from '../dominio/historico';
import { resumirAbas, type AbaImportada, type AbaResumida } from '../dominio/importacao';
import { nomeComparavel } from '../dominio/previsao';
import { ErroValidacaoFolha } from './folha';

export const ErroHistorico = ErroValidacaoFolha;

const PERM = { ver: 'orcamento.historico.ver', editar: 'orcamento.historico.editar' } as const;
function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface HistoricoLido {
  anoAtual: number;
  anos: AnoHistorico[];
  indicadores: IndicadoresAno[];
  fontes: ReturnType<typeof fontesPorAno>;
}

export async function lerHistorico(p: Planilhas, quem: Autorizador): Promise<HistoricoLido> {
  exigir(quem, PERM.ver);
  const [historico, totais, fontes] = await lerTabelas(p, [Historico, HistoricoAnos, Fontes] as const);
  const dadosFonte = new Map(fontes.todos().map((f) => [f.id, f]));
  const linhas = historico.ativos();
  const anos: AnoHistorico[] = totais
    .ativos()
    .map((t) => {
      const doAno = linhas.filter((l) => l.ano === t.ano);
      const porFonte = new Map<string, AnoHistorico['porFonte'][number]>();
      for (const l of doAno) {
        const f = dadosFonte.get(l.fonte_id);
        const atual = porFonte.get(l.fonte_id) ?? { fonteId: l.fonte_id, nome: f?.nome ?? 'Fonte removida', natureza: f?.natureza ?? 'publica', valor: 0 };
        atual.valor = Math.round((atual.valor + l.receita) * 100) / 100;
        porFonte.set(l.fonte_id, atual);
      }
      return {
        ano: t.ano,
        receita: somaReceitas(doAno.map((l) => ({ valor: l.receita }))),
        despesa: t.despesa_total,
        folha: t.folha,
        saldoLivreInicial: t.saldo_livre_inicial,
        porFonte: [...porFonte.values()],
      };
    })
    .sort((a, b) => a.ano - b.ano);
  const anoAtual = anoAtualBrasilia();
  return { anoAtual, anos, indicadores: calcularIndicadores(anos, anoAtual), fontes: fontesPorAno(anos, anoAtual) };
}

// ---------------------------------------------------------------------------
// Importar ano fechado
// ---------------------------------------------------------------------------

const coluna = z.number().int().min(0).max(500);
const esquemaMapeamento = z.object({ aba: z.string(), cabecalho: z.number().int(), colunas: z.object({ descricao: coluna, valor: coluna }) });

export function lerMapeamentoHistorico(bruto: unknown): MapeamentoHistorico {
  const r = esquemaMapeamento.safeParse(bruto);
  if (!r.success) throw new ErroHistorico('O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.');
  return r.data;
}

/** Passo 1: as abas e o DE-PARA sugerido. Não grava nada. */
export function descreverArquivoHistorico(quem: Autorizador, abas: AbaImportada[]): { abas: AbaResumida[]; sugestao: MapeamentoHistorico | null } {
  exigir(quem, PERM.editar);
  if (abas.length === 0) throw new ErroHistorico('O arquivo não tem abas.');
  return { abas: resumirAbas(abas), sugestao: mapeamentoSugeridoHistorico(abas) };
}

export interface LinhaProposta extends LinhaReceitaLida {
  /** Fonte reconhecida pelo nome ou escolhida pela pessoa (null = a escolher). */
  fonteId: string | null;
  observacao: string | null;
}

export interface AnaliseHistorico {
  aba: string;
  linhas: LinhaProposta[];
  totalLinhas: number;
  /** "Total das receitas" encontrado na planilha (null = a pessoa informa). */
  totalPlanilha: number | null;
  problemas: { linha: number; descricao: string; problema: string }[];
  fontes: { id: string; nome: string }[];
  /** Anos que já têm importação (serão substituídos). */
  anosImportados: number[];
  anoMin: number;
  anoMax: number;
}

/** Passo 2: lê pelo DE-PARA e sugere a fonte de cada linha. Não grava nada. */
export async function analisarHistorico(p: Planilhas, quem: Autorizador, abas: AbaImportada[], m: MapeamentoHistorico): Promise<AnaliseHistorico> {
  exigir(quem, PERM.editar);
  const erros = conferirMapeamentoHistorico(abas, m);
  if (erros.length) throw new ErroHistorico(erros.join(' '));
  const leitura = lerReceitasHistorico(abas, m);
  if (leitura.linhas.length === 0) throw new ErroHistorico('Não encontrei receitas na aba escolhida. Confira a aba, a linha do cabeçalho e as colunas.');
  const [fontes, totais] = await lerTabelas(p, [Fontes, HistoricoAnos] as const);
  const ativas = fontes.ativos().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const porNome = new Map(ativas.map((f) => [nomeComparavel(f.nome), f.id]));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'ImportacaoHistorico', detalhes: { linhas: leitura.linhas.length } });
  return {
    aba: m.aba,
    linhas: leitura.linhas.map((l) => ({ ...l, fonteId: porNome.get(nomeComparavel(l.descricao)) ?? null, observacao: null })),
    totalLinhas: somaReceitas(leitura.linhas),
    totalPlanilha: leitura.totalPlanilha,
    problemas: leitura.problemas,
    fontes: ativas.map((f) => ({ id: f.id, nome: f.nome })),
    anosImportados: totais.ativos().map((t) => t.ano).sort((a, b) => a - b),
    anoMin: PRIMEIRO_ANO,
    anoMax: anoAtualBrasilia() - 1,
  };
}

const dinheiro = z.number().finite().min(0);
const esquemaImportacao = z.object({
  ano: z.number().int(),
  totalPlanilha: z.number().finite(),
  despesaTotal: dinheiro,
  folha: dinheiro,
  saldoLivreInicial: z.number().finite().nullable(),
  linhas: z.array(z.object({ linha: z.number().int(), descricao: z.string().min(1), valor: z.number().finite().positive(), fonteId: z.string().nullable(), observacao: z.string().nullable() })),
});
export type ImportacaoHistorico = z.infer<typeof esquemaImportacao>;

/** Passo 3: confere tudo de novo e grava; cancela a importação anterior do mesmo ano. */
export async function importarHistorico(p: Planilhas, quem: Autorizador, bruta: unknown): Promise<{ linhas: number; substituido: boolean }> {
  exigir(quem, PERM.editar);
  const r = esquemaImportacao.safeParse(bruta);
  if (!r.success) throw new ErroHistorico('A importação veio incompleta. Confira os valores e tente de novo.');
  const dados = r.data;
  const maximo = anoAtualBrasilia() - 1;
  if (dados.ano < PRIMEIRO_ANO || dados.ano > maximo) throw new ErroHistorico(`Informe um ano fechado, de ${PRIMEIRO_ANO} a ${maximo}.`);
  if (dados.linhas.length === 0) throw new ErroHistorico('Não há receitas para importar.');
  if (Math.round(dados.folha * 100) > Math.round(dados.despesaTotal * 100)) throw new ErroHistorico('A folha não pode ser maior que a despesa total do ano.');
  const semFonte = dados.linhas.filter((l) => !l.fonteId);
  if (semFonte.length) throw new ErroHistorico(`Escolha a fonte de: ${semFonte.map((l) => l.descricao).join(', ')}.`);
  const erroTotal = conferirTotal(dados.linhas, dados.totalPlanilha);
  if (erroTotal) throw new ErroHistorico(erroTotal);

  const [fontes, historico, totais] = await lerTabelas(p, [Fontes, Historico, HistoricoAnos] as const);
  const validas = new Set(fontes.ativos().map((f) => f.id));
  if (dados.linhas.some((l) => !validas.has(l.fonteId!))) throw new ErroHistorico('Há fonte escolhida que não existe mais. Envie o arquivo de novo.');

  const autoria = { email: quem.email };
  const lote = crypto.randomUUID();
  const anteriores = historico.ativos().filter((l) => l.ano === dados.ano);
  const totaisAnteriores = totais.ativos().filter((t) => t.ano === dados.ano);
  // Primeiro grava o novo, depois cancela o anterior: se algo falhar no meio, repetir a importação deixa tudo certo.
  await inserirRegistros(
    p,
    historico,
    dados.linhas.map((l) => ({ ano: dados.ano, fonte_id: l.fonteId!, descricao: l.descricao.trim(), receita: l.valor, linha_origem: l.linha, observacao: l.observacao?.trim() || null, lote })),
    autoria,
  );
  await inserirRegistros(
    p,
    totais,
    [{ ano: dados.ano, despesa_total: dados.despesaTotal, folha: dados.folha, saldo_livre_inicial: dados.saldoLivreInicial, receita_total_planilha: dados.totalPlanilha, lote }],
    autoria,
  );
  await atualizarVarios(p, Historico, anteriores.map((l) => ({ id: l.id, versao: l.versao, mudancas: { ativo: false } })), autoria);
  await atualizarVarios(p, HistoricoAnos, totaisAnteriores.map((t) => ({ id: t.id, versao: t.versao, mudancas: { ativo: false } })), autoria);
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'ImportacaoHistorico',
    registroId: lote,
    detalhes: { ano: dados.ano, linhas: dados.linhas.length, substituidas: anteriores.length },
  });
  return { linhas: dados.linhas.length, substituido: anteriores.length > 0 };
}

/** Desfaz a importação de um ano: cancela as linhas (ficam no histórico com ativo = FALSE). */
export async function desfazerImportacaoHistorico(p: Planilhas, quem: Autorizador, ano: number): Promise<{ linhas: number }> {
  exigir(quem, PERM.editar);
  const [historico, totais] = await lerTabelas(p, [Historico, HistoricoAnos] as const);
  const linhas = historico.ativos().filter((l) => l.ano === ano);
  const tot = totais.ativos().filter((t) => t.ano === ano);
  if (tot.length === 0 && linhas.length === 0) throw new ErroHistorico('Esse ano não tem importação.');
  const autoria = { email: quem.email };
  await atualizarVarios(p, Historico, linhas.map((l) => ({ id: l.id, versao: l.versao, mudancas: { ativo: false } })), autoria);
  await atualizarVarios(p, HistoricoAnos, tot.map((t) => ({ id: t.id, versao: t.versao, mudancas: { ativo: false } })), autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ImportacaoHistorico', detalhes: { ano, colunas: ['ativo'], linhas: linhas.length } });
  return { linhas: linhas.length };
}
