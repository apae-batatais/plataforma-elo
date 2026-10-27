/**
 * Monta quem está usando a plataforma a partir da sessão e das planilhas.
 *
 * Primeiro uso: com as planilhas em branco (sem abas), só o administrador
 * inicial consegue entrar, e com `estruturaPendente`, para que a primeira
 * coisa a fazer seja "Preparar estrutura".
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';

export interface UsuarioCarregado {
  email: string;
  nome: string;
  autorizador: Autorizador;
  perfis: { nome: string; escopo: string }[];
  /** As planilhas ainda não têm as abas: só "Preparar estrutura" funciona. */
  estruturaPendente: boolean;
}

const ADMINISTRADOR_INICIAL = { nome: 'Administrador inicial', escopo: 'configuração da hospedagem' };

export async function carregarUsuario(
  p: Planilhas,
  sessao: { email: string; nome: string },
  opcoes: { administradorInicial: boolean },
): Promise<UsuarioCarregado | null> {
  let tabelas;
  try {
    tabelas = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos, Perfis] as const);
  } catch (erro) {
    if (!(erro instanceof ErroEstruturaAusente)) throw erro;
    if (!opcoes.administradorInicial) return null;
    const vazio = { usuarios: [], atribuicoes: [], perfilPermissoes: [], servicos: [] };
    return {
      ...sessao,
      autorizador: new Autorizador(sessao.email, vazio, { administradorInicial: true }),
      perfis: [ADMINISTRADOR_INICIAL],
      estruturaPendente: true,
    };
  }

  const [usuarios, atribuicoes, perfilPermissoes, servicos, perfis] = tabelas;
  const autorizador = new Autorizador(
    sessao.email,
    { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() },
    { administradorInicial: opcoes.administradorInicial },
  );
  if (!autorizador.autorizado) return null;

  const nomePerfil = new Map(perfis.todos().map((x) => [x.codigo, x.nome]));
  const nomeServico = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));
  const descricaoEscopo = (tipo: string, codigo: string | null) =>
    tipo === 'global' ? 'toda a instituição' : tipo === 'servico' ? `serviço ${nomeServico.get(codigo ?? '') ?? codigo}` : `${tipo} ${codigo}`;
  const lista = atribuicoes
    .ativos()
    .filter((a) => a.usuario_email === sessao.email)
    .map((a) => ({ nome: nomePerfil.get(a.perfil) ?? a.perfil, escopo: descricaoEscopo(a.escopo_tipo, a.escopo) }));
  if (opcoes.administradorInicial) lista.push(ADMINISTRADOR_INICIAL);

  return { ...sessao, autorizador, perfis: lista, estruturaPendente: false };
}

/**
 * O e-mail pode entrar? Administradores iniciais sempre; os demais precisam de
 * conta ativa. Sempre tenta ler as planilhas, para que um problema de acesso
 * (planilha não compartilhada, ID errado) apareça já na tela de login.
 */
export async function podeEntrar(p: Planilhas, email: string, administradorInicial: boolean): Promise<boolean> {
  try {
    const temConta = (await lerTabela(p, Usuarios)).ativos().some((u) => u.email === email);
    return temConta || administradorInicial;
  } catch (erro) {
    if (erro instanceof ErroEstruturaAusente) return administradorInicial;
    throw erro;
  }
}
