/**
 * Mídia temporária para a Meta baixar a imagem, as imagens do carrossel ou o vídeo de uma publicação do Instagram (ADR-028).
 *
 * Pública (sem login) de propósito: a Meta não tem como entrar no Elo. O código é aleatório, vale por até
 * 1 hora e só enquanto a publicação não termina. Código inexistente, vencido ou encerrado dá sempre o mesmo
 * "não encontrado", sem pista do motivo. Cada entrega fica na auditoria.
 */
import { abrirMidiaTemporaria, instituicaoDoCodigo } from '@/modulos/comunicacao/aplicacao/publicacoes';
import { aplicacaoDa } from '@/plataforma/aplicacao';
import { configGeral } from '@/plataforma/instituicao';
import { instituicoesDoElo } from '@/plataforma/rede';

export const dynamic = 'force-dynamic';

const NAO_ENCONTRADO = () => new Response('Não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const inst = instituicaoDoCodigo(codigo);
  if (!inst) return NAO_ENCONTRADO();
  try {
    const geral = configGeral();
    const instituicao = (await instituicoesDoElo(geral)).find((i) => i.codigo === inst && i.situacao === 'ativa');
    if (!instituicao) return NAO_ENCONTRADO();
    const app = await aplicacaoDa(geral, instituicao);
    const m = await abrirMidiaTemporaria(app.planilhas, app.arquivos, codigo, new Date(), Number(new URL(req.url).searchParams.get('n') ?? 0));
    if (!m) return NAO_ENCONTRADO();
    let posicao = 0;
    const corpo = new ReadableStream<Uint8Array>({
      async pull(controle) {
        if (posicao >= m.total) return controle.close();
        const t = await m.lerTrecho(posicao);
        if (t.dados.length === 0) return controle.error(new Error('incompleto'));
        posicao += t.dados.length;
        controle.enqueue(t.dados);
      },
    });
    return new Response(corpo, {
      status: 200,
      headers: { 'Content-Type': m.tipo, 'Content-Length': String(m.total), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return NAO_ENCONTRADO();
  }
}
