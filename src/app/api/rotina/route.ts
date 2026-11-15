/**
 * Rotina agendada do Elo (ADR-027). Chamada só pelo workflow "Rotina" do GitHub, com a chave ROTINA_TOKEN.
 * Sem chave válida: 401, sem dizer nada. A resposta traz só contagens.
 */
import { chaveDaRotinaValida, rodarRotina } from '@/plataforma/rotina';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cabecalho = req.headers.get('authorization') ?? '';
  const chave = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!chaveDaRotinaValida(chave)) return new Response('Não autorizado.', { status: 401 });
  try {
    return Response.json(await rodarRotina());
  } catch {
    return Response.json({ erro: 'A rotina não pôde rodar.' }, { status: 500 });
  }
}
