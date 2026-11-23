/**
 * Casos de uso de Parcerias.
 *
 * Quem pode: `parcerias.termos.editar` (global) cadastra e altera; `parcerias.termos.ver` vê os
 * termos (global vê todos; com escopo, só os que atendem serviço do seu escopo). Os valores não são
 * dados pessoais. Toda alteração grava auditoria com as colunas alteradas, nunca os valores.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import type { NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { contem, MAX_RESULTADOS_POR_APP, type ItemDaAgenda, type ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import { contarAtendidos, vinculosAtivosProtegido } from '@/nucleo/pessoas/contagem';
import {
  AporteParcelas,
  Aportes,
  Metas,
  TermoEquipe,
  TermoFonteCategorias,
  TermoFonteParcelas,
  TermoFontes,
  TermoServicos,
  Termos,
  type RegAporte,
  type RegFonte,
  type RegTermo,
} from '../dados/tabelas';
import {
  acumulado,
  alertaDeOciosas,
  avisoDeSoma,
  arredondar,
  conferirParcelasNaVigencia,
  conferirVigencia,
  dividirEmPartesIguais,
  emCentavos,
  emReais,
  ErroTermo,
  LIMITE_OCUPACAO_PADRAO,
  mesDe,
  mesesDeCobertura,
  mesesEntre,
  nomeComparavel,
  previstoPorMes,
  quadroDoServico,
  unidadeEhPessoa,
  FONTES_NUMERO,
  type FonteNumero,
  valorInicialDaFonte,
  dinheiro,
  type AlertaOciosas,
  type LinhaOcupacao,
  type Parcela,
  type TipoInstrumento,
} from '../dominio/termos';

export { ErroTermo };

const PERM = { ver: 'parcerias.termos.ver', editar: 'parcerias.termos.editar' } as const;
const hoje = (agora: Date) => agora.toISOString().slice(0, 10);

// --- entradas ------------------------------------------------------------------
export interface DadosFonte {
  nome: string;
  forma: 'global' | 'per_capita';
  valorInicial?: number | null;
  perCapita?: number | null;
  periodicidade?: 'mensal' | 'anual' | null;
  cronograma: 'iguais' | 'digitado';
  /** Modo "iguais": os meses de recebimento. */
  meses?: string[];
  /** Modo "digitado": uma parcela por mês. */
  parcelas?: Parcela[];
  recursosProprios?: number | null;
  permiteRemanejar?: boolean;
  categorias?: { categoria: string; valor: number }[];
}
export interface DadosTermo {
  parceiro: string;
  numero: string;
  objeto?: string | null;
  tipo: TipoInstrumento;
  tipoDescricao?: string | null;
  inicio: string;
  fim: string;
  unidadeMeta: string;
  recursosProprios?: number | null;
  limiteOcupacao?: number | null;
  servicos: { servico: string; inicio?: string | null; fim?: string | null; vagasOferecidas?: number | null; vagasCusteadas?: number | null }[];
  fontes: DadosFonte[];
  equipe?: { funcao: string; pessoas: number; horasSemanais: number }[];
  metas?: { servico?: string | null; descricao: string; unidade: string; quantidade?: number | null; quantidadeTexto?: string | null; fonteNumero?: FonteNumero }[];
}
export interface DadosAporte {
  fonteId: string;
  tipo: 'aditivo' | 'emenda' | 'suplementacao' | 'outro';
  registradoEm: string;
  inicio: string;
  fim: string;
  valor: number;
  cronograma: 'iguais' | 'digitado';
  meses?: string[];
  parcelas?: Parcela[];
  categoria?: string | null;
  descricao?: string | null;
}

// --- leitura e cálculo -----------------------------------------------------------
/** Termo que não é rascunho: os campos que o rascunho pode deixar vazios sempre existem (regra 24). */
export type TermoCompleto = Omit<RegTermo, 'numero' | 'tipo' | 'inicio' | 'fim' | 'unidade_meta' | 'situacao'> & {
  numero: string;
  tipo: TipoInstrumento;
  inicio: string;
  fim: string;
  unidade_meta: string;
  situacao: 'em_vigor' | 'encerrado';
};

/**
 * Regra 24: o rascunho vindo de um projeto fica fora de tudo (lista, ficha, ocupação, per capita, alertas, busca,
 * agenda e catálogo do Orçamento). Todo cálculo lê os termos por esta visão, que nunca traz rascunho.
 */
function visaoSemRascunhos(tabela: { todos(): RegTermo[]; ativos(): RegTermo[]; porId(id: string): RegTermo | undefined }) {
  const completo = (t: RegTermo): t is RegTermo & TermoCompleto => t.situacao !== 'rascunho';
  return {
    todos: (): TermoCompleto[] => tabela.todos().filter(completo),
    ativos: (): TermoCompleto[] => tabela.ativos().filter(completo),
    porId: (id: string): TermoCompleto | undefined => {
      const t = tabela.porId(id);
      return t && completo(t) ? t : undefined;
    },
  };
}

async function ler(p: Planilhas) {
  const [termos, servicos, fontes, parcelas, categorias, aportes, aporteParcelas, equipe, metas, nucleoServicos] = await lerTabelas(p, [
    Termos,
    TermoServicos,
    TermoFontes,
    TermoFonteParcelas,
    TermoFonteCategorias,
    Aportes,
    AporteParcelas,
    TermoEquipe,
    Metas,
    Servicos,
  ] as const);
  return { termos: visaoSemRascunhos(termos), rascunhos: termos.ativos().filter((t) => t.situacao === 'rascunho'), servicos, fontes, parcelas, categorias, aportes, aporteParcelas, equipe, metas, nomeServico: new Map(nucleoServicos.todos().map((s) => [s.codigo, s.nome])) };
}
type Lido = Awaited<ReturnType<typeof ler>>;

const totalCusteadas = (servs: { vagas_custeadas: number | null }[]) => servs.reduce((s, x) => s + (x.vagas_custeadas ?? 0), 0);

export interface FichaFonte {
  id: string;
  nome: string;
  ativo: boolean;
  forma: 'global' | 'per_capita';
  perCapita: number | null;
  periodicidade: 'mensal' | 'anual' | null;
  cronograma: 'iguais' | 'digitado';
  valorInicial: number;
  valorAtual: number;
  parcelas: Parcela[];
  recursosProprios: number | null;
  permiteRemanejar: boolean;
  categorias: { categoria: string; valor: number }[];
  versao: number;
}
export interface FichaAporte {
  id: string;
  fonteId: string;
  fonteNome: string;
  tipo: string;
  registradoEm: string;
  inicio: string;
  fim: string;
  valor: number;
  categoria: string | null;
  descricao: string | null;
  parcelas: Parcela[];
  versao: number;
}
export interface FichaMeta {
  id: string;
  versao: number;
  servico: string | null;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  quantidadeTexto: string | null;
  fonteNumero: FonteNumero;
}
export interface FichaTermo {
  id: string;
  versao: number;
  parceiro: string;
  numero: string;
  objeto: string | null;
  tipo: TipoInstrumento;
  tipoDescricao: string | null;
  inicio: string;
  fim: string;
  situacao: 'em_vigor' | 'encerrado';
  unidadeMeta: string;
  recursosProprios: number | null;
  limiteOcupacao: number;
  valorGlobal: number;
  servicos: { id: string; versao: number; servico: string; nome: string; vagasOferecidas: number | null; vagasCusteadas: number | null }[];
  fontes: FichaFonte[];
  aportes: FichaAporte[];
  equipe: { funcao: string; pessoas: number; horasSemanais: number }[];
  metas: FichaMeta[];
  previstoPorMes: Parcela[];
  pontosDeAtencao: string[];
  terminaEmAte90Dias: boolean;
}

function fichaDe(l: Lido, t: TermoCompleto, agora: Date): FichaTermo {
  const servs = l.servicos.ativos().filter((s) => s.termo_id === t.id);
  const qtd = totalCusteadas(servs);
  const cobertura = mesesDeCobertura(t.inicio, t.fim);
  const pontos: string[] = [];
  const todosAportes = l.aportes.ativos().filter((a) => a.termo_id === t.id);
  const fontes = l.fontes
    .ativos()
    .filter((f) => f.termo_id === t.id)
    .map((f): FichaFonte => {
      const inicial = valorInicialDaFonte(
        { forma: f.forma, valorInicial: f.valor_inicial, perCapita: f.per_capita, periodicidade: f.periodicidade },
        qtd,
        cobertura,
      );
      const soma = todosAportes.filter((a) => a.fonte_id === f.id).reduce((s, a) => s + emCentavos(a.valor), 0);
      const parcelas = l.parcelas.ativos().filter((x) => x.fonte_id === f.id).map((x) => ({ mes: x.mes, valor: x.valor })).sort((a, b) => a.mes.localeCompare(b.mes));
      const categorias = l.categorias.ativos().filter((c) => c.fonte_id === f.id).map((c) => ({ categoria: c.categoria, valor: c.valor }));
      const aviso = avisoDeSoma(`da fonte "${f.nome}"`, parcelas, inicial);
      if (aviso) pontos.push(aviso);
      if (categorias.length) {
        const somaCat = categorias.reduce((s, c) => s + emCentavos(c.valor), 0);
        if (somaCat !== emCentavos(inicial)) {
          pontos.push(`O plano de aplicação da fonte "${f.nome}" soma ${dinheiro(emReais(somaCat))}; o valor da fonte é ${dinheiro(inicial)}.`);
        }
      }
      return {
        id: f.id,
        nome: f.nome,
        ativo: f.ativo,
        forma: f.forma,
        perCapita: f.per_capita,
        periodicidade: f.periodicidade,
        cronograma: f.cronograma,
        valorInicial: inicial,
        valorAtual: emReais(emCentavos(inicial) + soma),
        parcelas,
        recursosProprios: f.recursos_proprios,
        permiteRemanejar: f.permite_remanejar,
        categorias,
        versao: f.versao,
      };
    });
  const aportes = todosAportes.map((a): FichaAporte => {
    const parcelas = l.aporteParcelas.ativos().filter((x) => x.aporte_id === a.id).map((x) => ({ mes: x.mes, valor: x.valor })).sort((x, y) => x.mes.localeCompare(y.mes));
    const aviso = avisoDeSoma(`do aporte (${a.registrado_em})`, parcelas, a.valor);
    if (aviso) pontos.push(aviso);
    if (a.inicio < t.inicio || a.fim > t.fim) pontos.push(`A vigência do aporte registrado em ${a.registrado_em} está fora da vigência do termo.`);
    return {
      id: a.id,
      fonteId: a.fonte_id,
      fonteNome: fontes.find((f) => f.id === a.fonte_id)?.nome ?? '—',
      tipo: a.tipo,
      registradoEm: a.registrado_em,
      inicio: a.inicio,
      fim: a.fim,
      valor: a.valor,
      categoria: a.categoria,
      descricao: a.descricao,
      parcelas,
      versao: a.versao,
    };
  });
  for (const s of servs) {
    if (s.vagas_custeadas !== null && s.vagas_oferecidas !== null && s.vagas_custeadas > s.vagas_oferecidas) {
      pontos.push(`O serviço ${l.nomeServico.get(s.servico) ?? s.servico} tem mais vagas custeadas (${s.vagas_custeadas}) do que oferecidas (${s.vagas_oferecidas}).`);
    }
  }
  const dia = hoje(agora);
  const limite90 = new Date(agora.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
  return {
    id: t.id,
    versao: t.versao,
    parceiro: t.parceiro,
    numero: t.numero,
    objeto: t.objeto,
    tipo: t.tipo,
    tipoDescricao: t.tipo_descricao,
    inicio: t.inicio,
    fim: t.fim,
    situacao: t.situacao,
    unidadeMeta: t.unidade_meta,
    recursosProprios: t.recursos_proprios,
    limiteOcupacao: t.limite_ocupacao ?? LIMITE_OCUPACAO_PADRAO,
    valorGlobal: emReais(fontes.reduce((s, f) => s + emCentavos(f.valorAtual), 0)),
    servicos: servs.map((s) => ({
      id: s.id,
      versao: s.versao,
      servico: s.servico,
      nome: l.nomeServico.get(s.servico) ?? s.servico,
      vagasOferecidas: s.vagas_oferecidas,
      vagasCusteadas: s.vagas_custeadas,
    })),
    fontes,
    aportes,
    equipe: l.equipe.ativos().filter((e) => e.termo_id === t.id).map((e) => ({ funcao: e.funcao, pessoas: e.pessoas, horasSemanais: e.horas_semanais })),
    metas: l.metas
      .ativos()
      .filter((m) => m.termo_id === t.id)
      .map((m) => ({ id: m.id, versao: m.versao, servico: m.servico, descricao: m.descricao, unidade: m.unidade, quantidade: m.quantidade, quantidadeTexto: m.quantidade_texto, fonteNumero: m.fonte_numero })),
    previstoPorMes: previstoPorMes(...fontes.map((f) => f.parcelas), ...aportes.map((a) => a.parcelas)),
    pontosDeAtencao: pontos,
    terminaEmAte90Dias: t.situacao === 'em_vigor' && t.fim >= dia && t.fim <= limite90,
  };
}

function podeVer(quem: Autorizador, servicos: string[]): boolean {
  return quem.temPermissao(PERM.ver) || servicos.some((s) => quem.temPermissao(PERM.ver, { tipo: 'servico', codigo: s }));
}
function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao('Só o Financeiro pode cadastrar e alterar termos.');
}

export interface ResumoTermo {
  id: string;
  parceiro: string;
  numero: string;
  tipo: TipoInstrumento;
  inicio: string;
  fim: string;
  situacao: 'em_vigor' | 'encerrado';
  valorGlobal: number;
  servicos: string[];
  terminaEmAte90Dias: boolean;
  pontosDeAtencao: number;
}

export async function listarTermos(p: Planilhas, quem: Autorizador, agora = new Date()): Promise<ResumoTermo[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const l = await ler(p);
  return l.termos
    .ativos()
    .map((t) => fichaDe(l, t, agora))
    .filter((f) => podeVer(quem, f.servicos.map((s) => s.servico)))
    .map((f) => ({
      id: f.id,
      parceiro: f.parceiro,
      numero: f.numero,
      tipo: f.tipo,
      inicio: f.inicio,
      fim: f.fim,
      situacao: f.situacao,
      valorGlobal: f.valorGlobal,
      servicos: f.servicos.map((s) => s.nome),
      terminaEmAte90Dias: f.terminaEmAte90Dias,
      pontosDeAtencao: f.pontosDeAtencao.length,
    }))
    .sort((a, b) => a.parceiro.localeCompare(b.parceiro, 'pt-BR') || a.numero.localeCompare(b.numero));
}

export interface QuadroServico {
  servico: string;
  nome: string;
  semContagem: boolean;
  linhas: LinhaOcupacao[];
  acumulado: ReturnType<typeof acumulado>;
  alerta: AlertaOciosas | null;
}
/** "Hoje" de uma meta com número do cadastro (regras 27 e L1 a L6 da onda 2). */
export type HojeDaMeta =
  | { estado: 'ok'; numero: NumeroAgregado; situacao: 'dentro' | 'abaixo' | null }
  | { estado: 'sem_servico' | 'indisponivel' };

/**
 * Leitura de números de pessoas, declarada aqui e entregue pela plataforma (Parcerias não importa a Avaliação).
 * Devolve `null` quando o app de origem está desligado. Os números já vêm protegidos pelo mínimo de 5 pessoas.
 */
export interface NumerosDePessoas {
  indicadoresDoServico(servico: string): Promise<{ indiceMedio: NumeroAgregado; reavaliacaoEmDia: NumeroAgregado } | null>;
}

export interface DetalheTermo extends FichaTermo {
  quadro: QuadroServico[];
  /** Por id da meta; só metas com fonte automática. */
  hojeDasMetas: Record<string, HojeDaMeta>;
}

/** Situação contra a meta: sem meta ou sem número, não se calcula. */
const situacaoDaMeta = (numero: NumeroAgregado, meta: number | null): 'dentro' | 'abaixo' | null =>
  numero.valor === null || meta === null ? null : numero.valor >= meta ? 'dentro' : 'abaixo';

async function hojeDasMetas(p: Planilhas, f: FichaTermo, leitor: NumerosDePessoas | undefined, dia: string): Promise<Record<string, HojeDaMeta>> {
  const r: Record<string, HojeDaMeta> = {};
  const cache = new Map<string, Awaited<ReturnType<NumerosDePessoas['indicadoresDoServico']>>>();
  for (const m of f.metas) {
    if (m.fonteNumero === 'manual') continue;
    if (!m.servico) {
      r[m.id] = { estado: 'sem_servico' };
      continue;
    }
    let numero: NumeroAgregado;
    if (m.fonteNumero === 'vinculos_ativos') numero = await vinculosAtivosProtegido(p, m.servico, dia);
    else {
      if (!cache.has(m.servico)) cache.set(m.servico, leitor ? await leitor.indicadoresDoServico(m.servico).catch(() => null) : null);
      const ind = cache.get(m.servico);
      if (!ind) {
        r[m.id] = { estado: 'indisponivel' };
        continue;
      }
      numero = m.fonteNumero === 'indice_cuidado' ? ind.indiceMedio : ind.reavaliacaoEmDia;
    }
    r[m.id] = { estado: 'ok', numero, situacao: situacaoDaMeta(numero, m.quantidade) };
  }
  return r;
}

export async function detalharTermo(p: Planilhas, quem: Autorizador, id: string, agora = new Date(), leitor?: NumerosDePessoas): Promise<DetalheTermo> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const l = await ler(p);
  const t = l.termos.porId(id);
  if (!t || !t.ativo) throw new ErroTermo('Termo não encontrado.');
  const f = fichaDe(l, t, agora);
  if (!podeVer(quem, f.servicos.map((s) => s.servico))) throw new ErroPermissao();
  return { ...f, quadro: await quadroDe(p, f, agora), hojeDasMetas: await hojeDasMetas(p, f, leitor, hoje(agora)) };
}

/** Quadro "Per capita e ocupação" por serviço, do início da vigência até o mês atual (ou o fim). */
async function quadroDe(p: Planilhas, f: FichaTermo, agora: Date): Promise<QuadroServico[]> {
  const dia = hoje(agora);
  const ultimo = mesDe(dia) < mesDe(f.fim) ? mesDe(dia) : mesDe(f.fim);
  const meses = mesDe(f.inicio) <= ultimo ? mesesEntre(mesDe(f.inicio), ultimo) : [];
  const pessoa = unidadeEhPessoa(f.unidadeMeta);
  const contagem = pessoa && meses.length ? await contarAtendidos(p, f.servicos.map((s) => s.servico), meses, dia) : null;
  const total = f.servicos.reduce((s, x) => s + (x.vagasCusteadas ?? 0), 0);
  return f.servicos.map((s) => {
    const linhas = quadroDoServico({ servico: s.servico, vagasOferecidas: s.vagasOferecidas, vagasCusteadas: s.vagasCusteadas }, total, f.previstoPorMes, contagem?.get(s.servico) ?? null, meses);
    const ultima = linhas.at(-1);
    return {
      servico: s.servico,
      nome: s.nome,
      semContagem: !pessoa,
      linhas,
      acumulado: acumulado(linhas),
      alerta: pessoa ? alertaDeOciosas(linhas, f.limiteOcupacao, ultima?.perCapitaMeta ?? null) : null,
    };
  });
}

/** Termos em vigor com alerta de vagas ociosas (para a lista). */
export async function termosComAlertaDeOciosas(p: Planilhas, quem: Autorizador, agora = new Date()): Promise<Set<string>> {
  const r = new Set<string>();
  for (const t of await listarTermos(p, quem, agora)) {
    if (t.situacao !== 'em_vigor') continue;
    const d = await detalharTermo(p, quem, t.id, agora);
    if (d.quadro.some((q) => q.alerta)) r.add(t.id);
  }
  return r;
}

// --- gravação -----------------------------------------------------------------------
function cronogramaDe(
  d: { cronograma: 'iguais' | 'digitado'; meses?: string[]; parcelas?: Parcela[] },
  valor: number,
  inicio: string,
  fim: string,
  rotulo: string,
  obrigatorio: boolean,
): Parcela[] {
  const lista = d.cronograma === 'iguais' ? dividirEmPartesIguais(valor, d.meses ?? []) : (d.parcelas ?? []).map((x) => ({ mes: x.mes, valor: arredondar(x.valor) }));
  if (obrigatorio && lista.length === 0) throw new ErroTermo(`O cronograma ${rotulo} precisa de ao menos uma parcela.`);
  conferirParcelasNaVigencia(lista, inicio, fim, rotulo);
  return lista;
}

function conferirFonte(f: DadosFonte, outras: string[]) {
  if (!f.nome.trim()) throw new ErroTermo('Informe o nome da fonte.');
  if (outras.some((o) => nomeComparavel(o) === nomeComparavel(f.nome))) throw new ErroTermo(`Já existe a fonte "${f.nome}" neste termo.`);
  if (f.forma === 'global' && !((f.valorInicial ?? 0) > 0)) throw new ErroTermo(`Informe o valor inicial da fonte "${f.nome}".`);
  if (f.forma === 'per_capita' && (!((f.perCapita ?? 0) > 0) || !f.periodicidade)) {
    throw new ErroTermo(`Informe o valor per capita e se é mensal ou anual na fonte "${f.nome}".`);
  }
}

/** Valor inicial da fonte para os dados informados (usa as vagas custeadas do termo). */
const inicialDe = (f: DadosFonte, qtd: number, cobertura: number) =>
  valorInicialDaFonte({ forma: f.forma, valorInicial: f.valorInicial ?? null, perCapita: f.perCapita ?? null, periodicidade: f.periodicidade ?? null }, qtd, cobertura);

const linhaFonte = (termoId: string, f: DadosFonte) => ({
  termo_id: termoId,
  nome: f.nome,
  forma: f.forma,
  valor_inicial: f.forma === 'global' ? (f.valorInicial ?? null) : null,
  per_capita: f.forma === 'per_capita' ? (f.perCapita ?? null) : null,
  periodicidade: f.forma === 'per_capita' ? (f.periodicidade ?? null) : null,
  cronograma: f.cronograma,
  recursos_proprios: f.recursosProprios ?? null,
  permite_remanejar: f.permiteRemanejar ?? false,
});

export async function criarTermo(p: Planilhas, quem: Autorizador, d: DadosTermo, agora = new Date()): Promise<string> {
  exigirEditar(quem);
  return gravarTermo(p, quem.email, d, agora);
}

/** Grava o termo já conferido o acesso (também usada pela demonstração). */
export async function gravarTermo(p: Planilhas, email: string, d: DadosTermo, agora = new Date()): Promise<string> {
  const quem = { email };
  const autoria = { email: quem.email, agora: () => agora };
  const l = await ler(p);
  if (!d.parceiro.trim() || !d.numero.trim()) throw new ErroTermo('Informe o parceiro e o número do termo.');
  conferirVigencia(d.inicio, d.fim);
  if (!d.unidadeMeta.trim()) throw new ErroTermo('Informe a unidade da meta (ex.: alunos, usuários, procedimentos).');
  if (d.tipo === 'outro' && !d.tipoDescricao?.trim()) throw new ErroTermo('Descreva o tipo de instrumento "outro".');
  if (l.termos.ativos().some((t) => nomeComparavel(t.parceiro) === nomeComparavel(d.parceiro) && nomeComparavel(t.numero) === nomeComparavel(d.numero))) {
    throw new ErroTermo(`Já existe o termo ${d.numero} para este parceiro.`);
  }
  if (d.servicos.length === 0) throw new ErroTermo('O termo precisa atender ao menos um serviço.');
  if (new Set(d.servicos.map((s) => s.servico)).size !== d.servicos.length) throw new ErroTermo('Um serviço aparece duas vezes.');
  for (const s of d.servicos) {
    if (!l.nomeServico.has(s.servico)) throw new ErroTermo(`Serviço desconhecido: ${s.servico}.`);
  }
  if (d.fontes.length === 0) throw new ErroTermo('O termo precisa de ao menos uma fonte.');
  const qtd = d.servicos.reduce((s, x) => s + (x.vagasCusteadas ?? 0), 0);
  const cobertura = mesesDeCobertura(d.inicio, d.fim);
  const nomes: string[] = [];
  const cronogramas = d.fontes.map((f) => {
    conferirFonte(f, nomes);
    nomes.push(f.nome);
    return cronogramaDe(f, inicialDe(f, qtd, cobertura), d.inicio, d.fim, `da fonte "${f.nome}"`, true);
  });

  const termo = await inserir(
    p,
    Termos,
    {
      parceiro: d.parceiro,
      numero: d.numero,
      objeto: d.objeto ?? null,
      tipo: d.tipo,
      tipo_descricao: d.tipo === 'outro' ? (d.tipoDescricao ?? null) : null,
      inicio: d.inicio,
      fim: d.fim,
      situacao: 'em_vigor',
      unidade_meta: d.unidadeMeta,
      recursos_proprios: d.recursosProprios ?? null,
      limite_ocupacao: d.limiteOcupacao ?? null,
    },
    autoria,
  );
  await inserirRegistros(
    p,
    l.servicos,
    d.servicos.map((s) => ({
      termo_id: termo.id,
      servico: s.servico,
      inicio: s.inicio ?? null,
      fim: s.fim ?? null,
      vagas_oferecidas: s.vagasOferecidas ?? null,
      vagas_custeadas: s.vagasCusteadas ?? null,
    })),
    autoria,
  );
  const fontes = await inserirRegistros(p, l.fontes, d.fontes.map((f) => linhaFonte(termo.id, f)), autoria);
  await inserirRegistros(p, l.parcelas, fontes.flatMap((f, i) => cronogramas[i].map((x) => ({ fonte_id: f.id, mes: x.mes, valor: x.valor }))), autoria);
  await inserirRegistros(p, l.categorias, fontes.flatMap((f, i) => (d.fontes[i].categorias ?? []).map((c) => ({ fonte_id: f.id, categoria: c.categoria, valor: c.valor }))), autoria);
  await inserirRegistros(p, l.equipe, (d.equipe ?? []).map((e) => ({ termo_id: termo.id, funcao: e.funcao, pessoas: e.pessoas, horas_semanais: e.horasSemanais })), autoria);
  await inserirRegistros(
    p,
    l.metas,
    (d.metas ?? []).map((m) => ({ termo_id: termo.id, servico: m.servico ?? null, descricao: m.descricao, unidade: m.unidade, quantidade: m.quantidade ?? null, quantidade_texto: m.quantidadeTexto ?? null, fonte_numero: m.fonteNumero ?? ('manual' as const) })),
    autoria,
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Termos', registroId: termo.id, detalhes: { fontes: d.fontes.length, servicos: d.servicos.length } }, agora);
  return termo.id;
}

export async function adicionarFonte(p: Planilhas, quem: Autorizador, termoId: string, f: DadosFonte, agora = new Date()): Promise<string> {
  exigirEditar(quem);
  const autoria = { email: quem.email, agora: () => agora };
  const l = await ler(p);
  const t = l.termos.porId(termoId);
  if (!t || !t.ativo) throw new ErroTermo('Termo não encontrado.');
  if (t.situacao === 'encerrado') throw new ErroTermo('Termo encerrado não recebe fonte nova.');
  conferirFonte(f, l.fontes.ativos().filter((x) => x.termo_id === termoId).map((x) => x.nome));
  const qtd = totalCusteadas(l.servicos.ativos().filter((s) => s.termo_id === termoId));
  const parcelas = cronogramaDe(f, inicialDe(f, qtd, mesesDeCobertura(t.inicio, t.fim)), t.inicio, t.fim, `da fonte "${f.nome}"`, true);
  const fonte = await inserir(p, TermoFontes, linhaFonte(termoId, f), autoria);
  await inserirRegistros(p, l.parcelas, parcelas.map((x) => ({ fonte_id: fonte.id, mes: x.mes, valor: x.valor })), autoria);
  await inserirRegistros(p, l.categorias, (f.categorias ?? []).map((c) => ({ fonte_id: fonte.id, categoria: c.categoria, valor: c.valor })), autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'TermoFontes', registroId: fonte.id, detalhes: { termo: termoId } }, agora);
  return fonte.id;
}

export async function registrarAporte(p: Planilhas, quem: Autorizador, termoId: string, a: DadosAporte, agora = new Date()): Promise<string> {
  exigirEditar(quem);
  const autoria = { email: quem.email, agora: () => agora };
  const l = await ler(p);
  const t = l.termos.porId(termoId);
  if (!t || !t.ativo) throw new ErroTermo('Termo não encontrado.');
  const fonte = fichaDe(l, t, agora).fontes.find((x) => x.id === a.fonteId);
  if (!fonte) throw new ErroTermo('Escolha uma fonte deste termo.');
  if (a.registradoEm > hoje(agora)) throw new ErroTermo('A data do registro não pode ser futura.');
  conferirVigencia(a.inicio, a.fim);
  if (a.inicio < t.inicio || a.fim > t.fim) throw new ErroTermo('A vigência do aporte precisa ficar dentro da vigência do termo.');
  if (!a.valor) throw new ErroTermo('Informe o valor do aporte.');
  if (emCentavos(fonte.valorAtual) + emCentavos(a.valor) < 0) throw new ErroTermo('O aporte deixaria o valor da fonte negativo.');
  const parcelas = cronogramaDe(a, a.valor, a.inicio, a.fim, 'do aporte', false);
  const aporte = await inserir(
    p,
    Aportes,
    {
      termo_id: termoId,
      fonte_id: a.fonteId,
      tipo: a.tipo,
      registrado_em: a.registradoEm,
      inicio: a.inicio,
      fim: a.fim,
      valor: a.valor,
      cronograma: a.cronograma,
      categoria: a.categoria ?? null,
      descricao: a.descricao ?? null,
    },
    autoria,
  );
  await inserirRegistros(p, l.aporteParcelas, parcelas.map((x) => ({ aporte_id: aporte.id, mes: x.mes, valor: x.valor })), autoria);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Aportes', registroId: aporte.id, detalhes: { termo: termoId } }, agora);
  return aporte.id;
}

/** Aporte lançado errado é cancelado (fica guardado, com ativo = FALSE) e relançado. */
export async function cancelarAporte(p: Planilhas, quem: Autorizador, aporteId: string, versao: number, agora = new Date()): Promise<void> {
  exigirEditar(quem);
  const l = await ler(p);
  const a: RegAporte | undefined = l.aportes.porId(aporteId);
  if (!a || !a.ativo) throw new ErroTermo('Aporte não encontrado.');
  const t = l.termos.porId(a.termo_id)!;
  const f = fichaDe(l, t, agora).fontes.find((x) => x.id === a.fonte_id);
  if (f && emCentavos(f.valorAtual) - emCentavos(a.valor) < 0) throw new ErroTermo('Cancelar este aporte deixaria o valor da fonte negativo.');
  const r = await atualizar(p, Aportes, aporteId, versao, { ativo: false }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Aportes', registroId: aporteId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

export async function encerrarFonte(p: Planilhas, quem: Autorizador, fonteId: string, versao: number, agora = new Date()): Promise<void> {
  exigirEditar(quem);
  const l = await ler(p);
  const f: RegFonte | undefined = l.fontes.porId(fonteId);
  if (!f || !f.ativo) throw new ErroTermo('Fonte não encontrada.');
  if (l.fontes.ativos().filter((x) => x.termo_id === f.termo_id).length < 2) throw new ErroTermo('O termo precisa de ao menos uma fonte; encerre o termo.');
  const r = await atualizar(p, TermoFontes, fonteId, versao, { ativo: false }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'TermoFontes', registroId: fonteId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

export async function encerrarTermo(p: Planilhas, quem: Autorizador, termoId: string, versao: number, agora = new Date()): Promise<void> {
  exigirEditar(quem);
  const r = await atualizar(p, Termos, termoId, versao, { situacao: 'encerrado' }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Termos', registroId: termoId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

/**
 * Escolhe de onde vem o número "hoje" da meta (regra 27). Fonte automática exige serviço do termo e
 * unidade de pessoas; "manual" volta ao número digitado. Grava as colunas alteradas na auditoria.
 */
export async function definirFonteDaMeta(
  p: Planilhas,
  quem: Autorizador,
  metaId: string,
  versao: number,
  escolha: { fonte: FonteNumero; servico?: string | null },
  agora = new Date(),
): Promise<void> {
  exigirEditar(quem);
  if (!FONTES_NUMERO.includes(escolha.fonte)) throw new ErroTermo('Escolha uma das fontes oferecidas.');
  const l = await ler(p);
  const m = l.metas.porId(metaId);
  if (!m || !m.ativo) throw new ErroTermo('Meta não encontrada.');
  let servico = m.servico;
  if (escolha.fonte !== 'manual') {
    if (!unidadeEhPessoa(m.unidade)) throw new ErroTermo('Só metas contadas em pessoas (alunos, usuários, pessoas…) aceitam número do cadastro.');
    servico = escolha.servico || m.servico;
    if (!servico) throw new ErroTermo('Escolha o serviço para calcular o número.');
    const doTermo = l.servicos.ativos().some((s) => s.termo_id === m.termo_id && s.servico === servico);
    if (!doTermo) throw new ErroTermo('Escolha um serviço deste termo.');
  }
  const r = await atualizar(p, Metas, metaId, versao, { fonte_numero: escolha.fonte, servico }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Metas', registroId: metaId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

export async function definirLimiteOcupacao(p: Planilhas, quem: Autorizador, termoId: string, versao: number, limite: number, agora = new Date()): Promise<void> {
  exigirEditar(quem);
  if (!(limite > 0 && limite <= 100)) throw new ErroTermo('O limite de ocupação fica entre 1% e 100%.');
  const r = await atualizar(p, Termos, termoId, versao, { limite_ocupacao: limite }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Termos', registroId: termoId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

/** Muda as vagas de um serviço do termo; o valor per capita da fonte se recalcula sozinho. */
export async function atualizarVagas(
  p: Planilhas,
  quem: Autorizador,
  termoServicoId: string,
  versao: number,
  vagas: { oferecidas: number | null; custeadas: number | null },
  agora = new Date(),
): Promise<void> {
  exigirEditar(quem);
  if ((vagas.oferecidas ?? 0) < 0 || (vagas.custeadas ?? 0) < 0) throw new ErroTermo('As vagas não podem ser negativas.');
  const r = await atualizar(p, TermoServicos, termoServicoId, versao, { vagas_oferecidas: vagas.oferecidas, vagas_custeadas: vagas.custeadas }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'TermoServicos', registroId: termoServicoId, detalhes: { colunas: r.colunasAlteradas } }, agora);
}

// --- leitura para o Orçamento (ADR-020, sem permissão própria, sem dados pessoais) ----
export interface TermoParaOrcamento {
  id: string;
  parceiro: string;
  numero: string;
  tipo: TipoInstrumento;
  inicio: string;
  fim: string;
  unidadeMeta: string;
  /** A unidade da meta é pessoa (o Núcleo consegue contar atendidos). */
  unidadePessoa: boolean;
  servicos: string[];
  /** Vagas de cada serviço no termo (só números, sem dado pessoal). */
  vagasPorServico: { servico: string; vagasCusteadas: number | null; vagasOferecidas: number | null }[];
  recursosProprios: number | null;
  equipe: { funcao: string; pessoas: number; horasSemanais: number }[];
  fontes: {
    id: string;
    nome: string;
    valorAtual: number;
    parcelas: Parcela[];
    aportesParcelas: Parcela[];
    recursosProprios: number | null;
    permiteRemanejar: boolean;
    categorias: { categoria: string; valor: number }[];
  }[];
}

// --- rascunho vindo de um projeto (ADR-023, regras 22, 25 e 26) ------------------------------
export interface PedidoRascunho {
  projetoId: string;
  projetoCodigo: string;
  /** Nome do financiador: vira o parceiro do termo. */
  financiador: string;
  objeto: string;
  /** Serviço do projeto (código), se houver. */
  servico: string | null;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  valorAprovado: number;
}

/**
 * Regra 22: cria o rascunho do termo a pedido da plataforma (decisão da porta 2 do projeto). Única porta de
 * criação de rascunho; não exige `parcerias.termos.editar`, porque quem decide a porta não é do Financeiro.
 * Idempotente por projeto: se já houve rascunho (mesmo encerrado), devolve o mesmo, sem duplicar.
 */
export async function criarRascunhoDeTermo(p: Planilhas, quem: { email: string }, d: PedidoRascunho, agora = new Date()): Promise<{ termoId: string; criado: boolean }> {
  const autoria = { email: quem.email, agora: () => agora };
  const [todos] = await lerTabelas(p, [Termos] as const);
  const existente = todos.todos().find((t) => t.projeto_origem_id === d.projetoId);
  if (existente) return { termoId: existente.id, criado: false };
  const l = await ler(p);
  if (!d.financiador.trim()) throw new ErroTermo('O rascunho precisa do nome do financiador.');
  if (!(d.valorAprovado >= 0)) throw new ErroTermo('Valor aprovado inválido.');
  if (d.servico && !l.nomeServico.has(d.servico)) throw new ErroTermo(`Serviço desconhecido: ${d.servico}.`);
  if (d.inicioPrevisto && d.fimPrevisto && d.fimPrevisto <= d.inicioPrevisto) throw new ErroTermo('A vigência prevista precisa terminar depois de começar.');
  const campos = {
    parceiro: d.financiador.trim(),
    numero: null,
    objeto: d.objeto.trim() || null,
    tipo: null,
    tipo_descricao: null,
    inicio: d.inicioPrevisto,
    fim: d.fimPrevisto,
    situacao: 'rascunho' as const,
    unidade_meta: null,
    recursos_proprios: null,
    limite_ocupacao: null,
    projeto_origem_id: d.projetoId,
    projeto_origem_codigo: d.projetoCodigo,
  };
  const termo = await inserir(p, Termos, campos, autoria);
  if (d.servico) await inserir(p, TermoServicos, { termo_id: termo.id, servico: d.servico, inicio: null, fim: null, vagas_oferecidas: null, vagas_custeadas: null }, autoria);
  await inserir(
    p,
    TermoFontes,
    { termo_id: termo.id, nome: `Projeto ${d.projetoCodigo}`, forma: 'global', valor_inicial: arredondar(d.valorAprovado), per_capita: null, periodicidade: null, cronograma: 'iguais', recursos_proprios: null, permite_remanejar: false },
    autoria,
  );
  // Auditoria: só as colunas e a origem, nunca os valores (regra 7 do projeto).
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Termos', registroId: termo.id, detalhes: { colunas: Object.keys(campos), origem: d.projetoCodigo } }, agora);
  return { termoId: termo.id, criado: true };
}

export interface RascunhoDeTermo {
  id: string;
  versao: number;
  parceiro: string;
  objeto: string | null;
  projetoCodigo: string | null;
  valor: number;
  /** O projeto de origem foi cancelado ou parado (informado pela plataforma; só leitura). */
  origemParadaOuCancelada: boolean;
  /** O que o Financeiro ainda precisa informar. */
  falta: string[];
}

/** Rascunhos que a pessoa vê (mesma permissão dos termos). Só o Financeiro (`editar`) os completa. */
export async function listarRascunhos(p: Planilhas, quem: Autorizador, origensComProblema: ReadonlySet<string> = new Set()): Promise<RascunhoDeTermo[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const l = await ler(p);
  return l.rascunhos
    .filter((t) => podeVer(quem, l.servicos.ativos().filter((s) => s.termo_id === t.id).map((s) => s.servico)))
    .map((t) => {
      const fontes = l.fontes.ativos().filter((f) => f.termo_id === t.id);
      const falta = ['número do termo', 'tipo de instrumento', 'cronograma de desembolso'];
      if (!t.inicio || !t.fim) falta.push('vigência');
      return {
        id: t.id,
        versao: t.versao,
        parceiro: t.parceiro,
        objeto: t.objeto,
        projetoCodigo: t.projeto_origem_codigo,
        valor: emReais(fontes.reduce((s, f) => s + emCentavos(f.valor_inicial ?? 0), 0)),
        origemParadaOuCancelada: !!t.projeto_origem_id && origensComProblema.has(t.projeto_origem_id),
        falta,
      };
    })
    .sort((a, b) => a.parceiro.localeCompare(b.parceiro, 'pt-BR'));
}

export interface TermoParaProjeto {
  termoId: string;
  parceiro: string;
  situacao: 'rascunho' | 'em_vigor' | 'encerrado';
  /** Valor atual do termo (fontes + aportes). */
  valor: number;
  /** Regra 28: o que o projeto mostra a quem tem `parcerias.termos.ver` (sem dados pessoais). */
  inicio: string | null;
  fim: string | null;
  recursosProprios: number | null;
  fontes: {
    nome: string;
    valorAtual: number;
    /** Cronograma de desembolso: mês (AAAA-MM) e valor, já somados os aportes da fonte. */
    cronograma: Parcela[];
    /** Plano de aplicação: categoria e valor. */
    plano: { categoria: string; valor: number }[];
  }[];
}

/** Soma parcelas do mesmo mês (fonte + aportes), em ordem de mês. */
function somarPorMes(ps: readonly Parcela[]): Parcela[] {
  const m = new Map<string, number>();
  for (const x of ps) m.set(x.mes, (m.get(x.mes) ?? 0) + emCentavos(x.valor));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, c]) => ({ mes, valor: emReais(c) }));
}

/**
 * Regras 25 e 28 (parte usada pelo ponto de atenção L10): resumo do termo ligado a um projeto. Passa pelo
 * `Autorizador`: sem `parcerias.termos.ver` para o termo, devolve `null` e o projeto mostra só o vínculo.
 */
export async function termoParaProjeto(p: Planilhas, quem: Autorizador, termoId: string, agora = new Date()): Promise<TermoParaProjeto | null> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) return null;
  const l = await ler(p);
  const t = l.termos.porId(termoId);
  const servicosDe = (id: string) => l.servicos.ativos().filter((s) => s.termo_id === id).map((s) => s.servico);
  if (t && t.ativo) {
    const f = fichaDe(l, t, agora);
    if (!podeVer(quem, f.servicos.map((s) => s.servico))) return null;
    return {
      termoId,
      parceiro: f.parceiro,
      situacao: f.situacao,
      valor: f.valorGlobal,
      inicio: f.inicio,
      fim: f.fim,
      recursosProprios: f.recursosProprios,
      fontes: f.fontes.map((x) => ({
        nome: x.nome,
        valorAtual: x.valorAtual,
        cronograma: somarPorMes([...x.parcelas, ...f.aportes.filter((a) => a.fonteId === x.id).flatMap((a) => a.parcelas)]),
        plano: x.categorias,
      })),
    };
  }
  const r = l.rascunhos.find((x) => x.id === termoId);
  if (!r || !podeVer(quem, servicosDe(r.id))) return null;
  const fontesR = l.fontes.ativos().filter((f) => f.termo_id === r.id);
  const valor = emReais(fontesR.reduce((s, f) => s + emCentavos(f.valor_inicial ?? 0), 0));
  return {
    termoId,
    parceiro: r.parceiro,
    situacao: 'rascunho',
    valor,
    inicio: r.inicio || null,
    fim: r.fim || null,
    recursosProprios: null,
    fontes: fontesR.map((f) => ({
      nome: f.nome,
      valorAtual: f.valor_inicial ?? 0,
      cronograma: somarPorMes(l.parcelas.ativos().filter((x) => x.fonte_id === f.id)),
      plano: l.categorias.ativos().filter((c) => c.fonte_id === f.id).map((c) => ({ categoria: c.categoria, valor: c.valor })),
    })),
  };
}

export async function termosParaOrcamento(p: Planilhas, agora = new Date()): Promise<TermoParaOrcamento[]> {
  const l = await ler(p);
  return l.termos
    .ativos()
    .filter((t) => t.situacao === 'em_vigor')
    .map((t) => {
      const f = fichaDe(l, t, agora);
      return {
        id: f.id,
        parceiro: f.parceiro,
        numero: f.numero,
        tipo: f.tipo,
        inicio: f.inicio,
        fim: f.fim,
        unidadeMeta: f.unidadeMeta,
        unidadePessoa: unidadeEhPessoa(f.unidadeMeta),
        servicos: f.servicos.map((s) => s.servico),
        vagasPorServico: f.servicos.map((s) => ({ servico: s.servico, vagasCusteadas: s.vagasCusteadas, vagasOferecidas: s.vagasOferecidas })),
        recursosProprios: f.recursosProprios,
        equipe: f.equipe,
        fontes: f.fontes.map((x) => ({
          id: x.id,
          nome: x.nome,
          valorAtual: x.valorAtual,
          parcelas: x.parcelas,
          aportesParcelas: f.aportes.filter((a) => a.fonteId === x.id).flatMap((a) => a.parcelas),
          recursosProprios: x.recursosProprios,
          permiteRemanejar: x.permiteRemanejar,
          categorias: x.categorias,
        })),
      };
    });
}

/** Aporte fictício da demonstração: julho a dezembro, 6 parcelas, a primeira maior. */
export async function registrarAporteDemonstracao(p: Planilhas, termoId: string, agora: Date): Promise<void> {
  const l = await ler(p);
  const fonte = l.fontes.ativos().find((f) => f.termo_id === termoId && f.nome === 'Cofinanciamento estadual');
  if (!fonte) return;
  const autoria = { email: 'demonstracao', agora: () => agora };
  const a = await inserir(p, Aportes, { termo_id: termoId, fonte_id: fonte.id, tipo: 'aditivo', registrado_em: '2026-07-01', inicio: '2026-07-01', fim: '2026-12-31', valor: 6000, cronograma: 'digitado', descricao: 'Aditivo (exemplo)' }, autoria);
  const valores = [2000, 800, 800, 800, 800, 800];
  await inserirRegistros(p, l.aporteParcelas, valores.map((valor, i) => ({ aporte_id: a.id, mes: `2026-${String(7 + i).padStart(2, '0')}`, valor })), autoria);
}

// --- agenda única e busca única (ADR-024) ----------------------------------------
const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Fim da vigência e parcelas dos termos em vigor que a pessoa já vê. As parcelas vão sem valor. */
export async function itensDaAgenda(p: Planilhas, quem: Autorizador): Promise<ItemDaAgenda[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) return [];
  const l = await ler(p);
  const itens: ItemDaAgenda[] = [];
  for (const t of l.termos.ativos().filter((x) => x.situacao === 'em_vigor')) {
    const servicos = l.servicos.ativos().filter((s) => s.termo_id === t.id).map((s) => s.servico);
    if (!podeVer(quem, servicos)) continue;
    const href = `/parcerias/${t.id}`;
    const servico = servicos.length === 1 ? servicos[0] : null;
    itens.push({ app: 'parcerias', tipo: 'Fim do termo', titulo: `Fim do termo ${t.numero}`, data: t.fim, ate: null, mes: null, servico, href, vencivel: true });
    for (const f of l.fontes.ativos().filter((x) => x.termo_id === t.id))
      for (const parcela of l.parcelas.ativos().filter((x) => x.fonte_id === f.id)) {
        const [, m] = parcela.mes.split('-').map(Number);
        itens.push({
          app: 'parcerias',
          tipo: 'Parcela',
          titulo: `Parcela de ${f.nome} (${MESES[m] ?? parcela.mes})`,
          data: null,
          ate: null,
          mes: parcela.mes,
          servico,
          href,
          vencivel: false,
        });
      }
  }
  return itens;
}

/** Termos por número, parceiro ou objeto, só os que a pessoa já vê. */
export async function buscar(p: Planilhas, quem: Autorizador, termo: string): Promise<ResultadoDaBusca[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) return [];
  const l = await ler(p);
  return l.termos
    .ativos()
    .filter((t) => [t.numero, t.parceiro, t.objeto].some((c) => contem(c, termo)))
    .filter((t) => podeVer(quem, l.servicos.ativos().filter((s) => s.termo_id === t.id).map((s) => s.servico)))
    .slice(0, MAX_RESULTADOS_POR_APP)
    .map((t) => ({
      app: 'parcerias',
      tipo: 'Termo',
      titulo: `Termo ${t.numero}`,
      apoio: `${t.parceiro} · ${t.situacao === 'em_vigor' ? 'em vigor' : 'encerrado'}`,
      href: `/parcerias/${t.id}`,
    }));
}
