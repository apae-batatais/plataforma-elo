/**
 * Provedor do Instagram da plataforma (ADR-028). Somente servidor.
 *
 * - Demonstração: provedor fictício em memória (nada sai de verdade).
 * - Produção: app Meta do Elo, com META_APP_ID e META_APP_SECRET. Sem eles, null: a tela explica que
 *   a ligação ainda não foi configurada.
 */
import 'server-only';
import type { ConfigGeral } from '@/nucleo/config';
import { ProvedorInstagramMemoria, ProvedorMeta, type ProvedorInstagram } from '@/nucleo/credenciais/instagram';

export function provedorDeInstagram(geral: ConfigGeral, env: Record<string, string | undefined> = process.env): ProvedorInstagram | null {
  if (geral.modo === 'demonstracao') return new ProvedorInstagramMemoria();
  const id = (env.META_APP_ID ?? '').trim();
  const segredo = (env.META_APP_SECRET ?? '').trim();
  return id && segredo ? new ProvedorMeta(id, segredo) : null;
}

/** Endereço de volta da Meta, no endereço que a pessoa está usando (a Meta exige que esteja cadastrado no app). */
export async function retornoDoInstagram(): Promise<string> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocolo}://${host}/comunicacao/instagram/retorno`;
}
