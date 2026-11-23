/**
 * Termo de parceria do projeto financiado (entrega L2, regras L7 a L11 e L14).
 * O Projetos pede a Parcerias o rascunho do termo pela interface `CatalogoTermos`, entregue pela plataforma.
 * A decisão da porta vale mesmo se o rascunho falhar; o botão "Criar rascunho do termo" refaz sem duplicar.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atividades, Projetos, type RegProjeto } from '../dados/tabelas';
import { linhaDoTempo, parcelasDoTermo, prazosDoTermo, type EventoDaLinhaDoTempo, type PrazosDoTermo } from '../dominio/ligacoes';
import { hojeEmBrasilia } from '../dominio/planejamento';
import { ErroProjetos, type ConfigProjetos } from '../dominio/projeto';
import { conteudoDe, podeGerenciar, termoAprovado } from './fases';
import { auditar, autoriaDe, designado, equipesAtivas, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import type { CatalogoTermos, TermoLigado } from './catalogo-parcerias';

export type { CatalogoTermos, TermoLigado, PedidoRascunhoDeTermo } from './catalogo-parcerias';

/** Resultado do pedido de rascunho na decisão da porta 2. */
export type ResultadoRascunho = { estado: 'nao_se_aplica' } | { estado: 'criado' | 'ja_existia'; termoId: string } | { estado: 'falhou'; motivo: string };

/** Quem pode (re)criar o rascunho: quem decide porta ou gerencia o projeto (regra L9). */
export function podeCriarRascunho(quem: Autorizador, r: Pick<RegProjeto, 'responsavel' | 'servico'>, config: ConfigProjetos): boolean {
  const alcada = quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') && designado(config, quem.email, 'alcada');
  return quem.temPermissao('projetos.decidir') || alcada || podeGerenciar(quem, r);
}

const MOTIVO_SEM_PARCERIAS = 'Parcerias não está ativo nesta instituição';

/**
 * Regras L8 e L9: cria (uma única vez) o rascunho do termo em Parcerias a partir do Termo de Abertura aprovado
 * e guarda o vínculo no projeto. Só projeto financiado, com a porta 2 aprovada e andando.
 */
export async function criarRascunhoDoProjeto(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  catalogo: CatalogoTermos | null | undefined,
  opcoes: Opcoes = {},
): Promise<{ termoId: string; criado: boolean }> {
  const agora = opcoes.agora ?? new Date();
  const [tabela] = await lerTabelas(p, [Projetos] as const);
  const r = tabela.porId(projetoId);
  if (!r || !r.ativo) throw new ErroProjetos('Projeto não encontrado.');
  if (!podeCriarRascunho(quem, r, await lerConfig(p))) throw new ErroPermissao('Só quem decide a porta ou gerencia o projeto cria o rascunho do termo.');
  if (r.tipo !== 'financiado') throw new ErroProjetos('Só projeto com financiamento externo tem termo de parceria.');
  if (r.etapa === 'cancelado' || r.etapa === 'parado') throw new ErroProjetos('Projeto cancelado ou parado não cria rascunho de termo.');
  const doc = await termoAprovado(p, r.id);
  if (!doc) throw new ErroProjetos('O rascunho do termo só é criado depois que a porta 2 aprova o Termo de Abertura.');
  if (!catalogo) throw new ErroProjetos(`${MOTIVO_SEM_PARCERIAS}.`);
  const c = conteudoDe(doc);
  const financiador = String(c.financiador ?? '').trim();
  const objeto = String(c.objeto ?? '').trim();
  if (!financiador || !objeto) throw new ErroProjetos('O Termo de Abertura aprovado não tem financiador e objeto.');
  const valor = typeof c.valor_total === 'number' ? c.valor_total : (r.valor_aprovado ?? 0);
  // Falha do app dono (Parcerias) vira erro tratado: a decisão da porta não depende dele.
  const feito = await catalogo
    .criarRascunhoDeTermo(
      { email: quem.email },
      { projetoId: r.id, projetoCodigo: r.codigo, financiador, objeto, servico: r.servico, inicioPrevisto: r.inicio_previsto, fimPrevisto: r.fim_previsto, valorAprovado: valor },
      agora,
    )
    .catch((e: unknown) => {
      throw new ErroProjetos(e instanceof Error ? e.message.replace(/\.$/, '') : 'erro de gravação em Parcerias');
    });
  if (r.termo_id !== feito.termoId) {
    // Relê a versão atual: a decisão da porta pode ter acabado de gravar o projeto.
    const [atual] = await lerTabelas(p, [Projetos] as const);
    const a = atual.porId(r.id)!;
    const { colunasAlteradas } = await atualizar(p, Projetos, a.id, a.versao, { termo_id: feito.termoId, termo_nome: financiador }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Projetos', a.id, colunasAlteradas, agora);
    await registrarHistorico(p, quem, a.id, 'Rascunho do termo criado em Parcerias', 'O Financeiro completa o termo.', agora);
  }
  return feito;
}

/** Chamado pela decisão final de "seguir" na porta 2: nunca lança; a decisão já está gravada (regra L9). */
export async function pedirRascunhoNaDecisao(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoTermos | null | undefined, agora: Date): Promise<ResultadoRascunho> {
  const [tabela] = await lerTabelas(p, [Projetos] as const);
  const r = tabela.porId(projetoId);
  if (!r || r.tipo !== 'financiado') return { estado: 'nao_se_aplica' };
  try {
    const f = await criarRascunhoDoProjeto(p, quem, projetoId, catalogo, { agora });
    return { estado: f.criado ? 'criado' : 'ja_existia', termoId: f.termoId };
  } catch (e) {
    const motivo = e instanceof Error ? e.message.replace(/\.$/, '') : 'erro de gravação';
    try {
      await registrarHistorico(p, quem, projetoId, 'Rascunho do termo não foi criado', motivo, agora);
    } catch {
      // O histórico é só aviso; a decisão continua valendo.
    }
    return { estado: 'falhou', motivo };
  }
}

export interface LigacaoTermo {
  projetoId: string;
  /** Projeto com financiamento externo e porta 2 aprovada: é quando o termo existe ou deve existir. */
  aplica: boolean;
  /** Financiador e objeto do Termo de Abertura aprovado. */
  financiador: string | null;
  objeto: string | null;
  valorAprovado: number | null;
  termo:
    | { estado: 'nenhum' }
    | { estado: 'indisponivel'; nome: string }
    | { estado: 'sem_permissao'; nome: string }
    | { estado: 'ok'; termo: TermoLigado };
  /** Regra L13: só com o termo lido (quem tem `parcerias.termos.ver` no escopo do termo). */
  prazos: PrazosDoTermo | null;
  linhaDoTempo: EventoDaLinhaDoTempo[];
  /** Regra L13: prestação de contas ainda não existe em Parcerias. */
  prazosDePrestacaoDeContas: 'nao_cadastrados';
  /** Regra L10 e L11: só informam, nada é reescrito. */
  pontosDeAtencao: string[];
  /** Mostra o botão "Criar rascunho do termo": aplica, ainda sem termo e a pessoa pode. */
  podeCriarRascunho: boolean;
  /** A decisão aprovou mas o rascunho não existe (falhou): aviso na aba. */
  rascunhoPendente: boolean;
}

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Lê a ligação com o termo para a aba Ligações. Devolve `null` se a pessoa não vê o projeto. */
export async function lerLigacaoTermo(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoTermos | null | undefined, opcoes: Opcoes = {}): Promise<LigacaoTermo | null> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[tabela], config, equipes] = await Promise.all([lerTabelas(p, [Projetos] as const), lerConfig(p), equipesAtivas(p)]);
  const r = tabela.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) return null;
  const doc = r.tipo === 'financiado' ? await termoAprovado(p, r.id) : undefined;
  const conteudo = doc ? conteudoDe(doc) : null;
  const base = {
    projetoId: r.id,
    aplica: !!doc,
    financiador: conteudo ? String(conteudo.financiador ?? '') || null : null,
    objeto: conteudo ? String(conteudo.objeto ?? '') || null : null,
    valorAprovado: r.valor_aprovado,
  };
  const parado = r.etapa === 'cancelado' || r.etapa === 'parado';
  const pontos: string[] = [];
  let termo: LigacaoTermo['termo'] = { estado: 'nenhum' };
  if (r.termo_id) {
    const nome = r.termo_nome ?? 'termo de parceria';
    if (!catalogo) termo = { estado: 'indisponivel', nome };
    else {
      let lido: TermoLigado | null = null;
      try {
        lido = await catalogo.termoParaProjeto(quem, r.termo_id, agora);
      } catch {
        termo = { estado: 'indisponivel', nome };
      }
      if (termo.estado === 'nenhum') {
        if (lido) {
          termo = { estado: 'ok', termo: lido };
          if (r.valor_aprovado !== null && Math.abs(lido.valor - r.valor_aprovado) >= 0.005) {
            pontos.push(`O valor aprovado do projeto (${dinheiro(r.valor_aprovado)}) é diferente do valor do termo (${dinheiro(lido.valor)}).`);
          }
        } else termo = { estado: 'sem_permissao', nome };
      }
    }
    if (parado) pontos.push(`Projeto ${r.etapa === 'cancelado' ? 'cancelado' : 'parado'}: o termo não é apagado. O Financeiro decide se encerra o rascunho.`);
  }
  const semTermo = !r.termo_id;
  let prazos: PrazosDoTermo | null = null;
  let tempo: EventoDaLinhaDoTempo[] = [];
  if (termo.estado === 'ok') {
    const parcelas = parcelasDoTermo(termo.termo.fontes);
    prazos = prazosDoTermo(parcelas, termo.termo.fim, hojeEmBrasilia(agora));
    const [atividades] = await lerTabelas(p, [Atividades] as const);
    tempo = linhaDoTempo(atividades.ativos().filter((a) => a.projeto_id === r.id), parcelas);
  }
  return {
    ...base,
    termo,
    prazos,
    linhaDoTempo: tempo,
    prazosDePrestacaoDeContas: 'nao_cadastrados',
    pontosDeAtencao: pontos,
    podeCriarRascunho: base.aplica && semTermo && !parado && podeCriarRascunho(quem, r, config),
    rascunhoPendente: base.aplica && semTermo && !parado,
  };
}

/** Ids dos projetos cancelados ou parados que têm termo ligado (Parcerias mostra "Projeto de origem cancelado"). Regra L11. */
export async function projetosComTermoParadosOuCancelados(p: Planilhas): Promise<Set<string>> {
  const [tabela] = await lerTabelas(p, [Projetos] as const);
  return new Set(tabela.ativos().filter((r) => !!r.termo_id && (r.etapa === 'cancelado' || r.etapa === 'parado')).map((r) => r.id));
}
