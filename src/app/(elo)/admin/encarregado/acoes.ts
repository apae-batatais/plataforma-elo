'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { cadastrarEncarregado, corrigirEncarregado, trocarEncarregado, type DadosEncarregado } from '@/nucleo/encarregado/encarregado';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export interface EstadoEncarregado {
  erro?: string;
  /** O que a pessoa digitou, para não perder quando há erro. */
  valores?: DadosEncarregado & { data?: string };
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

async function executar(
  f: FormData,
  sucesso: string,
  agir: (ctx: { app: Awaited<ReturnType<typeof obterAplicacao>>; quem: NonNullable<Awaited<ReturnType<typeof usuarioLogado>>>['autorizador'] }, d: DadosEncarregado, f: FormData) => Promise<void>,
): Promise<EstadoEncarregado> {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('core.dpo.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const dados: DadosEncarregado = { tipo: texto(f, 'tipo'), nome: texto(f, 'nome'), documento: texto(f, 'documento'), email: texto(f, 'email') };
  try {
    await agir({ app, quem: usuario.autorizador }, dados, f);
  } catch (erro) {
    if (erro instanceof ErroConflito) {
      return { erro: 'Os dados mudaram enquanto você editava. Reabra e tente de novo.', valores: { ...dados, data: texto(f, 'data') } };
    }
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) return { erro: erro.message, valores: { ...dados, data: texto(f, 'data') } };
    throw erro;
  }
  redirect(`/admin/encarregado?ok=${encodeURIComponent(sucesso)}`);
}

export async function acaoCadastrarEncarregado(_: EstadoEncarregado, f: FormData) {
  return executar(f, 'Encarregado salvo.', ({ app, quem }, d) => cadastrarEncarregado(app.planilhas, quem, d));
}

export async function acaoCorrigirEncarregado(_: EstadoEncarregado, f: FormData) {
  return executar(f, 'Encarregado salvo.', ({ app, quem }, d) => corrigirEncarregado(app.planilhas, quem, texto(f, 'id'), Number(texto(f, 'versao')), d));
}

export async function acaoTrocarEncarregado(_: EstadoEncarregado, f: FormData) {
  return executar(f, 'Encarregado trocado. O anterior ficou no histórico.', ({ app, quem }, d) =>
    trocarEncarregado(app.planilhas, quem, texto(f, 'id'), Number(texto(f, 'versao')), d, texto(f, 'data') || undefined),
  );
}
