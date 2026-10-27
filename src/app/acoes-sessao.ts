'use server';

import { redirect } from 'next/navigation';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { conferirLoginGoogle, ErroLogin } from '@/nucleo/sessao/google';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { encerrarSessao, iniciarSessao } from '@/plataforma/sessao';

/** Demonstração: entra como um usuário fictício (sem senha, só dados fictícios). */
export async function entrarNaDemonstracao(formulario: FormData) {
  const app = await obterAplicacao();
  if (app.config.modo !== 'demonstracao') throw new Error('Entrada fictícia só existe na demonstração.');
  const email = String(formulario.get('email') ?? '');
  const conta = (await lerTabela(app.planilhas, Usuarios)).ativos().find((u) => u.email === email);
  if (!conta) throw new Error('Usuário fictício não encontrado.');
  await iniciarSessao(email, String(formulario.get('nome') ?? email));
  redirect('/');
}

/** Produção: confere o login do Google e verifica se o e-mail tem acesso. */
export async function entrarComGoogle(credencial: string): Promise<{ erro?: string }> {
  const app = await obterAplicacao();
  if (app.config.modo !== 'producao') return { erro: 'Login Google desativado na demonstração.' };
  try {
    const id = await conferirLoginGoogle(credencial, app.config.googleClientId, app.config.dominio);
    const temConta = (await lerTabela(app.planilhas, Usuarios)).ativos().some((u) => u.email === id.email);
    if (!temConta && !app.config.administradoresIniciais.includes(id.email)) {
      return { erro: `O e-mail ${id.email} ainda não tem acesso à plataforma. Peça à administração.` };
    }
    await iniciarSessao(id.email, id.nome);
    await registrarAuditoria(app.planilhas, { usuario: id.email, acao: 'entrada', entidade: 'sessao' });
    return {};
  } catch (erro) {
    if (erro instanceof ErroLogin) return { erro: erro.message };
    throw erro;
  }
}

export async function sair() {
  await encerrarSessao();
  redirect('/entrar');
}
