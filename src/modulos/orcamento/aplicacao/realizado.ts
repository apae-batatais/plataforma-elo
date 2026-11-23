/**
 * Casos de uso do realizado informado à mão (Entrega 1C.1).
 *
 * Quem pode:
 * - orcamento.realizado.editar: só o Financeiro (informar, corrigir e remover linhas).
 * - orcamento.execucao.ver: Diretoria e Financeiro veem tudo; a Coordenação vê só os
 *   serviços do seu escopo (e nenhuma receita, que não tem serviço).
 * - orcamento.painel.ver (Leitura): só os totais do ano, sem as linhas.
 *
 * Nada é apagado: "remover linha" encerra o registro (ativo = FALSE).
 * A auditoria guarda as colunas alteradas, nunca os valores.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizarVarios, ErroConflito, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { Ajustes, Despesas, Exercicios, Fontes, GruposGasto, Realizado, Receitas, type RegRealizado } from '../dados/tabelas';
import { deltasDosAjustes, mesesComAjuste } from '../dominio/ajustes';
import {
  chaveLinha, conferirLinha, mesInformavel, mesPendente, naturezaSugerida, totaisDoMes,
  type Natureza, type TipoRealizado, type TotaisMes,
} from '../dominio/realizado';
import { mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { ErroValidacaoFolha } from './folha';
import { errosDoItemEDaArea, opcoesDoPlano, type OpcoesPlano } from './plano-lancamento';

/** Mesmo tipo de erro da folha: as telas já sabem mostrá-lo. */
export const ErroRealizado = ErroValidacaoFolha;

const PERM = { ver: 'orcamento.execucao.ver', editar: 'orcamento.realizado.editar', painel: 'orcamento.painel.ver' } as const;

const arred = (v: number) => Math.round(v * 100) / 100;
const limpar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ');
const vazioParaNulo = (t: string | null | undefined) => limpar(t) || null;
const anoDoMes = (mes: string) => Number(mes.slice(0, 4));
const ultimoDiaDoMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).toISOString().slice(0, 10);

/** Quem enxerga tudo (todos os serviços e as receitas). */
const veTudo = (quem: Autorizador) => quem.temPermissao(PERM.ver) || quem.temPermissao(PERM.editar);
const veServico = (quem: Autorizador, codigo: string) =>
  quem.temPermissao(PERM.editar) || quem.temPermissao(PERM.ver, { tipo: 'servico', codigo });

function exigirVerLinhas(quem: Autorizador) {
  if (!quem.temPermissao(PERM.editar) && !quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
}

function exigirMes(mes: string) {
  if (!mesInformavel(mes, mesAtualBrasilia())) throw new ErroRealizado('Escolha um mês até o mês atual, dentro dos últimos 24 meses.');
}

// ---------------------------------------------------------------------------
// Grade do mês
// ---------------------------------------------------------------------------

export interface LinhaGrade {
  /** Identifica a linha na tela (mesma chave do R1). */
  chave: string;
  tipo: TipoRealizado;
  servico: string | null;
  servicoNome: string;
  grupoId: string | null;
  grupoNome: string;
  fonteId: string;
  fonteNome: string;
  natureza: Natureza;
  previsto: number;
  realizado: number | null;
  versao: number | null;
  naoRecorrente: boolean;
  motivo: string | null;
  observacao: string | null;
  /** Termo (fonte restrita) adiantado; só em "adiantamento a termo". */
  termoId: string | null;
  /** Plano de contas (#221): item contábil e área do plano da despesa, opcionais. */
  itemId: string | null;
  areaPlanoId: string | null;
  /** Projeto de onde vem a linha (L18); a linha continua somando nos totais normalmente. */
  projetoId: string | null;
  projetoCodigo: string | null;
  /** Veio da Previsão (false = linha adicionada à mão). */
  prevista: boolean;
}

export interface GradeDoMes {
  mes: string;
  ano: number;
  mesAtual: string;
  /** A Previsão do ano está aprovada: a grade vem montada por ela. */
  previsaoAprovada: boolean;
  despesas: LinhaGrade[];
  receitas: LinhaGrade[];
  totais: TotaisMes;
  podeEditar: boolean;
  opcoes: {
    servicos: { codigo: string; nome: string }[];
    grupos: { id: string; nome: string; rh: boolean }[];
    fontes: { id: string; nome: string; restrita: boolean }[];
    /** Áreas, itens e plano vigente no mês (#221); `linhas = null` = exercício sem plano. */
    plano: OpcoesPlano;
    /** Projetos que o Projetos oferece à plataforma; `null` = sem Projetos (o campo some). */
    projetos: ProjetoParaRealizado[] | null;
  };
}

/** Projeto que a pessoa pode marcar numa linha do realizado (entregue pela plataforma; sem dado pessoal). */
export interface ProjetoParaRealizado {
  id: string;
  codigo: string;
  titulo: string;
}

/** A plataforma entrega a lista lida pelo Projetos para a pessoa; `null` = Projetos indisponível. */
export interface OpcoesProjetosRealizado {
  projetos?: readonly ProjetoParaRealizado[] | null;
}

export async function lerGradeDoMes(p: Planilhas, quem: Autorizador, mes: string, opcoesProjetos: OpcoesProjetosRealizado = {}): Promise<GradeDoMes> {
  exigirVerLinhas(quem);
  exigirMes(mes);
  const ano = anoDoMes(mes);
  const indice = Number(mes.slice(5)) - 1;
  const [exercicios, despesasT, receitasT, gruposT, fontesT, servicosT, ajustesT, realizadoT] = await lerTabelas(p, [
    Exercicios, Despesas, Receitas, GruposGasto, Fontes, Servicos, Ajustes, Realizado,
  ] as const);
  const ex = exercicios.ativos().find((e) => e.ano === ano);
  const previsaoAprovada = !!ex && ex.situacao !== 'elaboracao';
  const grupo = new Map(gruposT.todos().map((g) => [g.id, g]));
  const fonte = new Map(fontesT.todos().map((f) => [f.id, f]));
  const servico = new Map(servicosT.todos().map((s) => [s.codigo, s]));
  const nomeServico = (c: string | null) => (c ? (servico.get(c)?.nome ?? c) : '—');
  const tudo = veTudo(quem);

  const mapa = new Map<string, LinhaGrade>();
  const base = (tipo: TipoRealizado, servicoCodigo: string | null, grupoId: string | null, fonteId: string, natureza: Natureza, projetoId: string | null = null, projetoCodigo: string | null = null): LinhaGrade => ({
    chave: chaveLinha({ mes, tipo, servico: servicoCodigo, grupoId, fonteId, natureza, projetoId }),
    tipo,
    servico: servicoCodigo,
    servicoNome: nomeServico(servicoCodigo),
    grupoId,
    grupoNome: grupoId ? (grupo.get(grupoId)?.nome ?? '?') : '—',
    fonteId,
    fonteNome: fonte.get(fonteId)?.nome ?? '?',
    natureza,
    previsto: 0,
    realizado: null,
    versao: null,
    naoRecorrente: false,
    motivo: null,
    observacao: null,
    termoId: null,
    itemId: null,
    areaPlanoId: null,
    projetoId,
    projetoCodigo,
    prevista: false,
  });

  if (previsaoAprovada) {
    const deltas = deltasDosAjustes(ajustesT.ativos().filter((a) => a.ano === ano && a.situacao === 'aprovado'));
    const doMes = (r: object, id: string) => {
      const meses = Array.from({ length: 12 }, (_, i) => Number((r as Record<string, unknown>)[`m${i + 1}`] ?? 0) || 0);
      return mesesComAjuste(meses, deltas.get(id))[indice];
    };
    for (const d of despesasT.ativos().filter((x) => x.ano === ano && x.situacao === 'aceito' && x.fonte_id)) {
      if (!veServico(quem, d.servico)) continue;
      const natureza = naturezaSugerida('despesa', grupo.get(d.grupo_id)?.rh ?? false);
      const l = base('despesa', d.servico, d.grupo_id, d.fonte_id!, natureza);
      const atual = mapa.get(l.chave) ?? { ...l, prevista: true };
      atual.previsto = arred(atual.previsto + doMes(d, d.id));
      mapa.set(l.chave, atual);
    }
    if (tudo) {
      for (const r of receitasT.ativos().filter((x) => x.ano === ano)) {
        const l = base('receita', null, null, r.fonte_id, 'receita_comum');
        const atual = mapa.get(l.chave) ?? { ...l, prevista: true };
        atual.previsto = arred(atual.previsto + doMes(r, r.id));
        mapa.set(l.chave, atual);
      }
    }
  }

  const doMesGravado = realizadoT.ativos().filter((r) => r.mes === mes);
  for (const r of doMesGravado) {
    if (r.tipo === 'despesa' ? !veServico(quem, r.servico ?? '') : !tudo) continue;
    const l = base(r.tipo, r.servico, r.grupo_id, r.fonte_id, r.natureza, r.projeto_id ?? null, r.projeto_codigo ?? null);
    const linha = mapa.get(l.chave) ?? l;
    Object.assign(linha, { realizado: r.valor, versao: r.versao, naoRecorrente: r.nao_recorrente, motivo: r.motivo_nao_recorrente, observacao: r.observacao, termoId: r.fonte_termo_id ?? null, itemId: r.tipo === 'despesa' ? (r.item_id ?? null) : null, areaPlanoId: r.tipo === 'despesa' ? (r.area_plano_id ?? null) : null });
    mapa.set(l.chave, linha);
  }

  const ordem = (a: LinhaGrade, b: LinhaGrade) =>
    a.servicoNome.localeCompare(b.servicoNome, 'pt-BR') || a.grupoNome.localeCompare(b.grupoNome, 'pt-BR') || a.fonteNome.localeCompare(b.fonteNome, 'pt-BR');
  const linhas = [...mapa.values()];
  const despesas = linhas.filter((l) => l.tipo === 'despesa').sort(ordem);
  const receitas = linhas.filter((l) => l.tipo === 'receita').sort(ordem);
  const filtrados = linhas.filter((l) => l.realizado !== null).map((l) => ({ tipo: l.tipo, valor: l.realizado as number }));

  return {
    mes,
    ano,
    mesAtual: mesAtualBrasilia(),
    previsaoAprovada,
    despesas,
    receitas,
    totais: totaisDoMes(filtrados),
    podeEditar: quem.temPermissao(PERM.editar),
    opcoes: {
      servicos: servicosT.ativos().filter((s) => veServico(quem, s.codigo)).map((s) => ({ codigo: s.codigo, nome: s.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      grupos: gruposT.ativos().map((g) => ({ id: g.id, nome: g.nome, rh: g.rh })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      fontes: fontesT.ativos().map((f) => ({ id: f.id, nome: f.nome, restrita: f.uso === 'restrita' })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      plano: await opcoesDoPlano(p, ano, ultimoDiaDoMes(mes)),
      projetos: opcoesProjetos.projetos ? [...opcoesProjetos.projetos] : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Salvar o mês (tudo ou nada)
// ---------------------------------------------------------------------------

export interface EntradaLinha {
  tipo: TipoRealizado;
  servico: string | null;
  grupoId: string | null;
  fonteId: string;
  natureza: Natureza;
  /** null = sem valor: se a linha existia, é removida (encerrada). */
  valor: number | null;
  naoRecorrente?: boolean;
  motivo?: string | null;
  observacao?: string | null;
  /** Termo (fonte restrita) adiantado; vale só para natureza "adiantamento a termo". */
  termoId?: string | null;
  /** Item contábil e área do plano (#221); só despesa. undefined mantém o atual; vazio limpa. */
  itemId?: string | null;
  areaPlanoId?: string | null;
  /** Projeto de origem da linha (L18), opcional. Faz parte da chave: a linha de um projeto é outra linha, mesmo com o mesmo serviço, grupo, fonte e natureza. */
  projetoId?: string | null;
  /** Versão lida ao abrir a tela; ausente em linha nova. */
  versao?: number;
}

export async function salvarRealizadoDoMes(p: Planilhas, quem: Autorizador, mes: string, linhas: EntradaLinha[], opcoesProjetos: OpcoesProjetosRealizado = {}): Promise<{ gravados: number }> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  exigirMes(mes);
  const ano = anoDoMes(mes);
  const [servicosT, gruposT, fontesT, realizadoT] = await lerTabelas(p, [Servicos, GruposGasto, Fontes, Realizado] as const);
  const existentes = new Map(realizadoT.ativos().filter((r) => r.mes === mes).map((r) => [chaveLinha({ mes, tipo: r.tipo, servico: r.servico, grupoId: r.grupo_id, fonteId: r.fonte_id, natureza: r.natureza, projetoId: r.projeto_id }), r]));

  type Passo = { acao: 'novo' | 'alterar' | 'remover'; chave: string; existente: RegRealizado | null; campos: Record<string, unknown> };
  const passos: Passo[] = [];
  const vistas = new Set<string>();
  for (const l of linhas) {
    const servico = vazioParaNulo(l.servico);
    const grupoId = vazioParaNulo(l.grupoId);
    const projetoId = vazioParaNulo(l.projetoId);
    const chave = chaveLinha({ mes, tipo: l.tipo, servico, grupoId, fonteId: l.fonteId, natureza: l.natureza, projetoId });
    if (vistas.has(chave)) throw new ErroRealizado('A mesma linha (serviço, grupo, fonte, natureza e projeto) apareceu duas vezes. Junte os valores numa só.');
    vistas.add(chave);
    const existente = existentes.get(chave) ?? null;
    // R2, tudo ou nada: toda versão lida é conferida antes de gravar qualquer linha.
    if (existente ? existente.versao !== l.versao : l.versao !== undefined) throw new ErroConflito(existente?.id ?? chave);
    if (l.valor === null) {
      if (existente) passos.push({ acao: 'remover', chave, existente, campos: { ativo: false } });
      continue;
    }
    const valor = arred(l.valor);
    const motivo = vazioParaNulo(l.motivo);
    const naoRecorrente = !!l.naoRecorrente;
    const erros = conferirLinha({ tipo: l.tipo, servico, grupoId, fonteId: l.fonteId, natureza: l.natureza, valor, naoRecorrente, motivo });
    const termoId = l.tipo === 'despesa' && l.natureza === 'adiantamento_termo' ? vazioParaNulo(l.termoId) : null;
    // Dado antigo sem termo continua salvando (aparece como "termo não informado"); linha nova ou já com termo exige.
    if (l.natureza === 'adiantamento_termo' && l.tipo === 'despesa' && !termoId && (!existente || existente.fonte_termo_id)) {
      erros.push('Informe o termo adiantado (a fonte restrita do termo).');
    }
    const itemId = l.tipo === 'despesa' ? (l.itemId === undefined ? (existente?.item_id ?? null) : vazioParaNulo(l.itemId)) : null;
    const areaPlanoId = l.tipo === 'despesa' ? (l.areaPlanoId === undefined ? (existente?.area_plano_id ?? null) : vazioParaNulo(l.areaPlanoId)) : null;
    if (erros.length === 0) {
      erros.push(...(await errosDoItemEDaArea(p, { grupo_id: grupoId, item_id: itemId, area_plano_id: areaPlanoId }, existente ? { item_id: existente.item_id ?? null, area_plano_id: existente.area_plano_id ?? null } : undefined)));
    }
    if (erros.length === 0) {
      if (termoId && !fontesT.porId(termoId)) erros.push('O termo escolhido não existe.');
      if (servico && !servicosT.porId(servico) && !servicosT.todos().some((s) => s.codigo === servico)) erros.push('O serviço escolhido não existe.');
      if (grupoId && !gruposT.porId(grupoId)) erros.push('O grupo escolhido não existe.');
      if (!fontesT.porId(l.fonteId)) erros.push('A fonte escolhida não existe.');
    }
    // L18: o projeto vem da lista que o Projetos oferece à plataforma; o que já estava gravado na linha continua valendo.
    let projetoCodigo: string | null = null;
    if (projetoId) {
      const gravado = existente?.projeto_id === projetoId ? existente : null;
      const achado = opcoesProjetos.projetos?.find((x) => x.id === projetoId);
      if (gravado) projetoCodigo = gravado.projeto_codigo ?? null;
      else if (achado) projetoCodigo = achado.codigo;
      else erros.push('O projeto escolhido não está disponível. Escolha outro ou deixe o campo em branco.');
    }
    if (erros.length) throw new ErroRealizado(erros.join(' '));
    const campos = {
      projeto_id: projetoId,
      projeto_codigo: projetoCodigo,
      valor,
      nao_recorrente: naoRecorrente,
      motivo_nao_recorrente: naoRecorrente ? motivo : null,
      observacao: vazioParaNulo(l.observacao),
      fonte_termo_id: termoId,
      item_id: itemId,
      area_plano_id: areaPlanoId,
    };
    if (existente) {
      const mudou =
        existente.valor !== campos.valor || existente.nao_recorrente !== campos.nao_recorrente ||
        (existente.motivo_nao_recorrente ?? null) !== campos.motivo_nao_recorrente || (existente.observacao ?? null) !== campos.observacao || (existente.fonte_termo_id ?? null) !== campos.fonte_termo_id ||
        (existente.item_id ?? null) !== campos.item_id || (existente.area_plano_id ?? null) !== campos.area_plano_id;
      if (mudou) passos.push({ acao: 'alterar', chave, existente, campos });
    } else {
      passos.push({
        acao: 'novo',
        chave,
        existente: null,
        campos: { ano, mes, tipo: l.tipo, servico, grupo_id: grupoId, fonte_id: l.fonteId, natureza: l.natureza, ...campos },
      });
    }
  }

  // Leitura nova na hora de gravar: linha nova para uma chave que já existe vira conflito (não duplica).
  const [agora] = await lerTabelas(p, [Realizado] as const);
  const jaTem = new Set(agora.ativos().filter((r) => r.mes === mes).map((r) => chaveLinha({ mes, tipo: r.tipo, servico: r.servico, grupoId: r.grupo_id, fonteId: r.fonte_id, natureza: r.natureza, projetoId: r.projeto_id })));
  const novos = passos.filter((x) => x.acao === 'novo');
  for (const n of novos) if (jaTem.has(n.chave)) throw new ErroConflito(n.chave);

  const mexidos = passos.filter((x) => x.acao !== 'novo');
  const feitos = await atualizarVarios(
    p,
    Realizado,
    mexidos.map((x) => ({ id: x.existente!.id, versao: x.existente!.versao, mudancas: x.campos as never })),
    { email: quem.email },
  );
  const inseridos = await inserirRegistros(p, agora, novos.map((n) => n.campos as never), { email: quem.email });
  for (const r of inseridos) await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Realizado', registroId: r.id });
  for (const r of feitos) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Realizado', registroId: r.id, detalhes: { colunas: r.colunasAlteradas } });
  return { gravados: passos.length };
}

// ---------------------------------------------------------------------------
// Realizado do ano
// ---------------------------------------------------------------------------

export interface MesDoAno {
  mes: string;
  /** Há alguma linha informada no mês (visível para quem está vendo). */
  informado: boolean;
  totais: TotaisMes | null;
}

export interface RealizadoDoAno {
  ano: number;
  anos: number[];
  meses: MesDoAno[];
  /** Total do ano (só dos meses informados). */
  total: TotaisMes;
  /** false = só totais (Leitura) ou Coordenação (receita fora do seu escopo). */
  incluiReceita: boolean;
  escopoParcial: boolean;
}

export async function lerRealizadoDoAno(p: Planilhas, quem: Autorizador, anoEscolhido?: number): Promise<RealizadoDoAno> {
  const comLinhas = quem.temPermissao(PERM.editar) || quem.temPermissaoAlgumEscopo(PERM.ver);
  if (!comLinhas && !quem.temPermissao(PERM.painel)) throw new ErroPermissao();
  const [realizadoT] = await lerTabelas(p, [Realizado] as const);
  const ativos = realizadoT.ativos();
  const anos = [...new Set([...ativos.map((r) => r.ano), anoDoMes(mesAtualBrasilia())])].sort();
  const ano = anoEscolhido && anos.includes(anoEscolhido) ? anoEscolhido : anoDoMes(mesAtualBrasilia());
  const tudo = veTudo(quem) || !comLinhas; // Leitura: totais gerais, sem linhas
  const visiveis = ativos.filter((r) => r.ano === ano && (tudo || (r.tipo === 'despesa' && veServico(quem, r.servico ?? ''))));
  const meses: MesDoAno[] = Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${String(i + 1).padStart(2, '0')}`;
    const doMes = visiveis.filter((r) => r.mes === mes);
    return { mes, informado: doMes.length > 0, totais: doMes.length ? totaisDoMes(doMes) : null };
  });
  const total = totaisDoMes(visiveis);
  return { ano, anos, meses, total, incluiReceita: tudo, escopoParcial: !tudo };
}

/** R11: "Falta informar o realizado de <mês>": só para quem informa, quando o último mês fechado está vazio. */
export async function pendenciaDeRealizado(p: Planilhas, quem: Autorizador): Promise<string | null> {
  if (!quem.temPermissao(PERM.editar)) return null;
  const [realizadoT] = await lerTabelas(p, [Realizado] as const);
  const atual = mesAtualBrasilia();
  const alvo = mesAnterior(atual);
  return mesPendente(new Set(realizadoT.ativos().filter((r) => r.mes === alvo).map((r) => r.mes)), atual);
}
