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
