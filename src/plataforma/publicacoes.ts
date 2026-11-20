/**
 * Tarefa da rotina que publica no Instagram o que a Comunicação agendou (ADR-028). Somente servidor.
 *
 * - Demonstração: "Instagram" fictício em memória (nada sai de verdade).
 * - Produção: API da Meta. O endereço público do Elo (de onde a Meta baixa a mídia temporária) vem de
 *   `ELO_URL_PUBLICA` ou, na Netlify, de `URL`. Sem ele, a tarefa não roda e só informa.
 */
import 'server-only';
import { rodarPublicacoes } from '@/modulos/comunicacao/aplicacao/publicacoes';
import { PublicadorInstagramMemoria, PublicadorMeta, type PublicadorInstagram } from '@/nucleo/credenciais/instagram-publicacao';
import type { ConfigGeral } from '@/nucleo/config';
import { configGeral } from './instituicao';
import type { TarefaDaRotina } from './tarefa-da-rotina';

export function publicadorDeInstagram(geral: ConfigGeral): PublicadorInstagram {
  return geral.modo === 'demonstracao' ? new PublicadorInstagramMemoria() : new PublicadorMeta();
}

export function urlPublicaDoElo(env: Record<string, string | undefined> = process.env): string | null {
  const v = (env.ELO_URL_PUBLICA || env.URL || '').trim().replace(/\/+$/, '');
  return v.startsWith('https://') ? v : null;
}

export const tarefaDePublicacoes: TarefaDaRotina = {
  id: 'comunicacao.publicacoes',
  async executar(app, agora) {
    const geral = configGeral();
    const urlBase = geral.modo === 'demonstracao' ? 'https://demonstracao.exemplo.local' : urlPublicaDoElo();
    if (!urlBase) return { sem_endereco_publico: 1 };
    return rodarPublicacoes(app.planilhas, { instituicao: app.instituicao.codigo, publicador: publicadorDeInstagram(geral), urlBase }, agora);
  },
};
