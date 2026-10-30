/**
 * Monta a camada de aplicação de cada instituição: configuração + armazenamento
 * + catálogo de planilhas. Cada instituição tem o próprio armazenamento: nada é
 * compartilhado entre elas (ADR-012). Somente servidor.
 */
import 'server-only';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';
import { configDaInstituicao, type Config, type ConfigGeral, type Instituicao } from '@/nucleo/config';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { configGeral, instituicaoAtual } from './instituicao';

export interface Aplicacao {
  config: Config;
  instituicao: Instituicao;
  /** O Elo atende uma instituição só (sessões antigas, sem instituição, continuam valendo). */
  unica: boolean;
  planilhas: Planilhas;
}

const porInstituicao = new Map<string, Promise<Aplicacao>>();

/** A aplicação da instituição desta requisição. */
export async function obterAplicacao(): Promise<Aplicacao> {
  const inst = await instituicaoAtual();
  return aplicacaoDa(configGeral(), inst);
}

export function aplicacaoDa(geral: ConfigGeral, inst: Instituicao): Promise<Aplicacao> {
  const chave = `${geral.modo}:${inst.codigo}`;
  let p = porInstituicao.get(chave);
  if (!p) {
    p = montar(geral, inst).catch((erro) => {
      porInstituicao.delete(chave);
      throw erro;
    });
    porInstituicao.set(chave, p);
  }
  return p;
}

async function montar(geral: ConfigGeral, inst: Instituicao): Promise<Aplicacao> {
  const config = configDaInstituicao(geral, inst);
  const base = { config, instituicao: inst, unica: geral.instituicoes.length === 1 };

  if (config.modo === 'demonstracao') {
    const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
    const planilhas: Planilhas = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c };
    await prepararEstrutura(planilhas, ESTRUTURA_DOS_MODULOS, 'sistema', inst.unidades);
    await popularDadosFicticios(planilhas);
    await popularDemonstracaoDosModulos(planilhas);
    return { ...base, planilhas };
  }

  const { JWT } = await import('google-auth-library');
  const cliente = new JWT({
    email: config.contaServico.client_email,
    key: config.contaServico.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const armazenamento = new ArmazenamentoGooglePlanilhas(async () => {
    const { token } = await cliente.getAccessToken();
    if (!token) throw new Error('Não foi possível obter acesso às planilhas com a conta de serviço.');
    return token;
  });
  const ids = config.planilhas;
  return {
    ...base,
    planilhas: {
      armazenamento,
      idDe: (chave) => {
        const id = ids[chave];
        if (!id) {
          throw new ErroArmazenamento(
            `A planilha "${chave}" da ${inst.nome} não está cadastrada na configuração. Crie a planilha em branco no Drive da instituição, compartilhe com a conta de serviço, acrescente "${chave}":"<id da planilha>" nas planilhas da instituição e publique de novo.`,
          );
        }
        return id;
      },
    },
  };
}
