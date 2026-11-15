/**
 * Profissionais cedidos (C1 da #125): regras puras, sem acesso a dados.
 *
 * Um cedido é uma pessoa que trabalha na instituição mas é paga por quem cede (poder público, empresa com
 * cota de aprendiz ou de PcD, outro). Nada aqui mexe na folha, no caixa nem no passivo.
 */
import { somaRateio, validarRateio, type LinhaRateio } from './folha';

export const TIPOS_CEDENTE = ['poder_publico', 'empresa_aprendiz', 'empresa_pcd', 'outro'] as const;
export type TipoCedente = (typeof TIPOS_CEDENTE)[number];

export const ROTULO_TIPO_CEDENTE: Record<TipoCedente, string> = {
  poder_publico: 'Poder público',
  empresa_aprendiz: 'Empresa com cota de aprendiz',
  empresa_pcd: 'Empresa com cota de PcD',
  outro: 'Outro',
};

export const TIPOS_VALOR = ['informado', 'equivalente'] as const;
export type TipoValor = (typeof TIPOS_VALOR)[number];

export const ROTULO_TIPO_VALOR: Record<TipoValor, string> = {
  informado: 'Informado por quem cede',
  equivalente: 'Custo equivalente (digitado)',
};

export const AVISO_PADRAO_DIAS = 60;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
const primeiroDia = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`;

/** Compara nomes sem diferença de maiúscula, acento ou espaço sobrando. */
export const chaveDeNome = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

/** Dia (AAAA-MM-DD) no fuso de Brasília. */
export const hojeEmBrasilia = (agora: Date = new Date()) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Dias entre duas datas AAAA-MM-DD (negativo se `ate` é antes de `de`). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export interface CessaoBasica {
  inicio: string;
  fim_previsto: string | null;
  encerramento: string | null;
}

/** Quando a cessão termina de fato: o encerramento, senão o fim previsto, senão nunca. */
export const fimDaCessao = (c: CessaoBasica): string | null => c.encerramento ?? c.fim_previsto;

/** Conta no mês se começou até o último dia e não terminou antes do primeiro (mês cheio, sem proporcional). */
export function ativoNoMes(c: CessaoBasica, ano: number, mes: number): boolean {
  const fim = fimDaCessao(c);
  return c.inicio <= ultimoDia(ano, mes) && (!fim || fim >= primeiroDia(ano, mes));
}

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------

export interface DadosCedente {
  nome: string;
  tipo: string;
}

export function validarCedente(d: DadosCedente, outrosNomes: string[]): string[] {
  const erros: string[] = [];
  if (d.nome.trim().length < 2) erros.push('Informe o nome de quem cede.');
  else if (outrosNomes.some((n) => chaveDeNome(n) === chaveDeNome(d.nome))) erros.push('Já existe alguém com este nome em "Quem cede".');
  if (!TIPOS_CEDENTE.includes(d.tipo as TipoCedente)) erros.push('Escolha o tipo de quem cede.');
  return erros;
}

export interface DadosCedido {
  funcao: string;
  cedenteId: string;
  inicio: string;
  fimPrevisto: string | null;
  cargaHoraria: number | null;
}

export function validarCedido(d: DadosCedido): string[] {
  const erros: string[] = [];
  if (d.funcao.trim().length < 2) erros.push('Informe a função.');
  if (!d.cedenteId) erros.push('Escolha quem cede.');
  if (!DATA.test(d.inicio)) erros.push('Informe o início da cessão.');
  if (d.fimPrevisto !== null && (!DATA.test(d.fimPrevisto) || (DATA.test(d.inicio) && d.fimPrevisto < d.inicio))) erros.push('O fim previsto não pode ser antes do início.');
  if (d.cargaHoraria !== null && (!Number.isFinite(d.cargaHoraria) || d.cargaHoraria <= 0 || d.cargaHoraria > 300)) erros.push('Carga horária: use um número de horas por mês maior que zero e até 300.');
  return erros;
}

export function validarValor(valor: number, tipo: string, vigencia: string): string[] {
  const erros: string[] = [];
  if (!Number.isFinite(valor) || valor <= 0) erros.push('O valor mensal deve ser maior que zero.');
  else if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) erros.push('Use no máximo duas casas decimais no valor.');
  if (!TIPOS_VALOR.includes(tipo as TipoValor)) erros.push('Escolha o tipo do valor.');
  if (!DATA.test(vigencia)) erros.push('Informe a partir de quando vale o valor.');
  return erros;
}

/** Lotação do cedido: mesma regra da folha (soma exatamente 100%), com mensagem nas palavras do cedido. */
export function validarLotacao(linhas: LinhaRateio[]): string[] {
  return validarRateio(linhas).map((e) => e.replace('O rateio soma', 'A lotação soma').replace('centro de custo', 'serviço').replace('Informe pelo menos um serviço.', 'Informe pelo menos um serviço.'));
}

export { somaRateio };

// ---------------------------------------------------------------------------
// Situação e aviso de fim
// ---------------------------------------------------------------------------

/** "falta valor" e "falta lotação" deixam a pessoa fora dos totais (nunca soma errado em silêncio). */
export function pendencias(temValor: boolean, lotacao: LinhaRateio[] | undefined): ('valor' | 'lotacao')[] {
  const r: ('valor' | 'lotacao')[] = [];
  if (!temValor) r.push('valor');
  if (!lotacao || lotacao.length === 0 || somaRateio(lotacao) !== 100) r.push('lotacao');
  return r;
}

export type SituacaoCessao = 'ativa' | 'encerrada' | 'futura';

export function situacaoDaCessao(c: CessaoBasica, hoje: string): SituacaoCessao {
  if (c.encerramento && c.encerramento < hoje) return 'encerrada';
  if (!c.encerramento && c.fim_previsto && c.fim_previsto < hoje) return 'ativa'; // vencida e não encerrada: continua ativa até alguém encerrar
  if (c.inicio > hoje) return 'futura';
  return 'ativa';
}

export interface ItemDeAviso {
  fimPrevisto: string;
  /** Dias que faltam; negativo = já venceu e ainda não foi encerrada. */
  dias: number;
  vencida: boolean;
}

/**
 * Aviso de fim de cessão: tem `fim_previsto`, não foi encerrada e faltam `limiteDias` dias ou menos
 * (inclusive vencida). Sai quando a pessoa encerra ou prorroga.
 */
export function avisoDeFim(c: CessaoBasica, hoje: string, limiteDias: number): ItemDeAviso | null {
  if (c.encerramento || !c.fim_previsto) return null;
  const dias = diasEntre(hoje, c.fim_previsto);
  if (dias > limiteDias) return null;
  return { fimPrevisto: c.fim_previsto, dias, vencida: dias < 0 };
}

/** Vencidas primeiro, depois as que acabam antes. */
export const ordenarAvisos = <T extends { dias: number }>(l: T[]): T[] => [...l].sort((a, b) => a.dias - b.dias);

/** Quem recebe o aviso: quem vê todos os serviços com nome (Departamento Pessoal, Financeiro, Diretoria) ou a coordenação, por escopo. */
export function textoDeDias(dias: number): string {
  if (dias < 0) return `venceu há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'termina hoje';
  return `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
