/**
 * A rede de instituições, do lado da plataforma (ADR-012): a planilha da
 * Operadora e a lista de instituições usada para descobrir a instituição pelo
 * endereço. Somente servidor.
 *
 * - Produção com a variável REDE: planilha da rede no Drive da Operadora.
 * - Demonstração: rede fictícia em memória, com as duas instituições fictícias.
 * - A lista fica guardada por 1 minuto; salvar no cadastro limpa o cache.
 * - Enquanto a rede não tem instituições, valem as das variáveis (R1).
 */
import 'server-only';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';
import type { Armazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { INSTITUICOES_DEMONSTRACAO, type ConfigGeral, type Instituicao, type Rede } from '@/nucleo/config';
import { instituicoesCadastradas, prepararRede } from '@/nucleo/rede/rede';
import { Instituicoes } from '@/nucleo/rede/tabelas';

export interface AplicacaoDaRede {
  rede: Rede;
  planilhas: Planilhas;
  /** Acesso às planilhas das instituições (só para a conferência técnica). */
  armazenamentoDasInstituicoes: Armazenamento;
}

let promessa: Promise<AplicacaoDaRede | null> | undefined;

/** A planilha da rede, pronta (abas criadas). null quando a Operadora ainda não configurou a rede. */
export function aplicacaoDaRede(geral: ConfigGeral): Promise<AplicacaoDaRede | null> {
  promessa ??= montarRede(geral).catch((erro) => {
    promessa = undefined;
    throw erro;
  });
  return promessa;
}

async function montarRede(geral: ConfigGeral): Promise<AplicacaoDaRede | null> {
  if (geral.modo === 'demonstracao') {
    const armazenamento = new ArmazenamentoMemoria(['rede']);
    const planilhas: Planilhas = { armazenamento, idDe: () => 'rede' };
    await prepararRede(planilhas);
    const autor = { email: 'demonstracao' };
    for (const i of INSTITUICOES_DEMONSTRACAO) {
      await inserir(
        planilhas,
        Instituicoes,
        {
          codigo: i.codigo,
          nome: i.nome,
          nome_completo: i.nomeCompleto,
          dominio: i.codigo === 'exemplo' ? 'exemplo.local' : 'modelo.local',
          enderecos: null,
          situacao: 'ativa',
          // Na demonstração cada instituição usa planilhas em memória: os IDs são só ilustrativos.
          planilhas: JSON.stringify({ nucleo: `demonstracao-${i.codigo}-nucleo`, auditoria: `demonstracao-${i.codigo}-auditoria` }),
          administradores_iniciais: null,
          unidades: i.unidades.map((u) => `${u.codigo}=${u.nome}`).join('; '),
        },
        autor,
      );
    }
    // Na demonstração, a conferência usa as planilhas em memória de cada instituição (ver a tela da rede).
    return { rede: geral.rede, planilhas, armazenamentoDasInstituicoes: new ArmazenamentoMemoria([]) };
  }
  if (!geral.rede) return null;
  const { JWT } = await import('google-auth-library');
  const cliente = new JWT({ email: geral.contaServico.client_email, key: geral.contaServico.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const armazenamento = new ArmazenamentoGooglePlanilhas(async () => {
    const { token } = await cliente.getAccessToken();
    if (!token) throw new Error('Não foi possível obter acesso às planilhas com a conta de serviço.');
    return token;
  });
  const rede = geral.rede;
  // A auditoria da rede fica na própria planilha da rede.
  const planilhas: Planilhas = { armazenamento, idDe: () => rede.planilha };
  await prepararRede(planilhas);
  return { rede, planilhas, armazenamentoDasInstituicoes: armazenamento };
}

let lista: { em: number; valor: Promise<Instituicao[]> } | undefined;

/** As instituições do Elo: as da rede ou, enquanto ela está vazia, as das variáveis. */
export function instituicoesDoElo(geral: ConfigGeral): Promise<Instituicao[]> {
  if (lista && Date.now() - lista.em < 60_000) return lista.valor;
  const valor = (async () => {
    const r = await aplicacaoDaRede(geral);
    if (!r) return geral.instituicoes;
    const daRede = await instituicoesCadastradas(r.planilhas);
    if (geral.modo === 'demonstracao') {
      // Instituições fictícias cadastradas na demonstração ganham planilhas em memória como as outras.
      return daRede.map((i) => ({ ...i, planilhas: {} }));
    }
    return daRede.length ? daRede : geral.instituicoes;
  })();
  lista = { em: Date.now(), valor };
  valor.catch(() => (lista = undefined));
  return valor;
}

export function esquecerInstituicoes() {
  lista = undefined;
}
