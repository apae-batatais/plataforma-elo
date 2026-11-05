/**
 * Recebe o arquivo de um envio aberto, só na DEMONSTRAÇÃO (arquivos em memória).
 * Em produção o navegador manda o arquivo direto para o Drive da instituição.
 */
import { NextResponse } from 'next/server';
import { ArquivosMemoria, ErroArquivo, LIMITE_ENVIO_DEMONSTRACAO } from '@/nucleo/armazenamento/arquivos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export async function PUT(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!(await usuarioLogado())) return NextResponse.json({ erro: 'Entre de novo no Elo.' }, { status: 401 });
  const app = await obterAplicacao();
  if (!(app.arquivos instanceof ArquivosMemoria)) return NextResponse.json({ erro: 'Envio não disponível.' }, { status: 404 });
  const dados = new Uint8Array(await req.arrayBuffer());
  if (dados.length > LIMITE_ENVIO_DEMONSTRACAO) return NextResponse.json({ erro: 'Arquivo grande demais para a demonstração.' }, { status: 413 });
  try {
    return NextResponse.json(app.arquivos.receber(codigo, dados));
  } catch (erro) {
    if (erro instanceof ErroArquivo) return NextResponse.json({ erro: erro.message }, { status: 400 });
    throw erro;
  }
}
