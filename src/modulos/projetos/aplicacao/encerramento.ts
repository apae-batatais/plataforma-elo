/**
 * Fase 5 (entrega P5): check-list, relatório final, porta de encerramento e lições aprendidas.
 * Textos (relatório, lições) nunca vão para a auditoria nem para o histórico: só as colunas alteradas.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atividades, Encerramento, Licoes, Portas, Problemas, Projetos, type RegEncerramento, type RegLicao, type RegProjeto } from '../dados/tabelas';
import { problemaAberto } from '../dominio/acompanhamento';
import {
  CATEGORIAS_LICAO,
  encerramentoAtrasado,
  ETAPAS_COM_LICAO,
  faltaParaEncerrar,
  ITENS_CHECKLIST,
  ITENS_TEXTO,
  licaoCombina,
  type CategoriaLicao,
  type FiltroLicoes,
  type ItemChecklist,
  type ItemTexto,
} from '../dominio/encerramento';
import { hojeEmBrasilia } from '../dominio/planejamento';
import { ErroProjetos, exigeAlcada, type TipoPorta } from '../dominio/projeto';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import { exigirTermoAprovado, podeGerenciar, projetoVisivel } from './fases';
import { fotografarIndicadores, type NumerosDePessoas } from './indicadores';
import type { LeitorResultado } from './catalogo-orcamento';
import { fotografarResultadoDoEvento } from './resultado-evento';

async function projetoParaEncerrar(p: Planilhas, quem: Autorizador, id: string, etapas: readonly RegProjeto['etapa'][]): Promise<RegProjeto> {
  const r = await projetoVisivel(p, quem, id);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera esta parte.');
  if (!etapas.includes(r.etapa)) throw new ErroProjetos('Esta parte não está disponível na etapa atual do projeto.');
  return r;
}

/** Regra 23: o responsável leva o projeto da implementação para a fase 5. Não exige tudo pronto: isso vale na porta. */
export async function iniciarEncerramento(p: Planilhas, quem: Autorizador, projetoId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaEncerrar(p, quem, projetoId, ['implementacao']);
  if (r.versao !== versao) throw new ErroConflito(projetoId);
  await exigirTermoAprovado(p, projetoId);
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { etapa: 'encerramento', encerramento_iniciado_em: hojeEmBrasilia(agora) }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, 'Encerramento iniciado (fase 5)', null, agora);
}

async function linhaDo(p: Planilhas, projetoId: string, item: string): Promise<RegEncerramento | undefined> {
  const [t] = await lerTabelas(p, [Encerramento] as const);
  return t.ativos().find((x) => x.projeto_id === projetoId && x.item === item);
}

async function gravarItem(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  item: ItemChecklist | ItemTexto,
  campos: { feito: boolean; data: string | null; feito_por: string | null; texto: string | null },
  agora: Date,
): Promise<void> {
  const atual = await linhaDo(p, projetoId, item);
  if (!atual) {
    const novo = await inserir(p, Encerramento, { projeto_id: projetoId, item, ...campos }, autoriaDe(quem, agora));
    await auditar(p, quem, 'inclusao', 'Encerramento', novo.id, ['projeto_id', 'item', ...Object.keys(campos)], agora);
    return;
  }
  const { colunasAlteradas } = await atualizar(p, Encerramento, atual.id, atual.versao, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Encerramento', atual.id, colunasAlteradas, agora);
}

/** Marca ou desmarca um item do check-list (só na fase 5; porta aberta trava). */
export async function marcarChecklist(p: Planilhas, quem: Autorizador, projetoId: string, item: ItemChecklist, feito: boolean, observacao: string | null = null, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!(ITENS_CHECKLIST as readonly string[]).includes(item)) throw new ErroProjetos('Item do check-list desconhecido.');
  await projetoParaEncerrar(p, quem, projetoId, ['encerramento']);
  await gravarItem(p, quem, projetoId, item, { feito, data: feito ? hojeEmBrasilia(agora) : null, feito_por: feito ? quem.email : null, texto: observacao?.trim() || null }, agora);
  await registrarHistorico(p, quem, projetoId, `Check-list de encerramento: ${item} ${feito ? 'feito' : 'reaberto'}`, null, agora);
}

/**
 * Relatório final, transição e sustentabilidade. Na fase 5; o relatório resumido de projeto parado ou
 * cancelado usa o mesmo item `relatorio_final`.
 */
export async function salvarTextoDeEncerramento(p: Planilhas, quem: Autorizador, projetoId: string, item: ItemTexto, texto: string, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!(ITENS_TEXTO as readonly string[]).includes(item)) throw new ErroProjetos('Texto de encerramento desconhecido.');
  const r = await projetoParaEncerrar(p, quem, projetoId, item === 'relatorio_final' ? ['encerramento', 'parado', 'cancelado'] : ['encerramento']);
  void r;
  const t = texto.trim();
  if (item === 'relatorio_final' && !t) throw new ErroProjetos('Escreva o relatório final: o que foi feito, o que foi alcançado e o que ficou.');
  await gravarItem(p, quem, projetoId, item, { feito: t !== '', data: t ? hojeEmBrasilia(agora) : null, feito_por: t ? quem.email : null, texto: t || null }, agora);
  await registrarHistorico(p, quem, projetoId, item === 'relatorio_final' ? 'Relatório final salvo' : `${item === 'transicao' ? 'Transição' : 'Sustentabilidade'} salva`, null, agora);
}

export interface DadosLicao {
  categoria: CategoriaLicao;
  oQueAconteceu: string;
  fazerDiferente: string;
}

/** Regra 24: lição na implementação, no encerramento, e também em projeto parado ou cancelado. */
export async function registrarLicao(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosLicao, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto registra lições.');
  if (!ETAPAS_COM_LICAO.has(r.etapa)) throw new ErroProjetos('Lição só se registra com o projeto em implementação, encerramento, parado ou cancelado.');
  if (!CATEGORIAS_LICAO.includes(d.categoria)) throw new ErroProjetos('Escolha a categoria da lição.');
  if (!d.oQueAconteceu.trim()) throw new ErroProjetos('Conte o que aconteceu.');
  if (!d.fazerDiferente.trim()) throw new ErroProjetos('Diga o que fazer diferente da próxima vez.');
  const campos = { projeto_id: projetoId, categoria: d.categoria, o_que_aconteceu: d.oQueAconteceu.trim(), fazer_diferente: d.fazerDiferente.trim(), registrado_por: quem.email, registrado_em: agora.toISOString() };
  const nova = await inserir(p, Licoes, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Licoes', nova.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Lição aprendida registrada', null, agora);
}

export interface SituacaoEncerramento {
  projeto: RegProjeto;
  checklist: { item: ItemChecklist; feito: boolean; data: string | null; por: string | null; observacao: string | null }[];
  textos: Record<ItemTexto, string>;
  licoes: RegLicao[];
  /** O que falta para abrir a porta de encerramento (lista vazia = pronto). */
  falta: string[];
  atraso: string | null;
  podeAlterar: boolean;
  podeIniciar: boolean;
  podeAbrirPorta: boolean;
  podeRegistrarLicao: boolean;
  /** Relatório resumido de projeto parado ou cancelado. */
  podeSalvarResumo: boolean;
  portaAbertaId: string | null;
}

/** null se a pessoa não vê o projeto. */
export async function lerEncerramento(p: Planilhas, quem: Autorizador, projetoId: string, opcoes: Opcoes = {}): Promise<SituacaoEncerramento | null> {
  const hoje = hojeEmBrasilia(opcoes.agora ?? new Date());
  let r: RegProjeto;
  try {
    r = await projetoVisivel(p, quem, projetoId);
  } catch (e) {
    if (e instanceof ErroProjetos) return null;
    throw e;
  }
  const [linhas, licoes, atividades, problemas, portas] = await lerTabelas(p, [Encerramento, Licoes, Atividades, Problemas, Portas] as const);
  const doProjeto = linhas.ativos().filter((x) => x.projeto_id === projetoId);
  const checklist = ITENS_CHECKLIST.map((item) => {
    const l = doProjeto.find((x) => x.item === item);
    return { item, feito: !!l?.feito, data: l?.data ?? null, por: l?.feito_por ?? null, observacao: l?.texto ?? null };
  });
  const textos = Object.fromEntries(ITENS_TEXTO.map((i) => [i, doProjeto.find((x) => x.item === i)?.texto ?? ''])) as Record<ItemTexto, string>;
  const minhasLicoes = licoes.ativos().filter((x) => x.projeto_id === projetoId).sort((a, b) => b.registrado_em.localeCompare(a.registrado_em));
  const falta = faltaParaEncerrar({
    atividadesAbertas: atividades.ativos().filter((a) => a.projeto_id === projetoId && (a.situacao === 'a_fazer' || a.situacao === 'em_andamento')).length,
    problemasAbertos: problemas.ativos().filter((x) => x.projeto_id === projetoId && problemaAberto(x)).length,
    checklistFaltando: checklist.filter((c) => !c.feito).map((c) => c.item),
    temRelatorioFinal: textos.relatorio_final.trim() !== '',
    licoes: minhasLicoes.length,
  });
  const gerencia = podeGerenciar(quem, r);
  const aberta = portas.ativos().find((x) => x.projeto_id === projetoId && x.tipo === 'encerramento' && x.situacao !== 'decidida');
  return {
    projeto: r,
    checklist,
    textos,
    licoes: minhasLicoes,
    falta,
    atraso: encerramentoAtrasado(r, hoje),
    podeAlterar: gerencia && r.etapa === 'encerramento',
    podeIniciar: gerencia && r.etapa === 'implementacao',
    podeAbrirPorta: gerencia && r.etapa === 'encerramento' && falta.length === 0 && !aberta,
    podeRegistrarLicao: gerencia && ETAPAS_COM_LICAO.has(r.etapa),
    podeSalvarResumo: gerencia && (r.etapa === 'parado' || r.etapa === 'cancelado'),
    portaAbertaId: aberta?.id ?? null,
  };
}

/** Regra 23: abre a porta de encerramento só com tudo pronto. A porta não pede parecer: decide a Diretoria. */
export async function abrirPortaDeEncerramento(p: Planilhas, quem: Autorizador, projetoId: string, versao: number, leitor?: NumerosDePessoas, opcoes: Opcoes & { resultado?: LeitorResultado | null } = {}): Promise<{ portaId: string }> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaEncerrar(p, quem, projetoId, ['encerramento']);
  if (r.versao !== versao) throw new ErroConflito(projetoId);
  const s = await lerEncerramento(p, quem, projetoId, { agora });
  if (!s || s.falta.length > 0) throw new ErroProjetos(`Antes de abrir a porta de encerramento, complete: ${(s?.falta ?? []).join('; ')}.`);
  const config = await lerConfig(p);
  const valor = r.valor_aprovado ?? r.valor_estimado ?? 0;
  const tipo: TipoPorta = 'encerramento';
  const campos = {
    projeto_id: r.id,
    tipo,
    situacao: 'aberta' as const,
    valor_considerado: valor,
    exige_alcada: exigeAlcada(valor, config.limiteAlcada),
    pareceres_exigidos: null,
    aberta_em: agora.toISOString(),
    aberta_por: quem.email,
    resultado: null,
  };
  const porta = await inserir(p, Portas, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Portas', porta.id, Object.keys(campos), agora);
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { etapa: 'em_porta' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, 'Porta de encerramento aberta', campos.exige_alcada ? 'O valor passa do limite: a decisão sobe para a Presidência ou o Conselho.' : null, agora);
  // Ponto de chamada L12: a fotografia dos indicadores do cadastro vai junto do encerramento. Falha não trava a porta.
  try {
    await fotografarIndicadores(p, quem, r.id, 'encerramento', leitor, { agora });
  } catch (e) {
    if (!(e instanceof ErroProjetos)) throw e;
  }
  // Regra L19: o evento de captação ganha a fotografia do resultado; sem Orçamento ou sem permissão, ela fica para a decisão.
  try {
    await fotografarResultadoDoEvento(p, quem, r.id, opcoes.resultado, { agora });
  } catch {
    // A fotografia é um apoio: nunca trava a porta.
  }
  return { portaId: porta.id };
}

export interface LicaoConsultada {
  id: string;
  categoria: CategoriaLicao;
  oQueAconteceu: string;
  fazerDiferente: string;
  registradoEm: string;
  tipo: string;
  porte: string;
  /** Só para quem vê o projeto (regra 24); os demais veem a lição sem identificação. */
  projeto: { id: string; codigo: string; titulo: string } | null;
}

/** Regra 24: consulta para quem tem `projetos.acessar`; o nome do projeto só aparece a quem o vê. */
export async function consultarLicoes(p: Planilhas, quem: Autorizador, filtro: FiltroLicoes = {}): Promise<LicaoConsultada[]> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const config = await lerConfig(p);
  const [[licoes, projetos], equipes] = await Promise.all([lerTabelas(p, [Licoes, Projetos] as const), equipesAtivas(p)]);
  const saida: LicaoConsultada[] = [];
  for (const l of licoes.ativos()) {
    const pr = projetos.porId(l.projeto_id);
    if (!pr || !pr.ativo) continue;
    if (!licaoCombina(l, pr, filtro)) continue;
    const ve = podeVerProjeto(quem, pr, config, equipes.get(pr.id));
    saida.push({
      id: l.id,
      categoria: l.categoria,
      oQueAconteceu: l.o_que_aconteceu,
      fazerDiferente: l.fazer_diferente,
      registradoEm: l.registrado_em,
      tipo: pr.tipo,
      porte: pr.porte,
      projeto: ve ? { id: pr.id, codigo: pr.codigo, titulo: pr.titulo } : null,
    });
  }
  return saida.sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));
}
