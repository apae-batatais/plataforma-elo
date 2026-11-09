import 'server-only';
import {
  garantirPlanilhasDaPasta,
  prepararEstruturaDaInstituicao,
  type LinhaInstituicao,
  type PreparacaoInstituicao,
  type ResultadoDaPasta,
} from '@/nucleo/rede/rede';
import { esquecerSituacaoDaEstruturaDe } from '@/plataforma/estrutura';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import type { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { esquecerAvisosDeEstrutura } from './estrutura-das-instituicoes';
import { planilhasDaInstituicao } from './planilhas-da-instituicao';

type Adm = NonNullable<Awaited<ReturnType<typeof administradorDaRedeLogado>>>;

export interface ResultadoDaPreparacao {
  pasta: ResultadoDaPasta | null;
  estrutura: PreparacaoInstituicao;
}

/**
 * Prepara uma instituição: com pasta, primeiro cria (ou acha) as planilhas e a pasta de
 * anexos e grava os IDs no cadastro; depois cria as abas e a configuração inicial.
 */
export async function prepararInstituicao(adm: Adm, i: LinhaInstituicao): Promise<ResultadoDaPreparacao> {
  try {
    let inst = i;
    let pasta: ResultadoDaPasta | null = null;
    if (i.pasta) {
      pasta = await garantirPlanilhasDaPasta(adm.app.planilhas, adm.autorizador, adm.app.pastas, i, { id: i.id, versao: i.versao }, ESTRUTURA_DOS_MODULOS);
      inst = { ...i, ...pasta.inst, versao: pasta.versao };
    }
    const { armazenamento, inst: resolvida } = await planilhasDaInstituicao(adm, inst);
    const estrutura = await prepararEstruturaDaInstituicao(adm.app.planilhas, adm.autorizador, armazenamento, resolvida, ESTRUTURA_DOS_MODULOS, i.id);
    return { pasta, estrutura };
  } finally {
    esquecerSituacaoDaEstruturaDe(i.codigo);
    esquecerAvisosDeEstrutura(i.codigo);
  }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O resultado em português simples, para a Administração da rede. */
export function resumoDaPreparacao(r: ResultadoDaPreparacao): string {
  const { pasta, estrutura } = r;
  const partes: string[] = [];
  if (pasta) {
    if (pasta.criadas.length) partes.push(`Criadas: ${pasta.criadas.map((x) => x.nome).join(', ')}.`);
    if (pasta.jaExistiam.length) partes.push(`Já existiam: ${pasta.jaExistiam.map((x) => x.nome).join(', ')}.`);
    if (pasta.falhas.length) partes.push(`Não deu certo: ${pasta.falhas.map((x) => `${x.nome} (${x.motivo})`).join('; ')}.`);
  }
  partes.push(
    estrutura.abasCriadas.length === 0 && estrutura.registrosIniciais === 0
      ? 'As abas já estavam em dia.'
      : `${plural(estrutura.abasCriadas.length, 'aba criada', 'abas criadas')} e ${plural(estrutura.registrosIniciais, 'registro inicial', 'registros iniciais')}.`,
  );
  if (estrutura.planilhasPuladas.length) partes.push(`Sem planilha no cadastro, ficaram para depois: ${estrutura.planilhasPuladas.join(', ')}.`);
  return partes.join(' ');
}
