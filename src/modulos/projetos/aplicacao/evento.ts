/**
 * Receita do evento de captação no Orçamento (regras L17 e L21).
 * Na porta 2 com `seguir`, a meta de receita entra no Orçamento como Receita "A captar" na fonte própria escolhida.
 * A decisão da porta nunca falha por causa da receita: se o Orçamento recusar, a ligação fica pendente e visível,
 * e quem decide a porta ou gerencia o projeto refaz pelo botão. Cancelado ou parado encerra o item e a ligação.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { LigacoesProjeto, Projetos, type RegProjeto } from '../dados/tabelas';
import { ErroProjetos, type Etapa } from '../dominio/projeto';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import type { CatalogoReceitas } from './catalogo-orcamento';
import { termoAprovado } from './fases';
import { podeCriarRascunho } from './termo';

/** Etapas em que a porta 2 já foi aprovada e o projeto segue andando. */
const ETAPAS_DEPOIS_DA_PORTA_2: ReadonlySet<Etapa> = new Set<Etapa>(['fase_3', 'implementacao', 'encerramento', 'encerrado']);

export type ResultadoReceita = { estado: 'nao_se_aplica' } | { estado: 'criada' | 'ja_existia'; receitaId: string } | { estado: 'pendente'; motivo: string };

const motivoDe = (e: unknown, padrao = 'erro de gravação no Orçamento') => (e instanceof Error ? e.message.replace(/\.$/, '') : padrao);

async function ligacaoDaReceita(p: Planilhas, projetoId: string) {
  const [ligacoes] = await lerTabelas(p, [LigacoesProjeto] as const);
  return ligacoes.ativos().find((l) => l.projeto_id === projetoId && l.app === 'fonte_receita');
}

/** Cria (ou confirma) o item de receita e guarda a ligação. Lança erro em português se não der. */
async function criarReceita(p: Planilhas, quem: Autorizador, r: RegProjeto, catalogo: CatalogoReceitas | null | undefined, agora: Date): Promise<{ receitaId: string; criada: boolean }> {
  if (r.tipo !== 'captacao') throw new ErroProjetos('Só evento de captação tem receita no Orçamento.');
  if (!catalogo) throw new ErroProjetos('O Orçamento não está ativo nesta instituição.');
  if (!r.fonte_receita_id) throw new ErroProjetos('Peça ao Financeiro para cadastrar a fonte do evento e escolha a fonte na ficha do evento.');
  if (!r.data_evento || !r.meta_receita) throw new ErroProjetos('O evento precisa de data e meta de receita.');
  const feito = await catalogo.registrarReceita(
    { email: quem.email },
    { projetoId: r.id, projetoCodigo: r.codigo, titulo: r.titulo, fonteId: r.fonte_receita_id, valor: r.meta_receita, dataEvento: r.data_evento },
  );
  const existente = await ligacaoDaReceita(p, r.id);
  if (existente?.referencia_id !== feito.receitaId) {
    if (existente) {
      const { colunasAlteradas } = await atualizar(p, LigacoesProjeto, existente.id, existente.versao, { ativo: false }, autoriaDe(quem, agora));
      await auditar(p, quem, 'alteracao', 'LigacoesProjeto', existente.id, colunasAlteradas, agora);
    }
    const campos = { projeto_id: r.id, app: 'fonte_receita' as const, referencia_id: feito.receitaId, nome: r.fonte_receita_nome ?? 'Fonte de receita', ligado_em: agora.toISOString() };
    const nova = await inserir(p, LigacoesProjeto, campos, autoriaDe(quem, agora));
    await auditar(p, quem, 'inclusao', 'LigacoesProjeto', nova.id, Object.keys(campos), agora);
    await registrarHistorico(p, quem, r.id, 'Receita "A captar" lançada no Orçamento', null, agora);
  }
  return feito;
}

/** Chamado pela decisão final de "seguir" na porta 2: nunca lança; a decisão já está gravada (regra L17). */
export async function pedirReceitaNaDecisao(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoReceitas | null | undefined, agora: Date): Promise<ResultadoReceita> {
  const [tabela] = await lerTabelas(p, [Projetos] as const);
  const r = tabela.porId(projetoId);
  if (!r || r.tipo !== 'captacao') return { estado: 'nao_se_aplica' };
  try {
    const f = await criarReceita(p, quem, r, catalogo, agora);
    return { estado: f.criada ? 'criada' : 'ja_existia', receitaId: f.receitaId };
  } catch (e) {
    const motivo = motivoDe(e);
    try {
      await registrarHistorico(p, quem, projetoId, 'Receita do evento não entrou no Orçamento', motivo, agora);
    } catch {
      // O histórico é só aviso; a decisão continua valendo.
    }
    return { estado: 'pendente', motivo };
  }
}

/** Botão "Lançar receita no Orçamento": quem decide a porta ou gerencia o projeto refaz sem duplicar. */
export async function lancarReceitaDoEvento(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoReceitas | null | undefined, opcoes: Opcoes & { fonteId?: string | null } = {}): Promise<{ receitaId: string; criada: boolean }> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[tabela], config, equipes] = await Promise.all([lerTabelas(p, [Projetos] as const), lerConfig(p), equipesAtivas(p)]);
  const r = tabela.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) throw new ErroProjetos('Projeto não encontrado.');
  if (!podeCriarRascunho(quem, r, config)) throw new ErroPermissao('Só quem decide a porta ou gerencia o projeto lança a receita.');
  if (!ETAPAS_DEPOIS_DA_PORTA_2.has(r.etapa) || !(await termoAprovado(p, r.id))) throw new ErroProjetos('A receita só entra no Orçamento depois que a porta 2 aprova o Termo de Abertura.');
  let alvo = r;
  const fonteId = opcoes.fonteId?.trim();
  if (fonteId && fonteId !== r.fonte_receita_id) {
    // Escolha tardia da fonte (a porta 2 abriu sem fonte própria cadastrada): confere contra o Orçamento e guarda o nome.
    const fontes = await catalogo?.fontesProprias(quem).catch(() => null);
    const f = fontes?.find((x) => x.id === fonteId);
    if (!f) throw new ErroProjetos('Escolha a fonte de receita da lista.');
    const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { fonte_receita_id: f.id, fonte_receita_nome: f.nome }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
    alvo = { ...r, versao: r.versao + 1, fonte_receita_id: f.id, fonte_receita_nome: f.nome };
  }
  try {
    return await criarReceita(p, quem, alvo, catalogo, agora);
  } catch (e) {
    if (e instanceof ErroProjetos || e instanceof ErroPermissao) throw e;
    throw new ErroProjetos(motivoDe(e));
  }
}

/** Projeto cancelado ou parado: encerra o item no Orçamento e a ligação. Nunca lança; o histórico conta o que houve. */
export async function encerrarReceitaDoEvento(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoReceitas | null | undefined, agora: Date): Promise<void> {
  const [tabela] = await lerTabelas(p, [Projetos] as const);
  const r = tabela.porId(projetoId);
  if (!r || r.tipo !== 'captacao') return;
  const ligacao = await ligacaoDaReceita(p, projetoId);
  if (!ligacao) return;
  try {
    if (!catalogo) throw new ErroProjetos('O Orçamento não está ativo nesta instituição.');
    await catalogo.encerrarReceita({ email: quem.email }, projetoId);
    const { colunasAlteradas } = await atualizar(p, LigacoesProjeto, ligacao.id, ligacao.versao, { ativo: false }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'LigacoesProjeto', ligacao.id, colunasAlteradas, agora);
    await registrarHistorico(p, quem, projetoId, 'Receita do evento encerrada no Orçamento', null, agora);
  } catch (e) {
    try {
      await registrarHistorico(p, quem, projetoId, 'Receita do evento continua no Orçamento', `${motivoDe(e)}. O Financeiro precisa cancelar o item.`, agora);
    } catch {
      // O histórico é só aviso.
    }
  }
}

export interface LigacaoEvento {
  projetoId: string;
  /** Evento de captação: só ele tem esta parte da aba. */
  aplica: boolean;
  serie: string | null;
  dataEvento: string | null;
  metaReceita: number | null;
  fonteNome: string | null;
  /**
   * `lancada`: item no Orçamento; `pendente`: porta 2 aprovada e item ainda não existe;
   * `aguardando`: a porta 2 ainda não foi aprovada.
   */
  receita: 'lancada' | 'pendente' | 'aguardando';
  /** Por que está pendente, em palavras. */
  motivoPendente: string | null;
  podeLancar: boolean;
}

/** Lê a parte do evento para a aba Ligações. Devolve `null` se a pessoa não vê o projeto. */
export async function lerLigacaoEvento(p: Planilhas, quem: Autorizador, projetoId: string, catalogoOrcamento: CatalogoReceitas | null | undefined): Promise<LigacaoEvento | null> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[tabela], config, equipes] = await Promise.all([lerTabelas(p, [Projetos] as const), lerConfig(p), equipesAtivas(p)]);
  const r = tabela.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) return null;
  const base = { projetoId: r.id, serie: r.serie_evento, dataEvento: r.data_evento, metaReceita: r.meta_receita, fonteNome: r.fonte_receita_nome };
  if (r.tipo !== 'captacao') return { ...base, aplica: false, receita: 'aguardando', motivoPendente: null, podeLancar: false };
  const depois = ETAPAS_DEPOIS_DA_PORTA_2.has(r.etapa);
  if (!depois) return { ...base, aplica: true, receita: 'aguardando', motivoPendente: null, podeLancar: false };
  const ligacao = await ligacaoDaReceita(p, r.id);
  if (ligacao) return { ...base, aplica: true, receita: 'lancada', motivoPendente: null, podeLancar: false };
  const motivo = !r.fonte_receita_id
    ? 'Peça ao Financeiro para cadastrar a fonte do evento.'
    : !catalogoOrcamento
      ? 'O Orçamento não está ativo nesta instituição.'
      : 'A receita ainda não entrou no Orçamento.';
  return { ...base, aplica: true, receita: 'pendente', motivoPendente: motivo, podeLancar: podeCriarRascunho(quem, r, config) && !!catalogoOrcamento };
}
