/**
 * Fase 3 (entrega P3): atividades com datas e responsável, orçamento do projeto e início da implementação.
 * Planejamento (descrição, datas previstas, orçamento) só muda na fase 3 e sem porta aberta; o andamento
 * (situação e datas reais) também pode ser lançado na implementação. Nada é apagado.
 * Orçamento do projeto é separado do Orçamento da instituição (regra de borda 3): nada é enviado para lá.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { Atividades, ProjetoOrcamento, Projetos } from '../dados/tabelas';
import {
  conferirAndamento,
  conferirLinhaOrcamento,
  conferirPlanoAtividade,
  hojeEm,
  totalOrcamento,
  type DadosAndamento,
  type DadosLinhaOrcamento,
  type DadosPlanoAtividade,
} from '../dominio/planejamento';
import { ErroProjetos } from '../dominio/projeto';
import { auditar, autoriaDe, registrarHistorico, type Opcoes } from './comum';
import { exigirTermoAprovado, lerFase, podeGerenciar, projetoParaAlterar, projetoVisivel } from './fases';

async function exigirPessoaDaPlataforma(p: Planilhas, email: string) {
  const [usuarios] = await lerTabelas(p, [Usuarios] as const);
  if (!usuarios.ativos().some((u) => u.email.toLowerCase() === email)) throw new ErroProjetos('Essa pessoa não tem acesso à plataforma.');
}

// ---------- Atividades ----------

export async function adicionarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosPlanoAtividade, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  const v = conferirPlanoAtividade(d);
  await exigirPessoaDaPlataforma(p, v.responsavel);
  const campos = { projeto_id: projetoId, descricao: v.descricao, responsavel: v.responsavel, inicio_previsto: v.inicioPrevisto, fim_previsto: v.fimPrevisto, situacao: 'a_fazer' as const, peso: v.peso };
  const nova = await inserir(p, Atividades, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Atividades', nova.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade incluída', null, agora);
}

async function atividadeDoProjeto(p: Planilhas, projetoId: string, id: string) {
  const [atividades] = await lerTabelas(p, [Atividades] as const);
  const a = atividades.porId(id);
  if (!a || !a.ativo || a.projeto_id !== projetoId) throw new ErroProjetos('Atividade não encontrada.');
  return a;
}

export async function alterarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, id: string, versao: number, d: DadosPlanoAtividade, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  const v = conferirPlanoAtividade(d);
  await atividadeDoProjeto(p, projetoId, id);
  await exigirPessoaDaPlataforma(p, v.responsavel);
  const { colunasAlteradas } = await atualizar(
    p,
    Atividades,
    id,
    versao,
    { descricao: v.descricao, responsavel: v.responsavel, inicio_previsto: v.inicioPrevisto, fim_previsto: v.fimPrevisto, peso: v.peso },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'alteracao', 'Atividades', id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade alterada', null, agora);
}

/** Regra 20: situação e datas reais. Concluir exige a data real de fim. Vale na fase 3 e na implementação. */
export async function lancarAndamento(p: Planilhas, quem: Autorizador, projetoId: string, id: string, versao: number, d: DadosAndamento, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera as atividades.');
  if (r.etapa === 'em_porta') throw new ErroProjetos('A porta está aberta: o planejamento fica travado até a decisão.');
  if (r.etapa !== 'fase_3' && r.etapa !== 'implementacao') throw new ErroProjetos('O andamento das atividades é lançado na fase 3 ou na implementação.');
  await atividadeDoProjeto(p, projetoId, id);
  const v = conferirAndamento(d, hojeEm(agora));
  const { colunasAlteradas } = await atualizar(p, Atividades, id, versao, { situacao: v.situacao, inicio_real: v.inicioReal, fim_real: v.fimReal }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Atividades', id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Andamento de atividade lançado', null, agora);
}

/** Nada é apagado: a atividade fica inativa. Só na fase 3. */
export async function retirarAtividade(p: Planilhas, quem: Autorizador, projetoId: string, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  await atividadeDoProjeto(p, projetoId, id);
  const { colunasAlteradas } = await atualizar(p, Atividades, id, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Atividades', id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Atividade retirada', null, agora);
}

// ---------- Orçamento do projeto ----------

/** Versão do Termo aprovado em vigor, gravada em cada linha (regra de borda 4: o Termo é a referência do orçamento). */
async function numeroDoTermo(p: Planilhas, projetoId: string): Promise<number> {
  return (await exigirTermoAprovado(p, projetoId)).numero;
}

export async function adicionarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, d: DadosLinhaOrcamento, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  const v = conferirLinhaOrcamento(d);
  const campos = { projeto_id: projetoId, categoria: v.categoria, descricao: v.descricao, valor_planejado: v.valorPlanejado, fonte: v.fonte, versao_termo: await numeroDoTermo(p, projetoId) };
  const nova = await inserir(p, ProjetoOrcamento, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'ProjetoOrcamento', nova.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento incluída', null, agora);
}

async function linhaDoProjeto(p: Planilhas, projetoId: string, id: string) {
  const [linhas] = await lerTabelas(p, [ProjetoOrcamento] as const);
  const l = linhas.porId(id);
  if (!l || !l.ativo || l.projeto_id !== projetoId) throw new ErroProjetos('Linha do orçamento não encontrada.');
  return l;
}

export async function alterarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, id: string, versao: number, d: DadosLinhaOrcamento, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  const v = conferirLinhaOrcamento(d);
  await linhaDoProjeto(p, projetoId, id);
  const { colunasAlteradas } = await atualizar(p, ProjetoOrcamento, id, versao, { categoria: v.categoria, descricao: v.descricao, valor_planejado: v.valorPlanejado, fonte: v.fonte }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento alterada', null, agora);
}

export async function retirarLinhaOrcamento(p: Planilhas, quem: Autorizador, projetoId: string, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  await projetoParaAlterar(p, quem, projetoId, [3]);
  await linhaDoProjeto(p, projetoId, id);
  const { colunasAlteradas } = await atualizar(p, ProjetoOrcamento, id, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'ProjetoOrcamento', id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Linha do orçamento retirada', null, agora);
}

export interface ResumoOrcamento {
  total: number;
  /** Total do Termo de Abertura aprovado, para comparar (null se ainda não há). */
  valorDoTermo: number | null;
  /** Diferença entre o plano e o Termo (positiva = o plano passa do Termo). */
  diferenca: number | null;
}

export function resumoDoOrcamento(linhas: readonly { valor_planejado: number }[], valorDoTermo: number | null): ResumoOrcamento {
  const total = totalOrcamento(linhas);
  return { total, valorDoTermo, diferenca: valorDoTermo === null ? null : Math.round((total - valorDoTermo) * 100) / 100 };
}

// ---------- Iniciar a implementação (porte enxuto: a porta 3 fica desligada) ----------

/** Regras 5, 6 e 13: fase 3 pronta, Termo aprovado. No porte completo o caminho é a porta 3. */
export async function iniciarImplementacao(p: Planilhas, quem: Autorizador, projetoId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaAlterar(p, quem, projetoId, [3]);
  if (r.responsavel?.toLowerCase() !== quem.email.toLowerCase()) throw new ErroPermissao('Só o responsável inicia a implementação.');
  if (r.porte !== 'enxuto') throw new ErroProjetos('No porte completo, o plano passa pela porta 3 antes da implementação.');
  if (r.versao !== versao) throw new ErroConflito(projetoId);
  await exigirTermoAprovado(p, projetoId);
  const f = await lerFase(p, quem, projetoId);
  const falta = f?.itens.filter((i) => !i.pronto) ?? [];
  if (falta.length > 0) throw new ErroProjetos(`Ainda falta na fase 3: ${falta.map((i) => i.nome.toLowerCase()).join(', ')}.`);
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { etapa: 'implementacao' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, 'Fase 3 concluída: o projeto entra em implementação', null, agora);
}
