/**
 * Regras de rateio dos custos comuns e bases próprias (R1, proposta #91).
 *
 * - orcamento.painel.ver: ver as regras, as bases e o resultado.
 * - orcamento.parametros.editar (Financeiro): criar, alterar, excluir e reativar regras e bases.
 * Nada é apagado: excluir encerra (ativo = FALSE) e só vale sem uso ativo.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import {
  BasesRateio, BasesRateioValores, CentrosCusto, Despesas, GruposGasto, RegrasRateio, RegrasRateioParticipantes,
  type RegBaseRateio, type RegRegraRateio,
} from '../dados/tabelas';
import { nomeComparavel } from '../dominio/previsao';
import {
  BASES_FIXAS, conferirRegra, ErroRegra, pesosDoGrupo, ratearPelaRegra,
  type BaseRegra, type CentroRateio, type RegraRateio, type TipoParticipante,
} from '../dominio/rateio-custos';
import { ErroValidacaoFolha, profissionaisPorServico } from './folha';

const PERM_EDITAR = 'orcamento.parametros.editar';

export const ErroRateio = ErroValidacaoFolha;

function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.painel.ver') && !quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}
function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}
const limpar = (t: string) => t.trim().replace(/\s+/g, ' ');

function paraErro<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    if (e instanceof ErroRegra) throw new ErroRateio(e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface RegraLida extends RegraRateio {
  versao: number;
  ativo: boolean;
  /** Nomes de quem participa. */
  participantesNomes: string[];
  /** Grupos, itens e serviços que usam a regra. */
  uso: { grupos: number; itens: number; servicos: number };
}

export interface BaseLida {
  id: string;
  versao: number;
  nome: string;
  ativo: boolean;
  uso: number;
}

export interface CadastroRateio {
  regras: { ativas: RegraLida[]; excluidas: RegraLida[] };
  bases: { ativas: BaseLida[]; excluidas: BaseLida[] };
  opcoes: { areas: { codigo: string; nome: string }[]; servicos: { codigo: string; nome: string; areaNome: string; tipo: 'direto' | 'indireto' | 'despesa' }[] };
}

const ordemNome = <T extends { nome: string }>(l: T[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export const nomeDaBase = (base: string, bases: { id: string; nome: string }[]) =>
  base.startsWith('propria:') ? (bases.find((b) => b.id === base.slice(8))?.nome ?? 'Base própria') : BASES_FIXAS[base as keyof typeof BASES_FIXAS];

/** Regras ativas no formato do cálculo (sem checar permissão: uso interno do painel). */
export async function regrasParaCalculo(p: Planilhas): Promise<{ regras: RegraRateio[]; basesDoAno: (ano: number) => Map<string, Map<string, number>> }> {
  const [regrasT, partT, valoresT, basesT] = await lerTabelas(p, [RegrasRateio, RegrasRateioParticipantes, BasesRateioValores, BasesRateio] as const);
  const regras: RegraRateio[] = regrasT.ativos().map((r) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    base1: r.base1 as BaseRegra,
    base2: (r.base2 as BaseRegra | null) ?? null,
    participantes: partT.ativos().filter((x) => x.regra_id === r.id).map((x) => x.participante),
  }));
  const ativas = new Set(basesT.ativos().map((b) => b.id));
  const basesDoAno = (ano: number) => {
    const m = new Map<string, Map<string, number>>();
    for (const v of valoresT.ativos().filter((x) => x.ano === ano && ativas.has(x.base_id))) {
      const mm = m.get(v.base_id) ?? new Map<string, number>();
      mm.set(v.servico, v.valor);
      m.set(v.base_id, mm);
    }
    return m;
  };
  return { regras, basesDoAno };
}

export async function listarRegras(p: Planilhas, quem: Autorizador): Promise<CadastroRateio> {
  exigirVer(quem);
  const [regrasT, partT, basesT, valoresT, grupos, despesas, centros, servicos, areas] = await lerTabelas(p, [
    RegrasRateio, RegrasRateioParticipantes, BasesRateio, BasesRateioValores, GruposGasto, Despesas, CentrosCusto, Servicos, Areas,
  ] as const);
  const nomeArea = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  const nomeServ = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));
  const usoRegra = (id: string) => ({
    grupos: grupos.ativos().filter((g) => g.regra_rateio_id === id).length,
    itens: despesas.ativos().filter((d) => d.regra_rateio_id === id).length,
    servicos: centros.ativos().filter((c) => c.regra_rateio_id === id).length,
  });
  const lida = (r: RegRegraRateio): RegraLida => {
    const parts = partT.ativos().filter((x) => x.regra_id === r.id).map((x) => x.participante);
    return {
      id: r.id, versao: r.versao, ativo: r.ativo, nome: r.nome, tipo: r.tipo,
      base1: r.base1 as BaseRegra, base2: (r.base2 as BaseRegra | null) ?? null,
      participantes: parts,
      participantesNomes: parts.map((c) => (r.tipo === 'area' ? nomeArea.get(c) : nomeServ.get(c)) ?? c),
      uso: usoRegra(r.id),
    };
  };
  const baseLida = (b: RegBaseRateio): BaseLida => ({
    id: b.id, versao: b.versao, nome: b.nome, ativo: b.ativo,
    uso: regrasT.ativos().filter((r) => r.base1 === `propria:${b.id}` || r.base2 === `propria:${b.id}`).length,
  });
  void valoresT;
  const tipoDe = new Map(centros.ativos().map((c) => [c.servico, c.tipo]));
  return {
    regras: {
      ativas: ordemNome(regrasT.ativos().map(lida)),
      excluidas: ordemNome(regrasT.todos().filter((r) => !r.ativo).map(lida)),
    },
    bases: {
      ativas: ordemNome(basesT.ativos().map(baseLida)),
      excluidas: ordemNome(basesT.todos().filter((b) => !b.ativo).map(baseLida)),
    },
    opcoes: {
      areas: servicos.ativos().flatMap((s) => (s.area ? [s.area] : [])).filter((a, i, l) => l.indexOf(a) === i).map((codigo) => ({ codigo, nome: nomeArea.get(codigo) ?? codigo })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      servicos: servicos.ativos()
        .map((s) => ({ codigo: s.codigo, nome: s.nome, areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área', tipo: tipoDe.get(s.codigo) ?? ('direto' as const) }))
        .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
    },
  };
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

export interface DadosRegra {
  id?: string;
  versao?: number;
  nome: string;
  tipo: TipoParticipante;
  base1: BaseRegra;
  base2: BaseRegra | null;
  participantes: string[];
}

async function conferirBase(p: Planilhas, base: string | null, rotulo: string) {
  if (base === null) return;
  if (base in BASES_FIXAS) return;
  if (base.startsWith('propria:')) {
    const [bases] = await lerTabelas(p, [BasesRateio] as const);
    if (bases.ativos().some((b) => b.id === base.slice(8))) return;
  }
  throw new ErroRateio(`${rotulo}: escolha uma base da lista.`);
}

/** Grava a regra e os participantes. `usoApoio` vem dos serviços que a usam. */
export async function salvarRegra(p: Planilhas, quem: Autorizador, dados: DadosRegra): Promise<string> {
  exigirEditar(quem);
  const nome = limpar(dados.nome);
  if (!nome) throw new ErroRateio('Informe o nome da regra.');
  if (!['area', 'servico'].includes(dados.tipo)) throw new ErroRateio('Escolha se os participantes são áreas ou serviços.');
  await conferirBase(p, dados.base1, 'Base do primeiro nível');
  await conferirBase(p, dados.base2, 'Base do segundo nível');
  if (dados.tipo === 'servico' && dados.base2) throw new ErroRateio('O segundo nível só existe quando os participantes são áreas.');
  const [regrasT, partT, centrosT, servicosT, grupos, despesas] = await lerTabelas(p, [
    RegrasRateio, RegrasRateioParticipantes, CentrosCusto, Servicos, GruposGasto, Despesas,
  ] as const);
  const outro = regrasT.todos().find((r) => r.id !== dados.id && nomeComparavel(r.nome) === nomeComparavel(nome));
  if (outro) {
    throw new ErroRateio(outro.ativo ? `Já existe a regra "${outro.nome}". O nome não pode se repetir.` : `Já existe "${outro.nome}" entre as excluídas. Reative em vez de cadastrar de novo.`);
  }
  const tipoDe = new Map(centrosT.ativos().map((c) => [c.servico, c.tipo]));
  const centros = servicosT.ativos().map((s) => ({ codigo: s.codigo, area: s.area ?? null, tipo: (tipoDe.get(s.codigo) ?? 'direto') as 'direto' | 'indireto' | 'despesa' }));
  const usadaPor = dados.id ? centrosT.ativos().filter((c) => c.regra_rateio_id === dados.id) : [];
  const usoApoio = usadaPor.some((c) => c.tipo === 'indireto');
  const usoAdm = usadaPor.some((c) => c.tipo === 'despesa');
  paraErro(() => conferirRegra({ tipo: dados.tipo, participantes: dados.participantes }, centros, { apoio: usoApoio, administrativo: usoAdm }));
  void grupos; void despesas;

  const campos = { nome, tipo: dados.tipo, base1: dados.base1, base2: dados.base2 };
  let id = dados.id;
  const antes = id ? partT.ativos().filter((x) => x.regra_id === id) : [];
  const colunas: string[] = [];
  if (!id) {
    const r = await inserir(p, RegrasRateio, campos, { email: quem.email });
    id = r.id;
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'RegrasRateio', registroId: id });
  } else {
    const alvo = regrasT.porId(id);
    if (!alvo || !alvo.ativo) throw new ErroRateio('Regra não encontrada.');
    const { colunasAlteradas } = await atualizar(p, RegrasRateio, id, dados.versao ?? alvo.versao, campos, { email: quem.email });
    colunas.push(...colunasAlteradas);
  }
  const iguais = antes.length === dados.participantes.length && antes.every((x) => dados.participantes.includes(x.participante));
  if (!iguais) {
    if (antes.length) await atualizarVarios(p, RegrasRateioParticipantes, antes.map((x) => ({ id: x.id, versao: x.versao, mudancas: { ativo: false } })), { email: quem.email });
    await inserirRegistros(p, partT, dados.participantes.map((participante) => ({ regra_id: id!, participante })), { email: quem.email });
    if (dados.id) colunas.push('participantes');
  }
  if (dados.id && colunas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'RegrasRateio', registroId: id, detalhes: { colunas } });
  }
  if (dados.id && colunas.length) {
  // Recalcula as despesas geradas por rateio (ADR-038); import tardio por causa do ciclo entre os arquivos.
  await (await import('./lancamentos-rateio')).recalcularLancamentosAfetados(p, quem, { regraId: id });
  }
  return id;
}

export async function encerrarRegra(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean): Promise<void> {
  exigirEditar(quem);
  const [regrasT, grupos, despesas, centros] = await lerTabelas(p, [RegrasRateio, GruposGasto, Despesas, CentrosCusto] as const);
  const alvo = regrasT.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroRateio('Regra não encontrada.');
  if (!ativo) {
    const g = grupos.ativos().filter((x) => x.regra_rateio_id === id).length;
    const i = despesas.ativos().filter((x) => x.regra_rateio_id === id).length;
    const s = centros.ativos().filter((x) => x.regra_rateio_id === id).length;
    if (g + i + s > 0) {
      const partes = [g && `${g} ${g === 1 ? 'grupo' : 'grupos'}`, i && `${i} ${i === 1 ? 'item' : 'itens'}`, s && `${s} ${s === 1 ? 'serviço' : 'serviços'}`].filter(Boolean).join(', ');
      throw new ErroRateio(`Não dá para excluir "${alvo.nome}": ${partes} usam esta regra. Troque a regra antes.`);
    }
  } else if (regrasT.ativos().some((r) => nomeComparavel(r.nome) === nomeComparavel(alvo.nome))) {
    throw new ErroRateio(`Já existe "${alvo.nome}" ativa.`);
  }
  await atualizar(p, RegrasRateio, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'RegrasRateio', registroId: id, detalhes: { colunas: ['ativo'] } });
}

// ---------------------------------------------------------------------------
// Bases próprias
// ---------------------------------------------------------------------------

export async function salvarBase(p: Planilhas, quem: Autorizador, dados: { id?: string; versao?: number; nome: string }): Promise<string> {
  exigirEditar(quem);
  const nome = limpar(dados.nome);
  if (!nome) throw new ErroRateio('Informe o nome da base.');
  const [bases] = await lerTabelas(p, [BasesRateio] as const);
  const outra = bases.todos().find((b) => b.id !== dados.id && nomeComparavel(b.nome) === nomeComparavel(nome));
  if (outra) throw new ErroRateio(outra.ativo ? `Já existe a base "${outra.nome}". O nome não pode se repetir.` : `Já existe "${outra.nome}" entre as excluídas. Reative em vez de cadastrar de novo.`);
  if (!dados.id) {
    const b = await inserir(p, BasesRateio, { nome }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'BasesRateio', registroId: b.id });
    return b.id;
  }
  const alvo = bases.porId(dados.id);
  if (!alvo || !alvo.ativo) throw new ErroRateio('Base não encontrada.');
  const { colunasAlteradas } = await atualizar(p, BasesRateio, dados.id, dados.versao ?? alvo.versao, { nome }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'BasesRateio', registroId: dados.id, detalhes: { colunas: colunasAlteradas } });
  return dados.id;
}

export async function encerrarBase(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean): Promise<void> {
  exigirEditar(quem);
  const [bases, regras] = await lerTabelas(p, [BasesRateio, RegrasRateio] as const);
  const alvo = bases.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroRateio('Base não encontrada.');
  if (!ativo) {
    const uso = regras.ativos().filter((r) => r.base1 === `propria:${id}` || r.base2 === `propria:${id}`).length;
    if (uso > 0) throw new ErroRateio(`Não dá para excluir "${alvo.nome}": ${uso} ${uso === 1 ? 'regra usa' : 'regras usam'} esta base. Troque a base antes.`);
  } else if (bases.ativos().some((b) => nomeComparavel(b.nome) === nomeComparavel(alvo.nome))) {
    throw new ErroRateio(`Já existe "${alvo.nome}" ativa.`);
  }
  await atualizar(p, BasesRateio, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'BasesRateio', registroId: id, detalhes: { colunas: ['ativo'] } });
}

export async function valoresDaBase(p: Planilhas, quem: Autorizador, baseId: string, ano: number): Promise<{ servico: string; nome: string; valor: number | null }[]> {
  exigirVer(quem);
  const [valores, servicos] = await lerTabelas(p, [BasesRateioValores, Servicos] as const);
  const v = new Map(valores.ativos().filter((x) => x.base_id === baseId && x.ano === ano).map((x) => [x.servico, x.valor]));
  return servicos.ativos().map((s) => ({ servico: s.codigo, nome: s.nome, valor: v.get(s.codigo) ?? null })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Grava os valores da base por serviço (só os que mudaram; vazio zera). */
export async function salvarValoresDaBase(p: Planilhas, quem: Autorizador, baseId: string, ano: number, lista: { servico: string; valor: number | null }[]): Promise<void> {
  exigirEditar(quem);
  const [bases, valoresT, servicos] = await lerTabelas(p, [BasesRateio, BasesRateioValores, Servicos] as const);
  if (!bases.ativos().some((b) => b.id === baseId)) throw new ErroRateio('Base não encontrada.');
  const validos = new Set(servicos.ativos().map((s) => s.codigo));
  for (const l of lista) {
    if (!validos.has(l.servico)) throw new ErroRateio('Serviço não encontrado.');
    if (l.valor !== null && (!Number.isFinite(l.valor) || l.valor < 0)) throw new ErroRateio('Informe números positivos ou deixe em branco.');
  }
  const atuais = new Map(valoresT.ativos().filter((x) => x.base_id === baseId && x.ano === ano).map((x) => [x.servico, x]));
  const mudar = lista.filter((l) => (atuais.get(l.servico)?.valor ?? null) !== l.valor);
  const alterar = mudar.filter((l) => atuais.has(l.servico) && l.valor === null).map((l) => ({ id: atuais.get(l.servico)!.id, versao: atuais.get(l.servico)!.versao, mudancas: { ativo: false } }));
  const trocar = mudar.filter((l) => atuais.has(l.servico) && l.valor !== null).map((l) => ({ id: atuais.get(l.servico)!.id, versao: atuais.get(l.servico)!.versao, mudancas: { valor: l.valor! } }));
  const novos = mudar.filter((l) => !atuais.has(l.servico) && l.valor !== null).map((l) => ({ base_id: baseId, servico: l.servico, ano, valor: l.valor! }));
  await atualizarVarios(p, BasesRateioValores, [...alterar, ...trocar], { email: quem.email });
  await inserirRegistros(p, valoresT, novos, { email: quem.email });
  if (mudar.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'BasesRateioValores', registroId: baseId, detalhes: { colunas: ['valor'] } });
  if (mudar.length) {
  // Recalcula as despesas geradas por rateio (ADR-038); import tardio por causa do ciclo entre os arquivos.
  await (await import('./lancamentos-rateio')).recalcularLancamentosAfetados(p, quem, { baseId });
  }
}

// ---------------------------------------------------------------------------
// Prévia ("como ficaria")
// ---------------------------------------------------------------------------

export interface PreviaRateio {
  exemplo: number;
  linhas: { codigo: string; nome: string; valor: number; percentual: number }[];
  baseUsada: string;
}

/** Divide R$ `exemplo` pela regra (como ela está no formulário) com os números atuais dos serviços. */
export async function previaDaRegra(p: Planilhas, quem: Autorizador, dados: DadosRegra, ano: number, exemplo = 10000): Promise<PreviaRateio> {
  exigirVer(quem);
  const [servicos, centrosT, valoresT, basesT] = await lerTabelas(p, [Servicos, CentrosCusto, BasesRateioValores, BasesRateio] as const);
  const prof = quem.temPermissao('orcamento.folha.ver') ? await profissionaisPorServico(p) : new Map<string, number>();
  const porServ = new Map(centrosT.ativos().map((c) => [c.servico, c]));
  const centros: CentroRateio[] = servicos.ativos().map((s) => {
    const c = porServ.get(s.codigo);
    return { codigo: s.codigo, area: s.area ?? null, tipo: c?.tipo ?? 'direto', atendidos: c?.atendidos ?? s.vagas ?? null, vagas: c?.vagas ?? s.vagas ?? null, m2: c?.area_m2 ?? null, profissionais: prof.get(s.codigo) ?? 0, regraId: c?.regra_rateio_id ?? null };
  });
  const ativas = new Set(basesT.ativos().map((b) => b.id));
  const basesProprias = new Map<string, Map<string, number>>();
  for (const v of valoresT.ativos().filter((x) => x.ano === ano && ativas.has(x.base_id))) {
    const m = basesProprias.get(v.base_id) ?? new Map<string, number>();
    m.set(v.servico, v.valor);
    basesProprias.set(v.base_id, m);
  }
  const regra: RegraRateio = { id: dados.id ?? 'previa', nome: dados.nome, tipo: dados.tipo, base1: dados.base1, base2: dados.base2, participantes: dados.participantes };
  paraErro(() => conferirRegra(regra, centros));
  const ctx = { centros, custoDireto: new Map<string, number>(), basesProprias };
  const partes = ratearPelaRegra(exemplo, regra, ctx, () => true);
  const nome = new Map(servicos.ativos().map((s) => [s.codigo, s.nome]));
  const alvos = centros.filter((c) => partes.has(c.codigo));
  const { usada } = pesosDoGrupo(dados.base1, alvos, ctx);
  return {
    exemplo,
    baseUsada: nomeDaBase(usada, basesT.ativos()),
    linhas: [...partes].map(([codigo, valor]) => ({ codigo, nome: nome.get(codigo) ?? codigo, valor, percentual: valor / exemplo })).sort((a, b) => b.valor - a.valor),
  };
}
