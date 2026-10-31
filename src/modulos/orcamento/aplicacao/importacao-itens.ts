/**
 * Importação de despesas ou receitas de uma planilha, em passos:
 * 1. descrever: as abas do arquivo e o DE-PARA sugerido. Não grava nada.
 * 2. analisar: lê pelo DE-PARA escolhido, reconhece serviços, grupos, fontes e
 *    áreas pelo nome e mostra o relatório. Não grava nada.
 * 3. importar: a pessoa diz a qual cadastro corresponde cada nome que o app não
 *    reconheceu (só cadastros existentes) e confirma. Tudo é conferido de novo.
 *
 * Só no exercício em elaboração. Uma nova importação do mesmo ano e tipo
 * substitui a anterior: os itens importados antes são cancelados (ficam no
 * histórico, com ativo = FALSE). O que foi lançado à mão e as propostas não são tocados.
 */
import { z } from 'zod';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizarVarios, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { Despesas, Exercicios, Fontes, GruposGasto, ItensImportados, Parametros, Receitas } from '../dados/tabelas';
import { parametrosCom } from '../dominio/folha';
import { resumirAbas, type AbaImportada, type AbaResumida } from '../dominio/importacao';
import {
  conferirMapeamentoItens, lerItens, mapeamentoSugeridoItens, type ItemLido, type MapeamentoItens, type TipoItem,
} from '../dominio/importacao-itens';
import { arred, distribuir, nomeComparavel } from '../dominio/previsao';
import { ErroValidacaoFolha } from './folha';

function exigir(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
}

const coluna = z.number().int().min(0).max(500);
const esquemaMapeamento = z.object({
  tipo: z.enum(['despesa', 'receita']),
  aba: z.string(),
  cabecalho: z.number().int(),
  colunas: z.record(z.string(), coluna),
  valores: z.enum(['meses', 'total', 'unitario']),
  captacaoPadrao: z.enum(['garantida', 'negociacao', 'a_captar']).optional(),
});

/** Confere o formato do DE-PARA que veio da tela. */
export function lerMapeamentoItens(bruto: unknown): MapeamentoItens {
  const r = esquemaMapeamento.safeParse(bruto);
  if (!r.success) throw new ErroValidacaoFolha('O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.');
  return r.data as MapeamentoItens;
}

/** Os nomes da planilha e o cadastro escolhido para cada um ('' = a definir / geral, quando permitido). */
const esquemaNomes = z.array(z.object({ nome: z.string(), valor: z.string().nullable() }));

const esquemaProposta = z.object({
  tipo: z.enum(['despesa', 'receita']),
  ano: z.number().int(),
  nomes: z.object({ servico: esquemaNomes, grupo: esquemaNomes, fonte: esquemaNomes, area: esquemaNomes }),
  itens: z.array(
    z.object({
      linha: z.number(),
      descricao: z.string(),
      servico: z.string(),
      grupo: z.string(),
      fonte: z.string(),
      area: z.string(),
      captacao: z.enum(['garantida', 'negociacao', 'a_captar']).nullable(),
      categoria: z.enum(['operacional', 'projetos']),
      observacao: z.string().nullable(),
      quantidade: z.number().positive(),
      ocorrencias: z.number().positive(),
      valorUnitario: z.number().min(0),
      distribuicao: z.enum(['manual', 'igual']),
      meses: z.array(z.number().min(0)).length(12),
      total: z.number().positive(),
    }),
  ),
});

export type PropostaItens = z.infer<typeof esquemaProposta>;
type Nomes = PropostaItens['nomes'];
type ChaveNome = keyof Nomes;

export interface RelatorioItens {
  aba: string;
  tipo: TipoItem;
  ano: number;
  itens: number;
  total: number;
  porMes: number[];
  problemas: { linha: number; descricao: string; problema: string }[];
  /** Itens de importações anteriores (mesmo ano e tipo) que serão cancelados. */
  substituir: number;
}

export interface AnaliseItens {
  proposta: PropostaItens;
  relatorio: RelatorioItens;
  /** Cadastros existentes, para escolher a correspondência de cada nome. */
  opcoes: Record<ChaveNome, { valor: string; nome: string; grupo?: string }[]>;
}

/** Passo 1: as abas e o DE-PARA sugerido. Não grava nada. */
export function descreverArquivoItens(quem: Autorizador, abas: AbaImportada[], tipo?: TipoItem): { abas: AbaResumida[]; sugestao: MapeamentoItens | null } {
  exigir(quem);
  if (abas.length === 0) throw new ErroValidacaoFolha('O arquivo não tem abas.');
  return { abas: resumirAbas(abas), sugestao: mapeamentoSugeridoItens(abas, tipo) };
}

/** O exercício em elaboração (o da folha, se houver mais de um). */
async function anoEmElaboracao(p: Planilhas): Promise<number> {
  const [exercicios, parametros] = await lerTabelas(p, [Exercicios, Parametros] as const);
  const abertos = exercicios.ativos().filter((e) => e.situacao === 'elaboracao').map((e) => e.ano);
  if (abertos.length === 0) throw new ErroValidacaoFolha('Não há exercício em elaboração. Abra o exercício na Previsão do ano antes de importar.');
  const daFolha = parametrosCom(Object.fromEntries(parametros.ativos().map((x) => [x.chave, x.valor]))).ano;
  return abertos.includes(daFolha) ? daFolha : Math.max(...abertos);
}

async function cadastros(p: Planilhas) {
  const [servicos, areas, grupos, fontes] = await lerTabelas(p, [Servicos, Areas, GruposGasto, Fontes] as const);
  const nomeArea = new Map(areas.ativos().map((a) => [a.codigo, a.nome]));
  const opcoes: AnaliseItens['opcoes'] = {
    servico: servicos
      .ativos()
      .map((s) => ({ valor: s.codigo, nome: s.nome, grupo: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
    grupo: grupos.ativos().map((g) => ({ valor: g.id, nome: g.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    fonte: fontes.ativos().map((f) => ({ valor: f.id, nome: f.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    area: areas.ativos().map((a) => ({ valor: a.codigo, nome: a.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
  // Reconhece pelo nome (sem acento nem maiúscula) ou pelo código.
  const reconhecer = (chave: ChaveNome) => {
    const mapa = new Map<string, string>();
    for (const o of opcoes[chave]) {
      mapa.set(nomeComparavel(o.nome), o.valor);
      if (chave === 'servico' || chave === 'area') mapa.set(nomeComparavel(o.valor), o.valor);
    }
    return (nome: string) => mapa.get(nomeComparavel(nome)) ?? null;
  };
  return { opcoes, reconhecer };
}

/** Passo 2: lê pelo DE-PARA e mostra o que será importado. Não grava nada. */
export async function analisarImportacaoItens(p: Planilhas, quem: Autorizador, abas: AbaImportada[], m: MapeamentoItens): Promise<AnaliseItens> {
  exigir(quem);
  const erros = conferirMapeamentoItens(abas, m);
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' '));
  const ano = await anoEmElaboracao(p);
  const lidos = lerItens(abas, m);
  if (lidos.length === 0) throw new ErroValidacaoFolha('Não encontrei itens na aba escolhida. Confira a aba e a linha do cabeçalho.');
  const validos = lidos.filter((x) => !x.problema);
  const { opcoes, reconhecer } = await cadastros(p);

  const campos: Record<ChaveNome, (x: ItemLido) => string> = { servico: (x) => x.servico, grupo: (x) => x.grupo, fonte: (x) => x.fonte, area: (x) => x.area };
  const usados: Record<ChaveNome, boolean> = { servico: m.tipo === 'despesa', grupo: m.tipo === 'despesa', fonte: true, area: m.tipo === 'receita' };
  const nomes = Object.fromEntries(
    (Object.keys(campos) as ChaveNome[]).map((chave) => {
      if (!usados[chave]) return [chave, []];
      const distintos = new Map<string, string>();
      for (const x of validos) {
        const n = campos[chave](x);
        if (n) distintos.set(nomeComparavel(n), n);
      }
      const lista = [...distintos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((nome) => ({ nome, valor: reconhecer(chave)(nome) }));
      return [chave, lista];
    }),
  ) as Nomes;

  const [importados, despesas, receitas] = await lerTabelas(p, [ItensImportados, Despesas, Receitas] as const);
  const ativos = new Set((m.tipo === 'despesa' ? despesas : receitas).ativos().map((x) => x.id));
  const substituir = importados.ativos().filter((x) => x.ano === ano && x.tipo === m.tipo && ativos.has(x.item_id)).length;

  const porMes = Array(12).fill(0) as number[];
  for (const x of validos) x.meses.forEach((v, i) => (porMes[i] = arred(porMes[i] + v)));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'ImportacaoItens', detalhes: { tipo: m.tipo, itens: validos.length } });
  return {
    proposta: { tipo: m.tipo, ano, nomes, itens: validos.map(({ problema, ...x }) => (void problema, x)) },
    relatorio: {
      aba: m.aba,
      tipo: m.tipo,
      ano,
      itens: validos.length,
      total: arred(validos.reduce((s, x) => s + x.total, 0)),
      porMes,
      problemas: lidos.filter((x) => x.problema).map((x) => ({ linha: x.linha, descricao: x.descricao, problema: x.problema! })),
      substituir,
    },
    opcoes,
  };
}

/** Passo 3: grava os itens e cancela os da importação anterior do mesmo ano e tipo. */
export async function importarItens(p: Planilhas, quem: Autorizador, bruta: unknown): Promise<{ itens: number; substituidos: number }> {
  exigir(quem);
  const r = esquemaProposta.safeParse(bruta);
  if (!r.success) throw new ErroValidacaoFolha('A importação veio incompleta. Envie o arquivo de novo.');
  const proposta = r.data;
  if (proposta.itens.length === 0) throw new ErroValidacaoFolha('Não há itens para importar.');
  const [exercicios, importados, despesas, receitas] = await lerTabelas(p, [Exercicios, ItensImportados, Despesas, Receitas] as const);
  const exercicio = exercicios.ativos().find((e) => e.ano === proposta.ano);
  if (!exercicio || exercicio.situacao !== 'elaboracao') throw new ErroValidacaoFolha(`O exercício ${proposta.ano} não está mais em elaboração. Nada foi importado.`);

  // Cada nome precisa apontar para um cadastro que existe; fonte da despesa e área da receita podem ficar em branco.
  const { opcoes } = await cadastros(p);
  const despesa = proposta.tipo === 'despesa';
  const opcional: Record<ChaveNome, boolean> = { servico: false, grupo: false, fonte: despesa, area: true };
  const rotulo: Record<ChaveNome, string> = { servico: 'serviço', grupo: 'grupo de gasto', fonte: 'fonte de recurso', area: 'área' };
  const mapas = {} as Record<ChaveNome, Map<string, string | null>>;
  for (const chave of Object.keys(rotulo) as ChaveNome[]) {
    const validos = new Set(opcoes[chave].map((o) => o.valor));
    const faltando = proposta.nomes[chave].filter((n) => n.valor === null || (n.valor === '' && !opcional[chave])).map((n) => n.nome);
    if (faltando.length) throw new ErroValidacaoFolha(`Escolha o ${rotulo[chave]} correspondente a: ${faltando.join(', ')}.`);
    if (proposta.nomes[chave].some((n) => n.valor && !validos.has(n.valor))) throw new ErroValidacaoFolha('Há cadastro escolhido que não existe mais. Envie o arquivo de novo.');
    mapas[chave] = new Map(proposta.nomes[chave].map((n) => [nomeComparavel(n.nome), n.valor || null]));
  }
  const de = (chave: ChaveNome, nome: string) => {
    if (!nome) return null;
    if (!mapas[chave].has(nomeComparavel(nome))) throw new ErroValidacaoFolha('Há item com nome sem correspondência. Envie o arquivo de novo.');
    return mapas[chave].get(nomeComparavel(nome)) ?? null;
  };
  const meses = (x: PropostaItens['itens'][number]) => {
    const lista = x.distribuicao === 'manual' ? distribuir(x.total, 'manual', { manual: x.meses }) : distribuir(x.total, 'igual');
    return Object.fromEntries(lista.map((v, i) => [`m${i + 1}`, v]));
  };

  const autoria = { email: quem.email };
  let gravados: { id: string }[];
  if (despesa) {
    const linhas = proposta.itens.map((x) => {
      const servico = de('servico', x.servico);
      const grupo = de('grupo', x.grupo);
      if (!servico || !grupo) throw new ErroValidacaoFolha(`Linha ${x.linha}: falta o serviço ou o grupo.`);
      return {
        ano: proposta.ano,
        servico,
        grupo_id: grupo,
        fonte_id: de('fonte', x.fonte),
        descricao: x.descricao,
        quantidade: x.quantidade,
        ocorrencias: x.ocorrencias,
        valor_unitario: x.valorUnitario,
        distribuicao: x.distribuicao,
        ...meses(x),
        categoria: x.categoria,
        prioridade: null,
        cotacao: null,
        situacao: 'aceito',
        observacao: x.observacao,
      };
    });
    gravados = await inserirRegistros(p, despesas, linhas as never, autoria);
  } else {
    const linhas = proposta.itens.map((x) => {
      const fonte = de('fonte', x.fonte);
      if (!fonte || !x.captacao) throw new ErroValidacaoFolha(`Linha ${x.linha}: falta a fonte ou a situação da captação.`);
      return {
        ano: proposta.ano,
        fonte_id: fonte,
        descricao: x.descricao,
        valor: x.total,
        captacao: x.captacao,
        area: de('area', x.area),
        distribuicao: x.distribuicao,
        ...meses(x),
        observacao: x.observacao,
      };
    });
    gravados = await inserirRegistros(p, receitas, linhas as never, autoria);
  }

  // Primeiro grava o novo, depois cancela o anterior: se algo falhar no meio, repetir a importação deixa tudo certo.
  const lote = crypto.randomUUID();
  const anteriores = importados.ativos().filter((x) => x.ano === proposta.ano && x.tipo === proposta.tipo);
  await inserirRegistros(p, importados, gravados.map((g) => ({ ano: proposta.ano, tipo: proposta.tipo, item_id: g.id, lote })), autoria);
  const tabela = despesa ? despesas : receitas;
  const aCancelar = anteriores.map((x) => tabela.porId(x.item_id)).filter((x): x is NonNullable<typeof x> => Boolean(x?.ativo));
  await atualizarVarios(p, (despesa ? Despesas : Receitas) as typeof Despesas, aCancelar.map((x) => ({ id: x.id, versao: x.versao, mudancas: { ativo: false } })), autoria);
  await atualizarVarios(p, ItensImportados, anteriores.map((x) => ({ id: x.id, versao: x.versao, mudancas: { ativo: false } })), autoria);

  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'ImportacaoItens',
    registroId: lote,
    detalhes: { tipo: proposta.tipo, ano: proposta.ano, itens: gravados.length, substituidos: aCancelar.length },
  });
  return { itens: gravados.length, substituidos: aCancelar.length };
}

