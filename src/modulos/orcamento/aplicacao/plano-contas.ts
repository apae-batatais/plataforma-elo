/**
 * Plano de contas estruturado (entrega 1 da proposta #221, ADR-036).
 *
 * Quem pode: ver = quem vê a Previsão (`orcamento.painel.ver`) ou edita (`orcamento.previsao.editar`);
 * alterar Áreas, Itens e o plano = `orcamento.previsao.editar` (Financeiro). Sem dado pessoal.
 * Grupo de Contas é o próprio `GruposGasto` (cadastro em `previsao.ts`).
 * Nada é apagado: cadastros encerrados ficam com `ativo = FALSE`; o plano só recebe lotes novos.
 * O plano orienta, nunca bloqueia (os lançamentos usam o plano só na entrega 2).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { AreasPlano, Exercicios, GruposGasto, ItensContabeis, Parametros, PlanoContas, type RegAreaPlano, type RegItemContabil } from '../dados/tabelas';
import { chaveCodigoConta, ErroCodigoConta, limparCodigoConta } from '../dominio/codigo-conta';
import { parametrosCom } from '../dominio/folha';
import { nomeComparavel } from '../dominio/previsao';
import {
  planosIguais, resumirPlano, validarPlano, versaoDoFimDoAno, versoesDoExercicio, vigenciaDentroDoAno, vigenciaPadrao,
  type LinhaGravada, type LinhaPlano, type ResumoPlano, type VersaoPlano,
} from '../dominio/plano-contas';
import { ErroPrevisao } from './previsao';

const PERM = { ver: 'orcamento.painel.ver', editar: 'orcamento.previsao.editar' } as const;

function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
}
function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERM.ver) && !quem.temPermissao(PERM.editar)) throw new ErroPermissao();
}

const limparNome = (t: string) => t.trim().replace(/\s+/g, ' ');
const hojeBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
const porNome = <T extends { nome: string }>(l: T[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

function codigoLimpo(bruto: string | null | undefined): string | null {
  try {
    return limparCodigoConta(bruto);
  } catch (e) {
    if (e instanceof ErroCodigoConta) throw new ErroPrevisao(e.message);
    throw e;
  }
}

type Cadastro = { id: string; nome: string; ativo: boolean; codigo: string | null; grupo_id?: string };

/** Confere nome e código dentro do "cadastro" (Áreas; ou Itens do mesmo grupo). */
function conferirCadastro(lista: Cadastro[], dados: { nome: string; codigo: string | null }, oQue: string, ignorarId?: string) {
  if (!dados.nome) throw new ErroPrevisao(`Informe o nome ${oQue}.`);
  const igual = lista.find((x) => x.id !== ignorarId && nomeComparavel(x.nome) === nomeComparavel(dados.nome));
  if (igual) {
    throw new ErroPrevisao(igual.ativo ? `Já existe "${igual.nome}". O nome não pode se repetir.` : `Já existe "${igual.nome}" entre os excluídos. Reative em vez de cadastrar de novo.`);
  }
  if (dados.codigo) {
    const dono = lista.find((x) => x.ativo && x.id !== ignorarId && chaveCodigoConta(x.codigo) === chaveCodigoConta(dados.codigo));
    if (dono) throw new ErroPrevisao(`O código ${dados.codigo} já é "${dono.nome}". Altere o código de um dos dois.`);
  }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface CadastrosDoPlano {
  areas: { ativos: RegAreaPlano[]; excluidos: RegAreaPlano[]; uso: Record<string, number> };
  itens: { ativos: RegItemContabil[]; excluidos: RegItemContabil[]; uso: Record<string, number> };
  grupos: { id: string; nome: string; codigo_conta: string | null; ativo: boolean }[];
}

/** Quantas versões de plano usam cada área e cada item. */
async function usoNosPlanos(p: Planilhas) {
  const [plano] = await lerTabelas(p, [PlanoContas] as const);
  const areas = new Map<string, Set<string>>();
  const itens = new Map<string, Set<string>>();
  for (const l of plano.ativos()) {
    (areas.get(l.area_id) ?? areas.set(l.area_id, new Set()).get(l.area_id)!).add(l.lote);
    if (l.item_id) (itens.get(l.item_id) ?? itens.set(l.item_id, new Set()).get(l.item_id)!).add(l.lote);
  }
  const conta = (m: Map<string, Set<string>>) => Object.fromEntries([...m].map(([k, v]) => [k, v.size]));
  return { areas: conta(areas), itens: conta(itens) };
}

export async function listarCadastrosDoPlano(p: Planilhas, quem: Autorizador): Promise<CadastrosDoPlano> {
  exigirVer(quem);
  const [areas, itens, grupos] = await lerTabelas(p, [AreasPlano, ItensContabeis, GruposGasto] as const);
  const uso = await usoNosPlanos(p);
  return {
    areas: { ativos: porNome(areas.ativos()), excluidos: porNome(areas.todos().filter((a) => !a.ativo)), uso: uso.areas },
    itens: { ativos: porNome(itens.ativos()), excluidos: porNome(itens.todos().filter((i) => !i.ativo)), uso: uso.itens },
    grupos: porNome(grupos.todos().map((g) => ({ id: g.id, nome: g.nome, codigo_conta: g.codigo_conta, ativo: g.ativo }))),
  };
}

export interface PlanoLido {
  ano: number;
  anos: number[];
  /** Situação do exercício (`null` = exercício ainda não aberto). */
  situacao: 'elaboracao' | 'aprovado' | 'encerrado' | null;
  /** Versão mais recente do exercício (a que vale no fim do ano). */
  atual: VersaoPlano | null;
  /** `true` se a vigência da versão atual já começou. */
  atualJaVale: boolean;
  resumo: ResumoPlano;
  /** Versões, da mais nova para a mais antiga (só leitura). */
  versoes: (VersaoPlano & { criadoEm: string | null; resumo: ResumoPlano })[];
  /** Plano que valia no fim do exercício anterior (para "Começar do plano de…"). */
  anterior: { ano: number; linhas: LinhaPlano[] } | null;
  vigenciaPadrao: string;
  cadastros: CadastrosDoPlano;
}

async function lerGravadas(p: Planilhas) {
  const [plano] = await lerTabelas(p, [PlanoContas] as const);
  const registros = plano.ativos();
  const gravadas: LinhaGravada[] = registros.map((r) => ({ exercicio: r.exercicio, lote: r.lote, vigencia: r.vigencia, area_id: r.area_id, grupo_id: r.grupo_id, item_id: r.item_id }));
  return { registros, gravadas };
}

export async function lerPlano(p: Planilhas, quem: Autorizador, anoEscolhido?: number, agora: Date = new Date()): Promise<PlanoLido> {
  exigirVer(quem);
  const [exercicios, parametros] = await lerTabelas(p, [Exercicios, Parametros] as const);
  const { registros, gravadas } = await lerGravadas(p);
  const anoPadrao = parametrosCom(Object.fromEntries(parametros.ativos().map((x) => [x.chave, x.valor]))).ano;
  const anos = [...new Set([anoPadrao, ...exercicios.ativos().map((e) => e.ano), ...gravadas.map((g) => g.exercicio)])].sort((a, b) => a - b);
  const ano = anoEscolhido && Number.isInteger(anoEscolhido) ? anoEscolhido : anoPadrao;
  const situacao = exercicios.ativos().find((e) => e.ano === ano)?.situacao ?? null;
  const versoes = versoesDoExercicio(gravadas, ano);
  const atual = versoes.at(-1) ?? null;
  const criado = new Map(registros.map((r) => [r.lote, r.criado_em]));
  const anterior = versaoDoFimDoAno(gravadas, ano - 1);
  return {
    ano,
    anos: anos.includes(ano) ? anos : [...anos, ano].sort((a, b) => a - b),
    situacao,
    atual,
    atualJaVale: atual ? atual.vigencia <= hojeBrasilia(agora) : false,
    resumo: resumirPlano(atual?.linhas ?? []),
    versoes: [...versoes].reverse().map((v) => ({ ...v, criadoEm: criado.get(v.lote) ?? null, resumo: resumirPlano(v.linhas) })),
    anterior: anterior ? { ano: ano - 1, linhas: anterior.linhas } : null,
    vigenciaPadrao: vigenciaPadrao(ano, hojeBrasilia(agora)),
    cadastros: await listarCadastrosDoPlano(p, quem),
  };
}

// ---------------------------------------------------------------------------
// Áreas do plano
// ---------------------------------------------------------------------------

export async function salvarAreaPlano(p: Planilhas, quem: Autorizador, dados: { id?: string; versao?: number; nome: string; codigo?: string | null }): Promise<void> {
  exigirEditar(quem);
  const nome = limparNome(dados.nome);
  const [areas] = await lerTabelas(p, [AreasPlano] as const);
  const lista = areas.todos().map((a) => ({ id: a.id, nome: a.nome, ativo: a.ativo, codigo: a.codigo }));
  const alvo = dados.id ? areas.porId(dados.id) : undefined;
  if (dados.id && (!alvo || !alvo.ativo)) throw new ErroPrevisao('Área não encontrada.');
  const codigo = dados.codigo === undefined && alvo ? alvo.codigo : codigoLimpo(dados.codigo);
  conferirCadastro(lista, { nome, codigo }, 'da área', dados.id);
  if (!alvo) {
    const a = await inserir(p, AreasPlano, { nome, codigo }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'AreasPlano', registroId: a.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, AreasPlano, alvo.id, dados.versao ?? alvo.versao, { nome, codigo }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'AreasPlano', registroId: alvo.id, detalhes: { colunas: colunasAlteradas } });
}

async function alternarAreaPlano(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean): Promise<void> {
  exigirEditar(quem);
  const [areas] = await lerTabelas(p, [AreasPlano] as const);
  const alvo = areas.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroPrevisao('Área não encontrada.');
  if (ativo) {
    const lista = areas.todos().map((a) => ({ id: a.id, nome: a.nome, ativo: a.ativo, codigo: a.codigo }));
    if (areas.ativos().some((x) => nomeComparavel(x.nome) === nomeComparavel(alvo.nome))) throw new ErroPrevisao(`Já existe "${alvo.nome}" ativa.`);
    const dono = lista.find((x) => x.ativo && alvo.codigo && chaveCodigoConta(x.codigo) === chaveCodigoConta(alvo.codigo));
    if (dono) throw new ErroPrevisao(`Não dá para reativar "${alvo.nome}": o código ${alvo.codigo} agora é "${dono.nome}". Altere o código dessa área antes de reativar.`);
  }
  await atualizar(p, AreasPlano, id, versao, { ativo } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'AreasPlano', registroId: id, detalhes: { colunas: ['ativo'] } });
}
export const excluirAreaPlano = (p: Planilhas, q: Autorizador, id: string, v: number) => alternarAreaPlano(p, q, id, v, false);
export const reativarAreaPlano = (p: Planilhas, q: Autorizador, id: string, v: number) => alternarAreaPlano(p, q, id, v, true);

// ---------------------------------------------------------------------------
// Itens contábeis
// ---------------------------------------------------------------------------

export async function salvarItemContabil(p: Planilhas, quem: Autorizador, dados: { id?: string; versao?: number; grupo_id: string; nome: string; codigo?: string | null }): Promise<void> {
  exigirEditar(quem);
  const nome = limparNome(dados.nome);
  const [itens, grupos] = await lerTabelas(p, [ItensContabeis, GruposGasto] as const);
  const alvo = dados.id ? itens.porId(dados.id) : undefined;
  if (dados.id && (!alvo || !alvo.ativo)) throw new ErroPrevisao('Item não encontrado.');
  const grupoId = alvo ? alvo.grupo_id : dados.grupo_id;
  if (alvo && dados.grupo_id && dados.grupo_id !== alvo.grupo_id) throw new ErroPrevisao('Um item pertence a um só grupo: não dá para trocar o grupo. Crie o item no outro grupo.');
  if (!grupos.ativos().some((g) => g.id === grupoId)) throw new ErroPrevisao('Grupo de contas não encontrado.');
  const codigo = dados.codigo === undefined && alvo ? alvo.codigo : codigoLimpo(dados.codigo);
  const doGrupo = itens.todos().filter((i) => i.grupo_id === grupoId).map((i) => ({ id: i.id, nome: i.nome, ativo: i.ativo, codigo: i.codigo }));
  conferirCadastro(doGrupo, { nome, codigo }, 'do item', dados.id);
  if (!alvo) {
    const i = await inserir(p, ItensContabeis, { grupo_id: grupoId, nome, codigo }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'ItensContabeis', registroId: i.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, ItensContabeis, alvo.id, dados.versao ?? alvo.versao, { nome, codigo }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ItensContabeis', registroId: alvo.id, detalhes: { colunas: colunasAlteradas } });
}

async function alternarItem(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean): Promise<void> {
  exigirEditar(quem);
  const [itens, grupos] = await lerTabelas(p, [ItensContabeis, GruposGasto] as const);
  const alvo = itens.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroPrevisao('Item não encontrado.');
  if (ativo) {
    if (!grupos.ativos().some((g) => g.id === alvo.grupo_id)) throw new ErroPrevisao('Não dá para reativar o item: o grupo dele está excluído. Reative o grupo antes.');
    const doGrupo = itens.ativos().filter((i) => i.grupo_id === alvo.grupo_id);
    if (doGrupo.some((x) => nomeComparavel(x.nome) === nomeComparavel(alvo.nome))) throw new ErroPrevisao(`Já existe "${alvo.nome}" ativo neste grupo.`);
    const dono = doGrupo.find((x) => alvo.codigo && chaveCodigoConta(x.codigo) === chaveCodigoConta(alvo.codigo));
    if (dono) throw new ErroPrevisao(`Não dá para reativar "${alvo.nome}": o código ${alvo.codigo} agora é "${dono.nome}". Altere o código desse item antes de reativar.`);
  }
  await atualizar(p, ItensContabeis, id, versao, { ativo } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'ItensContabeis', registroId: id, detalhes: { colunas: ['ativo'] } });
}
export const excluirItemContabil = (p: Planilhas, q: Autorizador, id: string, v: number) => alternarItem(p, q, id, v, false);
export const reativarItemContabil = (p: Planilhas, q: Autorizador, id: string, v: number) => alternarItem(p, q, id, v, true);

// ---------------------------------------------------------------------------
// Gravar o plano
// ---------------------------------------------------------------------------

export interface DadosPlano {
  ano: number;
  vigencia: string;
  linhas: LinhaPlano[];
  /** Lote que a pessoa estava vendo (`null` = ainda não havia plano). Serve para não sobrescrever o trabalho de outra pessoa. */
  loteLido: string | null;
}

/** Grava um lote novo com o plano completo do exercício (tudo ou nada). Nunca altera nem apaga lotes anteriores. */
export async function salvarPlano(p: Planilhas, quem: Autorizador, dados: DadosPlano): Promise<{ lote: string }> {
  exigirEditar(quem);
  if (!Number.isInteger(dados.ano) || dados.ano < 2020 || dados.ano > 2100) throw new ErroPrevisao('Ano inválido.');
  const [exercicios, areas, grupos, itens] = await lerTabelas(p, [Exercicios, AreasPlano, GruposGasto, ItensContabeis] as const);
  if (exercicios.ativos().find((e) => e.ano === dados.ano)?.situacao === 'encerrado') {
    throw new ErroPrevisao('O exercício está encerrado; o plano não pode mudar.');
  }
  if (!vigenciaDentroDoAno(dados.ano, dados.vigencia)) throw new ErroPrevisao(`A data de início precisa estar dentro do ano de ${dados.ano}.`);
  const { gravadas } = await lerGravadas(p);
  const versoes = versoesDoExercicio(gravadas, dados.ano);
  const ultima = versoes.at(-1) ?? null;
  if ((ultima?.lote ?? null) !== dados.loteLido) {
    throw new ErroPrevisao('O plano deste exercício foi alterado por outra pessoa enquanto você editava. Abra o plano de novo e refaça a alteração.');
  }
  const erros = validarPlano(dados.linhas, {
    areasAtivas: new Set(areas.ativos().map((a) => a.id)),
    gruposAtivos: new Set(grupos.ativos().map((g) => g.id)),
    itensAtivos: new Set(itens.ativos().map((i) => i.id)),
    grupoDoItem: new Map(itens.todos().map((i) => [i.id, i.grupo_id])),
  });
  if (erros.length) throw new ErroPrevisao(erros.join(' '));
  if (ultima && ultima.vigencia === dados.vigencia && planosIguais(ultima.linhas, dados.linhas)) {
    throw new ErroPrevisao('Nada mudou em relação ao plano atual.');
  }
  const lote = crypto.randomUUID();
  const [plano] = await lerTabelas(p, [PlanoContas] as const);
  await inserirRegistros(
    p,
    plano,
    dados.linhas.map((l) => ({ exercicio: dados.ano, lote, vigencia: dados.vigencia, area_id: l.area_id, grupo_id: l.grupo_id, item_id: l.item_id })),
    { email: quem.email },
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'PlanoContas', registroId: lote, detalhes: { exercicio: dados.ano, linhas: dados.linhas.length } });
  return { lote };
}
