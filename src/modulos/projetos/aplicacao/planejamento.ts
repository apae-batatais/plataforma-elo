/**
 * Fase 3 (entrega P3): atividades com prazos e responsável, e orçamento do projeto.
 * Regra de borda 3: o orçamento do projeto é só o plano do projeto; nada é enviado ao Orçamento da instituição.
 * Textos e valores nunca vão para a auditoria nem para o histórico (só as colunas alteradas).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { Atividades, ProjetoDocumentos, ProjetoOrcamento, type RegAtividade, type RegLinhaOrcamento, type RegProjeto } from '../dados/tabelas';
import {
  andamentoPct,
  conferirPrazos,
  hojeEmBrasilia,
  lerData,
  lerPeso,
  lerValor,
  situacaoExibida,
  SITUACOES_ATIVIDADE,
  subtotaisPorCategoria,
  totalOrcamento,
  type SituacaoAtividade,
  type SituacaoExibida,
} from '../dominio/planejamento';
import { ErroProjetos } from '../dominio/projeto';
import { auditar, autoriaDe, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import { podeGerenciar, projetoParaAlterar, projetoVisivel } from './fases';

// ---------- Atividades ----------

export interface DadosAtividade {
  descricao: string;
  /** E-mail da pessoa responsável. */
  responsavel: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  peso: number | string | null;
}

async function conferirAtividade(p: Planilhas, d: DadosAtividade) {
  const descricao = d.descricao.trim();
  if (!descricao) throw new ErroProjetos('Descreva a atividade.');
  const responsavel = d.responsavel.trim().toLowerCase();
  if (!responsavel) throw new ErroProjetos('Diga quem é a pessoa responsável pela atividade.');
  const [usuarios] = await lerTabelas(p, [Usuarios] as const);
  if (!usuarios.ativos().some((u) => u.email.toLowerCase() === responsavel)) throw new ErroProjetos('Essa pessoa não tem acesso à plataforma.');
  const { inicioPrevisto, fimPrevisto } = conferirPrazos(d.inicioPrevisto, d.fimPrevisto);
  return { descricao, responsavel, inicio_previsto: inicioPrevisto, fim_previsto: fimPrevisto, peso: lerPeso(d.peso) };
}

/** Atividades mudam na fase 3 e na implementação (quem gerencia o projeto). */
const FASES_ATIVIDADES = [3] as const;

async function projetoParaAtividades(p: Planilhas, quem: Autorizador, id: string): Promise<RegProjeto> {
  const r = await projetoVisivel(p, quem, id);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera as atividades.');
  if (r.etapa === 'implementacao') return r;
  return projetoParaAlterar(p, quem, id, [...FASES_ATIVIDADES]);
}

async function atividadeDoProjeto(p: Planilhas, projetoId: string, id: string): Promise<RegAtividade> {
  const [atividades] = await lerTabelas(p, [Atividades] as const);
  const a = atividades.porId(id);
  if (!a || !a.ativo || a.projeto_id !== projetoId) throw new ErroProjetos('Atividade não encontrada.');
  return a;
}

export async function adicionarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosAtividade, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAtividades(p, quem, projetoId);
  const campos = { projeto_id: projetoId, ...(await conferirAtividade(p, d)), inicio_real: null, fim_real: null, situacao: 'a_fazer' as const };
  const nova = await inserir(p, Atividades, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Atividades', nova.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade incluída', null, agora);
}

export async function alterarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, atividadeId: string, versao: number, d: DadosAtividade, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAtividades(p, quem, projetoId);
  await atividadeDoProjeto(p, projetoId, atividadeId);
  const { colunasAlteradas } = await atualizar(p, Atividades, atividadeId, versao, await conferirAtividade(p, d), autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Atividades', atividadeId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade alterada', null, agora);
}

export interface MudancaSituacao {
  situacao: SituacaoAtividade;
  /** Data real de início (AAAA-MM-DD); em branco usa a data de hoje ao iniciar. */
  inicioReal?: string | null;
  /** Data real de término; obrigatória ao concluir (regra 20). */
  fimReal?: string | null;
}

/** Regra 20: concluir exige a data real. Iniciar sem data usa o dia de hoje. */
export async function mudarSituacaoAtividade(p: Planilhas, quem: Autorizador, projetoId: string, atividadeId: string, versao: number, m: MudancaSituacao, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeEmBrasilia(agora);
  await projetoParaAtividades(p, quem, projetoId);
  const a = await atividadeDoProjeto(p, projetoId, atividadeId);
  if (!SITUACOES_ATIVIDADE.includes(m.situacao)) throw new ErroProjetos('Escolha a situação da atividade.');
  let inicio = m.inicioReal?.trim() ? lerData(m.inicioReal, 'Início real') : a.inicio_real;
  let fim: string | null = null;
  if (m.situacao === 'concluida') {
    if (!m.fimReal?.trim()) throw new ErroProjetos('Para concluir a atividade, informe a data em que ela terminou.');
    fim = lerData(m.fimReal, 'Fim real');
    inicio = inicio ?? fim;
    if (fim > hoje) throw new ErroProjetos('A data de término não pode estar no futuro.');
  }
  if (m.situacao === 'em_andamento') inicio = inicio ?? hoje;
  if (m.situacao === 'a_fazer') inicio = null;
  if (inicio && fim && fim < inicio) throw new ErroProjetos('O fim real não pode vir antes do início real.');
  const { colunasAlteradas } = await atualizar(p, Atividades, atividadeId, versao, { situacao: m.situacao, inicio_real: inicio, fim_real: fim }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Atividades', atividadeId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, `Atividade: ${m.situacao.replace('_', ' ')}`, null, agora);
}

/** Nada é apagado: a atividade fica inativa. */
export async function retirarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, atividadeId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAtividades(p, quem, projetoId);
  await atividadeDoProjeto(p, projetoId, atividadeId);
  const { colunasAlteradas } = await atualizar(p, Atividades, atividadeId, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Atividades', atividadeId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade retirada', null, agora);
}

// ---------- Orçamento do projeto ----------

export interface DadosLinhaOrcamento {
  categoria: string;
  descricao: string;
  valor: number | string;
  fonte: string | null;
}

function conferirLinha(d: DadosLinhaOrcamento) {
  const categoria = d.categoria.trim();
  const descricao = d.descricao.trim();
  if (!categoria) throw new ErroProjetos('Diga a categoria da linha (ex.: pessoal, material).');
  if (!descricao) throw new ErroProjetos('Descreva a linha do orçamento.');
  return { categoria, descricao, valor_planejado: lerValor(d.valor), fonte: d.fonte?.trim() || null };
}

/** O orçamento só muda na fase 3; depois da aprovação do plano, mudanças passam por pedido de mudança (P4). */
const projetoParaOrcamento = (p: Planilhas, quem: Autorizador, id: string) => projetoParaAlterar(p, quem, id, [3]);

async function versaoDoTermo(p: Planilhas, projetoId: string): Promise<number | null> {
  const [docs] = await lerTabelas(p, [ProjetoDocumentos] as const);
  const aprovado = docs.ativos().find((d) => d.projeto_id === projetoId && d.tipo === 'termo_abertura' && d.situacao === 'aprovado');
  return aprovado?.numero ?? null;
}

async function linhaDoProjeto(p: Planilhas, projetoId: string, id: string): Promise<RegLinhaOrcamento> {
  const [linhas] = await lerTabelas(p, [ProjetoOrcamento] as const);
  const l = linhas.porId(id);
  if (!l || !l.ativo || l.projeto_id !== projetoId) throw new ErroProjetos('Linha do orçamento não encontrada.');
  return l;
}

export async function adicionarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosLinhaOrcamento, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaOrcamento(p, quem, projetoId);
  const campos = { projeto_id: projetoId, ...conferirLinha(d), versao_termo: await versaoDoTermo(p, projetoId) };
  const nova = await inserir(p, ProjetoOrcamento, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'ProjetoOrcamento', nova.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento incluída', null, agora);
}

export async function alterarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, linhaId: string, versao: number, d: DadosLinhaOrcamento, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaOrcamento(p, quem, projetoId);
  await linhaDoProjeto(p, projetoId, linhaId);
  const { colunasAlteradas } = await atualizar(p, ProjetoOrcamento, linhaId, versao, conferirLinha(d), autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', linhaId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento alterada', null, agora);
}

export async function retirarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, linhaId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaOrcamento(p, quem, projetoId);
  await linhaDoProjeto(p, projetoId, linhaId);
  const { colunasAlteradas } = await atualizar(p, ProjetoOrcamento, linhaId, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', linhaId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento retirada', null, agora);
}

// ---------- Leitura ----------

export interface AtividadeLida extends RegAtividade {
  exibida: SituacaoExibida;
}

export interface Planejamento {
  projeto: RegProjeto;
  atividades: AtividadeLida[];
  andamento: number;
  /** null para quem só está na equipe: a equipe vê o projeto e as atividades, não o orçamento (regra de borda 5). */
  orcamento: { linhas: RegLinhaOrcamento[]; total: number; porCategoria: { categoria: string; total: number }[]; valorAprovado: number | null } | null;
  podeAlterarAtividades: boolean;
  podeAlterarOrcamento: boolean;
}

/** Regra "quem vê o quê": null se a pessoa não vê o projeto. */
export async function lerPlanejamento(p: Planilhas, quem: Autorizador, projetoId: string, opcoes: Opcoes = {}): Promise<Planejamento | null> {
  const hoje = hojeEmBrasilia(opcoes.agora ?? new Date());
  let r: RegProjeto;
  try {
    r = await projetoVisivel(p, quem, projetoId);
  } catch (e) {
    if (e instanceof ErroProjetos) return null;
    throw e;
  }
  const config = await lerConfig(p);
  const [atividades, linhas] = await lerTabelas(p, [Atividades, ProjetoOrcamento] as const);
  const minhas = atividades
    .ativos()
    .filter((a) => a.projeto_id === projetoId)
    .sort((a, b) => a.inicio_previsto.localeCompare(b.inicio_previsto) || a.fim_previsto.localeCompare(b.fim_previsto))
    .map((a) => ({ ...a, exibida: situacaoExibida(a, hoje) }));
  // Sem a equipe na lista, só quem tem outro motivo para ver o projeto vê o orçamento.
  const veOrcamento = podeVerProjeto(quem, r, config, []);
  const doOrcamento = linhas.ativos().filter((l) => l.projeto_id === projetoId);
  const alterar = podeGerenciar(quem, r);
  return {
    projeto: r,
    atividades: minhas,
    andamento: andamentoPct(minhas),
    orcamento: veOrcamento ? { linhas: doOrcamento, total: totalOrcamento(doOrcamento), porCategoria: subtotaisPorCategoria(doOrcamento), valorAprovado: r.valor_aprovado } : null,
    podeAlterarAtividades: alterar && (r.etapa === 'fase_3' || r.etapa === 'implementacao'),
    podeAlterarOrcamento: alterar && r.etapa === 'fase_3',
  };
}
