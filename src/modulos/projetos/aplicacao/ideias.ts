/** Casos de uso da ideia e do responsável: cadastrar, enviar, assumir, editar, trocar responsável, parar e cancelar. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { Projetos, type RegProjeto } from '../dados/tabelas';
import { ErroProjetos, PORTES, proximoCodigo, TIPOS_PROJETO, type Etapa, type Porte, type TipoProjeto } from '../dominio/projeto';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeAssumir, podeVerProjeto, registrarHistorico, veTodos, type Opcoes } from './comum';

export interface DadosIdeia {
  titulo: string;
  resumo: string;
  tipo: TipoProjeto;
  porte: Porte;
  valorEstimado: number | null;
  servico: string | null;
}

async function conferir(p: Planilhas, d: DadosIdeia): Promise<DadosIdeia> {
  const titulo = d.titulo.trim();
  const resumo = d.resumo.trim();
  if (!titulo) throw new ErroProjetos('Dê um título à ideia.');
  if (!resumo) throw new ErroProjetos('Escreva um resumo da ideia.');
  if (!TIPOS_PROJETO.includes(d.tipo)) throw new ErroProjetos('Escolha o tipo do projeto.');
  if (!PORTES.includes(d.porte)) throw new ErroProjetos('Escolha o porte do projeto.');
  if (d.valorEstimado !== null && (!Number.isFinite(d.valorEstimado) || d.valorEstimado < 0)) throw new ErroProjetos('O valor estimado precisa ser zero ou maior.');
  const servico = d.servico?.trim() || null;
  if (servico) {
    const servicos = await lerTabela(p, Servicos);
    if (!servicos.todos().some((s) => s.codigo === servico)) throw new ErroProjetos('Serviço não encontrado.');
  }
  return { ...d, titulo, resumo, servico };
}

/** Lê o projeto e confere a versão que a pessoa viu. */
async function acharComVersao(p: Planilhas, id: string, versao: number): Promise<RegProjeto> {
  const r = (await lerTabela(p, Projetos)).porId(id);
  if (!r || !r.ativo) throw new ErroProjetos('Projeto não encontrado.');
  if (r.versao !== versao) throw new ErroConflito(id);
  return r;
}

async function mudar(p: Planilhas, quem: Autorizador, r: RegProjeto, mudancas: Partial<RegProjeto>, acao: string, comentario: string | null, agora: Date) {
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, mudancas, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, acao, comentario, agora);
}

const ehEu = (quem: Autorizador, email: string | null) => !!email && email.toLowerCase() === quem.email.toLowerCase();

/** Regra 1: quem tem `projetos.propor` cadastra a ideia. `enviar` já a manda para uma coordenação assumir. */
export async function cadastrarIdeia(p: Planilhas, quem: Autorizador, d: DadosIdeia, opcoes: Opcoes & { enviar?: boolean } = {}): Promise<{ id: string; codigo: string }> {
  if (!quem.temPermissaoAlgumEscopo('projetos.propor')) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const dados = await conferir(p, d);
  const [projetos] = await lerTabelas(p, [Projetos] as const);
  // Regra 4: o código vem do maior já usado, contando também os inativos. Dois cadastros no mesmo instante podem repetir (risco aceito, como na Comunicação).
  const codigo = proximoCodigo(projetos.todos().map((x) => x.codigo));
  const etapa: Etapa = opcoes.enviar ? 'aguardando_responsavel' : 'rascunho';
  const campos = {
    codigo,
    titulo: dados.titulo,
    resumo: dados.resumo,
    tipo: dados.tipo,
    porte: dados.porte,
    etapa,
    proponente: quem.email,
    responsavel: null,
    servico: dados.servico,
    valor_estimado: dados.valorEstimado,
    inicio_previsto: null,
    fim_previsto: null,
  };
  const novo = await inserir(p, Projetos, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Projetos', novo.id, Object.keys(campos), agora);
  await registrarHistorico(p, quem, novo.id, opcoes.enviar ? 'Ideia cadastrada e enviada para uma coordenação assumir' : 'Ideia cadastrada como rascunho', null, agora);
  return { id: novo.id, codigo };
}

/** Quem propôs edita enquanto é rascunho ou espera responsável; o responsável edita a ideia (inclusive o porte) antes da porta. */
export async function editarIdeia(p: Planilhas, quem: Autorizador, id: string, versao: number, d: DadosIdeia, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await acharComVersao(p, id, versao);
  const proponente = ehEu(quem, r.proponente) && (r.etapa === 'rascunho' || r.etapa === 'aguardando_responsavel');
  const responsavel = ehEu(quem, r.responsavel) && r.etapa === 'ideia' && quem.temPermissaoAlgumEscopo('projetos.gerenciar');
  if (!proponente && !responsavel) throw new ErroPermissao('Você não pode alterar esta ideia agora.');
  const dados = await conferir(p, d);
  await mudar(p, quem, r, { titulo: dados.titulo, resumo: dados.resumo, tipo: dados.tipo, porte: dados.porte, valor_estimado: dados.valorEstimado, servico: dados.servico }, 'Ideia alterada', null, agora);
}

/** Do rascunho para "aguardando responsável" (só quem propôs). */
export async function enviarParaAssumir(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const r = await acharComVersao(p, id, versao);
  if (!ehEu(quem, r.proponente)) throw new ErroPermissao('Só quem propôs a ideia pode enviá-la.');
  if (r.etapa !== 'rascunho') throw new ErroProjetos('Só um rascunho pode ser enviado.');
  await mudar(p, quem, r, { etapa: 'aguardando_responsavel' }, 'Enviada para uma coordenação assumir', null, opcoes.agora ?? new Date());
}

/** Regra 2: a coordenação assume a ideia e vira responsável. */
export async function assumirIdeia(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const r = await acharComVersao(p, id, versao);
  if (r.etapa !== 'aguardando_responsavel') throw new ErroProjetos('Esta ideia não está esperando responsável.');
  if (!podeAssumir(quem, r) || !quem.temPermissaoAlgumEscopo('projetos.gerenciar')) throw new ErroPermissao('Você não pode assumir esta ideia.');
  await mudar(p, quem, r, { responsavel: quem.email, etapa: 'ideia' }, 'Assumida como responsável', null, opcoes.agora ?? new Date());
}

/** Regra 2: só `projetos.ver_todos` troca o responsável, com registro. O novo responsável precisa ter conta ativa. */
export async function trocarResponsavel(p: Planilhas, quem: Autorizador, id: string, versao: number, novo: string, opcoes: Opcoes = {}): Promise<void> {
  if (!veTodos(quem)) throw new ErroPermissao();
  const r = await acharComVersao(p, id, versao);
  if (r.etapa === 'rascunho' || r.etapa === 'aguardando_responsavel' || r.etapa === 'cancelado' || r.etapa === 'encerrado') throw new ErroProjetos('Só dá para trocar o responsável de um projeto que já tem responsável.');
  if (r.etapa === 'em_porta') throw new ErroProjetos('Espere a decisão da porta para trocar o responsável.');
  const email = novo.trim().toLowerCase();
  const usuarios = await lerTabela(p, Usuarios);
  if (!usuarios.ativos().some((u) => u.email.toLowerCase() === email)) throw new ErroProjetos('Essa pessoa não tem acesso à plataforma.');
  if (email === r.responsavel?.toLowerCase()) return;
  await mudar(p, quem, r, { responsavel: email }, 'Responsável trocado', `De ${r.responsavel} para ${email}.`, opcoes.agora ?? new Date());
}

/** Regra 12: `parado` só volta pela Diretoria, que reabre a ideia (nova porta 1). */
export async function retomarProjeto(p: Planilhas, quem: Autorizador, id: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  if (!quem.temPermissao('projetos.decidir')) throw new ErroPermissao();
  const r = await acharComVersao(p, id, versao);
  if (r.etapa !== 'parado') throw new ErroProjetos('Só um projeto parado pode ser retomado.');
  await mudar(p, quem, r, { etapa: r.responsavel ? 'ideia' : 'aguardando_responsavel' }, 'Projeto retomado pela Diretoria', null, opcoes.agora ?? new Date());
}

/** Cancela (nada é apagado). Quem propôs cancela antes de ter responsável; o responsável e a Diretoria, fora de uma porta aberta. */
export async function cancelarProjeto(p: Planilhas, quem: Autorizador, id: string, versao: number, motivo: string, opcoes: Opcoes = {}): Promise<void> {
  const r = await acharComVersao(p, id, versao);
  if (r.etapa === 'cancelado') throw new ErroProjetos('Este projeto já está cancelado.');
  if (r.etapa === 'encerrado') throw new ErroProjetos('Projeto encerrado: fica só para leitura.');
  if (r.etapa === 'em_porta') throw new ErroProjetos('Espere a decisão da porta para cancelar.');
  const proponente = ehEu(quem, r.proponente) && (r.etapa === 'rascunho' || r.etapa === 'aguardando_responsavel');
  if (!proponente && !ehEu(quem, r.responsavel) && !veTodos(quem)) throw new ErroPermissao('Você não pode cancelar este projeto.');
  if (!motivo.trim()) throw new ErroProjetos('Diga o motivo do cancelamento.');
  await mudar(p, quem, r, { etapa: 'cancelado' }, 'Projeto cancelado', motivo, opcoes.agora ?? new Date());
}

export interface LinhaProjeto {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoProjeto;
  porte: Porte;
  etapa: Etapa;
  proponente: string;
  responsavel: string | null;
  valorEstimado: number | null;
}

export type FiltroProjetos = 'meus' | 'aguardando' | 'todos';

/**
 * Toda leitura passa pelo Autorizador. `meus`: propus ou sou responsável; `aguardando`: ideias esperando
 * responsável que posso assumir; `todos`: só com `projetos.ver_todos`.
 */
export async function listarProjetos(p: Planilhas, quem: Autorizador, filtro: FiltroProjetos): Promise<LinhaProjeto[]> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  if (filtro === 'todos' && !veTodos(quem)) throw new ErroPermissao();
  const [projetos, config, equipes] = await Promise.all([lerTabela(p, Projetos), lerConfig(p), equipesAtivas(p)]);
  const eu = quem.email.toLowerCase();
  const escolhidos = projetos.ativos().filter((r) => {
    if (!podeVerProjeto(quem, r, config, equipes.get(r.id))) return false;
    if (filtro === 'todos') return true;
    if (filtro === 'aguardando') return r.etapa === 'aguardando_responsavel' && podeAssumir(quem, r);
    return r.proponente.toLowerCase() === eu || r.responsavel?.toLowerCase() === eu;
  });
  return escolhidos
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, tipo: r.tipo, porte: r.porte, etapa: r.etapa, proponente: r.proponente, responsavel: r.responsavel, valorEstimado: r.valor_estimado }));
}

/** Serviços para a pessoa escolher (opcional) ao cadastrar a ideia. */
export async function servicosParaEscolher(p: Planilhas): Promise<{ codigo: string; nome: string }[]> {
  return (await lerTabela(p, Servicos)).ativos().map((s) => ({ codigo: s.codigo, nome: s.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
