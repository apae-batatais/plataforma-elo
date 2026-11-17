/**
 * Cadastro de áreas: nome único (sem diferença de acento/maiúsculas),
 * editar, excluir (encerrar) e reativar. Dados fictícios.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { cadastrarArea, cadastrarServico, editarArea, excluirArea, excluirServico, reativarArea } from '@/nucleo/acesso/gestao';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Areas, Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const leitura = () => lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
const admin = async () => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await leitura();
  return new Autorizador('diretoria@inst-a-exemplo.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, { administradorInicial: true });
};
const area = async (codigo: string) => (await lerTabela(p, Areas)).todos().find((a) => a.codigo === codigo)!;

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('áreas', () => {
  it('cadastra com código gerado do nome e audita', async () => {
    const codigo = await cadastrarArea(p, await admin(), { nome: '  Esporte   e Lazer ' });
    expect(codigo).toBe('esporte_e_lazer');
    expect((await area('esporte_e_lazer')).nome).toBe('Esporte e Lazer');
    const a = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Areas');
    expect(a.map((x) => x.acao)).toEqual(['inclusao']);
  });

  it('nunca aceita duas áreas com o mesmo nome, nem com acento ou maiúscula diferente', async () => {
    const adm = await admin();
    await expect(cadastrarArea(p, adm, { nome: 'Saúde' })).rejects.toThrow(/Já existe uma área chamada "Saúde"/);
    await expect(cadastrarArea(p, adm, { nome: 'saude' })).rejects.toThrow(/Já existe/);
    await expect(cadastrarArea(p, adm, { nome: 'ASSISTÊNCIA  SOCIAL' })).rejects.toThrow(/Já existe/);
    await expect(cadastrarArea(p, adm, { nome: '  ' })).rejects.toThrow(/Informe o nome/);
    const educacao = await area('educacao');
    await expect(editarArea(p, adm, educacao.id, educacao.versao, { nome: 'saúde' })).rejects.toThrow(/Já existe/);
  });

  it('editar muda só o nome; os serviços continuam ligados pelo código', async () => {
    const adm = await admin();
    await cadastrarServico(p, adm, { codigo: 'escola', nome: 'Escola', unidade: 'sede', area: 'educacao', vagas: null });
    const a = await area('educacao');
    await editarArea(p, adm, a.id, a.versao, { nome: 'Educação Especial' });
    expect((await area('educacao')).nome).toBe('Educação Especial');
    expect((await lerTabela(p, Servicos)).ativos().find((s) => s.codigo === 'escola')!.area).toBe('educacao');
  });

  it('não exclui área com serviços; excluída não aceita nome repetido e pode ser reativada', async () => {
    const adm = await admin();
    await cadastrarServico(p, adm, { codigo: 'escola', nome: 'Escola', unidade: 'sede', area: 'educacao', vagas: null });
    let a = await area('educacao');
    await expect(excluirArea(p, adm, a.id, a.versao)).rejects.toThrow(/1 serviço pertence/);
    const s = (await lerTabela(p, Servicos)).ativos().find((x) => x.codigo === 'escola')!;
    await excluirServico(p, adm, s.id, s.versao);
    await excluirArea(p, adm, a.id, a.versao);
    a = await area('educacao');
    expect(a.ativo).toBe(false);
    await expect(cadastrarArea(p, adm, { nome: 'educação' })).rejects.toThrow(/área excluída.*Reative/);
    await reativarArea(p, adm, a.id, a.versao);
    expect((await area('educacao')).ativo).toBe(true);
  });

  it('só quem gerencia a organização mexe nas áreas', async () => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await leitura();
    const outro = new Autorizador('alguem@inst-a-exemplo.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
    const a = await area('saude');
    await expect(cadastrarArea(p, outro, { nome: 'Nova' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(editarArea(p, outro, a.id, a.versao, { nome: 'X' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(excluirArea(p, outro, a.id, a.versao)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(reativarArea(p, outro, a.id, a.versao)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
