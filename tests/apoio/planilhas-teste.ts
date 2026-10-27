import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';

/** Planilhas em memória com a estrutura do Núcleo (e, opcionalmente, os dados fictícios). */
export async function planilhasDeTeste(opcoes: { comDadosFicticios?: boolean; extras?: string[] } = {}): Promise<Planilhas> {
  const p: Planilhas = {
    armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', ...(opcoes.extras ?? [])]),
    idDe: (c) => c,
  };
  await prepararEstrutura(p);
  if (opcoes.comDadosFicticios) await popularDadosFicticios(p);
  return p;
}
