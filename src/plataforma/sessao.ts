/**
 * Quem está usando a plataforma agora (somente servidor).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { assinarSessao, DURACAO_SESSAO_HORAS, lerSessao } from '@/nucleo/sessao/token';
import { obterAplicacao } from './aplicacao';

export const COOKIE_SESSAO = 'plataforma_sessao';

export interface UsuarioLogado {
  email: string;
  nome: string;
  autorizador: Autorizador;
  perfis: { nome: string; escopo: string }[];
  demonstracao: boolean;
}

export async function usuarioLogado(): Promise<UsuarioLogado | null> {
  const app = await obterAplicacao();
  const sessao = await lerSessao(app.config.segredoSessao, (await cookies()).get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;

  const [usuarios, atribuicoes, perfilPermissoes, servicos, perfis] = await lerTabelas(app.planilhas, [
    Usuarios,
    Atribuicoes,
    PerfilPermissoes,
    Servicos,
    Perfis,
  ] as const);
  const administradorInicial =
    app.config.modo === 'producao' && app.config.administradoresIniciais.includes(sessao.email);
  const autorizador = new Autorizador(
    sessao.email,
    {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    },
    { administradorInicial },
  );
  if (!autorizador.autorizado) return null;

  const nomePerfil = new Map(perfis.todos().map((p) => [p.codigo, p.nome]));
  const nomeServico = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));
  const descricaoEscopo = (tipo: string, codigo: string | null) =>
    tipo === 'global' ? 'toda a instituição' : tipo === 'servico' ? `serviço ${nomeServico.get(codigo ?? '') ?? codigo}` : `${tipo} ${codigo}`;
  const perfisDoUsuario = atribuicoes
    .ativos()
    .filter((a) => a.usuario_email === sessao.email)
    .map((a) => ({ nome: nomePerfil.get(a.perfil) ?? a.perfil, escopo: descricaoEscopo(a.escopo_tipo, a.escopo) }));
  if (administradorInicial) perfisDoUsuario.push({ nome: 'Administrador inicial', escopo: 'configuração da hospedagem' });

  return { ...sessao, autorizador, perfis: perfisDoUsuario, demonstracao: app.config.modo === 'demonstracao' };
}

export async function iniciarSessao(email: string, nome: string): Promise<void> {
  const app = await obterAplicacao();
  (await cookies()).set(COOKIE_SESSAO, await assinarSessao(app.config.segredoSessao, email, nome), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_HORAS * 3600,
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}
