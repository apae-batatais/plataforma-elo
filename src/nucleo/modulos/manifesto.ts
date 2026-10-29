/**
 * Contrato de módulo.
 *
 * Todo app da plataforma declara um manifesto. O portal lê os manifestos
 * para montar menu, permissões e painéis, sem que o Núcleo precise mudar.
 */
import { z } from 'zod';

const ID = /^[a-z][a-z0-9-]*$/;
const SCHEMA = /^[a-z][a-z0-9_]*$/;
const EVENTO = /^[A-Z][A-Za-z]+$/;
const INDICADOR = /^[a-z][a-z0-9_]*$/;

export const esquemaManifesto = z
  .object({
    id: z.string().regex(ID, 'id em minúsculas, com hífens'),
    nome: z.string().min(2),
    descricao: z.string().min(5),
    icone: z.string().min(2),
    /** Schema próprio do módulo no banco. */
    schema: z.string().regex(SCHEMA),
    /** Rota base, ex.: "/orcamento". */
    rota: z.string().regex(/^\/[a-z0-9-]+$/),
    /** Permissão mínima para o app aparecer no portal. */
    permissaoAcesso: z.string(),
    menu: z
      .array(
        z.object({
          rotulo: z.string().min(2),
          /** Caminho relativo à rota base; "/" é a página inicial do app. */
          caminho: z.string().regex(/^\/[a-z0-9-/]*$/),
          permissao: z.string(),
          /** Seção do menu (ex.: "Cadastros"); itens seguidos da mesma seção ficam juntos. */
          secao: z.string().optional(),
        }),
      )
      .min(1),
    /** Permissões do módulo: chave "<schema>.<recurso>.<acao>" → descrição. */
    permissoes: z.record(z.string(), z.string().min(3)),
    eventos: z.object({
      publica: z.array(z.string().regex(EVENTO)),
      consome: z.array(z.string().regex(EVENTO)),
    }),
    indicadores: z.array(z.string().regex(INDICADOR)),
    /** Perfis novos que o módulo traz (criados por "Preparar estrutura"). */
    perfis: z
      .array(z.object({ codigo: z.string().regex(SCHEMA), nome: z.string().min(2), descricao: z.string().min(5) }))
      .default([]),
    /** Permissões do módulo ligadas a cada perfil, criadas por "Preparar estrutura" se ainda não existirem. */
    permissoesPorPerfil: z.record(z.string(), z.array(z.string())).default({}),
  })
  .superRefine((m, ctx) => {
    for (const permissao of Object.keys(m.permissoes)) {
      if (!permissao.startsWith(`${m.schema}.`)) {
        ctx.addIssue({
          code: 'custom',
          message: `A permissão "${permissao}" deve começar com "${m.schema}."`,
          path: ['permissoes', permissao],
        });
      }
    }
    const declaradas = new Set(Object.keys(m.permissoes));
    for (const [perfil, lista] of Object.entries(m.permissoesPorPerfil)) {
      for (const p of lista) {
        if (!declaradas.has(p)) {
          ctx.addIssue({ code: 'custom', message: `Permissão "${p}" ligada ao perfil "${perfil}" mas não declarada`, path: ['permissoesPorPerfil'] });
        }
      }
    }
    const usadas = [m.permissaoAcesso, ...m.menu.map((i) => i.permissao)];
    for (const p of usadas) {
      if (!declaradas.has(p)) {
        ctx.addIssue({ code: 'custom', message: `Permissão "${p}" usada mas não declarada`, path: ['permissoes'] });
      }
    }
  });

export type Manifesto = z.infer<typeof esquemaManifesto>;

/** Declara e valida o manifesto de um módulo. Lança erro se estiver inválido. */
export function defineModulo(manifesto: z.input<typeof esquemaManifesto>): Manifesto {
  const resultado = esquemaManifesto.safeParse(manifesto);
  if (!resultado.success) {
    const detalhes = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Manifesto do módulo "${manifesto.id}" inválido: ${detalhes}`);
  }
  return resultado.data;
}
