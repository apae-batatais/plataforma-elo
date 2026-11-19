'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { incluirFeriado, incluirFeriadosNacionais, tirarFeriado } from '@/nucleo/feriados/feriados';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

/** Executa o caso de uso e volta para a tela com a mensagem; em erro, mantém o ano escolhido e os campos digitados. */
async function executar(f: FormData, sucesso: (r: never) => string, agir: (ctx: { app: Awaited<ReturnType<typeof obterAplicacao>>; quem: NonNullable<Awaited<ReturnType<typeof usuarioLogado>>>['autorizador'] }) => Promise<unknown>) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('core.feriados.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  let destino: string;
  try {
    const r = await agir({ app, quem: usuario.autorizador });
    destino = `/admin/feriados?ok=${encodeURIComponent(sucesso(r as never))}`;
  } catch (erro) {
    if (erro instanceof ErroConflito) {
      destino = `/admin/feriados?erro=${encodeURIComponent('A lista mudou enquanto você editava. Confira e tente de novo.')}`;
    } else if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) {
      const dados = new URLSearchParams({ erro: erro.message });
      const data = texto(f, 'data');
      const nome = texto(f, 'nome');
      if (data) dados.set('data', data);
      if (nome) dados.set('nome', nome);
      destino = `/admin/feriados?${dados.toString()}`;
    } else throw erro;
  }
  redirect(destino);
}

export async function acaoIncluirFeriado(f: FormData) {
  await executar(f, () => 'Feriado incluído.', ({ app, quem }) => incluirFeriado(app.planilhas, quem, { data: texto(f, 'data'), nome: texto(f, 'nome') }));
}

export async function acaoIncluirFeriadosNacionais(f: FormData) {
  const ano = Number(texto(f, 'ano'));
  await executar(
    f,
    (n) => ((n as number) ? `${n} feriados de ${ano} incluídos.` : `Os feriados nacionais de ${ano} já estavam todos cadastrados.`),
    ({ app, quem }) => incluirFeriadosNacionais(app.planilhas, quem, ano),
  );
}

export async function acaoTirarFeriado(f: FormData) {
  await executar(f, () => 'Feriado tirado da lista.', ({ app, quem }) => tirarFeriado(app.planilhas, quem, texto(f, 'id'), Number(texto(f, 'versao'))));
}
