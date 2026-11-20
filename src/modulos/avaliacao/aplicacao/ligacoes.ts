/**
 * Ligação das avaliações antigas (por iniciais) à pessoa do Cadastro Único (issue #62, entrega 3; ADR-026).
 *
 * Quem vê o quê:
 * - Só quem tem "avaliacao.avaliar" no serviço da avaliação lista e confirma a ligação.
 * - A pessoa escolhida precisa ser uma que quem avalia já vê (`podeVerPessoa`) e ter vínculo ativo no serviço
 *   da avaliação.
 * Confirmar grava uma linha em `LigacoesPessoa` e não altera a avaliação original. A auditoria registra a
 * inclusão e, ao desfazer, o encerramento (colunas, nunca valores).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Pessoas } from '@/nucleo/estrutura/tabelas';
import { LigacoesPessoa, Avaliacoes } from '../dados/tabelas';
import { ErroAvaliacao, normalizarIniciais } from '../dominio/avaliacao';
import { pessoasParaAplicar } from './aplicacoes';
import { PERM } from './avaliacoes';

const ENTIDADE = 'avaliacao.LigacoesPessoa';

const podeAvaliar = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.avaliar, { tipo: 'servico', codigo: servico });

export interface PessoaCandidata {
  id: string;
  nome: string;
  iniciais: string;
  /** As iniciais da pessoa batem com as da avaliação. */
  combina: boolean;
}

export interface AvaliacaoParaLigar {
  id: string;
  iniciais: string;
  nascimento: string;
  sexo: string;
  servico: string;
  servicoNome: string;
  dataAvaliacao: string;
  /** Pessoa sugerida (iniciais e, quando o Cadastro Único tem, a data de nascimento batem); só uma, senão vazio. */
  sugerida: string | null;
  /** Pessoas do serviço que quem avalia vê; as de iniciais iguais vêm primeiro. */
  candidatas: PessoaCandidata[];
}

/** Avaliações ativas, dos serviços em que quem avalia atua, ainda sem ligação. */
export async function avaliacoesParaLigar(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<AvaliacaoParaLigar[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [avaliacoes, ligacoes] = await lerTabelas(p, [Avaliacoes, LigacoesPessoa] as const);
  const ligadas = new Set(ligacoes.ativos().map((l) => l.avaliacao_id));
  const pessoas = await pessoasParaAplicar(p, quem, opcoes);
  const nascimentos = await nascimentoDasPessoas(p);
  return avaliacoes
    .ativos()
    .filter((r) => !ligadas.has(r.id) && podeAvaliar(quem, r.servico))
    .sort((a, b) => b.data_avaliacao.localeCompare(a.data_avaliacao) || a.iniciais.localeCompare(b.iniciais, 'pt-BR'))
    .map((r) => {
      const iniciais = normalizarIniciais(r.iniciais);
      const doServico = pessoas
        .filter((x) => x.servicos.some((s) => s.codigo === r.servico))
        .map((x) => ({ id: x.id, nome: x.nome, iniciais: x.iniciais, combina: normalizarIniciais(x.iniciais) === iniciais }))
        .sort((a, b) => Number(b.combina) - Number(a.combina) || a.nome.localeCompare(b.nome, 'pt-BR'));
      const exatas = doServico.filter((x) => x.combina && nascimentos.get(x.id) === r.nascimento);
      const iguais = doServico.filter((x) => x.combina);
      const sugerida = exatas.length === 1 ? exatas[0]!.id : exatas.length === 0 && iguais.length === 1 && !nascimentos.get(iguais[0]!.id) ? iguais[0]!.id : null;
      return {
        id: r.id,
        iniciais: r.iniciais,
        nascimento: r.nascimento,
        sexo: r.sexo,
        servico: r.servico,
        servicoNome: r.servico_nome,
        dataAvaliacao: r.data_avaliacao,
        sugerida,
        candidatas: doServico,
      };
    });
}

async function nascimentoDasPessoas(p: Planilhas): Promise<Map<string, string>> {
  const [pessoas] = await lerTabelas(p, [Pessoas] as const);
  return new Map(pessoas.ativos().flatMap((x) => (x.data_nascimento ? [[x.id, x.data_nascimento] as const] : [])));
}

/** Confirma que a avaliação antiga é da pessoa do Cadastro Único. Não altera a avaliação original. */
export async function confirmarLigacao(
  p: Planilhas,
  quem: Autorizador,
  avaliacaoId: string,
  pessoaId: string,
  opcoes: { agora?: Date } = {},
): Promise<{ id: string }> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [avaliacoes, ligacoes] = await lerTabelas(p, [Avaliacoes, LigacoesPessoa] as const);
  const a = avaliacoes.porId(avaliacaoId);
  if (!a || !a.ativo) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, a.servico)) throw new ErroPermissao('Você não avalia neste serviço.');
  if (!pessoaId) throw new ErroAvaliacao('Escolha a pessoa do Cadastro Único.');
  if (ligacoes.ativos().some((l) => l.avaliacao_id === avaliacaoId)) throw new ErroAvaliacao('Esta avaliação já está ligada a uma pessoa.');
  const pessoas = await pessoasParaAplicar(p, quem, { agora });
  if (!pessoas.some((x) => x.id === pessoaId && x.servicos.some((s) => s.codigo === a.servico))) {
    throw new ErroAvaliacao('Escolha uma pessoa que está neste serviço e que você já vê no Cadastro Único.');
  }
  const nova = await inserir(p, LigacoesPessoa, { avaliacao_id: avaliacaoId, pessoa_id: pessoaId }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: nova.id }, agora);
  return { id: nova.id };
}

/** Desfaz uma ligação confirmada por engano (`ativo = FALSE`); a avaliação volta à lista de pendentes. */
export async function desfazerLigacao(
  p: Planilhas,
  quem: Autorizador,
  avaliacaoId: string,
  opcoes: { agora?: Date } = {},
): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [avaliacoes, ligacoes] = await lerTabelas(p, [Avaliacoes, LigacoesPessoa] as const);
  const a = avaliacoes.porId(avaliacaoId);
  if (!a) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, a.servico)) throw new ErroPermissao('Você não avalia neste serviço.');
  const l = ligacoes.ativos().find((x) => x.avaliacao_id === avaliacaoId);
  if (!l) throw new ErroAvaliacao('Esta avaliação não está ligada a nenhuma pessoa.');
  await atualizar(p, LigacoesPessoa, l.id, l.versao, { ativo: false }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: ENTIDADE, registroId: l.id, detalhes: { colunas: ['ativo'] } }, agora);
}
