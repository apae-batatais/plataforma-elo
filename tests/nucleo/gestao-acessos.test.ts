import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import {
  atribuirPerfil, cadastrarServico, cadastrarUsuario, desativarUsuario, encerrarAtribuicao, ErroValidacao, painelDeAcessos,
} from '@/nucleo/acesso/gestao';
import { ErroConflito, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const DOMINIO = 'inst-a-exemplo.org.br';

async function como(email: string, opcoes: { administradorInicial?: boolean } = {}) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, opcoes);
}

const admin = () => como(`diretoria@${DOMINIO}`, { administradorInicial: true });

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('primeiro acesso de produção', () => {
  it('o administrador inicial cadastra uma pessoa, dá um perfil e ela passa a entrar', async () => {
    const adm = await admin();
    await cadastrarServico(p, adm, { codigo: 'ur', nome: 'Unidade Referenciada', unidade: 'sede', area: 'assistencia_social', vagas: null });
    await cadastrarUsuario(p, adm, { email: `Coord.UR@${DOMINIO}`, nome: 'Maria Coordenadora' }, DOMINIO);
    await atribuirPerfil(p, await admin(), { email: `coord.ur@${DOMINIO}`, perfil: 'coordenacao_servico', escopoTipo: 'servico', escopo: 'ur' });

    const coord = await como(`coord.ur@${DOMINIO}`);
    expect(coord.autorizado).toBe(true);
    expect(coord.temPermissao('core.pessoas.ver', { tipo: 'servico', codigo: 'ur' })).toBe(true);
    expect(coord.temPermissao('core.pessoas.ver')).toBe(false);

    const painel = await painelDeAcessos(p, await admin());
    expect(painel.usuarios).toEqual([
      expect.objectContaining({ nome: 'Maria Coordenadora', ativo: true, atribuicoes: [expect.objectContaining({ perfil: 'Coordenação de serviço', escopo: 'Serviço Unidade Referenciada', vigente: true })] }),
    ]);
  });
});

describe('validações', () => {
  it('só aceita e-mail institucional e não duplica', async () => {
    await expect(cadastrarUsuario(p, await admin(), { email: 'alguem@gmail.com', nome: 'Alguém' }, DOMINIO)).rejects.toThrow(/institucional/);
    await cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO);
    await expect(cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO)).rejects.toBeInstanceOf(ErroValidacao);
  });

  it('perfil com escopo exige um escopo que existe; perfil repetido é recusado', async () => {
    const adm = await admin();
    await cadastrarUsuario(p, adm, { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO);
    await expect(atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'coordenacao_servico', escopoTipo: 'servico', escopo: 'nao_existe' })).rejects.toThrow(/onde o perfil vale/);
    await atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null });
    await expect(atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null })).rejects.toThrow(/já está atribuído/);
  });

  it('serviço: código sem espaços, sem repetir, com unidade existente', async () => {
    const adm = await admin();
    await expect(cadastrarServico(p, adm, { codigo: 'Centro Dia', nome: 'Centro Dia', unidade: 'sede', area: 'assistencia_social', vagas: null })).rejects.toThrow(/minúsculas/);
    await cadastrarServico(p, adm, { codigo: 'centro_dia', nome: 'Centro Dia', unidade: 'sede', area: 'assistencia_social', vagas: 80 });
    await expect(cadastrarServico(p, adm, { codigo: 'centro_dia', nome: 'Outro', unidade: 'filial', area: 'saude', vagas: null })).rejects.toThrow(/Já existe/);
    await expect(cadastrarServico(p, adm, { codigo: 'y', nome: 'Y', unidade: 'sede', area: 'lua', vagas: null })).rejects.toThrow(/área/);
    await expect(cadastrarServico(p, adm, { codigo: 'x', nome: 'X', unidade: 'lua', area: 'saude', vagas: null })).rejects.toThrow(/Unidade/);
  });
});

describe('retirar acesso', () => {
  it('retirar perfil e desativar usuário não apagam nada e cortam o acesso', async () => {
    await cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO);
    await atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null });
    expect((await como(`ana@${DOMINIO}`)).temPermissao('core.pessoas.ver')).toBe(true);

    const atrib = (await lerTabela(p, Atribuicoes)).todos()[0];
    await encerrarAtribuicao(p, await admin(), atrib.id, atrib.versao);
    expect((await como(`ana@${DOMINIO}`)).temPermissao('core.pessoas.ver')).toBe(false);

    const conta = (await lerTabela(p, Usuarios)).todos()[0];
    await desativarUsuario(p, await admin(), conta.id, conta.versao);
    expect((await como(`ana@${DOMINIO}`)).autorizado).toBe(false);
    expect((await lerTabela(p, Usuarios)).todos()).toHaveLength(1);
    expect((await lerTabela(p, Atribuicoes)).todos()).toHaveLength(1);
  });

  it('dois administradores retirando o mesmo perfil ao mesmo tempo: o segundo é avisado', async () => {
    await cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO);
    await atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null });
    const atrib = (await lerTabela(p, Atribuicoes)).todos()[0];
    await encerrarAtribuicao(p, await admin(), atrib.id, atrib.versao);
    await expect(encerrarAtribuicao(p, await admin(), atrib.id, atrib.versao)).rejects.toBeInstanceOf(ErroConflito);
  });

  it('ninguém desativa o próprio acesso', async () => {
    await cadastrarUsuario(p, await admin(), { email: `diretoria@${DOMINIO}`, nome: 'Diretoria' }, DOMINIO);
    const conta = (await lerTabela(p, Usuarios)).todos()[0];
    await expect(desativarUsuario(p, await admin(), conta.id, conta.versao)).rejects.toThrow(/próprio acesso/);
  });
});

describe('permissões e auditoria', () => {
  it('quem não gerencia acessos é recusado', async () => {
    await cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana' }, DOMINIO);
    await atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null });
    const ana = await como(`ana@${DOMINIO}`);
    await expect(cadastrarUsuario(p, ana, { email: `x@${DOMINIO}`, nome: 'X' }, DOMINIO)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(painelDeAcessos(p, ana)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(cadastrarServico(p, ana, { codigo: 'x', nome: 'X', unidade: 'filial', area: 'saude', vagas: null })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('cada alteração fica na auditoria, com autor e sem dados pessoais', async () => {
    await cadastrarUsuario(p, await admin(), { email: `ana@${DOMINIO}`, nome: 'Ana Pereira' }, DOMINIO);
    await atribuirPerfil(p, await admin(), { email: `ana@${DOMINIO}`, perfil: 'diretoria', escopoTipo: 'global', escopo: null });
    const registros = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(registros.map((r) => [r.usuario, r.acao, r.entidade])).toEqual([
      [`diretoria@${DOMINIO}`, 'inclusao', 'Usuarios'],
      [`diretoria@${DOMINIO}`, 'inclusao', 'Atribuicoes'],
    ]);
    expect(JSON.stringify(registros)).not.toContain('Ana Pereira');
  });
});
