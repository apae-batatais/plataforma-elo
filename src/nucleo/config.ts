/**
 * Configuração da plataforma, lida das variáveis de ambiente da hospedagem.
 *
 * Duas situações:
 * - Demonstração (MODO_DEMONSTRACAO=1, ou faltando as credenciais do Google):
 *   dados fictícios em memória; entrada escolhendo um usuário fictício.
 *   Nesse modo as credenciais do Google são IGNORADAS, para que o login
 *   fictício nunca chegue perto de dados reais.
 * - Produção: planilhas reais pela conta de serviço; login Google institucional.
 */
import { z } from 'zod';

const esquemaProducao = z.object({
  contaServico: z.object({ client_email: z.email(), private_key: z.string().min(20) }),
  planilhas: z.object({ nucleo: z.string().min(10), auditoria: z.string().min(10) }).catchall(z.string().min(10)),
  googleClientId: z.string().min(10),
  segredoSessao: z.string().min(32, 'SESSAO_SEGREDO precisa de pelo menos 32 caracteres'),
  dominio: z.string().min(3),
  administradoresIniciais: z.array(z.email()),
});

export type ConfigProducao = z.infer<typeof esquemaProducao>;

export type Config =
  | { modo: 'demonstracao'; dominio: string; segredoSessao: string }
  | ({ modo: 'producao' } & ConfigProducao);

function json(nome: string, valor: string | undefined): unknown {
  if (!valor) return undefined;
  try {
    return JSON.parse(valor);
  } catch {
    throw new Error(`A variável ${nome} não é um JSON válido.`);
  }
}

export function lerConfig(env: Record<string, string | undefined> = process.env): Config {
  const dominio = env.DOMINIO ?? 'apaebatatais.org.br';
  if (env.MODO_DEMONSTRACAO === '1' || !env.GOOGLE_CONTA_SERVICO) {
    return { modo: 'demonstracao', dominio, segredoSessao: 'demonstracao-somente-dados-ficticios-000' };
  }
  const r = esquemaProducao.safeParse({
    contaServico: json('GOOGLE_CONTA_SERVICO', env.GOOGLE_CONTA_SERVICO),
    planilhas: json('PLANILHAS', env.PLANILHAS),
    googleClientId: env.GOOGLE_CLIENT_ID,
    segredoSessao: env.SESSAO_SEGREDO,
    dominio,
    administradoresIniciais: (env.ADMINISTRADORES_INICIAIS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  });
  if (!r.success) {
    const faltas = r.error.issues.map((i) => i.path.join('.') || i.message).join(', ');
    throw new Error(`Configuração de produção incompleta ou inválida: ${faltas}.`);
  }
  return { modo: 'producao', ...r.data };
}
