/**
 * Fase 4 (entrega P4): problemas, pedidos de mudança e relatório de monitoramento.
 * Tudo aqui só vale com o projeto em implementação e Termo de Abertura aprovado (regra 13).
 * Textos e valores nunca vão para a auditoria nem para o histórico (só as colunas alteradas).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atividades, PedidosMudanca, Problemas, ProjetoDocumentos, ProjetoOrcamento, Projetos, Relatorios, Riscos, type RegAtividade, type RegPedido, type RegProblema, type RegProjeto, type RegRelatorio, type RegRisco } from '../dados/tabelas';
import {
  avaliarCusto,
  avaliarEscopo,
  avaliarPrazo,
  ePior,
  eMelhor,
  foraDaTolerancia,
  fraseDaVariacao,
  planejadoPct,
  problemaAberto,
  quemDecide,
  realizadoPct,
  SITUACOES_RELATORIO,
  situacaoCalculada,
  TIPOS_MUDANCA,
  type AvaliacaoPedido,
  type SituacaoRelatorio,
  type TipoMudanca,
} from '../dominio/acompanhamento';
import { GRAUS, toleranciasDoTermo, type Grau, type Tolerancias } from '../dominio/fases';
import { hojeEmBrasilia, lerData, lerValor, situacaoExibida, totalOrcamento } from '../dominio/planejamento';
import { ErroProjetos } from '../dominio/projeto';
import { auditar, autoriaDe, designado, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import { conteudoDe, exigirTermoAprovado, podeGerenciar, projetoVisivel } from './fases';
import { fotografarIndicadores } from './indicadores';
import type { NumerosDePessoas } from './indicadores';

/** Só quem gerencia o projeto, com o projeto em implementação e Termo aprovado (regra 13). */
async function projetoEmImplementacao(p: Planilhas, quem: Autorizador, id: string, tambemEncerramento = false) {
  const r = await projetoVisivel(p, quem, id);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera esta parte.');
  if (r.etapa !== 'implementacao' && !(tambemEncerramento && r.etapa === 'encerramento')) throw new ErroProjetos('Esta parte só funciona com o projeto em implementação.');
  const termo = await exigirTermoAprovado(p, id);
  return { r, termo };
}

// ---------- Problemas (regra 21) ----------

export interface DadosProblema {
  descricao: string;
  gravidade: Grau;
  dono: string | null;
}

export async function registrarProblema(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosProblema, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoEmImplementacao(p, quem, projetoId);
  if (!d.descricao.trim()) throw new ErroProjetos('Descreva o problema.');
  if (!GRAUS.includes(d.gravidade)) throw new ErroProjetos('Escolha a gravidade.');
  const campos = {
    projeto_id: projetoId,
    descricao: d.descricao.trim(),
    gravidade: d.gravidade,
    dono: d.dono?.trim().toLowerCase() || null,
    aberto_em: hojeEmBrasilia(agora),
    aberto_por: quem.email,
    solucao: null,
    resolvido_em: null,
  };
  const novo = await inserir(p, Problemas, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Problemas', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Problema registrado', null, agora);
}

/** Regra 21: o problema só sai da carteira com solução e data. */
export async function resolverProblema(p: Planilhas, quem: Autorizador, projetoId: string, problemaId: string, versao: number, solucao: string, data: string, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  // Na fase 5 ainda se resolve o que ficou aberto: a porta de encerramento exige problemas tratados (regra 23).
  await projetoEmImplementacao(p, quem, projetoId, true);
  const [problemas] = await lerTabelas(p, [Problemas] as const);
  const x = problemas.porId(problemaId);
  if (!x || !x.ativo || x.projeto_id !== projetoId) throw new ErroProjetos('Problema não encontrado.');
  if (!problemaAberto(x)) throw new ErroProjetos('Este problema já foi resolvido.');
  const texto = solucao.trim();
  if (!texto) throw new ErroProjetos('Escreva como o problema foi resolvido.');
  const dia = lerData(data, 'Data da solução');
  if (dia > hojeEmBrasilia(agora)) throw new ErroProjetos('A data da solução não pode estar no futuro.');
  if (dia < x.aberto_em) throw new ErroProjetos('A data da solução não pode vir antes da abertura do problema.');
  const { colunasAlteradas } = await atualizar(p, Problemas, problemaId, versao, { solucao: texto, resolvido_em: dia }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Problemas', problemaId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Problema resolvido', null, agora);
}

// ---------- Pedidos de mudança (regras 16 a 19) ----------

export interface DadosPedido {
  tipo: TipoMudanca;
  /** Custo: id da linha do orçamento. Prazo: "projeto" ou id da atividade. */
  alvo: string | null;
  /** Custo: valor em reais. Prazo: data AAAA-MM-DD. Escopo: o novo texto do escopo. */
  proposto: string;
  justificativa: string;
  /** Escopo: a pessoa declara que a mudança cabe no "escopo livre" do Termo. */
  cabeNoEscopoLivre?: boolean;
}

export interface PedidoAvaliado {
  avaliacao: AvaliacaoPedido;
  exigeAlcada: boolean;
  atual: string;
  proposto: string;
  alvo: string | null;
  /** Rótulo do que muda (linha, atividade, projeto). */
  alvoNome: string;
  frase: string;
  quem: string;
}

const textoNumero = (n: number) => String(n);
const versaoDoTermo = (termo: { numero: number }) => termo.numero;

/** Primeiro pedido já aplicado sobre o mesmo alvo desde a versão do Termo: dá a base de comparação (regra 19). */
function baseDoAlvo(pedidos: readonly RegPedido[], projetoId: string, tipo: TipoMudanca, alvo: string | null, versaoBase: number, valorAtual: string): string {
  const antigos = pedidos
    .filter((x) => x.projeto_id === projetoId && x.tipo === tipo && x.alvo === alvo && x.versao_termo_base === versaoBase && (x.situacao === 'aplicada' || x.situacao === 'aprovada'))
    .sort((a, b) => a.pedido_em.localeCompare(b.pedido_em));
  return antigos[0]?.atual ?? valorAtual;
}

/** Faz as contas do pedido sem gravar nada (a tela mostra isto antes de enviar). */
export async function avaliarPedido(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosPedido): Promise<PedidoAvaliado> {
  const { r, termo } = await projetoEmImplementacao(p, quem, projetoId);
  return (await avaliar(p, r, termo, d)).resultado;
}

async function avaliar(p: Planilhas, r: RegProjeto, termo: { numero: number; conteudo: string }, d: DadosPedido) {
  if (!TIPOS_MUDANCA.includes(d.tipo)) throw new ErroProjetos('Escolha o tipo da mudança: prazo, custo ou escopo.');
  const config = await lerConfig(p);
  const conteudo = JSON.parse(termo.conteudo) as Record<string, string | number | null>;
  const tol = toleranciasDoTermo(conteudo);
  const [pedidos, linhas, atividades] = await lerTabelas(p, [PedidosMudanca, ProjetoOrcamento, Atividades] as const);
  const versaoBase = versaoDoTermo(termo);
  const base = (alvo: string | null, atual: string) => baseDoAlvo(pedidos.ativos(), r.id, d.tipo, alvo, versaoBase, atual);
  const proposto = d.proposto.trim();
  if (!proposto) throw new ErroProjetos('Diga o que muda: o novo valor, a nova data ou o novo escopo.');
  const exigeAlcada = (novoTotal: number) => config.limiteAlcada !== null && novoTotal > config.limiteAlcada;

  if (d.tipo === 'custo') {
    const linha = linhas.porId(d.alvo ?? '');
    if (!linha || !linha.ativo || linha.projeto_id !== r.id) throw new ErroProjetos('Escolha a linha do orçamento que muda.');
    const novo = lerValor(proposto);
    if (novo === linha.valor_planejado) throw new ErroProjetos('O valor proposto é igual ao atual.');
    const doProjeto = linhas.ativos().filter((l) => l.projeto_id === r.id);
    const totalAtual = totalOrcamento(doProjeto);
    const novoTotal = Math.round((totalAtual - linha.valor_planejado + novo) * 100) / 100;
    const avaliacao = avaliarCusto({
      baseLinha: Number(base(linha.id, textoNumero(linha.valor_planejado))),
      novoLinha: novo,
      baseTotal: r.valor_aprovado ?? totalAtual,
      novoTotal,
      limiteLinhaPct: tol.custoLinhaPct,
      limiteTotalPct: tol.custoTotalPct,
    });
    const alcada = !avaliacao.dentro && exigeAlcada(novoTotal);
    return montar(d, avaliacao, alcada, textoNumero(linha.valor_planejado), textoNumero(novo), linha.id, `${linha.categoria}: ${linha.descricao}`);
  }
  if (d.tipo === 'prazo') {
    const alvo = d.alvo && d.alvo !== 'projeto' ? d.alvo : 'projeto';
    let atual: string;
    let nome: string;
    let limiteDias: number;
    if (alvo === 'projeto') {
      const fimAtividades = atividades.ativos().filter((a) => a.projeto_id === r.id && a.situacao !== 'cancelada').map((a) => a.fim_previsto).sort().at(-1) ?? null;
      const fim = r.fim_previsto ?? fimAtividades;
      if (!fim) throw new ErroProjetos('O projeto não tem fim previsto nem atividades com prazo para comparar.');
      atual = fim;
      nome = 'Fim do projeto';
      limiteDias = tol.prazoFimDias;
    } else {
      const a = atividades.porId(alvo);
      if (!a || !a.ativo || a.projeto_id !== r.id) throw new ErroProjetos('Escolha a atividade que muda.');
      atual = a.fim_previsto;
      nome = `Fim da atividade: ${a.descricao}`;
      limiteDias = tol.prazoMarcoDias;
      if (lerData(proposto, 'Nova data') < a.inicio_previsto) throw new ErroProjetos('A nova data não pode vir antes do início previsto da atividade.');
    }
    const novo = lerData(proposto, 'Nova data');
    if (novo === atual) throw new ErroProjetos('A nova data é igual à atual.');
    const avaliacao = avaliarPrazo({ base: base(alvo, atual), novo, limiteDias });
    return montar(d, avaliacao, false, atual, novo, alvo, nome);
  }
  const escopoAtual = String(conteudo.escopo ?? '');
  if (proposto === escopoAtual.trim()) throw new ErroProjetos('O escopo proposto é igual ao atual.');
  const avaliacao = avaliarEscopo({ escopoLivreDoTermo: tol.escopoLivre, cabeNoEscopoLivre: !!d.cabeNoEscopoLivre });
  return montar(d, avaliacao, false, escopoAtual, proposto, null, 'Escopo do projeto');
}

function montar(d: DadosPedido, avaliacao: AvaliacaoPedido, exigeAlcada: boolean, atual: string, proposto: string, alvo: string | null, alvoNome: string) {
  return {
    resultado: { avaliacao, exigeAlcada, atual, proposto, alvo, alvoNome, frase: fraseDaVariacao(d.tipo, avaliacao), quem: quemDecide(avaliacao.dentro, exigeAlcada) } satisfies PedidoAvaliado,
  };
}

/** Regras 16 e 17: dentro da tolerância o responsável aplica na hora; fora dela fica pendente e nada muda. */
export async function pedirMudanca(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosPedido, opcoes: Opcoes = {}): Promise<{ situacao: 'aplicada' | 'pendente'; pedidoId: string }> {
  const agora = opcoes.agora ?? new Date();
  const { r, termo } = await projetoEmImplementacao(p, quem, projetoId);
  const justificativa = d.justificativa.trim();
  if (!justificativa) throw new ErroProjetos('Escreva a justificativa da mudança.');
  const { resultado: a } = await avaliar(p, r, termo, d);
  const [pedidos] = await lerTabelas(p, [PedidosMudanca] as const);
  if (pedidos.ativos().some((x) => x.projeto_id === projetoId && x.tipo === d.tipo && x.alvo === a.alvo && (x.situacao === 'pendente' || x.situacao === 'aguardando_alcada'))) {
    throw new ErroProjetos('Já existe um pedido igual esperando decisão. Espere a decisão antes de pedir outro.');
  }
  const dentro = a.avaliacao.dentro;
  const campos = {
    projeto_id: projetoId,
    tipo: d.tipo,
    alvo: a.alvo,
    atual: a.atual,
    proposto: a.proposto,
    variacao: a.avaliacao.variacao,
    limite: a.avaliacao.limite,
    variacao_total: a.avaliacao.variacaoTotal,
    limite_total: a.avaliacao.limiteTotal,
    dentro_tolerancia: dentro,
    exige_alcada: a.exigeAlcada,
    justificativa,
    pedido_por: quem.email,
    pedido_em: agora.toISOString(),
    situacao: dentro ? ('aplicada' as const) : ('pendente' as const),
    diretoria_por: null,
    decidido_por: dentro ? quem.email : null,
    decidido_em: dentro ? agora.toISOString() : null,
    decisao_justificativa: null,
    versao_termo_base: versaoDoTermo(termo),
    versao_termo_nova: null,
  };
  const novo = await inserir(p, PedidosMudanca, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'PedidosMudanca', novo.id, Object.keys(campos), agora);
  if (dentro) {
    await aplicarMudanca(p, quem, novo as RegPedido, agora);
    await registrarHistorico(p, quem, projetoId, `Mudança de ${d.tipo} aplicada (dentro da tolerância)`, justificativa, agora);
    return { situacao: 'aplicada', pedidoId: novo.id };
  }
  await registrarHistorico(p, quem, projetoId, `Pedido de mudança de ${d.tipo} enviado à Diretoria`, justificativa, agora);
  return { situacao: 'pendente', pedidoId: novo.id };
}

/** Grava a mudança no orçamento, no cronograma ou nas datas. O escopo só vive no Termo. */
async function aplicarMudanca(p: Planilhas, quem: Autorizador, pedido: RegPedido, agora: Date): Promise<void> {
  if (pedido.tipo === 'custo') {
    const [linhas] = await lerTabelas(p, [ProjetoOrcamento] as const);
    const l = linhas.porId(pedido.alvo ?? '');
    if (!l || !l.ativo) throw new ErroProjetos('A linha do orçamento não existe mais.');
    if (textoNumero(l.valor_planejado) !== pedido.atual) throw new ErroProjetos('O valor da linha mudou depois do pedido. Faça um novo pedido.');
    const { colunasAlteradas } = await atualizar(p, ProjetoOrcamento, l.id, l.versao, { valor_planejado: Number(pedido.proposto) }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', l.id, colunasAlteradas, agora);
  } else if (pedido.tipo === 'prazo' && pedido.alvo === 'projeto') {
    const [projetos] = await lerTabelas(p, [Projetos] as const);
    const projeto = projetos.porId(pedido.projeto_id)!;
    const { colunasAlteradas } = await atualizar(p, Projetos, projeto.id, projeto.versao, { fim_previsto: pedido.proposto }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Projetos', projeto.id, colunasAlteradas, agora);
  } else if (pedido.tipo === 'prazo') {
    const [atividades] = await lerTabelas(p, [Atividades] as const);
    const a = atividades.porId(pedido.alvo ?? '');
    if (!a || !a.ativo) throw new ErroProjetos('A atividade não existe mais.');
    if (a.fim_previsto !== pedido.atual) throw new ErroProjetos('O prazo da atividade mudou depois do pedido. Faça um novo pedido.');
    const { colunasAlteradas } = await atualizar(p, Atividades, a.id, a.versao, { fim_previsto: pedido.proposto }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Atividades', a.id, colunasAlteradas, agora);
  }
}

/**
 * Regra 18: mudança aprovada fora da tolerância gera nova versão do Termo, já aprovada; a anterior fica
 * `substituido`, e o orçamento passa a refletir a nova versão. Devolve o número da versão nova.
 */
async function novaVersaoDoTermo(p: Planilhas, quem: Autorizador, pedido: RegPedido, agora: Date): Promise<number> {
  const [docs, linhas, projetos] = await lerTabelas(p, [ProjetoDocumentos, ProjetoOrcamento, Projetos] as const);
  const doTermo = docs.ativos().filter((x) => x.projeto_id === pedido.projeto_id && x.tipo === 'termo_abertura');
  const vigente = doTermo.filter((x) => x.situacao === 'aprovado').sort((a, b) => b.numero - a.numero)[0];
  if (!vigente) throw new ErroProjetos('Sem Termo de Abertura aprovado, nada muda.');
  const conteudo = { ...conteudoDe(vigente) };
  const doProjeto = linhas.ativos().filter((l) => l.projeto_id === pedido.projeto_id);
  if (pedido.tipo === 'custo') conteudo.valor_total = totalOrcamento(doProjeto);
  if (pedido.tipo === 'escopo') conteudo.escopo = pedido.proposto;
  const numero = Math.max(...doTermo.map((x) => x.numero)) + 1;
  const campos = { projeto_id: pedido.projeto_id, tipo: 'termo_abertura', numero, conteudo: JSON.stringify(conteudo), situacao: 'aprovado' as const, pronto: true };
  const novo = await inserir(p, ProjetoDocumentos, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'ProjetoDocumentos', novo.id, Object.keys(campos), agora);
  const r = await atualizar(p, ProjetoDocumentos, vigente.id, vigente.versao, { situacao: 'substituido' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoDocumentos', vigente.id, r.colunasAlteradas, agora);
  for (const l of doProjeto) {
    const x = await atualizar(p, ProjetoOrcamento, l.id, l.versao, { versao_termo: numero }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', l.id, x.colunasAlteradas, agora);
  }
  const total = conteudo.valor_total;
  const projeto = projetos.porId(pedido.projeto_id)!;
  const y = await atualizar(p, Projetos, projeto.id, projeto.versao, { valor_aprovado: typeof total === 'number' ? total : null }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', projeto.id, y.colunasAlteradas, agora);
  return numero;
}

export type DecisaoMudanca = 'aprovar' | 'recusar';

/**
 * Regras 16 a 18. Pedido pendente: decide a Diretoria. Se o novo valor total passa do limite de alçada, a
 * aprovação da Diretoria deixa o pedido esperando a Presidência ou o Conselho. Quem pediu não decide o próprio pedido.
 */
export async function decidirMudanca(p: Planilhas, quem: Autorizador, pedidoId: string, versao: number, decisao: DecisaoMudanca, justificativa: string, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const [pedidos, projetos] = await lerTabelas(p, [PedidosMudanca, Projetos] as const);
  const pedido = pedidos.porId(pedidoId);
  if (!pedido || !pedido.ativo) throw new ErroProjetos('Pedido de mudança não encontrado.');
  const projeto = projetos.porId(pedido.projeto_id);
  const config = await lerConfig(p);
  if (!projeto || !projeto.ativo) throw new ErroProjetos('Projeto não encontrado.');
  // Quem não vê o projeto não decide (nem descobre que o pedido existe).
  await projetoVisivel(p, quem, projeto.id);
  if (pedido.versao !== versao) throw new ErroConflito(pedido.id);
  if (pedido.situacao !== 'pendente' && pedido.situacao !== 'aguardando_alcada') throw new ErroProjetos('Este pedido já foi decidido.');
  if (decisao !== 'aprovar' && decisao !== 'recusar') throw new ErroProjetos('Escolha aprovar ou recusar.');
  if (projeto.etapa !== 'implementacao') throw new ErroProjetos('O projeto não está mais em implementação.');
  const nivelAlcada = pedido.situacao === 'aguardando_alcada';
  if (!nivelAlcada) {
    if (!quem.temPermissao('projetos.decidir')) throw new ErroPermissao('Só a Diretoria decide este pedido.');
  } else if (!quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') || !designado(config, quem.email, 'alcada')) {
    throw new ErroPermissao('Só a Presidência ou o Conselho, designados na configuração, decidem acima do limite.');
  }
  if (pedido.pedido_por.toLowerCase() === quem.email.toLowerCase()) throw new ErroPermissao('Quem fez o pedido não decide o próprio pedido.');
  const j = justificativa.trim();
  if (!j) throw new ErroProjetos('Escreva a justificativa da decisão.');

  const quemDecidiu = nivelAlcada ? 'Presidência ou Conselho' : 'Diretoria';
  if (decisao === 'aprovar' && !nivelAlcada && pedido.exige_alcada) {
    const { colunasAlteradas } = await atualizar(p, PedidosMudanca, pedido.id, pedido.versao, { situacao: 'aguardando_alcada', diretoria_por: quem.email }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'PedidosMudanca', pedido.id, colunasAlteradas, agora);
    await registrarHistorico(p, quem, projeto.id, `${quemDecidiu}: aprovou o pedido de ${pedido.tipo}; segue para a Presidência ou o Conselho`, j, agora);
    return;
  }
  if (decisao === 'recusar') {
    const { colunasAlteradas } = await atualizar(p, PedidosMudanca, pedido.id, pedido.versao, { situacao: 'recusada', decidido_por: quem.email, decidido_em: agora.toISOString(), decisao_justificativa: j }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'PedidosMudanca', pedido.id, colunasAlteradas, agora);
    await registrarHistorico(p, quem, projeto.id, `${quemDecidiu}: recusou o pedido de ${pedido.tipo}`, j, agora);
    return;
  }
  await aplicarMudanca(p, quem, pedido as RegPedido, agora);
  const versaoNova = await novaVersaoDoTermo(p, quem, pedido as RegPedido, agora);
  const { colunasAlteradas } = await atualizar(
    p,
    PedidosMudanca,
    pedido.id,
    pedido.versao,
    { situacao: 'aprovada', decidido_por: quem.email, decidido_em: agora.toISOString(), decisao_justificativa: j, versao_termo_nova: versaoNova },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'alteracao', 'PedidosMudanca', pedido.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projeto.id, `${quemDecidiu}: aprovou o pedido de ${pedido.tipo}; nova versão ${versaoNova} do Termo de Abertura`, j, agora);
}

// ---------- Relatório de monitoramento (regra 22) ----------

export interface DadosRelatorio {
  periodoInicio: string;
  periodoFim: string;
  texto: string;
  /** Quanto já foi gasto, em reais (opcional): não há ligação com o Orçamento da instituição nesta entrega. */
  gasto: number | string | null;
  /** Só pode piorar a situação calculada; em branco usa a calculada. */
  situacao?: SituacaoRelatorio | null;
  justificativa?: string | null;
}

/** Situação do projeto hoje: fora da tolerância (regra 19) e o que alimenta o relatório. */
async function panorama(p: Planilhas, r: RegProjeto, termo: { conteudo: string }, hoje: string, gasto: number | null) {
  const [atividades, linhas, problemas] = await lerTabelas(p, [Atividades, ProjetoOrcamento, Problemas] as const);
  const doProjeto = atividades.ativos().filter((a) => a.projeto_id === r.id);
  const abertos = problemas.ativos().filter((x) => x.projeto_id === r.id && problemaAberto(x));
  const tol: Tolerancias = toleranciasDoTermo(JSON.parse(termo.conteudo));
  const total = totalOrcamento(linhas.ativos().filter((l) => l.projeto_id === r.id));
  const motivos = foraDaTolerancia({ hoje, tolerancias: tol, valorAprovado: r.valor_aprovado, totalOrcamento: total, gastoRealizado: gasto, fimPrevistoProjeto: r.fim_previsto, atividades: doProjeto });
  return { atividades: doProjeto, abertos, tolerancias: tol, total, motivos, atrasadas: doProjeto.filter((a) => situacaoExibida(a, hoje) === 'atrasada').length };
}

/** Ponto de chamada da carteira (P6): motivos de estar fora da tolerância; vazio se dentro ou se não há Termo aprovado. */
export async function motivosForaDaTolerancia(p: Planilhas, r: RegProjeto, hoje: string): Promise<string[]> {
  if (r.etapa !== 'implementacao') return [];
  const termo = await exigirTermoAprovado(p, r.id).catch(() => null);
  if (!termo) return [];
  const [relatorios] = await lerTabelas(p, [Relatorios] as const);
  const gasto = relatorios.ativos().filter((x) => x.projeto_id === r.id).sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))[0]?.gasto_realizado ?? null;
  return (await panorama(p, r, termo, hoje, gasto)).motivos;
}

const gastoDe = (v: number | string | null): number | null => {
  if (v === null || String(v).trim() === '') return null;
  return lerValor(v);
};

export interface ResultadoRelatorio {
  relatorioId: string;
  situacao: SituacaoRelatorio;
  /** Quantos indicadores do cadastro foram medidos junto; null se o projeto não usa número automático. */
  medidos: number | null;
}

export async function enviarRelatorio(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosRelatorio, leitor?: NumerosDePessoas, opcoes: Opcoes = {}): Promise<ResultadoRelatorio> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeEmBrasilia(agora);
  const { r, termo } = await projetoEmImplementacao(p, quem, projetoId);
  const inicio = lerData(d.periodoInicio, 'Início do período');
  const fim = lerData(d.periodoFim, 'Fim do período');
  if (fim < inicio) throw new ErroProjetos('O fim do período não pode vir antes do início.');
  if (fim > hoje) throw new ErroProjetos('O fim do período não pode estar no futuro.');
  const texto = d.texto.trim();
  if (!texto) throw new ErroProjetos('Escreva o que aconteceu no período.');
  const gasto = gastoDe(d.gasto);
  const pano = await panorama(p, r, termo, hoje, gasto);
  const calculada = situacaoCalculada({ motivosForaTolerancia: pano.motivos, problemasAbertos: pano.abertos, atrasadas: pano.atrasadas, planejadoPct: planejadoPct(pano.atividades, fim), realizadoPct: realizadoPct(pano.atividades, fim) });
  const escolhida = d.situacao || calculada;
  if (!SITUACOES_RELATORIO.includes(escolhida)) throw new ErroProjetos('Escolha uma situação válida.');
  if (eMelhor(escolhida, calculada)) throw new ErroProjetos('A situação não pode ser melhor do que a calculada pelo Elo. Você pode apenas piorá-la.');
  const justificativa = d.justificativa?.trim() || null;
  if (ePior(escolhida, calculada) && !justificativa) throw new ErroProjetos('Para piorar a situação, explique o motivo.');
  const campos = {
    projeto_id: projetoId,
    periodo_inicio: inicio,
    periodo_fim: fim,
    planejado_pct: planejadoPct(pano.atividades, fim),
    realizado_pct: realizadoPct(pano.atividades, fim),
    orcamento_total: pano.total,
    gasto_realizado: gasto,
    atividades_atrasadas: pano.atrasadas,
    problemas_abertos: pano.abertos.length,
    fora_tolerancia: pano.motivos.length > 0,
    situacao_calculada: calculada,
    situacao: escolhida,
    justificativa: ePior(escolhida, calculada) ? justificativa : null,
    texto,
    enviado_por: quem.email,
    enviado_em: agora.toISOString(),
  };
  const novo = await inserir(p, Relatorios, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Relatorios', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, `Relatório de monitoramento enviado (${escolhida})`, null, agora);
  // Ponto de chamada L12: o relatório fotografa os indicadores do cadastro. Falha na medição não perde o relatório.
  let medidos: number | null = null;
  try {
    medidos = await fotografarIndicadores(p, quem, projetoId, 'relatorio', leitor, opcoes);
  } catch (e) {
    if (!(e instanceof ErroProjetos)) throw e;
  }
  return { relatorioId: novo.id, situacao: escolhida, medidos };
}

// ---------- Leitura ----------

export interface Acompanhamento {
  projeto: RegProjeto;
  riscos: RegRisco[];
  problemas: RegProblema[];
  /** null para quem só está na equipe: pedidos e relatórios mostram valores do orçamento (regra de borda 5). */
  pedidos: (RegPedido & { frase: string; quem: string })[] | null;
  relatorios: RegRelatorio[] | null;
  /** Motivos pelos quais o projeto está fora da tolerância; null se a pessoa não vê o orçamento. */
  foraDaTolerancia: string[] | null;
  tolerancias: Tolerancias | null;
  /** Linhas do orçamento e atividades, para escolher o que muda num pedido. */
  linhas: { id: string; rotulo: string; valor: number }[];
  atividades: { id: string; rotulo: string; fim: string }[];
  podeAlterar: boolean;
  podeDecidir: boolean;
  podeDecidirAlcada: boolean;
}

/** Regra "quem vê o quê": null se a pessoa não vê o projeto. */
export async function lerAcompanhamento(p: Planilhas, quem: Autorizador, projetoId: string, opcoes: Opcoes = {}): Promise<Acompanhamento | null> {
  const hoje = hojeEmBrasilia(opcoes.agora ?? new Date());
  let r: RegProjeto;
  try {
    r = await projetoVisivel(p, quem, projetoId);
  } catch (e) {
    if (e instanceof ErroProjetos) return null;
    throw e;
  }
  const config = await lerConfig(p);
  const [riscos, problemas, pedidos, relatorios, linhas, atividades] = await lerTabelas(p, [Riscos, Problemas, PedidosMudanca, Relatorios, ProjetoOrcamento, Atividades] as const);
  const veValores = podeVerProjeto(quem, r, config, []);
  const eu = quem.email.toLowerCase();
  const termo = r.etapa === 'implementacao' ? await exigirTermoAprovado(p, projetoId).catch(() => null) : null;
  let fora: string[] | null = null;
  let tolerancias: Tolerancias | null = null;
  if (veValores && termo) {
    const ultimoGasto = relatorios.ativos().filter((x) => x.projeto_id === projetoId).sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))[0]?.gasto_realizado ?? null;
    const pano = await panorama(p, r, termo, hoje, ultimoGasto);
    fora = pano.motivos;
    tolerancias = pano.tolerancias;
  }
  const nomeDePedido = (x: RegPedido) => {
    const a: AvaliacaoPedido = { variacao: x.variacao, limite: x.limite, variacaoTotal: x.variacao_total, limiteTotal: x.limite_total, dentro: x.dentro_tolerancia };
    return { frase: fraseDaVariacao(x.tipo, a), quem: quemDecide(x.dentro_tolerancia, x.exige_alcada) };
  };
  const pendenteNaAlcada = (x: RegPedido) => x.situacao === 'aguardando_alcada';
  const emImplementacao = r.etapa === 'implementacao';
  return {
    projeto: r,
    riscos: riscos.ativos().filter((x) => x.projeto_id === projetoId),
    problemas: problemas.ativos().filter((x) => x.projeto_id === projetoId).sort((a, b) => b.aberto_em.localeCompare(a.aberto_em)),
    pedidos: veValores
      ? pedidos.ativos().filter((x) => x.projeto_id === projetoId).sort((a, b) => b.pedido_em.localeCompare(a.pedido_em)).map((x) => ({ ...x, ...nomeDePedido(x as RegPedido) }))
      : null,
    relatorios: veValores ? relatorios.ativos().filter((x) => x.projeto_id === projetoId).sort((a, b) => b.enviado_em.localeCompare(a.enviado_em)) : null,
    foraDaTolerancia: fora,
    tolerancias,
    linhas: veValores ? linhas.ativos().filter((l) => l.projeto_id === projetoId).map((l) => ({ id: l.id, rotulo: `${l.categoria}: ${l.descricao}`, valor: l.valor_planejado })) : [],
    atividades: atividades.ativos().filter((a) => a.projeto_id === projetoId && a.situacao !== 'cancelada').map((a: RegAtividade) => ({ id: a.id, rotulo: a.descricao, fim: a.fim_previsto })),
    podeAlterar: emImplementacao && podeGerenciar(quem, r),
    podeDecidir: emImplementacao && quem.temPermissao('projetos.decidir') && veValores && pedidos.ativos().some((x) => x.projeto_id === projetoId && x.situacao === 'pendente' && x.pedido_por.toLowerCase() !== eu),
    podeDecidirAlcada: emImplementacao && quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') && designado(config, quem.email, 'alcada') && pedidos.ativos().some((x) => x.projeto_id === projetoId && pendenteNaAlcada(x as RegPedido) && x.pedido_por.toLowerCase() !== eu),
  };
}
