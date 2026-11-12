/**
 * Rede de instituições do Elo (ADR-012, entrega R2): cadastro, situação e
 * conferência técnica das instituições, feitos pela Administração da rede.
 *
 * Regras:
 * - Só quem administra a rede altera o cadastro (permissão "rede.instituicoes.gerenciar").
 * - Código, endereços de acesso e domínio de cada instituição são únicos na rede.
 * - Nada é apagado: instituição que sai fica "suspensa"; administrador que sai fica inativo.
 * - Toda alteração registra auditoria (colunas, nunca valores).
 * - A conferência só lê nomes de abas e a configuração de perfis; nunca pessoas,
 *   folha ou orçamento de uma instituição.
 */
import { z } from 'zod';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroArmazenamento, ErroEstruturaAusente, type Armazenamento } from '@/nucleo/armazenamento/armazenamento';
import { atualizar, cabecalhoDe, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { idDaPasta, type ArmazenamentoPastas } from '@/nucleo/armazenamento/pastas';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import type { Instituicao } from '@/nucleo/config';
import { UNIDADES_PADRAO } from '@/nucleo/estrutura/dados-iniciais';
import { conferirEstrutura, prepararEstrutura, type EstruturaDosModulos, type ResultadoPreparacao } from '@/nucleo/estrutura/preparar';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { AdministradoresRede, Instituicoes, SITUACOES_INSTITUICAO, type RegInstituicao } from './tabelas';

export class ErroRede extends Error {}

export const PERMISSAO_REDE = 'rede.instituicoes.gerenciar';
const PERFIL_REDE = 'administrador_rede';

/** Abas da planilha da rede (a auditoria da rede fica na mesma planilha). */
export const TABELAS_DA_REDE = [Instituicoes, AdministradoresRede, RegistrosAuditoria] as const;

/** Cria as abas que faltam na planilha da rede (nunca altera o que existe). */
export async function prepararRede(p: Planilhas): Promise<void> {
  const porPlanilha = new Map<string, { aba: string; cabecalho: string[] }[]>();
  for (const def of TABELAS_DA_REDE)
    porPlanilha.set(def.planilha, [...(porPlanilha.get(def.planilha) ?? []), { aba: def.aba, cabecalho: cabecalhoDe(def as never) }]);
  for (const [chave, abas] of porPlanilha) await p.armazenamento.garantirAbas(p.idDe(chave), abas);
}

/**
 * Quem administra a rede: os administradores ativos da planilha e os iniciais
 * da configuração da Operadora. Usa o mesmo Autorizador das instituições.
 */
export async function autorizadorDaRede(p: Planilhas, email: string, iniciais: readonly string[]): Promise<Autorizador> {
  const admins = (await lerTabela(p, AdministradoresRede)).ativos().map((a) => a.email.toLowerCase());
  const e = email.toLowerCase();
  const eh = admins.includes(e) || iniciais.map((x) => x.toLowerCase()).includes(e);
  const hoje = '2000-01-01';
  const controle = {
    id: 'rede',
    versao: 1,
    ativo: true,
    criado_em: hoje,
    criado_por: 'rede',
    atualizado_em: hoje,
    atualizado_por: 'rede',
  };
  return new Autorizador(e, {
    usuarios: eh ? [{ ...controle, email: e, nome: e, pessoa_id: null } as never] : [],
    atribuicoes: eh
      ? [
          {
            ...controle,
            usuario_email: e,
            perfil: PERFIL_REDE,
            escopo_tipo: 'global',
            escopo: null,
            inicio: null,
            fim: null,
          } as never,
        ]
      : [],
    perfilPermissoes: [{ ...controle, perfil: PERFIL_REDE, permissao: PERMISSAO_REDE } as never],
    servicos: [],
  });
}

const exigir = (quem: Autorizador) => {
  if (!quem.temPermissao(PERMISSAO_REDE)) throw new ErroPermissao('Só a Administração da rede pode fazer isso.');
};

// ---------------------------------------------------------------------------
// Conversão entre o registro da planilha e a instituição usada pelo Elo
// ---------------------------------------------------------------------------

const lista = (t: string | null) =>
  (t ?? '')
    .split(/[,\n;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

function lerUnidades(t: string | null): { codigo: string; nome: string }[] {
  return (t ?? '')
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [codigo, ...resto] = x.split('=');
      return {
        codigo: codigo.trim().toLowerCase(),
        nome: resto.join('=').trim(),
      };
    })
    .filter((u) => u.codigo && u.nome);
}

export function instituicaoDoRegistro(r: RegInstituicao): Instituicao {
  let planilhas: Record<string, string> = {};
  try {
    const v = JSON.parse(r.planilhas) as unknown;
    if (v && typeof v === 'object') planilhas = Object.fromEntries(Object.entries(v).filter(([, id]) => typeof id === 'string')) as Record<string, string>;
  } catch {
    // Planilhas ilegíveis: a conferência aponta o problema.
  }
  const unidades = lerUnidades(r.unidades);
  return {
    codigo: r.codigo,
    nome: r.nome,
    nomeCompleto: r.nome_completo ?? r.nome,
    dominio: r.dominio.toLowerCase(),
    enderecos: lista(r.enderecos),
    situacao: r.situacao,
    planilhas,
    pasta: r.pasta ?? undefined,
    administradoresIniciais: lista(r.administradores_iniciais),
    unidades: unidades.length ? unidades : UNIDADES_PADRAO,
  };
}

/** Instituições cadastradas na rede (para descobrir a instituição pelo endereço; sem pessoas). */
export async function instituicoesCadastradas(p: Planilhas): Promise<Instituicao[]> {
  return (await lerTabela(p, Instituicoes)).ativos().map((r) => instituicaoDoRegistro(r as RegInstituicao));
}

/**
 * Quais instituições o Elo atende: as da rede, a partir da primeira ativa.
 * Até lá, as das variáveis da hospedagem (R1), para que cadastrar a primeira
 * instituição (em preparação) não tire ninguém do ar antes de ativar.
 */
export function instituicoesEmVigor(daRede: Instituicao[], dasVariaveis: Instituicao[]): Instituicao[] {
  return daRede.some((i) => i.situacao === 'ativa') || dasVariaveis.length === 0 ? daRede : dasVariaveis;
}

// ---------------------------------------------------------------------------
// Painel e cadastro
// ---------------------------------------------------------------------------

export interface LinhaInstituicao extends Instituicao {
  id: string;
  versao: number;
}

export async function painelDaRede(p: Planilhas, quem: Autorizador) {
  exigir(quem);
  const [inst, admins] = await lerTabelas(p, [Instituicoes, AdministradoresRede] as const);
  return {
    instituicoes: inst
      .ativos()
      .map((r) => ({
        ...instituicaoDoRegistro(r as RegInstituicao),
        id: r.id,
        versao: r.versao,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) as LinhaInstituicao[],
    administradores: admins.ativos().map((a) => ({
      id: a.id,
      versao: a.versao,
      email: a.email,
      nome: a.nome,
    })),
  };
}

const ID_PLANILHA = /^[A-Za-z0-9_-]{20,}$/;
const DOMINIO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const esquemaCadastro = z.object({
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/, 'O código usa só letras minúsculas, números, - e _ (ex.: instituicao-exemplo).'),
  nome: z.string().trim().min(3, 'Informe o nome curto (ex.: Instituição Exemplo).'),
  nomeCompleto: z.string().trim().optional(),
  dominio: z.string().trim().toLowerCase().regex(DOMINIO, 'Informe o domínio dos e-mails, sem @ (ex.: instituicao.org.br).'),
  enderecos: z.array(z.string().trim().toLowerCase().regex(DOMINIO, 'Endereço inválido: use só o endereço, sem https:// (ex.: elo.instituicao.org.br).')),
  /** IDs das planilhas atuais (instituições antigas). Sem a pasta, Núcleo e Auditoria são obrigatórias. */
  planilhas: z.record(z.string(), z.string().trim()).optional(),
  /** Link da pasta no Drive compartilhado (ou o ID): o Elo cria as planilhas dentro dela (ADR-018). */
  pasta: z.string().trim().optional(),
  administradoresIniciais: z.array(z.email('E-mail de administrador inválido.')),
  unidades: z.array(z.object({ codigo: z.string(), nome: z.string() })),
});
export type DadosInstituicao = z.input<typeof esquemaCadastro>;

export async function salvarInstituicao(p: Planilhas, quem: Autorizador, dados: DadosInstituicao, existente?: { id: string; versao: number }): Promise<string> {
  exigir(quem);
  const r = esquemaCadastro.safeParse(dados);
  if (!r.success) throw new ErroRede(r.error.issues[0]?.message ?? 'Confira os dados da instituição.');
  const d = r.data;
  const pasta = d.pasta ? idDaPasta(d.pasta) : null;
  if (d.pasta && !pasta) throw new ErroRede('O link da pasta não parece válido: abra a pasta no Drive e copie o endereço da barra do navegador (ou só o trecho depois de /folders/).');
  const tabela = await lerTabela(p, Instituicoes);
  const alvo = existente ? tabela.porId(existente.id) : undefined;
  // Sem IDs no formulário, valem os que o cadastro já tem (o Elo os grava ao criar as planilhas).
  const atuais = alvo ? instituicaoDoRegistro(alvo as RegInstituicao).planilhas : {};
  const planilhas = d.planilhas ? Object.fromEntries(Object.entries(d.planilhas).filter(([, id]) => id)) : atuais;
  if (!pasta && (!planilhas.nucleo || !planilhas.auditoria)) throw new ErroRede('Informe o link da pasta da instituição no Drive compartilhado.');
  for (const [chave, id] of Object.entries(planilhas)) {
    if (!ID_PLANILHA.test(id)) throw new ErroRede(`O ID da planilha "${chave}" não parece válido: copie o trecho do link entre /d/ e /edit.`);
  }
  for (const e of d.administradoresIniciais) {
    if (!e.toLowerCase().endsWith(`@${d.dominio}`)) throw new ErroRede(`O administrador ${e} precisa ter e-mail @${d.dominio}.`);
  }

  const outras = tabela
    .ativos()
    .filter((x) => x.id !== existente?.id)
    .map((x) => instituicaoDoRegistro(x as RegInstituicao));
  if (outras.some((o) => o.codigo === d.codigo)) throw new ErroRede(`Já existe uma instituição com o código "${d.codigo}".`);
  if (outras.some((o) => o.dominio === d.dominio)) throw new ErroRede(`O domínio ${d.dominio} já é de outra instituição.`);
  if (pasta && outras.some((o) => o.pasta === pasta)) throw new ErroRede('Essa pasta já é de outra instituição.');
  const repetido = d.enderecos.find((e) => outras.some((o) => o.enderecos.includes(e)));
  if (repetido) throw new ErroRede(`O endereço ${repetido} já é de outra instituição.`);

  const campos = {
    codigo: d.codigo,
    nome: d.nome,
    nome_completo: d.nomeCompleto || null,
    dominio: d.dominio,
    enderecos: d.enderecos.join(', ') || null,
    planilhas: JSON.stringify(planilhas),
    pasta,
    administradores_iniciais: d.administradoresIniciais.map((e) => e.toLowerCase()).join(', ') || null,
    unidades: d.unidades.map((u) => `${u.codigo}=${u.nome}`).join('; ') || null,
  };
  if (!existente) {
    const novo = await inserir(p, Instituicoes, { ...campos, situacao: 'preparacao' } as never, { email: quem.email });
    await registrarAuditoria(p, {
      usuario: quem.email,
      acao: 'inclusao',
      entidade: 'Instituicoes',
      registroId: novo.id,
    });
    return novo.id;
  }
  if (!alvo || !alvo.ativo) throw new ErroRede('Instituição não encontrada.');
  if (alvo.codigo !== d.codigo) throw new ErroRede('O código de uma instituição não muda depois do cadastro.');
  const { colunasAlteradas } = await atualizar(p, Instituicoes, existente.id, existente.versao, campos as never, { email: quem.email });
  if (colunasAlteradas.length)
    await registrarAuditoria(p, {
      usuario: quem.email,
      acao: 'alteracao',
      entidade: 'Instituicoes',
      registroId: existente.id,
      detalhes: { colunas: colunasAlteradas },
    });
  return existente.id;
}

export async function mudarSituacao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  situacao: (typeof SITUACOES_INSTITUICAO)[number],
): Promise<void> {
  exigir(quem);
  const alvo = (await lerTabela(p, Instituicoes)).porId(id);
  if (!alvo || !alvo.ativo) throw new ErroRede('Instituição não encontrada.');
  if (alvo.situacao === situacao) return;
  await atualizar(p, Instituicoes, id, versao, { situacao } as never, {
    email: quem.email,
  });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'alteracao',
    entidade: 'Instituicoes',
    registroId: id,
    detalhes: { colunas: ['situacao'], situacao },
  });
}

// ---------------------------------------------------------------------------
// Administradores da rede
// ---------------------------------------------------------------------------

export async function incluirAdministradorRede(
  p: Planilhas,
  quem: Autorizador,
  dominioOperadora: string,
  dados: { email: string; nome: string },
): Promise<void> {
  exigir(quem);
  const email = dados.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) throw new ErroRede('Informe um e-mail válido.');
  if (!email.endsWith(`@${dominioOperadora}`)) throw new ErroRede(`Use um e-mail da Operadora (@${dominioOperadora}).`);
  if (!dados.nome.trim()) throw new ErroRede('Informe o nome.');
  const admins = await lerTabela(p, AdministradoresRede);
  if (admins.ativos().some((a) => a.email.toLowerCase() === email)) throw new ErroRede('Essa pessoa já administra a rede.');
  const novo = await inserir(p, AdministradoresRede, { email, nome: dados.nome.trim() }, { email: quem.email });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'AdministradoresRede',
    registroId: novo.id,
  });
}

export async function retirarAdministradorRede(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem);
  const admins = await lerTabela(p, AdministradoresRede);
  const alvo = admins.porId(id);
  if (!alvo || !alvo.ativo) throw new ErroRede('Administrador não encontrado.');
  if (alvo.email.toLowerCase() === quem.email.toLowerCase())
    throw new ErroRede('Você não pode retirar o seu próprio acesso. Peça a outra pessoa da Administração da rede.');
  await atualizar(p, AdministradoresRede, id, versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'encerramento',
    entidade: 'AdministradoresRede',
    registroId: id,
    detalhes: { colunas: ['ativo'] },
  });
}

// ---------------------------------------------------------------------------
// Conferência técnica de uma instituição
// ---------------------------------------------------------------------------

export interface ConferenciaPlanilha {
  chave: string;
  ok: boolean;
  mensagem: string;
  /** Com pasta: "criada" (já existe), "sera_criada" (nasce em Preparar estrutura) ou "lixeira". */
  situacao?: 'criada' | 'sera_criada' | 'lixeira';
  /** ID da planilha ou da pasta de anexos, quando já existe (para o botão Abrir). */
  id?: string;
  tipo?: 'planilha' | 'pasta';
}

export interface ConferenciaInstituicao {
  /** Só quando a instituição tem pasta no cadastro. */
  pasta?: { ok: boolean; mensagem: string };
  planilhas: ConferenciaPlanilha[];
  estrutura: 'em_dia' | 'desatualizada' | 'nao_preparada' | 'sem_acesso';
  mensagemEstrutura: string;
}

const NOME_DA_PLANILHA: Record<string, string> = {
  nucleo: 'Núcleo',
  auditoria: 'Auditoria',
  orcamento: 'Orçamento',
  orcamento_folha: 'Folha de pagamento',
  orcamento_execucao: 'Orçamento — execução e tesouraria',
  parcerias: 'Parcerias',
  requisicoes: 'Requisições',
  avaliacao_assistencia: 'Avaliação de Serviços Sociais',
  comunicacao: 'Comunicação',
  projetos: 'Projetos',
  anexos: 'Pasta de anexos',
};

/**
 * Testa, sem gravar nada, se cada planilha da instituição existe e está
 * compartilhada com a conta de serviço, e se a estrutura está em dia.
 * Lê só os nomes das abas e a configuração de perfis e permissões.
 */
export async function conferirInstituicao(
  quem: Autorizador,
  armazenamento: Armazenamento,
  inst: Instituicao,
  modulos: EstruturaDosModulos,
  pastas?: ArmazenamentoPastas,
): Promise<ConferenciaInstituicao> {
  exigir(quem);
  const comPasta = !!(inst.pasta && pastas);
  const esperadas = ['nucleo', 'auditoria', ...new Set((modulos.tabelas ?? []).map((t) => t.planilha)), ...(comPasta ? ['anexos'] : [])];
  const planilhas: ConferenciaPlanilha[] = [];
  let pasta: ConferenciaInstituicao['pasta'];
  if (comPasta) {
    const c = await pastas!.conferirPasta(inst.pasta!);
    pasta = c.ok ? { ok: true, mensagem: `Pasta "${c.nome}": encontrada, num Drive compartilhado, e a conta de serviço pode criar arquivos nela.` } : { ok: false, mensagem: c.motivo };
  }
  for (const chave of esperadas) {
    const nome = NOME_DA_PLANILHA[chave] ?? chave;
    const id = inst.planilhas[chave];
    const tipo = chave === 'anexos' ? ('pasta' as const) : ('planilha' as const);
    if (comPasta && !id) {
      planilhas.push({ chave, ok: true, situacao: 'sera_criada', tipo, mensagem: `${nome}: será criada ao preparar a estrutura.` });
      continue;
    }
    if (comPasta && id && (await pastas!.situacao(id)) === 'lixeira') {
      planilhas.push({ chave, ok: false, situacao: 'lixeira', id, tipo, mensagem: `${nome}: está na lixeira do Drive. Restaure o arquivo (o Elo nunca apaga nem recupera sozinho).` });
      continue;
    }
    if (chave === 'anexos') {
      // A pasta de anexos é conferida pelo Drive, não pelo Google Planilhas.
      if (id) planilhas.push({ chave, ok: true, situacao: 'criada', id, tipo, mensagem: `${nome}: criada.` });
      continue;
    }
    if (!id) {
      planilhas.push({
        chave,
        ok: false,
        mensagem: `${nome}: não informada. ${chave === 'nucleo' || chave === 'auditoria' ? 'Obrigatória.' : 'Necessária para usar esse app.'}`,
      });
      continue;
    }
    try {
      const abas = await armazenamento.listarAbas(id);
      planilhas.push({
        chave,
        ok: true,
        ...(comPasta ? { situacao: 'criada' as const, id, tipo } : {}),
        mensagem: `${nome}: ${comPasta ? 'criada' : 'encontrada e compartilhada'} (${abas.length} ${abas.length === 1 ? 'aba' : 'abas'}).`,
      });
    } catch (erro) {
      if (!(erro instanceof ErroArmazenamento)) throw erro;
      planilhas.push({
        chave,
        ok: false,
        mensagem: `${nome}: ${erro.message}`,
      });
    }
  }

  const nucleo = planilhas.find((x) => x.chave === 'nucleo');
  if (nucleo?.situacao === 'sera_criada')
    return {
      pasta,
      planilhas,
      estrutura: 'nao_preparada',
      mensagemEstrutura: 'As planilhas ainda não existem: use Preparar estrutura para o Elo criá-las na pasta, com as abas e a configuração inicial.',
    };
  if (!nucleo?.ok)
    return {
      pasta,
      planilhas,
      estrutura: 'sem_acesso',
      mensagemEstrutura: 'Sem acesso à planilha Núcleo: a estrutura não pôde ser conferida.',
    };
  try {
    const p: Planilhas = { armazenamento, idDe: (c) => inst.planilhas[c] ?? c };
    const est = await conferirEstrutura(p, modulos);
    return est.desatualizada
      ? {
          pasta,
          planilhas,
          estrutura: 'desatualizada',
          mensagemEstrutura: 'Há perfis ou permissões novos nesta versão do Elo: use Preparar estrutura.',
        }
      : {
          pasta,
          planilhas,
          estrutura: 'em_dia',
          mensagemEstrutura: 'Estrutura em dia.',
        };
  } catch (erro) {
    if (erro instanceof ErroEstruturaAusente) {
      return {
        pasta,
          planilhas,
        estrutura: 'nao_preparada',
        mensagemEstrutura: 'As planilhas ainda estão em branco: use Preparar estrutura para criar as abas e a configuração inicial.',
      };
    }
    if (erro instanceof ErroArmazenamento)
      return {
        pasta,
          planilhas,
        estrutura: 'sem_acesso',
        mensagemEstrutura: erro.message,
      };
    throw erro;
  }
}

// ---------------------------------------------------------------------------
// Preparar estrutura de uma instituição, a partir da rede
// ---------------------------------------------------------------------------

export interface PreparacaoInstituicao extends ResultadoPreparacao {
  /** Planilhas de apps sem ID no cadastro: as abas delas ficam para depois. */
  planilhasPuladas: string[];
}

/**
 * Cria nas planilhas da instituição as abas que faltam e a configuração
 * inicial (unidades do cadastro, áreas, perfis e permissões), igual ao botão
 * "Preparar estrutura" de dentro da instituição. Nunca apaga nem altera o que
 * já existe. Registra auditoria na rede e na própria instituição.
 */
export async function prepararEstruturaDaInstituicao(
  rede: Planilhas,
  quem: Autorizador,
  armazenamento: Armazenamento,
  inst: Instituicao,
  modulos: EstruturaDosModulos,
  registroId?: string,
): Promise<PreparacaoInstituicao> {
  exigir(quem);
  for (const chave of ['nucleo', 'auditoria']) {
    if (!inst.planilhas[chave]) throw new ErroRede(`Informe o ID da planilha ${NOME_DA_PLANILHA[chave]} antes de preparar a estrutura.`);
  }
  const puladas = new Set((modulos.tabelas ?? []).map((t) => t.planilha).filter((c) => !inst.planilhas[c]));
  const estrutura = {
    ...modulos,
    tabelas: (modulos.tabelas ?? []).filter((t) => !puladas.has(t.planilha)),
  };
  const p: Planilhas = { armazenamento, idDe: (c) => inst.planilhas[c] ?? c };
  let r: ResultadoPreparacao;
  try {
    r = await prepararEstrutura(p, estrutura, quem.email, inst.unidades);
  } catch (erro) {
    if (erro instanceof ErroArmazenamento) throw new ErroRede(`${inst.nome}: não foi possível preparar. ${erro.message}`);
    throw erro;
  }
  const detalhes = {
    abasCriadas: r.abasCriadas.length,
    registrosIniciais: r.registrosIniciais,
    planilhasPuladas: [...puladas],
  };
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'estrutura',
    entidade: 'planilhas',
    detalhes: { ...detalhes, origem: 'rede' },
  });
  await registrarAuditoria(rede, {
    usuario: quem.email,
    acao: 'estrutura',
    entidade: 'Instituicoes',
    registroId: registroId ?? inst.codigo,
    detalhes,
  });
  return {
    ...r,
    planilhasPuladas: [...puladas].map((c) => NOME_DA_PLANILHA[c] ?? c),
  };
}

// ---------------------------------------------------------------------------
// Criar as planilhas na pasta da instituição (ADR-018)
// ---------------------------------------------------------------------------

export interface ItemDaPasta {
  chave: string;
  nome: string;
  id: string;
  tipo: 'planilha' | 'pasta';
}

export interface ResultadoDaPasta {
  criadas: ItemDaPasta[];
  jaExistiam: ItemDaPasta[];
  falhas: { chave: string; nome: string; motivo: string }[];
  /** A instituição com os IDs gravados, para a etapa seguinte. */
  inst: Instituicao;
  versao: number;
}

/**
 * Para cada planilha necessária (Núcleo, Auditoria e as dos apps) e para a pasta
 * de anexos: usa a que o cadastro já tem; senão procura na pasta uma com a marca
 * do Elo; senão cria. Grava os IDs no cadastro, com auditoria (colunas, nunca
 * valores). Nunca apaga nem move nada, nem usa item marcado de outra instituição.
 */
export async function garantirPlanilhasDaPasta(
  rede: Planilhas,
  quem: Autorizador,
  pastas: ArmazenamentoPastas,
  inst: Instituicao,
  registro: { id: string; versao: number },
  modulos: EstruturaDosModulos,
): Promise<ResultadoDaPasta> {
  exigir(quem);
  if (!inst.pasta) throw new ErroRede('Informe o link da pasta da instituição antes de preparar a estrutura.');
  let conferida;
  try {
    conferida = await pastas.conferirPasta(inst.pasta);
  } catch (erro) {
    if (!(erro instanceof ErroArmazenamento)) throw erro;
    throw new ErroRede(`${inst.nome}: ${erro.message}`);
  }
  if (!conferida.ok) throw new ErroRede(`${inst.nome}: ${conferida.motivo}`);

  const chaves = ['nucleo', 'auditoria', ...new Set((modulos.tabelas ?? []).map((t) => t.planilha)), 'anexos'];
  const ids = { ...inst.planilhas };
  const criadas: ItemDaPasta[] = [];
  const jaExistiam: ItemDaPasta[] = [];
  const falhas: ResultadoDaPasta['falhas'] = [];
  for (const chave of chaves) {
    const nome = NOME_DA_PLANILHA[chave] ?? chave;
    const tipo = chave === 'anexos' ? ('pasta' as const) : ('planilha' as const);
    const marca = `${inst.codigo}/${chave}`;
    try {
      const atual = ids[chave];
      if (atual) {
        const situacao = await pastas.situacao(atual);
        if (situacao === 'lixeira') {
          falhas.push({ chave, nome, motivo: 'está na lixeira do Drive. Restaure o arquivo; o Elo não cria outro no lugar.' });
          continue;
        }
        if (situacao === 'existe') {
          // A marca protege contra duplicata mesmo que o arquivo seja renomeado ou movido.
          await pastas.marcar(atual, marca).catch(() => undefined);
          jaExistiam.push({ chave, nome, id: atual, tipo });
          continue;
        }
      }
      const achada = await pastas.procurar(inst.pasta, marca);
      if (achada) {
        ids[chave] = achada;
        jaExistiam.push({ chave, nome, id: achada, tipo });
        continue;
      }
      const id = await pastas.criar(inst.pasta, { nome: `Elo · ${inst.nome} · ${nome}`, tipo, marca });
      ids[chave] = id;
      criadas.push({ chave, nome, id, tipo });
    } catch (erro) {
      if (!(erro instanceof ErroArmazenamento)) throw erro;
      falhas.push({ chave, nome, motivo: erro.message });
    }
  }

  let versao = registro.versao;
  const mudou = chaves.some((c) => ids[c] !== inst.planilhas[c]);
  if (mudou) {
    const { registro: novo, colunasAlteradas } = await atualizar(rede, Instituicoes, registro.id, registro.versao, { planilhas: JSON.stringify(ids) } as never, {
      email: quem.email,
    });
    versao = novo.versao;
    await registrarAuditoria(rede, { usuario: quem.email, acao: 'alteracao', entidade: 'Instituicoes', registroId: registro.id, detalhes: { colunas: colunasAlteradas, origem: 'pasta' } });
  }
  await registrarAuditoria(rede, {
    usuario: quem.email,
    acao: 'estrutura',
    entidade: 'Instituicoes',
    registroId: registro.id,
    detalhes: {
      origem: 'pasta',
      criadas: criadas.map((x) => x.chave),
      jaExistiam: jaExistiam.map((x) => x.chave),
      falhas: falhas.map((x) => x.chave),
    },
  });
  const critica = falhas.filter((f) => f.chave === 'nucleo' || f.chave === 'auditoria');
  if (critica.length) throw new ErroRede(`${inst.nome}: ${critica.map((f) => `${f.nome} ${f.motivo}`).join(' ')}`);
  return { criadas, jaExistiam, falhas, inst: { ...inst, planilhas: ids }, versao };
}
