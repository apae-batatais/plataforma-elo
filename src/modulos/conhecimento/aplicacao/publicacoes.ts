/**
 * Publicações da Base de Conhecimento: criar, editar, arquivar, ler, dar ciência, "Meus documentos",
 * acompanhamento e pendências.
 *
 * Quem pode: `conhecimento.publicar` grava publicações; `conhecimento.acompanhar` vê quem está em dia;
 * o público-alvo lê e dá ciência (regra 4). A ciência é gravada com o usuário da sessão e a hora do
 * servidor, uma única vez por edição. Nada é apagado. A auditoria guarda só os nomes das colunas.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Pessoas, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  CategoriasConhecimento,
  CienciasConhecimento,
  PublicacoesConhecimento,
  type RegPublicacao,
} from '../dados/tabelas';
import {
  conferirAnexo,
  conferirPublicacao,
  ErroConhecimento,
  limparNomeArquivo,
  pendenciaVencida,
  situacaoDaPessoa,
  type PublicoTipo,
  type SituacaoDaPessoa,
} from '../dominio/publicacao';
import { auditar, autoriaDe, carregarPublico, PERM, type Opcoes } from './base';

export interface DadosPublicacao {
  id?: string;
  versao?: number;
  titulo: string;
  categoria: string;
  resumo: string | null;
  corpo: string | null;
  publicoTipo: PublicoTipo;
  publicoValor: string | null;
  exigeCiencia: boolean;
  /** Indefinido mantém o anexo; `null` tira; objeto troca (arquivo já enviado à pasta de anexos). */
  anexo?: { arquivoId: string; nome?: string } | null;
  /** Rascunho vira publicada; publicada continua publicada. */
  publicar: boolean;
  /** Regra 7: obrigatório ao mudar o corpo de uma publicação que já tem ciências. */
  tipoEdicao?: 'pequena' | 'nova';
}

const exigirPublicar = (quem: Autorizador) => {
  if (!quem.temPermissao(PERM.publicar)) throw new ErroPermissao();
};

async function nomeDoUsuario(p: Planilhas, email: string): Promise<string> {
  return (await nomesDasPessoas(p, [email])).get(email) ?? email.split('@')[0];
}

async function nomesDasPessoas(p: Planilhas, emails: string[]): Promise<Map<string, string>> {
  const [usuarios, pessoas] = await lerTabelas(p, [Usuarios, Pessoas] as const);
  const nomes = new Map<string, string>();
  for (const e of emails) {
    const u = usuarios.todos().find((x) => x.email === e);
    const nome = u?.pessoa_id ? pessoas.porId(u.pessoa_id)?.nome : undefined;
    nomes.set(e, nome ?? e.split('@')[0]);
  }
  return nomes;
}

/** Salva rascunho ou publicação (regras 1, 2, 5 e 7). */
export async function salvarPublicacao(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  d: DadosPublicacao,
  opcoes: Opcoes = {},
): Promise<{ id: string; edicao: number }> {
  exigirPublicar(quem);
  const agora = opcoes.agora ?? new Date();
  const [categorias, publicacoes, ciencias] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento] as const);
  const atual = d.id ? publicacoes.porId(d.id) : undefined;
  if (d.id && (!atual || !atual.ativo)) throw new ErroConhecimento('Publicação não encontrada.');
  if (atual && d.versao === undefined) throw new ErroConhecimento('Abra a publicação de novo para alterar.');

  // Anexo final: o que já estava, o novo ou nenhum.
  let anexo = atual && d.anexo === undefined ? { id: atual.anexo_id, nome: atual.anexo_nome, mime: atual.anexo_mime, tamanho: atual.anexo_tamanho } : null;
  if (d.anexo) {
    if (!arquivos) throw new ErroConhecimento('Anexos ainda não estão ativos nesta instituição. Salve só com o texto.');
    const f = await arquivos.conferir(d.anexo.arquivoId);
    if (!f) throw new ErroConhecimento('O arquivo não chegou à pasta de anexos. Envie de novo.');
    const erros = conferirAnexo({ mime: f.tipo, tamanho: f.tamanho });
    if (erros.length) throw new ErroConhecimento(erros.join(' '));
    const emOutra = publicacoes.ativos().some((x) => x.id !== d.id && x.anexo_id === f.id);
    if (emOutra) throw new ErroConhecimento('Este arquivo já pertence a outra publicação.');
    anexo = { id: f.id, nome: limparNomeArquivo(d.anexo.nome, f.nome), mime: f.tipo, tamanho: f.tamanho };
  }

  const corpo = d.corpo?.trim() || null;
  const erros = conferirPublicacao(
    {
      titulo: d.titulo,
      categoria: d.categoria,
      resumo: d.resumo?.trim() || null,
      corpo,
      temAnexo: Boolean(anexo?.id),
      publicoTipo: d.publicoTipo,
      publicoValor: d.publicoValor,
    },
    new Set(categorias.ativos().map((c) => c.codigo)),
  );
  if (erros.length) throw new ErroConhecimento(erros.join(' '));

  // Regra 7: corpo mudou numa publicação que já tem ciência na edição atual → escolha explícita.
  let edicao = atual?.edicao ?? 1;
  let edicaoEm = atual?.edicao_em ?? null;
  const corpoMudou = Boolean(atual) && (atual!.corpo ?? '') !== (corpo ?? '');
  const jaTemCiencia = Boolean(atual) && ciencias.ativos().some((c) => c.publicacao_id === atual!.id && c.edicao === atual!.edicao);
  if (corpoMudou && jaTemCiencia) {
    if (!d.tipoEdicao) throw new ErroConhecimento('Escolha se é uma correção pequena (as ciências continuam valendo) ou uma nova versão (todos dão ciência de novo).');
    if (d.tipoEdicao === 'nova') {
      edicao += 1;
      edicaoEm = agora.toISOString();
    }
  }

  const publicando = d.publicar && (!atual || atual.situacao === 'rascunho');
  const situacao = atual ? (publicando ? 'publicada' : atual.situacao) : publicando ? 'publicada' : 'rascunho';
  if (publicando) edicaoEm = agora.toISOString();
  const campos = {
    titulo: d.titulo.trim().replace(/\s+/g, ' '),
    categoria: d.categoria,
    resumo: d.resumo?.trim() || null,
    corpo,
    anexo_id: anexo?.id ?? null,
    anexo_nome: anexo?.nome ?? null,
    anexo_mime: anexo?.mime ?? null,
    anexo_tamanho: anexo?.tamanho ?? null,
    publico_tipo: d.publicoTipo,
    publico_valor: d.publicoTipo === 'todos' ? null : d.publicoValor,
    exige_ciencia: d.exigeCiencia,
    edicao,
    edicao_em: edicaoEm ?? agora.toISOString(),
    situacao,
    publicada_em: publicando ? agora.toISOString() : (atual?.publicada_em ?? null),
  } as const;
  const autoria = autoriaDe(quem, agora);

  if (!atual) {
    const nova = await inserir(p, PublicacoesConhecimento, { ...campos, autor: quem.email, autor_nome: await nomeDoUsuario(p, quem.email) }, autoria);
    await auditar(p, quem, 'inclusao', 'PublicacoesConhecimento', nova.id, Object.keys(campos), agora);
    return { id: nova.id, edicao };
  }
  const { colunasAlteradas } = await atualizar(p, PublicacoesConhecimento, atual.id, d.versao!, campos, autoria);
  if (colunasAlteradas.length) await auditar(p, quem, 'alteracao', 'PublicacoesConhecimento', atual.id, colunasAlteradas, agora);
  return { id: atual.id, edicao };
}

/** Regra 6: arquivar (some das listas e das pendências) e reativar. Rascunho não se arquiva. */
export async function mudarArquivamento(p: Planilhas, quem: Autorizador, id: string, versao: number, arquivar: boolean, opcoes: Opcoes = {}): Promise<void> {
  exigirPublicar(quem);
  const agora = opcoes.agora ?? new Date();
  const [publicacoes] = await lerTabelas(p, [PublicacoesConhecimento] as const);
  const atual = publicacoes.porId(id);
  if (!atual || !atual.ativo) throw new ErroConhecimento('Publicação não encontrada.');
  if (arquivar && atual.situacao !== 'publicada') throw new ErroConhecimento('Só uma publicação publicada pode ser arquivada.');
  if (!arquivar && atual.situacao !== 'arquivada') throw new ErroConhecimento('Esta publicação não está arquivada.');
  await atualizar(p, PublicacoesConhecimento, id, versao, { situacao: arquivar ? 'arquivada' : 'publicada' }, autoriaDe(quem, agora));
  await auditar(p, quem, arquivar ? 'encerramento' : 'alteracao', 'PublicacoesConhecimento', id, ['situacao'], agora);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface ResumoPublicacao {
  id: string;
  titulo: string;
  categoria: string;
  categoriaNome: string;
  resumo: string | null;
  situacao: RegPublicacao['situacao'];
  exigeCiencia: boolean;
  edicao: number;
  publicadaEm: string | null;
  autorNome: string;
  /** A pessoa é do público-alvo? Editor de fora do público só lê. */
  doPublico: boolean;
  minhaSituacao: SituacaoDaPessoa;
  minhaCienciaEm: string | null;
  vencida: boolean;
}

async function contexto(p: Planilhas, quem: Autorizador, agora: Date) {
  const [categorias, publicacoes, ciencias] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento] as const);
  const publico = await carregarPublico(p, agora);
  const nomeCategoria = new Map(categorias.todos().map((c) => [c.codigo, c.nome]));
  const ativas = ciencias.ativos();
  const editor = quem.temPermissao(PERM.publicar);

  const resumir = (x: RegPublicacao): ResumoPublicacao => {
    const doPublico = publico.membros(x).includes(quem.email);
    const minhas = ativas.filter((c) => c.publicacao_id === x.id && c.usuario === quem.email);
    const situacao = doPublico ? situacaoDaPessoa(x.exige_ciencia, x.edicao, minhas.map((c) => c.edicao)) : 'sem_exigencia';
    const daEdicao = minhas.find((c) => c.edicao === x.edicao) ?? minhas.sort((a, b) => b.edicao - a.edicao)[0];
    return {
      id: x.id,
      titulo: x.titulo,
      categoria: x.categoria,
      categoriaNome: nomeCategoria.get(x.categoria) ?? x.categoria,
      resumo: x.resumo,
      situacao: x.situacao,
      exigeCiencia: x.exige_ciencia,
      edicao: x.edicao,
      publicadaEm: x.publicada_em,
      autorNome: x.autor_nome,
      doPublico,
      minhaSituacao: situacao,
      minhaCienciaEm: daEdicao?.registrada_em ?? null,
      vencida: (situacao === 'pendente' || situacao === 'precisa_renovar') && pendenciaVencida(x.edicao_em ?? x.publicada_em ?? x.criado_em, agora),
    };
  };
  return { publicacoes: publicacoes.ativos(), ciencias: ativas, publico, resumir, editor, nomeCategoria };
}

const exigirAcesso = (quem: Autorizador) => {
  if (!quem.temPermissaoAlgumEscopo(PERM.acessar)) throw new ErroPermissao();
};

/** Biblioteca: publicações publicadas do público da pessoa (e todas, para quem publica). Pendentes primeiro. */
export async function listarBiblioteca(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<ResumoPublicacao[]> {
  exigirAcesso(quem);
  const c = await contexto(p, quem, opcoes.agora ?? new Date());
  const lista = c.publicacoes.filter((x) => x.situacao === 'publicada').map(c.resumir).filter((r) => r.doPublico || c.editor);
  const peso = (r: ResumoPublicacao) => (r.minhaSituacao === 'pendente' || r.minhaSituacao === 'precisa_renovar' ? 0 : 1);
  return lista.sort((a, b) => peso(a) - peso(b) || (b.publicadaEm ?? '').localeCompare(a.publicadaEm ?? ''));
}

/** Regra 18: "Meus documentos": o que exige ciência do público da pessoa; pendentes primeiro. */
export async function meusDocumentos(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<ResumoPublicacao[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ler)) throw new ErroPermissao();
  const c = await contexto(p, quem, opcoes.agora ?? new Date());
  const lista = c.publicacoes
    .filter((x) => x.exige_ciencia && x.situacao !== 'rascunho')
    .map(c.resumir)
    // Arquivada só fica para quem já deu ciência (regra 6).
    .filter((r) => r.doPublico && (r.situacao === 'publicada' || r.minhaCienciaEm));
  const peso = (r: ResumoPublicacao) => (r.minhaSituacao === 'pendente' || r.minhaSituacao === 'precisa_renovar' ? 0 : 1);
  return lista.sort((a, b) => peso(a) - peso(b) || (b.publicadaEm ?? '').localeCompare(a.publicadaEm ?? ''));
}

/** Regra 20: pendências da pessoa para a tela inicial. */
export async function pendenciasDaPessoa(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}) {
  const lista = (await meusDocumentos(p, quem, opcoes)).filter((r) => r.situacao === 'publicada' && (r.minhaSituacao === 'pendente' || r.minhaSituacao === 'precisa_renovar'));
  return { total: lista.length, vencidas: lista.filter((r) => r.vencida).length, itens: lista };
}

export interface DetalhePublicacao extends ResumoPublicacao {
  versao: number;
  corpo: string | null;
  anexoNome: string | null;
  anexoTipo: 'pdf' | 'imagem' | null;
  publicoTipo: PublicoTipo;
  publicoValor: string | null;
  /** Há ciência a dar agora? */
  podeDarCiencia: boolean;
}

/** Abre uma publicação: só quem é do público (ou quem publica); rascunho só quem publica (regra 4). */
export async function lerPublicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}): Promise<DetalhePublicacao> {
  exigirAcesso(quem);
  const c = await contexto(p, quem, opcoes.agora ?? new Date());
  const x = c.publicacoes.find((y) => y.id === id);
  const negado = () => new ErroPermissao('Esta publicação não é para o seu perfil.');
  if (!x) throw new ErroConhecimento('Publicação não encontrada.');
  const r = c.resumir(x);
  if (!c.editor) {
    if (x.situacao === 'rascunho' || !r.doPublico) throw negado();
    if (x.situacao === 'arquivada' && !r.minhaCienciaEm) throw negado();
  }
  return {
    ...r,
    versao: x.versao,
    corpo: x.corpo,
    anexoNome: x.anexo_id ? (x.anexo_nome ?? 'Anexo') : null,
    anexoTipo: x.anexo_mime ? (x.anexo_mime.includes('pdf') ? 'pdf' : 'imagem') : null,
    publicoTipo: x.publico_tipo,
    publicoValor: x.publico_valor,
    podeDarCiencia: x.situacao === 'publicada' && r.doPublico && (r.minhaSituacao === 'pendente' || r.minhaSituacao === 'precisa_renovar'),
  };
}

/** Regras 9 e 10: registra a ciência da edição atual; repetir na mesma edição não cria outra linha. */
export async function darCiencia(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}): Promise<{ jaRegistrada: boolean }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ler)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const c = await contexto(p, quem, agora);
  const x = c.publicacoes.find((y) => y.id === id);
  if (!x) throw new ErroConhecimento('Publicação não encontrada.');
  if (!c.publico.membros(x).includes(quem.email)) throw new ErroPermissao('Esta publicação não é para o seu perfil.');
  if (x.situacao !== 'publicada') throw new ErroConhecimento('Esta publicação não está aberta para ciência.');
  if (!x.exige_ciencia) throw new ErroConhecimento('Esta publicação não pede ciência.');
  if (c.ciencias.some((y) => y.publicacao_id === id && y.usuario === quem.email && y.edicao === x.edicao)) return { jaRegistrada: true };
  const nova = await inserir(p, CienciasConhecimento, { publicacao_id: id, edicao: x.edicao, usuario: quem.email, registrada_em: agora.toISOString() }, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'CienciasConhecimento', nova.id, ['publicacao_id', 'edicao', 'usuario', 'registrada_em'], agora);
  return { jaRegistrada: false };
}

// ---------------------------------------------------------------------------
// Publicações (editor) e acompanhamento
// ---------------------------------------------------------------------------

export interface LinhaDePublicacao {
  id: string;
  versao: number;
  titulo: string;
  categoriaNome: string;
  situacao: RegPublicacao['situacao'];
  exigeCiencia: boolean;
  edicao: number;
  publico: string;
  emDia: number;
  total: number;
  atualizadaEm: string;
}

function descreverPublico(x: RegPublicacao): string {
  return x.publico_tipo === 'todos' ? 'Todos' : x.publico_tipo === 'perfil' ? `Perfil: ${x.publico_valor}` : `Área: ${x.publico_valor}`;
}

async function linhas(p: Planilhas, agora: Date): Promise<LinhaDePublicacao[]> {
  const [categorias, publicacoes, ciencias] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento] as const);
  const publico = await carregarPublico(p, agora);
  const nomeCategoria = new Map(categorias.todos().map((c) => [c.codigo, c.nome]));
  const ativas = ciencias.ativos();
  return publicacoes.ativos().map((x) => {
    const membros = x.situacao === 'rascunho' ? [] : publico.membros(x);
    const emDia = x.exige_ciencia ? membros.filter((m) => ativas.some((c) => c.publicacao_id === x.id && c.usuario === m && c.edicao === x.edicao)).length : 0;
    return {
      id: x.id,
      versao: x.versao,
      titulo: x.titulo,
      categoriaNome: nomeCategoria.get(x.categoria) ?? x.categoria,
      situacao: x.situacao,
      exigeCiencia: x.exige_ciencia,
      edicao: x.edicao,
      publico: descreverPublico(x),
      emDia,
      total: x.exige_ciencia ? membros.length : 0,
      atualizadaEm: x.atualizado_em,
    };
  });
}

/** Lista de quem publica: todas as publicações (rascunho, publicada, arquivada), as mais recentes primeiro. */
export async function listarPublicacoes(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<LinhaDePublicacao[]> {
  exigirPublicar(quem);
  return (await linhas(p, opcoes.agora ?? new Date())).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

/** Dados para editar uma publicação (só quem publica); o código do anexo nunca sai. */
export async function publicacaoParaEditar(p: Planilhas, quem: Autorizador, id: string) {
  exigirPublicar(quem);
  const [publicacoes, ciencias] = await lerTabelas(p, [PublicacoesConhecimento, CienciasConhecimento] as const);
  const x = publicacoes.porId(id);
  if (!x || !x.ativo) throw new ErroConhecimento('Publicação não encontrada.');
  return {
    id: x.id,
    versao: x.versao,
    titulo: x.titulo,
    categoria: x.categoria,
    resumo: x.resumo,
    corpo: x.corpo,
    publicoTipo: x.publico_tipo,
    publicoValor: x.publico_valor,
    exigeCiencia: x.exige_ciencia,
    situacao: x.situacao,
    anexoNome: x.anexo_id ? (x.anexo_nome ?? 'Anexo') : null,
    /** Quantas pessoas já deram ciência na edição atual (a janela da regra 7 mostra o número). */
    comCiencia: ciencias.ativos().filter((c) => c.publicacao_id === x.id && c.edicao === x.edicao).length,
  };
}

/** Regra 19: publicações que exigem ciência, com "X de Y em dia" (`conhecimento.acompanhar`). */
export async function listarAcompanhamento(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<LinhaDePublicacao[]> {
  if (!quem.temPermissao(PERM.acompanhar)) throw new ErroPermissao();
  return (await linhas(p, opcoes.agora ?? new Date()))
    .filter((l) => l.exigeCiencia && l.situacao !== 'rascunho')
    .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

export interface PessoaAcompanhada {
  email: string;
  nome: string;
  situacao: SituacaoDaPessoa;
  cienciaEm: string | null;
}

/**
 * Regra 19: cada pessoa do público com a situação e a data da ciência. A consulta é auditada como leitura.
 * Quem já deu ciência mas saiu do público continua na lista (o registro não some).
 */
export async function acompanharPublicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}) {
  if (!quem.temPermissao(PERM.acompanhar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [publicacoes, ciencias] = await lerTabelas(p, [PublicacoesConhecimento, CienciasConhecimento] as const);
  const x = publicacoes.porId(id);
  if (!x || !x.ativo || x.situacao === 'rascunho' || !x.exige_ciencia) throw new ErroConhecimento('Publicação não encontrada ou sem ciência exigida.');
  const publico = await carregarPublico(p, agora);
  const doPublico = publico.membros(x);
  const daPublicacao = ciencias.ativos().filter((c) => c.publicacao_id === id);
  const emails = [...new Set([...doPublico, ...daPublicacao.map((c) => c.usuario)])];
  const nomes = await nomesDasPessoas(p, emails);
  const pessoas: PessoaAcompanhada[] = emails.map((email) => {
    const minhas = daPublicacao.filter((c) => c.usuario === email);
    const atual = minhas.find((c) => c.edicao === x.edicao);
    const ultima = atual ?? [...minhas].sort((a, b) => b.edicao - a.edicao)[0];
    return {
      email,
      nome: nomes.get(email) ?? email,
      situacao: situacaoDaPessoa(true, x.edicao, minhas.map((c) => c.edicao)),
      cienciaEm: ultima?.registrada_em ?? null,
    };
  });
  await auditar(p, quem, 'leitura', 'CienciasConhecimento', id, ['usuario', 'registrada_em'], agora);
  const ordem = { pendente: 0, precisa_renovar: 1, em_dia: 2, sem_exigencia: 3 } as const;
  pessoas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { id: x.id, titulo: x.titulo, edicao: x.edicao, emDia: pessoas.filter((s) => s.situacao === 'em_dia').length, total: doPublico.length, pessoas };
}
