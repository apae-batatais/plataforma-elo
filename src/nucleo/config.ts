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
  googleClientId: z
    .string()
    .regex(
      /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
      'GOOGLE_CLIENT_ID deve ser o "ID do cliente" OAuth (formato 123…-abc….apps.googleusercontent.com), sem aspas nem espaços',
    ),
  segredoSessao: z.string().min(32, 'SESSAO_SEGREDO precisa de pelo menos 32 caracteres'),
  dominio: z.string().min(3),
  administradoresIniciais: z.array(z.email()),
});

export type ConfigProducao = z.infer<typeof esquemaProducao>;

/** Problema na configuração da hospedagem. A mensagem cita só nomes de variáveis, nunca valores. */
export class ErroConfiguracao extends Error {}

export type Config =
  | { modo: 'demonstracao'; dominio: string; segredoSessao: string }
  | ({ modo: 'producao' } & ConfigProducao);

/** Remove espaços, quebras de linha e aspas que costumam vir junto ao colar valores. */
function limpo(valor: string | undefined): string | undefined {
  const v = valor?.trim().replace(/^["']|["']$/g, '').trim();
  return v ? v : undefined;
}

function json(nome: string, valor: string | undefined): unknown {
  if (!valor) return undefined;
  try {
    return JSON.parse(valor);
  } catch {
    throw new ErroConfiguracao(`A variável ${nome} não é um JSON válido.`);
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
    googleClientId: limpo(env.GOOGLE_CLIENT_ID),
    segredoSessao: limpo(env.SESSAO_SEGREDO),
    dominio,
    administradoresIniciais: (env.ADMINISTRADORES_INICIAIS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  });
  if (!r.success) {
    const faltas = r.error.issues
      .map((i) => (i.code === 'invalid_format' ? i.message : i.path.join('.') || i.message))
      .join('; ');
    throw new ErroConfiguracao(`Configuração de produção incompleta ou inválida: ${faltas}.`);
  }
  return { modo: 'producao', ...r.data };
}
