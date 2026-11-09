/**
 * Configuração da plataforma, lida das variáveis de ambiente da hospedagem.
 *
 * Duas situações:
 * - Demonstração (MODO_DEMONSTRACAO=1, ou faltando as credenciais do Google):
 *   dados fictícios em memória; entrada escolhendo um usuário fictício.
 *   Nesse modo as credenciais do Google são IGNORADAS, para que o login
 *   fictício nunca chegue perto de dados reais.
 * - Produção: planilhas reais pela conta de serviço; login Google institucional.
 *
 * Instituições (ADR-012): o Elo atende uma ou várias instituições (Apaes ou
 * entidades). Cada uma tem nome, domínio de e-mail, endereços de acesso e as
 * próprias planilhas. Nada de uma instituição específica fica no código.
 * - Várias: variável INSTITUICOES (lista em JSON).
 * - Uma só (como antes): DOMINIO, PLANILHAS, ADMINISTRADORES_INICIAIS e,
 *   opcionalmente, INSTITUICAO_NOME e INSTITUICAO_RAZAO_SOCIAL.
 */
import { z } from 'zod';
import { UNIDADES_PADRAO } from './estrutura/dados-iniciais';
import { UNIDADES_FICTICIAS } from './estrutura/dados-ficticios';

/** Problema na configuração da hospedagem. A mensagem cita só nomes de variáveis, nunca valores. */
export class ErroConfiguracao extends Error {}

const unidade = z.object({ codigo: z.string().min(1), nome: z.string().min(1) });

const esquemaInstituicao = z.object({
  codigo: z.string().regex(/^[a-z0-9_-]+$/, 'código só com letras minúsculas, números, - e _'),
  nome: z.string().min(2),
  nomeCompleto: z.string().min(2).optional(),
  dominio: z.string().min(3),
  /** Endereços (sem https://) pelos quais a instituição acessa o Elo. */
  enderecos: z.array(z.string().min(3)).default([]),
  situacao: z.enum(['preparacao', 'ativa', 'suspensa']).default('ativa'),
  planilhas: z.object({ nucleo: z.string().min(10), auditoria: z.string().min(10) }).catchall(z.string().min(10)),
  administradoresIniciais: z.array(z.email()).default([]),
  unidades: z.array(unidade).min(1).optional(),
});

export interface Instituicao {
  codigo: string;
  /** Nome curto, como aparece na interface (ex.: "Apae Franca"). */
  nome: string;
  /** Razão social. */
  nomeCompleto: string;
  /** Domínio dos e-mails que podem entrar (ex.: apaefranca.org.br). */
  dominio: string;
  enderecos: string[];
  situacao: 'preparacao' | 'ativa' | 'suspensa';
  /** Planilhas no Drive da instituição (vazio na demonstração). */
  planilhas: Record<string, string>;
  /** Pasta da instituição no Drive compartilhado, onde o Elo cria as planilhas (ADR-018). */
  pasta?: string;
  administradoresIniciais: string[];
  /** Unidades gravadas por "Preparar estrutura" quando a aba está vazia. */
  unidades: readonly { codigo: string; nome: string }[];
}

const esquemaGeral = z.object({
  contaServico: z.object({ client_email: z.email(), private_key: z.string().min(20) }),
  googleClientId: z
    .string()
    .regex(
      /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
      'GOOGLE_CLIENT_ID deve ser o "ID do cliente" OAuth (formato 123…-abc….apps.googleusercontent.com), sem aspas nem espaços',
    ),
  segredoSessao: z.string().min(32, 'SESSAO_SEGREDO precisa de pelo menos 32 caracteres'),
});

/**
 * A Operadora do Elo (ADR-012): planilha da rede (cadastro das instituições),
 * domínio dos e-mails de quem administra a rede, endereços da área da rede e
 * administradores iniciais. Variável REDE (JSON). Sem ela, as instituições vêm
 * das variáveis INSTITUICOES ou DOMINIO/PLANILHAS (entrega R1).
 */
export interface Rede {
  planilha: string;
  dominio: string;
  /** Endereços em que a área da rede pode ser aberta (vazio: qualquer um). */
  enderecos: string[];
  administradores: string[];
  /** Nome da Operadora; só a demonstração usa (cabeçalho da rede). */
  nome?: string;
}

const esquemaRede = z.object({
  planilha: z.string().min(10),
  dominio: z.string().min(3),
  enderecos: z.array(z.string().min(3)).default([]),
  administradores: z.array(z.email()).min(1, 'informe pelo menos um administrador da rede'),
});

/** Configuração de toda a hospedagem: credenciais da Operadora e as instituições. */
export type ConfigGeral =
  | { modo: 'demonstracao'; segredoSessao: string; instituicoes: Instituicao[]; rede: Rede }
  | ({ modo: 'producao'; instituicoes: Instituicao[]; rede: Rede | null } & z.infer<typeof esquemaGeral>);

/** Operadora fictícia da demonstração. */
export const REDE_DEMONSTRACAO: Rede = { planilha: 'rede', dominio: 'exemplo.local', enderecos: [], administradores: ['rede@exemplo.local'], nome: 'Instituição Operadora da Plataforma' };

function lerRede(env: Record<string, string | undefined>): Rede | null {
  const v = json('REDE', env.REDE);
  if (v === undefined) return null;
  const r = esquemaRede.safeParse(v);
  if (!r.success) throw new ErroConfiguracao(`A variável REDE está incompleta ou inválida: ${faltas(r)}.`);
  const limpar = (e: string) => e.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return { planilha: r.data.planilha, dominio: r.data.dominio.toLowerCase(), enderecos: r.data.enderecos.map(limpar), administradores: r.data.administradores.map((e) => e.toLowerCase()) };
}

/** Configuração vista por uma instituição (o formato usado pelas telas). */
export type Config =
  | { modo: 'demonstracao'; dominio: string; segredoSessao: string }
  | {
      modo: 'producao';
      contaServico: { client_email: string; private_key: string };
      googleClientId: string;
      segredoSessao: string;
      dominio: string;
      planilhas: Record<string, string>;
      administradoresIniciais: string[];
    };

/** Instituições fictícias da demonstração: duas, para conferir que uma não vê a outra. */
export const INSTITUICOES_DEMONSTRACAO: Instituicao[] = [
  {
    codigo: 'exemplo',
    nome: 'Instituição Operadora',
    nomeCompleto: 'Instituição Operadora (fictícia)',
    dominio: 'exemplo.local',
    enderecos: [],
    situacao: 'ativa',
    planilhas: {},
    administradoresIniciais: [],
    unidades: UNIDADES_FICTICIAS,
  },
  {
    codigo: 'modelo',
    nome: 'Instituição Modelo',
    nomeCompleto: 'Instituição Modelo (fictícia)',
    dominio: 'exemplo.local',
    enderecos: [],
    situacao: 'ativa',
    planilhas: {},
    administradoresIniciais: [],
    unidades: UNIDADES_FICTICIAS,
  },
];

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

const emails = (texto: string | undefined) =>
  (texto ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

function faltas(r: z.ZodSafeParseError<unknown>, prefixo = '') {
  return r.error.issues.map((i) => (i.code === 'invalid_format' ? i.message : `${prefixo}${i.path.join('.')}` || i.message)).join('; ');
}

function normalizar(i: z.infer<typeof esquemaInstituicao>): Instituicao {
  return {
    codigo: i.codigo,
    nome: i.nome,
    nomeCompleto: i.nomeCompleto ?? i.nome,
    dominio: i.dominio.toLowerCase(),
    enderecos: i.enderecos.map((e) => e.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')),
    situacao: i.situacao,
    planilhas: i.planilhas,
    administradoresIniciais: i.administradoresIniciais.map((e) => e.toLowerCase()),
    unidades: i.unidades ?? UNIDADES_PADRAO,
  };
}

function lerInstituicoes(env: Record<string, string | undefined>): Instituicao[] {
  const lista = json('INSTITUICOES', env.INSTITUICOES);
  if (lista !== undefined) {
    const r = z.array(esquemaInstituicao).min(1).safeParse(lista);
    if (!r.success) throw new ErroConfiguracao(`A variável INSTITUICOES está incompleta ou inválida: ${faltas(r, 'instituição ')}.`);
    const codigos = new Set<string>();
    const enderecos = new Set<string>();
    for (const i of r.data) {
      if (codigos.has(i.codigo)) throw new ErroConfiguracao(`INSTITUICOES: o código "${i.codigo}" aparece mais de uma vez.`);
      codigos.add(i.codigo);
      if (r.data.length > 1 && i.enderecos.length === 0) throw new ErroConfiguracao(`INSTITUICOES: "${i.codigo}" precisa de pelo menos um endereço de acesso.`);
      for (const e of i.enderecos) {
        if (enderecos.has(e)) throw new ErroConfiguracao(`INSTITUICOES: o endereço "${e}" está em mais de uma instituição.`);
        enderecos.add(e);
      }
    }
    return r.data.map(normalizar);
  }
  // Uma instituição só, com as variáveis de antes.
  const dominio = limpo(env.DOMINIO);
  if (!dominio) throw new ErroConfiguracao('Configuração de produção incompleta: falta a variável DOMINIO (o domínio dos e-mails da instituição).');
  const nome = limpo(env.INSTITUICAO_NOME) ?? dominio;
  const r = esquemaInstituicao.safeParse({
    codigo: limpo(env.INSTITUICAO_CODIGO) ?? 'principal',
    nome,
    nomeCompleto: limpo(env.INSTITUICAO_RAZAO_SOCIAL),
    dominio,
    planilhas: json('PLANILHAS', env.PLANILHAS),
    administradoresIniciais: emails(env.ADMINISTRADORES_INICIAIS),
  });
  if (!r.success) throw new ErroConfiguracao(`Configuração de produção incompleta ou inválida: ${faltas(r)}.`);
  return [normalizar(r.data)];
}

export function lerConfigGeral(env: Record<string, string | undefined> = process.env): ConfigGeral {
  if (env.MODO_DEMONSTRACAO === '1' || !env.GOOGLE_CONTA_SERVICO) {
    return { modo: 'demonstracao', segredoSessao: 'demonstracao-somente-dados-ficticios-000', instituicoes: INSTITUICOES_DEMONSTRACAO, rede: REDE_DEMONSTRACAO };
  }
  const r = esquemaGeral.safeParse({
    contaServico: json('GOOGLE_CONTA_SERVICO', env.GOOGLE_CONTA_SERVICO),
    googleClientId: limpo(env.GOOGLE_CLIENT_ID),
    segredoSessao: limpo(env.SESSAO_SEGREDO),
  });
  if (!r.success) throw new ErroConfiguracao(`Configuração de produção incompleta ou inválida: ${faltas(r)}.`);
  const rede = lerRede(env);
  // Com a rede configurada, o cadastro das instituições vem da planilha da rede;
  // as variáveis antigas valem só enquanto a rede ainda não tem instituições.
  const temInstituicoesNasVariaveis = Boolean(env.INSTITUICOES || env.DOMINIO);
  return { modo: 'producao', ...r.data, rede, instituicoes: rede && !temInstituicoesNasVariaveis ? [] : lerInstituicoes(env) };
}

/** A configuração do ponto de vista de uma instituição. */
export function configDaInstituicao(geral: ConfigGeral, inst: Instituicao): Config {
  if (geral.modo === 'demonstracao') return { modo: 'demonstracao', dominio: inst.dominio, segredoSessao: geral.segredoSessao };
  return {
    modo: 'producao',
    contaServico: geral.contaServico,
    googleClientId: geral.googleClientId,
    segredoSessao: geral.segredoSessao,
    dominio: inst.dominio,
    planilhas: inst.planilhas,
    administradoresIniciais: inst.administradoresIniciais,
  };
}

/** Atalho: a configuração da primeira (ou única) instituição. */
export function lerConfig(env: Record<string, string | undefined> = process.env): Config {
  const geral = lerConfigGeral(env);
  if (!geral.instituicoes[0]) throw new ErroConfiguracao('Nenhuma instituição configurada.');
  return configDaInstituicao(geral, geral.instituicoes[0]);
}

/**
 * Qual instituição atende este endereço. Com uma instituição só, ela atende
 * qualquer endereço (como antes). Na demonstração, vale a escolha da pessoa.
 * Endereço desconhecido: null (a tela explica, sem mostrar dados).
 */
export function acharInstituicao(
  geral: { modo: ConfigGeral['modo']; instituicoes: readonly Instituicao[] },
  host: string | null,
  escolhaDemonstracao?: string,
): Instituicao | null {
  if (geral.modo === 'demonstracao') return geral.instituicoes.find((i) => i.codigo === escolhaDemonstracao) ?? geral.instituicoes[0] ?? null;
  if (geral.instituicoes.length === 1) return geral.instituicoes[0];
  const h = (host ?? '').toLowerCase().replace(/:\d+$/, '');
  return geral.instituicoes.find((i) => i.enderecos.includes(h)) ?? null;
}
