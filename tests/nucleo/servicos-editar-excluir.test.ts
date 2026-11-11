/**
 * Editar, excluir (encerrar) e reativar serviços. Nada é apagado da planilha.
 * Dados fictícios.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atribuirPerfil, cadastrarServico, cadastrarUsuario, editarServico, excluirServico, reativarServico } from '@/nucleo/acesso/gestao';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const leitura = () => lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
const admin = async () => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await leitura();
  return new Autorizador('diretoria@apaebatatais.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, { administradorInicial: true });
};
const servico = async (codigo: string) => (await lerTabela(p, Servicos)).todos().find((s) => s.codigo === codigo)!;

beforeEach(async () => {
  p = await planilhasDeTeste();
  await cadastrarServico(p, await admin(), { codigo: 'oficina', nome: 'Oficina', unidade: 'sede', area: 'assistencia_social', vagas: 10 });
});

describe('editar serviço', () => {
  it('altera nome, área, unidade e vagas, mantém o código e audita só as colunas', async () => {
    const s = await servico('oficina');
    await editarServico(p, await admin(), s.id, s.versao, { nome: 'Oficina de Artes', unidade: 'filial', area: 'educacao', vagas: null });
    const depois = await servico('oficina');
    expect([depois.nome, depois.unidade, depois.area, depois.vagas, depois.codigo]).toEqual(['Oficina de Artes', 'filial', 'educacao', null, 'oficina']);
    const a = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Servicos' && x.acao === 'alteracao');
    expect(a).toHaveLength(1);
    expect(JSON.stringify(a[0].detalhes)).not.toContain('Oficina de Artes');
  });

  it('recusa área inexistente e versão desatualizada', async () => {
    const s = await servico('oficina');
    const adm = await admin();
    await expect(editarServico(p, adm, s.id, s.versao, { nome: 'X', unidade: 'sede', area: 'nao_existe', vagas: null })).rejects.toThrow(/área/);
    await editarServico(p, adm, s.id, s.versao, { nome: 'Y', unidade: 'sede', area: 'assistencia_social', vagas: 10 });
    await expect(editarServico(p, adm, s.id, s.versao, { nome: 'Z', unidade: 'sede', area: 'assistencia_social', vagas: 10 })).rejects.toThrow();
  });
});

describe('excluir e reativar serviço', () => {
  it('excluir encerra o registro (ativo = FALSE, fim) sem apagar; reativar traz de volta', async () => {
    const adm = await admin();
    let s = await servico('oficina');
    await excluirServico(p, adm, s.id, s.versao);
    s = await servico('oficina');
    expect(s.ativo).toBe(false);
    expect(s.fim).toBeTruthy();
    expect((await lerTabela(p, Servicos)).ativos().some((x) => x.codigo === 'oficina')).toBe(false);
    // o código continua reservado
    await expect(cadastrarServico(p, adm, { codigo: 'oficina', nome: 'Outra', unidade: 'sede', area: 'saude', vagas: null })).rejects.toThrow(/código/);
    await reativarServico(p, adm, s.id, s.versao);
    s = await servico('oficina');
    expect([s.ativo, s.fim]).toEqual([true, null]);
    const acoes = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Servicos').map((x) => x.acao);
    expect(acoes).toEqual(['inclusao', 'encerramento', 'alteracao']);
  });

  it('não exclui serviço com perfil de acesso ou atendido ligado a ele', async () => {
    const adm = await admin();
    await cadastrarUsuario(p, adm, { email: 'coord@apaebatatais.org.br', nome: 'Coordenação Fictícia' }, null);
    await atribuirPerfil(p, adm, { email: 'coord@apaebatatais.org.br', perfil: 'coordenacao_servico', escopoTipo: 'servico', escopo: 'oficina' });
    const s = await servico('oficina');
    await expect(excluirServico(p, adm, s.id, s.versao)).rejects.toThrow(/perfil de acesso/);

    await cadastrarServico(p, adm, { codigo: 'horta', nome: 'Horta', unidade: 'filial', area: 'educacao', vagas: null });
    await inserir(p, VinculosServico, { pessoa_id: 'pessoa-ficticia', servico: 'horta', entrada: '2026-01-01' }, { email: 'teste' });
    const h = await servico('horta');
    await expect(excluirServico(p, adm, h.id, h.versao)).rejects.toThrow(/vinculada/);
  });

  it('só quem gerencia a organização edita, exclui ou reativa', async () => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await leitura();
    const outro = new Autorizador('alguem@apaebatatais.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
    const s = await servico('oficina');
    await expect(editarServico(p, outro, s.id, s.versao, { nome: 'X', unidade: 'sede', area: 'saude', vagas: null })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(excluirServico(p, outro, s.id, s.versao)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(reativarServico(p, outro, s.id, s.versao)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
