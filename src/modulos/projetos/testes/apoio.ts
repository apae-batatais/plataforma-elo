/** Apoio dos testes de Projetos: planilhas em memória, demonstração fictícia e quem está logado. */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { salvarConfig } from '../aplicacao/configuracoes';
import { assumirIdeia, cadastrarIdeia, type DadosIdeia } from '../aplicacao/ideias';
import { abrirPorta, darParecer } from '../aplicacao/portas';
import { Projetos, TABELAS_PROJETOS } from '../dados/tabelas';
import { CONFIG_PADRAO, type ConfigProjetos } from '../dominio/projeto';
import { manifesto } from '../manifesto';

export const FUNCIONARIO = 'funcionario@exemplo.local';
export const OUTRO_FUNCIONARIO = 'dp@exemplo.local';
export const COORDENACAO = 'coord.educacao@exemplo.local';
export const COORDENACAO_UR = 'coord.ur@exemplo.local';
export const DIRETORIA = 'diretoria@exemplo.local';
export const TECNICO = 'tecnico.cer@exemplo.local';
export const FINANCEIRO = 'financeiro@exemplo.local';
export const ALCADA = 'admin@exemplo.local';
export const LEITURA = 'leitura@exemplo.local';

export const AGORA = new Date('2026-11-12T15:00:00Z');

export async function planilhasDeProjetos(): Promise<Planilhas> {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'projetos']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_PROJETOS] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  return p;
}

export async function como(p: Planilhas, email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

export const ideia = (x: Partial<DadosIdeia> = {}): DadosIdeia => ({
  titulo: 'Ideia de teste',
  resumo: 'Resumo fictício da ideia.',
  tipo: 'interno',
  porte: 'completo',
  valorEstimado: 10000,
  servico: null,
  ...x,
});

/** Configuração com a banca da demonstração: técnico, financeiro, jurídico e alçada. */
export async function comBanca(p: Planilhas, extra: Partial<ConfigProjetos> = {}) {
  await salvarConfig(
    p,
    await como(p, DIRETORIA),
    {
      ...CONFIG_PADRAO,
      designados: { tecnico: [TECNICO], financeiro: [FINANCEIRO], juridico: [OUTRO_FUNCIONARIO], alcada: [ALCADA] },
      ...extra,
    },
    { agora: AGORA },
  );
}

export async function versaoDe(p: Planilhas, id: string) {
  return (await lerTabela(p, Projetos)).porId(id)!.versao;
}

/** Ideia enviada e assumida pela coordenação (etapa "ideia"). */
export async function comResponsavel(p: Planilhas, d: Partial<DadosIdeia> = {}, proponente = FUNCIONARIO) {
  const r = await cadastrarIdeia(p, await como(p, proponente), ideia(d), { agora: AGORA, enviar: true });
  await assumirIdeia(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), { agora: AGORA });
  return r;
}

/** Ideia com a porta 1 aberta. */
export async function comPortaAberta(p: Planilhas, d: Partial<DadosIdeia> = {}, proponente = FUNCIONARIO) {
  const r = await comResponsavel(p, d, proponente);
  const { portaId } = await abrirPorta(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), { agora: AGORA });
  return { ...r, portaId };
}

export async function todosPareceres(p: Planilhas, portaId: string) {
  await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, { agora: AGORA });
  await darParecer(p, await como(p, FINANCEIRO), portaId, 'financeiro', 'satisfatorio', null, { agora: AGORA });
  await darParecer(p, await como(p, OUTRO_FUNCIONARIO), portaId, 'juridico', 'satisfatorio', null, { agora: AGORA });
}

export async function auditoriaDe(p: Planilhas, id: string) {
  return (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
}
