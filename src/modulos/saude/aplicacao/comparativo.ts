/**
 * Comparativo da pessoa entre períodos e ficha para imprimir (app Saúde).
 * Só entram aplicações fechadas e não corrigidas, dos serviços em que quem lê avalia.
 * Abrir o comparativo registra `leitura`; abrir a ficha registra `exportacao` (dado sensível).
 */
import { compararCiclos, vencimentoDaReavaliacao, type Comparativo, type Instrumento } from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Pessoas, VinculosFamiliares, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { Aplicacoes, Instrumentos, Respostas } from '../dados/tabelas';
import { CODIGO_CER, ErroSaude, INSTRUMENTO_CER, situacaoDaReavaliacao, type SituacaoReavaliacao } from '../dominio/cer';
import { detalharAplicacao, PERM, type AplicacaoDetalhada } from './avaliacoes';
import { definirInstrumento } from '@/capacidades/motor-avaliacao';

const hojeEm = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

export interface PeriodoComparado {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  servicoNome: string;
  faixa: string | null;
  profissional: string;
  /** Nota de cada item (1 a 10); `null` se faltar. */
  notas: Record<number, number | null>;
}

export interface ComparativoDaPessoa {
  pessoaId: string;
  pessoaNome: string;
  /** Aplicação a partir da qual o comparativo foi aberto (para voltar). */
  aplicacaoId: string;
  instrumento: Instrumento;
  comparativo: Comparativo;
  /** Um por ponto do comparativo, na mesma ordem. */
  periodos: PeriodoComparado[];
  reavaliacao: { vence: string; situacao: SituacaoReavaliacao } | null;
  /** Há rascunho aberto desta pessoa? Então "Reavaliar" continua nele. */
  abertaId: string | null;
}

export async function comparativoDaPessoa(p: Planilhas, quem: Autorizador, aplicacaoId: string, opcoes: { agora?: Date } = {}): Promise<ComparativoDaPessoa> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [aplicacoes, respostas, instrumentos, pessoas, vinculos, familiares] = await lerTabelas(p, [Aplicacoes, Respostas, Instrumentos, Pessoas, VinculosServico, VinculosFamiliares] as const);
  const origem = aplicacoes.porId(aplicacaoId);
  if (!origem || !origem.ativo) throw new ErroSaude('Avaliação não encontrada.');
  const dados = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };
  const podeNoServico = (servico: string) => quem.temPermissao(PERM.avaliar, { tipo: 'servico', codigo: servico });
  if (!podeNoServico(origem.servico) || !quem.podeVerPessoa(origem.pessoa_id, dados)) throw new ErroPermissao('Você não avalia neste serviço.');

  const todas = aplicacoes.ativos().filter((a) => a.pessoa_id === origem.pessoa_id && a.instrumento === CODIGO_CER && podeNoServico(a.servico));
  const corrigidas = new Set(todas.map((a) => a.corrige).filter((x): x is string => !!x));
  const fechadas = todas.filter((a) => a.situacao === 'fechada' && !corrigidas.has(a.id));

  const porVersao = new Map<number, Instrumento>([[INSTRUMENTO_CER.versao, INSTRUMENTO_CER]]);
  for (const l of instrumentos.ativos().filter((x) => x.codigo === CODIGO_CER)) porVersao.set(l.versao_instrumento, definirInstrumento(JSON.parse(l.definicao)));
  const ativas = respostas.ativos();
  const notasDe = (id: string) => {
    const r: Record<number, number> = {};
    for (const l of ativas) if (l.aplicacao_id === id) r[l.item] = l.valor;
    return r;
  };
  const comparativo = compararCiclos(
    [...porVersao.values()],
    fechadas.map((a) => ({ id: a.id, data: a.periodo_fim, versao: a.versao_instrumento, respostas: notasDe(a.id) })),
  );
  const instrumento = (comparativo.versao !== null ? porVersao.get(comparativo.versao) : undefined) ?? INSTRUMENTO_CER;
  const periodos = comparativo.pontos.map((pt): PeriodoComparado => {
    const a = fechadas.find((x) => x.id === pt.id)!;
    const notas = notasDe(a.id);
    return {
      id: a.id,
      periodoInicio: a.periodo_inicio,
      periodoFim: a.periodo_fim,
      servicoNome: a.servico_nome,
      faixa: pt.escore.enquadramento?.nome ?? null,
      profissional: a.profissional ?? '',
      notas: Object.fromEntries(instrumento.itens.map((i) => [i.numero, notas[i.numero] ?? null])),
    };
  });
  const ultimaAssinada = fechadas.map((a) => a.data_assinatura).filter((x): x is string => !!x).sort().pop();
  const vence = ultimaAssinada ? vencimentoDaReavaliacao(ultimaAssinada) : null;
  const pessoa = dados.pessoas.find((x) => x.id === origem.pessoa_id);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'saude.Aplicacoes', registroId: aplicacaoId, detalhes: { comparativo: true } }, agora);
  return {
    pessoaId: origem.pessoa_id,
    pessoaNome: pessoa ? (pessoa.nome_social ?? pessoa.nome) : 'Pessoa fora do cadastro',
    aplicacaoId,
    instrumento,
    comparativo,
    periodos,
    reavaliacao: vence ? { vence, situacao: situacaoDaReavaliacao(vence, hojeEm(agora)).situacao } : null,
    abertaId: todas.find((a) => a.situacao === 'aberta')?.id ?? null,
  };
}

/** Dados da ficha para imprimir: só aplicação fechada. Registra `exportacao`. */
export async function fichaDaAplicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<AplicacaoDetalhada> {
  const agora = opcoes.agora ?? new Date();
  const a = await detalharAplicacao(p, quem, id, { agora });
  if (a.situacao !== 'fechada') throw new ErroSaude('A ficha só existe para avaliação concluída.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'exportacao', entidade: 'saude.Aplicacoes', registroId: id, detalhes: { ficha: true } }, agora);
  return a;
}
