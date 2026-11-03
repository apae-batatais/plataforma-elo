'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import {
  analisarServicosEmLote,
  atribuirPerfil,
  cadastrarArea,
  cadastrarServico,
  cadastrarServicosEmLote,
  cadastrarUsuario,
  desativarUsuario,
  editarArea,
  editarServico,
  encerrarAtribuicao,
  analisarUsuariosEmLote,
  cadastrarUsuariosEmLote,
  ErroValidacao,
  excluirArea,
  excluirServico,
  reativarArea,
  reativarServico,
  type LinhaServicoLote,
  type LinhaUsuarioLote,
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
    cadastrarUsuario(app.planilhas, usuario.autorizador, { email: texto(f, 'email'), nome: texto(f, 'nome'), perfil: texto(f, 'perfil') || null }, dominio),
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

export async function acaoEditarServico(f: FormData) {
  const vagas = texto(f, 'vagas');
  await executar('/admin/servicos', 'Serviço alterado.', ({ usuario, app }) =>
    editarServico(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), {
      nome: texto(f, 'nome'),
      unidade: texto(f, 'unidade'),
      area: texto(f, 'area'),
      vagas: vagas === '' ? null : Number(vagas),
    }),
  );
}

export async function acaoExcluirServico(f: FormData) {
  await executar('/admin/servicos', 'Serviço excluído. Ele fica guardado em “Serviços excluídos”.', ({ usuario, app }) =>
    excluirServico(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoReativarServico(f: FormData) {
  await executar('/admin/servicos', 'Serviço reativado.', ({ usuario, app }) =>
    reativarServico(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
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

// ---------------------------------------------------------------------------
// Usuários em lote
// ---------------------------------------------------------------------------

export interface EstadoLoteUsuarios {
  erro?: string;
  linhas?: LinhaUsuarioLote[];
  texto?: string;
}

export async function acaoConferirUsuariosEmLote(_: EstadoLoteUsuarios, f: FormData): Promise<EstadoLoteUsuarios> {
  const { usuario, app, dominio } = await contexto();
  const conteudo = texto(f, 'lista');
  if (!conteudo) return { erro: 'Cole a lista de pessoas no campo.' };
  try {
    const linhas = await analisarUsuariosEmLote(app.planilhas, usuario.autorizador, conteudo, dominio);
    if (linhas.length === 0) return { erro: 'Não encontrei nenhuma linha com nome e e-mail.', texto: conteudo };
    return { linhas, texto: conteudo };
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }
}

export async function acaoCadastrarUsuariosEmLote(estado: EstadoLoteUsuarios, f: FormData): Promise<EstadoLoteUsuarios> {
  const { usuario, app, dominio } = await contexto();
  let r: { novos: number; reativados: number; perfis: number };
  try {
    const linhas = (JSON.parse(texto(f, 'linhas')) as LinhaUsuarioLote[])
      .filter((l) => (l.situacao === 'novo' || l.situacao === 'perfil' || l.situacao === 'reativar') && l.perfil)
      .map((l) => ({ nome: l.nome, email: l.email, perfil: l.perfil!, escopoTipo: l.escopoTipo, escopo: l.escopo }));
    r = await cadastrarUsuariosEmLote(app.planilhas, usuario.autorizador, linhas, dominio);
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao || erro instanceof ErroConflito) return { ...estado, erro: erro.message };
    if (erro instanceof SyntaxError) return { ...estado, erro: 'A lista veio incompleta. Confira de novo.' };
    throw erro;
  }
  const partes = [
    r.novos ? `${r.novos} ${r.novos === 1 ? 'acesso novo' : 'acessos novos'}` : '',
    r.reativados ? `${r.reativados} ${r.reativados === 1 ? 'reativado' : 'reativados'}` : '',
    r.perfis ? `${r.perfis} ${r.perfis === 1 ? 'perfil atribuído' : 'perfis atribuídos'}` : '',
  ].filter(Boolean);
  redirect(`/admin/acessos?ok=${encodeURIComponent(`${partes.join(', ')}.`)}`);
}

// ---------------------------------------------------------------------------
// Áreas
// ---------------------------------------------------------------------------

export async function acaoCadastrarArea(f: FormData) {
  await executar('/admin/areas', 'Área cadastrada.', async ({ usuario, app }) => {
    await cadastrarArea(app.planilhas, usuario.autorizador, { nome: texto(f, 'nome') });
  });
}

export async function acaoEditarArea(f: FormData) {
  await executar('/admin/areas', 'Área alterada.', ({ usuario, app }) =>
    editarArea(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), { nome: texto(f, 'nome') }),
  );
}

export async function acaoExcluirArea(f: FormData) {
  await executar('/admin/areas', 'Área excluída. Ela fica guardada em “Áreas excluídas”.', ({ usuario, app }) =>
    excluirArea(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoReativarArea(f: FormData) {
  await executar('/admin/areas', 'Área reativada.', ({ usuario, app }) =>
    reativarArea(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}
