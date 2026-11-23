/** Apoio comum dos casos de uso da Base de Conhecimento. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Atribuicoes, PerfilPermissoes, Usuarios } from '@/nucleo/estrutura/tabelas';
import { membrosDoPublico, type DadosDoPublico } from '../dominio/publico';
import type { PublicoTipo } from '../dominio/publicacao';

export const PERM = {
  acessar: 'conhecimento.acessar',
  ler: 'conhecimento.ler',
  publicar: 'conhecimento.publicar',
  acompanhar: 'conhecimento.acompanhar',
  categorias: 'conhecimento.categorias.gerenciar',
} as const;

export interface Opcoes {
  agora?: Date;
  /** A instituição tem e-mail de envio? Sem ele, o aviso por e-mail não é agendado. */
  emailDisponivel?: boolean;
}

export const diaDe = (d: Date) => d.toISOString().slice(0, 10);
export const autoriaDe = (quem: Autorizador, agora: Date) => ({ email: quem.email, agora: () => agora });

export const auditar = (p: Planilhas, quem: Autorizador, acao: 'inclusao' | 'alteracao' | 'encerramento' | 'leitura', entidade: string, registroId: string, colunas: string[], agora: Date) =>
  registrarAuditoria(p, { usuario: quem.email, acao, entidade, registroId, detalhes: { colunas } }, agora);

/** Atribuições do Núcleo que definem o público (lidas do Núcleo; só e-mails e perfis saem daqui). */
export async function carregarPublico(p: Planilhas, agora: Date) {
  const [usuarios, atribuicoes, perfilPermissoes] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes] as const);
  const dados: DadosDoPublico = {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
  };
  const hoje = diaDe(agora);
  return {
    dados,
    membros: (alvo: { publico_tipo: PublicoTipo; publico_valor: string | null }) => membrosDoPublico(alvo, dados, hoje),
  };
}
