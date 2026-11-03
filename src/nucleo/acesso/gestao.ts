/**
 * Gestão de acessos e da organização (camada de aplicação).
 *
 * - Acessos (usuários e perfis): exige "core.acessos.gerenciar".
 * - Serviços: exige "core.organizacao.gerenciar".
 * Toda alteração é auditada (só nomes de colunas, nunca valores pessoais).
 * Nada é apagado: atribuições são encerradas (fim) e usuários desativados.
 */
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import {
  Areas, Atribuicoes, Papeis, Perfis, Pessoas, Servicos, Unidades, Usuarios, VinculosServico,
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
  dados: { email: string; nome: string; perfil?: string | null },
  dominio: string | null,
): Promise<void> {
  exigir(quem, 'core.acessos.gerenciar');
  if (dados.perfil) {
    // Com perfil: mesmo caminho do lote (cadastra ou reativa e dá o perfil para toda a instituição).
    const [linha] = await analisarUsuariosEmLote(p, quem, [dados.nome, dados.email, dados.perfil].join('\t'), dominio);
    if (!linha) throw new ErroValidacao('Informe o nome completo e o e-mail.');
    if (linha.situacao === 'erro') throw new ErroValidacao(linha.problema ?? 'Confira os dados.');
    if (linha.situacao === 'ja_existe' || linha.situacao === 'perfil') throw new ErroValidacao('Este e-mail já tem acesso. Use “Atribuir perfil” na linha da pessoa.');
    await cadastrarUsuariosEmLote(p, quem, [{ nome: linha.nome, email: linha.email, perfil: linha.perfil!, escopoTipo: 'global', escopo: null }], dominio);
    return;
  }
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
  dados: { codigo: string; nome: string; unidade: string; area: string; vagas: number | null },
): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const codigo = dados.codigo.trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(codigo)) throw new ErroValidacao('Código em minúsculas, sem espaços nem acentos (ex.: centro_dia).');
  const [servicos, unidades, areas] = await lerTabelas(p, [Servicos, Unidades, Areas] as const);
  if (servicos.todos().some((s) => s.codigo === codigo)) throw new ErroValidacao('Já existe um serviço com este código.');
  if (!unidades.ativos().some((u) => u.codigo === dados.unidade)) throw new ErroValidacao('Unidade inexistente.');
  if (!areas.ativos().some((a) => a.codigo === dados.area)) throw new ErroValidacao('Escolha a área do serviço.');
  if (dados.vagas !== null && (!Number.isInteger(dados.vagas) || dados.vagas < 0)) throw new ErroValidacao('Vagas deve ser um número inteiro.');

  const s = await inserir(
    p,
    Servicos,
    { codigo, nome: dados.nome.trim(), unidade: dados.unidade, area: dados.area, vagas: dados.vagas, inicio: hoje() },
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Servicos', registroId: s.id });
}

// ---------------------------------------------------------------------------
// Serviços em lote (lista colada de uma planilha)
// ---------------------------------------------------------------------------

export interface LinhaServicoLote {
  linha: number;
  nome: string;
  codigo: string;
  area: string | null;
  areaNome: string | null;
  unidade: string | null;
  unidadeNome: string | null;
  vagas: number | null;
  situacao: 'ok' | 'ja_existe' | 'erro';
  problema: string | null;
}

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[()\-_.,/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function codigoDoNome(nome: string, usados: Set<string>): string {
  const base = semAcento(nome).replace(/[^a-z0-9 ]/g, '').trim().replace(/ /g, '_').slice(0, 40) || 'servico';
  let c = base;
  for (let i = 2; usados.has(c); i++) c = `${base}_${i}`;
  usados.add(c);
  return c;
}

/** Acha pelo código, pelo nome ou por uma palavra do nome entre parênteses (ex.: "Sede", "Filial"). */
function acharPorNome<T extends { codigo: string; nome: string }>(lista: T[], texto: string): T | undefined {
  const t = semAcento(texto);
  if (!t) return undefined;
  return (
    lista.find((x) => semAcento(x.codigo) === t || semAcento(x.nome) === t) ??
    lista.find((x) => semAcento(x.nome).split(' ').includes(t)) ??
    lista.find((x) => semAcento(x.nome).includes(t) || t.includes(semAcento(x.nome)))
  );
}

/**
 * Lê uma lista colada (linhas copiadas de uma planilha, separadas por
 * tabulação ou ponto e vírgula): Nome; Área; Unidade (opcional); Vagas (opcional).
 * Não grava nada: devolve o que seria cadastrado, para a pessoa conferir.
 */
export async function analisarServicosEmLote(p: Planilhas, quem: Autorizador, texto: string): Promise<LinhaServicoLote[]> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [servicos, unidades, areas] = await lerTabelas(p, [Servicos, Unidades, Areas] as const);
  const usados = new Set(servicos.todos().map((s) => s.codigo));
  const nomesExistentes = new Set(servicos.todos().map((s) => semAcento(s.nome)));
  const nomesNoLote = new Set<string>();
  const sede = unidades.ativos().find((u) => u.codigo === 'sede') ?? unidades.ativos()[0];

  const linhas = texto.split(/\r?\n/).map((l, i) => ({ numero: i + 1, partes: l.split(/\t|;/).map((x) => x.trim()) }));
  const resultado: LinhaServicoLote[] = [];
  for (const { numero, partes } of linhas) {
    const [nome = '', areaTexto = '', unidadeTexto = '', vagasTexto = ''] = partes;
    if (!nome) continue;
    // Linha de cabeçalho copiada junto.
    if (semAcento(nome) === 'nome' || (semAcento(nome).startsWith('servico') && semAcento(areaTexto) === 'area')) continue;

    const area = acharPorNome(areas.ativos(), areaTexto);
    const unidade = unidadeTexto ? acharPorNome(unidades.ativos(), unidadeTexto) : sede;
    const vagas = vagasTexto ? Number(vagasTexto.replace(/\D/g, '')) : null;
    const chave = semAcento(nome);
    let situacao: LinhaServicoLote['situacao'] = 'ok';
    let problema: string | null = null;
    if (nomesExistentes.has(chave)) {
      situacao = 'ja_existe';
      problema = 'Já cadastrado: será ignorado.';
    } else if (nomesNoLote.has(chave)) {
      situacao = 'ja_existe';
      problema = 'Repetido na lista: será ignorado.';
    } else if (!areaTexto) {
      situacao = 'erro';
      problema = 'Falta a área.';
    } else if (!area) {
      situacao = 'erro';
      problema = `Área "${areaTexto}" não encontrada.`;
    } else if (!unidade) {
      situacao = 'erro';
      problema = `Unidade "${unidadeTexto}" não encontrada.`;
    } else if (vagas !== null && !Number.isInteger(vagas)) {
      situacao = 'erro';
      problema = 'Vagas deve ser um número inteiro.';
    }
    nomesNoLote.add(chave);
    resultado.push({
      linha: numero,
      nome: nome.replace(/\s+/g, ' '),
      codigo: situacao === 'ok' ? codigoDoNome(nome, usados) : '',
      area: area?.codigo ?? null,
      areaNome: area?.nome ?? null,
      unidade: unidade?.codigo ?? null,
      unidadeNome: unidade?.nome ?? null,
      vagas,
      situacao,
      problema,
    });
  }
  return resultado;
}

/** Cadastra as linhas conferidas, com uma gravação só e um registro de auditoria. */
export async function cadastrarServicosEmLote(
  p: Planilhas,
  quem: Autorizador,
  linhas: { codigo: string; nome: string; area: string; unidade: string; vagas: number | null }[],
): Promise<number> {
  exigir(quem, 'core.organizacao.gerenciar');
  if (linhas.length === 0) throw new ErroValidacao('Não há serviços para cadastrar.');
  const [servicos, unidades, areas] = await lerTabelas(p, [Servicos, Unidades, Areas] as const);
  const codigos = new Set(servicos.todos().map((s) => s.codigo));
  const nomes = new Set(servicos.todos().map((s) => semAcento(s.nome)));
  for (const l of linhas) {
    if (!/^[a-z0-9_]+$/.test(l.codigo) || codigos.has(l.codigo) || nomes.has(semAcento(l.nome))) {
      throw new ErroValidacao('A lista mudou ou já foi cadastrada. Confira de novo antes de cadastrar.');
    }
    if (!areas.ativos().some((a) => a.codigo === l.area) || !unidades.ativos().some((u) => u.codigo === l.unidade)) {
      throw new ErroValidacao(`Área ou unidade inválida em "${l.nome}".`);
    }
    if (l.nome.trim().length < 2) throw new ErroValidacao('Há serviço sem nome.');
    codigos.add(l.codigo);
    nomes.add(semAcento(l.nome));
  }
  const gravados = await inserirRegistros(
    p,
    servicos,
    linhas.map((l) => ({ codigo: l.codigo, nome: l.nome.trim(), area: l.area, unidade: l.unidade, vagas: l.vagas, inicio: hoje() })),
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Servicos', detalhes: { lote: gravados.length } });
  return gravados.length;
}

// ---------------------------------------------------------------------------
// Editar, excluir (encerrar) e reativar serviço
// ---------------------------------------------------------------------------

/**
 * Altera nome, área, unidade e vagas. O código não muda: ele liga o serviço
 * à lotação da folha, aos perfis de acesso e aos atendidos.
 */
export async function editarServico(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  dados: { nome: string; unidade: string; area: string; vagas: number | null },
): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [servicos, unidades, areas] = await lerTabelas(p, [Servicos, Unidades, Areas] as const);
  const alvo = servicos.porId(id);
  if (!alvo || alvo.ativo === false) throw new ErroValidacao('Serviço não encontrado.');
  const nome = dados.nome.trim();
  if (!nome) throw new ErroValidacao('Informe o nome do serviço.');
  if (!unidades.ativos().some((u) => u.codigo === dados.unidade)) throw new ErroValidacao('Unidade inexistente.');
  if (!areas.ativos().some((a) => a.codigo === dados.area)) throw new ErroValidacao('Escolha a área do serviço.');
  if (dados.vagas !== null && (!Number.isInteger(dados.vagas) || dados.vagas < 0)) throw new ErroValidacao('Vagas deve ser um número inteiro.');
  const { colunasAlteradas } = await atualizar(
    p,
    Servicos,
    id,
    versao,
    { nome, unidade: dados.unidade, area: dados.area, vagas: dados.vagas },
    { email: quem.email },
  );
  if (colunasAlteradas.length === 0) return;
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Servicos', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/**
 * "Excluir" um serviço: ele sai das listas (ativo = FALSE, fim = hoje), mas o
 * registro fica guardado e pode ser reativado. Não deixa excluir enquanto houver
 * perfis de acesso ou atendidos ligados a ele.
 */
export async function excluirServico(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [servicos, atribuicoes, vinculos] = await lerTabelas(p, [Servicos, Atribuicoes, VinculosServico] as const);
  const alvo = servicos.porId(id);
  if (!alvo || alvo.ativo === false) throw new ErroValidacao('Serviço não encontrado.');
  const h = hoje();
  const perfis = atribuicoes
    .ativos()
    .filter((a) => a.escopo_tipo === 'servico' && a.escopo === alvo.codigo && (!a.fim || a.fim >= h)).length;
  if (perfis > 0) {
    throw new ErroValidacao(
      `Não dá para excluir "${alvo.nome}": ${perfis} ${perfis === 1 ? 'perfil de acesso vale' : 'perfis de acesso valem'} para ele. Retire-os antes em Acessos.`,
    );
  }
  const atendidos = vinculos.ativos().filter((v) => v.servico === alvo.codigo && (!v.saida || v.saida >= h)).length;
  if (atendidos > 0) {
    throw new ErroValidacao(
      `Não dá para excluir "${alvo.nome}": ${atendidos} ${atendidos === 1 ? 'pessoa está vinculada' : 'pessoas estão vinculadas'} a ele. Registre a saída antes.`,
    );
  }
  const { colunasAlteradas } = await atualizar(p, Servicos, id, versao, { ativo: false, fim: h }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Servicos', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/** Volta a mostrar um serviço excluído por engano. */
export async function reativarServico(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [servicos] = await lerTabelas(p, [Servicos] as const);
  const alvo = servicos.porId(id);
  if (!alvo || alvo.ativo !== false) throw new ErroValidacao('Serviço não encontrado entre os excluídos.');
  const { colunasAlteradas } = await atualizar(p, Servicos, id, versao, { ativo: true, fim: null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Servicos', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Áreas (agrupam os serviços)
// ---------------------------------------------------------------------------

/** Nome comparável: sem acento, sem maiúsculas e sem espaços sobrando. */
const nomeComparavel = (t: string) => semAcento(t).replace(/[^a-z0-9 ]/g, '').trim();

function conferirNomeDeArea(lista: { id: string; nome: string; ativo: boolean }[], nome: string, ignorarId?: string) {
  if (!nome) throw new ErroValidacao('Informe o nome da área.');
  const igual = lista.find((a) => a.id !== ignorarId && nomeComparavel(a.nome) === nomeComparavel(nome));
  if (igual) {
    throw new ErroValidacao(
      igual.ativo === false
        ? `Já existe uma área excluída chamada "${igual.nome}". Reative-a em vez de cadastrar outra.`
        : `Já existe uma área chamada "${igual.nome}". O nome da área não pode se repetir.`,
    );
  }
}

/** Cadastra uma área. O nome é único (sem diferença de acento ou maiúsculas); o código é gerado do nome. */
export async function cadastrarArea(p: Planilhas, quem: Autorizador, dados: { nome: string }): Promise<string> {
  exigir(quem, 'core.organizacao.gerenciar');
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const [areas] = await lerTabelas(p, [Areas] as const);
  conferirNomeDeArea(areas.todos(), nome);
  const codigo = codigoDoNome(nome, new Set(areas.todos().map((a) => a.codigo)));
  const a = await inserir(p, Areas, { codigo, nome }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Areas', registroId: a.id });
  return codigo;
}

/** Muda o nome da área (o código fica o mesmo, os serviços continuam ligados). */
export async function editarArea(p: Planilhas, quem: Autorizador, id: string, versao: number, dados: { nome: string }): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const [areas] = await lerTabelas(p, [Areas] as const);
  const alvo = areas.porId(id);
  if (!alvo || alvo.ativo === false) throw new ErroValidacao('Área não encontrada.');
  conferirNomeDeArea(areas.todos(), nome, id);
  const { colunasAlteradas } = await atualizar(p, Areas, id, versao, { nome }, { email: quem.email });
  if (colunasAlteradas.length === 0) return;
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Areas', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

/** "Excluir" uma área: sai das listas (ativo = FALSE). Só se nenhum serviço ou perfil de acesso usar a área. */
export async function excluirArea(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [areas, servicos, atribuicoes] = await lerTabelas(p, [Areas, Servicos, Atribuicoes] as const);
  const alvo = areas.porId(id);
  if (!alvo || alvo.ativo === false) throw new ErroValidacao('Área não encontrada.');
  const qtd = servicos.ativos().filter((s) => s.area === alvo.codigo).length;
  if (qtd > 0) {
    throw new ErroValidacao(
      `Não dá para excluir "${alvo.nome}": ${qtd} ${qtd === 1 ? 'serviço pertence' : 'serviços pertencem'} a ela. Mude a área desses serviços ou exclua-os antes.`,
    );
  }
  const h = hoje();
  const perfis = atribuicoes.ativos().filter((a) => a.escopo_tipo === 'area' && a.escopo === alvo.codigo && (!a.fim || a.fim >= h)).length;
  if (perfis > 0) {
    throw new ErroValidacao(
      `Não dá para excluir "${alvo.nome}": ${perfis} ${perfis === 1 ? 'perfil de acesso vale' : 'perfis de acesso valem'} para ela. Retire-os antes em Acessos.`,
    );
  }
  await atualizar(p, Areas, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Areas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

/** Volta a mostrar uma área excluída (se nenhuma ativa tiver o mesmo nome). */
export async function reativarArea(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem, 'core.organizacao.gerenciar');
  const [areas] = await lerTabelas(p, [Areas] as const);
  const alvo = areas.porId(id);
  if (!alvo || alvo.ativo !== false) throw new ErroValidacao('Área não encontrada entre as excluídas.');
  if (areas.ativos().some((a) => nomeComparavel(a.nome) === nomeComparavel(alvo.nome))) {
    throw new ErroValidacao(`Já existe uma área ativa chamada "${alvo.nome}".`);
  }
  await atualizar(p, Areas, id, versao, { ativo: true }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Areas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

// ---------------------------------------------------------------------------
// Usuários em lote (lista colada de uma planilha): nome, e-mail, perfil, onde vale
// ---------------------------------------------------------------------------

/** Perfil usado quando a linha não diz qual: o básico de quem trabalha na instituição. */
export const PERFIL_PADRAO = 'funcionario';

export interface LinhaUsuarioLote {
  linha: number;
  nome: string;
  email: string;
  perfil: string | null;
  perfilNome: string | null;
  escopoTipo: EscopoTipo;
  escopo: string | null;
  escopoNome: string;
  /**
   * novo: cadastra o acesso e dá o perfil; perfil: já tem acesso, só ganha o perfil;
   * reativar: acesso desativado volta com o perfil; ja_existe: nada a fazer; erro: corrigir.
   */
  situacao: 'novo' | 'perfil' | 'reativar' | 'ja_existe' | 'erro';
  problema: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Lê a lista colada (tabulação ou ponto e vírgula): Nome; E-mail; Perfil
 * (opcional, padrão Funcionário); Vale para (opcional: unidade, área ou
 * serviço; vazio = toda a instituição). Não grava nada.
 */
export async function analisarUsuariosEmLote(p: Planilhas, quem: Autorizador, texto: string, dominio: string | null): Promise<LinhaUsuarioLote[]> {
  exigir(quem, 'core.acessos.gerenciar');
  const [usuarios, atribuicoes, perfis, servicos, unidades, areas] = await lerTabelas(p, [Usuarios, Atribuicoes, Perfis, Servicos, Unidades, Areas] as const);
  const h = hoje();
  const padrao = perfis.ativos().find((x) => x.codigo === PERFIL_PADRAO);
  const escopos = [
    ...unidades.ativos().map((x) => ({ tipo: 'unidade' as const, codigo: x.codigo, nome: x.nome })),
    ...areas.ativos().map((x) => ({ tipo: 'area' as const, codigo: x.codigo, nome: x.nome })),
    ...servicos.ativos().map((x) => ({ tipo: 'servico' as const, codigo: x.codigo, nome: x.nome })),
  ];
  const noLote = new Set<string>();
  const resultado: LinhaUsuarioLote[] = [];

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const [nomeBruto = '', emailBruto = '', perfilTexto = '', escopoTexto = ''] = bruta.split(/\t|;/).map((x) => x.trim());
    const nome = nomeBruto.replace(/\s+/g, ' ');
    const email = emailBruto.toLowerCase();
    if (!nome && !email) return;
    // Linha de cabeçalho copiada junto.
    if (semAcento(nome) === 'nome' && !email.includes('@')) return;

    const perfil = perfilTexto ? acharPorNome(perfis.ativos(), perfilTexto) : padrao;
    // "Vale para": nome exato primeiro (unidade, área ou serviço), depois parecido.
    const t = semAcento(escopoTexto);
    const exato = /^(unidade|area|servico):(.+)$/.exec(escopoTexto);
    const escopo = !escopoTexto
      ? null
      : exato
        ? escopos.find((e) => e.tipo === exato[1] && e.codigo === exato[2])
        : (escopos.find((e) => semAcento(e.codigo) === t || semAcento(e.nome) === t) ?? acharPorNome(escopos, escopoTexto));
    const existente = usuarios.todos().find((u) => u.email === email);
    const linha: LinhaUsuarioLote = {
      linha: i + 1,
      nome,
      email,
      perfil: perfil?.codigo ?? null,
      perfilNome: perfil?.nome ?? null,
      escopoTipo: escopo ? escopo.tipo : 'global',
      escopo: escopo ? escopo.codigo : null,
      escopoNome: escopo ? `${{ unidade: 'Unidade', area: 'Área', servico: 'Serviço' }[escopo.tipo]} ${escopo.nome}` : 'Toda a instituição',
      situacao: 'novo',
      problema: null,
    };
    const erro = (problema: string) => Object.assign(linha, { situacao: 'erro', problema });
    if (nome.length < 2) erro('Falta o nome completo.');
    else if (!EMAIL.test(email)) erro(email ? `E-mail "${emailBruto}" inválido.` : 'Falta o e-mail.');
    else if (dominio && !email.endsWith(`@${dominio}`)) erro(`Use um e-mail institucional @${dominio}.`);
    else if (noLote.has(email)) Object.assign(linha, { situacao: 'ja_existe', problema: 'Repetido na lista: será ignorado.' });
    else if (!perfil) erro(perfilTexto ? `Perfil "${perfilTexto}" não encontrado.` : 'Informe o perfil (o Funcionário ainda não existe: rode Preparar estrutura).');
    else if (escopo === undefined) erro(`"${escopoTexto}" não é unidade, área nem serviço cadastrado.`);
    else if (existente) {
      const jaTem = atribuicoes
        .ativos()
        .some((a) => a.usuario_email === email && a.perfil === perfil.codigo && a.escopo_tipo === linha.escopoTipo && a.escopo === linha.escopo && (!a.fim || a.fim >= h));
      if (!existente.ativo) Object.assign(linha, { situacao: 'reativar', problema: jaTem ? 'Acesso desativado: volta a valer.' : 'Acesso desativado: volta a valer, com o perfil.' });
      else if (jaTem) Object.assign(linha, { situacao: 'ja_existe', problema: 'Já tem acesso com este perfil: será ignorado.' });
      else Object.assign(linha, { situacao: 'perfil', problema: 'Já tem acesso: só ganha o perfil.' });
    }
    if (EMAIL.test(email)) noLote.add(email);
    resultado.push(linha);
  });
  return resultado;
}

/**
 * Grava as linhas conferidas: acessos novos, reativações e perfis, cada aba
 * numa gravação só, com a auditoria por aba (quantidade, sem valores pessoais).
 * Confere tudo de novo antes: se algo mudou desde a prévia, nada é gravado.
 */
export async function cadastrarUsuariosEmLote(
  p: Planilhas,
  quem: Autorizador,
  linhas: { nome: string; email: string; perfil: string; escopoTipo: EscopoTipo; escopo: string | null }[],
  dominio: string | null,
): Promise<{ novos: number; reativados: number; perfis: number }> {
  exigir(quem, 'core.acessos.gerenciar');
  if (linhas.length === 0) throw new ErroValidacao('Não há ninguém para cadastrar.');
  const texto = linhas.map((l) => [l.nome, l.email, l.perfil, l.escopo ? `${l.escopoTipo}:${l.escopo}` : ''].join('\t')).join('\n');
  const conferidas = await analisarUsuariosEmLote(p, quem, texto, dominio);
  const mudou = conferidas.some(
    (c, i) => c.situacao === 'erro' || c.situacao === 'ja_existe' || c.perfil !== linhas[i].perfil || c.escopoTipo !== linhas[i].escopoTipo || c.escopo !== linhas[i].escopo,
  );
  if (mudou || conferidas.length !== linhas.length) throw new ErroValidacao('A lista mudou ou já foi cadastrada. Confira de novo antes de cadastrar.');

  const [usuarios, pessoas, papeis, atribuicoes] = await lerTabelas(p, [Usuarios, Pessoas, Papeis, Atribuicoes] as const);
  const autoria = { email: quem.email };
  const h = hoje();
  const novas = conferidas.filter((c) => c.situacao === 'novo');
  const reativar = conferidas.filter((c) => c.situacao === 'reativar');

  if (novas.length) {
    const gravadas = await inserirRegistros(p, pessoas, novas.map((c) => ({ nome: c.nome, email: c.email })), autoria);
    await inserirRegistros(p, papeis, gravadas.map((x) => ({ pessoa_id: x.id, papel: 'colaborador' as const, inicio: h })), autoria);
    await inserirRegistros(p, usuarios, novas.map((c, i) => ({ email: c.email, pessoa_id: gravadas[i].id })), autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Usuarios', detalhes: { lote: novas.length } });
  }
  for (const c of reativar) {
    const u = usuarios.todos().find((x) => x.email === c.email)!;
    await atualizar(p, Usuarios, u.id, u.versao, { ativo: true }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Usuarios', registroId: u.id, detalhes: { colunas: ['ativo'] } });
  }
  // Perfil para todos, menos quem já o tinha (reativado com o mesmo perfil).
  const comPerfil = conferidas.filter(
    (c) =>
      !atribuicoes
        .ativos()
        .some((a) => a.usuario_email === c.email && a.perfil === c.perfil && a.escopo_tipo === c.escopoTipo && a.escopo === c.escopo && (!a.fim || a.fim >= h)),
  );
  if (comPerfil.length) {
    await inserirRegistros(
      p,
      atribuicoes,
      comPerfil.map((c) => ({ usuario_email: c.email, perfil: c.perfil!, escopo_tipo: c.escopoTipo, escopo: c.escopo, inicio: h })),
      autoria,
    );
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Atribuicoes', detalhes: { lote: comPerfil.length } });
  }
  return { novos: novas.length, reativados: reativar.length, perfis: comPerfil.length };
}
