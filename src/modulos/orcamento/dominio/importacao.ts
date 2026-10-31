/**
 * Leitura da planilha da folha com DE-PARA escolhido pela pessoa:
 *
 * - Folha: qual aba tem os funcionários, em qual linha está o cabeçalho e
 *   qual coluna da planilha corresponde a cada campo do cadastro.
 * - Lotação: de onde vem — uma coluna da própria aba da folha (100% no
 *   serviço), outra aba (colunas Funcionário, Serviço e Percentual, ou uma
 *   coluna por serviço) ou nenhuma.
 * - Só lotação: o arquivo traz apenas a aba de rateio, para funcionários já
 *   cadastrados (a folha foi importada antes, sem rateio).
 *
 * O app sugere o DE-PARA pelos nomes do cabeçalho (sem diferenciar
 * maiúsculas, acentos e pontuação), e a pessoa confere ou muda.
 * Regras puras: nada aqui grava dados.
 */
import { COMPONENTES, type ChaveComponente } from './folha';

export type CelulaImportada = string | number | boolean | Date | null | undefined;
export interface AbaImportada {
  nome: string;
  linhas: CelulaImportada[][];
}

export const normalizar = (t: unknown) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª.:/()\-_%#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Código a partir do nome: minúsculas, sem acentos, com "_". */
export function codigoDe(nome: string, usados: Set<string>): string {
  const base =
    normalizar(nome)
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .replace(/ /g, '_')
      .slice(0, 40) || 'item';
  let codigo = base;
  for (let i = 2; usados.has(codigo); i++) codigo = `${base}_${i}`;
  usados.add(codigo);
  return codigo;
}

// ---------------------------------------------------------------------------
// Campos do cadastro (o "PARA" do DE-PARA)
// ---------------------------------------------------------------------------

export type CampoFolha =
  'ficha' | 'colaborador' | 'inicio' | 'cargo' | 'departamento' | 'lotacao' | 'carga' | 'reajuste' | 'horaAtividade' | 'total' | ChaveComponente;

export interface DefinicaoCampo {
  chave: CampoFolha;
  rotulo: string;
  grupo: 'identificacao' | 'valores' | 'conferencia';
  obrigatorio?: boolean;
  dica?: string;
  sinonimos: string[];
}

const SINONIMOS_COMPONENTES: Record<ChaveComponente, string[]> = {
  salario_atual: ['salario atual', 'salario', 'salario nominal'],
  adicional_salarial: ['adicional salarial', 'adicional', 'adicional tempo de servico', 'ats'],
  ajuda_custo: ['ajuda de custo', 'ajuda custo'],
  bolsa_estagio: ['bolsa estagio', 'bolsa de estagio'],
  insalubridade: ['insalubridade'],
  periculosidade: ['periculosidade'],
  gratificacao_funcao: ['g funcao', 'gratificacao de funcao', 'gratificacao', 'funcao gratificada'],
  plano_saude: ['plano de saude', 'plano saude'],
  bolsa_estudo: ['bolsa estudo', 'bolsa de estudo'],
  locomocao: ['locomocao', 'vale transporte'],
  alimentacao: ['alimentacao', 'vale alimentacao'],
  ferias: ['ferias'],
  abono: ['abono'],
  indenizacoes: ['indez', 'indenizacoes', 'indenizacao'],
};

export const CAMPOS_FOLHA: DefinicaoCampo[] = [
  {
    chave: 'ficha',
    rotulo: 'Código (ficha)',
    grupo: 'identificacao',
    dica: 'Vazio = vaga prevista.',
    sinonimos: ['codigo', 'cod', 'ficha', 'n ficha', 'no ficha', 'numero ficha', 'n da ficha', 'matricula', 'registro'],
  },
  {
    chave: 'colaborador',
    rotulo: 'Nome',
    grupo: 'identificacao',
    sinonimos: ['nome', 'colaborador', 'funcionario', 'nome do colaborador', 'empregado'],
  },
  {
    chave: 'inicio',
    rotulo: 'Admissão',
    grupo: 'identificacao',
    dica: 'Sem data, entra em 1º de janeiro.',
    sinonimos: ['admissao', 'data admissao', 'data de admissao', 'inicio', 'data inicio', 'data de inicio'],
  },
  {
    chave: 'cargo',
    rotulo: 'Cargo',
    grupo: 'identificacao',
    obrigatorio: true,
    dica: 'Linhas sem cargo são puladas.',
    sinonimos: ['cargo', 'funcao', 'cargo funcao'],
  },
  {
    chave: 'departamento',
    rotulo: 'Departamento',
    grupo: 'identificacao',
    sinonimos: ['departamento', 'depto', 'setor'],
  },
  {
    chave: 'lotacao',
    rotulo: 'Lotação',
    grupo: 'identificacao',
    dica: 'Serviço em que a pessoa está lotada (100%).',
    sinonimos: ['lotacao', 'centro de custo', 'servico'],
  },
  {
    chave: 'carga',
    rotulo: 'Carga horária mensal',
    grupo: 'identificacao',
    sinonimos: ['carga horaria', 'ch', 'c h', 'carga', 'horas', 'carga horaria mensal', 'jornada'],
  },
  {
    chave: 'reajuste',
    rotulo: 'Reajuste (%)',
    grupo: 'valores',
    sinonimos: ['reajuste', 'reajuste %'],
  },
  {
    chave: 'horaAtividade',
    rotulo: 'Hora atividade',
    grupo: 'valores',
    dica: 'Qualquer valor maior que zero = recebe.',
    sinonimos: ['hora atividade', 'h atividade', 'horas atividade'],
  },
  ...COMPONENTES.map((c): DefinicaoCampo => ({
    chave: c.chave,
    rotulo: c.nome,
    grupo: 'valores',
    obrigatorio: c.chave === 'salario_atual',
    sinonimos: SINONIMOS_COMPONENTES[c.chave],
  })),
  {
    chave: 'total',
    rotulo: 'Total (só para conferir)',
    grupo: 'conferencia',
    dica: 'Comparado com o total que o app calcula.',
    sinonimos: ['total', 'custo total', 'custo mensal', 'total mensal'],
  },
];

const SINONIMOS_LOTACAO = {
  funcionario: CAMPOS_FOLHA[0].sinonimos.concat(CAMPOS_FOLHA[1].sinonimos),
  servico: ['servico', 'centro de custo', 'centro custo', 'centro', 'cc', 'lotacao'],
  percentual: ['percentual', 'rateio', 'perc', 'porcentagem', '%', ''],
};

/** Colunas da aba Estudo com fórmula: o app calcula e por isso não importa. */
const CALCULADAS = ['valor hora', 'vhora base', 'salariobase', 'salario base', '1 3 ferias', '13o sal', '13 sal', '13o salario', 'fgts', 'coluna 1'];

// ---------------------------------------------------------------------------
// Mapeamento (o DE-PARA escolhido)
// ---------------------------------------------------------------------------

export interface MapeamentoFolha {
  aba: string;
  /** Linha do cabeçalho, contando de 1 como na planilha. */
  cabecalho: number;
  /** Campo do cadastro → índice da coluna na planilha (0 = coluna A). */
  colunas: Partial<Record<CampoFolha, number>>;
}

export type MapeamentoLotacao =
  | { modo: 'nenhuma' }
  /** A coluna "Lotação" da aba da folha vale 100%. */
  | { modo: 'coluna' }
  /** Outra aba, uma linha por serviço: Funcionário, Serviço, Percentual. */
  | {
      modo: 'linhas';
      aba: string;
      cabecalho: number;
      funcionario: number;
      servico: number;
      percentual: number | null;
    }
  /** Outra aba, uma coluna por serviço com o percentual na célula. */
  | {
      modo: 'colunas';
      aba: string;
      cabecalho: number;
      funcionario: number;
      servicos: number[];
    };

export interface Mapeamento {
  folha: MapeamentoFolha;
  lotacao: MapeamentoLotacao;
  /** Só a aba de lotação, para quem já está cadastrado: a parte da folha é ignorada. */
  soLotacao?: boolean;
}

/** O começo de cada aba, para a pessoa escolher aba, cabeçalho e colunas. */
export interface AbaResumida {
  nome: string;
  /** Primeiras linhas, como texto (até 15 linhas e 80 colunas). */
  linhas: string[][];
  totalLinhas: number;
  /** Linha provável do cabeçalho (de 1 em diante). */
  cabecalhoSugerido: number;
}

const textoDe = (v: CelulaImportada) =>
  v instanceof Date ? (Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10).split('-').reverse().join('/')) : String(v ?? '').trim();

const LINHAS_INICIAIS = 15;

export function resumirAbas(abas: AbaImportada[]): AbaResumida[] {
  return abas.map((a) => ({
    nome: a.nome,
    linhas: a.linhas.slice(0, LINHAS_INICIAIS).map((l) => Array.from({ length: Math.min(l.length, 80) }, (_, j) => textoDe(l[j]).slice(0, 60))),
    totalLinhas: a.linhas.length,
    cabecalhoSugerido: sugerirCabecalho(a.linhas),
  }));
}

/** A linha (de 1 em diante) com mais nomes de campos conhecidos entre as primeiras; senão, a primeira com 3+ textos. */
function sugerirCabecalho(linhas: CelulaImportada[][]): number {
  const conhecidos = new Set([...CAMPOS_FOLHA.flatMap((c) => c.sinonimos), ...SINONIMOS_LOTACAO.servico, ...SINONIMOS_LOTACAO.percentual].filter(Boolean));
  let melhor = -1;
  let pontos = 0;
  linhas.slice(0, LINHAS_INICIAIS).forEach((l, i) => {
    const n = l.filter((c) => conhecidos.has(normalizar(c))).length;
    if (n > pontos) [melhor, pontos] = [i, n];
  });
  if (melhor >= 0 && pontos >= 2) return melhor + 1;
  const primeira = linhas.slice(0, LINHAS_INICIAIS).findIndex((l) => l.filter((c) => typeof c === 'string' && c.trim()).length >= 3);
  return primeira >= 0 ? primeira + 1 : 1;
}

const indice = (cab: string[], sinonimos: string[]) => cab.findIndex((c) => c !== '' && sinonimos.includes(c));

/** Sugere a coluna de cada campo do cadastro pelo nome do cabeçalho. */
export function sugerirColunasFolha(cabecalho: CelulaImportada[]): Partial<Record<CampoFolha, number>> {
  const cab = cabecalho.map(normalizar);
  const r: Partial<Record<CampoFolha, number>> = {};
  for (const c of CAMPOS_FOLHA) {
    const j = indice(cab, c.sinonimos);
    if (j >= 0) r[c.chave] = j;
  }
  return r;
}

/** Sugere o DE-PARA da aba de lotação: funcionário, serviço e percentual, ou uma coluna por serviço. */
export function sugerirColunasLotacao(cabecalho: CelulaImportada[]): {
  funcionario: number | null;
  servico: number | null;
  percentual: number | null;
  servicos: number[];
} {
  const cab = cabecalho.map(normalizar);
  const pos = (s: string[]) => {
    const j = indice(cab, s);
    return j >= 0 ? j : null;
  };
  const funcionario = pos(CAMPOS_FOLHA[0].sinonimos) ?? pos(CAMPOS_FOLHA[1].sinonimos);
  const servico = pos(SINONIMOS_LOTACAO.servico);
  // "%" sozinho vira texto vazio ao normalizar: procura pelo título original.
  const simbolo = cabecalho.findIndex((c) => String(c ?? '').trim() === '%');
  const percentual = pos(SINONIMOS_LOTACAO.percentual.filter(Boolean)) ?? (simbolo >= 0 ? simbolo : null);
  const fora = new Set(
    ['ficha', 'colaborador', 'cargo', 'departamento', 'carga', 'total'].map((k) => indice(cab, CAMPOS_FOLHA.find((c) => c.chave === k)!.sinonimos)),
  );
  const servicos = cab
    .map((c, j) => ({ c, j }))
    .filter(({ c, j }) => c && !fora.has(j) && !['soma', 'total', 'soma rateio', 'conferencia'].includes(c))
    .map(({ j }) => j);
  return { funcionario, servico, percentual, servicos };
}

const acharAba = (abas: AbaImportada[], nomes: string[]) =>
  abas.find((a) => nomes.includes(normalizar(a.nome))) ?? abas.find((a) => nomes.some((n) => normalizar(a.nome).includes(n)));

/** DE-PARA sugerido para o arquivo todo (a pessoa confere na tela). */
export function mapeamentoSugerido(abas: AbaImportada[]): Mapeamento | null {
  const pontos = (a: AbaImportada) => Object.keys(sugerirColunasFolha(a.linhas[sugerirCabecalho(a.linhas) - 1] ?? [])).length;
  const folha = acharAba(abas, ['estudo', 'folha', 'postos', 'colaboradores', 'funcionarios']) ?? [...abas].sort((a, b) => pontos(b) - pontos(a))[0];
  if (!folha) return null;
  const cabFolha = sugerirCabecalho(folha.linhas);
  const colunas = sugerirColunasFolha(folha.linhas[cabFolha - 1] ?? []);
  // Sem Cargo nem Salário, mas com Funcionário e Serviço: é um arquivo só de lotação.
  if (colunas.cargo === undefined && colunas.salario_atual === undefined) {
    const so = abas
      .map((a) => ({ a, cab: sugerirCabecalho(a.linhas) }))
      .map(({ a, cab }) => ({
        a,
        cab,
        s: sugerirColunasLotacao(a.linhas[cab - 1] ?? []),
      }))
      .find(({ s }) => s.funcionario !== null && s.servico !== null);
    if (so) {
      return {
        soLotacao: true,
        folha: { aba: so.a.nome, cabecalho: so.cab, colunas: {} },
        lotacao: {
          modo: 'linhas',
          aba: so.a.nome,
          cabecalho: so.cab,
          funcionario: so.s.funcionario!,
          servico: so.s.servico!,
          percentual: so.s.percentual,
        },
      };
    }
  }
  const abaRateio = acharAba(
    abas.filter((a) => a !== folha),
    ['rateio', 'lotacao', 'lotacoes'],
  );
  let lotacao: MapeamentoLotacao = colunas.lotacao !== undefined ? { modo: 'coluna' } : { modo: 'nenhuma' };
  if (abaRateio) {
    const cab = sugerirCabecalho(abaRateio.linhas);
    const s = sugerirColunasLotacao(abaRateio.linhas[cab - 1] ?? []);
    if (s.funcionario !== null && s.servico !== null) {
      lotacao = {
        modo: 'linhas',
        aba: abaRateio.nome,
        cabecalho: cab,
        funcionario: s.funcionario,
        servico: s.servico,
        percentual: s.percentual,
      };
    } else if (s.funcionario !== null && s.servicos.length) {
      lotacao = {
        modo: 'colunas',
        aba: abaRateio.nome,
        cabecalho: cab,
        funcionario: s.funcionario,
        servicos: s.servicos,
      };
    }
  }
  return { folha: { aba: folha.nome, cabecalho: cabFolha, colunas }, lotacao };
}

/** Confere se o DE-PARA pode ser usado. Devolve a lista de problemas (vazia = ok). */
export function conferirMapeamento(abas: AbaImportada[], m: Mapeamento): string[] {
  if (m.soLotacao) {
    if (m.lotacao.modo !== 'linhas' && m.lotacao.modo !== 'colunas') return ['Para importar só a lotação, escolha a aba com os rateios.'];
    return conferirLotacao(abas, m.lotacao);
  }
  const erros: string[] = [];
  const aba = abas.find((a) => a.nome === m.folha.aba);
  if (!aba) return [`A aba "${m.folha.aba}" não existe no arquivo.`];
  if (!Number.isInteger(m.folha.cabecalho) || m.folha.cabecalho < 1 || m.folha.cabecalho > aba.linhas.length)
    erros.push('Escolha a linha do cabeçalho da folha.');
  for (const c of CAMPOS_FOLHA.filter((x) => x.obrigatorio)) {
    if (m.folha.colunas[c.chave] === undefined) erros.push(`Escolha a coluna de "${c.rotulo}".`);
  }
  if (m.folha.colunas.ficha === undefined && m.folha.colunas.colaborador === undefined) erros.push('Escolha a coluna do Código ou do Nome do funcionário.');
  const usadas = Object.entries(m.folha.colunas).filter(([, j]) => j !== undefined);
  const repetidas = usadas.filter(([, j], i) => usadas.findIndex(([, k]) => k === j) !== i);
  for (const [campo] of repetidas) erros.push(`A mesma coluna foi escolhida para mais de um campo (${CAMPOS_FOLHA.find((c) => c.chave === campo)?.rotulo}).`);

  const l = m.lotacao;
  if (l.modo === 'coluna' && m.folha.colunas.lotacao === undefined) erros.push('Para usar a lotação da própria folha, escolha a coluna "Lotação".');
  if (l.modo === 'linhas' || l.modo === 'colunas') erros.push(...conferirLotacao(abas, l));
  return erros;
}

type LotacaoEmAba = Extract<MapeamentoLotacao, { modo: 'linhas' | 'colunas' }>;

function conferirLotacao(abas: AbaImportada[], l: LotacaoEmAba): string[] {
  const erros: string[] = [];
  const abaL = abas.find((a) => a.nome === l.aba);
  if (!abaL) erros.push(`A aba de lotação "${l.aba}" não existe no arquivo.`);
  else if (!Number.isInteger(l.cabecalho) || l.cabecalho < 1 || l.cabecalho > abaL.linhas.length) erros.push('Escolha a linha do cabeçalho da lotação.');
  if (!Number.isInteger(l.funcionario) || l.funcionario < 0) erros.push('Escolha a coluna que identifica o funcionário na lotação.');
  if (l.modo === 'linhas' && (!Number.isInteger(l.servico) || l.servico < 0)) erros.push('Escolha a coluna do serviço na lotação.');
  if (l.modo === 'colunas' && l.servicos.length === 0) erros.push('Marque as colunas que são serviços na lotação.');
  return erros;
}

/** Lotação lida de uma aba, agrupada por funcionário (código ou nome, como está na planilha). */
export interface LotacaoLida {
  quem: string;
  lotacao: { centro: string; percentual: number }[];
}

/** Lê a aba de lotação; percentuais em fração (0,5) viram 50. Chame `conferirLotacao` antes. */
export function lerAbaLotacao(abas: AbaImportada[], l: LotacaoEmAba): LotacaoLida[] {
  const abaL = abas.find((a) => a.nome === l.aba)!;
  const cabOriginal = (abaL.linhas[l.cabecalho - 1] ?? []).map(textoDe);
  const brutos: { quem: string; centro: string; valor: number }[] = [];
  for (const linha of abaL.linhas.slice(l.cabecalho)) {
    const quem = fichaDe(linha[l.funcionario]);
    if (!quem || ehTotal(quem)) continue;
    if (l.modo === 'linhas') {
      const centro = textoDe(linha[l.servico]);
      const v = l.percentual === null ? 100 : paraNumero(linha[l.percentual]);
      if (centro && v) brutos.push({ quem, centro, valor: v });
    } else {
      for (const j of l.servicos) {
        const v = paraNumero(linha[j]);
        if (v && cabOriginal[j]) brutos.push({ quem, centro: cabOriginal[j], valor: v });
      }
    }
  }
  // Percentuais como fração (0,5) ou como número (50)?
  const fracao = brutos.length > 0 && brutos.every((b) => b.valor <= 1.5);
  const porQuem = new Map<string, LotacaoLida>();
  for (const b of brutos) {
    const chave = normalizar(b.quem);
    const item = porQuem.get(chave) ?? { quem: b.quem, lotacao: [] };
    porQuem.set(chave, item);
    somarLotacao(item.lotacao, b.centro, arred(fracao ? b.valor * 100 : b.valor));
  }
  return [...porQuem.values()];
}

function somarLotacao(lotacao: { centro: string; percentual: number }[], centro: string, percentual: number) {
  const igual = lotacao.find((x) => normalizar(x.centro) === normalizar(centro));
  if (igual) igual.percentual = arred(igual.percentual + percentual);
  else lotacao.push({ centro, percentual });
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

export function paraNumero(v: CelulaImportada): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || v instanceof Date) return null;
  let t = v.replace(/R\$|\s|%/g, '');
  if (/,\d{1,2}$/.test(t) || (t.includes(',') && !t.includes('.'))) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function paraData(v: CelulaImportada): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  const t = String(v ?? '').trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

const fichaDe = (v: CelulaImportada) => {
  const t = typeof v === 'number' ? String(Math.trunc(v)) : textoDe(v);
  return t.replace(/\.0+$/, '') || null;
};
const ehTotal = (t: string) => /^(total|subtotal|soma)\b/.test(normalizar(t));
const arred = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface PostoLido {
  linha: number;
  ficha: string | null;
  colaborador: string | null;
  cargo: string;
  departamento: string | null;
  cargaHoraria: number | null;
  inicio: string | null;
  componentes: Record<ChaveComponente, number>;
  /** Reajuste em % (a planilha guarda 0,05 para 5%). */
  reajuste: number;
  horaAtividade: boolean;
  totalPlanilha: number | null;
  /** Lotação pelo nome usado na planilha (percentual de 0 a 100); null = sem lotação. */
  lotacao: { centro: string; percentual: number }[] | null;
}

export interface LeituraFolha {
  abas: { estudo: string | null; rateio: string | null };
  postos: PostoLido[];
  colunasIgnoradas: { aba: string; colunas: string[] }[];
  colunasCalculadas: string[];
  /** Funcionários da aba de lotação que não aparecem na aba da folha. */
  lotacaoSemFuncionario: string[];
  /** Só lotação: o que a aba traz, para achar entre os funcionários já cadastrados. */
  lotacoesAvulsas: LotacaoLida[];
  avisos: string[];
}

/**
 * Lê a planilha seguindo o DE-PARA. Sem DE-PARA, usa o sugerido.
 * Chame `conferirMapeamento` antes: aqui ele é dado como válido.
 */
export function lerPlanilhaFolha(abas: AbaImportada[], mapeamento?: Mapeamento | null): LeituraFolha {
  const m = mapeamento ?? mapeamentoSugerido(abas);
  const vazio: LeituraFolha = {
    abas: { estudo: null, rateio: null },
    postos: [],
    colunasIgnoradas: [],
    colunasCalculadas: [],
    lotacaoSemFuncionario: [],
    lotacoesAvulsas: [],
    avisos: [],
  };
  if (!m) return { ...vazio, avisos: ['O arquivo não tem abas.'] };
  const erros = conferirMapeamento(abas, m);
  if (erros.length) return { ...vazio, avisos: erros };
  if (m.soLotacao) {
    const l = m.lotacao as LotacaoEmAba;
    return {
      ...vazio,
      abas: { estudo: null, rateio: l.aba },
      lotacoesAvulsas: lerAbaLotacao(abas, l),
    };
  }

  // Folha -------------------------------------------------------------------
  const aba = abas.find((a) => a.nome === m.folha.aba)!;
  const i = m.folha.cabecalho - 1;
  const col = m.folha.colunas;
  const pegar = (linha: CelulaImportada[], campo: CampoFolha) => (col[campo] === undefined ? undefined : linha[col[campo]!]);

  const cab = (aba.linhas[i] ?? []).map(normalizar);
  const usadas = new Set(Object.values(col));
  const ignoradas: string[] = [];
  const colunasCalculadas: string[] = [];
  cab.forEach((c, j) => {
    if (!c || usadas.has(j)) return;
    if (CALCULADAS.includes(c)) colunasCalculadas.push(c);
    else ignoradas.push(textoDe(aba.linhas[i][j]));
  });

  const postos: PostoLido[] = [];
  aba.linhas.slice(i + 1).forEach((linha, k) => {
    const cargo = textoDe(pegar(linha, 'cargo'));
    const colaborador = textoDe(pegar(linha, 'colaborador'));
    if (!cargo || ehTotal(cargo) || ehTotal(colaborador)) return;
    const componentes = Object.fromEntries(COMPONENTES.map((c) => [c.chave, arred(paraNumero(pegar(linha, c.chave)) ?? 0)])) as Record<ChaveComponente, number>;
    const reajusteBruto = paraNumero(pegar(linha, 'reajuste')) ?? 0;
    const lotacao = m.lotacao.modo === 'coluna' ? textoDe(pegar(linha, 'lotacao')) : '';
    postos.push({
      linha: i + k + 2,
      ficha: col.ficha === undefined ? null : fichaDe(pegar(linha, 'ficha')),
      colaborador: colaborador || null,
      cargo,
      departamento: textoDe(pegar(linha, 'departamento')) || null,
      reajuste: arred(reajusteBruto > 0 && reajusteBruto < 1 ? reajusteBruto * 100 : reajusteBruto),
      horaAtividade: (paraNumero(pegar(linha, 'horaAtividade')) ?? 0) > 0 || /^(sim|s|x)$/i.test(textoDe(pegar(linha, 'horaAtividade'))),
      cargaHoraria: paraNumero(pegar(linha, 'carga')),
      inicio: paraData(pegar(linha, 'inicio')),
      componentes,
      totalPlanilha: col.total === undefined ? null : paraNumero(pegar(linha, 'total')),
      lotacao: lotacao ? [{ centro: lotacao, percentual: 100 }] : null,
    });
  });

  // Lotação em outra aba ------------------------------------------------------
  const lotacaoSemFuncionario: string[] = [];
  const l = m.lotacao;
  if (l.modo === 'linhas' || l.modo === 'colunas') {
    // O funcionário é achado pelo código (ficha) ou, se não houver, pelo nome.
    const porFicha = new Map(postos.filter((x) => x.ficha).map((x) => [x.ficha!, x]));
    const porNome = new Map(postos.filter((x) => x.colaborador).map((x) => [normalizar(x.colaborador), x]));
    const lidos = new Set<PostoLido>();
    for (const b of lerAbaLotacao(abas, l)) {
      const posto = porFicha.get(b.quem) ?? porNome.get(normalizar(b.quem));
      if (!posto) {
        lotacaoSemFuncionario.push(b.quem);
        continue;
      }
      if (!lidos.has(posto)) {
        posto.lotacao = [];
        lidos.add(posto);
      }
      for (const x of b.lotacao) somarLotacao(posto.lotacao!, x.centro, x.percentual);
    }
  }

  return {
    abas: {
      estudo: aba.nome,
      rateio: l.modo === 'linhas' || l.modo === 'colunas' ? l.aba : null,
    },
    postos,
    colunasIgnoradas: ignoradas.length ? [{ aba: aba.nome, colunas: ignoradas }] : [],
    colunasCalculadas: [...new Set(colunasCalculadas)],
    lotacaoSemFuncionario,
    lotacoesAvulsas: [],
    avisos: [],
  };
}
