/**
 * Regras puras da reserva de espaço: campos do pedido, cruzamento de horários,
 * indisponibilidade do espaço e fechamento depois do uso. Nada aqui lê planilhas.
 */
import { z } from 'zod';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Perfil do setor que decide as reservas (perfil novo do módulo). */
export const PERFIL_ESPACOS = 'espacos';

export const RESULTADOS_USO = { sem_problema: 'Usado sem problema', com_problema: 'Usado com problema' } as const;
export type ResultadoUso = keyof typeof RESULTADOS_USO;

export const esquemaDetalhesEspaco = z
  .object({
    espacoId: z.string({ message: 'Escolha o espaço.' }).trim().min(1, 'Escolha o espaço.'),
    data: z.string({ message: 'Informe a data.' }).regex(DATA, 'Informe a data.'),
    inicio: z.string({ message: 'Informe a hora de início.' }).regex(HORA, 'Informe a hora de início (ex.: 14:00).'),
    fim: z.string({ message: 'Informe a hora de fim.' }).regex(HORA, 'Informe a hora de fim (ex.: 16:00).'),
    finalidade: z.string({ message: 'Informe a finalidade.' }).trim().min(5, 'Descreva a finalidade ou o evento (mínimo de 5 letras).'),
    pessoas: z.number({ message: 'Informe quantas pessoas são esperadas.' }).int('Pessoas esperadas é um número inteiro.').min(1, 'Informe quantas pessoas são esperadas.'),
    usoExterno: z.boolean().default(false),
    organizacaoExterna: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().nullable().optional()),
    /** Preenchido só ao fechar a reserva (nunca vem da ficha). */
    fechamento: z
      .object({ resultado: z.enum(['sem_problema', 'com_problema']), texto: z.string().nullable(), em: z.string() })
      .nullable()
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (HORA.test(d.inicio) && HORA.test(d.fim) && d.fim <= d.inicio) ctx.addIssue({ code: 'custom', message: 'A hora de fim precisa ser depois da hora de início.' });
    if (d.usoExterno && (d.organizacaoExterna ?? '').length < 3) ctx.addIssue({ code: 'custom', message: 'Informe a organização ou pessoa que vai usar o espaço (mínimo de 3 letras).' });
  });
export type DetalhesEspaco = z.infer<typeof esquemaDetalhesEspaco>;

/** Dia de hoje no horário de Brasília (AAAA-MM-DD). */
export const hojeEmBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Momento (UTC) em que a reserva termina; Brasília é UTC-3. */
export const fimDaReserva = (data: string, fim: string) => new Date(`${data}T${fim}:00-03:00`);

export const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Dois horários se cruzam quando um começa antes de o outro terminar; encostar não cruza. */
export const horariosSeCruzam = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio < b.fim && b.inicio < a.fim;

export interface ReservaParaConflito {
  id: string;
  espacoId: string;
  data: string;
  inicio: string;
  fim: string;
  situacao: string;
}

/** Pedidos "aguardando aprovação" e "aprovada" no mesmo espaço e data que cruzam com o horário. */
export function reservasEmConflito(alvo: ReservaParaConflito, todas: readonly ReservaParaConflito[]): ReservaParaConflito[] {
  return todas.filter(
    (o) =>
      o.id !== alvo.id &&
      o.espacoId === alvo.espacoId &&
      o.data === alvo.data &&
      (o.situacao === 'enviada' || o.situacao === 'aprovada') &&
      horariosSeCruzam(alvo, o),
  );
}

export interface PeriodoIndisponivel {
  espacoId: string;
  inicio: string;
  fim: string;
  motivo: string;
}

/** Período de indisponibilidade que cobre a data (os períodos já vêm só os ativos). */
export const periodoQueCobre = (espacoId: string, data: string, periodos: readonly PeriodoIndisponivel[]) =>
  periodos.find((x) => x.espacoId === espacoId && x.inicio <= data && data <= x.fim) ?? null;

export function conferirFechamento(
  reserva: { data: string; fim: string },
  resultado: string | null | undefined,
  texto: string | null | undefined,
  agora: Date,
): { erro: string } | { resultado: ResultadoUso; texto: string | null } {
  if (agora < fimDaReserva(reserva.data, reserva.fim)) return { erro: `O uso só pode ser registrado depois de ${reserva.fim} de ${dataBR(reserva.data)}.` };
  if (resultado !== 'sem_problema' && resultado !== 'com_problema') return { erro: 'Diga se o espaço foi usado sem ou com problema.' };
  const t = texto?.trim() ?? '';
  if (resultado === 'com_problema' && t.length < 10) return { erro: 'Explique o problema (mínimo de 10 letras).' };
  return { resultado, texto: t || null };
}

export interface DadosEspaco {
  nome: string;
  local?: string | null;
  capacidade: number;
}

export function conferirEspaco(d: DadosEspaco, nomesAtivosDosOutros: readonly string[]): string[] {
  const erros: string[] = [];
  const nome = d.nome.trim();
  if (!nome) erros.push('Informe o nome do espaço.');
  else if (nomesAtivosDosOutros.some((n) => n.trim().toLowerCase() === nome.toLowerCase())) erros.push('Já existe um espaço ativo com este nome.');
  if (!Number.isInteger(d.capacidade) || d.capacidade < 1) erros.push('A capacidade é um número inteiro, de 1 em diante.');
  return erros;
}

export function conferirPeriodo(p: { inicio: string; fim: string; motivo: string }): string[] {
  const erros: string[] = [];
  if (!DATA.test(p.inicio) || !DATA.test(p.fim)) erros.push('Informe as datas de início e de fim.');
  else if (p.fim < p.inicio) erros.push('O fim do período não pode ser antes do início.');
  if (!p.motivo.trim()) erros.push('Informe o motivo (reforma, obra…).');
  return erros;
}
