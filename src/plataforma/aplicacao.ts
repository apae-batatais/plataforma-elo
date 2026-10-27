/**
 * Monta a camada de aplicação: configuração + armazenamento + catálogo de planilhas.
 * Somente servidor.
 */
import 'server-only';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';
import { lerConfig, type Config } from '@/nucleo/config';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

export interface Aplicacao {
  config: Config;
  planilhas: Planilhas;
}

let promessa: Promise<Aplicacao> | undefined;

export function obterAplicacao(): Promise<Aplicacao> {
  promessa ??= montar().catch((erro) => {
    promessa = undefined;
    throw erro;
  });
  return promessa;
}

async function montar(): Promise<Aplicacao> {
  const config = lerConfig();

  if (config.modo === 'demonstracao') {
    const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
    const planilhas: Planilhas = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c };
    await prepararEstrutura(planilhas, ESTRUTURA_DOS_MODULOS);
    await popularDadosFicticios(planilhas);
    await popularDemonstracaoDosModulos(planilhas);
    return { config, planilhas };
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
  const ids = config.planilhas as Record<string, string>;
  return {
    config,
    planilhas: {
      armazenamento,
      idDe: (chave) => {
        const id = ids[chave];
        if (!id) {
          throw new ErroArmazenamento(
            `A planilha "${chave}" não está cadastrada na variável PLANILHAS da Netlify. Crie a planilha em branco na pasta da plataforma no Drive, acrescente "${chave}":"<id da planilha>" em PLANILHAS e publique de novo.`,
          );
        }
        return id;
      },
    },
  };
}
