/**
 * Leitura de despesas ou receitas de uma planilha, com DE-PARA escolhido pela
 * pessoa (como na importação da folha):
 *
 * - qual aba, em qual linha está o cabeçalho e qual coluna corresponde a cada
 *   campo do item;
 * - de onde vêm os valores: uma coluna por mês, um valor anual (dividido
 *   igualmente nos 12 meses) ou, nas despesas, quantidade × vezes × valor unitário.
 *
 * O app sugere o DE-PARA pelos títulos das colunas. Regras puras: nada aqui grava.
 */
import { normalizar, paraNumero, type AbaImportada, type CelulaImportada } from './importacao';
import { arred, distribuir, valorDoItem, type Captacao, type Categoria } from './previsao';

export type TipoItem = 'despesa' | 'receita';
export type ModoValores = 'meses' | 'total' | 'unitario';

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type CampoMes = `m${(typeof MESES)[number]}`;
export type CampoItem =
  | 'servico' | 'grupo' | 'fonte' | 'descricao' | 'area' | 'captacao' | 'categoria' | 'observacao'
  | 'quantidade' | 'ocorrencias' | 'valorUnitario' | 'total' | CampoMes;

export interface DefinicaoCampoItem {
  chave: CampoItem;
  rotulo: string;
  grupo: 'identificacao' | 'valores' | 'meses';
  obrigatorio?: boolean;
  dica?: string;
  sinonimos: string[];
}

export const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SINONIMOS_MESES = [
  ['jan', 'janeiro'], ['fev', 'fevereiro'], ['mar', 'marco'], ['abr', 'abril'], ['mai', 'maio'], ['jun', 'junho'],
  ['jul', 'julho'], ['ago', 'agosto'], ['set', 'setembro'], ['out', 'outubro'], ['nov', 'novembro'], ['dez', 'dezembro'],
];

const CAMPOS_MESES: DefinicaoCampoItem[] = MESES.map((m) => ({ chave: `m${m}` as CampoMes, rotulo: NOMES_MESES[m - 1], grupo: 'meses', sinonimos: SINONIMOS_MESES[m - 1] }));

const COMUNS = {
  descricao: { chave: 'descricao', rotulo: 'Descrição', grupo: 'identificacao', obrigatorio: true, dica: 'Linhas sem descrição são puladas.', sinonimos: ['descricao', 'item', 'historico', 'especificacao', 'discriminacao', 'despesa', 'receita'] },
  observacao: { chave: 'observacao', rotulo: 'Observação', grupo: 'identificacao', sinonimos: ['observacao', 'observacoes', 'obs'] },
  total: { chave: 'total', rotulo: 'Valor anual', grupo: 'valores', dica: 'Dividido igualmente nos 12 meses.', sinonimos: ['total', 'valor anual', 'valor total', 'total anual', 'valor', 'anual'] },
} satisfies Record<string, DefinicaoCampoItem>;

export const CAMPOS_ITENS: Record<TipoItem, DefinicaoCampoItem[]> = {
  despesa: [
    { chave: 'servico', rotulo: 'Serviço (centro de custo)', grupo: 'identificacao', obrigatorio: true, sinonimos: ['servico', 'centro de custo', 'centro custo', 'cc', 'lotacao', 'setor'] },
    { chave: 'grupo', rotulo: 'Grupo de gasto', grupo: 'identificacao', obrigatorio: true, sinonimos: ['grupo', 'grupo de gasto', 'grupo de despesa', 'natureza', 'natureza da despesa', 'classificacao', 'conta'] },
    { chave: 'fonte', rotulo: 'Fonte de recurso', grupo: 'identificacao', dica: 'Sem fonte, o item fica "a definir".', sinonimos: ['fonte', 'fonte de recurso', 'recurso', 'fonte do recurso'] },
    COMUNS.descricao,
    { chave: 'categoria', rotulo: 'Categoria', grupo: 'identificacao', dica: 'Projetos ou Capital; o resto é Operacional.', sinonimos: ['categoria', 'tipo'] },
    COMUNS.observacao,
    { chave: 'quantidade', rotulo: 'Quantidade', grupo: 'valores', sinonimos: ['quantidade', 'qtd', 'qtde', 'quant'] },
    { chave: 'ocorrencias', rotulo: 'Vezes no ano', grupo: 'valores', sinonimos: ['vezes', 'ocorrencias', 'frequencia', 'vezes no ano', 'meses'] },
    { chave: 'valorUnitario', rotulo: 'Valor unitário', grupo: 'valores', sinonimos: ['valor unitario', 'vl unitario', 'vl unit', 'preco unitario', 'unitario', 'preco'] },
    COMUNS.total,
    ...CAMPOS_MESES,
  ],
  receita: [
    { chave: 'fonte', rotulo: 'Fonte de recurso', grupo: 'identificacao', obrigatorio: true, sinonimos: ['fonte', 'fonte de recurso', 'recurso', 'origem', 'fonte do recurso'] },
    COMUNS.descricao,
    { chave: 'area', rotulo: 'Área', grupo: 'identificacao', dica: 'Sem área, a receita é geral.', sinonimos: ['area', 'destino', 'area de destino'] },
    { chave: 'captacao', rotulo: 'Situação da captação', grupo: 'identificacao', dica: 'Garantida, em negociação ou a captar.', sinonimos: ['captacao', 'situacao', 'situacao da captacao', 'status'] },
    COMUNS.observacao,
    COMUNS.total,
    ...CAMPOS_MESES,
  ],
};

export interface MapeamentoItens {
  tipo: TipoItem;
  aba: string;
  /** Linha do cabeçalho, contando de 1 como na planilha. */
  cabecalho: number;
  /** Campo → índice da coluna (0 = coluna A). */
  colunas: Partial<Record<CampoItem, number>>;
  valores: ModoValores;
  /** Receitas: situação da captação quando a planilha não tem a coluna (ou ela está vazia). */
  captacaoPadrao?: Captacao;
}

const textoDe = (v: CelulaImportada) =>
  v instanceof Date ? (Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10).split('-').reverse().join('/')) : String(v ?? '').trim();
const ehTotal = (t: string) => /^(total|subtotal|soma)\b/.test(normalizar(t));

/** Sugere a coluna de cada campo pelo título (mês: "Jan", "janeiro", "jan/27"…). */
export function sugerirColunasItens(tipo: TipoItem, cabecalho: CelulaImportada[]): Partial<Record<CampoItem, number>> {
  const cab = cabecalho.map(normalizar);
  const r: Partial<Record<CampoItem, number>> = {};
  const usadas = new Set<number>();
  for (const c of CAMPOS_ITENS[tipo]) {
    const j = cab.findIndex((t, k) => !usadas.has(k) && t !== '' && (c.grupo === 'meses' ? c.sinonimos.includes(t.split(' ')[0]) : c.sinonimos.includes(t)));
    if (j >= 0) {
      r[c.chave] = j;
      usadas.add(j);
    }
  }
  return r;
}

export function modoSugerido(tipo: TipoItem, colunas: Partial<Record<CampoItem, number>>): ModoValores {
  if (MESES.filter((m) => colunas[`m${m}`] !== undefined).length >= 2) return 'meses';
  if (colunas.total !== undefined) return 'total';
  return tipo === 'despesa' && colunas.valorUnitario !== undefined ? 'unitario' : 'total';
}

const pontos = (tipo: TipoItem, linha: CelulaImportada[]) => Object.keys(sugerirColunasItens(tipo, linha)).length;

/** A linha (de 1 em diante) com mais títulos conhecidos entre as primeiras 15. */
export function cabecalhoSugeridoItens(tipo: TipoItem, linhas: CelulaImportada[][]): number {
  let melhor = 0;
  let max = 0;
  linhas.slice(0, 15).forEach((l, i) => {
    const n = pontos(tipo, l);
    if (n > max) [melhor, max] = [i, n];
  });
  return melhor + 1;
}

/** DE-PARA sugerido: a aba e o tipo pelo nome da aba ou pelos títulos das colunas. */
export function mapeamentoSugeridoItens(abas: AbaImportada[], tipoPreferido?: TipoItem): MapeamentoItens | null {
  if (abas.length === 0) return null;
  const candidatos = abas.flatMap((a) =>
    (['despesa', 'receita'] as const).map((tipo) => {
      const cab = cabecalhoSugeridoItens(tipo, a.linhas);
      const nome = normalizar(a.nome);
      const bonusNome = nome.includes(tipo) ? 5 : 0;
      const bonusPreferido = tipoPreferido === tipo ? 3 : 0;
      return { a, tipo, cab, n: pontos(tipo, a.linhas[cab - 1] ?? []) + bonusNome + bonusPreferido };
    }),
  );
  const { a, tipo, cab } = candidatos.sort((x, y) => y.n - x.n)[0];
  const colunas = sugerirColunasItens(tipo, a.linhas[cab - 1] ?? []);
  return { tipo, aba: a.nome, cabecalho: cab, colunas, valores: modoSugerido(tipo, colunas), captacaoPadrao: 'garantida' };
}

/** Confere se o DE-PARA pode ser usado. Lista vazia = ok. */
export function conferirMapeamentoItens(abas: AbaImportada[], m: MapeamentoItens): string[] {
  const erros: string[] = [];
  const aba = abas.find((a) => a.nome === m.aba);
  if (!aba) return [`A aba "${m.aba}" não existe no arquivo.`];
  if (!Number.isInteger(m.cabecalho) || m.cabecalho < 1 || m.cabecalho > aba.linhas.length) erros.push('Escolha a linha do cabeçalho.');
  for (const c of CAMPOS_ITENS[m.tipo].filter((x) => x.obrigatorio)) if (m.colunas[c.chave] === undefined) erros.push(`Escolha a coluna de "${c.rotulo}".`);
  if (m.valores === 'meses' && !MESES.some((x) => m.colunas[`m${x}`] !== undefined)) erros.push('Escolha a coluna de pelo menos um mês.');
  if (m.valores === 'total' && m.colunas.total === undefined) erros.push('Escolha a coluna do valor anual.');
  if (m.valores === 'unitario') {
    if (m.tipo !== 'despesa') erros.push('Quantidade × valor unitário só vale para despesas.');
    else if (m.colunas.valorUnitario === undefined) erros.push('Escolha a coluna do valor unitário.');
  }
  const validos = new Set(CAMPOS_ITENS[m.tipo].map((c) => c.chave));
  const usadas = Object.entries(m.colunas).filter(([campo, j]) => j !== undefined && validos.has(campo as CampoItem));
  const repetida = usadas.find(([, j], i) => usadas.findIndex(([, k]) => k === j) !== i);
  if (repetida) erros.push(`A mesma coluna foi escolhida para mais de um campo (${CAMPOS_ITENS[m.tipo].find((c) => c.chave === repetida[0])?.rotulo}).`);
  return erros;
}

export function lerCaptacao(t: string): Captacao | null {
  const n = normalizar(t);
  if (['garantida', 'garantido', 'confirmada', 'confirmado'].includes(n)) return 'garantida';
  if (['negociacao', 'em negociacao', 'negociando'].includes(n)) return 'negociacao';
  if (['a captar', 'captar', 'a captar ', 'prevista', 'previsto'].includes(n)) return 'a_captar';
  return null;
}

export function lerCategoria(t: string): Categoria {
  const n = normalizar(t);
  return n.startsWith('projeto') || n.startsWith('capital') || n.includes('investimento') ? 'projetos' : 'operacional';
}

export interface ItemLido {
  /** Linha na planilha (de 1 em diante). */
  linha: number;
  descricao: string;
  servico: string;
  grupo: string;
  fonte: string;
  area: string;
  captacao: Captacao | null;
  categoria: Categoria;
  observacao: string | null;
  quantidade: number;
  ocorrencias: number;
  valorUnitario: number;
  /** Como o valor se distribui nos meses: os da planilha (manual) ou igual nos 12. */
  distribuicao: 'manual' | 'igual';
  meses: number[];
  total: number;
  /** O que impede a importação desta linha (null = pode importar). */
  problema: string | null;
}

/** Lê os itens pelo DE-PARA. Chame `conferirMapeamentoItens` antes. Linhas em branco e de total são puladas. */
export function lerItens(abas: AbaImportada[], m: MapeamentoItens): ItemLido[] {
  const aba = abas.find((a) => a.nome === m.aba)!;
  const col = m.colunas;
  const pegar = (linha: CelulaImportada[], campo: CampoItem) => (col[campo] === undefined ? undefined : linha[col[campo]!]);
  const txt = (linha: CelulaImportada[], campo: CampoItem) => textoDe(pegar(linha, campo)).replace(/\s+/g, ' ');
  const num = (linha: CelulaImportada[], campo: CampoItem) => paraNumero(pegar(linha, campo));
  const itens: ItemLido[] = [];

  aba.linhas.slice(m.cabecalho).forEach((linha, k) => {
    const numero = m.cabecalho + k + 1;
    const descricao = txt(linha, 'descricao');
    const servico = txt(linha, 'servico');
    const grupo = txt(linha, 'grupo');
    const fonte = txt(linha, 'fonte');
    const mesesBrutos = MESES.map((x) => num(linha, `m${x}`));
    const algumValor = mesesBrutos.some((v) => v) || num(linha, 'total') || num(linha, 'valorUnitario');
    if (!descricao && !servico && !grupo && !fonte && !algumValor) return; // linha em branco
    if ([descricao, servico, grupo, fonte].some((t) => t && ehTotal(t))) return; // linha de total

    let quantidade = 1;
    let ocorrencias = 1;
    let valorUnitario = 0;
    let meses: number[] = Array(12).fill(0);
    let distribuicao: ItemLido['distribuicao'] = 'igual';
    let problema: string | null = null;
    if (m.valores === 'meses') {
      meses = mesesBrutos.map((v) => arred(v ?? 0));
      distribuicao = 'manual';
      valorUnitario = arred(meses.reduce((s, v) => s + v, 0));
    } else if (m.valores === 'total') {
      valorUnitario = arred(num(linha, 'total') ?? 0);
    } else {
      quantidade = num(linha, 'quantidade') ?? 1;
      ocorrencias = num(linha, 'ocorrencias') ?? 1;
      valorUnitario = num(linha, 'valorUnitario') ?? 0;
      if (quantidade <= 0 || ocorrencias <= 0) problema = 'Quantidade e vezes precisam ser maiores que zero.';
    }
    const total = m.valores === 'unitario' ? valorDoItem(quantidade, ocorrencias, valorUnitario) : valorUnitario;
    if (!problema && (meses.some((v) => v < 0) || total < 0)) problema = 'Valor negativo.';
    if (!problema && distribuicao === 'igual' && total > 0) meses = distribuir(total, 'igual');

    const captacaoTexto = txt(linha, 'captacao');
    const captacao = captacaoTexto ? lerCaptacao(captacaoTexto) : (m.captacaoPadrao ?? 'garantida');
    if (!problema) {
      if (!descricao) problema = 'Falta a descrição.';
      else if (m.tipo === 'despesa' && !servico) problema = 'Falta o serviço.';
      else if (m.tipo === 'despesa' && !grupo) problema = 'Falta o grupo de gasto.';
      else if (m.tipo === 'receita' && !fonte) problema = 'Falta a fonte de recurso.';
      else if (!(total > 0)) problema = 'Sem valor.';
      else if (m.tipo === 'receita' && !captacao) problema = `Situação da captação "${captacaoTexto}" não reconhecida.`;
    }
    itens.push({
      linha: numero,
      descricao,
      servico,
      grupo,
      fonte,
      area: m.tipo === 'receita' ? txt(linha, 'area') : '',
      captacao: m.tipo === 'receita' ? captacao : null,
      categoria: lerCategoria(txt(linha, 'categoria')),
      observacao: txt(linha, 'observacao') || null,
      quantidade,
      ocorrencias,
      valorUnitario: arred(valorUnitario),
      distribuicao,
      meses,
      total: arred(total),
      problema,
    });
  });
  return itens;
}
