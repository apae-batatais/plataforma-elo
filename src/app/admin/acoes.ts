'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import {
  analisarServicosEmLote, atribuirPerfil, cadastrarServico, cadastrarServicosEmLote, cadastrarUsuario, desativarUsuario, encerrarAtribuicao,
  ErroValidacao, type LinhaServicoLote,
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
      unidade: texto(f, 'unidade'),
      area: texto(f, 'area'),
      vagas: vagas === '' ? null : Number(vagas),
    }),
  );
}

// ---------------------------------------------------------------------------
// Serviços em lote
// ---------------------------------------------------------------------------

export interface EstadoLote {
  erro?: string;
  linhas?: LinhaServicoLote[];
  texto?: string;
}

export async function acaoConferirServicosEmLote(_: EstadoLote, f: FormData): Promise<EstadoLote> {
  const { usuario, app } = await contexto();
  const conteudo = texto(f, 'lista');
  if (!conteudo) return { erro: 'Cole a lista de serviços no campo.' };
  try {
    const linhas = await analisarServicosEmLote(app.planilhas, usuario.autorizador, conteudo);
    if (linhas.length === 0) return { erro: 'Não encontrei nenhuma linha com nome de serviço.', texto: conteudo };
    return { linhas, texto: conteudo };
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }
}

export async function acaoCadastrarServicosEmLote(estado: EstadoLote, f: FormData): Promise<EstadoLote> {
  const { usuario, app } = await contexto();
  let n: number;
  try {
    const linhas = (JSON.parse(texto(f, 'linhas')) as LinhaServicoLote[])
      .filter((l) => l.situacao === 'ok' && l.area && l.unidade)
      .map((l) => ({ codigo: l.codigo, nome: l.nome, area: l.area!, unidade: l.unidade!, vagas: l.vagas }));
    n = await cadastrarServicosEmLote(app.planilhas, usuario.autorizador, linhas);
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) return { ...estado, erro: erro.message };
    if (erro instanceof SyntaxError) return { ...estado, erro: 'A lista veio incompleta. Confira de novo.' };
    throw erro;
  }
  redirect(`/admin/servicos?ok=${encodeURIComponent(`${n} ${n === 1 ? 'serviço cadastrado' : 'serviços cadastrados'}.`)}`);
}
