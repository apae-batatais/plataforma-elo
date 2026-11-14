/**
 * Entrega a planilha (CSV) dos cadastros e das despesas/receitas, só para quem já vê a lista.
 * Só lê: não grava nem audita.
 */
import { baixarCadastrosCsv, baixarItensCsv } from '@/modulos/orcamento/aplicacao/baixar-planilha';
import { ErroPrevisao } from '@/modulos/orcamento/aplicacao/previsao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export async function GET(req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) return new Response('Entre de novo no Elo.', { status: 401 });
  const app = await obterAplicacao();
  const ano = Number(new URL(req.url).searchParams.get('ano')) || undefined;
  try {
    const q = usuario.autorizador;
    const csv =
      arquivo === 'grupos' ? await baixarCadastrosCsv(app.planilhas, q, 'grupo')
      : arquivo === 'fontes' ? await baixarCadastrosCsv(app.planilhas, q, 'fonte')
      : arquivo === 'despesas' ? await baixarItensCsv(app.planilhas, q, 'despesa', ano)
      : arquivo === 'receitas' ? await baixarItensCsv(app.planilhas, q, 'receita', ano)
      : null;
    if (!csv) return new Response('Arquivo não encontrado.', { status: 404 });
    return new Response(csv.conteudo, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csv.nome}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (erro) {
    if (erro instanceof ErroPermissao) return new Response(erro.message, { status: 403 });
    if (erro instanceof ErroPrevisao) return new Response(erro.message, { status: 404 });
    throw erro;
  }
}
