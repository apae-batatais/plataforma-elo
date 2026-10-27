'use server';

import { redirect } from 'next/navigation';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { podeEntrar } from '@/nucleo/sessao/carregar';
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
    const administradorInicial = app.config.administradoresIniciais.includes(id.email);
    if (!(await podeEntrar(app.planilhas, id.email, administradorInicial))) {
      return { erro: `O e-mail ${id.email} ainda não tem acesso à plataforma. Peça à administração.` };
    }
    await iniciarSessao(id.email, id.nome);
    try {
      await registrarAuditoria(app.planilhas, { usuario: id.email, acao: 'entrada', entidade: 'sessao' });
    } catch (erro) {
      // Primeiro uso: a aba de auditoria ainda não existe; ela é criada em "Preparar estrutura".
      if (!(erro instanceof ErroEstruturaAusente)) throw erro;
    }
    return {};
  } catch (erro) {
    if (erro instanceof ErroLogin || erro instanceof ErroArmazenamento) return { erro: erro.message };
    throw erro;
  }
}

export async function sair() {
  await encerrarSessao();
  redirect('/entrar');
}
