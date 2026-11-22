import { z } from 'zod';

/**
 * Regras puras dos veículos institucionais (proposta #229): conferência do cadastro e
 * disponibilidade por manutenção preventiva. Sem acesso a dados.
 */

export interface DadosVeiculo {
  nome: string;
  placa: string;
  capacidade: number;
}

/** Placa em maiúsculas, sem hífen nem espaço (aceita o modelo antigo e o Mercosul). */
export function normalizarPlaca(placa: string): string {
  return placa.replace(/[\s-]/g, '').toUpperCase();
}

const PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/** Mensagens de erro do cadastro (vazio = ok). */
export function conferirVeiculo(d: DadosVeiculo): string[] {
  const erros: string[] = [];
  if (!d.nome.trim()) erros.push('Informe o nome do veículo.');
  if (!PLACA.test(normalizarPlaca(d.placa))) erros.push('A placa precisa ter 3 letras e 4 caracteres, como ABC-1234 ou ABC1D23.');
  if (!Number.isInteger(d.capacidade) || d.capacidade < 1) erros.push('A capacidade precisa ser um número inteiro de passageiros, de 1 em diante.');
  return erros;
}

export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Confere se é uma data real AAAA-MM-DD. */
export function dataValida(d: string): boolean {
  if (!DATA_ISO.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/**
 * O veículo está em manutenção para um período? A partir do DIA da data prevista (inclusive) e até
 * marcarem como feita, qualquer período que toque esse dia ou os seguintes fica indisponível.
 * `dataPrevista` é a manutenção pendente (null = não há); `ate` é o último dia do período (AAAA-MM-DD).
 */
export function emManutencaoNoPeriodo(dataPrevista: string | null, ate: string): boolean {
  return dataPrevista !== null && ate >= dataPrevista;
}

// ---------------------------------------------------------------------------
// Pedido de veículo (entrega 2)
// ---------------------------------------------------------------------------
/** Perfil do setor que decide os pedidos de veículo. */
export const PERFIL_TRANSPORTE = 'transporte';

const MOMENTO = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const esquemaDetalhesVeiculo = z
  .object({
    veiculoId: z.string({ message: 'Escolha o veículo.' }).trim().min(1, 'Escolha o veículo.'),
    saida: z.string({ message: 'Informe a saída.' }).regex(MOMENTO, 'Informe a data e a hora de saída.'),
    volta: z.string({ message: 'Informe a volta prevista.' }).regex(MOMENTO, 'Informe a data e a hora da volta prevista.'),
    destino: z.string({ message: 'Informe o destino.' }).trim().min(1, 'Informe o destino.'),
    finalidade: z.string({ message: 'Informe a finalidade.' }).trim().min(10, 'Explique para que o veículo será usado (mínimo de 10 letras).'),
    condutor: z.string({ message: 'Informe o condutor.' }).trim().min(1, 'Informe quem vai dirigir (condutor).'),
  })
  .superRefine((d, ctx) => {
    if (MOMENTO.test(d.saida) && MOMENTO.test(d.volta) && d.volta <= d.saida) ctx.addIssue({ code: 'custom', message: 'A volta prevista precisa ser depois da saída.' });
  });
export type DetalhesVeiculo = z.infer<typeof esquemaDetalhesVeiculo>;

/** Instante (UTC) de um horário de Brasília (UTC-3) no formato AAAA-MM-DDTHH:mm. */
export const instante = (momento: string) => new Date(`${momento}:00-03:00`);

export const dataDoMomento = (momento: string) => momento.slice(0, 10);

/** dd/mm/aaaa, hh:mm */
export const momentoBR = (momento: string) => `${dataDoMomento(momento).split('-').reverse().join('/')}, ${momento.slice(11)}`;

/** Dois períodos se cruzam quando um começa antes de o outro acabar; encostar (volta = saída) não cruza. */
export const periodosSeCruzam = (a: { saida: string; volta: string }, b: { saida: string; volta: string }) => a.saida < b.volta && b.saida < a.volta;

export interface PedidoParaConflito {
  id: string;
  veiculoId: string;
  saida: string;
  volta: string;
  situacao: string;
}

/** Outros pedidos "aguardando aprovação" ou "aprovada" do mesmo veículo cujo período cruza com o alvo. */
export function pedidosEmConflito(alvo: PedidoParaConflito, todos: readonly PedidoParaConflito[]): PedidoParaConflito[] {
  return todos.filter((o) => o.id !== alvo.id && o.veiculoId === alvo.veiculoId && (o.situacao === 'enviada' || o.situacao === 'aprovada') && periodosSeCruzam(alvo, o));
}

// ---------------------------------------------------------------------------
// Fechamento do uso (entrega 3)
// ---------------------------------------------------------------------------
export const RESULTADOS_USO_VEICULO = { sem_problema: 'Usado sem problema', com_problema: 'Usado com problema' } as const;
export type ResultadoUsoVeiculo = keyof typeof RESULTADOS_USO_VEICULO;

export interface EntradaFechamentoVeiculo {
  resultado?: string | null;
  problema?: string | null;
  kmSaida?: number | null;
  kmVolta?: number | null;
}

/** Só depois do horário de saída o uso pode ser confirmado (regra 10). */
export const jaPodeConfirmarUso = (saida: string, agora: Date) => agora >= instante(saida);

/** Confere o fechamento: resultado, texto do problema e quilometragem (inteiros ≥ 0, volta ≥ saída). */
export function conferirUsoVeiculo(
  x: { saida: string },
  e: EntradaFechamentoVeiculo,
  agora: Date,
): { erro: string } | { resultado: ResultadoUsoVeiculo; problema: string | null; kmSaida: number; kmVolta: number } {
  if (!jaPodeConfirmarUso(x.saida, agora)) return { erro: `O uso só pode ser confirmado depois da saída (${momentoBR(x.saida)}).` };
  if (e.resultado !== 'sem_problema' && e.resultado !== 'com_problema') return { erro: 'Diga se o veículo foi usado sem ou com problema.' };
  const texto = e.problema?.trim() ?? '';
  if (e.resultado === 'com_problema' && texto.length < 10) return { erro: 'Explique o problema (mínimo de 10 letras).' };
  const inteiro = (n: number | null | undefined) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (!inteiro(e.kmSaida)) return { erro: 'Informe a quilometragem de saída (número inteiro, de 0 em diante).' };
  if (!inteiro(e.kmVolta)) return { erro: 'Informe a quilometragem de volta (número inteiro, de 0 em diante).' };
  if (e.kmVolta! < e.kmSaida!) return { erro: 'A quilometragem de volta não pode ser menor que a de saída.' };
  return { resultado: e.resultado, problema: e.resultado === 'com_problema' ? texto : null, kmSaida: e.kmSaida!, kmVolta: e.kmVolta! };
}
