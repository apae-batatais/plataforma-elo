/**
 * Curtir e comentar (regras 15 a 17). Só quem enxerga a publicação interage, e só enquanto ela está
 * publicada (arquivada fica só para leitura). Nada é apagado: descurtir e esconder só mudam `ativo`.
 * A auditoria guarda só os nomes das colunas.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ComentariosConhecimento, CurtidasConhecimento } from '../dados/tabelas';
import { conferirComentario, ErroConhecimento } from '../dominio/publicacao';
import { auditar, autoriaDe, PERM, type Opcoes } from './base';
import { lerPublicacao, nomeDoUsuario } from './publicacoes';

/** Confirma que a pessoa vê a publicação (regra 4) e, se for gravar, que ela aceita interação (regra 17). */
async function publicacaoParaInteragir(p: Planilhas, quem: Autorizador, id: string, agora: Date, gravar: boolean) {
  const x = await lerPublicacao(p, quem, id, { agora });
  if (gravar && x.situacao !== 'publicada') throw new ErroConhecimento('Esta publicação não recebe curtidas nem comentários.');
  return x;
}

export interface ComentarioVisivel {
  id: string;
  versao: number;
  nome: string;
  texto: string;
  criadoEm: string;
  /** Só quem publica vê comentário escondido (para poder reativar). */
  escondido: boolean;
}

export interface InteracaoDaPublicacao {
  curtidas: number;
  euCurti: boolean;
  /** Pode curtir e comentar agora (publicada)? */
  podeInteragir: boolean;
  comentarios: ComentarioVisivel[];
}

/** Total de curtidas, se a pessoa curtiu e os comentários (do mais antigo ao mais novo). */
export async function lerInteracao(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}): Promise<InteracaoDaPublicacao> {
  const agora = opcoes.agora ?? new Date();
  const x = await publicacaoParaInteragir(p, quem, id, agora, false);
  const [curtidas, comentarios] = await lerTabelas(p, [CurtidasConhecimento, ComentariosConhecimento] as const);
  const dela = curtidas.ativos().filter((c) => c.publicacao_id === id);
  const editor = quem.temPermissao(PERM.publicar);
  return {
    curtidas: dela.length,
    euCurti: dela.some((c) => c.usuario === quem.email),
    podeInteragir: x.situacao === 'publicada',
    comentarios: comentarios
      .todos()
      .filter((c) => c.publicacao_id === id && (c.ativo || editor))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map((c) => ({ id: c.id, versao: c.versao, nome: c.usuario_nome, texto: c.texto, criadoEm: c.criado_em, escondido: !c.ativo })),
  };
}

/** Regra 15: uma curtida por pessoa; alternar reativa a mesma linha. Devolve se agora está curtida. */
export async function alternarCurtida(p: Planilhas, quem: Autorizador, id: string, opcoes: Opcoes = {}): Promise<{ curtida: boolean }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ler)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  await publicacaoParaInteragir(p, quem, id, agora, true);
  const [curtidas] = await lerTabelas(p, [CurtidasConhecimento] as const);
  const minha = curtidas.todos().find((c) => c.publicacao_id === id && c.usuario === quem.email);
  const autoria = autoriaDe(quem, agora);
  if (!minha) {
    const nova = await inserir(p, CurtidasConhecimento, { publicacao_id: id, usuario: quem.email }, autoria);
    await auditar(p, quem, 'inclusao', 'CurtidasConhecimento', nova.id, ['publicacao_id', 'usuario'], agora);
    return { curtida: true };
  }
  const vaiCurtir = !minha.ativo;
  await atualizar(p, CurtidasConhecimento, minha.id, minha.versao, { ativo: vaiCurtir }, autoria);
  await auditar(p, quem, vaiCurtir ? 'alteracao' : 'encerramento', 'CurtidasConhecimento', minha.id, ['ativo'], agora);
  return { curtida: vaiCurtir };
}

/** Regra 16: comentário de 1 a 1.000 caracteres, com nome (do cadastro), data e hora do servidor. */
export async function comentar(p: Planilhas, quem: Autorizador, id: string, texto: string, opcoes: Opcoes = {}): Promise<{ id: string }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ler)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  await publicacaoParaInteragir(p, quem, id, agora, true);
  const conferido = conferirComentario(texto);
  if ('erro' in conferido) throw new ErroConhecimento(conferido.erro);
  const nova = await inserir(
    p,
    ComentariosConhecimento,
    { publicacao_id: id, usuario: quem.email, usuario_nome: await nomeDoUsuario(p, quem.email), texto: conferido.texto, escondido_por: null, escondido_em: null },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'inclusao', 'ComentariosConhecimento', nova.id, ['publicacao_id', 'usuario', 'usuario_nome', 'texto'], agora);
  return { id: nova.id };
}

/** Regra 16: quem publica esconde (ou reativa) qualquer comentário; fica registrado quem e quando. */
export async function mudarVisibilidadeComentario(p: Planilhas, quem: Autorizador, id: string, versao: number, esconder: boolean, opcoes: Opcoes = {}): Promise<void> {
  if (!quem.temPermissao(PERM.publicar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [comentarios] = await lerTabelas(p, [ComentariosConhecimento] as const);
  const c = comentarios.porId(id);
  if (!c) throw new ErroConhecimento('Comentário não encontrado.');
  if (esconder === !c.ativo) throw new ErroConhecimento(esconder ? 'Este comentário já está escondido.' : 'Este comentário já está visível.');
  await atualizar(
    p,
    ComentariosConhecimento,
    id,
    versao,
    { ativo: !esconder, escondido_por: esconder ? quem.email : null, escondido_em: esconder ? agora.toISOString() : null },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, esconder ? 'encerramento' : 'alteracao', 'ComentariosConhecimento', id, ['ativo', 'escondido_por', 'escondido_em'], agora);
}
