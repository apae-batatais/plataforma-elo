/**
 * Casos de uso do app Saúde (avaliação de evolução no CER). Camada de aplicação.
 *
 * Quem faz o quê:
 * - "saude.avaliar" no serviço (global, da unidade, da área ou do próprio serviço) aplica, fecha,
 *   corrige, abre e desiste de avaliações dos serviços da área Saúde do seu escopo.
 * - "saude.ciente" (Diretoria e coordenação) dá o "ciente" numa aplicação fechada.
 * A pessoa avaliada só aparece se o Autorizador permitir vê-la e se tiver vínculo ativo com o serviço.
 * Abrir uma aplicação registra leitura; incluir, alterar, fechar e dar o ciente registram as colunas
 * alteradas (nunca os valores).
 */
import { calcularEscore, definirInstrumento, dominiosDeMenorPercentual, recusaDeFechamento, recusaDeResposta, vencimentoDaReavaliacao } from '@/capacidades/motor-avaliacao';
import type { Escore, EscoreDominio, Faixa, Instrumento, Respostas as RespostasDoMotor } from '@/capacidades/motor-avaliacao';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas, type Registro } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Pessoas, Servicos, Usuarios, VinculosFamiliares, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { Aplicacoes, Instrumentos, Respostas } from '../dados/tabelas';
import { AREA_SAUDE, CODIGO_CER, ErroSaude, INSTRUMENTO_CER, MESES_ENTRE_AVALIACOES, recusaDePeriodo } from '../dominio/cer';

export const PERM = {
  acessar: 'saude.acessar',
  avaliar: 'saude.avaliar',
  painel: 'saude.painel',
  ciente: 'saude.ciente',
} as const;

const ENTIDADE = 'saude.Aplicacoes';
type RegAplicacao = Registro<typeof Aplicacoes.esquema>;

const hojeEm = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília
const podeAvaliar = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.avaliar, { tipo: 'servico', codigo: servico });
const podeDarCiente = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.ciente, { tipo: 'servico', codigo: servico });

// ---------------------------------------------------------------------------
// Instrumentos (dado versionado)
// ---------------------------------------------------------------------------

function instrumentosDaTabela(linhas: { codigo: string; versao_instrumento: number; definicao: string }[]): Map<number, Instrumento> {
  const porVersao = new Map<number, Instrumento>([[INSTRUMENTO_CER.versao, INSTRUMENTO_CER]]);
  for (const l of linhas.filter((x) => x.codigo === CODIGO_CER)) porVersao.set(l.versao_instrumento, definirInstrumento(JSON.parse(l.definicao)));
  return porVersao;
}

/** Instrumento do CER na versão mais recente e todas as versões conhecidas. */
export async function instrumentosDoCer(p: Planilhas): Promise<{ atual: Instrumento; porVersao: Map<number, Instrumento> }> {
  const [tabela] = await lerTabelas(p, [Instrumentos] as const);
  const porVersao = instrumentosDaTabela(tabela.ativos());
  return { atual: porVersao.get(Math.max(...porVersao.keys()))!, porVersao };
}

// ---------------------------------------------------------------------------
// Quem pode ser avaliado e onde
// ---------------------------------------------------------------------------

export interface ServicoDeSaude {
  codigo: string;
  nome: string;
}

export interface PessoaParaAvaliar {
  id: string;
  nome: string;
  /** Serviços de Saúde do seu escopo em que a pessoa tem vínculo ativo; `entrada` = data de ingresso, se houver. */
  servicos: { codigo: string; nome: string; entrada: string | null }[];
}

/** Pessoas visíveis a quem avalia, com vínculo ativo em serviço de Saúde do escopo. */
export async function pessoasParaAvaliar(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<PessoaParaAvaliar[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const [pessoas, vinculos, familiares, servicos] = await lerTabelas(p, [Pessoas, VinculosServico, VinculosFamiliares, Servicos] as const);
  const dados = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };
  const doEscopo = new Map(
    servicos
      .ativos()
      .filter((s) => s.area === AREA_SAUDE && (!s.fim || s.fim >= hoje) && podeAvaliar(quem, s.codigo))
      .map((s) => [s.codigo, s.nome]),
  );
  return dados.pessoas
    .map((pessoa) => ({
      id: pessoa.id,
      nome: pessoa.nome_social ?? pessoa.nome,
      servicos: dados.vinculosServico
        .filter((v) => v.pessoa_id === pessoa.id && !v.saida && doEscopo.has(v.servico))
        .map((v) => ({ codigo: v.servico, nome: doEscopo.get(v.servico)!, entrada: v.entrada })),
    }))
    .filter((x) => x.servicos.length > 0 && quem.podeVerPessoa(x.id, dados))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function respostasDe(linhas: { aplicacao_id: string; item: number; valor: number }[], aplicacaoId: string): RespostasDoMotor {
  const r: RespostasDoMotor = {};
  for (const l of linhas) if (l.aplicacao_id === aplicacaoId) r[l.item] = l.valor;
  return r;
}

export interface LinhaAplicacao {
  id: string;
  pessoaNome: string;
  servico: string;
  servicoNome: string;
  periodoInicio: string;
  periodoFim: string;
  situacao: 'aberta' | 'fechada';
  /** Fechada que foi substituída por uma correção. */
  corrigida: boolean;
  total: number | null;
  faixa: string | null;
  cienteEm: string | null;
  /** Só na aplicação fechada mais recente da pessoa: quando vence a próxima avaliação. */
  proximaAvaliacao: string | null;
}

/** Aplicações dos serviços de Saúde em que você avalia e de pessoas que você pode ver, da mais recente à mais antiga. */
export async function listarAplicacoes(p: Planilhas, quem: Autorizador): Promise<LinhaAplicacao[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [aplicacoes, respostas, instrumentos, pessoas, vinculos, familiares] = await lerTabelas(p, [Aplicacoes, Respostas, Instrumentos, Pessoas, VinculosServico, VinculosFamiliares] as const);
  const dados = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };
  const nomes = new Map(dados.pessoas.map((x) => [x.id, x.nome_social ?? x.nome]));
  const porVersao = instrumentosDaTabela(instrumentos.ativos());
  const todas = aplicacoes.ativos();
  const corrigidas = new Set(todas.map((a) => a.corrige).filter((x): x is string => !!x));
  const visiveis = todas
    .filter((a) => podeAvaliar(quem, a.servico) && quem.podeVerPessoa(a.pessoa_id, dados))
    .sort((a, b) => b.periodo_fim.localeCompare(a.periodo_fim) || b.criado_em.localeCompare(a.criado_em));
  const ativasRespostas = respostas.ativos();
  const maisRecente = new Map<string, string>();
  for (const a of visiveis.filter((x) => x.situacao === 'fechada' && !corrigidas.has(x.id)).sort((x, y) => (y.data_assinatura ?? '').localeCompare(x.data_assinatura ?? ''))) {
    if (!maisRecente.has(a.pessoa_id)) maisRecente.set(a.pessoa_id, a.id);
  }
  return visiveis.map((a) => {
    const inst = porVersao.get(a.versao_instrumento);
    const escore = inst ? calcularEscore(inst, respostasDe(ativasRespostas, a.id)) : null;
    return {
      id: a.id,
      pessoaNome: nomes.get(a.pessoa_id) ?? 'Pessoa fora do cadastro',
      servico: a.servico,
      servicoNome: a.servico_nome,
      periodoInicio: a.periodo_inicio,
      periodoFim: a.periodo_fim,
      situacao: a.situacao,
      corrigida: corrigidas.has(a.id),
      total: escore?.completo ? escore.total : null,
      faixa: escore?.enquadramento?.nome ?? null,
      cienteEm: a.ciente_em,
      proximaAvaliacao: maisRecente.get(a.pessoa_id) === a.id && a.data_assinatura ? vencimentoDaReavaliacao(a.data_assinatura) : null,
    };
  });
}

export interface AplicacaoDetalhada {
  id: string;
  /** Versão do registro (para gravar sem sobrescrever outra pessoa). */
  versao: number;
  pessoaId: string;
  pessoaNome: string;
  servico: string;
  servicoNome: string;
  periodoInicio: string;
  periodoFim: string;
  dataIngresso: string;
  situacao: 'aberta' | 'fechada';
  corrige: string | null;
  corrigida: boolean;
  profissional: string;
  funcao: string;
  dataAssinatura: string | null;
  cienteEm: string | null;
  cientePor: string | null;
  justificativa: string;
  instrumento: Instrumento;
  respostas: RespostasDoMotor;
  escore: Escore;
  /** Faixa em que o total cai (só com todos os itens respondidos). */
  faixa: Faixa | null;
  /** Dimensão(ões) de menor percentual do máximo; só com a aplicação completa. */
  principalBarreira: EscoreDominio[];
  podeDarCiente: boolean;
  proximaAvaliacao: string | null;
}

/** Abre uma aplicação. Registra a leitura na auditoria (dado sensível). */
export async function detalharAplicacao(p: Planilhas, quem: Autorizador, id: string): Promise<AplicacaoDetalhada> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const [aplicacoes, respostas, instrumentos, pessoas, vinculos, familiares, usuarios] = await lerTabelas(p, [Aplicacoes, Respostas, Instrumentos, Pessoas, VinculosServico, VinculosFamiliares, Usuarios] as const);
  const a = aplicacoes.porId(id);
  if (!a || !a.ativo) throw new ErroSaude('Avaliação não encontrada.');
  const dados = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };
  if (!podeAvaliar(quem, a.servico) || !quem.podeVerPessoa(a.pessoa_id, dados)) throw new ErroPermissao('Você não avalia neste serviço.');
  const instrumento = instrumentosDaTabela(instrumentos.ativos()).get(a.versao_instrumento);
  if (!instrumento) throw new ErroSaude(`Falta o instrumento na versão ${a.versao_instrumento}.`);
  const respondidas = respostasDe(respostas.ativos(), a.id);
  const escore = calcularEscore(instrumento, respondidas);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: id });
  const pessoa = dados.pessoas.find((x) => x.id === a.pessoa_id);
  const nomeDoUsuario = (email: string) => {
    const pid = usuarios.ativos().find((u) => u.email === email)?.pessoa_id;
    const dona = pid ? dados.pessoas.find((x) => x.id === pid) : undefined;
    return dona ? (dona.nome_social ?? dona.nome) : email;
  };
  const cientePor = a.ciente_por ? (nomeDoUsuario(a.ciente_por)) : null;
  return {
    id: a.id,
    versao: a.versao,
    pessoaId: a.pessoa_id,
    pessoaNome: pessoa ? (pessoa.nome_social ?? pessoa.nome) : 'Pessoa fora do cadastro',
    servico: a.servico,
    servicoNome: a.servico_nome,
    periodoInicio: a.periodo_inicio,
    periodoFim: a.periodo_fim,
    dataIngresso: a.data_ingresso,
    situacao: a.situacao,
    corrige: a.corrige,
    corrigida: aplicacoes.ativos().some((x) => x.corrige === a.id),
    profissional: a.profissional ?? '',
    funcao: a.funcao ?? '',
    dataAssinatura: a.data_assinatura,
    cienteEm: a.ciente_em,
    cientePor,
    justificativa: a.justificativa ?? '',
    instrumento,
    respostas: respondidas,
    escore,
    faixa: escore.enquadramento,
    principalBarreira: escore.completo ? dominiosDeMenorPercentual(escore) : [],
    podeDarCiente: a.situacao === 'fechada' && !a.ciente_em && podeDarCiente(quem, a.servico),
    proximaAvaliacao: a.situacao === 'fechada' && a.data_assinatura ? vencimentoDaReavaliacao(a.data_assinatura) : null,
  };
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export interface DadosAplicacao {
  pessoaId: string;
  servico: string;
  periodoInicio: string;
  periodoFim: string;
  dataIngresso: string;
  profissional: string;
  funcao: string;
  justificativa: string;
  respostas: Record<number, number | undefined>;
}

export interface OpcoesDeGravacao {
  /** Aplicação aberta que está sendo editada, com a versão lida. */
  id?: string;
  versao?: number;
  /** Fecha a aplicação (assina). Sem isto, grava como aberta (rascunho). */
  concluir?: boolean;
  /** Só na criação: fechada que a nova aplicação corrige. */
  corrige?: string;
  agora?: Date;
}

/**
 * Grava uma aplicação nova ou edita uma aberta, e opcionalmente a fecha.
 * Fechar exige os 10 itens, a justificativa, o profissional e a função (regras 3, 5 e 7).
 */
export async function salvarAplicacao(
  p: Planilhas,
  quem: Autorizador,
  bruto: DadosAplicacao,
  opcoes: OpcoesDeGravacao = {},
): Promise<{ id: string; total: number | null; faixa: string | null; fechada: boolean }> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeEm(agora);
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();

  const [aplicacoes, respostas, instrumentos, servicos, pessoas, vinculos, familiares] = await lerTabelas(p, [Aplicacoes, Respostas, Instrumentos, Servicos, Pessoas, VinculosServico, VinculosFamiliares] as const);
  const dadosPessoas = { pessoas: pessoas.ativos(), vinculosServico: vinculos.ativos(), vinculosFamiliares: familiares.ativos() };

  const servico = servicos.ativos().find((s) => s.codigo === bruto.servico && s.area === AREA_SAUDE);
  if (!servico) throw new ErroSaude('Escolha um serviço da área Saúde.');
  if (!podeAvaliar(quem, servico.codigo)) throw new ErroPermissao('Você não avalia neste serviço.');
  const pessoa = dadosPessoas.pessoas.find((x) => x.id === bruto.pessoaId);
  if (!pessoa || !quem.podeVerPessoa(pessoa.id, dadosPessoas)) throw new ErroSaude('Escolha uma pessoa da lista.');
  if (!dadosPessoas.vinculosServico.some((v) => v.pessoa_id === pessoa.id && v.servico === servico.codigo && !v.saida)) {
    throw new ErroSaude('Esta pessoa não tem vínculo ativo com o serviço escolhido.');
  }
  const motivoPeriodo = recusaDePeriodo(bruto, hoje);
  if (motivoPeriodo) throw new ErroSaude(motivoPeriodo);

  const atual = opcoes.id ? aplicacoes.porId(opcoes.id) : undefined;
  if (opcoes.id) {
    if (!atual || !atual.ativo) throw new ErroSaude('Avaliação não encontrada.');
    if (atual.situacao === 'fechada') throw new ErroSaude('Avaliação fechada não se edita. Use “Corrigir” para criar uma nova.');
    if (atual.pessoa_id !== pessoa.id) throw new ErroSaude('A pessoa de uma avaliação aberta não muda.');
    if (!podeAvaliar(quem, atual.servico)) throw new ErroPermissao();
  }

  const porVersao = instrumentosDaTabela(instrumentos.ativos());
  const instrumento = atual ? porVersao.get(atual.versao_instrumento)! : porVersao.get(Math.max(...porVersao.keys()))!;
  for (const [n, v] of Object.entries(bruto.respostas)) {
    if (v === undefined) continue;
    const motivo = recusaDeResposta(instrumento, Number(n), v);
    if (motivo) throw new ErroSaude(motivo);
  }
  const respondidas: RespostasDoMotor = Object.fromEntries(Object.entries(bruto.respostas).filter(([, v]) => v !== undefined)) as RespostasDoMotor;
  if (opcoes.concluir) {
    const motivo = recusaDeFechamento(instrumento, respondidas, bruto.justificativa);
    if (motivo) throw new ErroSaude(motivo);
    if (!bruto.profissional.trim() || !bruto.funcao.trim()) throw new ErroSaude('Informe o profissional e a função para concluir.');
  }

  // Regra 9: uma pessoa não tem duas aplicações abertas do mesmo instrumento ao mesmo tempo.
  const jaAberta = aplicacoes
    .ativos()
    .some((a) => a.pessoa_id === pessoa.id && a.instrumento === CODIGO_CER && a.situacao === 'aberta' && a.id !== opcoes.id);
  if (jaAberta) throw new ErroSaude('Esta pessoa já tem uma avaliação aberta. Conclua ou desista dela antes de começar outra.');

  if (!opcoes.id && opcoes.corrige) {
    const original = aplicacoes.porId(opcoes.corrige);
    if (!original || !original.ativo || original.situacao !== 'fechada' || original.pessoa_id !== pessoa.id) throw new ErroSaude('Só uma avaliação fechada da mesma pessoa pode ser corrigida.');
    if (aplicacoes.ativos().some((a) => a.corrige === original.id)) throw new ErroSaude('Esta avaliação já foi corrigida.');
  }

  const autoria = { email: quem.email, agora: () => agora };
  const campos = {
    servico: servico.codigo,
    servico_nome: servico.nome,
    periodo_inicio: bruto.periodoInicio,
    periodo_fim: bruto.periodoFim,
    data_ingresso: bruto.dataIngresso,
    profissional: bruto.profissional.trim() || null,
    funcao: bruto.funcao.trim() || null,
    justificativa: bruto.justificativa.trim() || null,
    ...(opcoes.concluir ? { situacao: 'fechada' as const, data_assinatura: hoje } : {}),
  };

  let id: string;
  if (!atual) {
    // O instrumento entra na planilha como dado na primeira vez que é usado.
    const naPlanilha = instrumentos.ativos().some((i) => i.codigo === instrumento.codigo && i.versao_instrumento === instrumento.versao);
    if (!naPlanilha) {
      const inst = await inserir(p, Instrumentos, { codigo: instrumento.codigo, versao_instrumento: instrumento.versao, nome: instrumento.nome, definicao: JSON.stringify(instrumento) }, autoria);
      await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'saude.Instrumentos', registroId: inst.id }, agora);
    }
    const novo = await inserir(
      p,
      Aplicacoes,
      { pessoa_id: pessoa.id, instrumento: instrumento.codigo, versao_instrumento: instrumento.versao, situacao: 'aberta', corrige: opcoes.corrige ?? null, ...campos },
      autoria,
    );
    id = novo.id;
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: id, ...(opcoes.corrige ? { detalhes: { corrige: opcoes.corrige } } : {}) }, agora);
  } else {
    id = atual.id;
    const { colunasAlteradas } = await atualizar(p, Aplicacoes, id, opcoes.versao ?? -1, campos, autoria);
    if (colunasAlteradas.length) {
      await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: id, detalhes: { colunas: colunasAlteradas, ...(opcoes.concluir ? { fechamento: true } : {}) } }, agora);
    }
  }

  // Respostas: o que já existe é atualizado; o que é novo entra (nada é apagado).
  const existentes = new Map(respostas.ativos().filter((r) => r.aplicacao_id === id).map((r) => [r.item, r]));
  const novas: { aplicacao_id: string; item: number; valor: number }[] = [];
  let alteradas = 0;
  for (const [n, valor] of Object.entries(respondidas) as [string, number][]) {
    const item = Number(n);
    const ja = existentes.get(item);
    if (!ja) novas.push({ aplicacao_id: id, item, valor });
    else if (ja.valor !== valor) {
      await atualizar(p, Respostas, ja.id, ja.versao, { valor }, autoria);
      alteradas += 1;
    }
  }
  if (novas.length) await inserirRegistros(p, respostas, novas, autoria);
  if (novas.length || alteradas) {
    await registrarAuditoria(p, { usuario: quem.email, acao: novas.length && !alteradas ? 'inclusao' : 'alteracao', entidade: 'saude.Respostas', registroId: id, detalhes: { colunas: ['valor'] } }, agora);
  }

  const escore = calcularEscore(instrumento, respondidas);
  return { id, total: escore.completo ? escore.total : null, faixa: escore.enquadramento?.nome ?? null, fechada: Boolean(opcoes.concluir) };
}

/** Regra 11: só quem tem `saude.ciente` no serviço, só em aplicação fechada, uma vez; não mexe nas respostas. */
export async function darCiente(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: { agora?: Date } = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const [aplicacoes] = await lerTabelas(p, [Aplicacoes] as const);
  const a = aplicacoes.porId(id);
  if (!a || !a.ativo) throw new ErroSaude('Avaliação não encontrada.');
  if (!podeDarCiente(quem, a.servico) || !podeAvaliar(quem, a.servico)) throw new ErroPermissao('Só a coordenação técnica dá o ciente.');
  if (a.situacao !== 'fechada') throw new ErroSaude('O ciente só vale para avaliação concluída.');
  if (a.ciente_em) throw new ErroSaude('O ciente já foi dado.');
  const { colunasAlteradas } = await atualizar(p, Aplicacoes, id, versao, { ciente_por: quem.email, ciente_em: agora.toISOString() }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: id, detalhes: { colunas: colunasAlteradas, ciente: true } }, agora);
}

/** Regra 15: avaliação aberta desistida fica com `ativo = FALSE` e o motivo. A fechada só é corrigida. */
export async function desistirDaAplicacao(p: Planilhas, quem: Autorizador, id: string, versao: number, motivo: string, opcoes: { agora?: Date } = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (motivo.trim().length < 3) throw new ErroSaude('Escreva o motivo da desistência.');
  const [aplicacoes] = await lerTabelas(p, [Aplicacoes] as const);
  const a: RegAplicacao | undefined = aplicacoes.porId(id);
  if (!a || !a.ativo) throw new ErroSaude('Avaliação não encontrada.');
  if (!podeAvaliar(quem, a.servico)) throw new ErroPermissao();
  if (a.situacao !== 'aberta') throw new ErroSaude('Avaliação fechada não se desiste: use “Corrigir”.');
  await atualizar(p, Aplicacoes, id, versao, { ativo: false, motivo_desistencia: motivo.trim() }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: ENTIDADE, registroId: id, detalhes: { colunas: ['ativo', 'motivo_desistencia'] } }, agora);
}

export { MESES_ENTRE_AVALIACOES };
