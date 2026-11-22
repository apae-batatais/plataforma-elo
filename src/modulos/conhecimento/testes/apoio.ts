/** Apoio dos testes da Base de Conhecimento: planilhas em memória, demonstração fictícia e quem está logado. */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { criarCategoria } from '../aplicacao/categorias';
import { salvarPublicacao, type DadosPublicacao } from '../aplicacao/publicacoes';
import { TABELAS_CONHECIMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

export const EDITOR = 'editor.conhecimento@exemplo.local';
export const DIRETORIA = 'diretoria@exemplo.local';
export const ADMIN = 'admin@exemplo.local';
export const FUNCIONARIO = 'funcionario@exemplo.local';
export const COZINHA = 'cozinha@exemplo.local';
export const COORD_EDUCACAO = 'coord.educacao@exemplo.local';
export const LEITURA = 'leitura@exemplo.local';

export const AGORA = new Date('2026-11-21T15:00:00Z');

export async function planilhasDeConhecimento(): Promise<Planilhas> {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'conhecimento']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_CONHECIMENTO] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  return p;
}

export async function como(p: Planilhas, email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
}

export async function categoriaPronta(p: Planilhas, nome = 'Normas'): Promise<string> {
  const editor = await como(p, EDITOR);
  await criarCategoria(p, editor, nome, { agora: AGORA });
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function dados(x: Partial<DadosPublicacao> = {}): DadosPublicacao {
  return {
    titulo: 'Código de conduta',
    categoria: 'normas',
    resumo: 'Resumo',
    corpo: 'Texto da norma.',
    publicoTipo: 'todos',
    publicoValor: null,
    exigeCiencia: true,
    publicar: true,
    ...x,
  };
}

/** Cria a categoria "normas" e publica uma publicação como o editor. Devolve id e versão lida. */
export async function publicada(p: Planilhas, x: Partial<DadosPublicacao> = {}) {
  await categoriaPronta(p);
  const editor = await como(p, EDITOR);
  const r = await salvarPublicacao(p, editor, null, dados(x), { agora: AGORA });
  return { ...r, versao: 1 };
}

export async function auditoriaDe(p: Planilhas, id: string) {
  return (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
}
