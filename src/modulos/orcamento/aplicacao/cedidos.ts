/**
 * Casos de uso dos profissionais cedidos (C1 da #125).
 *
 * Quem vê o quê:
 * - Quem cede (cadastro): `orcamento.folha.ver_individual` (global) vê; `orcamento.folha.editar` altera.
 * - Cedido por pessoa (nome, valor): `orcamento.folha.ver_individual`. Abrir a lista ou a ficha registra auditoria de leitura.
 * - Aviso de fim de cessão: quem vê todos os serviços com nome (Diretoria, Financeiro, Departamento Pessoal) recebe tudo;
 *   a coordenação recebe só os serviços do seu escopo, sem o nome da pessoa.
 * - Prazo do aviso: parâmetro `cessao_aviso_dias` (alterado em `salvarParametros`, `orcamento.parametros.editar`).
 *
 * Nada aqui mexe na folha, no caixa nem no passivo.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import {
  ativoNoMes, avisoDeFim, hojeEmBrasilia, ordenarAvisos, pendencias, ROTULO_TIPO_CEDENTE, situacaoDaCessao,
  validarCedente, validarCedido, validarLotacao, validarValor,
  type ItemDeAviso, type SituacaoCessao, type TipoCedente, type TipoValor,
} from '../dominio/cedidos';
import { parametrosCom, vigenteNoMes, type LinhaRateio } from '../dominio/folha';
import { Cedentes, Cedidos, LotacaoCedidos, Parametros, ValoresCedidos, type RegCedido } from '../dados/tabelas';

export class ErroValidacaoCedidos extends Error {}

const PERM = {
  ver: 'orcamento.folha.ver',
  individual: 'orcamento.folha.ver_individual',
  editar: 'orcamento.folha.editar',
} as const;

const exigir = (quem: Autorizador, permissao: string) => {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Mês de início de uma data: "2027-03-15" → "2027-03-01". */
const inicioDoMes = (d: string) => `${d.slice(0, 7)}-01`;

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

async function ler(p: Planilhas) {
  const [cedentes, cedidos, valores, lotacoes, servicos, parametros, areas] = await lerTabelas(p, [
    Cedentes, Cedidos, ValoresCedidos, LotacaoCedidos, Servicos, Parametros, Areas,
  ] as const);
  const avisoDias = parametrosCom(Object.fromEntries(parametros.ativos().map((x) => [x.chave, x.valor]))).cessao_aviso_dias;

  const valorDe = (id: string, ate = '9999-12-31') => {
    const lista = valores.ativos().filter((v) => v.cedido_id === id && v.vigencia <= ate);
    return lista.sort((a, b) => (a.vigencia === b.vigencia ? a.criado_em.localeCompare(b.criado_em) : a.vigencia.localeCompare(b.vigencia))).at(-1);
  };
  const lotes = (id: string) => {
    const porLote = new Map<string, { vigencia: string; criado_em: string; linhas: LinhaRateio[] }>();
    for (const l of lotacoes.ativos().filter((x) => x.cedido_id === id)) {
      const atual = porLote.get(l.lote) ?? { vigencia: l.vigencia, criado_em: l.criado_em, linhas: [] };
      atual.linhas.push({ centro: l.servico, percentual: l.percentual });
      porLote.set(l.lote, atual);
    }
    return [...porLote.values()];
  };
  const lotacaoDe = (id: string): LinhaRateio[] | undefined => {
    const l = lotes(id);
    return l.length ? vigenteNoMes(l, 9999, 12)?.linhas : undefined;
  };
  return { cedentes, cedidos, valores, servicos, areas, avisoDias, valorDe, lotacaoDe };
}

type Lida = Awaited<ReturnType<typeof ler>>;

const nomeDoServico = (l: Lida) => new Map(l.servicos.todos().map((s) => [s.codigo, s.nome]));

// ---------------------------------------------------------------------------
// Quem cede
// ---------------------------------------------------------------------------

export interface LinhaCedente {
  id: string;
  versao: number;
  nome: string;
  tipo: TipoCedente;
  tipoRotulo: string;
  observacao: string | null;
  /** Cedidos ativos hoje, só a quantidade. */
  cedidosAtivos: number;
  ativo: boolean;
}

export async function listarCedentes(p: Planilhas, quem: Autorizador, agora?: Date): Promise<{ cedentes: LinhaCedente[]; podeEditar: boolean }> {
  exigir(quem, PERM.individual);
  const l = await ler(p);
  const hoje = hojeEmBrasilia(agora);
  const ativosHoje = (cedenteId: string) => l.cedidos.ativos().filter((c) => c.cedente_id === cedenteId && situacaoDaCessao(c, hoje) !== 'encerrada').length;
  return {
    podeEditar: quem.temPermissao(PERM.editar),
    cedentes: l.cedentes
      .ativos()
      .map((c) => ({
        id: c.id, versao: c.versao, nome: c.nome, tipo: c.tipo, tipoRotulo: ROTULO_TIPO_CEDENTE[c.tipo], observacao: c.observacao,
        cedidosAtivos: ativosHoje(c.id), ativo: c.ativo,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

export interface DadosCedente {
  id?: string;
  versao?: number;
  nome: string;
  tipo: string;
  observacao: string | null;
}

export async function salvarCedente(p: Planilhas, quem: Autorizador, d: DadosCedente): Promise<string> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  const erros = validarCedente(d, l.cedentes.ativos().filter((x) => x.id !== d.id).map((x) => x.nome));
  if (erros.length) throw new ErroValidacaoCedidos(erros.join(' '));
  const campos = { nome: d.nome.trim(), tipo: d.tipo as TipoCedente, observacao: d.observacao?.trim() || null };
  if (!d.id) {
    const novo = await inserir(p, Cedentes, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Cedentes', registroId: novo.id });
    return novo.id;
  }
  const atual = l.cedentes.ativos().find((x) => x.id === d.id);
  if (!atual) throw new ErroValidacaoCedidos('Cadastro não encontrado.');
  const r = await atualizar(p, Cedentes, atual.id, d.versao ?? atual.versao, campos, { email: quem.email });
  if (r.colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Cedentes', registroId: atual.id, detalhes: { colunas: r.colunasAlteradas } });
  return atual.id;
}

/** Encerra (nada é apagado). Recusa se ainda há cedidos ativos. */
export async function encerrarCedente(p: Planilhas, quem: Autorizador, id: string, versao: number, agora?: Date): Promise<void> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  const hoje = hojeEmBrasilia(agora);
  const n = l.cedidos.ativos().filter((c) => c.cedente_id === id && situacaoDaCessao(c, hoje) !== 'encerrada').length;
  if (n > 0) throw new ErroValidacaoCedidos(`Não dá para encerrar: ${n} ${n === 1 ? 'profissional cedido ainda está ativo' : 'profissionais cedidos ainda estão ativos'} por esta origem. Encerre ${n === 1 ? 'a cessão' : 'as cessões'} antes.`);
  const r = await atualizar(p, Cedentes, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Cedentes', registroId: id, detalhes: { colunas: r.colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Cedidos
// ---------------------------------------------------------------------------

export interface LinhaCedido {
  id: string;
  colaborador: string | null;
  funcao: string;
  cedente: string;
  servicos: string[];
  /** Valor mensal vigente; nulo se ainda falta valor. */
  valorMensal: number | null;
  tipoValor: TipoValor | null;
  inicio: string;
  fimPrevisto: string | null;
  encerramento: string | null;
  situacao: SituacaoCessao;
  /** O que falta para contar nos totais. */
  pendencias: ('valor' | 'lotacao')[];
  aviso: ItemDeAviso | null;
}

function linhaDoCedido(l: Lida, c: RegCedido, hoje: string): LinhaCedido {
  const cedente = l.cedentes.todos().find((x) => x.id === c.cedente_id);
  const valor = l.valorDe(c.id);
  const lotacao = l.lotacaoDe(c.id);
  const nomes = nomeDoServico(l);
  return {
    id: c.id,
    colaborador: c.colaborador,
    funcao: c.funcao,
    cedente: cedente?.nome ?? '—',
    servicos: (lotacao ?? []).map((x) => nomes.get(x.centro) ?? x.centro),
    valorMensal: valor?.valor_mensal ?? null,
    tipoValor: valor?.tipo_valor ?? null,
    inicio: c.inicio,
    fimPrevisto: c.fim_previsto,
    encerramento: c.encerramento,
    situacao: situacaoDaCessao(c, hoje),
    pendencias: pendencias(Boolean(valor), lotacao),
    aviso: avisoDeFim(c, hoje, l.avisoDias),
  };
}

export async function listarCedidos(p: Planilhas, quem: Autorizador, agora?: Date): Promise<{ cedidos: LinhaCedido[]; podeEditar: boolean; avisoDias: number }> {
  exigir(quem, PERM.individual);
  const l = await ler(p);
  const hoje = hojeEmBrasilia(agora);
  const cedidos = l.cedidos
    .ativos()
    .map((c) => linhaDoCedido(l, c, hoje))
    .sort((a, b) => (a.colaborador ?? a.funcao).localeCompare(b.colaborador ?? b.funcao, 'pt-BR'));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Cedidos', detalhes: { lista: true } });
  return { cedidos, podeEditar: quem.temPermissao(PERM.editar), avisoDias: l.avisoDias };
}

export interface OpcoesDoCedido {
  cedentes: { id: string; nome: string }[];
  servicos: { codigo: string; nome: string; area: string }[];
}

export interface FichaCedido {
  cedido: {
    id: string; versao: number; colaborador: string | null; funcao: string; cargaHoraria: number | null; cedenteId: string;
    inicio: string; fimPrevisto: string | null; encerramento: string | null; observacao: string | null;
  } | null;
  linha: LinhaCedido | null;
  valor: { valorMensal: number; tipoValor: TipoValor; vigencia: string } | null;
  historicoDeValores: { vigencia: string; valorMensal: number; tipoValor: TipoValor }[];
  lotacao: LinhaRateio[];
  opcoes: OpcoesDoCedido;
  podeEditar: boolean;
}

export async function fichaDoCedido(p: Planilhas, quem: Autorizador, id: string | null, agora?: Date): Promise<FichaCedido> {
  exigir(quem, id ? PERM.individual : PERM.editar);
  const l = await ler(p);
  const nomeArea = new Map(l.areas.ativos().map((a) => [a.codigo, a.nome]));
  const opcoes: OpcoesDoCedido = {
    cedentes: l.cedentes.ativos().map((c) => ({ id: c.id, nome: c.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    servicos: l.servicos.ativos().map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
  const podeEditar = quem.temPermissao(PERM.editar);
  if (!id) return { cedido: null, linha: null, valor: null, historicoDeValores: [], lotacao: [], opcoes, podeEditar };
  const c = l.cedidos.ativos().find((x) => x.id === id);
  if (!c) throw new ErroValidacaoCedidos('Profissional cedido não encontrado.');
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Cedidos', registroId: id });
  const v = l.valorDe(id);
  const historico = l.valores.ativos().filter((x) => x.cedido_id === id).sort((a, b) => b.vigencia.localeCompare(a.vigencia) || b.criado_em.localeCompare(a.criado_em));
  return {
    cedido: {
      id: c.id, versao: c.versao, colaborador: c.colaborador, funcao: c.funcao, cargaHoraria: c.carga_horaria, cedenteId: c.cedente_id,
      inicio: c.inicio, fimPrevisto: c.fim_previsto, encerramento: c.encerramento, observacao: c.observacao,
    },
    linha: linhaDoCedido(l, c, hojeEmBrasilia(agora)),
    valor: v ? { valorMensal: v.valor_mensal, tipoValor: v.tipo_valor, vigencia: v.vigencia } : null,
    historicoDeValores: historico.map((x) => ({ vigencia: x.vigencia, valorMensal: x.valor_mensal, tipoValor: x.tipo_valor })),
    lotacao: l.lotacaoDe(id) ?? [],
    opcoes,
    podeEditar,
  };
}

export interface DadosCedido {
  id?: string;
  versao?: number;
  colaborador: string | null;
  funcao: string;
  cargaHoraria: number | null;
  cedenteId: string;
  inicio: string;
  fimPrevisto: string | null;
  observacao: string | null;
  lotacao: LinhaRateio[];
  /** Só na inclusão: o primeiro valor. Depois, use `alterarValorDoCedido`. */
  valorMensal?: number;
  tipoValor?: string;
}

const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ordenar = (x: LinhaRateio[]) => [...x].sort((a, b) => a.centro.localeCompare(b.centro));

export async function salvarCedido(p: Planilhas, quem: Autorizador, d: DadosCedido, agora?: Date): Promise<string> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  const erros = [...validarCedido(d), ...validarLotacao(d.lotacao)];
  if (!l.cedentes.ativos().some((c) => c.id === d.cedenteId)) erros.push('Escolha quem cede.');
  if (d.lotacao.some((x) => x.centro && !l.servicos.ativos().some((s) => s.codigo === x.centro))) erros.push('Há serviço na lotação que não existe ou está encerrado.');
  if (!d.id) erros.push(...validarValor(d.valorMensal ?? NaN, d.tipoValor ?? '', d.inicio ? inicioDoMes(d.inicio) : ''));
  if (erros.length) throw new ErroValidacaoCedidos([...new Set(erros)].join(' '));

  const autoria = { email: quem.email };
  const campos = {
    colaborador: d.colaborador?.trim() || null,
    funcao: d.funcao.trim(),
    carga_horaria: d.cargaHoraria,
    cedente_id: d.cedenteId,
    inicio: d.inicio,
    fim_previsto: d.fimPrevisto,
    observacao: d.observacao?.trim() || null,
  };
  let id: string;
  const colunas: string[] = [];
  const vigencia = inicioDoMes(d.inicio);
  if (!d.id) {
    id = (await inserir(p, Cedidos, campos, autoria)).id;
    await inserir(p, ValoresCedidos, { cedido_id: id, vigencia, valor_mensal: d.valorMensal!, tipo_valor: d.tipoValor as TipoValor, observacao: null }, autoria);
  } else {
    const atual = l.cedidos.ativos().find((x) => x.id === d.id);
    if (!atual) throw new ErroValidacaoCedidos('Profissional cedido não encontrado.');
    id = atual.id;
    const r = await atualizar(p, Cedidos, id, d.versao ?? atual.versao, campos, autoria);
    colunas.push(...r.colunasAlteradas);
  }
  if (!d.id || !iguais(ordenar(l.lotacaoDe(id) ?? []), ordenar(d.lotacao))) {
    const [tabela] = await lerTabelas(p, [LotacaoCedidos] as const);
    const lote = crypto.randomUUID();
    // Na inclusão vale desde o início; na alteração, desde o mês atual (o histórico fica).
    const vig = d.id ? [inicioDoMes(hojeEmBrasilia(agora)), vigencia].sort().at(-1)! : vigencia;
    await inserirRegistros(p, tabela, d.lotacao.map((x) => ({ cedido_id: id, lote, servico: x.centro, percentual: x.percentual, vigencia: vig })), autoria);
    colunas.push('lotacao');
  }
  if (!d.id) await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Cedidos', registroId: id });
  else if (colunas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Cedidos', registroId: id, detalhes: { colunas } });
  return id;
}

/** Grava uma nova linha de valor com vigência (o histórico fica). */
export async function alterarValorDoCedido(p: Planilhas, quem: Autorizador, id: string, d: { valorMensal: number; tipoValor: string; vigencia: string }): Promise<void> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  if (!l.cedidos.ativos().some((x) => x.id === id)) throw new ErroValidacaoCedidos('Profissional cedido não encontrado.');
  const erros = validarValor(d.valorMensal, d.tipoValor, d.vigencia);
  if (erros.length) throw new ErroValidacaoCedidos(erros.join(' '));
  await inserir(p, ValoresCedidos, { cedido_id: id, vigencia: inicioDoMes(d.vigencia), valor_mensal: d.valorMensal, tipo_valor: d.tipoValor as TipoValor, observacao: null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'ValoresCedidos', registroId: id, detalhes: { colunas: ['valor_mensal', 'tipo_valor', 'vigencia'] } });
}

/** Novo fim previsto: o aviso some se a nova data estiver além do prazo. */
export async function prorrogarCessao(p: Planilhas, quem: Autorizador, id: string, versao: number, novoFim: string): Promise<void> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  const c = l.cedidos.ativos().find((x) => x.id === id);
  if (!c) throw new ErroValidacaoCedidos('Profissional cedido não encontrado.');
  if (c.encerramento) throw new ErroValidacaoCedidos('Esta cessão já foi encerrada.');
  if (!DATA.test(novoFim) || novoFim < c.inicio) throw new ErroValidacaoCedidos('O novo fim previsto não pode ser antes do início.');
  const r = await atualizar(p, Cedidos, id, versao, { fim_previsto: novoFim }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Cedidos', registroId: id, detalhes: { colunas: r.colunasAlteradas, prorrogacao: true } });
}

export async function encerrarCessao(p: Planilhas, quem: Autorizador, id: string, versao: number, encerramento: string): Promise<void> {
  exigir(quem, PERM.editar);
  const l = await ler(p);
  const c = l.cedidos.ativos().find((x) => x.id === id);
  if (!c) throw new ErroValidacaoCedidos('Profissional cedido não encontrado.');
  if (c.encerramento) throw new ErroValidacaoCedidos('Esta cessão já foi encerrada.');
  if (!DATA.test(encerramento) || encerramento < c.inicio) throw new ErroValidacaoCedidos('A data de encerramento não pode ser antes do início.');
  const r = await atualizar(p, Cedidos, id, versao, { encerramento }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Cedidos', registroId: id, detalhes: { colunas: r.colunasAlteradas } });
}

// ---------------------------------------------------------------------------
// Aviso de fim de cessão
// ---------------------------------------------------------------------------

export interface AvisoDeCessao extends ItemDeAviso {
  id: string;
  funcao: string;
  servicos: string[];
  /** Só para quem vê o nome por pessoa. */
  colaborador: string | null;
}

export interface AvisosDeCessao {
  avisoDias: number;
  itens: AvisoDeCessao[];
  /** Pode prorrogar ou encerrar. */
  podeEditar: boolean;
  /** Vê nome e abre a ficha. */
  verNome: boolean;
}

/** Quem recebe o aviso: vê todos os serviços com nome, ou tem folha.ver em algum serviço (coordenação). Leitura não recebe. */
export function recebeAvisoDeCessao(quem: Autorizador): boolean {
  return quem.temPermissao(PERM.individual) || (!quem.temPermissao(PERM.ver) && quem.temPermissaoAlgumEscopo(PERM.ver));
}

export async function avisosDeCessao(p: Planilhas, quem: Autorizador, agora?: Date): Promise<AvisosDeCessao> {
  const verNome = quem.temPermissao(PERM.individual);
  const vazio = { avisoDias: 60, itens: [], podeEditar: false, verNome };
  if (!recebeAvisoDeCessao(quem)) return vazio;
  const l = await ler(p);
  const hoje = hojeEmBrasilia(agora);
  const nomes = nomeDoServico(l);
  const itens: AvisoDeCessao[] = [];
  for (const c of l.cedidos.ativos()) {
    const aviso = avisoDeFim(c, hoje, l.avisoDias);
    if (!aviso) continue;
    const lotacao = l.lotacaoDe(c.id) ?? [];
    if (!verNome && !lotacao.some((x) => quem.temPermissao(PERM.ver, { tipo: 'servico', codigo: x.centro }))) continue;
    itens.push({
      ...aviso,
      id: c.id,
      funcao: c.funcao,
      servicos: lotacao.map((x) => nomes.get(x.centro) ?? x.centro),
      colaborador: verNome ? c.colaborador : null,
    });
  }
  return { avisoDias: l.avisoDias, itens: ordenarAvisos(itens), podeEditar: quem.temPermissao(PERM.editar), verNome };
}

/** Número para o menu: quantos avisos esta pessoa tem. */
export async function contadorDeAvisosDeCessao(p: Planilhas, quem: Autorizador, agora?: Date): Promise<number> {
  return (await avisosDeCessao(p, quem, agora)).itens.length;
}

export { ativoNoMes };
