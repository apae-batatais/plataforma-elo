/**
 * Acessos em lote: a Administração cola nome, e-mail, perfil e onde vale,
 * confere a prévia e confirma. Perfil padrão: Funcionário. Dados fictícios.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { analisarUsuariosEmLote, cadastrarUsuario, cadastrarUsuariosEmLote, desativarUsuario } from '@/nucleo/acesso/gestao';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Perfis, Pessoas, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const como = async (email: string, administradorInicial = false) => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(
    email,
    { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() },
    { administradorInicial },
  );
};
const admin = () => como('diretoria@inst-a-exemplo.org.br', true);
const prontas = (l: Awaited<ReturnType<typeof analisarUsuariosEmLote>>) =>
  l
    .filter((x) => ['novo', 'perfil', 'reativar'].includes(x.situacao))
    .map((x) => ({ nome: x.nome, email: x.email, perfil: x.perfil!, escopoTipo: x.escopoTipo, escopo: x.escopo }));

const LISTA = [
  'Nome\tE-mail\tPerfil\tVale para',
  'Ana Exemplo\tANA.EXEMPLO@inst-a-exemplo.org.br',
  'Bruno Exemplo\tbruno.exemplo@inst-a-exemplo.org.br\tCoordenação de serviço\tEducação',
  'Carla Exemplo;carla.exemplo@inst-a-exemplo.org.br;financeiro',
  'Davi Exemplo\tdavi@gmail.com',
  'Eva Exemplo\teva.exemplo@inst-a-exemplo.org.br\tPerfil Inventado',
  'Fábio Exemplo\tfabio.exemplo@inst-a-exemplo.org.br\tFuncionário\tLugar Nenhum',
  'Ana de novo\tana.exemplo@inst-a-exemplo.org.br',
  'Gil\tsem-arroba',
].join('\n');

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('acessos em lote', () => {
  it('o perfil Funcionário existe e só dá o básico das requisições', async () => {
    expect((await lerTabela(p, Perfis)).ativos().some((x) => x.codigo === 'funcionario')).toBe(true);
  });

  it('lê a lista: perfil padrão Funcionário, perfil e escopo pelo nome, domínio institucional, repetidos e erros', async () => {
    const r = await analisarUsuariosEmLote(p, await admin(), LISTA, 'inst-a-exemplo.org.br');
    expect(r.map((l) => [l.email, l.perfil, l.escopoTipo, l.escopo, l.situacao])).toEqual([
      ['ana.exemplo@inst-a-exemplo.org.br', 'funcionario', 'global', null, 'novo'],
      ['bruno.exemplo@inst-a-exemplo.org.br', 'coordenacao_servico', 'area', 'educacao', 'novo'],
      ['carla.exemplo@inst-a-exemplo.org.br', 'financeiro', 'global', null, 'novo'],
      ['davi@gmail.com', 'funcionario', 'global', null, 'erro'],
      ['eva.exemplo@inst-a-exemplo.org.br', null, 'global', null, 'erro'],
      ['fabio.exemplo@inst-a-exemplo.org.br', 'funcionario', 'global', null, 'erro'],
      ['ana.exemplo@inst-a-exemplo.org.br', 'funcionario', 'global', null, 'ja_existe'],
      ['sem-arroba', 'funcionario', 'global', null, 'erro'],
    ]);
    expect(r[3].problema).toMatch(/@inst-a-exemplo.org.br/);
    expect(r[4].problema).toMatch(/Perfil "Perfil Inventado" não encontrado/);
    expect(r[5].problema).toMatch(/"Lugar Nenhum" não é unidade, área nem serviço/);
    expect(r[1].escopoNome).toBe('Área Educação');
  });

  it('cadastra pessoa, usuário e perfil em gravações em lote, com auditoria sem dados pessoais; repetir é recusado', async () => {
    const adm = await admin();
    const linhas = prontas(await analisarUsuariosEmLote(p, adm, LISTA, null));
    expect(await cadastrarUsuariosEmLote(p, adm, linhas, null)).toEqual({ novos: 4, reativados: 0, perfis: 4 }); // sem domínio exigido, o gmail passa
    const usuarios = (await lerTabela(p, Usuarios)).ativos().map((u) => u.email);
    expect(usuarios).toEqual(expect.arrayContaining(['ana.exemplo@inst-a-exemplo.org.br', 'bruno.exemplo@inst-a-exemplo.org.br']));
    expect((await lerTabela(p, Pessoas)).ativos().find((x) => x.email === 'ana.exemplo@inst-a-exemplo.org.br')?.nome).toBe('Ana Exemplo');
    const bruno = (await lerTabela(p, Atribuicoes)).ativos().find((a) => a.usuario_email === 'bruno.exemplo@inst-a-exemplo.org.br');
    expect([bruno?.perfil, bruno?.escopo_tipo, bruno?.escopo]).toEqual(['coordenacao_servico', 'area', 'educacao']);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Usuarios' || a.entidade === 'Atribuicoes');
    expect(aud.map((a) => [a.entidade, a.detalhes])).toEqual([
      ['Usuarios', JSON.stringify({ lote: 4 })],
      ['Atribuicoes', JSON.stringify({ lote: 4 })],
    ]);
    expect(JSON.stringify(aud)).not.toMatch(/exemplo@/);
    await expect(cadastrarUsuariosEmLote(p, adm, linhas, null)).rejects.toThrow(/já foi cadastrada/);
    // A Ana entra e só vê o básico: pedir e acompanhar as próprias requisições.
    const ana = await como('ana.exemplo@inst-a-exemplo.org.br');
    expect(ana.temPermissao('core.acessos.gerenciar')).toBe(false);
    // Sem permissão de ver pessoas, o item Pessoas some do menu (a lista viria vazia).
    const menu = (aut: Autorizador) => navegacaoDoUsuario(aut, false).flatMap((g) => g.itens.map((i) => i.rotulo));
    expect(menu(ana)).not.toContain('Pessoas');
    expect(menu(await como('bruno.exemplo@inst-a-exemplo.org.br'))).toContain('Pessoas');
  });

  it('quem já tem acesso só ganha o perfil; acesso desativado é reativado', async () => {
    const adm = await admin();
    await cadastrarUsuario(p, adm, { nome: 'Gabi Exemplo', email: 'gabi@inst-a-exemplo.org.br' }, null);
    await cadastrarUsuario(p, adm, { nome: 'Hugo Exemplo', email: 'hugo@inst-a-exemplo.org.br', perfil: 'funcionario' }, null);
    const hugo = (await lerTabela(p, Usuarios)).ativos().find((u) => u.email === 'hugo@inst-a-exemplo.org.br')!;
    await desativarUsuario(p, adm, hugo.id, hugo.versao);
    const r = await analisarUsuariosEmLote(p, adm, 'Gabi Exemplo\tgabi@inst-a-exemplo.org.br\nHugo Exemplo\thugo@inst-a-exemplo.org.br', null);
    expect(r.map((x) => x.situacao)).toEqual(['perfil', 'reativar']);
    expect(await cadastrarUsuariosEmLote(p, adm, prontas(r), null)).toEqual({ novos: 0, reativados: 1, perfis: 1 });
    expect((await lerTabela(p, Usuarios)).ativos().some((u) => u.email === 'hugo@inst-a-exemplo.org.br')).toBe(true);
    // O cadastro um a um com perfil já sai com o Funcionário.
    expect(
      (await lerTabela(p, Atribuicoes))
        .ativos()
        .filter((a) => a.perfil === 'funcionario')
        .map((a) => a.usuario_email)
        .sort(),
    ).toEqual(['gabi@inst-a-exemplo.org.br', 'hugo@inst-a-exemplo.org.br']);
  });

  it('só quem gerencia acessos usa o lote', async () => {
    await expect(analisarUsuariosEmLote(p, await como('ninguem@inst-a-exemplo.org.br'), LISTA, null)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
