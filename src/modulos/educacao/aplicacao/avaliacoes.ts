/**
 * Casos de uso do app Educação (camada de aplicação).
 *
 * Quem vê o quê:
 * - "educacao.avaliar" no serviço (escopo global, da área ou do próprio serviço): aplica, fecha, corrige e lê
 *   as aplicações daquele serviço, só de pessoas que o Autorizador deixa ver e que têm vínculo ativo com ele.
 * - "educacao.ciente" no serviço: dá o ciente da coordenação técnica numa aplicação fechada.
 * "Turma" é o serviço do Núcleo (decisão 1 da especificação).
 * Abrir uma aplicação registra leitura na auditoria; incluir, alterar, fechar, corrigir e desistir registram
 * as colunas alteradas (nunca os valores).
 */
import {
  compararCiclos,
  definirInstrumento,
  itensSemResposta,
  vencimentoDaReavaliacao,
  type Comparativo,
  recusaDeFechamento,
  type Instrumento,
  type Respostas,
} from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import {
  atualizar,
  atualizarVarios,
  inserir,
  inserirRegistros,
  lerTabelas,
  type Planilhas,
  type Registro,
  type TabelaLida,
} from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Pessoas, Servicos, VinculosFamiliares, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { REFERENCIAIS, INSTRUMENTOS_EDUCACAO } from '../dados/instrumentos';
import { Aplicacoes, Instrumentos, Respostas as TabelaRespostas } from '../dados/tabelas';
import {
  ErroEducacao,
  instrumentoSugerido,
  recusaDeDatas,
  respostasValidas,
  resultadoDe,
  situacaoDaReavaliacao,
  type Resultado,
  type SituacaoReavaliacao,
} from '../dominio/educacao';

export const PERM = {
  acessar: 'educacao.acessar',
  avaliar: 'educacao.avaliar',
  ciente: 'educacao.ciente',
} as const;

export const AREA_EDUCACAO = 'educacao';
const ENTIDADE = 'educacao.Aplicacoes';
type RegAplicacao = Registro<typeof Aplicacoes.esquema>;

const hojeEm = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília

const podeAvaliar = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.avaliar, { tipo: 'servico', codigo: servico });
const podeDarCiente = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.ciente, { tipo: 'servico', codigo: servico });

// Instrumentos ----------------------------------------------------------------

export interface InstrumentoDisponivel {
  instrumento: Instrumento;
  referenciais: string | null;
}

/** Garante que os instrumentos da versão atual do Elo estão na aba Instrumentos (idempotente) e os devolve. */
async function instrumentosGravados(p: Planilhas, tabela: TabelaLida<typeof Instrumentos.esquema>, agora: Date) {
  const existentes = tabela.ativos();
  const faltam = INSTRUMENTOS_EDUCACAO.filter((i) => !existentes.some((e) => e.codigo === i.codigo && e.versao_instrumento === i.versao));
  let lista = existentes;
  if (faltam.length > 0) {
    const novos = await inserirRegistros(
      p,
      tabela,
      faltam.map((i) => ({
        codigo: i.codigo,
        versao_instrumento: i.versao,
        nome: i.nome,
        referenciais: REFERENCIAIS[i.codigo] ?? null,
        definicao: JSON.stringify(i),
      })),
      { email: 'sistema', agora: () => agora },
    );
    for (const n of novos) {
      await registrarAuditoria(p, { usuario: 'sistema', acao: 'inclusao', entidade: 'educacao.Instrumentos', registroId: n.id }, agora);
    }
    lista = [...existentes, ...novos];
  }
  return lista;
}

const instrumentoDe = (r: { definicao: string }): Instrumento => definirInstrumento(JSON.parse(r.definicao));
const chaveInstrumento = (codigo: string, versao: number) => `${codigo}@${versao}`;

// Leitura básica -----------------------------------------------------------------

async function carregar(p: Planilhas, agora: Date) {
  const [servicos, pessoas, vinculos, familiares, instrumentos, aplicacoes, respostas] = await lerTabelas(p, [
    Servicos,
    Pessoas,
    VinculosServico,
    VinculosFamiliares,
    Instrumentos,
    Aplicacoes,
    TabelaRespostas,
  ] as const);
  const gravados = await instrumentosGravados(p, instrumentos, agora);
  const porVersao = new Map(gravados.map((r) => [chaveInstrumento(r.codigo, r.versao_instrumento), { instrumento: instrumentoDe(r), referenciais: r.referenciais }]));
  return {
    servicos,
    pessoas: pessoas.ativos(),
    vinculos: vinculos.ativos(),
    familiares: familiares.ativos(),
    instrumentos: porVersao,
    aplicacoes,
    respostas,
  };
}
type Base = Awaited<ReturnType<typeof carregar>>;

const dadosDePessoas = (b: Base) => ({ pessoas: b.pessoas, vinculosServico: b.vinculos, vinculosFamiliares: b.familiares });
const nomeDaPessoa = (b: Base, id: string) => {
  const x = b.pessoas.find((q) => q.id === id);
  return x ? (x.nome_social ?? x.nome) : 'Pessoa não encontrada';
};
const vinculoAtivo = (b: Base, pessoaId: string, servico: string) => b.vinculos.some((v) => v.pessoa_id === pessoaId && v.servico === servico && !v.saida);

function respostasDaAplicacao(b: Base, id: string): Respostas {
  const r: Respostas = {};
  for (const x of b.respostas.ativos()) if (x.aplicacao_id === id) r[x.item] = x.valor;
  return r;
}

function instrumentoDaAplicacao(b: Base, a: { instrumento: string; instrumento_versao: number }): Instrumento {
  const i = b.instrumentos.get(chaveInstrumento(a.instrumento, a.instrumento_versao));
  if (!i) throw new ErroEducacao('O instrumento desta aplicação não está cadastrado.');
  return i.instrumento;
}

/** Aplicação que o usuário pode ver (serviço no escopo e pessoa visível); senão lança o erro certo. */
function aplicacaoVisivel(b: Base, quem: Autorizador, id: string): RegAplicacao {
  const a = b.aplicacoes.porId(id);
  if (!a || !a.ativo) throw new ErroEducacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, a.servico) || !quem.podeVerPessoa(a.pessoa_id, dadosDePessoas(b))) throw new ErroPermissao();
  return a;
}

// Telas de escolha ---------------------------------------------------------------

export interface ServicoParaAvaliar {
  codigo: string;
  nome: string;
  instrumentoSugerido: string | null;
}

export interface PessoaParaAvaliar {
  id: string;
  nome: string;
  servicos: string[];
}

export interface OpcoesParaNova {
  servicos: ServicoParaAvaliar[];
  pessoas: PessoaParaAvaliar[];
  instrumentos: { codigo: string; nome: string; versao: number; referenciais: string | null; instrumento: Instrumento }[];
}

/** O que a tela "Nova avaliação" precisa: serviços de Educação do escopo, pessoas visíveis e instrumentos. */
export async function opcoesParaNova(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<OpcoesParaNova> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const hoje = hojeEm(agora);
  const servicos = b.servicos
    .ativos()
    .filter((s) => s.area === AREA_EDUCACAO && (!s.fim || s.fim >= hoje) && podeAvaliar(quem, s.codigo))
    .map((s) => ({ codigo: s.codigo, nome: s.nome, instrumentoSugerido: instrumentoSugerido(s.nome) }))
    .sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR'));
  const nomes = new Map(servicos.map((s) => [s.codigo, s.nome]));
  const dados = dadosDePessoas(b);
  const pessoas = b.pessoas
    .map((x) => ({
      id: x.id,
      nome: x.nome_social ?? x.nome,
      servicos: b.vinculos.filter((v) => v.pessoa_id === x.id && !v.saida && nomes.has(v.servico)).map((v) => v.servico),
    }))
    .filter((x) => x.servicos.length > 0 && quem.podeVerPessoa(x.id, dados))
    .sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR'));
  // Só a versão mais recente de cada instrumento é oferecida para uma aplicação nova.
  const maisRecentes = new Map<string, { codigo: string; nome: string; versao: number; referenciais: string | null; instrumento: Instrumento }>();
  for (const { instrumento, referenciais } of b.instrumentos.values()) {
    const atual = maisRecentes.get(instrumento.codigo);
    if (!atual || atual.versao < instrumento.versao) {
      maisRecentes.set(instrumento.codigo, { codigo: instrumento.codigo, nome: instrumento.nome, versao: instrumento.versao, referenciais, instrumento });
    }
  }
  const ordem = INSTRUMENTOS_EDUCACAO.map((i) => i.codigo);
  const instrumentos = [...maisRecentes.values()].sort((a, c) => ordem.indexOf(a.codigo) - ordem.indexOf(c.codigo));
  return { servicos, pessoas, instrumentos };
}

// Lista --------------------------------------------------------------------------

export interface LinhaAplicacao {
  id: string;
  pessoaNome: string;
  servico: string;
  servicoNome: string;
  instrumentoNome: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  situacao: 'aberta' | 'fechada';
  /** Total e faixa só aparecem quando a aplicação está completa. */
  total: number | null;
  faixa: string | null;
  respondidos: number;
  itens: number;
  cienteDada: boolean;
  /** Foi corrigida por uma aplicação mais nova (a antiga fica no histórico). */
  corrigida: boolean;
  ehCorrecao: boolean;
  /** Pessoa avaliada (para os links de comparar e reavaliar). */
  pessoaId: string;
  /** Só na aplicação concluída mais recente da pessoa no instrumento: quando vence a próxima avaliação. */
  proximaAvaliacao: string | null;
  reavaliacao: SituacaoReavaliacao | null;
}

/** Aplicações ativas dos serviços em que a pessoa avalia, das mais recentes para as mais antigas. */
export async function listarAplicacoes(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<LinhaAplicacao[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, opcoes.agora ?? new Date());
  const dados = dadosDePessoas(b);
  const nomesServico = new Map(b.servicos.todos().map((s) => [s.codigo, s.nome]));
  const todas = b.aplicacoes.ativos();
  const corrigidas = new Set(todas.filter((a) => a.corrige && a.situacao === 'fechada').map((a) => a.corrige!));
  // Regra 13: vale a última assinatura vigente (não corrigida) da pessoa em cada instrumento.
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const ultima = new Map<string, RegAplicacao>();
  for (const a of todas) {
    if (a.situacao !== 'fechada' || corrigidas.has(a.id) || !a.data_assinatura) continue;
    const k = `${a.pessoa_id}|${a.instrumento}`;
    const atual = ultima.get(k);
    if (!atual || a.data_assinatura > atual.data_assinatura! || (a.data_assinatura === atual.data_assinatura && a.periodo_fim! > atual.periodo_fim!)) ultima.set(k, a);
  }
  return todas
    .filter((a) => podeAvaliar(quem, a.servico) && quem.podeVerPessoa(a.pessoa_id, dados))
    .sort((a, c) => (c.periodo_fim ?? '').localeCompare(a.periodo_fim ?? '') || c.atualizado_em.localeCompare(a.atualizado_em))
    .map((a) => {
      const instrumento = instrumentoDaAplicacao(b, a);
      const respostas = respostasDaAplicacao(b, a.id);
      const r = resultadoDe(instrumento, respostas);
      const vence = ultima.get(`${a.pessoa_id}|${a.instrumento}`)?.id === a.id ? vencimentoDaReavaliacao(a.data_assinatura!) : null;
      return {
        id: a.id,
        pessoaId: a.pessoa_id,
        proximaAvaliacao: vence,
        reavaliacao: vence ? situacaoDaReavaliacao(vence, hoje).situacao : null,
        pessoaNome: nomeDaPessoa(b, a.pessoa_id),
        servico: a.servico,
        servicoNome: nomesServico.get(a.servico) ?? a.servico,
        instrumentoNome: instrumento.nome,
        periodoInicio: a.periodo_inicio,
        periodoFim: a.periodo_fim,
        situacao: a.situacao,
        total: r.completo ? r.total : null,
        faixa: r.completo ? r.faixa : null,
        respondidos: instrumento.itens.length - itensSemResposta(instrumento, respostas).length,
        itens: instrumento.itens.length,
        cienteDada: Boolean(a.ciente_por),
        corrigida: corrigidas.has(a.id),
        ehCorrecao: Boolean(a.corrige),
      };
    });
}

// Abrir --------------------------------------------------------------------------

export interface AplicacaoDetalhada {
  id: string;
  versao: number;
  pessoaId: string;
  pessoaNome: string;
  servico: string;
  servicoNome: string;
  instrumento: Instrumento;
  referenciais: string | null;
  situacao: 'aberta' | 'fechada';
  periodoInicio: string | null;
  periodoFim: string | null;
  dataIngresso: string | null;
  profissional: string | null;
  funcao: string | null;
  justificativa: string | null;
  dataAssinatura: string | null;
  cientePor: string | null;
  cienteEm: string | null;
  respostas: Respostas;
  resultado: Resultado;
  corrige: string | null;
  corrigidaPor: string | null;
  /** Quem pode dar o ciente nesta aplicação (fechada, ainda sem ciente, com a permissão no serviço). */
  podeDarCiente: boolean;
}

/** Abre uma aplicação. Registra a leitura na auditoria (dado sensível). */
export async function detalharAplicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<AplicacaoDetalhada> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const a = aplicacaoVisivel(b, quem, id);
  const instrumento = instrumentoDaAplicacao(b, a);
  const respostas = respostasDaAplicacao(b, a.id);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: a.id }, agora);
  const servico = b.servicos.todos().find((s) => s.codigo === a.servico);
  return {
    id: a.id,
    versao: a.versao,
    pessoaId: a.pessoa_id,
    pessoaNome: nomeDaPessoa(b, a.pessoa_id),
    servico: a.servico,
    servicoNome: servico?.nome ?? a.servico,
    instrumento,
    referenciais: b.instrumentos.get(chaveInstrumento(a.instrumento, a.instrumento_versao))?.referenciais ?? null,
    situacao: a.situacao,
    periodoInicio: a.periodo_inicio,
    periodoFim: a.periodo_fim,
    dataIngresso: a.data_ingresso,
    profissional: a.profissional,
    funcao: a.funcao,
    justificativa: a.justificativa,
    dataAssinatura: a.data_assinatura,
    cientePor: a.ciente_por,
    cienteEm: a.ciente_em,
    respostas,
    resultado: resultadoDe(instrumento, respostas),
    corrige: a.corrige,
    corrigidaPor: b.aplicacoes.ativos().find((x) => x.corrige === a.id && x.situacao === 'fechada')?.id ?? null,
    podeDarCiente: a.situacao === 'fechada' && !a.ciente_por && podeDarCiente(quem, a.servico),
  };
}

// Gravar -------------------------------------------------------------------------

export interface EntradaAplicacao {
  pessoaId: string;
  instrumento: string;
  servico: string;
  periodoInicio?: string;
  periodoFim?: string;
  dataIngresso?: string;
  profissional?: string;
  funcao?: string;
  justificativa?: string;
  /** Nota por número do item (0 a 3); item sem nota fica fora. */
  respostas: Record<string, unknown>;
}

export interface ResultadoDoSalvar {
  id: string;
  versao: number;
  situacao: 'aberta' | 'fechada';
  resultado: Resultado;
}

const vazioParaNulo = (t?: string | null) => (t && t.trim() !== '' ? t.trim() : null);

/**
 * Salva o rascunho (aplicação aberta) ou, com `concluir`, fecha e assina. Aplicação fechada não se edita:
 * a correção cria nova aplicação (`corrigirAplicacao`). Grava respostas e dados juntos; erros mantêm tudo.
 */
export async function salvarAplicacao(
  p: Planilhas,
  quem: Autorizador,
  entrada: EntradaAplicacao,
  opcoes: { id?: string; versao?: number; concluir?: boolean; agora?: Date } = {},
): Promise<ResultadoDoSalvar> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeEm(agora);
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const autoria = { email: quem.email, agora: () => agora };

  const existente = opcoes.id ? aplicacaoVisivel(b, quem, opcoes.id) : null;
  if (existente && existente.situacao === 'fechada') {
    throw new ErroEducacao('Esta avaliação já foi concluída e não pode ser editada. Use "Corrigir" para criar uma nova.');
  }

  // Serviço: de Educação, ativo e no escopo de quem avalia.
  const servico = b.servicos.ativos().find((s) => s.codigo === entrada.servico);
  if (!servico || servico.area !== AREA_EDUCACAO) throw new ErroEducacao('Escolha um serviço de Educação.');
  if (!podeAvaliar(quem, servico.codigo)) throw new ErroPermissao('Você não avalia neste serviço.');

  // Pessoa: ativa, visível a quem avalia e com vínculo ativo com o serviço.
  const pessoaId = existente?.pessoa_id ?? entrada.pessoaId;
  if (!b.pessoas.some((x) => x.id === pessoaId)) throw new ErroEducacao('Escolha uma pessoa do Cadastro Único.');
  if (!quem.podeVerPessoa(pessoaId, dadosDePessoas(b))) throw new ErroPermissao('Você não pode ver esta pessoa.');
  if (!vinculoAtivo(b, pessoaId, servico.codigo)) throw new ErroEducacao('A pessoa não tem vínculo ativo com este serviço.');

  // Instrumento: o da aplicação existente; numa nova, a versão mais recente do escolhido.
  let instrumento: Instrumento;
  if (existente) {
    instrumento = instrumentoDaAplicacao(b, existente);
  } else {
    const versoes = [...b.instrumentos.values()].map((x) => x.instrumento).filter((i) => i.codigo === entrada.instrumento);
    if (versoes.length === 0) throw new ErroEducacao('Escolha um instrumento da lista.');
    instrumento = versoes.sort((x, y) => y.versao - x.versao)[0]!;
  }

  const respostas = respostasValidas(instrumento, entrada.respostas);
  const motivoDatas = recusaDeDatas(
    { periodoInicio: vazioParaNulo(entrada.periodoInicio), periodoFim: vazioParaNulo(entrada.periodoFim), dataIngresso: vazioParaNulo(entrada.dataIngresso) },
    hoje,
  );
  if (motivoDatas) throw new ErroEducacao(motivoDatas);

  const justificativa = vazioParaNulo(entrada.justificativa);
  if (opcoes.concluir) {
    const motivo = recusaDeFechamento(instrumento, respostas, justificativa ?? '');
    if (motivo) throw new ErroEducacao(motivo);
    const faltam = [
      !vazioParaNulo(entrada.periodoInicio) || !vazioParaNulo(entrada.periodoFim) ? 'o período avaliado' : null,
      !vazioParaNulo(entrada.dataIngresso) ? 'a data de ingresso' : null,
      !vazioParaNulo(entrada.profissional) ? 'o profissional responsável' : null,
      !vazioParaNulo(entrada.funcao) ? 'a função ou categoria profissional' : null,
    ].filter((x): x is string => x !== null);
    if (faltam.length > 0) throw new ErroEducacao(`Para concluir, preencha ${faltam.join(', ')}.`);
  }

  // Regra 9: uma pessoa não tem duas aplicações abertas do mesmo instrumento.
  const aberta = b.aplicacoes
    .ativos()
    .find((a) => a.pessoa_id === pessoaId && a.instrumento === instrumento.codigo && a.situacao === 'aberta' && a.id !== existente?.id);
  if (aberta) throw new ErroEducacao('Esta pessoa já tem uma avaliação aberta com este instrumento. Conclua ou desista dela antes de começar outra.');

  const campos = {
    servico: servico.codigo,
    periodo_inicio: vazioParaNulo(entrada.periodoInicio),
    periodo_fim: vazioParaNulo(entrada.periodoFim),
    data_ingresso: vazioParaNulo(entrada.dataIngresso),
    profissional: vazioParaNulo(entrada.profissional),
    funcao: vazioParaNulo(entrada.funcao),
    justificativa,
    ...(opcoes.concluir ? { situacao: 'fechada' as const, data_assinatura: hoje } : {}),
  };

  let id: string;
  let versao: number;
  if (!existente) {
    const nova = await inserir(
      p,
      Aplicacoes,
      { pessoa_id: pessoaId, instrumento: instrumento.codigo, instrumento_versao: instrumento.versao, situacao: 'aberta', ...campos },
      autoria,
    );
    id = nova.id;
    versao = nova.versao;
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: id }, agora);
  } else {
    const { registro, colunasAlteradas } = await atualizar(p, Aplicacoes, existente.id, opcoes.versao ?? -1, campos, autoria);
    id = registro.id;
    versao = registro.versao;
    if (colunasAlteradas.length > 0) {
      await registrarAuditoria(
        p,
        { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: id, detalhes: { colunas: colunasAlteradas, ...(opcoes.concluir ? { fechamento: true } : {}) } },
        agora,
      );
    }
  }
  await gravarRespostas(p, quem, id, respostas, agora);
  return { id, versao, situacao: opcoes.concluir ? 'fechada' : 'aberta', resultado: resultadoDe(instrumento, respostas) };
}

/** Inclui as respostas novas e altera as que mudaram (uma linha por item), com auditoria das colunas. */
async function gravarRespostas(p: Planilhas, quem: Autorizador, aplicacaoId: string, respostas: Respostas, agora: Date) {
  const [tabela] = await lerTabelas(p, [TabelaRespostas] as const);
  const atuais = new Map(tabela.ativos().filter((r) => r.aplicacao_id === aplicacaoId).map((r) => [r.item, r]));
  const autoria = { email: quem.email, agora: () => agora };
  const novas = Object.entries(respostas).filter(([item]) => !atuais.has(Number(item)));
  const mudadas = Object.entries(respostas).filter(([item, v]) => atuais.has(Number(item)) && atuais.get(Number(item))!.valor !== v);
  if (novas.length > 0) {
    await inserirRegistros(p, tabela, novas.map(([item, valor]) => ({ aplicacao_id: aplicacaoId, item: Number(item), valor: valor as number })), autoria);
  }
  if (mudadas.length > 0) {
    await atualizarVarios(
      p,
      TabelaRespostas,
      mudadas.map(([item, valor]) => ({ id: atuais.get(Number(item))!.id, versao: atuais.get(Number(item))!.versao, mudancas: { valor: valor as number } })),
      autoria,
    );
  }
  if (novas.length + mudadas.length > 0) {
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: novas.length > 0 && mudadas.length === 0 ? 'inclusao' : 'alteracao', entidade: 'educacao.Respostas', registroId: aplicacaoId, detalhes: { colunas: ['valor'], itens: novas.length + mudadas.length } },
      agora,
    );
  }
}

/** Corrigir: cria nova aplicação aberta a partir de uma fechada; a anterior fica no histórico (regra 8). */
export async function corrigirAplicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<{ id: string }> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const origem = aplicacaoVisivel(b, quem, id);
  if (origem.situacao !== 'fechada') throw new ErroEducacao('Só uma avaliação concluída precisa de correção; esta ainda pode ser editada.');
  const todas = b.aplicacoes.ativos();
  if (todas.some((a) => a.corrige === origem.id && a.situacao === 'fechada')) throw new ErroEducacao('Esta avaliação já foi corrigida por outra.');
  if (todas.some((a) => a.pessoa_id === origem.pessoa_id && a.instrumento === origem.instrumento && a.situacao === 'aberta')) {
    throw new ErroEducacao('Esta pessoa já tem uma avaliação aberta com este instrumento. Conclua ou desista dela antes.');
  }
  const autoria = { email: quem.email, agora: () => agora };
  const nova = await inserir(
    p,
    Aplicacoes,
    {
      pessoa_id: origem.pessoa_id,
      instrumento: origem.instrumento,
      instrumento_versao: origem.instrumento_versao,
      servico: origem.servico,
      periodo_inicio: origem.periodo_inicio,
      periodo_fim: origem.periodo_fim,
      data_ingresso: origem.data_ingresso,
      situacao: 'aberta',
      corrige: origem.id,
      profissional: origem.profissional,
      funcao: origem.funcao,
      justificativa: origem.justificativa,
    },
    autoria,
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: nova.id, detalhes: { corrige: origem.id } }, agora);
  await gravarRespostas(p, quem, nova.id, respostasDaAplicacao(b, origem.id), agora);
  return { id: nova.id };
}

/** Desistir de uma aplicação aberta: fica com ativo = FALSE e o motivo (nada é apagado). */
export async function desistirAplicacao(p: Planilhas, quem: Autorizador, id: string, versao: number, motivo: string, opcoes: { agora?: Date } = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  if (motivo.trim().length < 3) throw new ErroEducacao('Escreva o motivo da desistência.');
  const b = await carregar(p, agora);
  const a = aplicacaoVisivel(b, quem, id);
  if (a.situacao !== 'aberta') throw new ErroEducacao('Uma avaliação concluída não é apagada nem desfeita: use "Corrigir".');
  await atualizar(p, Aplicacoes, id, versao, { ativo: false, motivo_desistencia: motivo.trim() }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: 'encerramento', entidade: ENTIDADE, registroId: id, detalhes: { colunas: ['ativo', 'motivo_desistencia'] } },
    agora,
  );
}

/** Ciente da coordenação técnica: só em aplicação fechada, por quem tem "educacao.ciente" no serviço. Não altera as respostas. */
export async function darCiente(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: { agora?: Date } = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const a = aplicacaoVisivel(b, quem, id);
  if (!podeDarCiente(quem, a.servico)) throw new ErroPermissao('Só a coordenação do serviço e a Diretoria dão o ciente.');
  if (a.situacao !== 'fechada') throw new ErroEducacao('O ciente só vale para uma avaliação concluída.');
  if (a.ciente_por) throw new ErroEducacao('O ciente já foi dado nesta avaliação.');
  const { colunasAlteradas } = await atualizar(p, Aplicacoes, id, versao, { ciente_por: quem.email, ciente_em: hojeEm(agora) }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: id, detalhes: { colunas: colunasAlteradas, ciente: true } }, agora);
}

// Comparativo e ficha ------------------------------------------------------------

export interface PeriodoComparado {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  servicoNome: string;
  faixa: string | null;
  /** Nota de cada item; `null` se faltar. */
  notas: Record<number, number | null>;
}

export interface ComparativoDaPessoa {
  pessoaId: string;
  pessoaNome: string;
  aplicacaoId: string;
  instrumento: Instrumento;
  comparativo: Comparativo;
  /** Um por ponto do comparativo, na mesma ordem. */
  periodos: PeriodoComparado[];
  /** Dimensão(ões) de menor percentual do máximo na avaliação mais recente. */
  principalBarreira: string[];
  reavaliacao: { vence: string; situacao: SituacaoReavaliacao } | null;
  /** Há rascunho aberto desta pessoa neste instrumento? Então "Reavaliar" continua nele. */
  abertaId: string | null;
}

/**
 * Comparativo da pessoa no instrumento da aplicação aberta: só aplicações concluídas e vigentes (não corrigidas),
 * de serviços em que quem lê avalia. Registra `leitura` na auditoria.
 */
export async function comparativoDaPessoa(p: Planilhas, quem: Autorizador, aplicacaoId: string, opcoes: { agora?: Date } = {}): Promise<ComparativoDaPessoa> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const b = await carregar(p, agora);
  const origem = aplicacaoVisivel(b, quem, aplicacaoId);
  const todas = b.aplicacoes.ativos().filter((a) => a.pessoa_id === origem.pessoa_id && a.instrumento === origem.instrumento && podeAvaliar(quem, a.servico));
  const corrigidas = new Set(todas.filter((a) => a.corrige && a.situacao === 'fechada').map((a) => a.corrige!));
  const fechadas = todas.filter((a) => a.situacao === 'fechada' && !corrigidas.has(a.id));
  const versoes = new Map<number, Instrumento>();
  for (const a of fechadas.length > 0 ? fechadas : [origem]) versoes.set(a.instrumento_versao, instrumentoDaAplicacao(b, a));
  const comparativo = compararCiclos(
    [...versoes.values()],
    fechadas.map((a) => ({ id: a.id, data: a.periodo_fim!, versao: a.instrumento_versao, respostas: respostasDaAplicacao(b, a.id) })),
  );
  const instrumento = (comparativo.versao !== null ? versoes.get(comparativo.versao) : undefined) ?? instrumentoDaAplicacao(b, origem);
  const nomes = new Map(b.servicos.todos().map((s) => [s.codigo, s.nome]));
  const periodos = comparativo.pontos.map((pt): PeriodoComparado => {
    const a = fechadas.find((x) => x.id === pt.id)!;
    const notas = respostasDaAplicacao(b, a.id);
    return {
      id: a.id,
      periodoInicio: a.periodo_inicio!,
      periodoFim: a.periodo_fim!,
      servicoNome: nomes.get(a.servico) ?? a.servico,
      faixa: pt.escore.enquadramento?.nome ?? null,
      notas: Object.fromEntries(instrumento.itens.map((i) => [i.numero, typeof notas[i.numero] === 'number' ? (notas[i.numero] as number) : null])),
    };
  });
  const ultimoPonto = comparativo.pontos[comparativo.pontos.length - 1];
  const ultimaAssinada = fechadas.map((a) => a.data_assinatura).filter((x): x is string => !!x).sort().pop();
  const vence = ultimaAssinada ? vencimentoDaReavaliacao(ultimaAssinada) : null;
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: aplicacaoId, detalhes: { comparativo: true } }, agora);
  return {
    pessoaId: origem.pessoa_id,
    pessoaNome: nomeDaPessoa(b, origem.pessoa_id),
    aplicacaoId,
    instrumento,
    comparativo,
    periodos,
    principalBarreira: ultimoPonto ? resultadoDe(instrumento, respostasDaAplicacao(b, ultimoPonto.id)).principalBarreira : [],
    reavaliacao: vence ? { vence, situacao: situacaoDaReavaliacao(vence, hojeEm(agora)).situacao } : null,
    abertaId: todas.find((a) => a.situacao === 'aberta')?.id ?? null,
  };
}

/** Dados da ficha para imprimir: só aplicação concluída. Registra `exportacao` (e a leitura de abrir). */
export async function fichaDaAplicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<AplicacaoDetalhada> {
  const agora = opcoes.agora ?? new Date();
  const a = await detalharAplicacao(p, quem, id, { agora });
  if (a.situacao !== 'fechada') throw new ErroEducacao('A ficha só existe para avaliação concluída.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'exportacao', entidade: ENTIDADE, registroId: id, detalhes: { ficha: true } }, agora);
  return a;
}
