/** Verificação de saúde usada pela hospedagem: responde se o servidor está no ar. */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
