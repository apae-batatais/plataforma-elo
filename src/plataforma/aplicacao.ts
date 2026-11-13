/**
 * Monta a camada de aplicação de cada instituição: configuração + armazenamento
 * + catálogo de planilhas. Cada instituição tem o próprio armazenamento: nada é
 * compartilhado entre elas (ADR-012). Somente servidor.
 */
import 'server-only';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ArquivosGoogleDrive, ArquivosMemoria, type ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';
import { configDaInstituicao, type Config, type ConfigGeral, type Instituicao } from '@/nucleo/config';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { configGeral, instituicaoAtual } from './instituicao';
import { instituicoesDoElo } from './rede';

export interface Aplicacao {
  config: Config;
  instituicao: Instituicao;
  /** O Elo atende uma instituição só (sessões antigas, sem instituição, continuam valendo). */
  unica: boolean;
  planilhas: Planilhas;
  /** Fotos e vídeos (ADR-014). Nulo enquanto a instituição não informar a pasta de anexos. */
  arquivos: ArmazenamentoArquivos | null;
}

const porInstituicao = new Map<string, Promise<Aplicacao>>();

/** A aplicação da instituição desta requisição. */
export async function obterAplicacao(): Promise<Aplicacao> {
  const inst = await instituicaoAtual();
  const geral = configGeral();
  return aplicacaoDa(geral, inst, (await instituicoesDoElo(geral)).length === 1);
}

export function aplicacaoDa(geral: ConfigGeral, inst: Instituicao, unica = geral.instituicoes.length === 1): Promise<Aplicacao> {
  // Mudou a configuração da instituição (ex.: planilhas no cadastro da rede)? Monta de novo.
  const chave = `${geral.modo}:${inst.codigo}:${JSON.stringify(inst.planilhas)}:${unica}`;
  let p = porInstituicao.get(chave);
  if (!p) {
    p = montar(geral, inst, unica).catch((erro) => {
      porInstituicao.delete(chave);
      throw erro;
    });
    porInstituicao.set(chave, p);
  }
  return p;
}

async function montar(geral: ConfigGeral, inst: Instituicao, unica: boolean): Promise<Aplicacao> {
  const config = configDaInstituicao(geral, inst);
  const base = { config, instituicao: inst, unica };

  if (config.modo === 'demonstracao') {
    const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
    // ids previsíveis: todas as cópias do servidor montam a demonstração com os mesmos ids.
    const planilhas: Planilhas = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis(inst.codigo) };
    await prepararEstrutura(planilhas, ESTRUTURA_DOS_MODULOS, 'sistema', inst.unidades);
    await popularDadosFicticios(planilhas);
    await popularDemonstracaoDosModulos(planilhas);
    return { ...base, planilhas, arquivos: new ArquivosMemoria((codigo) => `/arquivos/envio/${codigo}`) };
  }

  const { JWT } = await import('google-auth-library');
  const cliente = new JWT({
    email: config.contaServico.client_email,
    key: config.contaServico.private_key,
    // Drive: só para a pasta de anexos (unidade compartilhada) que a instituição compartilhou com a conta de serviço.
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
  const token = async () => {
    const { token } = await cliente.getAccessToken();
    if (!token) throw new Error('Não foi possível obter acesso às planilhas com a conta de serviço.');
    return token;
  };
  const armazenamento = new ArmazenamentoGooglePlanilhas(token);
  const ids = config.planilhas;
  return {
    ...base,
    // A pasta de anexos fica no mesmo cadastro das planilhas, com a chave "anexos".
    arquivos: ids.anexos ? new ArquivosGoogleDrive(token, ids.anexos) : null,
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
