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
import { Areas, Perfis, Pessoas, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  CategoriasConhecimento,
  CienciasConhecimento,
  PerguntasConhecimento,
  PublicacoesConhecimento,
  TentativasTeste,
  type RegPergunta,
  type RegPublicacao,
} from '../dados/tabelas';
import {
  conferirAnexo,
  conferirPerguntas,
  conferirPublicacao,
  ErroConhecimento,
  limparNomeArquivo,
  type PerguntaEntrada,
  pendenciaVencida,
  situacaoDaPessoa,
  type PublicoTipo,
  type SituacaoDaPessoa,
} from '../dominio/publicacao';
import { agendarAviso, type ResultadoDoAviso } from './avisos';
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
  temTeste: boolean;
  /** Perguntas do teste (regra 12). Indefinido mantém as atuais. */
  perguntas?: PerguntaEntrada[];
  /** Indefinido mantém o anexo; `null` tira; objeto troca (arquivo já enviado à pasta de anexos). */
  anexo?: { arquivoId: string; nome?: string } | null;
  /** Rascunho vira publicada; publicada continua publicada. */
  publicar: boolean;
  /** Regra 7: obrigatório ao mudar o corpo ou o teste de uma publicação que já tem ciências ou tentativas. */
  tipoEdicao?: 'pequena' | 'nova';
}

const exigirPublicar = (quem: Autorizador) => {
  if (!quem.temPermissao(PERM.publicar)) throw new ErroPermissao();
};

export async function nomeDoUsuario(p: Planilhas, email: string): Promise<string> {
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

const porOrdem = (a: RegPergunta, b: RegPergunta) => a.ordem - b.ordem;

export const opcoesDaPergunta = (q: RegPergunta): string[] => {
  try {
    const v = JSON.parse(q.opcoes) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

const paraEntrada = (q: RegPergunta): PerguntaEntrada => ({ texto: q.texto, opcoes: opcoesDaPergunta(q), correta: q.correta });
const normalizar = (l: readonly PerguntaEntrada[]) => JSON.stringify(l.map((q) => ({ t: q.texto.trim(), o: q.opcoes.map((x) => x.trim()), c: q.correta })));

/** Salva rascunho ou publicação (regras 1, 2, 5, 7 e 12). */
export async function salvarPublicacao(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  d: DadosPublicacao,
  opcoes: Opcoes = {},
): Promise<{ id: string; edicao: number; aviso: ResultadoDoAviso }> {
  exigirPublicar(quem);
  const agora = opcoes.agora ?? new Date();
  const [categorias, publicacoes, ciencias, todasPerguntas, tentativas] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento, PerguntasConhecimento, TentativasTeste] as const);
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

  // Regra 12: perguntas do teste. Rascunho aceita teste ainda vazio; publicada exige ao menos uma.
  const perguntasAtuais = atual ? todasPerguntas.ativos().filter((q) => q.publicacao_id === atual.id && q.edicao === atual.edicao).sort(porOrdem) : [];
  const perguntas = (d.perguntas ?? perguntasAtuais.map(paraEntrada)).map((q) => ({ ...q, texto: q.texto.trim(), opcoes: q.opcoes.map((o) => o.trim()) }));
  const vaiPublicada = d.publicar || atual?.situacao === 'publicada' || atual?.situacao === 'arquivada';
  if (d.temTeste) {
    const errosTeste = conferirPerguntas(perguntas, vaiPublicada);
    if (errosTeste.length) throw new ErroConhecimento(errosTeste.join(' '));
  }
  const testeMudou = Boolean(atual) && (atual!.tem_teste !== d.temTeste || (d.temTeste && normalizar(perguntas) !== normalizar(perguntasAtuais.map(paraEntrada))));

  // Regra 7: corpo ou teste mudou numa publicação que já tem ciência ou tentativa na edição atual → escolha explícita.
  let edicao = atual?.edicao ?? 1;
  let edicaoEm = atual?.edicao_em ?? null;
  const corpoMudou = Boolean(atual) && (atual!.corpo ?? '') !== (corpo ?? '');
  const jaTemCiencia =
    Boolean(atual) &&
    (ciencias.ativos().some((c) => c.publicacao_id === atual!.id && c.edicao === atual!.edicao) ||
      tentativas.ativos().some((t) => t.publicacao_id === atual!.id && t.edicao === atual!.edicao));
  if ((corpoMudou || testeMudou) && jaTemCiencia) {
    if (!d.tipoEdicao) throw new ErroConhecimento('Escolha se é uma correção pequena (as ciências e aprovações continuam valendo) ou uma nova versão (todos dão ciência de novo).');
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
    tem_teste: d.temTeste,
    edicao,
    edicao_em: edicaoEm ?? agora.toISOString(),
    situacao,
    publicada_em: publicando ? agora.toISOString() : (atual?.publicada_em ?? null),
  } as const;
  const autoria = autoriaDe(quem, agora);

  // Grava as perguntas da edição: edição nova começa com as suas; na mesma edição, as antigas são desativadas.
  const gravarPerguntas = async (id: string) => {
    const edicaoMudou = Boolean(atual) && edicao !== atual!.edicao;
    if (!d.temTeste || (atual && !testeMudou && !edicaoMudou)) return;
    if (!edicaoMudou) for (const q of perguntasAtuais) await atualizar(p, PerguntasConhecimento, q.id, q.versao, { ativo: false }, autoria);
    for (const [i, q] of perguntas.entries())
      await inserir(p, PerguntasConhecimento, { publicacao_id: id, edicao, ordem: i + 1, texto: q.texto, opcoes: JSON.stringify(q.opcoes), correta: q.correta }, autoria);
    await auditar(p, quem, 'alteracao', 'PerguntasConhecimento', id, ['texto', 'opcoes', 'correta'], agora);
  };

  // Regras 21 e 22: aviso por e-mail ao publicar e a cada nova versão de publicação aberta. A falha em agendar não desfaz a publicação.
  const avisar = async (id: string): Promise<ResultadoDoAviso> => {
    if (situacao !== 'publicada' || !(publicando || edicao !== (atual?.edicao ?? edicao))) return 'nao_se_aplica';
    try {
      return await agendarAviso(p, quem.email, { id, exige_ciencia: d.exigeCiencia, tem_teste: d.temTeste }, edicao, opcoes.emailDisponivel, agora);
    } catch {
      return 'nao_se_aplica';
    }
  };

  if (!atual) {
    const nova = await inserir(p, PublicacoesConhecimento, { ...campos, autor: quem.email, autor_nome: await nomeDoUsuario(p, quem.email) }, autoria);
    await auditar(p, quem, 'inclusao', 'PublicacoesConhecimento', nova.id, Object.keys(campos), agora);
    await gravarPerguntas(nova.id);
    return { id: nova.id, edicao, aviso: await avisar(nova.id) };
  }
  const { colunasAlteradas } = await atualizar(p, PublicacoesConhecimento, atual.id, d.versao!, campos, autoria);
  if (colunasAlteradas.length) await auditar(p, quem, 'alteracao', 'PublicacoesConhecimento', atual.id, colunasAlteradas, agora);
  await gravarPerguntas(atual.id);
  return { id: atual.id, edicao, aviso: await avisar(atual.id) };
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
  temTeste: boolean;
  edicao: number;
  publicadaEm: string | null;
  autorNome: string;
  /** A pessoa é do público-alvo? Editor de fora do público só lê. */
  doPublico: boolean;
  minhaSituacao: SituacaoDaPessoa;
  minhaCienciaEm: string | null;
  /** Data da aprovação no teste (da edição atual, ou da mais recente). */
  minhaAprovacaoEm: string | null;
  vencida: boolean;
}

async function contexto(p: Planilhas, quem: Autorizador, agora: Date) {
  const [categorias, publicacoes, ciencias, tentativas] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento, TentativasTeste] as const);
  const publico = await carregarPublico(p, agora);
  const nomeCategoria = new Map(categorias.todos().map((c) => [c.codigo, c.nome]));
  const ativas = ciencias.ativos();
  const aprovadas = tentativas.ativos().filter((t) => t.aprovada);
  const editor = quem.temPermissao(PERM.publicar);

  const resumir = (x: RegPublicacao): ResumoPublicacao => {
    const doPublico = publico.membros(x).includes(quem.email);
    const minhas = ativas.filter((c) => c.publicacao_id === x.id && c.usuario === quem.email);
    const minhasAprovadas = aprovadas.filter((t) => t.publicacao_id === x.id && t.usuario === quem.email);
    const situacao = doPublico ? situacaoDaPessoa(x.exige_ciencia, x.edicao, minhas.map((c) => c.edicao), { tem: x.tem_teste, edicoesAprovadas: minhasAprovadas.map((t) => t.edicao) }) : 'sem_exigencia';
    const aprovacao = minhasAprovadas.find((t) => t.edicao === x.edicao) ?? [...minhasAprovadas].sort((a, b) => b.edicao - a.edicao)[0];
    const daEdicao = minhas.find((c) => c.edicao === x.edicao) ?? minhas.sort((a, b) => b.edicao - a.edicao)[0];
    return {
      id: x.id,
      titulo: x.titulo,
      categoria: x.categoria,
      categoriaNome: nomeCategoria.get(x.categoria) ?? x.categoria,
      resumo: x.resumo,
      situacao: x.situacao,
      exigeCiencia: x.exige_ciencia,
      temTeste: x.tem_teste,
      edicao: x.edicao,
      publicadaEm: x.publicada_em,
      autorNome: x.autor_nome,
      doPublico,
      minhaSituacao: situacao,
      minhaCienciaEm: daEdicao?.registrada_em ?? null,
      minhaAprovacaoEm: aprovacao?.feita_em ?? null,
      vencida: (situacao === 'pendente' || situacao === 'precisa_renovar') && pendenciaVencida(x.edicao_em ?? x.publicada_em ?? x.criado_em, agora),
    };
  };
  return { publicacoes: publicacoes.ativos(), ciencias: ativas, aprovadas, publico, resumir, editor, nomeCategoria };
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
    .filter((x) => (x.exige_ciencia || x.tem_teste) && x.situacao !== 'rascunho')
    .map(c.resumir)
    // Arquivada só fica para quem já deu ciência (regra 6).
    .filter((r) => r.doPublico && (r.situacao === 'publicada' || r.minhaCienciaEm || r.minhaAprovacaoEm));
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
  /** Regra 11: ciência e teste juntos; a ciência espera a aprovação. */
  cienciaEsperaTeste: boolean;
  /** Há teste a fazer agora (aprovação ainda não registrada na edição atual)? */
  podeFazerTeste: boolean;
  /** Perguntas sem o gabarito; só para quem é do público e vê a publicação aberta. */
  perguntas: { ordem: number; texto: string; opcoes: string[] }[];
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
    if (x.situacao === 'arquivada' && !r.minhaCienciaEm && !r.minhaAprovacaoEm) throw negado();
  }
  const aprovadoAgora = c.aprovadas.some((t) => t.publicacao_id === x.id && t.usuario === quem.email && t.edicao === x.edicao);
  const aberta = x.situacao === 'publicada' && r.doPublico;
  const perguntas = x.tem_teste && r.doPublico && x.situacao !== 'rascunho' ? await perguntasSemGabarito(p, x) : [];
  return {
    ...r,
    versao: x.versao,
    corpo: x.corpo,
    anexoNome: x.anexo_id ? (x.anexo_nome ?? 'Anexo') : null,
    anexoTipo: x.anexo_mime ? (x.anexo_mime.includes('pdf') ? 'pdf' : 'imagem') : null,
    publicoTipo: x.publico_tipo,
    publicoValor: x.publico_valor,
    podeDarCiencia:
      aberta && x.exige_ciencia && !c.ciencias.some((y) => y.publicacao_id === x.id && y.usuario === quem.email && y.edicao === x.edicao) && (!x.tem_teste || aprovadoAgora),
    cienciaEsperaTeste: x.exige_ciencia && x.tem_teste && !aprovadoAgora,
    podeFazerTeste: aberta && x.tem_teste && !aprovadoAgora && perguntas.length > 0,
    perguntas,
  };
}

async function perguntasSemGabarito(p: Planilhas, x: RegPublicacao) {
  const [perguntas] = await lerTabelas(p, [PerguntasConhecimento] as const);
  return perguntas
    .ativos()
    .filter((q) => q.publicacao_id === x.id && q.edicao === x.edicao)
    .sort(porOrdem)
    .map((q) => ({ ordem: q.ordem, texto: q.texto, opcoes: opcoesDaPergunta(q) }));
}

/** Regras 9 a 11: registra a ciência da edição atual; repetir na mesma edição não cria outra linha. */
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
  // Regra 11: com teste, a ciência só vale depois da aprovação na edição atual.
  if (x.tem_teste && !c.aprovadas.some((t) => t.publicacao_id === id && t.usuario === quem.email && t.edicao === x.edicao))
    throw new ErroConhecimento('Acerte todas as perguntas do teste antes de dar ciência.');
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
  temTeste: boolean;
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
  const [categorias, publicacoes, ciencias, tentativas] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento, TentativasTeste] as const);
  const publico = await carregarPublico(p, agora);
  const nomeCategoria = new Map(categorias.todos().map((c) => [c.codigo, c.nome]));
  const ativas = ciencias.ativos();
  const aprovadas = tentativas.ativos().filter((t) => t.aprovada);
  return publicacoes.ativos().map((x) => {
    const membros = x.situacao === 'rascunho' ? [] : publico.membros(x);
    const exige = x.exige_ciencia || x.tem_teste;
    const emDia = exige
      ? membros.filter(
          (m) =>
            situacaoDaPessoa(
              x.exige_ciencia,
              x.edicao,
              ativas.filter((c) => c.publicacao_id === x.id && c.usuario === m).map((c) => c.edicao),
              { tem: x.tem_teste, edicoesAprovadas: aprovadas.filter((t) => t.publicacao_id === x.id && t.usuario === m).map((t) => t.edicao) },
            ) === 'em_dia',
        ).length
      : 0;
    return {
      id: x.id,
      versao: x.versao,
      titulo: x.titulo,
      categoriaNome: nomeCategoria.get(x.categoria) ?? x.categoria,
      situacao: x.situacao,
      exigeCiencia: x.exige_ciencia,
      temTeste: x.tem_teste,
      edicao: x.edicao,
      publico: descreverPublico(x),
      emDia,
      total: exige ? membros.length : 0,
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
  const [publicacoes, ciencias, todasPerguntas, tentativas] = await lerTabelas(p, [PublicacoesConhecimento, CienciasConhecimento, PerguntasConhecimento, TentativasTeste] as const);
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
    temTeste: x.tem_teste,
    perguntas: todasPerguntas
      .ativos()
      .filter((q) => q.publicacao_id === x.id && q.edicao === x.edicao)
      .sort(porOrdem)
      .map(paraEntrada),
    situacao: x.situacao,
    anexoNome: x.anexo_id ? (x.anexo_nome ?? 'Anexo') : null,
    /** Quantas pessoas já deram ciência na edição atual (a janela da regra 7 mostra o número). */
    comCiencia: ciencias.ativos().filter((c) => c.publicacao_id === x.id && c.edicao === x.edicao).length,
    /** Quantas tentativas do teste já foram feitas na edição atual. */
    comTentativas: tentativas.ativos().filter((t) => t.publicacao_id === x.id && t.edicao === x.edicao).length,
  };
}

/** Regra 19: publicações que exigem ciência, com "X de Y em dia" (`conhecimento.acompanhar`). */
export async function listarAcompanhamento(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<LinhaDePublicacao[]> {
  if (!quem.temPermissao(PERM.acompanhar)) throw new ErroPermissao();
  return (await linhas(p, opcoes.agora ?? new Date()))
    .filter((l) => (l.exigeCiencia || l.temTeste) && l.situacao !== 'rascunho')
    .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

export interface PessoaAcompanhada {
  email: string;
  nome: string;
  situacao: SituacaoDaPessoa;
  cienciaEm: string | null;
  /** Melhor tentativa do teste na edição atual (regra 19). */
  melhorTentativa: { acertos: number; total: number } | null;
}

/**
 * Regra 19: cada pessoa do público com a situação e a data da ciência. A consulta é auditada como leitura.
 * Quem já deu ciência mas saiu do público continua na lista (o registro não some).
 */
export async function acompanharPublicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}) {
  if (!quem.temPermissao(PERM.acompanhar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [publicacoes, ciencias, tentativas] = await lerTabelas(p, [PublicacoesConhecimento, CienciasConhecimento, TentativasTeste] as const);
  const x = publicacoes.porId(id);
  if (!x || !x.ativo || x.situacao === 'rascunho' || !(x.exige_ciencia || x.tem_teste)) throw new ErroConhecimento('Publicação não encontrada ou sem ciência ou teste exigido.');
  const publico = await carregarPublico(p, agora);
  const doPublico = publico.membros(x);
  const daPublicacao = ciencias.ativos().filter((c) => c.publicacao_id === id);
  const dasTentativas = tentativas.ativos().filter((t) => t.publicacao_id === id);
  const emails = [...new Set([...doPublico, ...daPublicacao.map((c) => c.usuario), ...dasTentativas.map((t) => t.usuario)])];
  const nomes = await nomesDasPessoas(p, emails);
  const pessoas: PessoaAcompanhada[] = emails.map((email) => {
    const minhas = daPublicacao.filter((c) => c.usuario === email);
    const atual = minhas.find((c) => c.edicao === x.edicao);
    const ultima = atual ?? [...minhas].sort((a, b) => b.edicao - a.edicao)[0];
    const tentativasDele = dasTentativas.filter((t) => t.usuario === email);
    const melhor = tentativasDele.filter((t) => t.edicao === x.edicao).sort((a, b) => b.acertos / (b.total || 1) - a.acertos / (a.total || 1))[0];
    return {
      email,
      nome: nomes.get(email) ?? email,
      situacao: situacaoDaPessoa(x.exige_ciencia, x.edicao, minhas.map((c) => c.edicao), {
        tem: x.tem_teste,
        edicoesAprovadas: tentativasDele.filter((t) => t.aprovada).map((t) => t.edicao),
      }),
      cienciaEm: ultima?.registrada_em ?? null,
      melhorTentativa: melhor ? { acertos: melhor.acertos, total: melhor.total } : null,
    };
  });
  await auditar(p, quem, 'leitura', 'CienciasConhecimento', id, ['usuario', 'registrada_em', 'acertos'], agora);
  const ordem = { pendente: 0, precisa_renovar: 1, em_dia: 2, sem_exigencia: 3 } as const;
  pessoas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { id: x.id, titulo: x.titulo, edicao: x.edicao, emDia: pessoas.filter((s) => s.situacao === 'em_dia').length, total: doPublico.length, pessoas };
}

/** Perfis e áreas que o formulário oferece em "Quem deve ler" (só nome e código; quem publica). */
export async function opcoesDePublico(p: Planilhas, quem: Autorizador) {
  exigirPublicar(quem);
  const [perfis, areas] = await lerTabelas(p, [Perfis, Areas] as const);
  return {
    perfis: perfis.ativos().map((x) => ({ codigo: x.codigo, nome: x.nome })),
    areas: areas.ativos().map((x) => ({ codigo: x.codigo, nome: x.nome })),
  };
}
