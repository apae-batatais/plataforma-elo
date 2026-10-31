import 'server-only';
import type { Armazenamento } from '@/nucleo/armazenamento/armazenamento';
import type { Instituicao } from '@/nucleo/config';
import { aplicacaoDa } from '@/plataforma/aplicacao';
import { configGeral } from '@/plataforma/instituicao';
import type { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { PLANILHAS_DA_INSTITUICAO } from './planilhas';

type Adm = NonNullable<Awaited<ReturnType<typeof administradorDaRedeLogado>>>;

/**
 * Onde ficam as planilhas de uma instituição, para conferir e preparar.
 * Na demonstração, cada instituição fictícia tem as planilhas em memória,
 * com os nomes das chaves no lugar dos IDs.
 */
export async function planilhasDaInstituicao(adm: Adm, inst: Instituicao): Promise<{ armazenamento: Armazenamento; inst: Instituicao }> {
  if (!adm.demonstracao) return { armazenamento: adm.app.armazenamentoDasInstituicoes, inst };
  const app = await aplicacaoDa(configGeral(), { ...inst, planilhas: {} });
  const chaves = Object.fromEntries(PLANILHAS_DA_INSTITUICAO.map((p) => [p.chave, p.chave]));
  return {
    armazenamento: app.planilhas.armazenamento,
    inst: { ...inst, planilhas: chaves },
  };
}
