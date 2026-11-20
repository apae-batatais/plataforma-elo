/**
 * Gravação do Cadastro Único (ADR-035): cadastrar pessoa, corrigir dados, vincular a serviço e
 * encerrar vínculo. Tudo passa pelo Autorizador, grava com a versão lida e audita só as colunas.
 * Encerrar vínculo grava `saida` e mantém `ativo = TRUE`: o histórico e a contagem mensal dependem dele.
 */
import { z } from 'zod';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { ErroPermissao, type Autorizador, type DadosDePessoas } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { cpfValido, soDigitos } from '@/nucleo/encarregado/documento';
import { PessoaDesligadaDeServico, PessoaVinculadaAServico } from '@/nucleo/eventos/catalogo';
import { PAPEIS, Papeis, Pessoas, Servicos, VinculosFamiliares, VinculosServico, type RegPessoa } from '@/nucleo/estrutura/tabelas';

type Papel = (typeof PAPEIS)[number];
export type EventoDePessoa = z.infer<typeof PessoaVinculadaAServico> | z.infer<typeof PessoaDesligadaDeServico>;

/** Cadastro que já existe. `existenteId` só vem quando quem cadastra pode ver a pessoa (nunca vaza quem é). */
export class ErroDuplicidade extends ErroValidacao {
  constructor(
    mensagem: string,
    readonly tipo: 'cpf' | 'nome',
    readonly existenteId: string | null,
  ) {
    super(mensagem);
  }
}

export interface DadosDaPessoa {
  nome: string;
  nomeSocial?: string | null;
  dataNascimento?: string | null;
  cpf?: string | null;
  nis?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  bairro?: string | null;
}

const COLUNAS: Record<keyof DadosDaPessoa, keyof RegPessoa> = {
  nome: 'nome',
  nomeSocial: 'nome_social',
  dataNascimento: 'data_nascimento',
  cpf: 'cpf',
  nis: 'nis',
  email: 'email',
  telefone: 'telefone',
  cidade: 'cidade',
  bairro: 'bairro',
};

const dia = (agora: Date) => agora.toISOString().slice(0, 10);
const vazioParaNulo = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const chaveNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Confere e normaliza os dados da pessoa (CPF e NIS só com dígitos). */
export function conferirDadosDaPessoa(d: DadosDaPessoa, hoje: string): Record<string, string | null> {
  const nome = d.nome.trim().replace(/\s+/g, ' ');
  if ([...nome].filter((c) => /\p{L}/u.test(c)).length < 2) throw new ErroValidacao('Informe o nome completo da pessoa.');
  const cpf = vazioParaNulo(d.cpf) && soDigitos(d.cpf!);
  if (cpf && !cpfValido(cpf)) throw new ErroValidacao('CPF inválido. Confira os 11 números.');
  const nis = vazioParaNulo(d.nis) && soDigitos(d.nis!);
  if (nis && nis.length !== 11) throw new ErroValidacao('NIS inválido. Ele tem 11 números.');
  const email = vazioParaNulo(d.email)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroValidacao('E-mail inválido. Confira se tem @ e o final, como .org.br.');
  const nascimento = vazioParaNulo(d.dataNascimento);
  if (nascimento && !dataValida(nascimento)) throw new ErroValidacao('Data de nascimento inválida.');
  if (nascimento && nascimento > hoje) throw new ErroValidacao('A data de nascimento não pode ser no futuro.');
  return {
    nome,
    nome_social: vazioParaNulo(d.nomeSocial),
    data_nascimento: nascimento,
    cpf: cpf || null,
    nis: nis || null,
    email,
    telefone: vazioParaNulo(d.telefone),
    cidade: vazioParaNulo(d.cidade),
    bairro: vazioParaNulo(d.bairro),
  };
}

async function lerCadastro(p: Planilhas) {
  const [pessoas, papeis, vinculos, familiares, servicos] = await lerTabelas(p, [Pessoas, Papeis, VinculosServico, VinculosFamiliares, Servicos] as const);
  const dados: DadosDePessoas = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };
  return { pessoas, papeis, vinculos, servicos, dados };
}

/** Serviços ativos em que quem está logado pode vincular e encerrar. */
export async function servicosParaVincular(p: Planilhas, quem: Autorizador): Promise<{ codigo: string; nome: string }[]> {
  const [servicos] = await lerTabelas(p, [Servicos] as const);
  return servicos
    .ativos()
    .filter((s) => quem.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: s.codigo }))
    .map((s) => ({ codigo: s.codigo, nome: s.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function podeCadastrarPessoa(quem: Autorizador): boolean {
  return quem.temPermissaoAlgumEscopo('core.pessoas.editar');
}

// ---------------------------------------------------------------------------
// Cadastrar
// ---------------------------------------------------------------------------

export interface ResultadoDoCadastro {
  pessoa: { id: string; versao: number };
  vinculo: { id: string } | null;
  evento: z.infer<typeof PessoaVinculadaAServico> | null;
  /** O vínculo não foi gravado depois de a pessoa ter sido cadastrada. */
  falhaNoVinculo: string | null;
}

export async function cadastrarPessoa(
  p: Planilhas,
  quem: Autorizador,
  dados: DadosDaPessoa & { papel?: Papel; servico?: string | null; entrada?: string | null; confirmarOutraPessoa?: boolean },
  agora = new Date(),
): Promise<ResultadoDoCadastro> {
  if (!podeCadastrarPessoa(quem)) throw new ErroPermissao();
  const hoje = dia(agora);
  const servico = vazioParaNulo(dados.servico);
  const papel = dados.papel ?? 'atendido';
  if (!(PAPEIS as readonly string[]).includes(papel)) throw new ErroValidacao('Escolha o papel da pessoa.');
  if (servico && !quem.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: servico })) throw new ErroPermissao();
  const campos = conferirDadosDaPessoa(dados, hoje);

  // Duplicidade: olha o cadastro inteiro, mas só revela quem é a pessoa a quem já pode vê-la.
  const { pessoas, dados: cadastro } = await lerCadastro(p);
  const ativas = pessoas.ativos();
  const existente = campos.cpf ? ativas.find((x) => x.cpf === campos.cpf) : undefined;
  if (existente) {
    const visivel = quem.podeVerPessoa(existente.id, cadastro);
    throw new ErroDuplicidade(
      visivel ? 'Já existe uma pessoa com este CPF.' : 'Esta pessoa já está no cadastro da instituição. Peça à Diretoria para vinculá-la ao seu serviço.',
      'cpf',
      visivel ? existente.id : null,
    );
  }
  if (campos.data_nascimento && !dados.confirmarOutraPessoa) {
    const homonimo = ativas.find((x) => x.data_nascimento === campos.data_nascimento && chaveNome(x.nome) === chaveNome(campos.nome!));
    if (homonimo) {
      const visivel = quem.podeVerPessoa(homonimo.id, cadastro);
      throw new ErroDuplicidade(
        visivel
          ? 'Já existe uma pessoa com o mesmo nome e data de nascimento.'
          : 'Já existe alguém com o mesmo nome e data de nascimento no cadastro da instituição. Se for outra pessoa, confirme; se for a mesma, peça à Diretoria para vinculá-la ao seu serviço.',
        'nome',
        visivel ? homonimo.id : null,
      );
    }
  }
  if (servico) await conferirServicoEEntrada(p, servico, dados.entrada, hoje);

  const autoria = { email: quem.email, agora: () => agora };
  const pessoa = await inserir(p, Pessoas, campos as never, autoria);
  const preenchidas = Object.entries(campos).filter(([, v]) => v !== null).map(([c]) => c);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Pessoas', registroId: pessoa.id, detalhes: { colunas: preenchidas } }, agora);
  const papelGravado = await inserir(p, Papeis, { pessoa_id: pessoa.id, papel, inicio: hoje, fim: null }, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Papeis', registroId: papelGravado.id, detalhes: { colunas: ['pessoa_id', 'papel', 'inicio'] } }, agora);

  const resultado: ResultadoDoCadastro = { pessoa: { id: pessoa.id, versao: pessoa.versao }, vinculo: null, evento: null, falhaNoVinculo: null };
  if (!servico) return resultado;
  try {
    const v = await gravarVinculo(p, quem, pessoa.id, servico, vazioParaNulo(dados.entrada) ?? hoje, agora);
    resultado.vinculo = { id: v.vinculoId };
    resultado.evento = v;
  } catch (erro) {
    resultado.falhaNoVinculo = erro instanceof Error ? erro.message : 'Não foi possível gravar o vínculo.';
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Corrigir dados
// ---------------------------------------------------------------------------

export async function corrigirPessoa(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  dados: DadosDaPessoa,
  agora = new Date(),
): Promise<{ colunasAlteradas: string[] }> {
  const { pessoas, dados: cadastro } = await lerCadastro(p);
  const atual = pessoas.ativos().find((x) => x.id === id);
  if (!atual) throw new ErroValidacao('Pessoa não encontrada.');
  if (!quem.podeEditarPessoa(id, cadastro)) throw new ErroPermissao();
  const campos = conferirDadosDaPessoa(dados, dia(agora));
  if (campos.cpf && pessoas.ativos().some((x) => x.id !== id && x.cpf === campos.cpf)) {
    throw new ErroValidacao('Este CPF já está cadastrado em outra pessoa. Confira os números.');
  }
  const { colunasAlteradas } = await atualizar(p, Pessoas, id, versao, campos as never, { email: quem.email, agora: () => agora });
  if (colunasAlteradas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Pessoas', registroId: id, detalhes: { colunas: colunasAlteradas } }, agora);
  }
  return { colunasAlteradas };
}

// ---------------------------------------------------------------------------
// Vincular e encerrar
// ---------------------------------------------------------------------------

async function conferirServicoEEntrada(p: Planilhas, servico: string, entrada: string | null | undefined, hoje: string) {
  const [servicos] = await lerTabelas(p, [Servicos] as const);
  if (!servicos.ativos().some((s) => s.codigo === servico)) throw new ErroValidacao('Serviço não encontrado ou encerrado.');
  const e = vazioParaNulo(entrada);
  if (e && !dataValida(e)) throw new ErroValidacao('Data de entrada inválida.');
  if (e && e > hoje) throw new ErroValidacao('A data de entrada não pode ser no futuro.');
}

async function gravarVinculo(p: Planilhas, quem: Autorizador, pessoaId: string, servico: string, entrada: string, agora: Date) {
  const { papeis, vinculos } = await lerCadastro(p);
  if (vinculos.ativos().some((v) => v.pessoa_id === pessoaId && v.servico === servico && !v.saida)) {
    throw new ErroValidacao('Esta pessoa já está vinculada a este serviço.');
  }
  const autoria = { email: quem.email, agora: () => agora };
  const v = await inserir(p, VinculosServico, { pessoa_id: pessoaId, servico, entrada, saida: null, motivo_saida: null }, autoria);
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: 'inclusao', entidade: 'VinculosServico', registroId: v.id, detalhes: { colunas: ['pessoa_id', 'servico', 'entrada'] } },
    agora,
  );
  // Quem é atendido num serviço precisa do papel "atendido" para aparecer nas listas e avaliações.
  if (!papeis.ativos().some((x) => x.pessoa_id === pessoaId && x.papel === 'atendido' && !x.fim)) {
    const papel = await inserir(p, Papeis, { pessoa_id: pessoaId, papel: 'atendido', inicio: entrada, fim: null }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Papeis', registroId: papel.id, detalhes: { colunas: ['pessoa_id', 'papel', 'inicio'] } }, agora);
  }
  return PessoaVinculadaAServico.parse({ vinculoId: v.id, pessoaId, servico, entrada });
}

export async function vincularPessoa(
  p: Planilhas,
  quem: Autorizador,
  dados: { pessoaId: string; servico: string; entrada?: string | null },
  agora = new Date(),
): Promise<z.infer<typeof PessoaVinculadaAServico>> {
  const hoje = dia(agora);
  const { pessoas, dados: cadastro } = await lerCadastro(p);
  if (!pessoas.ativos().some((x) => x.id === dados.pessoaId)) throw new ErroValidacao('Pessoa não encontrada.');
  if (!quem.podeVerPessoa(dados.pessoaId, cadastro)) throw new ErroPermissao();
  if (!quem.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: dados.servico })) throw new ErroPermissao();
  await conferirServicoEEntrada(p, dados.servico, dados.entrada, hoje);
  return gravarVinculo(p, quem, dados.pessoaId, dados.servico, vazioParaNulo(dados.entrada) ?? hoje, agora);
}

export async function encerrarVinculo(
  p: Planilhas,
  quem: Autorizador,
  dados: { vinculoId: string; versao: number; saida?: string | null; motivo: string },
  agora = new Date(),
): Promise<z.infer<typeof PessoaDesligadaDeServico>> {
  const hoje = dia(agora);
  const { vinculos, dados: cadastro } = await lerCadastro(p);
  const v = vinculos.porId(dados.vinculoId);
  if (!v || !v.ativo) throw new ErroValidacao('Vínculo não encontrado.');
  if (!quem.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: v.servico })) throw new ErroPermissao();
  if (!quem.podeVerPessoa(v.pessoa_id, cadastro)) throw new ErroPermissao();
  if (v.saida) throw new ErroValidacao('Este vínculo já foi encerrado.');
  const motivo = dados.motivo.trim();
  if (motivo.length < 2) throw new ErroValidacao('Informe o motivo do encerramento.');
  if (motivo.length > 200) throw new ErroValidacao('O motivo é longo demais. Use até 200 letras.');
  const saida = vazioParaNulo(dados.saida) ?? hoje;
  if (!dataValida(saida)) throw new ErroValidacao('Data de saída inválida.');
  if (saida > hoje) throw new ErroValidacao('A data de saída não pode ser no futuro.');
  if (v.entrada && saida < v.entrada) throw new ErroValidacao('A data de saída não pode ser antes da entrada.');
  const { colunasAlteradas } = await atualizar(p, VinculosServico, v.id, dados.versao, { saida, motivo_saida: motivo }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'VinculosServico', registroId: v.id, detalhes: { colunas: colunasAlteradas } }, agora);
  return PessoaDesligadaDeServico.parse({ vinculoId: v.id, pessoaId: v.pessoa_id, servico: v.servico, saida, motivo });
}

// ---------------------------------------------------------------------------
// Abrir a pessoa
// ---------------------------------------------------------------------------

export interface PessoaAberta {
  id: string;
  versao: number;
  dados: Record<keyof DadosDaPessoa, string | null>;
  podeCorrigir: boolean;
  vinculos: { id: string; versao: number; servico: string; servicoNome: string; entrada: string | null; saida: string | null; motivo: string | null; podeEncerrar: boolean }[];
}

/** Abre a pessoa para quem pode vê-la e grava a leitura na auditoria (dados pessoais), sem os valores. */
export async function abrirPessoa(p: Planilhas, quem: Autorizador, id: string, agora = new Date()): Promise<PessoaAberta> {
  const { pessoas, vinculos, servicos, dados: cadastro } = await lerCadastro(p);
  const pessoa = pessoas.ativos().find((x) => x.id === id);
  if (!pessoa || !quem.podeVerPessoa(id, cadastro)) throw new ErroPermissao('Você não tem permissão para ver esta pessoa.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'pessoas', registroId: id, detalhes: { origem: 'janela' } }, agora);
  const nomeServico = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));
  const dados = Object.fromEntries(Object.entries(COLUNAS).map(([k, c]) => [k, (pessoa[c] as string | null) ?? null])) as PessoaAberta['dados'];
  return {
    id,
    versao: pessoa.versao,
    dados,
    podeCorrigir: quem.podeEditarPessoa(id, cadastro),
    vinculos: vinculos
      .ativos()
      .filter((v) => v.pessoa_id === id)
      .map((v) => ({
        id: v.id,
        versao: v.versao,
        servico: v.servico,
        servicoNome: nomeServico.get(v.servico) ?? v.servico,
        entrada: v.entrada,
        saida: v.saida,
        motivo: v.motivo_saida,
        podeEncerrar: !v.saida && quem.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: v.servico }),
      }))
      .sort((a, b) => Number(Boolean(a.saida)) - Number(Boolean(b.saida)) || (b.entrada ?? '').localeCompare(a.entrada ?? '')),
  };
}
