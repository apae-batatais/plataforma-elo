/**
 * Quem pertence ao público-alvo de uma publicação (regra 4, ADR-039): calculado na hora,
 * a partir das atribuições vigentes do Núcleo. Só entra quem tem acesso ao app.
 */
import type { PublicoTipo } from './publicacao';

export interface DadosDoPublico {
  usuarios: { email: string }[];
  atribuicoes: { usuario_email: string; perfil: string; escopo_tipo: string; escopo: string | null; inicio: string | null; fim: string | null }[];
  perfilPermissoes: { perfil: string; permissao: string }[];
}

const vigente = (a: { inicio: string | null; fim: string | null }, hoje: string) => (!a.inicio || a.inicio <= hoje) && (!a.fim || a.fim >= hoje);

export const PERMISSAO_ACESSO = 'conhecimento.acessar';

/** E-mails (em minúsculas, sem repetir) de quem deve ler a publicação. */
export function membrosDoPublico(alvo: { publico_tipo: PublicoTipo; publico_valor: string | null }, d: DadosDoPublico, hoje: string): string[] {
  const perfisComAcesso = new Set(d.perfilPermissoes.filter((x) => x.permissao === PERMISSAO_ACESSO).map((x) => x.perfil));
  const ativos = new Set(d.usuarios.map((u) => u.email));
  const emails = new Set<string>();
  for (const a of d.atribuicoes) {
    if (!ativos.has(a.usuario_email) || !vigente(a, hoje) || !perfisComAcesso.has(a.perfil)) continue;
    if (alvo.publico_tipo === 'perfil' && a.perfil !== alvo.publico_valor) continue;
    if (alvo.publico_tipo === 'area' && !(a.escopo_tipo === 'area' && a.escopo === alvo.publico_valor)) continue;
    emails.add(a.usuario_email);
  }
  return [...emails].sort();
}
