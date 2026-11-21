/**
 * Fases 1 e 2 (entrega P2): documentos, marco lógico, riscos, equipe, avanço de fase e Termo de Abertura.
 * O conteúdo dos documentos nunca vai para a auditoria (só as colunas alteradas) nem para o histórico.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { Atividades, MarcoLogico, ProjetoDocumentos, ProjetoEquipe, ProjetoOrcamento, Projetos, Riscos, type RegAtividade, type RegDocumento, type RegEquipe, type RegLinhaOrcamento, type RegMarco, type RegProjeto, type RegRisco } from '../dados/tabelas';
import {
  CAMPOS,
  ehDocumento,
  faseDoDocumento,
  GRAUS,
  itensDaFase,
  NIVEIS_MARCO,
  NIVEL_ACIMA,
  NOME_ITEM,
  pendenciasDoMarco,
  toleranciasDoTermo,
  validarConteudo,
  type ConteudoDocumento,
  type Grau,
  type ItemDaFase,
  type NivelMarco,
  type NumeroFase,
  type TipoDocumento,
  type Tolerancias,
} from '../dominio/fases';
import { ErroProjetos } from '../dominio/projeto';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';

const ehEu = (quem: Autorizador, email: string | null) => !!email && email.toLowerCase() === quem.email.toLowerCase();

/** Quem altera: o responsável (com `projetos.gerenciar`) ou quem gerencia no escopo do serviço do projeto. */
export function podeGerenciar(quem: Autorizador, r: Pick<RegProjeto, 'responsavel' | 'servico'>): boolean {
  if (ehEu(quem, r.responsavel) && quem.temPermissaoAlgumEscopo('projetos.gerenciar')) return true;
  return !!r.servico && quem.temPermissao('projetos.gerenciar', { tipo: 'servico', codigo: r.servico });
}

export async function projetoVisivel(p: Planilhas, quem: Autorizador, id: string): Promise<RegProjeto> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [projetos, config, equipes] = await Promise.all([lerTabelas(p, [Projetos] as const).then(([t]) => t), lerConfig(p), equipesAtivas(p)]);
  const r = projetos.porId(id);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) throw new ErroProjetos('Projeto não encontrado.');
  return r;
}

export async function projetoParaAlterar(p: Planilhas, quem: Autorizador, id: string, fases: NumeroFase[]): Promise<RegProjeto> {
  const r = await projetoVisivel(p, quem, id);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera esta parte.');
  const etapa = r.etapa;
  const ok = fases.some((f) => etapa === `fase_${f}`);
  if (!ok) {
    if (etapa === 'em_porta') throw new ErroProjetos('A porta está aberta: os documentos da fase ficam travados até a decisão.');
    throw new ErroProjetos('Esta parte só pode ser alterada enquanto o projeto está na fase correspondente.');
  }
  return r;
}

// ---------- Documentos ----------

const ultimo = (docs: readonly RegDocumento[]) => [...docs].sort((a, b) => b.numero - a.numero)[0];

export const conteudoDe = (d: RegDocumento): ConteudoDocumento => JSON.parse(d.conteudo) as ConteudoDocumento;

/**
 * Regra 6 e de borda 1: grava o rascunho (ou a marca "pronto"). Documento aprovado fica travado.
 * `versaoDoc` é a versão da linha que a pessoa viu (null se ainda não havia documento).
 */
export async function salvarDocumento(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  tipo: TipoDocumento,
  bruto: Record<string, unknown>,
  pronto: boolean,
  versaoDoc: number | null,
  opcoes: Opcoes = {},
): Promise<void> {
  if (!ehDocumento(tipo)) throw new ErroProjetos('Documento desconhecido.');
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaAlterar(p, quem, projetoId, [faseDoDocumento(tipo)]);
  if (!itensDaFase(r.porte, faseDoDocumento(tipo)).includes(tipo)) throw new ErroProjetos(`O porte ${r.porte} não usa o documento ${NOME_ITEM[tipo].toLowerCase()}.`);
  const conteudo = validarConteudo(tipo, bruto, pronto);
  const [docs] = await lerTabelas(p, [ProjetoDocumentos] as const);
  const atual = ultimo(docs.ativos().filter((d) => d.projeto_id === projetoId && d.tipo === tipo));
  if (atual?.situacao === 'aprovado') throw new ErroProjetos('Este documento já foi aprovado e está travado. Mudanças passam por pedido de mudança.');
  const json = JSON.stringify(conteudo);
  if (!atual) {
    const campos = { projeto_id: projetoId, tipo, numero: 1, conteudo: json, situacao: 'rascunho' as const, pronto };
    const novo = await inserir(p, ProjetoDocumentos, campos, autoriaDe(quem, agora));
    await auditar(p, quem, 'inclusao', 'ProjetoDocumentos', novo.id, Object.keys(campos), agora);
  } else {
    if (versaoDoc !== null && atual.versao !== versaoDoc) throw new ErroConflito(atual.id);
    const { colunasAlteradas } = await atualizar(p, ProjetoDocumentos, atual.id, atual.versao, { conteudo: json, pronto }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'ProjetoDocumentos', atual.id, colunasAlteradas, agora);
  }
  await registrarHistorico(p, quem, projetoId, pronto ? `${NOME_ITEM[tipo]} marcado como pronto` : `${NOME_ITEM[tipo]} salvo como rascunho`, null, agora);
}

// ---------- Marco lógico ----------

export interface DadosItemMarco {
  nivel: NivelMarco;
  descricao: string;
  indicador: string | null;
  fonteVerificacao: string | null;
  pressuposto: string | null;
  acima: string | null;
}

async function conferirItem(p: Planilhas, projetoId: string, d: DadosItemMarco, proprioId: string | null) {
  if (!NIVEIS_MARCO.includes(d.nivel)) throw new ErroProjetos('Escolha o nível do item.');
  const descricao = d.descricao.trim();
  if (!descricao) throw new ErroProjetos('Descreva o item.');
  const [itens] = await lerTabelas(p, [MarcoLogico] as const);
  const doProjeto = itens.ativos().filter((i) => i.projeto_id === projetoId);
  const esperado = NIVEL_ACIMA[d.nivel];
  const acima = d.acima?.trim() || null;
  if (esperado) {
    if (!acima) throw new ErroProjetos(`Escolha o item de ${esperado} a que este pertence.`);
    const pai = doProjeto.find((i) => i.id === acima);
    if (!pai || pai.nivel !== esperado) throw new ErroProjetos(`O item precisa apontar para um item de ${esperado}.`);
    if (acima === proprioId) throw new ErroProjetos('Um item não pode apontar para ele mesmo.');
  }
  return { doProjeto, descricao, acima: esperado ? acima : null };
}

export async function adicionarItemMarco(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosItemMarco, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [1, 2]);
  const { doProjeto, descricao, acima } = await conferirItem(p, projetoId, d, null);
  const campos = {
    projeto_id: projetoId,
    nivel: d.nivel,
    ordem: doProjeto.filter((i) => i.nivel === d.nivel).length + 1,
    descricao,
    indicador: d.indicador?.trim() || null,
    fonte_verificacao: d.fonteVerificacao?.trim() || null,
    pressuposto: d.pressuposto?.trim() || null,
    acima,
  };
  const novo = await inserir(p, MarcoLogico, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'MarcoLogico', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Item do marco lógico incluído', null, agora);
}

export async function alterarItemMarco(p: Planilhas, quem: Autorizador, projetoId: string, itemId: string, versao: number, d: DadosItemMarco, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [1, 2]);
  const { doProjeto, descricao, acima } = await conferirItem(p, projetoId, d, itemId);
  const atual = doProjeto.find((i) => i.id === itemId);
  if (!atual) throw new ErroProjetos('Item não encontrado.');
  if (atual.nivel !== d.nivel && doProjeto.some((i) => i.acima === itemId)) throw new ErroProjetos('Outros itens apontam para este: troque-os antes de mudar o nível.');
  const { colunasAlteradas } = await atualizar(
    p,
    MarcoLogico,
    itemId,
    versao,
    { nivel: d.nivel, descricao, indicador: d.indicador?.trim() || null, fonte_verificacao: d.fonteVerificacao?.trim() || null, pressuposto: d.pressuposto?.trim() || null, acima },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'alteracao', 'MarcoLogico', itemId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Item do marco lógico alterado', null, agora);
}

/** Nada é apagado: o item fica inativo. Item que tem outros apontando para ele não sai. */
export async function retirarItemMarco(p: Planilhas, quem: Autorizador, projetoId: string, itemId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [1, 2]);
  const [itens] = await lerTabelas(p, [MarcoLogico] as const);
  const doProjeto = itens.ativos().filter((i) => i.projeto_id === projetoId);
  if (!doProjeto.some((i) => i.id === itemId)) throw new ErroProjetos('Item não encontrado.');
  if (doProjeto.some((i) => i.acima === itemId)) throw new ErroProjetos('Outros itens apontam para este: retire ou mude esses antes.');
  const { colunasAlteradas } = await atualizar(p, MarcoLogico, itemId, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'MarcoLogico', itemId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Item do marco lógico retirado', null, agora);
}

// ---------- Riscos ----------

export interface DadosRisco {
  descricao: string;
  probabilidade: Grau;
  impacto: Grau;
  resposta: string | null;
  dono: string | null;
}

function conferirRisco(d: DadosRisco) {
  if (!d.descricao.trim()) throw new ErroProjetos('Descreva o risco.');
  if (!GRAUS.includes(d.probabilidade)) throw new ErroProjetos('Escolha a probabilidade.');
  if (!GRAUS.includes(d.impacto)) throw new ErroProjetos('Escolha o impacto.');
  return { descricao: d.descricao.trim(), probabilidade: d.probabilidade, impacto: d.impacto, resposta: d.resposta?.trim() || null, dono: d.dono?.trim().toLowerCase() || null };
}

export async function registrarRisco(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosRisco, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [1, 2]);
  const campos = { projeto_id: projetoId, ...conferirRisco(d), situacao: 'aberto' as const };
  const novo = await inserir(p, Riscos, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Riscos', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Risco registrado', null, agora);
}

export async function encerrarRisco(p: Planilhas, quem: Autorizador, projetoId: string, riscoId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [1, 2]);
  const [riscos] = await lerTabelas(p, [Riscos] as const);
  const r = riscos.porId(riscoId);
  if (!r || !r.ativo || r.projeto_id !== projetoId) throw new ErroProjetos('Risco não encontrado.');
  const { colunasAlteradas } = await atualizar(p, Riscos, riscoId, versao, { situacao: 'encerrado' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Riscos', riscoId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Risco encerrado', null, agora);
}

// ---------- Equipe ----------

/** Regra de borda 5: a equipe só vê o projeto; quem gerencia inclui e encerra a participação. */
export async function adicionarMembro(p: Planilhas, quem: Autorizador, projetoId: string, email: string, funcao: string, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera a equipe.');
  if (r.etapa === 'cancelado' || r.etapa === 'parado') throw new ErroProjetos('O projeto não está andando.');
  const e = email.trim().toLowerCase();
  if (!funcao.trim()) throw new ErroProjetos('Diga a função da pessoa no projeto.');
  const [usuarios, equipe] = await Promise.all([lerTabelas(p, [Usuarios] as const).then(([t]) => t), lerTabelas(p, [ProjetoEquipe] as const).then(([t]) => t)]);
  if (!usuarios.ativos().some((u) => u.email.toLowerCase() === e)) throw new ErroProjetos('Essa pessoa não tem acesso à plataforma.');
  if (equipe.ativos().some((m) => m.projeto_id === projetoId && m.email === e && !m.fim)) throw new ErroProjetos('Essa pessoa já está na equipe.');
  const campos = { projeto_id: projetoId, email: e, funcao: funcao.trim(), inicio: agora.toISOString().slice(0, 10) };
  const novo = await inserir(p, ProjetoEquipe, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'ProjetoEquipe', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Pessoa incluída na equipe', e, agora);
}

export async function encerrarMembro(p: Planilhas, quem: Autorizador, projetoId: string, membroId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera a equipe.');
  const [equipe] = await lerTabelas(p, [ProjetoEquipe] as const);
  const m = equipe.porId(membroId);
  if (!m || !m.ativo || m.projeto_id !== projetoId || m.fim) throw new ErroProjetos('Participação não encontrada.');
  const { colunasAlteradas } = await atualizar(p, ProjetoEquipe, membroId, versao, { fim: agora.toISOString().slice(0, 10) }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoEquipe', membroId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Pessoa saiu da equipe', m.email, agora);
}

// ---------- Leitura da fase atual ----------

export interface ItemSituacao {
  item: ItemDaFase;
  nome: string;
  pronto: boolean;
  /** O que falta, em palavras (marco lógico e riscos). */
  falta: string[];
}

export interface Fase {
  projeto: RegProjeto;
  /** Fase em andamento (1 ou 2), ou null quando o projeto está fora delas. */
  fase: NumeroFase | null;
  itens: ItemSituacao[];
  documentos: Partial<Record<TipoDocumento, RegDocumento>>;
  marco: RegMarco[];
  riscos: RegRisco[];
  equipe: RegEquipe[];
  atividades: RegAtividade[];
  orcamento: RegLinhaOrcamento[];
  tolerancias: Tolerancias | null;
  podeAlterar: boolean;
  /** Pode avançar da fase 1 para a 2 (tudo pronto). */
  podeAvancar: boolean;
  /** Pode abrir a porta 2 (fase 2 com tudo pronto). */
  podeAbrirPorta2: boolean;
  /** Pode abrir a porta 3 (fase 3 pronta, porte completo). */
  podeAbrirPorta3: boolean;
  /** Pode iniciar a implementação direto (fase 3 pronta, porte enxuto: a porta 3 fica desligada). */
  podeIniciarImplementacao: boolean;
}

export function situacaoDosItens(
  porte: RegProjeto['porte'],
  fase: NumeroFase,
  docs: readonly RegDocumento[],
  marco: readonly RegMarco[],
  riscos: readonly RegRisco[],
  atividades: readonly RegAtividade[] = [],
  orcamento: readonly RegLinhaOrcamento[] = [],
): ItemSituacao[] {
  return itensDaFase(porte, fase).map((item) => {
    if (item === 'atividades') {
      const abertas = atividades.filter((a) => a.situacao !== 'cancelada');
      const ok = abertas.length > 0;
      return { item, nome: NOME_ITEM[item], pronto: ok, falta: ok ? [] : ['Cadastre ao menos uma atividade, com datas e responsável.'] };
    }
    if (item === 'orcamento') {
      const ok = orcamento.length > 0;
      return { item, nome: NOME_ITEM[item], pronto: ok, falta: ok ? [] : ['Inclua ao menos uma linha no orçamento do projeto.'] };
    }
    if (item === 'marco_logico') {
      const falta = pendenciasDoMarco(marco.map((m) => ({ id: m.id, nivel: m.nivel, descricao: m.descricao, indicador: m.indicador, fonte_verificacao: m.fonte_verificacao, acima: m.acima })));
      return { item, nome: NOME_ITEM[item], pronto: falta.length === 0, falta };
    }
    if (item === 'riscos') {
      const ok = riscos.length > 0;
      return { item, nome: NOME_ITEM[item], pronto: ok, falta: ok ? [] : ['Registre ao menos um risco.'] };
    }
    const d = ultimo(docs.filter((x) => x.tipo === item));
    const pronto = !!d && (d.pronto || d.situacao === 'aprovado');
    return { item, nome: NOME_ITEM[item], pronto, falta: pronto ? [] : [d ? 'Falta marcar como pronto.' : 'Ainda não preenchido.'] };
  });
}

/** Lê a fase do projeto (regra "quem vê o quê": quem não vê o projeto não vê nada). */
export async function lerFase(p: Planilhas, quem: Autorizador, projetoId: string): Promise<Fase | null> {
  let r: RegProjeto;
  try {
    r = await projetoVisivel(p, quem, projetoId);
  } catch (e) {
    if (e instanceof ErroProjetos) return null;
    throw e;
  }
  const [docs, marco, riscos, equipe, atividades, orcamento] = await lerTabelas(p, [ProjetoDocumentos, MarcoLogico, Riscos, ProjetoEquipe, Atividades, ProjetoOrcamento] as const);
  const meusDocs = docs.ativos().filter((d) => d.projeto_id === projetoId);
  const meuMarco = marco.ativos().filter((m) => m.projeto_id === projetoId).sort((a, b) => NIVEIS_MARCO.indexOf(a.nivel) - NIVEIS_MARCO.indexOf(b.nivel) || a.ordem - b.ordem);
  const meusRiscos = riscos.ativos().filter((x) => x.projeto_id === projetoId);
  const minhasAtividades = atividades.ativos().filter((a) => a.projeto_id === projetoId).sort((a, b) => a.inicio_previsto.localeCompare(b.inicio_previsto) || a.fim_previsto.localeCompare(b.fim_previsto));
  const meuOrcamento = orcamento.ativos().filter((l) => l.projeto_id === projetoId);
  const fase: NumeroFase | null = r.etapa === 'fase_1' ? 1 : r.etapa === 'fase_2' ? 2 : r.etapa === 'fase_3' ? 3 : null;
  const itens = fase ? situacaoDosItens(r.porte, fase, meusDocs, meuMarco, meusRiscos, minhasAtividades, meuOrcamento) : [];
  const documentos: Fase['documentos'] = {};
  for (const t of new Set(meusDocs.map((d) => d.tipo))) if (ehDocumento(t as ItemDaFase)) documentos[t as TipoDocumento] = ultimo(meusDocs.filter((d) => d.tipo === t));
  const termo = documentos.termo_abertura;
  const tudo = itens.every((i) => i.pronto);
  const alterar = podeGerenciar(quem, r);
  return {
    projeto: r,
    fase,
    itens,
    documentos,
    marco: meuMarco,
    riscos: meusRiscos,
    equipe: equipe.ativos().filter((m) => m.projeto_id === projetoId),
    atividades: minhasAtividades,
    orcamento: meuOrcamento,
    tolerancias: termo ? toleranciasDoTermo(conteudoDe(termo)) : null,
    podeAlterar: alterar,
    podeAvancar: alterar && fase === 1 && tudo,
    podeAbrirPorta2: alterar && ehEu(quem, r.responsavel) && fase === 2 && tudo,
    podeAbrirPorta3: alterar && ehEu(quem, r.responsavel) && fase === 3 && tudo && r.porte === 'completo',
    podeIniciarImplementacao: alterar && ehEu(quem, r.responsavel) && fase === 3 && tudo && r.porte === 'enxuto',
  };
}

/** Preenche o Termo de Abertura com o que já existe: proposta, estimativas e tolerâncias padrão (melhoria de uso). */
export async function termoPreenchido(p: Planilhas, quem: Autorizador, projetoId: string): Promise<ConteudoDocumento> {
  const f = await lerFase(p, quem, projetoId);
  if (!f) throw new ErroProjetos('Projeto não encontrado.');
  if (f.documentos.termo_abertura) return conteudoDe(f.documentos.termo_abertura);
  const config = await lerConfig(p);
  const proposta = f.documentos.proposta ? conteudoDe(f.documentos.proposta) : {};
  const estimativas = f.documentos.estimativas ? conteudoDe(f.documentos.estimativas) : {};
  const t = config.tolerancias;
  const base: ConteudoDocumento = Object.fromEntries(CAMPOS.termo_abertura.map((c) => [c.nome, null]));
  return {
    ...base,
    objetivo: f.projeto.titulo,
    escopo: (proposta.descricao as string | undefined) ?? f.projeto.resumo,
    valor_total: (estimativas.valor_total as number | undefined) ?? f.projeto.valor_estimado,
    tolerancia_custo_linha: t.custoLinhaPct,
    tolerancia_custo_total: t.custoTotalPct,
    tolerancia_prazo_fim: t.prazoFimDias,
    tolerancia_prazo_marco: t.prazoMarcoDias,
  };
}

/** Do fim da fase 1 para a fase 2: só com todos os itens da fase 1 prontos. */
export async function avancarFase(p: Planilhas, quem: Autorizador, projetoId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaAlterar(p, quem, projetoId, [1]);
  if (r.versao !== versao) throw new ErroConflito(projetoId);
  const f = await lerFase(p, quem, projetoId);
  const falta = f?.itens.filter((i) => !i.pronto) ?? [];
  if (falta.length > 0) throw new ErroProjetos(`Ainda falta na fase 1: ${falta.map((i) => i.nome.toLowerCase()).join(', ')}.`);
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { etapa: 'fase_2' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, 'Fase 1 concluída: o projeto passa para a fase 2', null, agora);
}

// ---------- Termo de Abertura aprovado (regra 13) ----------

export async function termoAprovado(p: Planilhas, projetoId: string): Promise<RegDocumento | undefined> {
  const [docs] = await lerTabelas(p, [ProjetoDocumentos] as const);
  return ultimo(docs.ativos().filter((d) => d.projeto_id === projetoId && d.tipo === 'termo_abertura' && d.situacao === 'aprovado'));
}

/**
 * Regra 13: nenhum projeto entra em implementação (nem lança relatório) sem Termo de Abertura aprovado.
 * As entregas seguintes chamam isto antes de iniciar a implementação.
 */
export async function exigirTermoAprovado(p: Planilhas, projetoId: string): Promise<RegDocumento> {
  const d = await termoAprovado(p, projetoId);
  if (!d) throw new ErroProjetos('Sem Termo de Abertura aprovado, o projeto não pode começar a implementação.');
  return d;
}

/** Chamado pela decisão final de "seguir" na porta 2: aprova a última versão do Termo e grava o valor aprovado. */
export async function aprovarTermo(p: Planilhas, quem: Autorizador, projetoId: string, agora: Date): Promise<void> {
  const [docs, projetos] = await lerTabelas(p, [ProjetoDocumentos, Projetos] as const);
  const doTermo = docs.ativos().filter((d) => d.projeto_id === projetoId && d.tipo === 'termo_abertura');
  const novo = ultimo(doTermo.filter((d) => d.situacao === 'rascunho'));
  if (!novo) throw new ErroProjetos('Não há Termo de Abertura para aprovar.');
  for (const antigo of doTermo.filter((d) => d.situacao === 'aprovado')) {
    const { colunasAlteradas } = await atualizar(p, ProjetoDocumentos, antigo.id, antigo.versao, { situacao: 'substituido' }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'ProjetoDocumentos', antigo.id, colunasAlteradas, agora);
  }
  const { colunasAlteradas } = await atualizar(p, ProjetoDocumentos, novo.id, novo.versao, { situacao: 'aprovado' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoDocumentos', novo.id, colunasAlteradas, agora);
  const total = conteudoDe(novo).valor_total;
  const projeto = projetos.porId(projetoId)!;
  const r = await atualizar(p, Projetos, projetoId, projeto.versao, { valor_aprovado: typeof total === 'number' ? total : null }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', projetoId, r.colunasAlteradas, agora);
}
