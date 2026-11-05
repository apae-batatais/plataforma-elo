/**
 * Entrega uma foto ou vídeo da requisição, só para quem pode ver a requisição
 * (ADR-014). Vídeo vai aos poucos (trechos de até 4 MB), como o navegador pede.
 */
import { lerAnexo } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { ErroRequisicao } from '@/modulos/requisicoes/dominio/requisicao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroArquivo } from '@/nucleo/armazenamento/arquivos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) return new Response('Entre de novo no Elo.', { status: 401 });
  const app = await obterAplicacao();
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  const pedido = faixa ? { inicio: faixa[1] ? Number(faixa[1]) : 0, fim: faixa[2] ? Number(faixa[2]) : null } : { inicio: 0, fim: null };
  try {
    const t = await lerAnexo(app.planilhas, usuario.autorizador, app.arquivos, id, pedido);
    const parcial = Boolean(faixa) || t.fim < t.total - 1;
    return new Response(t.dados as BodyInit, {
      status: parcial ? 206 : 200,
      headers: {
        'Content-Type': t.tipo,
        'Content-Length': String(t.dados.length),
        'Accept-Ranges': 'bytes',
        ...(parcial ? { 'Content-Range': `bytes ${t.inicio}-${t.fim}/${t.total}` } : {}),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (erro) {
    if (erro instanceof ErroPermissao) return new Response(erro.message, { status: 403 });
    if (erro instanceof ErroRequisicao) return new Response(erro.message, { status: 404 });
    if (erro instanceof ErroArquivo) return new Response(erro.message, { status: 502 });
    throw erro;
  }
}
