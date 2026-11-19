/**
 * Entrega uma foto ou documento do pedido, só para quem pode ver o pedido (ADR-014).
 * Cada abertura vai para a auditoria. Arquivos grandes vão aos poucos (trechos de até 4 MB).
 */
import { abrirAnexoComunicacao, lerAnexoComunicacao } from '@/modulos/comunicacao/aplicacao/anexos';
import { ErroComunicacao } from '@/modulos/comunicacao/dominio/pedido';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroArquivo } from '@/nucleo/armazenamento/arquivos';
import { ErroFaixaInvalida, MENSAGEM_ERRO_LEITURA } from '@/nucleo/armazenamento/leitura-de-anexo';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) return new Response('Entre de novo no Elo.', { status: 401 });
  const app = await obterAplicacao();
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  const pedido = { inicio: faixa?.[1] ? Number(faixa[1]) : 0, fim: faixa?.[2] ? Number(faixa[2]) : null };
  try {
    if (!faixa) {
      // Sem faixa (link de documento, foto): o arquivo inteiro, em fluxo, um trecho por vez (o limite da hospedagem
      // vale para resposta montada na memória, não para fluxo). Quem vê e a auditoria são resolvidos antes de começar.
      const a = await abrirAnexoComunicacao(app.planilhas, usuario.autorizador, app.arquivos, id);
      let posicao = 0;
      const corpo = new ReadableStream<Uint8Array>({
        async pull(controle) {
          if (posicao >= a.total) return controle.close();
          const t = await a.lerTrecho(posicao);
          if (t.dados.length === 0) return controle.error(new ErroArquivo('O arquivo veio incompleto.'));
          posicao += t.dados.length;
          controle.enqueue(t.dados);
        },
      });
      return new Response(corpo, {
        status: 200,
        headers: {
          'Content-Type': a.tipo,
          'Content-Length': String(a.total),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const t = await lerAnexoComunicacao(app.planilhas, usuario.autorizador, app.arquivos, id, pedido);
    return new Response(t.dados as BodyInit, {
      status: 206,
      headers: {
        'Content-Type': t.tipo,
        'Content-Length': String(t.dados.length),
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${t.inicio}-${t.fim}/${t.total}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (erro) {
    if (erro instanceof ErroPermissao) return new Response(erro.message, { status: 403 });
    if (erro instanceof ErroComunicacao) return new Response(erro.message, { status: 404 });
    if (erro instanceof ErroFaixaInvalida) return new Response(erro.message, { status: 416, headers: { 'Content-Range': `bytes */${erro.total}` } });
    if (erro instanceof ErroArquivo) {
      // O texto do Google (com o código do arquivo) fica só no registro do servidor.
      console.error('Falha ao ler anexo:', erro.message);
      return new Response(MENSAGEM_ERRO_LEITURA, { status: 502 });
    }
    throw erro;
  }
}
