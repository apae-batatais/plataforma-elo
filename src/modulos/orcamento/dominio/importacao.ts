/**
 * Leitura da planilha da folha (abas "Tabela Salarial", "Estudo" e "Rateio").
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
  ficha: ['ficha', 'n ficha', 'no ficha', 'numero ficha', 'n da ficha', 'nº ficha', 'matricula', 'registro'],
  colaborador: ['nome', 'colaborador', 'funcionario', 'nome do colaborador', 'empregado'],
  cargo: ['cargo', 'funcao', 'cargo funcao'],
  grupo: ['grupo', 'grupo ocupacional'],
  requisitos: ['requisitos', 'requisito', 'escolaridade'],
  classe: ['classe'],
  nivel: ['nivel', 'referencia', 'ref', 'faixa'],
  carga: ['ch', 'c h', 'carga horaria', 'carga', 'horas', 'horas semanais', 'carga horaria semanal', 'jornada'],
  inicio: ['admissao', 'data admissao', 'data de admissao', 'inicio', 'data inicio', 'data de inicio'],
  total: ['total', 'custo total', 'custo mensal', 'total mensal', 'total geral'],
  centro: ['centro de custo', 'centro custo', 'centro', 'cc'],
  percentual: ['percentual', 'rateio', 'perc', 'porcentagem'],
} as const;

const SINONIMOS_COMPONENTES: Record<ChaveComponente, string[]> = {
  salario_base: ['salario base', 'salario', 'sal base', 'salario nominal'],
  adicional: ['adicional', 'adicional tempo de servico', 'ats', 'anuenio', 'quinquenio'],
  hora_atividade: ['hora atividade', 'h atividade', 'horas atividade'],
  insalubridade: ['insalubridade', 'adicional insalubridade'],
  periculosidade: ['periculosidade', 'adicional periculosidade'],
  gratificacao_funcao: ['gratificacao de funcao', 'gratificacao', 'gratif funcao', 'funcao gratificada'],
  ajuda_custo: ['ajuda de custo', 'ajuda custo'],
  bolsa_estagio: ['bolsa estagio', 'estagio', 'bolsa de estagio'],
  plano_saude: ['plano de saude', 'plano saude', 'convenio medico', 'convenio'],
  bolsa_estudo: ['bolsa estudo', 'bolsa de estudo', 'bolsa de estudos'],
  locomocao: ['locomocao', 'vale transporte', 'transporte', 'vt'],
  alimentacao: ['alimentacao', 'vale alimentacao', 'cesta basica', 'va', 'vale refeicao'],
};

/** Colunas que o app calcula sozinho (provisões e encargos) e por isso ignora. */
const CALCULADAS = ['ferias', '1 3', 'terco', '13', 'decimo', 'fgts', 'abono', 'indenizacao', 'indenizacoes', 'provisao', 'provisoes', 'encargos', 'inss', 'pis'];

const NIVEL_LETRA = /^(?:nivel )?([a-k])$/;

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

export interface CargoLido {
  nome: string;
  grupo: string | null;
  requisitos: string | null;
  classe: string | null;
  cargaReferencia: number | null;
  valores: Partial<Record<string, number>>;
}

export interface PostoLido {
  linha: number;
  ficha: string | null;
  colaborador: string | null;
  cargo: string;
  nivel: string | null;
  cargaHoraria: number | null;
  inicio: string | null;
  componentes: Record<ChaveComponente, number>;
  totalPlanilha: number | null;
}

export interface LeituraFolha {
  abas: { tabela: string | null; estudo: string | null; rateio: string | null };
  cargos: CargoLido[];
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

  // Tabela salarial ---------------------------------------------------------
  const abaTabela = acharAba(abas, ['tabela salarial', 'tabela', 'cargos']);
  const cargos: CargoLido[] = [];
  if (abaTabela) {
    const i = acharCabecalho(abaTabela, [[...SINONIMOS.cargo]]);
    if (i < 0) avisos.push(`Aba "${abaTabela.nome}": não encontrei a coluna "Cargo".`);
    else {
      const cab = abaTabela.linhas[i].map(normalizar);
      const col = {
        cargo: coluna(cab, SINONIMOS.cargo),
        grupo: coluna(cab, SINONIMOS.grupo),
        requisitos: coluna(cab, SINONIMOS.requisitos),
        classe: coluna(cab, SINONIMOS.classe),
        carga: coluna(cab, SINONIMOS.carga),
      };
      const niveis = cab.map((c, j) => [c.match(NIVEL_LETRA)?.[1]?.toUpperCase(), j] as const).filter(([n]) => n);
      const usadas = new Set([...Object.values(col), ...niveis.map(([, j]) => j)]);
      const ignoradas = cab.filter((c, j) => c && !usadas.has(j));
      if (ignoradas.length) colunasIgnoradas.push({ aba: abaTabela.nome, colunas: ignoradas });
      if (niveis.length === 0) avisos.push(`Aba "${abaTabela.nome}": não encontrei as colunas dos níveis (A a K).`);
      for (const linha of abaTabela.linhas.slice(i + 1)) {
        const nome = textoDe(linha[col.cargo]);
        if (!nome || ehTotal(nome)) continue;
        const valores: CargoLido['valores'] = {};
        for (const [n, j] of niveis) {
          const v = paraNumero(linha[j]);
          if (v && v > 0) valores[n!] = Math.round(v * 100) / 100;
        }
        const existente = cargos.find((c) => normalizar(c.nome) === normalizar(nome));
        if (existente) continue;
        cargos.push({
          nome,
          grupo: col.grupo >= 0 ? textoDe(linha[col.grupo]) || null : null,
          requisitos: col.requisitos >= 0 ? textoDe(linha[col.requisitos]) || null : null,
          classe: col.classe >= 0 ? textoDe(linha[col.classe]) || null : null,
          cargaReferencia: col.carga >= 0 ? paraNumero(linha[col.carga]) : null,
          valores,
        });
      }
    }
  } else avisos.push('Não encontrei a aba "Tabela Salarial". Os cargos serão criados a partir dos postos, sem valores por nível.');

  // Estudo (postos) ---------------------------------------------------------
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
        nivel: coluna(cab, SINONIMOS.nivel),
        carga: coluna(cab, SINONIMOS.carga),
        inicio: coluna(cab, SINONIMOS.inicio),
        total: coluna(cab, SINONIMOS.total),
      };
      const colComp = Object.fromEntries(COMPONENTES.map((c) => [c.chave, coluna(cab, SINONIMOS_COMPONENTES[c.chave])])) as Record<ChaveComponente, number>;
      if (colComp.salario_base < 0) avisos.push(`Aba "${abaEstudo.nome}": não encontrei a coluna "Salário base".`);
      const usadas = new Set([...Object.values(col), ...Object.values(colComp)]);
      const ignoradas: string[] = [];
      cab.forEach((c, j) => {
        if (!c || usadas.has(j)) return;
        if (CALCULADAS.some((k) => c.split(' ').includes(k) || c.startsWith(k))) colunasCalculadas.push(c);
        else ignoradas.push(c);
      });
      if (ignoradas.length) colunasIgnoradas.push({ aba: abaEstudo.nome, colunas: ignoradas });

      abaEstudo.linhas.slice(i + 1).forEach((linha, k) => {
        const cargo = textoDe(linha[col.cargo]);
        let colaborador = col.colaborador >= 0 ? textoDe(linha[col.colaborador]) : '';
        if (!cargo || ehTotal(cargo) || ehTotal(colaborador)) return;
        if (/^vaga\b/.test(normalizar(colaborador))) colaborador = '';
        const componentes = Object.fromEntries(
          COMPONENTES.map((c) => [c.chave, colComp[c.chave] >= 0 ? Math.round((paraNumero(linha[colComp[c.chave]]) ?? 0) * 100) / 100 : 0]),
        ) as Record<ChaveComponente, number>;
        const nivelTexto = col.nivel >= 0 ? normalizar(linha[col.nivel]) : '';
        postos.push({
          linha: i + k + 2,
          ficha: col.ficha >= 0 ? fichaDe(linha[col.ficha]) : null,
          colaborador: colaborador || null,
          cargo,
          nivel: nivelTexto.match(NIVEL_LETRA)?.[1]?.toUpperCase() ?? null,
          cargaHoraria: col.carga >= 0 ? paraNumero(linha[col.carga]) : null,
          inicio: col.inicio >= 0 ? paraData(linha[col.inicio]) : null,
          componentes,
          totalPlanilha: col.total >= 0 ? paraNumero(linha[col.total]) : null,
        });
      });
    }
  } else avisos.push('Não encontrei a aba "Estudo" com os postos.');

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
        const fora = new Set<number>([colFicha, ...(['colaborador', 'cargo', 'total', 'nivel', 'carga'] as const).map((k) => coluna(cab, SINONIMOS[k]))]);
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
  } else avisos.push('Não encontrei a aba "Rateio". Os postos serão importados sem rateio.');

  return {
    abas: { tabela: abaTabela?.nome ?? null, estudo: abaEstudo?.nome ?? null, rateio: abaRateio?.nome ?? null },
    cargos,
    postos,
    rateios,
    colunasIgnoradas,
    colunasCalculadas: [...new Set(colunasCalculadas)],
    avisos,
  };
}
