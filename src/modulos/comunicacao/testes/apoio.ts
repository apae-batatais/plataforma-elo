/** Apoio dos testes da Comunicação: planilhas em memória, demonstração fictícia e quem está logado. */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { TABELAS_COMUNICACAO } from '../dados/tabelas';
import type { TipoPeca } from '../dominio/pedido';
import type { TipoData } from '../dominio/calendario';
import { manifesto } from '../manifesto';

export const FUNCIONARIO = 'funcionario@exemplo.local';
export const COMUNICACAO = 'comunicacao@exemplo.local';
export const COORDENACAO = 'coord.comunicacao@exemplo.local';
export const OUTRO_FUNCIONARIO = 'dp@exemplo.local';
export const DIRETORIA = 'diretoria@exemplo.local';

/** Planilhas novas, com a estrutura da Comunicação e os usuários fictícios do Núcleo. */
export async function planilhasDeComunicacao(): Promise<Planilhas> {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'comunicacao']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_COMUNICACAO] as never, perfis: manifesto.perfis, permissoes });
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

export function item(x: Partial<{ tema: string; tipoData: TipoData; inicio: string; fim: string; tipos: TipoPeca[]; observacao: string | null }> = {}) {
  return {
    tema: 'Dia de teste da Comunicação',
    tipoData: 'exata' as TipoData,
    inicio: '2026-12-10',
    fim: '2026-12-10',
    tipos: ['post_instagram'] as TipoPeca[],
    observacao: null as string | null,
    ...x,
  };
}

/** Registros de auditoria de um registro, do mais antigo ao mais novo. */
export async function auditoriaDe(p: Planilhas, id: string) {
  return (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
}
