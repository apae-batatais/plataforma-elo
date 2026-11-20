/**
 * Casos de uso da aplicação de instrumentos a pessoas do Cadastro Único (issue #62, entrega 2; ADR-026).
 *
 * Quem vê o quê:
 * - "avaliacao.avaliar" no serviço (escopo global, da área ou do próprio serviço) aplica, fecha, corrige e lê.
 * - A pessoa só pode ser escolhida se `podeVerPessoa` do Autorizador permitir E se tiver vínculo ativo
 *   com um serviço em que quem avalia tem a permissão.
 * Abrir uma aplicação ou o comparativo registra leitura na auditoria; incluir, alterar, fechar e corrigir
 * registram as colunas alteradas (nunca os valores).
 */
import {
  calcularEscore,
  compararCiclos,
  definirInstrumento,
  recusaDeFechamento,
  recusaDeAlteracao,
  recusaDeResposta,
  type Comparativo as ComparativoMotor,
  type Escore,
  type Instrumento,
  type Respostas,
} from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas, type Registro } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Pessoas, Servicos, VinculosFamiliares, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { Aplicacoes, Instrumentos, Respostas as AbaRespostas, TIPOS_APLICACAO } from '../dados/tabelas';
import { iniciaisDoNome, montarRespostas, respostaParaTexto } from '../dominio/aplicacao';
import { ErroAvaliacao, situacaoReavaliacao, type SituacaoReavaliacao } from '../dominio/avaliacao';

const PERM_AVALIAR = 'avaliacao.avaliar';
const ENTIDADE = 'avaliacao.Aplicacoes';
const ENTIDADE_RESPOSTAS = 'avaliacao.Respostas';
const ENTIDADE_INSTRUMENTOS = 'avaliacao.Instrumentos';

type RegAplicacao = Registro<typeof Aplicacoes.esquema>;

const hojeEm = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília
const podeAvaliar = (quem: Autorizador, servico: string) => quem.temPermissao(PERM_AVALIAR, { tipo: 'servico', codigo: servico });
const exigirAvaliador = (quem: Autorizador) => {
  if (!quem.temPermissaoAlgumEscopo(PERM_AVALIAR)) throw new ErroPermissao();
};

function lerInstrumento(r: Registro<typeof Instrumentos.esquema>): Instrumento {
  try {
    return definirInstrumento({
      codigo: r.codigo,
      versao: r.versao_instrumento,
      eixo: r.eixo,
      nome: r.nome,
      dominios: JSON.parse(r.dominios),
      itens: JSON.parse(r.itens),
      faixas: JSON.parse(r.faixas),
    });
  } catch (erro) {
    throw new ErroAvaliacao(`O instrumento "${r.codigo}" (versão ${r.versao_instrumento}) está mal cadastrado: ${(erro as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Instrumentos
// ---------------------------------------------------------------------------

export interface LinhaInstrumento {
  codigo: string;
  versao: number;
  eixo: Instrumento['eixo'];
  nome: string;
  dominios: number;
  itens: number;
  /** Já tem alguma aplicação (então não muda; mudança vira nova versão). */
  usado: boolean;
}

/** Última versão de cada instrumento ativo. */
export async function listarInstrumentos(p: Planilhas, quem: Autorizador): Promise<LinhaInstrumento[]> {
  exigirAvaliador(quem);
  const [instrumentos, aplicacoes] = await lerTabelas(p, [Instrumentos, Aplicacoes] as const);
  const ultimas = new Map<string, Registro<typeof Instrumentos.esquema>>();
  for (const r of instrumentos.ativos()) {
    const atual = ultimas.get(r.codigo);
    if (!atual || r.versao_instrumento > atual.versao_instrumento) ultimas.set(r.codigo, r);
  }
  return [...ultimas.values()]
    .map((r) => {
      const i = lerInstrumento(r);
      return {
        codigo: i.codigo,
        versao: i.versao,
        eixo: i.eixo,
        nome: i.nome,
        dominios: i.dominios.length,
        itens: i.itens.length,
        usado: aplicacoes.ativos().some((a) => a.instrumento === i.codigo && a.instrumento_versao === i.versao),
      };
    })
    .sort((a, b) => a.eixo.localeCompare(b.eixo) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Instrumento para aplicar: sempre a última versão ativa. */
export async function instrumentoParaAplicar(p: Planilhas, quem: Autorizador, codigo: string): Promise<Instrumento> {
  exigirAvaliador(quem);
  const [instrumentos] = await lerTabelas(p, [Instrumentos] as const);
  const versoes = instrumentos.ativos().filter((r) => r.codigo === codigo);
  if (versoes.length === 0) throw new ErroAvaliacao('Instrumento não encontrado.');
  return lerInstrumento(versoes.reduce((a, b) => (b.versao_instrumento > a.versao_instrumento ? b : a)));
}

/**
 * Cadastro de instrumento pela equipe técnica (sem tela nesta fase; regra 1): só quem tem
 * `avaliacao.avaliar` em todos os serviços. Depois de usado, o instrumento não muda: só nova versão.
 */
export async function cadastrarInstrumento(
  p: Planilhas,
  quem: Autorizador,
  proposto: Parameters<typeof definirInstrumento>[0],
  opcoes: { agora?: Date } = {},
): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissao(PERM_AVALIAR)) throw new ErroPermissao('Só a equipe com acesso a todos os serviços cadastra instrumentos.');
  const novo = definirInstrumento(proposto);
  const [instrumentos, aplicacoes] = await lerTabelas(p, [Instrumentos, Aplicacoes] as const);
  const mesmoCodigo = instrumentos.ativos().filter((r) => r.codigo === novo.codigo);
  const campos = {
    codigo: novo.codigo,
    versao_instrumento: novo.versao,
    eixo: novo.eixo,
    nome: novo.nome,
    dominios: JSON.stringify(novo.dominios),
    itens: JSON.stringify(novo.itens),
    faixas: JSON.stringify(novo.faixas),
  };
  const autoria = { email: quem.email, agora: () => agora };
  if (mesmoCodigo.length === 0) {
    const r = await inserir(p, Instrumentos, campos, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE_INSTRUMENTOS, registroId: r.id }, agora);
    return;
  }
  const ultima = mesmoCodigo.reduce((a, b) => (b.versao_instrumento > a.versao_instrumento ? b : a));
  const atual = lerInstrumento(ultima);
  const usado = aplicacoes.ativos().some((a) => a.instrumento === atual.codigo && a.instrumento_versao === atual.versao);
  const motivo = recusaDeAlteracao(atual, novo, usado);
  if (motivo) throw new ErroAvaliacao(motivo);
  if (novo.versao === atual.versao) {
    const { colunasAlteradas } = await atualizar(p, Instrumentos, ultima.id, ultima.versao, campos, autoria);
    if (colunasAlteradas.length) {
      await registrarAuditoria(
        p,
        { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE_INSTRUMENTOS, registroId: ultima.id, detalhes: { colunas: colunasAlteradas } },
        agora,
      );
    }
    return;
  }
  const r = await inserir(p, Instrumentos, campos, autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE_INSTRUMENTOS, registroId: r.id }, agora);
}

// ---------------------------------------------------------------------------
// Pessoas que podem receber a aplicação
// ---------------------------------------------------------------------------

export interface PessoaParaAplicar {
  id: string;
  nome: string;
  iniciais: string;
  /** Serviços ativos da pessoa em que quem avalia tem permissão. */
  servicos: { codigo: string; nome: string }[];
}

async function dadosDePessoas(p: Planilhas) {
  const [pessoas, vinculosServico, vinculosFamiliares, servicos] = await lerTabelas(p, [Pessoas, VinculosServico, VinculosFamiliares, Servicos] as const);
  return {
    pessoas: pessoas.ativos(),
    vinculosServico: vinculosServico.ativos(),
    vinculosFamiliares: vinculosFamiliares.ativos(),
    servicos: servicos.ativos(),
  };
}

function servicosDaPessoa(d: Awaited<ReturnType<typeof dadosDePessoas>>, quem: Autorizador, pessoaId: string, hoje: string) {
  const nomes = new Map(d.servicos.filter((s) => !s.fim || s.fim >= hoje).map((s) => [s.codigo, s.nome]));
  const codigos = new Set(d.vinculosServico.filter((v) => v.pessoa_id === pessoaId && !v.saida).map((v) => v.servico));
  return [...codigos]
    .filter((c) => nomes.has(c) && podeAvaliar(quem, c))
    .map((c) => ({ codigo: c, nome: nomes.get(c)! }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Pessoas que quem avalia já vê no serviço (Autorizador) e que têm vínculo ativo num serviço do seu escopo. */
export async function pessoasParaAplicar(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<PessoaParaAplicar[]> {
  exigirAvaliador(quem);
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const d = await dadosDePessoas(p);
  return d.pessoas
    .filter((x) => quem.podeVerPessoa(x.id, d))
    .map((x) => {
      const nome = x.nome_social ?? x.nome;
      return { id: x.id, nome, iniciais: iniciaisDoNome(nome), servicos: servicosDaPessoa(d, quem, x.id, hoje) };
    })
    .filter((x) => x.servicos.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------------------------------------------------------------------------
// Aplicar, fechar, corrigir, desistir
// ---------------------------------------------------------------------------

export interface EntradaAplicacao {
  /** Só para continuar um rascunho. */
  id?: string;
  versao?: number;
  pessoaId: string;
  instrumento: string;
  servico: string;
  tipo: string;
  data: string;
  respostas: Respostas;
  profissional?: string;
  registroProfissional?: string;
  justificativa?: string;
}

export interface ResultadoAplicacao {
  id: string;
  versao: number;
  fechada: boolean;
  escore: Escore;
}

async function respostasDaAplicacao(p: Planilhas, id: string) {
  const [respostas] = await lerTabelas(p, [AbaRespostas] as const);
  return respostas.ativos().filter((r) => r.aplicacao_id === id);
}

/**
 * Guarda a aplicação como rascunho (`fechar = false`) ou conclui e assina (`fechar = true`).
 * Aplicação concluída não se edita (regra 6); a correção cria outra (`corrigirAplicacao`).
 */
export async function salvarAplicacao(
  p: Planilhas,
  quem: Autorizador,
  entrada: EntradaAplicacao,
  fechar: boolean,
  opcoes: { agora?: Date } = {},
): Promise<ResultadoAplicacao> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeEm(agora);
  exigirAvaliador(quem);
  const autoria = { email: quem.email, agora: () => agora };

  const [aplicacoes, abaRespostas] = await lerTabelas(p, [Aplicacoes, AbaRespostas] as const);
  const existente = entrada.id ? aplicacoes.porId(entrada.id) : undefined;
  if (entrada.id && (!existente || !existente.ativo)) throw new ErroAvaliacao('Aplicação não encontrada.');
  if (existente && existente.situacao === 'fechada') {
    throw new ErroAvaliacao('Esta aplicação já foi concluída e não se edita. Use "Corrigir" para criar uma nova.');
  }

  const pessoaId = existente?.pessoa_id ?? entrada.pessoaId;
  const instrumento = existente
    ? await instrumentoDaVersao(p, existente.instrumento, existente.instrumento_versao)
    : await instrumentoParaAplicar(p, quem, entrada.instrumento);

  // Regra 8: a pessoa existe, está ativa e é visível a quem avalia; o serviço é um vínculo ativo dela.
  const d = await dadosDePessoas(p);
  if (!d.pessoas.some((x) => x.id === pessoaId) || !quem.podeVerPessoa(pessoaId, d)) {
    throw new ErroAvaliacao('Escolha uma pessoa da lista.');
  }
  const servicosPermitidos = servicosDaPessoa(d, quem, pessoaId, hoje);
  const servico = servicosPermitidos.find((s) => s.codigo === (existente?.servico ?? entrada.servico));
  if (!servico) {
    if (!podeAvaliar(quem, existente?.servico ?? entrada.servico)) throw new ErroPermissao('Você não aplica instrumentos neste serviço.');
    throw new ErroAvaliacao('Escolha um dos serviços em que a pessoa está.');
  }

  if (!(TIPOS_APLICACAO as readonly string[]).includes(entrada.tipo)) throw new ErroAvaliacao('Escolha o tipo: inicial ou anual.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.data) || Number.isNaN(Date.parse(entrada.data))) throw new ErroAvaliacao('Informe a data da aplicação.');
  if (entrada.data > hoje) throw new ErroAvaliacao('A data da aplicação não pode ser no futuro.');

  // Regra 7: uma pessoa não tem duas aplicações abertas do mesmo instrumento.
  const aberta = aplicacoes
    .ativos()
    .find((a) => a.pessoa_id === pessoaId && a.instrumento === instrumento.codigo && a.situacao === 'aberta' && a.id !== existente?.id);
  if (aberta) throw new ErroAvaliacao('Esta pessoa já tem uma aplicação deste instrumento em aberto. Conclua ou desista dela antes de começar outra.');

  // Regra 3: cada resposta é um inteiro de 0 a 3 (ou "não se aplica", quando o item permite).
  for (const [numero, valor] of Object.entries(entrada.respostas)) {
    if (valor === undefined) continue;
    const motivo = recusaDeResposta(instrumento, Number(numero), valor);
    if (motivo) throw new ErroAvaliacao(motivo);
  }
  const justificativa = (entrada.justificativa ?? '').trim();
  if (fechar) {
    const motivo = recusaDeFechamento(instrumento, entrada.respostas, justificativa);
    if (motivo) throw new ErroAvaliacao(motivo);
  }

  const campos = {
    pessoa_id: pessoaId,
    instrumento: instrumento.codigo,
    instrumento_versao: instrumento.versao,
    servico: servico.codigo,
    servico_nome: servico.nome,
    tipo: entrada.tipo as RegAplicacao['tipo'],
    data: entrada.data,
    situacao: 'aberta' as const,
    profissional: entrada.profissional?.trim() || null,
    registro_profissional: entrada.registroProfissional?.trim() || null,
    justificativa: justificativa || null,
  };

  let id: string;
  let versao: number;
  if (!existente) {
    const novo = await inserir(p, Aplicacoes, { ...campos, corrige: null }, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: novo.id }, agora);
    id = novo.id;
    versao = novo.versao;
  } else {
    const r = await atualizar(p, Aplicacoes, existente.id, entrada.versao ?? -1, campos, autoria);
    if (r.colunasAlteradas.length) {
      await registrarAuditoria(
        p,
        { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: existente.id, detalhes: { colunas: r.colunasAlteradas } },
        agora,
      );
    }
    id = existente.id;
    versao = r.registro.versao;
  }

  // Respostas: grava só o que é novo ou mudou.
  const guardadas = new Map(abaRespostas.ativos().filter((r) => r.aplicacao_id === id).map((r) => [r.item, r]));
  const novas: { aplicacao_id: string; item: number; valor: string }[] = [];
  const mudadas: { id: string; versao: number; mudancas: { valor: string } }[] = [];
  for (const [numero, valor] of Object.entries(entrada.respostas)) {
    if (valor === undefined) continue;
    const item = Number(numero);
    const texto = respostaParaTexto(valor);
    const atual = guardadas.get(item);
    if (!atual) novas.push({ aplicacao_id: id, item, valor: texto });
    else if (atual.valor !== texto) mudadas.push({ id: atual.id, versao: atual.versao, mudancas: { valor: texto } });
  }
  if (novas.length) {
    await inserirRegistros(p, abaRespostas, novas, autoria);
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE_RESPOSTAS, registroId: id, detalhes: { colunas: ['valor'], itens: novas.length } },
      agora,
    );
  }
  if (mudadas.length) {
    await atualizarVarios(p, AbaRespostas, mudadas, autoria);
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE_RESPOSTAS, registroId: id, detalhes: { colunas: ['valor'], itens: mudadas.length } },
      agora,
    );
  }

  const escore = calcularEscore(instrumento, entrada.respostas);
  if (!fechar) return { id, versao, fechada: false, escore };

  const r = await atualizar(p, Aplicacoes, id, versao, { situacao: 'fechada' }, autoria);
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: id, detalhes: { colunas: r.colunasAlteradas, evento: 'fechamento' } },
    agora,
  );
  return { id, versao: r.registro.versao, fechada: true, escore };
}

async function instrumentoDaVersao(p: Planilhas, codigo: string, versao: number): Promise<Instrumento> {
  const [instrumentos] = await lerTabelas(p, [Instrumentos] as const);
  const r = instrumentos.ativos().find((x) => x.codigo === codigo && x.versao_instrumento === versao);
  if (!r) throw new ErroAvaliacao(`Falta o instrumento "${codigo}" na versão ${versao}.`);
  return lerInstrumento(r);
}

/**
 * Regra 6: a correção de uma aplicação concluída cria outra, ligada à anterior (`corrige`), com as mesmas
 * respostas para a equipe ajustar. A anterior continua no histórico.
 */
export async function corrigirAplicacao(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<{ id: string }> {
  const agora = opcoes.agora ?? new Date();
  exigirAvaliador(quem);
  const [aplicacoes, abaRespostas] = await lerTabelas(p, [Aplicacoes, AbaRespostas] as const);
  const original = aplicacoes.porId(id);
  if (!original || !original.ativo) throw new ErroAvaliacao('Aplicação não encontrada.');
  await autorizarAplicacao(p, quem, original);
  if (original.situacao !== 'fechada') throw new ErroAvaliacao('Só se corrige uma aplicação concluída; esta ainda está em aberto.');
  const jaCorrigida = aplicacoes.ativos().find((a) => a.corrige === id);
  if (jaCorrigida) throw new ErroAvaliacao('Esta aplicação já foi corrigida. Abra a correção.');
  const aberta = aplicacoes.ativos().find((a) => a.pessoa_id === original.pessoa_id && a.instrumento === original.instrumento && a.situacao === 'aberta');
  if (aberta) throw new ErroAvaliacao('Esta pessoa já tem uma aplicação deste instrumento em aberto. Conclua ou desista dela antes.');
  const autoria = { email: quem.email, agora: () => agora };
  const nova = await inserir(
    p,
    Aplicacoes,
    {
      pessoa_id: original.pessoa_id,
      instrumento: original.instrumento,
      instrumento_versao: original.instrumento_versao,
      servico: original.servico,
      servico_nome: original.servico_nome,
      tipo: original.tipo,
      data: original.data,
      situacao: 'aberta',
      corrige: original.id,
      profissional: original.profissional,
      registro_profissional: original.registro_profissional,
      justificativa: original.justificativa,
    },
    autoria,
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: nova.id, detalhes: { evento: 'correcao' } }, agora);
  const copia = abaRespostas
    .ativos()
    .filter((r) => r.aplicacao_id === original.id)
    .map((r) => ({ aplicacao_id: nova.id, item: r.item, valor: r.valor }));
  await inserirRegistros(p, abaRespostas, copia, autoria);
  return { id: nova.id };
}

/** Regra 12: aplicação aberta desistida fica com `ativo = FALSE` e o motivo. Nada é apagado. */
export async function desistirDaAplicacao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  motivo: string,
  opcoes: { agora?: Date } = {},
): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  exigirAvaliador(quem);
  if (motivo.trim().length < 3) throw new ErroAvaliacao('Escreva o motivo da desistência.');
  const [aplicacoes] = await lerTabelas(p, [Aplicacoes] as const);
  const atual = aplicacoes.porId(id);
  if (!atual || !atual.ativo) throw new ErroAvaliacao('Aplicação não encontrada.');
  await autorizarAplicacao(p, quem, atual);
  if (atual.situacao !== 'aberta') throw new ErroAvaliacao('Aplicação concluída não pode ser desfeita; use "Corrigir".');
  await atualizar(p, Aplicacoes, id, versao, { ativo: false, motivo_desistencia: motivo.trim() }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: 'encerramento', entidade: ENTIDADE, registroId: id, detalhes: { colunas: ['ativo', 'motivo_desistencia'] } },
    agora,
  );
}

/** Serviço da aplicação no escopo de quem avalia E pessoa visível pelo Autorizador. */
async function autorizarAplicacao(p: Planilhas, quem: Autorizador, a: RegAplicacao): Promise<void> {
  if (!podeAvaliar(quem, a.servico)) throw new ErroPermissao();
  const d = await dadosDePessoas(p);
  if (!quem.podeVerPessoa(a.pessoa_id, d)) throw new ErroPermissao();
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface LinhaAplicacao {
  id: string;
  iniciais: string;
  instrumento: string;
  instrumentoNome: string;
  servico: string;
  servicoNome: string;
  tipo: string;
  data: string;
  situacao: 'aberta' | 'fechada';
  /** Corrige outra aplicação. */
  corrige: boolean;
  /** Concluída e já substituída por uma correção. */
  corrigida: boolean;
}

/** Aplicações ativas dos serviços em que quem avalia tem permissão, da mais recente para a mais antiga. */
export async function listarAplicacoes(p: Planilhas, quem: Autorizador): Promise<LinhaAplicacao[]> {
  exigirAvaliador(quem);
  const [aplicacoes, instrumentos] = await lerTabelas(p, [Aplicacoes, Instrumentos] as const);
  const d = await dadosDePessoas(p);
  const nomes = new Map(d.pessoas.map((x) => [x.id, x.nome_social ?? x.nome]));
  const nomeInstrumento = new Map(instrumentos.ativos().map((i) => [i.codigo, i.nome]));
  const ativas = aplicacoes.ativos();
  const corrigidas = new Set(ativas.map((a) => a.corrige).filter(Boolean));
  return ativas
    .filter((a) => podeAvaliar(quem, a.servico) && quem.podeVerPessoa(a.pessoa_id, d))
    .sort((a, b) => b.data.localeCompare(a.data) || b.atualizado_em.localeCompare(a.atualizado_em))
    .map((a) => ({
      id: a.id,
      iniciais: iniciaisDoNome(nomes.get(a.pessoa_id) ?? ''),
      instrumento: a.instrumento,
      instrumentoNome: nomeInstrumento.get(a.instrumento) ?? a.instrumento,
      servico: a.servico,
      servicoNome: a.servico_nome,
      tipo: a.tipo,
      data: a.data,
      situacao: a.situacao,
      corrige: Boolean(a.corrige),
      corrigida: corrigidas.has(a.id),
    }));
}

export interface AplicacaoDetalhada {
  id: string;
  versao: number;
  pessoaId: string;
  iniciais: string;
  instrumento: Instrumento;
  servico: string;
  servicoNome: string;
  tipo: string;
  data: string;
  situacao: 'aberta' | 'fechada';
  profissional: string;
  registroProfissional: string;
  justificativa: string;
  respostas: Respostas;
  escore: Escore;
  /** Aplicação que esta corrige, e a que a corrigiu. */
  corrige: string | null;
  corrigidaPor: string | null;
  criadoPor: string;
  atualizadoEm: string;
}

/** Abre uma aplicação (inclui respostas e justificativa). Registra a leitura na auditoria. */
export async function detalharAplicacao(p: Planilhas, quem: Autorizador, id: string): Promise<AplicacaoDetalhada> {
  exigirAvaliador(quem);
  const [aplicacoes] = await lerTabelas(p, [Aplicacoes] as const);
  const a = aplicacoes.porId(id);
  if (!a || !a.ativo) throw new ErroAvaliacao('Aplicação não encontrada.');
  await autorizarAplicacao(p, quem, a);
  const instrumento = await instrumentoDaVersao(p, a.instrumento, a.instrumento_versao);
  const respostas = montarRespostas(await respostasDaAplicacao(p, a.id));
  const d = await dadosDePessoas(p);
  const pessoa = d.pessoas.find((x) => x.id === a.pessoa_id);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: id });
  return {
    id: a.id,
    versao: a.versao,
    pessoaId: a.pessoa_id,
    iniciais: iniciaisDoNome(pessoa ? (pessoa.nome_social ?? pessoa.nome) : ''),
    instrumento,
    servico: a.servico,
    servicoNome: a.servico_nome,
    tipo: a.tipo,
    data: a.data,
    situacao: a.situacao,
    profissional: a.profissional ?? '',
    registroProfissional: a.registro_profissional ?? '',
    justificativa: a.justificativa ?? '',
    respostas,
    escore: calcularEscore(instrumento, respostas),
    corrige: a.corrige,
    corrigidaPor: aplicacoes.ativos().find((x) => x.corrige === a.id)?.id ?? null,
    criadoPor: a.criado_por,
    atualizadoEm: a.atualizado_em,
  };
}

export interface ComparativoDaPessoa {
  iniciais: string;
  instrumentoNome: string;
  instrumentoCodigo: string;
  comparativo: ComparativoMotor;
  /** Data e enquadramento de cada ciclo comparado, na mesma ordem de `comparativo.pontos`. */
  ciclos: { id: string; data: string; servicoNome: string; enquadramento: string | null; justificativa: string }[];
  reavaliacao: { vence: string; situacao: SituacaoReavaliacao; dias: number } | null;
  /** Aplicação aberta da pessoa neste instrumento, se houver. */
  abertaId: string | null;
}

/**
 * Comparativo das aplicações concluídas da mesma pessoa e instrumento (só da mesma versão; o motor avisa
 * quando as versões diferem). Aplicação já corrigida sai: vale a correção. Registra leitura na auditoria.
 */
export async function comparativoDaPessoa(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<ComparativoDaPessoa> {
  const hoje = hojeEm(opcoes.agora ?? new Date());
  exigirAvaliador(quem);
  const [aplicacoes, instrumentos] = await lerTabelas(p, [Aplicacoes, Instrumentos] as const);
  const base = aplicacoes.porId(id);
  if (!base || !base.ativo) throw new ErroAvaliacao('Aplicação não encontrada.');
  await autorizarAplicacao(p, quem, base);
  const d = await dadosDePessoas(p);
  const ativas = aplicacoes.ativos();
  const corrigidas = new Set(ativas.filter((a) => a.situacao === 'fechada').map((a) => a.corrige).filter(Boolean));
  const daPessoa = ativas.filter((a) => a.pessoa_id === base.pessoa_id && a.instrumento === base.instrumento && podeAvaliar(quem, a.servico));
  const fechadas = daPessoa.filter((a) => a.situacao === 'fechada' && !corrigidas.has(a.id));
  const todasRespostas = (await lerTabelas(p, [AbaRespostas] as const))[0].ativos();
  const ciclos = fechadas.map((a) => ({
    id: a.id,
    data: a.data,
    versao: a.instrumento_versao,
    respostas: montarRespostas(todasRespostas.filter((r) => r.aplicacao_id === a.id)),
  }));
  const versoes = [...new Set(fechadas.map((a) => a.instrumento_versao))];
  const usados = instrumentos.ativos().filter((i) => i.codigo === base.instrumento && versoes.includes(i.versao_instrumento)).map(lerInstrumento);
  const comparativo = compararCiclos(usados, ciclos);
  const instrumentoBase = instrumentos.ativos().find((i) => i.codigo === base.instrumento && i.versao_instrumento === base.instrumento_versao);
  const pessoa = d.pessoas.find((x) => x.id === base.pessoa_id);
  const porId = new Map(fechadas.map((a) => [a.id, a]));
  const ultima = fechadas.map((a) => a.data).sort().at(-1);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: id, detalhes: { comparativo: comparativo.pontos.length } });
  return {
    iniciais: iniciaisDoNome(pessoa ? (pessoa.nome_social ?? pessoa.nome) : ''),
    instrumentoNome: instrumentoBase?.nome ?? base.instrumento,
    instrumentoCodigo: base.instrumento,
    comparativo,
    ciclos: comparativo.pontos.map((pt) => ({
      id: pt.id,
      data: pt.data,
      servicoNome: porId.get(pt.id)?.servico_nome ?? '',
      enquadramento: pt.escore.enquadramento?.nome ?? null,
      justificativa: porId.get(pt.id)?.justificativa ?? '',
    })),
    reavaliacao: ultima ? situacaoReavaliacao(ultima, hoje) : null,
    abertaId: daPessoa.find((a) => a.situacao === 'aberta')?.id ?? null,
  };
}
