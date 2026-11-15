/**
 * Painel de sustentabilidade financeira (#131, S1): regras puras, sem acesso a planilha.
 *
 * Responde quanto o repasse de cada termo cobre do custo do serviço, quanto sai de recurso próprio
 * (aporte) e quanto esse aporte pesa na receita livre da instituição. Valores em reais com duas casas;
 * porcentagem só é arredondada na tela.
 */
import { arred } from './previsao';

export const ORIGENS = ['contratado', 'propria_apoio', 'propria'] as const;
export type Origem = (typeof ORIGENS)[number];
export const NOME_ORIGEM: Record<Origem, string> = {
  contratado: 'Contratado pelo poder público',
  propria_apoio: 'Iniciativa própria com apoio público',
  propria: 'Iniciativa própria',
};

/** Indicadores que já têm limite de alerta nesta entrega. */
export const INDICADORES_COM_LIMITE = ['peso_aporte'] as const;
export const NOME_INDICADOR: Record<string, string> = {
  peso_aporte: 'Peso do aporte na receita livre',
  meses_reserva: 'Meses de reserva',
  concentracao_financiador: 'Concentração por financiador',
  margem_operacional: 'Margem operacional',
};

export class ErroSustentabilidade extends Error {}

export type TipoInstrumento = 'colaboracao' | 'fomento' | 'convenio' | 'acordo_cooperacao' | 'outro';

/** Parcela de um termo (mês AAAA-MM e valor). */
export interface ParcelaTermo {
  mes: string;
  valor: number;
}

/** O que o painel precisa saber de um termo em vigor (vem de Parcerias pela plataforma). */
export interface TermoDoPainel {
  id: string;
  parceiro: string;
  numero: string;
  tipo: TipoInstrumento;
  inicio: string;
  fim: string;
  unidadePessoa: boolean;
  /** Todas as parcelas das fontes e dos aportes ativos. */
  parcelas: ParcelaTermo[];
  servicos: { servico: string; vagasCusteadas: number | null }[];
}

export const rotuloDoTermo = (t: Pick<TermoDoPainel, 'numero' | 'parceiro'>) => `${t.numero} (${t.parceiro})`;

const emCentavos = (v: number) => Math.round(v * 100);
const emReais = (c: number) => c / 100;

/** O termo está em vigor em algum dia do ano. */
export const emVigorNoAno = (t: Pick<TermoDoPainel, 'inicio' | 'fim'>, ano: number) => t.inicio <= `${ano}-12-31` && t.fim >= `${ano}-01-01`;

/** Soma das parcelas que caem no ano. */
export function repasseDoAno(t: Pick<TermoDoPainel, 'parcelas'>, ano: number): number {
  return emReais(t.parcelas.filter((p) => p.mes.startsWith(`${ano}-`)).reduce((s, p) => s + emCentavos(p.valor), 0));
}

/**
 * Origem sugerida pelo termo (regra 2). Colaboração e convênio indicam "contratado"; fomento indica
 * "iniciativa própria com apoio público"; acordo de cooperação, "outro" ou nenhum termo não sugerem nada.
 */
export function sugerirOrigem(termos: readonly Pick<TermoDoPainel, 'tipo' | 'numero' | 'parceiro'>[]): { origem: Origem; termo: string | null } {
  const contratante = termos.find((t) => t.tipo === 'colaboracao' || t.tipo === 'convenio');
  if (contratante) return { origem: 'contratado', termo: rotuloDoTermo(contratante) };
  const fomento = termos.find((t) => t.tipo === 'fomento');
  if (fomento) return { origem: 'propria_apoio', termo: rotuloDoTermo(fomento) };
  return { origem: 'propria', termo: null };
}

export interface OrigemEfetiva {
  origem: Origem;
  /** `definida`: o campo do cadastro; `sugerida`: pelo termo; `sem_termo`: nada informado e nenhum termo indica. */
  fonte: 'definida' | 'sugerida' | 'sem_termo';
  /** Termo que originou a sugestão. */
  termo: string | null;
}

/** Origem efetiva = campo, se preenchido; senão a sugerida (regra 3). A sugestão nunca é gravada sozinha. */
export function origemEfetiva(campo: Origem | null, termos: readonly Pick<TermoDoPainel, 'tipo' | 'numero' | 'parceiro'>[]): OrigemEfetiva {
  if (campo) return { origem: campo, fonte: 'definida', termo: null };
  const s = sugerirOrigem(termos);
  return s.termo ? { origem: s.origem, fonte: 'sugerida', termo: s.termo } : { origem: 'propria', fonte: 'sem_termo', termo: null };
}

export interface RepasseDoServico {
  /** Soma do repasse atribuído ao serviço no ano. */
  valor: number;
  /** Vagas custeadas do serviço, somadas entre os termos (nulo se nenhum termo informa). */
  vagas: number | null;
  /** Termos em vigor que atendem o serviço. */
  termos: TermoDoPainel[];
  avisos: string[];
}

/**
 * Repasse previsto de cada serviço no ano (regra 7): para cada termo em vigor, as parcelas do ano
 * × (vagas custeadas do serviço ÷ soma das vagas custeadas dos serviços do termo). Termo sem vagas
 * custeadas não distribui o repasse e avisa.
 */
export function repassePorServico(termos: readonly TermoDoPainel[], ano: number): Map<string, RepasseDoServico> {
  const m = new Map<string, RepasseDoServico>();
  const linha = (s: string) => {
    let l = m.get(s);
    if (!l) m.set(s, (l = { valor: 0, vagas: null, termos: [], avisos: [] }));
    return l;
  };
  for (const t of termos.filter((x) => emVigorNoAno(x, ano))) {
    const total = repasseDoAno(t, ano);
    const soma = t.servicos.reduce((s, x) => s + (x.vagasCusteadas && x.vagasCusteadas > 0 ? x.vagasCusteadas : 0), 0);
    for (const s of t.servicos) {
      const l = linha(s.servico);
      l.termos.push(t);
      const vagas = s.vagasCusteadas && s.vagasCusteadas > 0 ? s.vagasCusteadas : 0;
      if (vagas > 0) l.vagas = (l.vagas ?? 0) + vagas;
      if (soma > 0) l.valor = arred(l.valor + (total * vagas) / soma);
      else l.avisos.push(`O termo ${rotuloDoTermo(t)} não tem vagas custeadas em Parcerias; sem elas o repasse não é distribuído.`);
    }
  }
  return m;
}

export interface EntradaServico {
  codigo: string;
  nome: string;
  area: string | null;
  campoOrigem: Origem | null;
  custoTotal: number;
  repasse: RepasseDoServico | null;
  /** Atendidos médios do ano (já protegidos pelo mínimo de pessoas); nulo = sem contagem. */
  atendidosMedios: number | null;
}

export interface CoberturaServico {
  codigo: string;
  nome: string;
  area: string | null;
  origem: OrigemEfetiva;
  custoTotal: number;
  repasse: number;
  deficit: number;
  /** Déficit quando positivo, senão zero. */
  aporte: number;
  /** Quanto o repasse passa do custo (nunca compensa o aporte de outro serviço). */
  repasseAcima: number;
  /** Frações de 0 a 1 (ou mais); nulas com custo zero. */
  coberturaTermo: number | null;
  parteProria: number | null;
  vagas: number | null;
  custoPorVagaMes: number | null;
  repassePorVagaMes: number | null;
  custoPorAtendidoMes: number | null;
  repassePorAtendidoMes: number | null;
  termos: string[];
  avisos: string[];
}

/** Cobertura de um serviço (regras 6 a 12). */
export function coberturaDoServico(e: EntradaServico): CoberturaServico {
  const termos = e.repasse?.termos ?? [];
  const repasse = e.repasse?.valor ?? 0;
  const deficit = arred(e.custoTotal - repasse);
  const aporte = deficit > 0 ? deficit : 0;
  const vagas = e.repasse?.vagas ?? null;
  const porMes = (v: number, base: number | null) => (base && base > 0 ? arred(v / 12 / base) : null);
  const avisos = [...(e.repasse?.avisos ?? [])];
  const repasseAcima = deficit < 0 ? arred(-deficit) : 0;
  return {
    codigo: e.codigo,
    nome: e.nome,
    area: e.area,
    origem: origemEfetiva(e.campoOrigem, termos),
    custoTotal: e.custoTotal,
    repasse,
    deficit,
    aporte,
    repasseAcima,
    coberturaTermo: e.custoTotal > 0 ? repasse / e.custoTotal : null,
    parteProria: e.custoTotal > 0 ? aporte / e.custoTotal : null,
    vagas,
    custoPorVagaMes: porMes(e.custoTotal, vagas),
    repassePorVagaMes: porMes(repasse, vagas),
    custoPorAtendidoMes: porMes(e.custoTotal, e.atendidosMedios),
    repassePorAtendidoMes: porMes(repasse, e.atendidosMedios),
    termos: termos.map(rotuloDoTermo),
    avisos,
  };
}

export interface LimiteDefinido {
  indicador: string;
  servico: string | null;
  valor: number;
}

export interface PesoDoAporte {
  /** Soma dos aportes dos serviços de origem efetiva "contratado". */
  aporteContratado: number;
  receitaLivre: number;
  /** Em %, sem arredondar; nulo quando a receita livre é zero. */
  peso: number | null;
  /** Aporte maior que zero sem receita livre para cobri-lo. */
  semReceitaLivre: boolean;
  limite: number | null;
  acimaDoLimite: boolean;
}

/** Peso do aporte na instituição (regra 13): aportes de serviços contratados ÷ receita livre do ano. */
export function pesoDoAporte(servicos: readonly CoberturaServico[], receitaLivre: number, limite: number | null): PesoDoAporte {
  const aporteContratado = arred(servicos.filter((s) => s.origem.origem === 'contratado').reduce((t, s) => t + s.aporte, 0));
  const semReceitaLivre = receitaLivre <= 0 && aporteContratado > 0;
  const peso = receitaLivre > 0 ? (aporteContratado / receitaLivre) * 100 : null;
  return { aporteContratado, receitaLivre, peso, semReceitaLivre, limite, acimaDoLimite: peso !== null && limite !== null && peso > limite };
}

/** Peso do aporte de um serviço sozinho (regra 14), em %, sobre a mesma receita livre. */
export const pesoDoServico = (aporte: number, receitaLivre: number): number | null => (receitaLivre > 0 ? (aporte / receitaLivre) * 100 : null);

/** Limite entre 0 e 100 (aceita decimal). */
export function conferirLimite(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100) throw new ErroSustentabilidade('Informe um limite entre 0 e 100.');
  return Math.round(valor * 100) / 100;
}
