/**
 * Eventos publicados pelo próprio Núcleo (gerados por gatilhos no banco).
 * Eventos de módulos são declarados no manifesto e nos arquivos
 * `eventos.ts` de cada módulo, com o mesmo formato.
 */
import { z } from 'zod';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const PessoaVinculadaAServico = z.object({
  vinculoId: z.uuid(),
  pessoaId: z.uuid(),
  servicoId: z.uuid(),
  entrada: data,
});

export const PessoaDesligadaDeServico = z.object({
  vinculoId: z.uuid(),
  pessoaId: z.uuid(),
  servicoId: z.uuid(),
  saida: data,
  motivo: z.string(),
});

export const EVENTOS_DO_NUCLEO = ['PessoaVinculadaAServico', 'PessoaDesligadaDeServico'] as const;

export const payloadsDoNucleo = {
  PessoaVinculadaAServico,
  PessoaDesligadaDeServico,
} satisfies Record<(typeof EVENTOS_DO_NUCLEO)[number], z.ZodType>;
