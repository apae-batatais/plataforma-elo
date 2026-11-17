/**
 * Volta da Meta depois que a pessoa autoriza o Instagram (ADR-028). Exige login no Elo e confere o `estado`
 * assinado: só quem começou a conexão, na mesma instituição, a conclui. Nada do que a Meta devolve é mostrado.
 */
import { NextResponse } from 'next/server';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { concluirConexaoInstagram } from '@/modulos/comunicacao/aplicacao/instagram';
import { ErroComunicacao } from '@/modulos/comunicacao/dominio/pedido';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { configGeral } from '@/plataforma/instituicao';
import { provedorDeInstagram, retornoDoInstagram } from '@/plataforma/instagram';
import { usuarioLogado } from '@/plataforma/sessao';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const base = new URL(req.url);
  // O endereço de volta já respeita o domínio que a pessoa usa (atrás da hospedagem, `req.url` pode vir interno).
  const origem = new URL(await retornoDoInstagram()).origin;
  const volta = (chave: 'ok' | 'erro', mensagem: string) => {
    const u = new URL('/comunicacao/configuracoes', origem);
    u.searchParams.set(chave, mensagem);
    return NextResponse.redirect(u);
  };
  const usuario = await usuarioLogado();
  if (!usuario) return NextResponse.redirect(new URL('/entrar', origem));
  const provedor = provedorDeInstagram(configGeral());
  if (!provedor) return volta('erro', 'A ligação com o Instagram ainda não foi configurada pela Operadora do Elo.');
  const app = await obterAplicacao();
  try {
    await concluirConexaoInstagram(
      app.planilhas,
      usuario.autorizador,
      provedor,
      app.config.segredoSessao,
      app.instituicao.codigo,
      `${origem}/comunicacao/instagram/retorno`,
      { codigo: base.searchParams.get('code'), estado: base.searchParams.get('state'), erro: base.searchParams.get('error') },
    );
  } catch (erro) {
    if (erro instanceof ErroComunicacao || erro instanceof ErroPermissao) return volta('erro', erro instanceof ErroPermissao ? 'Só a coordenação da Comunicação pode conectar o Instagram.' : erro.message);
    throw erro;
  }
  return volta('ok', 'Instagram conectado.');
}
