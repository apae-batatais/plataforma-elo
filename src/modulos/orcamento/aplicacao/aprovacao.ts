/**
 * Entrega 1B.2: propostas das coordenações, aprovação do exercício,
 * remanejamentos e suplementações.
 *
 * Quem pode:
 * - orcamento.previsao.propor (escopo da coordenação): propor despesas nos
 *   serviços do seu escopo, alterar ou retirar a própria proposta pendente.
 * - orcamento.previsao.cotar (Compras): informar quantidade, valor, situação da
 *   cotação e meses das propostas pendentes de qualquer serviço; não decide.
 * - orcamento.previsao.editar (Financeiro): aceitar, ajustar ou recusar
 *   propostas (recusa com motivo); pedir remanejamentos e suplementações.
 * - orcamento.exercicio.aprovar (Diretoria): aprovar e encerrar o exercício;
 *   aprovar ou recusar remanejamentos e suplementações.
 * Nada é apagado; toda decisão é auditada (colunas, nunca valores).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { conferirAjuste, ErroAjuste, type AjusteSimples } from '../dominio/ajustes';
import { distribuir, ErroDistribuicao, valorDoItem } from '../dominio/previsao';
import { Ajustes, Despesas, Exercicios, Fontes, GruposGasto, type RegDespesa } from '../dados/tabelas';
import { ErroValidacaoFolha } from './folha';
import { lerPrevisao, type DadosDespesa, type DadosDistribuicao, type LinhaDespesa } from './previsao';

const Erro = ErroValidacaoFolha;
const PERM = {
  propor: 'orcamento.previsao.propor',
  cotar: 'orcamento.previsao.cotar',
  editar: 'orcamento.previsao.editar',
  aprovar: 'orcamento.exercicio.aprovar',
  ver: 'orcamento.painel.ver',
} as const;
const hoje = () => new Date().toISOString().slice(0, 10);

const podePropor = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.propor, { tipo: 'servico', codigo: servico });

// ---------------------------------------------------------------------------
// Propostas das coordenações
// ---------------------------------------------------------------------------

export interface LinhaProposta extends LinhaDespesa {
  situacao: 'proposta' | 'aceito' | 'recusada';
  propostoPor: string | null;
  motivoDecisao: string | null;
  cotadoPor: string | null;
  /** Quem está vendo pode alterar ou retirar (coordenação, proposta pendente). */
  podeAlterar: boolean;
  /** Quem está vendo pode informar a cotação (Compras, proposta pendente). */
  podeCotar: boolean;
}

export interface Propostas {
  ano: number;
  situacao: 'elaboracao' | 'aprovado' | 'encerrado' | null;
  /** É do Financeiro: decide as propostas. */
  decide: boolean;
  /** É do Setor de Compras: informa a cotação das propostas. */
  cota: boolean;
  /** Pode lançar proposta nova (exercício em elaboração e algum serviço no escopo). */
  podePropor: boolean;
  lista: LinhaProposta[];
  opcoes: {
    servicos: { codigo: string; nome: string; areaNome: string }[];
    grupos: { id: string; nome: string; rh: boolean }[];
    fontes: { id: string; nome: string; natureza: 'publica' | 'propria'; uso: 'livre' | 'restrita' }[];
    areas: { codigo: string; nome: string }[];
  };
}

export async function listarPropostas(p: Planilhas, quem: Autorizador, anoEscolhido?: number): Promise<Propostas> {
  const decide = quem.temPermissao(PERM.editar);
  const cota = quem.temPermissao(PERM.cotar);
  const veTodos = decide || cota;
  if (!veTodos && !quem.temPermissaoAlgumEscopo(PERM.propor)) throw new ErroPermissao();
  const [exercicios, despesas, servicos, areas, grupos, fontes] = await lerTabelas(p, [Exercicios, Despesas, Servicos, Areas, GruposGasto, Fontes] as const);
  const abertos = exercicios.ativos().sort((a, b) => b.ano - a.ano);
  const ex = (anoEscolhido ? abertos.find((e) => e.ano === anoEscolhido) : undefined) ?? abertos.find((e) => e.situacao === 'elaboracao') ?? abertos[0];
  const ano = ex?.ano ?? new Date().getFullYear() + 1;
  const nomeArea = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  const servico = new Map(servicos.todos().map((s) => [s.codigo, s]));
  const grupo = new Map(grupos.todos().map((g) => [g.id, g]));
  const fonte = new Map(fontes.todos().map((f) => [f.id, f]));
  const noEscopo = servicos.ativos().filter((s) => decide || podePropor(quem, s.codigo));

  const lista: LinhaProposta[] = despesas
    .ativos()
    .filter((d) => d.ano === ano && (d.proposto_por || d.situacao !== 'aceito'))
    .filter((d) => veTodos || podePropor(quem, d.servico))
    .map((d: RegDespesa) => {
      const s = servico.get(d.servico);
      const g = grupo.get(d.grupo_id);
      const meses = Array.from({ length: 12 }, (_, i) => Number((d as unknown as Record<string, unknown>)[`m${i + 1}`]) || 0);
      const valor = valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario);
      return {
        id: d.id,
        versao: d.versao,
        servico: d.servico,
        servicoNome: s?.nome ?? d.servico,
        area: s?.area ?? '',
        areaNome: s?.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área',
        grupo_id: d.grupo_id,
        grupoNome: g?.nome ?? '?',
        grupoCodigo: g?.codigo_conta ?? null,
        rh: g?.rh ?? false,
        fonte_id: d.fonte_id,
        fonteNome: d.fonte_id ? (fonte.get(d.fonte_id)?.nome ?? '?') : 'A definir',
        fonteCodigo: d.fonte_id ? (fonte.get(d.fonte_id)?.codigo_conta ?? null) : null,
        descricao: d.descricao,
        quantidade: d.quantidade,
        ocorrencias: d.ocorrencias,
        valor_unitario: d.valor_unitario,
        valor,
        valorOriginal: valor,
        distribuicao: d.distribuicao,
        meses,
        categoria: d.categoria,
        prioridade: d.prioridade,
        cotacao: d.cotacao,
        observacao: d.observacao,
        situacao: d.situacao,
        propostoPor: d.proposto_por,
        motivoDecisao: d.motivo_decisao,
        cotadoPor: d.cotado_por,
        podeAlterar: ex?.situacao === 'elaboracao' && d.situacao === 'proposta' && (decide || podePropor(quem, d.servico)),
        podeCotar: ex?.situacao === 'elaboracao' && d.situacao === 'proposta' && cota,
      };
    })
    .sort((a, b) => (a.situacao === 'proposta' ? 0 : 1) - (b.situacao === 'proposta' ? 0 : 1) || a.servicoNome.localeCompare(b.servicoNome, 'pt-BR'));

  return {
    ano,
    situacao: ex?.situacao ?? null,
    decide,
    cota,
    podePropor: ex?.situacao === 'elaboracao' && noEscopo.length > 0 && quem.temPermissaoAlgumEscopo(PERM.propor),
    lista,
    opcoes: {
      servicos: noEscopo
        .map((s) => ({ codigo: s.codigo, nome: s.nome, areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
        .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
      grupos: grupos.ativos().map((g) => ({ id: g.id, nome: g.nome, rh: g.rh })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      fontes: fontes.ativos().map((f) => ({ id: f.id, nome: f.nome, natureza: f.natureza, uso: f.uso })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      areas: areas.ativos().map((a) => ({ codigo: a.codigo, nome: a.nome })),
    },
  };
}

/** A coordenação lança (ou altera) uma proposta num serviço do seu escopo. */
export async function proporDespesa(p: Planilhas, quem: Autorizador, dados: DadosDespesa, existente?: { id: string; versao: number }): Promise<string> {
  if (!podePropor(quem, dados.servico)) throw new ErroPermissao();
  const [exercicios, grupos, fontes, despesas, servicos] = await lerTabelas(p, [Exercicios, GruposGasto, Fontes, Despesas, Servicos] as const);
  const ex = exercicios.ativos().find((e) => e.ano === dados.ano);
  if (!ex || ex.situacao !== 'elaboracao') throw new Erro(`O exercício ${dados.ano} não está recebendo propostas.`);
  if (!servicos.ativos().some((s) => s.codigo === dados.servico)) throw new Erro('Escolha o serviço.');
  if (!grupos.ativos().some((g) => g.id === dados.grupo_id)) throw new Erro('Escolha o grupo de gasto.');
  if (dados.fonte_id && !fontes.ativos().some((f) => f.id === dados.fonte_id)) throw new Erro('Fonte inválida.');
  const descricao = dados.descricao.trim().replace(/\s+/g, ' ');
  if (!descricao) throw new Erro('Descreva o item.');
  // Na proposta, valores e meses são opcionais: em branco, o Financeiro completa antes de aceitar.
  const quantidade = Number.isFinite(dados.quantidade) && dados.quantidade > 0 ? dados.quantidade : 1;
  const ocorrencias = Number.isFinite(dados.ocorrencias) && dados.ocorrencias > 0 ? dados.ocorrencias : 1;
  const valorUnitario = Number.isFinite(dados.valor_unitario) && dados.valor_unitario > 0 ? dados.valor_unitario : 0;
  if (dados.valor_unitario < 0) throw new Erro('O valor unitário não pode ser negativo.');
  const valor = valorDoItem(quantidade, ocorrencias, valorUnitario);
  const semValor = valor === 0;
  const distribuicao = semValor ? 'igual' : dados.distribuicao;
  let meses: number[];
  try {
    meses = semValor ? Array(12).fill(0) : distribuir(valor, distribuicao, { meses: dados.meses, manual: dados.manual });
  } catch (e) {
    if (e instanceof ErroDistribuicao) throw new Erro(e.message);
    throw e;
  }
  const campos = {
    ano: dados.ano,
    servico: dados.servico,
    grupo_id: dados.grupo_id,
    fonte_id: dados.fonte_id || null,
    descricao,
    quantidade,
    ocorrencias,
    valor_unitario: valorUnitario,
    distribuicao,
    ...Object.fromEntries(meses.map((v, i) => [`m${i + 1}`, v])),
    categoria: dados.categoria === 'projetos' ? 'projetos' : 'operacional',
    prioridade: dados.prioridade ?? null,
    cotacao: dados.cotacao ?? null,
    observacao: dados.observacao?.trim() || null,
  };
  if (!existente) {
    const d = await inserir(p, Despesas, { ...campos, situacao: 'proposta', proposto_por: quem.email, motivo_decisao: null } as never, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Despesas', registroId: d.id, detalhes: { proposta: true } });
    return d.id;
  }
  const alvo = despesas.porId(existente.id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'proposta') throw new Erro('Só dá para alterar proposta que ainda aguarda o Financeiro.');
  if (!podePropor(quem, alvo.servico)) throw new ErroPermissao();
  const { colunasAlteradas } = await atualizar(p, Despesas, existente.id, existente.versao, campos as never, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Despesas', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  return existente.id;
}

export interface DadosCotacao extends DadosDistribuicao {
  quantidade: number;
  ocorrencias: number;
  valor_unitario: number;
  cotacao: 'ok' | 'atualizar' | 'pendente' | null;
  observacao?: string | null;
}

/**
 * O Setor de Compras informa a cotação de uma proposta pendente: quantidade,
 * valor, situação da cotação, observação e meses. Não muda serviço, grupo,
 * fonte nem descrição, e não decide: a proposta continua aguardando o Financeiro.
 */
export async function cotarProposta(p: Planilhas, quem: Autorizador, id: string, versao: number, dados: DadosCotacao): Promise<void> {
  if (!quem.temPermissao(PERM.cotar)) throw new ErroPermissao();
  const [despesas, exercicios] = await lerTabelas(p, [Despesas, Exercicios] as const);
  const alvo = despesas.porId(id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'proposta') throw new Erro('Só dá para cotar proposta que ainda aguarda o Financeiro.');
  const ex = exercicios.ativos().find((e) => e.ano === alvo.ano);
  if (ex?.situacao !== 'elaboracao') throw new Erro(`O exercício ${alvo.ano} não está em elaboração.`);
  for (const [v, rotulo] of [[dados.quantidade, 'Quantidade'], [dados.ocorrencias, 'Vezes'], [dados.valor_unitario, 'Valor unitário']] as const) {
    if (!Number.isFinite(v) || v <= 0) throw new Erro(`${rotulo} precisa ser maior que zero.`);
  }
  const valor = valorDoItem(dados.quantidade, dados.ocorrencias, dados.valor_unitario);
  let meses: number[];
  try {
    meses = distribuir(valor, dados.distribuicao, { meses: dados.meses, manual: dados.manual });
  } catch (e) {
    if (e instanceof ErroDistribuicao) throw new Erro(e.message);
    throw e;
  }
  const { colunasAlteradas } = await atualizar(
    p,
    Despesas,
    id,
    versao,
    {
      quantidade: dados.quantidade,
      ocorrencias: dados.ocorrencias,
      valor_unitario: dados.valor_unitario,
      distribuicao: dados.distribuicao,
      ...Object.fromEntries(meses.map((v, i) => [`m${i + 1}`, v])),
      cotacao: dados.cotacao ?? 'ok',
      observacao: dados.observacao?.trim() || null,
      cotado_por: quem.email,
    } as never,
    { email: quem.email },
  );
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Despesas', registroId: id, detalhes: { colunas: colunasAlteradas, cotacao: true } });
}

/** A coordenação retira a própria proposta pendente (fica registrada como cancelada). */
export async function retirarProposta(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  const [despesas] = await lerTabelas(p, [Despesas] as const);
  const alvo = despesas.porId(id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'proposta') throw new Erro('Proposta não encontrada.');
  if (!podePropor(quem, alvo.servico) && !quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  await atualizar(p, Despesas, id, versao, { ativo: false } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Despesas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

/** O Financeiro aceita (entra no orçamento) ou recusa (com motivo) uma proposta. */
export async function decidirProposta(p: Planilhas, quem: Autorizador, id: string, versao: number, decisao: 'aceitar' | 'recusar', motivo?: string): Promise<void> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  const [despesas, exercicios] = await lerTabelas(p, [Despesas, Exercicios] as const);
  const alvo = despesas.porId(id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'proposta') throw new Erro('Proposta não encontrada ou já decidida.');
  const ex = exercicios.ativos().find((e) => e.ano === alvo.ano);
  if (ex?.situacao !== 'elaboracao') throw new Erro('O exercício já foi aprovado: as propostas não podem mais ser decididas.');
  const texto = motivo?.trim() || null;
  if (decisao === 'recusar' && !texto) throw new Erro('Escreva o motivo da recusa: a coordenação vai ler.');
  if (decisao === 'aceitar' && valorDoItem(alvo.quantidade, alvo.ocorrencias, alvo.valor_unitario) <= 0) {
    throw new Erro('A proposta está sem valor. Aguarde a cotação de Compras ou use “Ajustar” para informar o valor e os meses, e depois aceite.');
  }
  const { colunasAlteradas } = await atualizar(
    p,
    Despesas,
    id,
    versao,
    { situacao: decisao === 'aceitar' ? 'aceito' : 'recusada', motivo_decisao: texto } as never,
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Despesas', registroId: id, detalhes: { colunas: colunasAlteradas, decisao } });
}

// ---------------------------------------------------------------------------
// Aprovação e encerramento do exercício
// ---------------------------------------------------------------------------

export interface Pendencias {
  fontesADefinir: number;
  propostasPendentes: number;
  ajustesPendentes: number;
  podeAprovar: boolean;
}

export async function pendenciasDoExercicio(p: Planilhas, quem: Autorizador, ano: number): Promise<Pendencias> {
  const prev = await lerPrevisao(p, quem, ano, { incluirCedidos: false });
  const pend = { fontesADefinir: prev.totais.aDefinir.itens, propostasPendentes: prev.propostasPendentes, ajustesPendentes: prev.ajustesPendentes };
  return { ...pend, podeAprovar: prev.exercicio?.situacao === 'elaboracao' && pend.fontesADefinir === 0 && pend.propostasPendentes === 0 };
}

export async function aprovarExercicio(p: Planilhas, quem: Autorizador, ano: number): Promise<void> {
  if (!quem.temPermissao(PERM.aprovar)) throw new ErroPermissao();
  const [exercicios] = await lerTabelas(p, [Exercicios] as const);
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  if (!ex || ex.situacao !== 'elaboracao') throw new Erro(`O exercício ${ano} não está em elaboração.`);
  const pend = await pendenciasDoExercicio(p, quem, ano);
  const faltas = [
    pend.fontesADefinir ? `${pend.fontesADefinir} ${pend.fontesADefinir === 1 ? 'linha' : 'linhas'} com fonte “a definir”` : '',
    pend.propostasPendentes ? `${pend.propostasPendentes} ${pend.propostasPendentes === 1 ? 'proposta pendente' : 'propostas pendentes'}` : '',
  ].filter(Boolean);
  if (faltas.length) throw new Erro(`Ainda não dá para aprovar: ${faltas.join(' e ')}.`);
  const { colunasAlteradas } = await atualizar(p, Exercicios, ex.id, ex.versao, { situacao: 'aprovado', aprovado_em: hoje(), aprovado_por: quem.email }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Exercicios', registroId: ex.id, detalhes: { colunas: colunasAlteradas, decisao: 'aprovado' } });
}

export async function encerrarExercicio(p: Planilhas, quem: Autorizador, ano: number): Promise<void> {
  if (!quem.temPermissao(PERM.aprovar)) throw new ErroPermissao();
  const [exercicios, ajustes] = await lerTabelas(p, [Exercicios, Ajustes] as const);
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  if (!ex || ex.situacao !== 'aprovado') throw new Erro(`Só dá para encerrar um exercício aprovado.`);
  if (ajustes.ativos().some((a) => a.ano === ano && a.situacao === 'pendente')) throw new Erro('Decida os remanejamentos e suplementações pendentes antes de encerrar.');
  await atualizar(p, Exercicios, ex.id, ex.versao, { situacao: 'encerrado' }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Exercicios', registroId: ex.id, detalhes: { colunas: ['situacao'], decisao: 'encerrado' } });
}

// ---------------------------------------------------------------------------
// Remanejamentos e suplementações (exercício aprovado)
// ---------------------------------------------------------------------------

export interface DadosAjuste {
  ano: number;
  tipo: 'remanejamento' | 'suplementacao';
  origem_id: string | null;
  destino_tipo: 'despesa' | 'receita';
  destino_id: string;
  mes: number;
  valor: number;
  justificativa: string;
}

/** Valor atual (com os ajustes aprovados) de um item num mês; null se não existir no exercício. */
async function saldos(p: Planilhas, quem: Autorizador, ano: number) {
  const prev = await lerPrevisao(p, quem, ano, { incluirCedidos: false });
  const meses = new Map<string, number[]>([...prev.despesas.map((d) => [d.id, d.meses] as const), ...prev.receitas.map((r) => [r.id, r.meses] as const)]);
  return { prev, saldo: (id: string, mes: number) => meses.get(id)?.[mes - 1] ?? null };
}

export async function solicitarAjuste(p: Planilhas, quem: Autorizador, dados: DadosAjuste): Promise<string> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  const justificativa = dados.justificativa.trim();
  if (!justificativa) throw new Erro('Escreva a justificativa: a Diretoria decide a partir dela.');
  const { prev, saldo } = await saldos(p, quem, dados.ano);
  if (prev.exercicio?.situacao !== 'aprovado') throw new Erro('Remanejamentos e suplementações só existem em exercício aprovado.');
  if (dados.tipo === 'remanejamento' && dados.destino_tipo !== 'despesa') throw new Erro('O remanejamento é entre despesas.');
  try {
    conferirAjuste(dados as AjusteSimples, saldo);
  } catch (e) {
    if (e instanceof ErroAjuste) throw new Erro(e.message);
    throw e;
  }
  const a = await inserir(
    p,
    Ajustes,
    {
      ano: dados.ano,
      tipo: dados.tipo,
      origem_id: dados.tipo === 'remanejamento' ? dados.origem_id : null,
      destino_tipo: dados.destino_tipo,
      destino_id: dados.destino_id,
      mes: dados.mes,
      valor: Math.round(dados.valor * 100) / 100,
      justificativa,
      situacao: 'pendente',
      solicitado_por: quem.email,
      decidido_por: null,
      decidido_em: null,
      motivo_decisao: null,
    },
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Ajustes', registroId: a.id });
  return a.id;
}

export async function decidirAjuste(p: Planilhas, quem: Autorizador, id: string, versao: number, aprovar: boolean, motivo?: string): Promise<void> {
  if (!quem.temPermissao(PERM.aprovar)) throw new ErroPermissao();
  const [ajustes] = await lerTabelas(p, [Ajustes] as const);
  const alvo = ajustes.porId(id);
  if (!alvo || !alvo.ativo || alvo.situacao !== 'pendente') throw new Erro('Pedido não encontrado ou já decidido.');
  const texto = motivo?.trim() || null;
  if (!aprovar && !texto) throw new Erro('Escreva o motivo da recusa.');
  if (aprovar) {
    // Confere de novo: outro ajuste pode ter sido aprovado depois do pedido.
    const { saldo } = await saldos(p, quem, alvo.ano);
    try {
      conferirAjuste(alvo as AjusteSimples, saldo);
    } catch (e) {
      if (e instanceof ErroAjuste) throw new Erro(`Não dá para aprovar: ${e.message}`);
      throw e;
    }
  }
  const { colunasAlteradas } = await atualizar(
    p,
    Ajustes,
    id,
    versao,
    { situacao: aprovar ? 'aprovado' : 'recusado', decidido_por: quem.email, decidido_em: hoje(), motivo_decisao: texto },
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Ajustes', registroId: id, detalhes: { colunas: colunasAlteradas, decisao: aprovar ? 'aprovado' : 'recusado' } });
}

export interface LinhaAjuste {
  id: string;
  versao: number;
  tipo: 'remanejamento' | 'suplementacao';
  origem: string | null;
  destino: string;
  destinoTipo: 'despesa' | 'receita';
  mes: number;
  valor: number;
  justificativa: string;
  situacao: 'pendente' | 'aprovado' | 'recusado';
  solicitadoPor: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  motivoDecisao: string | null;
  criadoEm: string;
}

export async function listarAjustes(p: Planilhas, quem: Autorizador, anoEscolhido?: number) {
  if (!quem.temPermissao(PERM.ver) && !quem.temPermissao(PERM.editar) && !quem.temPermissao(PERM.aprovar)) throw new ErroPermissao();
  const prev = await lerPrevisao(p, quem, anoEscolhido, { incluirCedidos: false });
  const [ajustes] = await lerTabelas(p, [Ajustes] as const);
  const nome = new Map<string, string>([
    ...prev.despesas.map((d) => [d.id, `${d.descricao} · ${d.servicoNome}`] as const),
    ...prev.receitas.map((r) => [r.id, `${r.descricao} · ${r.fonteNome}`] as const),
  ]);
  const lista: LinhaAjuste[] = ajustes
    .ativos()
    .filter((a) => a.ano === prev.ano)
    .map((a) => ({
      id: a.id,
      versao: a.versao,
      tipo: a.tipo,
      origem: a.origem_id ? (nome.get(a.origem_id) ?? '?') : null,
      destino: nome.get(a.destino_id) ?? '?',
      destinoTipo: a.destino_tipo,
      mes: a.mes,
      valor: a.valor,
      justificativa: a.justificativa,
      situacao: a.situacao,
      solicitadoPor: a.solicitado_por,
      decididoPor: a.decidido_por,
      decididoEm: a.decidido_em,
      motivoDecisao: a.motivo_decisao,
      criadoEm: a.criado_em,
    }))
    .sort((x, y) => (x.situacao === 'pendente' ? 0 : 1) - (y.situacao === 'pendente' ? 0 : 1) || y.criadoEm.localeCompare(x.criadoEm));
  return {
    prev,
    lista,
    podeSolicitar: quem.temPermissao(PERM.editar) && prev.exercicio?.situacao === 'aprovado',
    podeDecidir: quem.temPermissao(PERM.aprovar),
  };
}
