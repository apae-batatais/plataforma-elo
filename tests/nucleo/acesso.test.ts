/**
 * Regras de acesso da camada de aplicação: quem vê e quem altera cada pessoa.
 * Mesmos cenários que antes eram garantidos pelo banco.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import {
  Atribuicoes, PerfilPermissoes, Pessoas, Servicos, Usuarios, VinculosFamiliares, VinculosServico,
} from '@/nucleo/estrutura/tabelas';
import { listarPessoasVisiveis } from '@/nucleo/pessoas/servico';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const sistema = { email: 'sistema' };
const ids: Record<string, string> = {};

async function usuario(email: string, atribuicoes: { perfil: string; escopo_tipo?: 'global' | 'servico' | 'unidade' | 'area'; escopo?: string; inicio?: string; fim?: string }[]) {
  const pessoa = await inserir(p, Pessoas, { nome: `Conta ${email}` }, sistema);
  await inserir(p, Usuarios, { email, pessoa_id: pessoa.id }, sistema);
  for (const a of atribuicoes) {
    await inserir(p, Atribuicoes, { usuario_email: email, perfil: a.perfil, escopo_tipo: a.escopo_tipo ?? 'global', escopo: a.escopo ?? null, inicio: a.inicio ?? null, fim: a.fim ?? null }, sistema);
  }
}

async function autorizador(email: string, opcoes: { administradorInicial?: boolean } = {}) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, opcoes);
}

async function nomesVisiveis(email: string) {
  return (await listarPessoasVisiveis(p, await autorizador(email))).map((x) => x.nome);
}

beforeAll(async () => {
  p = await planilhasDeTeste();
  await inserir(p, Servicos, { codigo: 'ur', nome: 'Unidade Referenciada', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social' }, sistema);
  await inserir(p, Servicos, { codigo: 'cer_reab', nome: 'Reabilitação', eixo: 'saude', unidade: 'cer', area: 'saude' }, sistema);
  ids.ana = (await inserir(p, Pessoas, { nome: 'Ana Atendida UR' }, sistema)).id;
  ids.bruno = (await inserir(p, Pessoas, { nome: 'Bruno Atendido CER' }, sistema)).id;
  ids.carla = (await inserir(p, Pessoas, { nome: 'Carla Mãe da Ana' }, sistema)).id;
  await inserir(p, VinculosServico, { pessoa_id: ids.ana, servico: 'ur' }, sistema);
  await inserir(p, VinculosServico, { pessoa_id: ids.bruno, servico: 'cer_reab' }, sistema);
  await inserir(p, VinculosFamiliares, { pessoa_id: ids.ana, relacionado_id: ids.carla, parentesco: 'mãe', responsavel_legal: true, cuidador_principal: true }, sistema);

  await usuario('admin@teste.org', [{ perfil: 'administrador_plataforma' }]);
  await usuario('diretora@teste.org', [{ perfil: 'diretoria' }]);
  await usuario('coord.ur@teste.org', [{ perfil: 'coordenacao_servico', escopo_tipo: 'servico', escopo: 'ur' }]);
  await usuario('coord.sede@teste.org', [{ perfil: 'coordenacao_servico', escopo_tipo: 'unidade', escopo: 'sede' }]);
  await usuario('tecnico.cer@teste.org', [{ perfil: 'tecnico_avaliador', escopo_tipo: 'servico', escopo: 'cer_reab' }]);
  await usuario('sem.perfil@teste.org', []);
  await usuario('ex.coord@teste.org', [{ perfil: 'coordenacao_servico', escopo_tipo: 'servico', escopo: 'ur', inicio: '2020-01-01', fim: '2021-01-01' }]);
});

describe('quem vê cada pessoa', () => {
  it('administrador da plataforma não vê atendidos, só a si mesmo', async () => {
    expect(await nomesVisiveis('admin@teste.org')).toEqual(['Conta admin@teste.org']);
  });

  it('diretoria vê todas as pessoas', async () => {
    expect(await nomesVisiveis('diretora@teste.org')).toEqual(expect.arrayContaining(['Ana Atendida UR', 'Bruno Atendido CER', 'Carla Mãe da Ana']));
  });

  it('coordenação da UR vê atendidos da UR e familiares, mas não os do CER', async () => {
    const nomes = await nomesVisiveis('coord.ur@teste.org');
    expect(nomes).toEqual(expect.arrayContaining(['Ana Atendida UR', 'Carla Mãe da Ana']));
    expect(nomes).not.toContain('Bruno Atendido CER');
  });

  it('escopo de unidade cobre os serviços daquela unidade', async () => {
    const nomes = await nomesVisiveis('coord.sede@teste.org');
    expect(nomes).toContain('Ana Atendida UR');
    expect(nomes).not.toContain('Bruno Atendido CER');
  });

  it('técnico do CER vê só atendidos do CER', async () => {
    const nomes = await nomesVisiveis('tecnico.cer@teste.org');
    expect(nomes).toContain('Bruno Atendido CER');
    expect(nomes).not.toContain('Ana Atendida UR');
  });

  it('usuário sem perfil vê apenas a si mesmo', async () => {
    expect(await nomesVisiveis('sem.perfil@teste.org')).toEqual(['Conta sem.perfil@teste.org']);
  });

  it('atribuição vencida não vale', async () => {
    expect(await nomesVisiveis('ex.coord@teste.org')).toEqual(['Conta ex.coord@teste.org']);
  });

  it('quem cadastra vê a pessoa até ela ser vinculada a um serviço fora do seu escopo', async () => {
    const nova = await inserir(p, Pessoas, { nome: 'Gabi Recém Cadastrada' }, { email: 'coord.ur@teste.org' });
    expect(await nomesVisiveis('coord.ur@teste.org')).toContain('Gabi Recém Cadastrada');
    await inserir(p, VinculosServico, { pessoa_id: nova.id, servico: 'cer_reab' }, sistema);
    expect(await nomesVisiveis('coord.ur@teste.org')).not.toContain('Gabi Recém Cadastrada');
  });

  it('e-mail sem conta não é autorizado; administrador inicial é', async () => {
    expect((await autorizador('estranho@teste.org')).autorizado).toBe(false);
    const inicial = await autorizador('primeira.admin@teste.org', { administradorInicial: true });
    expect(inicial.autorizado).toBe(true);
    expect(inicial.temPermissao('core.organizacao.gerenciar')).toBe(true);
  });
});

describe('quem altera', () => {
  it('coordenação edita atendido do seu serviço; técnico não edita cadastro', async () => {
    const dados = await (async () => {
      const [pessoas, vs, vf] = await lerTabelas(p, [Pessoas, VinculosServico, VinculosFamiliares] as const);
      return { pessoas: pessoas.ativos(), vinculosServico: vs.ativos(), vinculosFamiliares: vf.ativos() };
    })();
    expect((await autorizador('coord.ur@teste.org')).podeEditarPessoa(ids.ana, dados)).toBe(true);
    expect((await autorizador('coord.ur@teste.org')).podeEditarPessoa(ids.bruno, dados)).toBe(false);
    expect((await autorizador('tecnico.cer@teste.org')).podeEditarPessoa(ids.bruno, dados)).toBe(false);
  });

  it('vínculos só no próprio escopo', async () => {
    const coord = await autorizador('coord.ur@teste.org');
    expect(coord.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: 'ur' })).toBe(true);
    expect(coord.temPermissao('core.vinculos.editar', { tipo: 'servico', codigo: 'cer_reab' })).toBe(false);
  });
});
