/**
 * Eventos publicados pelo próprio Núcleo (devolvidos pelos casos de uso de `src/nucleo/pessoas/`; ADR-035). Ids são texto e o serviço é o código, como nas planilhas.
 * Eventos de módulos são declarados no manifesto e nos arquivos
 * `eventos.ts` de cada módulo, com o mesmo formato.
 */
import { z } from 'zod';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const PessoaVinculadaAServico = z.object({
  vinculoId: z.string().min(1),
  pessoaId: z.string().min(1),
  servico: z.string().min(1),
  entrada: data,
});

export const PessoaDesligadaDeServico = z.object({
  vinculoId: z.string().min(1),
  pessoaId: z.string().min(1),
  servico: z.string().min(1),
  saida: data,
  motivo: z.string(),
});

export const EVENTOS_DO_NUCLEO = ['PessoaVinculadaAServico', 'PessoaDesligadaDeServico'] as const;

export const payloadsDoNucleo = {
  PessoaVinculadaAServico,
  PessoaDesligadaDeServico,
} satisfies Record<(typeof EVENTOS_DO_NUCLEO)[number], z.ZodType>;
