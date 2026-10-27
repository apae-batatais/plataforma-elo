/**
 * Gestão de acessos e da organização (camada de aplicação).
 *
 * - Acessos (usuários e perfis): exige "core.acessos.gerenciar".
 * - Serviços: exige "core.organizacao.gerenciar".
 * Toda alteração é auditada (só nomes de colunas, nunca valores pessoais).
 * Nada é apagado: atribuições são encerradas (fim) e usuários desativados.
 */
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import {
  Areas, Atribuicoes, EIXOS, Papeis, Perfis, Pessoas, Servicos, Unidades, Usuarios,
  type EscopoTipo,
} from '@/nucleo/estrutura/tabelas';
import { ErroPermissao, type Autorizador } from './autorizador';

export class ErroValidacao extends Error {}

const hoje = () => new Date().toISOString().slice(0, 10);

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

export interface PainelAcessos {
  usuarios: {
    id: string;
    versao: number;
    email: string;
    nome: string;
    ativo: boolean;
    atribuicoes: { id: string; versao: number; perfil: string; escopo: string; vigente: boolean; fim: string | null }[];
  }[];
  perfis: { codigo: string; nome: string }[];
  escopos: { tipo: EscopoTipo; codigo: string; nome: string }[];
}

export async function painelDeAcessos(p: Planilhas, quem: Autorizador): Promise<PainelAcessos> {
  exigir(quem, 'core.acessos.gerenciar');
  const [usuarios, atribuicoes, perfis, servicos, unidades, areas, pessoas] = await lerTabelas(p, [
    Usuarios, Atribuicoes, Perfis, Servicos, Unidades, Areas, Pessoas,
  ] as const);
  const nomePessoa = new Map(pessoas.todos().map((x) => [x.id, x.nome_social ?? x.nome]));
  const nomePerfil = new Map(perfis.ativos().map((x) => [x.codigo, x.nome]));
  const escopos: PainelAcessos['escopos'] = [
    ...unidades.ativos().map((u) => ({ tipo: 'unidade' as const, codigo: u.codigo, nome: u.nome })),
    ...areas.ativos().map((a) => ({ tipo: 'area' as const, codigo: a.codigo, nome: a.nome })),
    ...servicos.ativos().map((s) => ({ tipo: 'servico' as const, codigo: s.codigo, nome: s.nome })),
  ];
  const nomeEscopo = (tipo: EscopoTipo, codigo: string | null) =>
    tipo === 'global'
      ? 'Toda a instituição'
      : `${{ unidade: 'Unidade', area: 'Área', servico: 'Serviço' }[tipo]} ${escopos.find((e) => e.tipo === tipo && e.codigo === codigo)?.nome ?? codigo}`;
  const h = hoje();

  return {
    usuarios: usuarios
      .todos()
      .map((u) => ({
        id: u.id,
        versao: u.versao,
        email: u.email,
        nome: (u.pessoa_id && nomePessoa.get(u.pessoa_id)) || u.email,
        ativo: u.ativo,
        atribuicoes: atribuicoes
          .ativos()
          .filter((a) => a.usuario_email === u.email)
          .map((a) => ({
            id: a.id,
            versao: a.versao,
            perfil: nomePerfil.get(a.perfil) ?? a.perfil,
            escopo: nomeEscopo(a.escopo_tipo, a.escopo),
            vigente: (!a.inicio || a.inicio <= h) && (!a.fim || a.fim >= h),
            fim: a.fim,
          })),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    perfis: perfis.ativos().map((x) => ({ codigo: x.codigo, nome: x.nome })),
    escopos,
  };
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export async function cadastrarUsuario(
  p: Planilhas,
  quem: Autorizador,
  dados: { email: string; nome: string },
  dominio: string | null,
): Promise<void> {
  exigir(quem, 'core.acessos.gerenciar');
  const email = dados.email.trim().toLowerCase();
  const nome = dados.nome.trim();
  if (nome.length < 2) throw new ErroValidacao('Informe o nome completo.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroValidacao('E-mail inválido.');
  if (dominio && !email.endsWith(`@${dominio}`)) throw new ErroValidacao(`Use um e-mail institucional @${dominio}.`);

  const [usuarios] = await lerTabelas(p, [Usuarios] as const);
  const existente = usuarios.todos().find((u) => u.email === email);
  if (existente?.ativo) throw new ErroValidacao('Este e-mail já tem acesso.');

  const autoria = { email: quem.email };
  if (existente) {
    await atualizar(p, Usuarios, existente.id, existente.versao, { ativo: true }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Usuarios', registroId: existente.id, detalhes: { colunas: ['ativo'] } });
    return;
  }
  const pessoa = await inserir(p, Pessoas, { nome, email }, autoria);
  await inserir(p, Papeis, { pessoa_id: pessoa.id, papel: 'colaborador', inicio: hoje() }, autoria);
  const usuario = await inserir(p, Usuarios, { email, pessoa_id: pessoa.id }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Usuarios', registroId: usuario.id });
}

export async function desativarUsuario(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.acessos.gerenciar');
  const [usuarios] = await lerTabelas(p, [Usuarios] as const);
  const alvo = usuarios.porId(id);
  if (!alvo) throw new ErroValidacao('Usuário não encontrado.');
  if (alvo.email === quem.email) throw new ErroValidacao('Você não pode desativar o seu próprio acesso.');
  await atualizar(p, Usuarios, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Usuarios', registroId: id });
}

// ---------------------------------------------------------------------------
// Atribuições de perfil
// ---------------------------------------------------------------------------

export async function atribuirPerfil(
  p: Planilhas,
  quem: Autorizador,
  dados: { email: string; perfil: string; escopoTipo: EscopoTipo; escopo: string | null },
): Promise<void> {
  exigir(quem, 'core.acessos.gerenciar');
  const [usuarios, perfis, servicos, unidades, areas, atribuicoes] = await lerTabelas(p, [
    Usuarios, Perfis, Servicos, Unidades, Areas, Atribuicoes,
  ] as const);
  if (!usuarios.ativos().some((u) => u.email === dados.email)) throw new ErroValidacao('Usuário sem acesso ativo.');
  if (!perfis.ativos().some((x) => x.codigo === dados.perfil)) throw new ErroValidacao('Perfil inexistente.');

  const escopo = dados.escopoTipo === 'global' ? null : dados.escopo;
  if (dados.escopoTipo !== 'global') {
    const lista = { servico: servicos, unidade: unidades, area: areas }[dados.escopoTipo].ativos() as { codigo: string }[];
    if (!escopo || !lista.some((x) => x.codigo === escopo)) throw new ErroValidacao('Escolha onde o perfil vale.');
  }
  const h = hoje();
  const repetida = atribuicoes
    .ativos()
    .some((a) => a.usuario_email === dados.email && a.perfil === dados.perfil && a.escopo_tipo === dados.escopoTipo && a.escopo === escopo && (!a.fim || a.fim >= h));
  if (repetida) throw new ErroValidacao('Este perfil já está atribuído com o mesmo escopo.');

  const nova = await inserir(p, Atribuicoes, { usuario_email: dados.email, perfil: dados.perfil, escopo_tipo: dados.escopoTipo, escopo, inicio: h }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Atribuicoes', registroId: nova.id });
}

export async function encerrarAtribuicao(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.acessos.gerenciar');
  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const { colunasAlteradas } = await atualizar(p, Atribuicoes, id, versao, { fim: ontem }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Atribuicoes', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------

export async function cadastrarServico(
  p: Planilhas,
  quem: Autorizador,
  dados: { codigo: string; nome: string; eixo: string; unidade: string; area: string | null; vagas: number | null },
): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const codigo = dados.codigo.trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(codigo)) throw new ErroValidacao('Código em minúsculas, sem espaços nem acentos (ex.: centro_dia).');
  if (!(EIXOS as readonly string[]).includes(dados.eixo)) throw new ErroValidacao('Eixo inválido.');
  const [servicos, unidades, areas] = await lerTabelas(p, [Servicos, Unidades, Areas] as const);
  if (servicos.todos().some((s) => s.codigo === codigo)) throw new ErroValidacao('Já existe um serviço com este código.');
  if (!unidades.ativos().some((u) => u.codigo === dados.unidade)) throw new ErroValidacao('Unidade inexistente.');
  if (dados.area && !areas.ativos().some((a) => a.codigo === dados.area)) throw new ErroValidacao('Área inexistente.');
  if (dados.vagas !== null && (!Number.isInteger(dados.vagas) || dados.vagas < 0)) throw new ErroValidacao('Vagas deve ser um número inteiro.');

  const s = await inserir(
    p,
    Servicos,
    { codigo, nome: dados.nome.trim(), eixo: dados.eixo as (typeof EIXOS)[number], unidade: dados.unidade, area: dados.area, vagas: dados.vagas, inicio: hoje() },
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Servicos', registroId: s.id });
}
