'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import {
  atribuirPerfil, cadastrarServico, cadastrarUsuario, desativarUsuario, encerrarAtribuicao, ErroValidacao,
} from '@/nucleo/acesso/gestao';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ESCOPOS, type EscopoTipo } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

/** Executa um caso de uso e volta para a página com uma mensagem de sucesso ou de erro. */
async function executar(pagina: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<void>) {
  const ctx = await contexto();
  let destino: string;
  try {
    await acao(ctx);
    destino = `${pagina}?ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroConflito || erro instanceof ErroPermissao) {
      destino = `${pagina}?erro=${encodeURIComponent(erro.message)}`;
    } else {
      throw erro;
    }
  }
  redirect(destino);
}

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  return { usuario, app, dominio: app.config.modo === 'producao' ? app.config.dominio : null };
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

export async function acaoCadastrarUsuario(f: FormData) {
  await executar('/admin/acessos', 'Usuário cadastrado.', ({ usuario, app, dominio }) =>
    cadastrarUsuario(app.planilhas, usuario.autorizador, { email: texto(f, 'email'), nome: texto(f, 'nome') }, dominio),
  );
}

export async function acaoDesativarUsuario(f: FormData) {
  await executar('/admin/acessos', 'Acesso desativado.', ({ usuario, app }) =>
    desativarUsuario(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoAtribuirPerfil(f: FormData) {
  const [tipo, codigo] = texto(f, 'escopo').split(':');
  await executar('/admin/acessos', 'Perfil atribuído.', ({ usuario, app }) => {
    if (!(ESCOPOS as readonly string[]).includes(tipo)) throw new ErroValidacao('Escolha onde o perfil vale.');
    return atribuirPerfil(app.planilhas, usuario.autorizador, {
      email: texto(f, 'email'),
      perfil: texto(f, 'perfil'),
      escopoTipo: tipo as EscopoTipo,
      escopo: codigo || null,
    });
  });
}

export async function acaoEncerrarAtribuicao(f: FormData) {
  await executar('/admin/acessos', 'Perfil retirado.', ({ usuario, app }) =>
    encerrarAtribuicao(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoCadastrarServico(f: FormData) {
  const vagas = texto(f, 'vagas');
  await executar('/admin/servicos', 'Serviço cadastrado.', ({ usuario, app }) =>
    cadastrarServico(app.planilhas, usuario.autorizador, {
      codigo: texto(f, 'codigo'),
      nome: texto(f, 'nome'),
      eixo: texto(f, 'eixo'),
      unidade: texto(f, 'unidade'),
      area: texto(f, 'area') || null,
      vagas: vagas === '' ? null : Number(vagas),
    }),
  );
}
