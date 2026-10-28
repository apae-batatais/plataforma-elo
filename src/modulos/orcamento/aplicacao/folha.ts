/**
 * Casos de uso da Folha de Pagamento (camada de aplicação).
 *
 * Quem vê o quê:
 * - orcamento.folha.ver: totais por Serviço (global = todos; com escopo de
 *   unidade, área ou serviço = só os serviços desse escopo).
 * - orcamento.folha.ver_individual (global): postos, colaboradores e valores.
 *   Abrir a lista ou uma ficha registra auditoria de leitura.
 * - orcamento.folha.editar (global): cadastrar postos, componentes e lotação.
 * - orcamento.parametros.editar (global): parâmetros da folha.
 *
 * Os "centros de custo" da lotação são os Serviços do Núcleo. No código, as
 * linhas de lotação continuam chamadas de rateio ({ centro, percentual }),
 * onde `centro` é o código do Serviço.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import {
  ativoNoMes, calcularLinha, COMPONENTES, componentesZerados, PARAMETROS, parametrosCom, resumirEstudo,
  situacaoRateio, validarParametros, validarRateio, vigenteNoMes,
  type Componentes as ValoresComponentes, type LinhaCalculada, type LinhaRateio, type ResumoEstudo, type Parametros as ValoresParametros,
} from '../dominio/folha';
import { Componentes, Parametros, Postos, Rateios, type RegComponentes, type RegPosto, type RegRateio } from '../dados/tabelas';

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
  const [postos, componentes, rateios, parametros, areas, servicos] = await lerTabelas(p, [
    Postos, Componentes, Rateios, Parametros, Areas, Servicos,
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
        linhas: ls.map((x) => ({ centro: x.servico, percentual: x.percentual })),
      })),
    );
  }

  const ultimo = <T extends { vigencia: string; criado_em: string }>(lista: T[] | undefined) =>
    lista ? vigenteNoMes(lista, 9999, 12) : undefined;

  return {
    parametros: valores,
    parametrosLidos: parametros,
    /** Serviços ativos: são os "centros de custo" da lotação. */
    centros: servicos.ativos().map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area })),
    /** Todos os serviços, inclusive os excluídos: para mostrar o nome de lotações antigas. */
    todosCentros: servicos.todos().map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area })),
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
  v.reajuste = r.reajuste ?? 0;
  v.hora_atividade = r.hora_atividade;
  return v;
}

function custoDoPosto(f: FolhaLida, posto: RegPosto, mes: number): number {
  if (!ativoNoMes(posto, f.parametros.ano, mes)) return 0;
  const c = f.componentes(posto.id, mes);
  return c ? calcularLinha(c, posto.carga_horaria, f.parametros, mes).total : 0;
}

// ---------------------------------------------------------------------------
// Resumo por Serviço (totais)
// ---------------------------------------------------------------------------

export interface ResumoFolha {
  ano: number;
  mes: number;
  todasAsAreas: boolean;
  /** Resumo no formato da aba Estudo, no mês escolhido. */
  estudoMes: ResumoEstudo;
  /** O mesmo resumo somando os 12 meses do ano. */
  estudoAno: ResumoEstudo;
  /** Total geral (com encargos) por serviço da lotação. */
  centros: { codigo: string; nome: string; area: string | null; areaNome: string; mensal: number[]; anual: number }[];
  areas: { codigo: string; nome: string; mensal: number[]; anual: number }[];
  total: { mensal: number[]; anual: number };
  /** Só para quem vê todas as áreas. */
  alertas: { semRateio: number; foraDe100: number; vagasPrevistas: number; postosAtivos: number; custoSemRateio: number } | null;
}

const SEM_LOTACAO = '__sem_lotacao__';

export async function resumoFolha(p: Planilhas, quem: Autorizador, mesEscolhido?: number): Promise<ResumoFolha> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const f = await lerFolha(p);
  const todas = quem.temPermissao(PERM.ver);
  const ve = (servico: string) => todas || quem.temPermissao(PERM.ver, { tipo: 'servico', codigo: servico });
  const nomeArea = new Map(f.areas.map((a) => [a.codigo, a.nome]));
  const hoje = new Date();
  const mes = mesEscolhido && mesEscolhido >= 1 && mesEscolhido <= 12 ? mesEscolhido : f.parametros.ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 1;
  const arred = (v: number) => Math.round(v * 100) / 100;

  type Item = { c: ValoresComponentes; calc: LinhaCalculada; peso: number };
  const itensDoMes: Item[][] = [];
  const porServico = new Map<string, Item[][]>();
  let custoSemRateio = 0;
  for (const m of MESES) {
    const doMes: Item[] = [];
    for (const posto of f.postos) {
      if (!ativoNoMes(posto, f.parametros.ano, m)) continue;
      const c = f.componentes(posto.id, m);
      if (!c) continue;
      const calc = calcularLinha(c, posto.carga_horaria, f.parametros, m);
      const rateio = f.rateio(posto.id, m);
      const linhas = situacaoRateio(rateio) === 'ok' ? rateio! : [{ centro: SEM_LOTACAO, percentual: 100 }];
      if (linhas[0].centro === SEM_LOTACAO) custoSemRateio += calc.total;
      let pesoVisivel = 0;
      for (const l of linhas) {
        if (l.centro === SEM_LOTACAO ? !todas : !ve(l.centro)) continue;
        const peso = l.percentual / 100;
        pesoVisivel += peso;
        const lista = porServico.get(l.centro) ?? MESES.map(() => []);
        lista[m - 1].push({ c, calc, peso });
        porServico.set(l.centro, lista);
      }
      if (pesoVisivel > 0) doMes.push({ c, calc, peso: pesoVisivel });
    }
    itensDoMes.push(doMes);
  }

  const servicos = new Map(f.todosCentros.map((c) => [c.codigo, c]));
  const centros = [...porServico]
    .map(([codigo, meses]) => {
      const s = servicos.get(codigo);
      const area = s?.area ?? null;
      const mensal = meses.map((itens) => resumirEstudo(itens, f.parametros).totalGeral);
      return {
        codigo,
        nome: codigo === SEM_LOTACAO ? 'Sem lotação' : (s?.nome ?? codigo),
        area,
        areaNome: codigo === SEM_LOTACAO ? 'Sem lotação' : area ? (nomeArea.get(area) ?? area) : 'Sem área',
        mensal,
        anual: arred(mensal.reduce((x, v) => x + v, 0)),
      };
    })
    .sort((a, b) => (a.codigo === SEM_LOTACAO ? 1 : b.codigo === SEM_LOTACAO ? -1 : a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')));

  const areasMap = new Map<string, { codigo: string; nome: string; mensal: number[] }>();
  for (const c of centros) {
    const chave = c.codigo === SEM_LOTACAO ? SEM_LOTACAO : (c.area ?? '');
    const a = areasMap.get(chave) ?? { codigo: chave, nome: c.areaNome, mensal: MESES.map(() => 0) };
    c.mensal.forEach((v, i) => (a.mensal[i] += v));
    areasMap.set(chave, a);
  }
  const areas = [...areasMap.values()].map((a) => ({ ...a, mensal: a.mensal.map(arred), anual: arred(a.mensal.reduce((s, v) => s + v, 0)) }));
  const estudoMes = resumirEstudo(itensDoMes[mes - 1], f.parametros);
  const estudoAno = { ...resumirEstudo(itensDoMes.flat(), f.parametros), pessoas: estudoMes.pessoas };
  const totalMensal = itensDoMes.map((itens) => resumirEstudo(itens, f.parametros).totalGeral);

  let alertas: ResumoFolha['alertas'] = null;
  if (todas) {
    const ativos = f.postos.filter((x) => !x.desligamento || x.desligamento >= `${f.parametros.ano}-01-01`);
    const situacoes = ativos.map((x) => situacaoRateio(f.rateio(x.id)));
    alertas = {
      postosAtivos: ativos.length,
      semRateio: situacoes.filter((s) => s === 'sem_rateio').length,
      foraDe100: situacoes.filter((s) => s === 'fora_de_100').length,
      vagasPrevistas: ativos.filter((x) => !x.ficha).length,
      custoSemRateio: arred(custoSemRateio),
    };
  }

  return {
    ano: f.parametros.ano,
    mes,
    todasAsAreas: todas,
    estudoMes,
    estudoAno,
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
  departamento: string | null;
  cargaHoraria: number | null;
  /** Valores digitados e colunas calculadas no mês de referência (aba Estudo). */
  valores: ValoresComponentes;
  calculo: LinhaCalculada;
  inicio: string;
  desligamento: string | null;
  custoMensal: number;
  custoAnual: number;
  situacaoRateio: 'sem_rateio' | 'fora_de_100' | 'ok';
  centros: string[];
  areas: string[];
}

export async function listarPostos(p: Planilhas, quem: Autorizador, mesEscolhido?: number): Promise<{ ano: number; mes: number; postos: LinhaPosto[]; cargos: string[]; areas: { codigo: string; nome: string }[]; centros: { codigo: string; nome: string }[] }> {
  exigir(quem, PERM.individual);
  const f = await lerFolha(p);
  const nomeCentro = new Map(f.centros.map((c) => [c.codigo, c.nome]));
  const hoje = new Date();
  const mes = mesEscolhido && mesEscolhido >= 1 && mesEscolhido <= 12 ? mesEscolhido : f.parametros.ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 1;
  const areaCentro = new Map(f.centros.map((c) => [c.codigo, c.area]));
  const postos = f.postos
    .map((x) => {
      const rateio = f.rateio(x.id);
      const mensal = MESES.map((m) => custoDoPosto(f, x, m));
      const valores = f.componentes(x.id, mes) ?? f.componentes(x.id) ?? componentesZerados();
      const calculo = calcularLinha(valores, x.carga_horaria, f.parametros, mes);
      return {
        id: x.id,
        ficha: x.ficha,
        colaborador: x.colaborador,
        cargo: x.cargo,
        departamento: x.departamento,
        cargaHoraria: x.carga_horaria,
        valores,
        calculo,
        inicio: x.inicio,
        desligamento: x.desligamento,
        custoMensal: mensal[mes - 1],
        custoAnual: Math.round(mensal.reduce((s, v) => s + v, 0) * 100) / 100,
        situacaoRateio: situacaoRateio(rateio),
        centros: (rateio ?? []).map((l) => l.centro),
        areas: [...new Set((rateio ?? []).map((l) => areaCentro.get(l.centro)).filter((a): a is string => Boolean(a)))],
      };
    })
    .sort((a, b) => (a.ficha ? 0 : 1) - (b.ficha ? 0 : 1) || (a.colaborador ?? '~').localeCompare(b.colaborador ?? '~', 'pt-BR'));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Postos', detalhes: { lista: true } });
  return {
    ano: f.parametros.ano,
    mes,
    postos,
    cargos: [...new Set(postos.map((x) => x.cargo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    areas: f.areas.map((a) => ({ codigo: a.codigo, nome: a.nome })),
    centros: f.centros.map((c) => ({ codigo: c.codigo, nome: nomeCentro.get(c.codigo) ?? c.codigo })),
  };
}

/** Dados para o formulário: cargos já usados (sugestões), serviços e parâmetros. */
export interface CadastrosDoFormulario {
  ano: number;
  parametros: ValoresParametros;
  /** Cargos que já aparecem na folha, para sugerir ao digitar. */
  cargos: string[];
  /** Serviços para a lotação, com o nome da área. */
  centros: { codigo: string; nome: string; area: string }[];
}

function cadastrosDoFormulario(f: FolhaLida): CadastrosDoFormulario {
  const nomeArea = new Map(f.areas.map((a) => [a.codigo, a.nome]));
  return {
    ano: f.parametros.ano,
    parametros: f.parametros,
    cargos: [...new Set(f.postos.map((x) => x.cargo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    centros: f.centros
      .map((c) => ({ codigo: c.codigo, nome: c.nome, area: c.area ? (nomeArea.get(c.area) ?? c.area) : 'Sem área' }))
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

export interface FichaPosto {
  posto: { id: string; versao: number; ficha: string | null; colaborador: string | null; cargo: string; departamento: string | null; cargaHoraria: number | null; inicio: string; desligamento: string | null; observacao: string | null } | null;
  componentes: ValoresComponentes;
  rateio: LinhaRateio[];
  cadastros: CadastrosDoFormulario;
  podeEditar: boolean;
}

export async function fichaDoPosto(p: Planilhas, quem: Autorizador, id: string | null): Promise<FichaPosto> {
  exigir(quem, id ? PERM.individual : PERM.editar);
  const f = await lerFolha(p);
  const cadastros = cadastrosDoFormulario(f);
  const podeEditar = quem.temPermissao(PERM.editar);
  if (!id) return { posto: null, componentes: componentesZerados(f.parametros.reajuste_padrao), rateio: [], cadastros, podeEditar };

  const x = f.postos.find((y) => y.id === id);
  if (!x) throw new ErroValidacaoFolha('Funcionário não encontrado.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Postos', registroId: id });
  return {
    posto: { id: x.id, versao: x.versao, ficha: x.ficha, colaborador: x.colaborador, cargo: x.cargo, departamento: x.departamento, cargaHoraria: x.carga_horaria, inicio: x.inicio, desligamento: x.desligamento, observacao: x.observacao },
    componentes: f.componentes(id) ?? componentesZerados(),
    rateio: f.rateio(id) ?? [],
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
  departamento: string | null;
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
  if (d.cargo.trim().length < 2) erros.push('Informe o cargo.');
  if (!Number.isFinite(d.componentes.reajuste) || d.componentes.reajuste < 0 || d.componentes.reajuste > 100) erros.push('Reajuste: use um número entre 0 e 100.');
  if (!DATA.test(d.inicio)) erros.push('Informe a data de admissão (ou de início da vaga).');
  if (!DATA.test(d.vigencia)) erros.push('Informe a partir de quando valem os valores.');
  if (d.cargaHoraria !== null && (!Number.isFinite(d.cargaHoraria) || d.cargaHoraria <= 0 || d.cargaHoraria > 300)) erros.push('Carga horária mensal entre 1 e 300 horas.');
  for (const c of COMPONENTES) {
    const v = d.componentes[c.chave];
    if (!Number.isFinite(v) || v < 0) erros.push(`${c.nome}: valor inválido.`);
  }
  if (d.componentes.salario_atual <= 0 && d.componentes.bolsa_estagio <= 0) erros.push('Informe o salário atual (ou a bolsa estágio).');
  erros.push(...validarRateio(d.rateio));
  const desconhecidos = d.rateio.filter((l) => l.centro && !f.centros.some((c) => c.codigo === l.centro));
  if (desconhecidos.length) erros.push('Há serviço na lotação que não existe no cadastro de Serviços.');
  const ficha = d.ficha?.trim() || null;
  if (ficha && f.postos.some((x) => x.ficha === ficha && x.id !== d.id && !x.desligamento)) erros.push(`Já existe um funcionário ativo com o código ${ficha}.`);
  if (erros.length) throw new ErroValidacaoFolha([...new Set(erros)].join(' '));

  const autoria = { email: quem.email };
  const camposPosto = {
    ficha,
    colaborador: d.colaborador?.trim() || null,
    cargo: d.cargo.trim(),
    departamento: d.departamento?.trim() || null,
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
    if (!atual) throw new ErroValidacaoFolha('Funcionário não encontrado.');
    postoId = atual.id;
    const mudou = Object.entries(camposPosto).some(([k, v]) => (atual as unknown as Record<string, unknown>)[k] !== v);
    if (mudou) {
      const r = await atualizar(p, Postos, atual.id, d.versao ?? atual.versao, camposPosto, autoria);
      colunas.push(...r.colunasAlteradas);
    }
  }

  const vigencia = d.id ? d.vigencia : d.inicio <= d.vigencia ? d.inicio : d.vigencia;
  if (!iguais(f.componentes(postoId), d.componentes) || !d.id) {
    await inserir(p, Componentes, { posto_id: postoId, vigencia, ...d.componentes }, autoria);
    colunas.push('componentes');
  }
  if (!iguais(ordenarRateio(f.rateio(postoId) ?? []), ordenarRateio(d.rateio)) || !d.id) {
    const [rateios] = await lerTabelas(p, [Rateios] as const);
    const lote = crypto.randomUUID();
    await inserirRegistros(p, rateios, d.rateio.map((l) => ({ posto_id: postoId, lote, servico: l.centro, percentual: l.percentual, vigencia })), autoria);
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
          rotulo: x.ficha ? `${x.colaborador ?? 'Sem nome'} (${x.ficha})` : `Vaga prevista: ${x.colaborador ?? x.cargo}`,
          cargo: x.cargo,
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
  if (!DATA.test(vigencia)) throw new ErroValidacaoFolha('Informe a partir de quando vale a lotação.');
  const f = await lerFolha(p);
  const erros: string[] = [];
  const nome = new Map(f.postos.map((x) => [x.id, x.colaborador ?? 'Vaga prevista']));
  const mudancas = lista.filter((x) => !iguais(ordenarRateio(f.rateio(x.postoId) ?? []), ordenarRateio(x.rateio)));
  for (const x of mudancas) {
    if (!nome.has(x.postoId)) erros.push('Funcionário não encontrado.');
    const e = validarRateio(x.rateio);
    if (e.length) erros.push(`${nome.get(x.postoId)}: ${e.join(' ')}`);
    if (x.rateio.some((l) => !f.centros.some((c) => c.codigo === l.centro))) erros.push(`${nome.get(x.postoId)}: serviço inexistente.`);
  }
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' · '));
  if (mudancas.length === 0) return 0;

  const [rateios] = await lerTabelas(p, [Rateios] as const);
  const linhas = mudancas.flatMap((x) => {
    const lote = crypto.randomUUID();
    return x.rateio.map((l) => ({ posto_id: x.postoId, lote, servico: l.centro, percentual: l.percentual, vigencia }));
  });
  await inserirRegistros(p, rateios, linhas, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Rateios', detalhes: { postos: mudancas.length, colunas: ['rateio'] } });
  return mudancas.length;
}

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

export async function parametrosDaFolha(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const [lidos] = await lerTabelas(p, [Parametros] as const);
  return {
    parametros: parametrosCom(Object.fromEntries(lidos.ativos().map((x) => [x.chave, x.valor]))),
    podeEditar: quem.temPermissao(PERM.parametros),
  };
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
