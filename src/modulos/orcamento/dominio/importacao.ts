/**
 * Leitura da planilha da folha (abas "Estudo" e "Rateio"). A aba
 * "Tabela Salarial" não é usada: cargo e nível vêm da própria aba Estudo.
 *
 * Regras puras: recebe as abas já convertidas em linhas de células e devolve
 * o que foi entendido e um relatório. As colunas são reconhecidas pelo nome
 * do cabeçalho (sem diferenciar maiúsculas, acentos e pontuação), então a
 * ordem das colunas não importa. Nada aqui grava dados.
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
  const base = normalizar(nome).replace(/[^a-z0-9 ]/g, '').trim().replace(/ /g, '_').slice(0, 40) || 'item';
  let codigo = base;
  for (let i = 2; usados.has(codigo); i++) codigo = `${base}_${i}`;
  usados.add(codigo);
  return codigo;
}

const SINONIMOS = {
  ficha: ['codigo', 'cod', 'ficha', 'n ficha', 'no ficha', 'numero ficha', 'n da ficha', 'matricula', 'registro'],
  colaborador: ['nome', 'colaborador', 'funcionario', 'nome do colaborador', 'empregado'],
  cargo: ['cargo', 'funcao', 'cargo funcao'],
  departamento: ['departamento', 'depto', 'setor'],
  lotacao: ['lotacao'],
  reajuste: ['reajuste', 'reajuste %'],
  horaAtividade: ['hora atividade', 'h atividade', 'horas atividade'],
  carga: ['carga horaria', 'ch', 'c h', 'carga', 'horas', 'carga horaria mensal', 'jornada'],
  inicio: ['admissao', 'data admissao', 'data de admissao', 'inicio', 'data inicio', 'data de inicio'],
  total: ['total', 'custo total', 'custo mensal', 'total mensal'],
  centro: ['centro de custo', 'centro custo', 'centro', 'cc'],
  percentual: ['percentual', 'rateio', 'perc', 'porcentagem'],
} as const;

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

/** Colunas da aba Estudo com fórmula: o app calcula e por isso não importa. */
const CALCULADAS = ['valor hora', 'vhora base', 'salariobase', 'salario base', '1 3 ferias', '13o sal', '13 sal', '13o salario', 'fgts', 'coluna 1'];

function acharAba(abas: AbaImportada[], nomes: string[]): AbaImportada | undefined {
  return abas.find((a) => nomes.includes(normalizar(a.nome))) ?? abas.find((a) => nomes.some((n) => normalizar(a.nome).includes(n)));
}

function acharCabecalho(aba: AbaImportada, obrigatorias: string[][]): number {
  for (let i = 0; i < Math.min(aba.linhas.length, 15); i++) {
    const celulas = aba.linhas[i].map(normalizar);
    if (obrigatorias.every((alternativas) => celulas.some((c) => alternativas.includes(c)))) return i;
  }
  return -1;
}

function coluna(cabecalho: string[], sinonimos: readonly string[]): number {
  return cabecalho.findIndex((c) => sinonimos.includes(c));
}

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

const textoDe = (v: CelulaImportada) => (v instanceof Date ? '' : String(v ?? '').trim());
const fichaDe = (v: CelulaImportada) => {
  const t = typeof v === 'number' ? String(Math.trunc(v)) : textoDe(v);
  return t.replace(/\.0+$/, '') || null;
};
const ehTotal = (t: string) => /^(total|subtotal|soma)\b/.test(normalizar(t));

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
}

export interface LeituraFolha {
  abas: { estudo: string | null; rateio: string | null };
  postos: PostoLido[];
  /** Rateio por nº da ficha (centro pelo nome, percentual de 0 a 100). */
  rateios: Map<string, { centro: string; percentual: number }[]>;
  colunasIgnoradas: { aba: string; colunas: string[] }[];
  colunasCalculadas: string[];
  avisos: string[];
}

export function lerPlanilhaFolha(abas: AbaImportada[]): LeituraFolha {
  const avisos: string[] = [];
  const colunasIgnoradas: LeituraFolha['colunasIgnoradas'] = [];
  const colunasCalculadas: string[] = [];

  // Estudo (funcionários) -----------------------------------------------------
  // A coluna "Lotação" da própria aba vale como lotação de 100%, se não houver aba Rateio.
  const lotacaoDaColuna = new Map<string, { centro: string; percentual: number }[]>();
  const abaEstudo = acharAba(abas, ['estudo', 'postos', 'colaboradores', 'folha']);
  const postos: PostoLido[] = [];
  if (abaEstudo) {
    const i = acharCabecalho(abaEstudo, [[...SINONIMOS.cargo], [...SINONIMOS.colaborador, ...SINONIMOS.ficha]]);
    if (i < 0) avisos.push(`Aba "${abaEstudo.nome}": não encontrei as colunas "Cargo" e "Nome" (ou "Ficha").`);
    else {
      const cab = abaEstudo.linhas[i].map(normalizar);
      const col = {
        ficha: coluna(cab, SINONIMOS.ficha),
        colaborador: coluna(cab, SINONIMOS.colaborador),
        cargo: coluna(cab, SINONIMOS.cargo),
        departamento: coluna(cab, SINONIMOS.departamento),
        lotacao: coluna(cab, SINONIMOS.lotacao),
        reajuste: coluna(cab, SINONIMOS.reajuste),
        horaAtividade: coluna(cab, SINONIMOS.horaAtividade),
        carga: coluna(cab, SINONIMOS.carga),
        inicio: coluna(cab, SINONIMOS.inicio),
        total: coluna(cab, SINONIMOS.total),
      };
      const colComp = Object.fromEntries(COMPONENTES.map((c) => [c.chave, coluna(cab, SINONIMOS_COMPONENTES[c.chave])])) as Record<ChaveComponente, number>;
      if (colComp.salario_atual < 0) avisos.push(`Aba "${abaEstudo.nome}": não encontrei a coluna "Salario Atual".`);
      const usadas = new Set([...Object.values(col), ...Object.values(colComp)]);
      const ignoradas: string[] = [];
      cab.forEach((c, j) => {
        if (!c || usadas.has(j)) return;
        if (CALCULADAS.includes(c)) colunasCalculadas.push(c);
        else ignoradas.push(c);
      });
      if (ignoradas.length) colunasIgnoradas.push({ aba: abaEstudo.nome, colunas: ignoradas });

      abaEstudo.linhas.slice(i + 1).forEach((linha, k) => {
        const cargo = textoDe(linha[col.cargo]);
        const colaborador = col.colaborador >= 0 ? textoDe(linha[col.colaborador]) : '';
        if (!cargo || ehTotal(cargo) || ehTotal(colaborador)) return;
        const componentes = Object.fromEntries(
          COMPONENTES.map((c) => [c.chave, colComp[c.chave] >= 0 ? Math.round((paraNumero(linha[colComp[c.chave]]) ?? 0) * 100) / 100 : 0]),
        ) as Record<ChaveComponente, number>;
        const reajusteBruto = col.reajuste >= 0 ? (paraNumero(linha[col.reajuste]) ?? 0) : 0;
        const ficha = col.ficha >= 0 ? fichaDe(linha[col.ficha]) : null;
        const lotacao = col.lotacao >= 0 ? textoDe(linha[col.lotacao]) : '';
        if (ficha && lotacao && !lotacaoDaColuna.has(ficha)) lotacaoDaColuna.set(ficha, [{ centro: lotacao, percentual: 100 }]);
        postos.push({
          linha: i + k + 2,
          ficha,
          colaborador: colaborador || null,
          cargo,
          departamento: col.departamento >= 0 ? textoDe(linha[col.departamento]) || null : null,
          reajuste: Math.round((reajusteBruto > 0 && reajusteBruto < 1 ? reajusteBruto * 100 : reajusteBruto) * 100) / 100,
          horaAtividade: col.horaAtividade >= 0 && (paraNumero(linha[col.horaAtividade]) ?? 0) > 0,
          cargaHoraria: col.carga >= 0 ? paraNumero(linha[col.carga]) : null,
          inicio: col.inicio >= 0 ? paraData(linha[col.inicio]) : null,
          componentes,
          totalPlanilha: col.total >= 0 ? paraNumero(linha[col.total]) : null,
        });
      });
    }
  } else avisos.push('Não encontrei a aba "Estudo" com os funcionários.');

  // Rateio ------------------------------------------------------------------
  const abaRateio = acharAba(abas, ['rateio']);
  const rateios = new Map<string, { centro: string; percentual: number }[]>();
  if (abaRateio) {
    const i = acharCabecalho(abaRateio, [[...SINONIMOS.ficha]]);
    if (i < 0) avisos.push(`Aba "${abaRateio.nome}": não encontrei a coluna "Ficha".`);
    else {
      const cabOriginal = abaRateio.linhas[i].map(textoDe);
      const cab = cabOriginal.map(normalizar);
      const colFicha = coluna(cab, SINONIMOS.ficha);
      const colCentro = coluna(cab, SINONIMOS.centro);
      const colPerc = coluna(cab, SINONIMOS.percentual);
      const brutos: { ficha: string; centro: string; valor: number }[] = [];
      const linhas = abaRateio.linhas.slice(i + 1);
      if (colCentro >= 0 && colPerc >= 0) {
        for (const l of linhas) {
          const ficha = fichaDe(l[colFicha]);
          const centro = textoDe(l[colCentro]);
          const v = paraNumero(l[colPerc]);
          if (ficha && centro && v) brutos.push({ ficha, centro, valor: v });
        }
      } else {
        const fora = new Set<number>([colFicha, ...(['colaborador', 'cargo', 'total', 'departamento', 'carga'] as const).map((k) => coluna(cab, SINONIMOS[k]))]);
        cab.forEach((c, j) => {
          if (['soma', 'total %', 'soma rateio', 'conferencia'].includes(c)) fora.add(j);
        });
        const centros = cabOriginal.map((nome, j) => ({ nome, j })).filter(({ nome, j }) => nome && !fora.has(j));
        for (const l of linhas) {
          const ficha = fichaDe(l[colFicha]);
          if (!ficha) continue;
          for (const { nome, j } of centros) {
            const v = paraNumero(l[j]);
            if (v) brutos.push({ ficha, centro: nome, valor: v });
          }
        }
      }
      // Percentuais como fração (0,5) ou como número (50)?
      const fracao = brutos.length > 0 && brutos.every((b) => b.valor <= 1.5);
      for (const b of brutos) {
        const lista = rateios.get(b.ficha) ?? [];
        const percentual = Math.round((fracao ? b.valor * 100 : b.valor) * 100) / 100;
        const igual = lista.find((x) => normalizar(x.centro) === normalizar(b.centro));
        if (igual) igual.percentual = Math.round((igual.percentual + percentual) * 100) / 100;
        else lista.push({ centro: b.centro, percentual });
        rateios.set(b.ficha, lista);
      }
    }
  } else {
    for (const [ficha, linhas] of lotacaoDaColuna) rateios.set(ficha, linhas);
  }

  return {
    abas: { estudo: abaEstudo?.nome ?? null, rateio: abaRateio?.nome ?? null },
    postos,
    rateios,
    colunasIgnoradas,
    colunasCalculadas: [...new Set(colunasCalculadas)],
    avisos,
  };
}
