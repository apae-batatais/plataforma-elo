/**
 * Teste de compreensão (regras 11 a 14): a pessoa envia as respostas, a camada de aplicação confere
 * com o gabarito (que nunca vai ao navegador) e grava a tentativa. Tentativas são só inclusão; errar
 * não avisa ninguém e não há limite.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { PerguntasConhecimento, PublicacoesConhecimento, TentativasTeste } from '../dados/tabelas';
import { corrigirTeste, ErroConhecimento, type ResultadoDoTeste } from '../dominio/publicacao';
import { auditar, autoriaDe, carregarPublico, PERM, type Opcoes } from './base';

/** `respostas[i]` = posição (a partir de 0) da opção marcada na pergunta i+1; `null` = não respondida. */
export async function enviarTeste(p: Planilhas, quem: Autorizador, id: string, respostas: readonly (number | null)[], opcoes: Opcoes = {}): Promise<ResultadoDoTeste> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ler)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [publicacoes, perguntas] = await lerTabelas(p, [PublicacoesConhecimento, PerguntasConhecimento] as const);
  const x = publicacoes.porId(id);
  if (!x || !x.ativo) throw new ErroConhecimento('Publicação não encontrada.');
  const publico = await carregarPublico(p, agora);
  if (!publico.membros(x).includes(quem.email)) throw new ErroPermissao('Esta publicação não é para o seu perfil.');
  if (x.situacao !== 'publicada') throw new ErroConhecimento('Esta publicação não está aberta para o teste.');
  if (!x.tem_teste) throw new ErroConhecimento('Esta publicação não tem teste.');
  const doTeste = perguntas
    .ativos()
    .filter((q) => q.publicacao_id === id && q.edicao === x.edicao)
    .sort((a, b) => a.ordem - b.ordem);
  if (doTeste.length === 0) throw new ErroConhecimento('O teste ainda não tem perguntas.');
  const faltando = doTeste.map((_, i) => i + 1).filter((n) => respostas[n - 1] === null || respostas[n - 1] === undefined || !Number.isInteger(respostas[n - 1]));
  if (faltando.length) throw new ErroConhecimento(`Responda todas as perguntas. Falta: ${faltando.join(', ')}.`);
  const r = corrigirTeste(doTeste.map((q) => q.correta), respostas as number[]);
  const nova = await inserir(
    p,
    TentativasTeste,
    { publicacao_id: id, edicao: x.edicao, usuario: quem.email, feita_em: agora.toISOString(), acertos: r.acertos, total: r.total, aprovada: r.aprovada },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'inclusao', 'TentativasTeste', nova.id, ['publicacao_id', 'edicao', 'usuario', 'feita_em', 'acertos', 'total', 'aprovada'], agora);
  return r;
}
