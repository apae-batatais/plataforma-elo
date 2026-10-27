/**
 * Casos de uso da Folha de Pagamento (camada de aplicação).
 *
 * Quem vê o quê:
 * - orcamento.folha.ver: totais por centro de custo (global = todos; com escopo
 *   de área = só os centros daquela área).
 * - orcamento.folha.ver_individual (global): postos, colaboradores e valores.
 *   Abrir a lista ou uma ficha registra auditoria de leitura.
 * - orcamento.folha.editar (global): cadastrar postos, componentes e rateios.
 * - orcamento.parametros.editar (global): cargos, tabela salarial, centros e parâmetros.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas } from '@/nucleo/estrutura/tabelas';
import {
  ativoNoMes, COMPONENTES, componentesZerados, custoMensal, distribuir, PARAMETROS, parametrosCom, salarioPelaTabela,
  situacaoRateio, validarParametros, validarRateio, vigenteNoMes,
  type Componentes as ValoresComponentes, type LinhaRateio, type Parametros as ValoresParametros,
} from '../dominio/folha';
import {
  Cargos, CentrosCusto, Componentes, NIVEIS, Parametros, Postos, Rateios, TabelaSalarial,
  type RegComponentes, type RegPosto, type RegRateio,
} from '../dados/tabelas';

export class ErroValidacaoFolha extends Error {}

const PERM = {
  ver: 'orcamento.folha.ver',
  individual: 'orcamento.folha.ver_individual',
  editar: 'orcamento.folha.editar',
  parametros: 'orcamento.parametros.editar',
} as const;

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Leitura de tudo (3 chamadas ao Google: uma por planilha)
// ---------------------------------------------------------------------------

export async function lerFolha(p: Planilhas) {
  const [centros, cargos, tabela, postos, componentes, rateios, parametros, areas] = await lerTabelas(p, [
    CentrosCusto, Cargos, TabelaSalarial, Postos, Componentes, Rateios, Parametros, Areas,
  ] as const);
  const valores = parametrosCom(Object.fromEntries(parametros.ativos().map((x) => [x.chave, x.valor])));

  const porPosto = <T extends { posto_id: string }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) m.set(x.posto_id, [...(m.get(x.posto_id) ?? []), x]);
    return m;
  };
  const componentesPorPosto = porPosto(componentes.ativos());
  const lotesPorPosto = new Map<string, { lote: string; vigencia: string; criado_em: string; linhas: LinhaRateio[] }[]>();
  for (const [posto, linhas] of porPosto(rateios.ativos())) {
    const lotes = new Map<string, RegRateio[]>();
    for (const l of linhas) lotes.set(l.lote, [...(lotes.get(l.lote) ?? []), l]);
    lotesPorPosto.set(
      posto,
      [...lotes].map(([lote, ls]) => ({
        lote,
        vigencia: ls[0].vigencia,
        criado_em: ls[0].criado_em,
        linhas: ls.map((x) => ({ centro: x.centro_custo, percentual: x.percentual })),
      })),
    );
  }

  const ultimo = <T extends { vigencia: string; criado_em: string }>(lista: T[] | undefined) =>
    lista ? vigenteNoMes(lista, 9999, 12) : undefined;

  return {
    parametros: valores,
    parametrosLidos: parametros,
    centros: centros.ativos(),
    cargos: cargos.ativos(),
    tabela: tabela.ativos(),
    postos: postos.ativos(),
    areas: areas.ativos(),
    /** Componentes que valem no mês (ou os mais recentes, sem mês). */
    componentes(postoId: string, mes?: number): ValoresComponentes | undefined {
      const lista = componentesPorPosto.get(postoId);
      const r = mes ? (lista ? vigenteNoMes(lista, valores.ano, mes) : undefined) : ultimo(lista);
      return r ? paraValores(r) : undefined;
    },
    /** Rateio que vale no mês (ou o mais recente, sem mês). */
    rateio(postoId: string, mes?: number): LinhaRateio[] | undefined {
      const lista = lotesPorPosto.get(postoId);
      return (mes ? (lista ? vigenteNoMes(lista, valores.ano, mes) : undefined) : ultimo(lista))?.linhas;
    },
  };
}

export type FolhaLida = Awaited<ReturnType<typeof lerFolha>>;

function paraValores(r: RegComponentes): ValoresComponentes {
  const v = componentesZerados();
  for (const c of COMPONENTES) v[c.chave] = (r[c.chave] as number | null) ?? 0;
  return v;
}

function custoDoPosto(f: FolhaLida, posto: RegPosto, mes: number): number {
  if (!ativoNoMes(posto, f.parametros.ano, mes)) return 0;
  const c = f.componentes(posto.id, mes);
  return c ? custoMensal(c, f.parametros, mes).total : 0;
}

// ---------------------------------------------------------------------------
// Resumo por centro de custo (totais)
// ---------------------------------------------------------------------------

export interface ResumoFolha {
  ano: number;
  todasAsAreas: boolean;
  centros: { codigo: string; nome: string; area: string | null; areaNome: string; mensal: number[]; anual: number }[];
  areas: { codigo: string; nome: string; mensal: number[]; anual: number }[];
  total: { mensal: number[]; anual: number };
  /** Só para quem vê todas as áreas. */
  alertas: { semRateio: number; foraDe100: number; vagasPrevistas: number; postosAtivos: number; custoSemRateio: number } | null;
}

export async function resumoFolha(p: Planilhas, quem: Autorizador): Promise<ResumoFolha> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const f = await lerFolha(p);
  const todas = quem.temPermissao(PERM.ver);
  const areasVisiveis = new Set(
    f.areas.filter((a) => todas || quem.temPermissao(PERM.ver, { tipo: 'area', codigo: a.codigo })).map((a) => a.codigo),
  );
  const nomeArea = new Map(f.areas.map((a) => [a.codigo, a.nome]));

  const porCentro = new Map<string, number[]>();
  const semRateioMensal = MESES.map(() => 0);
  for (const posto of f.postos) {
    for (const mes of MESES) {
      const custo = custoDoPosto(f, posto, mes);
      if (custo === 0) continue;
      const rateio = f.rateio(posto.id, mes);
      if (situacaoRateio(rateio) !== 'ok') {
        semRateioMensal[mes - 1] += custo;
        continue;
      }
      for (const [centro, valor] of distribuir(custo, rateio!)) {
        const linha = porCentro.get(centro) ?? MESES.map(() => 0);
        linha[mes - 1] += valor;
        porCentro.set(centro, linha);
      }
    }
  }

  const arred = (v: number) => Math.round(v * 100) / 100;
  const centrosConhecidos = new Map(f.centros.map((c) => [c.codigo, c]));
  const centros = [...porCentro]
    .map(([codigo, mensal]) => {
      const c = centrosConhecidos.get(codigo);
      const area = c?.area ?? null;
      return {
        codigo,
        nome: c?.nome ?? codigo,
        area,
        areaNome: area ? (nomeArea.get(area) ?? area) : 'Sem área',
        mensal: mensal.map(arred),
        anual: arred(mensal.reduce((s, v) => s + v, 0)),
      };
    })
    .filter((c) => todas || (c.area !== null && areasVisiveis.has(c.area)))
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));

  const areasMap = new Map<string, { codigo: string; nome: string; mensal: number[] }>();
  for (const c of centros) {
    const chave = c.area ?? '';
    const a = areasMap.get(chave) ?? { codigo: chave, nome: c.areaNome, mensal: MESES.map(() => 0) };
    c.mensal.forEach((v, i) => (a.mensal[i] += v));
    areasMap.set(chave, a);
  }
  const areas = [...areasMap.values()].map((a) => ({ ...a, mensal: a.mensal.map(arred), anual: arred(a.mensal.reduce((s, v) => s + v, 0)) }));
  const totalMensal = MESES.map((_, i) => arred(centros.reduce((s, c) => s + c.mensal[i], 0)));

  let alertas: ResumoFolha['alertas'] = null;
  if (todas) {
    const ativos = f.postos.filter((x) => !x.desligamento || x.desligamento >= `${f.parametros.ano}-01-01`);
    const situacoes = ativos.map((x) => situacaoRateio(f.rateio(x.id)));
    alertas = {
      postosAtivos: ativos.length,
      semRateio: situacoes.filter((s) => s === 'sem_rateio').length,
      foraDe100: situacoes.filter((s) => s === 'fora_de_100').length,
      vagasPrevistas: ativos.filter((x) => !x.colaborador).length,
      custoSemRateio: arred(semRateioMensal.reduce((s, v) => s + v, 0)),
    };
  }

  return {
    ano: f.parametros.ano,
    todasAsAreas: todas,
    centros,
    areas,
    total: { mensal: totalMensal, anual: arred(totalMensal.reduce((s, v) => s + v, 0)) },
    alertas,
  };
}

// ---------------------------------------------------------------------------
// Postos (valores individuais)
// ---------------------------------------------------------------------------

export interface LinhaPosto {
  id: string;
  ficha: string | null;
  colaborador: string | null;
  cargo: string;
  nivel: string | null;
  cargaHoraria: number | null;
  inicio: string;
  desligamento: string | null;
  custoMensal: number;
  custoAnual: number;
  situacaoRateio: 'sem_rateio' | 'fora_de_100' | 'ok';
  centros: string[];
  areas: string[];
}

export async function listarPostos(p: Planilhas, quem: Autorizador): Promise<{ ano: number; postos: LinhaPosto[]; cargos: string[]; areas: { codigo: string; nome: string }[]; centros: { codigo: string; nome: string }[] }> {
  exigir(quem, PERM.individual);
  const f = await lerFolha(p);
  const nomeCargo = new Map(f.cargos.map((c) => [c.codigo, c.nome]));
  const nomeCentro = new Map(f.centros.map((c) => [c.codigo, c.nome]));
  const areaCentro = new Map(f.centros.map((c) => [c.codigo, c.area]));
  const postos = f.postos
    .map((x) => {
      const rateio = f.rateio(x.id);
      const mensal = MESES.map((m) => custoDoPosto(f, x, m));
      const mesAtual = mensal.findLast((v) => v > 0) ?? 0;
      return {
        id: x.id,
        ficha: x.ficha,
        colaborador: x.colaborador,
        cargo: nomeCargo.get(x.cargo) ?? x.cargo,
        nivel: x.nivel,
        cargaHoraria: x.carga_horaria,
        inicio: x.inicio,
        desligamento: x.desligamento,
        custoMensal: mesAtual,
        custoAnual: Math.round(mensal.reduce((s, v) => s + v, 0) * 100) / 100,
        situacaoRateio: situacaoRateio(rateio),
        centros: (rateio ?? []).map((l) => l.centro),
        areas: [...new Set((rateio ?? []).map((l) => areaCentro.get(l.centro)).filter((a): a is string => Boolean(a)))],
      };
    })
    .sort((a, b) => (a.colaborador ?? '~').localeCompare(b.colaborador ?? '~', 'pt-BR'));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Postos', detalhes: { lista: true } });
  return {
    ano: f.parametros.ano,
    postos,
    cargos: [...new Set(postos.map((x) => x.cargo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    areas: f.areas.map((a) => ({ codigo: a.codigo, nome: a.nome })),
    centros: f.centros.map((c) => ({ codigo: c.codigo, nome: nomeCentro.get(c.codigo) ?? c.codigo })),
  };
}

/** Dados para o formulário: cargos, tabela salarial, centros e parâmetros. */
export interface CadastrosDoFormulario {
  ano: number;
  parametros: ValoresParametros;
  cargos: { codigo: string; nome: string; cargaReferencia: number | null }[];
  /** Valor vigente de cada cargo por nível: chave "cargo|nivel". */
  tabela: Record<string, number>;
  centros: { codigo: string; nome: string; area: string }[];
}

function cadastrosDoFormulario(f: FolhaLida): CadastrosDoFormulario {
  const nomeArea = new Map(f.areas.map((a) => [a.codigo, a.nome]));
  const tabela: Record<string, number> = {};
  const porChave = new Map<string, typeof f.tabela>();
  for (const t of f.tabela) porChave.set(`${t.cargo}|${t.nivel}`, [...(porChave.get(`${t.cargo}|${t.nivel}`) ?? []), t]);
  for (const [chave, lista] of porChave) {
    const v = vigenteNoMes(lista, 9999, 12);
    if (v) tabela[chave] = v.valor;
  }
  return {
    ano: f.parametros.ano,
    parametros: f.parametros,
    cargos: f.cargos.map((c) => ({ codigo: c.codigo, nome: c.nome, cargaReferencia: c.carga_horaria_referencia })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    tabela,
    centros: f.centros
      .map((c) => ({ codigo: c.codigo, nome: c.nome, area: c.area ? (nomeArea.get(c.area) ?? c.area) : 'Sem área' }))
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

export interface FichaPosto {
  posto: { id: string; versao: number; ficha: string | null; colaborador: string | null; cargo: string; nivel: string | null; cargaHoraria: number | null; inicio: string; desligamento: string | null; observacao: string | null } | null;
  componentes: ValoresComponentes;
  rateio: LinhaRateio[];
  foraDaTabela: boolean;
  cadastros: CadastrosDoFormulario;
  podeEditar: boolean;
}

export async function fichaDoPosto(p: Planilhas, quem: Autorizador, id: string | null): Promise<FichaPosto> {
  exigir(quem, id ? PERM.individual : PERM.editar);
  const f = await lerFolha(p);
  const cadastros = cadastrosDoFormulario(f);
  const podeEditar = quem.temPermissao(PERM.editar);
  if (!id) return { posto: null, componentes: componentesZerados(), rateio: [], foraDaTabela: false, cadastros, podeEditar };

  const x = f.postos.find((y) => y.id === id);
  if (!x) throw new ErroValidacaoFolha('Posto não encontrado.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Postos', registroId: id });
  return {
    posto: { id: x.id, versao: x.versao, ficha: x.ficha, colaborador: x.colaborador, cargo: x.cargo, nivel: x.nivel, cargaHoraria: x.carga_horaria, inicio: x.inicio, desligamento: x.desligamento, observacao: x.observacao },
    componentes: f.componentes(id) ?? componentesZerados(),
    rateio: f.rateio(id) ?? [],
    foraDaTabela: false,
    cadastros,
    podeEditar,
  };
}

export interface DadosPosto {
  id?: string;
  versao?: number;
  ficha: string | null;
  colaborador: string | null;
  cargo: string;
  nivel: string | null;
  cargaHoraria: number | null;
  inicio: string;
  observacao: string | null;
  componentes: ValoresComponentes;
  rateio: LinhaRateio[];
  /** A partir de quando valem os componentes e o rateio informados (AAAA-MM-DD). */
  vigencia: string;
}

const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ordenarRateio = (l: LinhaRateio[]) => [...l].sort((a, b) => a.centro.localeCompare(b.centro));

export async function salvarPosto(p: Planilhas, quem: Autorizador, d: DadosPosto): Promise<string> {
  exigir(quem, PERM.editar);
  const f = await lerFolha(p);
  const erros: string[] = [];
  if (!f.cargos.some((c) => c.codigo === d.cargo)) erros.push('Escolha um cargo da tabela.');
  if (d.nivel && !(NIVEIS as readonly string[]).includes(d.nivel)) erros.push('Nível inválido.');
  if (!DATA.test(d.inicio)) erros.push('Informe a data de admissão (ou de início da vaga).');
  if (!DATA.test(d.vigencia)) erros.push('Informe a partir de quando valem os valores.');
  if (d.cargaHoraria !== null && (!Number.isFinite(d.cargaHoraria) || d.cargaHoraria <= 0 || d.cargaHoraria > 44)) erros.push('Carga horária semanal entre 1 e 44.');
  for (const c of COMPONENTES) {
    const v = d.componentes[c.chave];
    if (!Number.isFinite(v) || v < 0) erros.push(`${c.nome}: valor inválido.`);
  }
  if (d.componentes.salario_base <= 0 && d.componentes.bolsa_estagio <= 0) erros.push('Informe o salário base (ou a bolsa estágio).');
  erros.push(...validarRateio(d.rateio));
  const desconhecidos = d.rateio.filter((l) => l.centro && !f.centros.some((c) => c.codigo === l.centro));
  if (desconhecidos.length) erros.push('Há centro de custo que não existe no cadastro.');
  const ficha = d.ficha?.trim() || null;
  if (ficha && f.postos.some((x) => x.ficha === ficha && x.id !== d.id && !x.desligamento)) erros.push(`Já existe um posto ativo com a ficha ${ficha}.`);
  if (erros.length) throw new ErroValidacaoFolha([...new Set(erros)].join(' '));

  const cargo = f.cargos.find((c) => c.codigo === d.cargo)!;
  const valorTabela = d.nivel ? cadastrosDoFormulario(f).tabela[`${d.cargo}|${d.nivel}`] : undefined;
  const foraDaTabela = valorTabela !== undefined && salarioPelaTabela(valorTabela, d.cargaHoraria, cargo.carga_horaria_referencia) !== d.componentes.salario_base;
  const autoria = { email: quem.email };
  const camposPosto = {
    ficha,
    colaborador: d.colaborador?.trim() || null,
    cargo: d.cargo,
    nivel: d.nivel || null,
    carga_horaria: d.cargaHoraria,
    inicio: d.inicio,
    observacao: d.observacao?.trim() || null,
  };

  let postoId: string;
  const colunas: string[] = [];
  if (!d.id) {
    const novo = await inserir(p, Postos, camposPosto, autoria);
    postoId = novo.id;
  } else {
    const atual = f.postos.find((x) => x.id === d.id);
    if (!atual) throw new ErroValidacaoFolha('Posto não encontrado.');
    postoId = atual.id;
    const mudou = Object.entries(camposPosto).some(([k, v]) => (atual as unknown as Record<string, unknown>)[k] !== v);
    if (mudou) {
      const r = await atualizar(p, Postos, atual.id, d.versao ?? atual.versao, camposPosto, autoria);
      colunas.push(...r.colunasAlteradas);
    }
  }

  const vigencia = d.id ? d.vigencia : d.inicio <= d.vigencia ? d.inicio : d.vigencia;
  if (!iguais(f.componentes(postoId), d.componentes) || !d.id) {
    await inserir(p, Componentes, { posto_id: postoId, vigencia, ...d.componentes, fora_da_tabela: foraDaTabela }, autoria);
    colunas.push('componentes');
  }
  if (!iguais(ordenarRateio(f.rateio(postoId) ?? []), ordenarRateio(d.rateio)) || !d.id) {
    const [rateios] = await lerTabelas(p, [Rateios] as const);
    const lote = crypto.randomUUID();
    await inserirRegistros(p, rateios, d.rateio.map((l) => ({ posto_id: postoId, lote, centro_custo: l.centro, percentual: l.percentual, vigencia })), autoria);
    colunas.push('rateio');
  }

  if (!d.id) await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Postos', registroId: postoId });
  else if (colunas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Postos', registroId: postoId, detalhes: { colunas } });
  return postoId;
}

export async function encerrarPosto(p: Planilhas, quem: Autorizador, id: string, versao: number, desligamento: string): Promise<void> {
  exigir(quem, PERM.editar);
  if (!DATA.test(desligamento)) throw new ErroValidacaoFolha('Informe a data de desligamento.');
  const { colunasAlteradas } = await atualizar(p, Postos, id, versao, { desligamento }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Postos', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Rateio geral (vários postos de uma vez, uma gravação só)
// ---------------------------------------------------------------------------

export interface GradeRateio {
  ano: number;
  centros: { codigo: string; nome: string; area: string }[];
  postos: { id: string; rotulo: string; cargo: string; situacao: 'sem_rateio' | 'fora_de_100' | 'ok'; rateio: LinhaRateio[] }[];
}

export async function gradeDeRateio(p: Planilhas, quem: Autorizador): Promise<GradeRateio> {
  exigir(quem, PERM.editar);
  exigir(quem, PERM.individual);
  const f = await lerFolha(p);
  const nomeCargo = new Map(f.cargos.map((c) => [c.codigo, c.nome]));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Rateios', detalhes: { grade: true } });
  return {
    ano: f.parametros.ano,
    centros: cadastrosDoFormulario(f).centros,
    postos: f.postos
      .filter((x) => !x.desligamento)
      .map((x) => {
        const rateio = f.rateio(x.id) ?? [];
        return {
          id: x.id,
          rotulo: x.colaborador ? `${x.colaborador}${x.ficha ? ` (ficha ${x.ficha})` : ''}` : `Vaga prevista desde ${x.inicio.slice(0, 7)}`,
          cargo: nomeCargo.get(x.cargo) ?? x.cargo,
          situacao: situacaoRateio(rateio),
          rateio,
        };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
  };
}

export async function salvarRateios(
  p: Planilhas,
  quem: Autorizador,
  lista: { postoId: string; rateio: LinhaRateio[] }[],
  vigencia: string,
): Promise<number> {
  exigir(quem, PERM.editar);
  if (!DATA.test(vigencia)) throw new ErroValidacaoFolha('Informe a partir de quando vale o rateio.');
  const f = await lerFolha(p);
  const erros: string[] = [];
  const nome = new Map(f.postos.map((x) => [x.id, x.colaborador ?? 'Vaga prevista']));
  const mudancas = lista.filter((x) => !iguais(ordenarRateio(f.rateio(x.postoId) ?? []), ordenarRateio(x.rateio)));
  for (const x of mudancas) {
    if (!nome.has(x.postoId)) erros.push('Posto não encontrado.');
    const e = validarRateio(x.rateio);
    if (e.length) erros.push(`${nome.get(x.postoId)}: ${e.join(' ')}`);
    if (x.rateio.some((l) => !f.centros.some((c) => c.codigo === l.centro))) erros.push(`${nome.get(x.postoId)}: centro de custo inexistente.`);
  }
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' · '));
  if (mudancas.length === 0) return 0;

  const [rateios] = await lerTabelas(p, [Rateios] as const);
  const linhas = mudancas.flatMap((x) => {
    const lote = crypto.randomUUID();
    return x.rateio.map((l) => ({ posto_id: x.postoId, lote, centro_custo: l.centro, percentual: l.percentual, vigencia }));
  });
  await inserirRegistros(p, rateios, linhas, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Rateios', detalhes: { postos: mudancas.length, colunas: ['rateio'] } });
  return mudancas.length;
}

// ---------------------------------------------------------------------------
// Cadastros: centros de custo, cargos, tabela salarial e parâmetros
// ---------------------------------------------------------------------------

export async function cadastros(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const f = await lerFolha(p);
  const formulario = cadastrosDoFormulario(f);
  return {
    ...formulario,
    areas: f.areas.map((a) => ({ codigo: a.codigo, nome: a.nome })),
    cargosCompletos: f.cargos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    podeEditar: quem.temPermissao(PERM.parametros),
  };
}

const CODIGO = /^[a-z0-9_]+$/;

export async function salvarCentroCusto(p: Planilhas, quem: Autorizador, d: { codigo: string; nome: string; area: string | null }): Promise<void> {
  exigir(quem, PERM.parametros);
  const codigo = d.codigo.trim().toLowerCase();
  if (!CODIGO.test(codigo)) throw new ErroValidacaoFolha('Código em minúsculas, sem espaços nem acentos (ex.: rural_viveiro).');
  if (d.nome.trim().length < 2) throw new ErroValidacaoFolha('Informe o nome do centro de custo.');
  const [centros, areas] = await lerTabelas(p, [CentrosCusto, Areas] as const);
  if (centros.todos().some((c) => c.codigo === codigo)) throw new ErroValidacaoFolha('Já existe um centro de custo com este código.');
  if (d.area && !areas.ativos().some((a) => a.codigo === d.area)) throw new ErroValidacaoFolha('Área inexistente.');
  const r = await inserir(p, CentrosCusto, { codigo, nome: d.nome.trim(), area: d.area }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'CentrosCusto', registroId: r.id });
}

export async function salvarCargo(p: Planilhas, quem: Autorizador, d: { codigo: string; nome: string; grupo: string | null; cargaReferencia: number | null }): Promise<void> {
  exigir(quem, PERM.parametros);
  const codigo = d.codigo.trim().toLowerCase();
  if (!CODIGO.test(codigo)) throw new ErroValidacaoFolha('Código em minúsculas, sem espaços nem acentos (ex.: professor).');
  if (d.nome.trim().length < 2) throw new ErroValidacaoFolha('Informe o nome do cargo.');
  const [cargos] = await lerTabelas(p, [Cargos] as const);
  if (cargos.todos().some((c) => c.codigo === codigo)) throw new ErroValidacaoFolha('Já existe um cargo com este código.');
  const r = await inserir(p, Cargos, { codigo, nome: d.nome.trim(), grupo: d.grupo, carga_horaria_referencia: d.cargaReferencia }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Cargos', registroId: r.id });
}

export async function salvarValorTabela(p: Planilhas, quem: Autorizador, d: { cargo: string; nivel: string; valor: number; vigencia: string }): Promise<void> {
  exigir(quem, PERM.parametros);
  if (!(NIVEIS as readonly string[]).includes(d.nivel)) throw new ErroValidacaoFolha('Nível inválido.');
  if (!Number.isFinite(d.valor) || d.valor <= 0) throw new ErroValidacaoFolha('Informe um valor maior que zero.');
  if (!DATA.test(d.vigencia)) throw new ErroValidacaoFolha('Informe a vigência.');
  const [cargos] = await lerTabelas(p, [Cargos] as const);
  if (!cargos.ativos().some((c) => c.codigo === d.cargo)) throw new ErroValidacaoFolha('Cargo inexistente.');
  const r = await inserir(p, TabelaSalarial, { cargo: d.cargo, nivel: d.nivel as (typeof NIVEIS)[number], valor: d.valor, vigencia: d.vigencia }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'TabelaSalarial', registroId: r.id });
}

export async function salvarParametros(p: Planilhas, quem: Autorizador, valores: ValoresParametros): Promise<void> {
  exigir(quem, PERM.parametros);
  const erros = validarParametros(valores);
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' '));
  const [lidos] = await lerTabelas(p, [Parametros] as const);
  const alterados: string[] = [];
  for (const def of PARAMETROS) {
    const atual = lidos.ativos().find((x) => x.chave === def.chave);
    const novo = valores[def.chave];
    if (atual) {
      if (atual.valor !== novo) {
        await atualizar(p, Parametros, atual.id, atual.versao, { valor: novo }, { email: quem.email });
        alterados.push(def.chave);
      }
    } else if (novo !== def.padrao) {
      await inserir(p, Parametros, { chave: def.chave, valor: novo }, { email: quem.email });
      alterados.push(def.chave);
    }
  }
  if (alterados.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Parametros', detalhes: { colunas: alterados } });
}

export { componentesZerados };
