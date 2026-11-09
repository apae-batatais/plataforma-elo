/**
 * Casos de uso dos contatos e grupos da imprensa.
 *
 * Quem pode: `comunicacao.contatos.gerenciar` (Comunicação, coordenação e Diretoria).
 * `destinatariosDe` é interna: o agendamento a usa, sem passar por tela.
 * Nada é apagado: contato e grupo tirados ficam com ativo = FALSE; a ligação entre eles é encerrada.
 * A auditoria guarda só os nomes das colunas.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import {
  ContatoGruposComunicacao,
  ContatosComunicacao,
  GruposComunicacao,
  type RegContato,
  type RegGrupo,
} from '../dados/tabelas';
import { conferirContato, normalizarEmail } from '../dominio/contatos';
import { ErroComunicacao } from '../dominio/pedido';

const PERM = 'comunicacao.contatos.gerenciar';

interface Opcoes {
  agora?: Date;
}

export interface DadosContato {
  id?: string;
  versao?: number;
  nome: string;
  veiculo: string | null;
  email: string;
  /** Ids dos grupos do contato. */
  grupos: string[];
}

export interface DadosGrupo {
  id?: string;
  versao?: number;
  nome: string;
}

function exigir(quem: Autorizador): void {
  if (!quem.temPermissao(PERM)) throw new ErroPermissao();
}

const autoriaDe = (quem: Autorizador, agora: Date) => ({ email: quem.email, agora: () => agora });

const auditar = (p: Planilhas, quem: Autorizador, acao: 'inclusao' | 'alteracao', entidade: string, registroId: string, colunas: string[], agora: Date) =>
  registrarAuditoria(p, { usuario: quem.email, acao, entidade, registroId, detalhes: { colunas } }, agora);

export async function salvarContato(p: Planilhas, quem: Autorizador, d: DadosContato, opcoes: Opcoes = {}): Promise<{ id: string }> {
  exigir(quem);
  const agora = opcoes.agora ?? new Date();
  const [contatos, grupos, ligacoes] = await lerTabelas(p, [ContatosComunicacao, GruposComunicacao, ContatoGruposComunicacao] as const);
  const erros = conferirContato(d, contatos.ativos(), d.id);
  if (erros.length) throw new ErroComunicacao(erros.join(' '));
  const gruposAtivos = new Set(grupos.ativos().map((g) => g.id));
  const escolhidos = [...new Set(d.grupos)];
  if (escolhidos.some((g) => !gruposAtivos.has(g))) throw new ErroComunicacao('Escolha só grupos ativos.');
  const campos = { nome: d.nome.trim().replace(/\s+/g, ' '), veiculo: d.veiculo?.trim() || null, email: normalizarEmail(d.email) };
  const autoria = autoriaDe(quem, agora);

  let id: string;
  if (!d.id) {
    id = (await inserir(p, ContatosComunicacao, campos, autoria)).id;
    await auditar(p, quem, 'inclusao', 'ContatosComunicacao', id, Object.keys(campos), agora);
  } else {
    if (d.versao === undefined) throw new ErroComunicacao('Abra o contato de novo para alterar.');
    const atual = contatos.porId(d.id);
    if (!atual || !atual.ativo) throw new ErroComunicacao('Contato não encontrado.');
    id = d.id;
    const { colunasAlteradas } = await atualizar(p, ContatosComunicacao, id, d.versao, campos, autoria);
    if (colunasAlteradas.length) await auditar(p, quem, 'alteracao', 'ContatosComunicacao', id, colunasAlteradas, agora);
  }

  // Troca as ligações: encerra as que saíram e cria as que entraram (nada é apagado).
  const atuais = ligacoes.ativos().filter((l) => l.contato_id === id);
  for (const l of atuais.filter((x) => !escolhidos.includes(x.grupo_id))) {
    await atualizar(p, ContatoGruposComunicacao, l.id, l.versao, { ativo: false }, autoria);
    await auditar(p, quem, 'alteracao', 'ContatoGruposComunicacao', l.id, ['ativo'], agora);
  }
  for (const g of escolhidos.filter((g) => !atuais.some((l) => l.grupo_id === g))) {
    const nova = await inserir(p, ContatoGruposComunicacao, { contato_id: id, grupo_id: g }, autoria);
    await auditar(p, quem, 'inclusao', 'ContatoGruposComunicacao', nova.id, ['contato_id', 'grupo_id'], agora);
  }
  return { id };
}

export async function mudarSituacaoContato(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean, opcoes: Opcoes = {}): Promise<void> {
  exigir(quem);
  const agora = opcoes.agora ?? new Date();
  const [contatos] = await lerTabelas(p, [ContatosComunicacao] as const);
  const atual = contatos.porId(id);
  if (!atual) throw new ErroComunicacao('Contato não encontrado.');
  if (atual.ativo === ativo) throw new ErroComunicacao(ativo ? 'Este contato já está ativo.' : 'Este contato já está desativado.');
  // Reativar não pode repetir o e-mail de outro contato ativo.
  if (ativo) {
    const erros = conferirContato(atual, contatos.ativos(), id);
    if (erros.length) throw new ErroComunicacao(erros.join(' '));
  }
  await atualizar(p, ContatosComunicacao, id, versao, { ativo }, autoriaDe(quem, agora));
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'ContatosComunicacao', registroId: id, detalhes: { colunas: ['ativo'] } },
    agora,
  );
}

export async function salvarGrupo(p: Planilhas, quem: Autorizador, d: DadosGrupo, opcoes: Opcoes = {}): Promise<{ id: string }> {
  exigir(quem);
  const agora = opcoes.agora ?? new Date();
  const nome = d.nome.trim().replace(/\s+/g, ' ');
  if (!nome) throw new ErroComunicacao('Informe o nome do grupo.');
  const [grupos] = await lerTabelas(p, [GruposComunicacao] as const);
  if (grupos.ativos().some((g) => g.id !== d.id && g.nome.toLowerCase() === nome.toLowerCase())) throw new ErroComunicacao('Já existe um grupo com este nome.');
  const autoria = autoriaDe(quem, agora);
  if (!d.id) {
    const novo = await inserir(p, GruposComunicacao, { nome }, autoria);
    await auditar(p, quem, 'inclusao', 'GruposComunicacao', novo.id, ['nome'], agora);
    return { id: novo.id };
  }
  if (d.versao === undefined) throw new ErroComunicacao('Abra o grupo de novo para alterar.');
  const { colunasAlteradas } = await atualizar(p, GruposComunicacao, d.id, d.versao, { nome }, autoria);
  if (colunasAlteradas.length) await auditar(p, quem, 'alteracao', 'GruposComunicacao', d.id, colunasAlteradas, agora);
  return { id: d.id };
}

export async function mudarSituacaoGrupo(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean, opcoes: Opcoes = {}): Promise<void> {
  exigir(quem);
  const agora = opcoes.agora ?? new Date();
  const [grupos] = await lerTabelas(p, [GruposComunicacao] as const);
  const atual = grupos.porId(id);
  if (!atual) throw new ErroComunicacao('Grupo não encontrado.');
  if (atual.ativo === ativo) throw new ErroComunicacao(ativo ? 'Este grupo já está ativo.' : 'Este grupo já está desativado.');
  await atualizar(p, GruposComunicacao, id, versao, { ativo }, autoriaDe(quem, agora));
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'GruposComunicacao', registroId: id, detalhes: { colunas: ['ativo'] } },
    agora,
  );
}

export async function listarContatos(
  p: Planilhas,
  quem: Autorizador,
): Promise<{ grupos: Array<RegGrupo & { contatos: number }>; contatos: Array<RegContato & { grupos: string[] }> }> {
  exigir(quem);
  const [contatos, grupos, ligacoes] = await lerTabelas(p, [ContatosComunicacao, GruposComunicacao, ContatoGruposComunicacao] as const);
  const ativos = new Set(contatos.ativos().map((c) => c.id));
  const gruposAtivos = new Set(grupos.ativos().map((g) => g.id));
  const lig = ligacoes.ativos();
  return {
    grupos: grupos
      .todos()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((g) => ({ ...g, contatos: lig.filter((l) => l.grupo_id === g.id && ativos.has(l.contato_id)).length })),
    contatos: contatos
      .todos()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((c) => ({ ...c, grupos: lig.filter((l) => l.contato_id === c.id && gruposAtivos.has(l.grupo_id)).map((l) => l.grupo_id) })),
  };
}

/**
 * E-mails de quem recebe: contatos ativos escolhidos um a um e os ativos dos grupos ativos escolhidos.
 * Sem repetir (maiúsculas não contam), em minúsculas e em ordem. Uso interno: quem chama já conferiu a permissão.
 */
export async function destinatariosDe(p: Planilhas, d: { grupos: string[]; contatos: string[] }): Promise<string[]> {
  const [contatos, grupos, ligacoes] = await lerTabelas(p, [ContatosComunicacao, GruposComunicacao, ContatoGruposComunicacao] as const);
  const gruposAtivos = new Set(grupos.ativos().filter((g) => d.grupos.includes(g.id)).map((g) => g.id));
  const ids = new Set(d.contatos);
  for (const l of ligacoes.ativos()) if (gruposAtivos.has(l.grupo_id)) ids.add(l.contato_id);
  const emails = contatos
    .ativos()
    .filter((c) => ids.has(c.id))
    .map((c) => normalizarEmail(c.email));
  return [...new Set(emails)].sort();
}

/** Grupos e contatos ativos para escolher ao agendar (quem agenda, não só quem gerencia a lista). */
export async function opcoesDeDestinatarios(
  p: Planilhas,
  quem: Autorizador,
): Promise<{ grupos: Array<{ id: string; nome: string }>; contatos: Array<{ id: string; rotulo: string }> }> {
  if (!quem.temPermissao('comunicacao.revisar')) throw new ErroPermissao();
  const [contatos, grupos] = await lerTabelas(p, [ContatosComunicacao, GruposComunicacao] as const);
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');
  return {
    grupos: grupos.ativos().sort(porNome).map((g) => ({ id: g.id, nome: g.nome })),
    contatos: contatos
      .ativos()
      .sort(porNome)
      .map((c) => ({ id: c.id, rotulo: c.veiculo ? `${c.nome} · ${c.veiculo}` : c.nome })),
  };
}
