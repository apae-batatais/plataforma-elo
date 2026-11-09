import 'server-only';
import { conferirInstituicao, type LinhaInstituicao } from '@/nucleo/rede/rede';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import type { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { planilhasDaInstituicao } from './planilhas-da-instituicao';

type Adm = NonNullable<Awaited<ReturnType<typeof administradorDaRedeLogado>>>;

/** O que falta em uma instituição, para o aviso "Estrutura desatualizada" na lista da rede. */
export interface AvisoDeEstrutura {
  desatualizada: boolean;
  faltas: string[];
}

const guardados = new Map<string, { em: number; valor: Promise<AvisoDeEstrutura> }>();

/** Guarda por 2 minutos, para não gastar leituras do Google a cada página; preparar limpa. */
export function avisoDeEstrutura(adm: Adm, i: LinhaInstituicao): Promise<AvisoDeEstrutura> {
  const atual = guardados.get(i.codigo);
  if (atual && Date.now() - atual.em <= 120_000) return atual.valor;
  const valor = calcular(adm, i);
  guardados.set(i.codigo, { em: Date.now(), valor });
  return valor;
}

export function esquecerAvisosDeEstrutura(codigo: string) {
  guardados.delete(codigo);
}

async function calcular(adm: Adm, i: LinhaInstituicao): Promise<AvisoDeEstrutura> {
  try {
    const { armazenamento, inst } = await planilhasDaInstituicao(adm, i);
    const c = await conferirInstituicao(adm.autorizador, armazenamento, inst, ESTRUTURA_DOS_MODULOS, adm.app.pastas);
    const faltas: string[] = [];
    const porCriar = c.planilhas.filter((x) => x.situacao === 'sera_criada').map((x) => x.mensagem.split(':')[0]);
    if (porCriar.length) faltas.push(`falta criar: ${porCriar.join(', ')}`);
    if (c.estrutura === 'desatualizada' || c.estrutura === 'nao_preparada') faltas.push('faltam abas, perfis ou permissões');
    if (c.estrutura === 'sem_acesso') faltas.push('sem acesso às planilhas');
    return { desatualizada: faltas.length > 0, faltas };
  } catch (erro) {
    if (!(erro instanceof ErroArmazenamento)) throw erro;
    return { desatualizada: true, faltas: [erro.message] };
  }
}
