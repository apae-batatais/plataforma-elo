/**
 * Testes de acesso do Núcleo (Row Level Security).
 * Garantem, no próprio banco, quem vê e quem altera cada pessoa.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarBancoTeste, criarUsuarioTeste, type BancoTeste } from '../apoio/banco-teste';

let b: BancoTeste;
const ids: Record<string, string> = {};

async function umId(sql: string, params: unknown[] = []): Promise<string> {
  const [linha] = (await b.admin(sql, params)) as { id: string }[];
  return linha.id;
}

beforeAll(async () => {
  b = await criarBancoTeste();

  const sede = await umId(`select id from core.unidade where codigo = 'sede'`);
  const cer = await umId(`select id from core.unidade where codigo = 'cer'`);
  ids.ur = await umId(
    `insert into core.servico (codigo, nome, eixo, unidade_id) values ('ur', 'Unidade Referenciada', 'assistencia_social', $1) returning id`,
    [sede],
  );
  ids.cerReab = await umId(
    `insert into core.servico (codigo, nome, eixo, unidade_id) values ('cer_reabilitacao', 'Reabilitação', 'saude', $1) returning id`,
    [cer],
  );

  ids.ana = await umId(`insert into core.pessoa (nome) values ('Ana Atendida UR') returning id`);
  ids.bruno = await umId(`insert into core.pessoa (nome) values ('Bruno Atendido CER') returning id`);
  ids.carla = await umId(`insert into core.pessoa (nome) values ('Carla Mãe da Ana') returning id`);
  await b.admin(`insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2), ($3, $4)`, [
    ids.ana, ids.ur, ids.bruno, ids.cerReab,
  ]);
  await b.admin(
    `insert into core.vinculo_familiar (pessoa_id, relacionado_id, parentesco, responsavel_legal) values ($1, $2, 'mãe', true)`,
    [ids.ana, ids.carla],
  );

  ids.admin = await criarUsuarioTeste(b, 'Admin Plataforma', [{ perfil: 'administrador_plataforma' }]);
  ids.diretora = await criarUsuarioTeste(b, 'Diretora', [{ perfil: 'diretoria' }]);
  ids.coordUR = await criarUsuarioTeste(b, 'Coordenadora UR', [
    { perfil: 'coordenacao_servico', escopoTipo: 'servico', escopoId: ids.ur },
  ]);
  ids.coordSede = await criarUsuarioTeste(b, 'Coordenador Sede', [
    { perfil: 'coordenacao_servico', escopoTipo: 'unidade', escopoId: sede },
  ]);
  ids.tecnicoCER = await criarUsuarioTeste(b, 'Tecnico CER', [
    { perfil: 'tecnico_avaliador', escopoTipo: 'servico', escopoId: ids.cerReab },
  ]);
  ids.semPerfil = await criarUsuarioTeste(b, 'Sem Perfil', []);
});

afterAll(async () => b.fechar());

async function nomesVisiveis(usuario: string): Promise<string[]> {
  const linhas = (await b.como(usuario, `select nome from core.pessoa order by nome`)) as { nome: string }[];
  return linhas.map((l) => l.nome);
}

describe('quem vê cada pessoa', () => {
  it('administrador da plataforma não vê atendidos, só a si mesmo', async () => {
    expect(await nomesVisiveis(ids.admin)).toEqual(['Admin Plataforma']);
  });

  it('diretoria vê todas as pessoas', async () => {
    const nomes = await nomesVisiveis(ids.diretora);
    expect(nomes).toEqual(expect.arrayContaining(['Ana Atendida UR', 'Bruno Atendido CER', 'Carla Mãe da Ana']));
  });

  it('coordenação da UR vê atendidos da UR e seus familiares, mas não os do CER', async () => {
    const nomes = await nomesVisiveis(ids.coordUR);
    expect(nomes).toEqual(expect.arrayContaining(['Ana Atendida UR', 'Carla Mãe da Ana']));
    expect(nomes).not.toContain('Bruno Atendido CER');
  });

  it('escopo de unidade cobre os serviços daquela unidade', async () => {
    const nomes = await nomesVisiveis(ids.coordSede);
    expect(nomes).toContain('Ana Atendida UR');
    expect(nomes).not.toContain('Bruno Atendido CER');
  });

  it('técnico do CER vê só atendidos do CER', async () => {
    const nomes = await nomesVisiveis(ids.tecnicoCER);
    expect(nomes).toContain('Bruno Atendido CER');
    expect(nomes).not.toContain('Ana Atendida UR');
  });

  it('usuário sem perfil vê apenas a si mesmo', async () => {
    expect(await nomesVisiveis(ids.semPerfil)).toEqual(['Sem Perfil']);
  });

  it('atribuição encerrada deixa de valer', async () => {
    const temp = await criarUsuarioTeste(b, 'Ex Coordenadora', [
      { perfil: 'coordenacao_servico', escopoTipo: 'servico', escopoId: ids.ur },
    ]);
    expect(await nomesVisiveis(temp)).toContain('Ana Atendida UR');
    await b.admin(
      `update core.atribuicao set inicio = current_date - 10, fim = current_date - 1 where usuario_id = $1`,
      [temp],
    );
    expect(await nomesVisiveis(temp)).toEqual(['Ex Coordenadora']);
  });
});

describe('quem altera', () => {
  it('ninguém apaga registros, nem a diretoria', async () => {
    await expect(b.como(ids.diretora, `delete from core.pessoa where id = $1`, [ids.ana])).rejects.toThrow(
      /permission denied/,
    );
  });

  it('coordenação vincula atendidos ao próprio serviço, mas não a outro', async () => {
    const nova = await umId(`insert into core.pessoa (nome) values ('Davi Novo') returning id`);
    await b.como(ids.coordUR, `insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2)`, [
      nova, ids.ur,
    ]);
    await expect(
      b.como(ids.coordUR, `insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2)`, [
        nova, ids.cerReab,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it('quem cadastra vê a pessoa até ela ser vinculada a um serviço fora do seu escopo', async () => {
    const [{ id }] = (await b.como(ids.coordUR, `insert into core.pessoa (nome) values ('Gabi Recém Cadastrada') returning id`)) as {
      id: string;
    }[];
    expect(await nomesVisiveis(ids.coordUR)).toContain('Gabi Recém Cadastrada');
    await b.admin(`insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2)`, [id, ids.cerReab]);
    expect(await nomesVisiveis(ids.coordUR)).not.toContain('Gabi Recém Cadastrada');
  });

  it('técnico avaliador não altera cadastro de pessoa', async () => {
    const alteradas = await b.como(ids.tecnicoCER, `update core.pessoa set telefone = '16999990000' where id = $1 returning id`, [
      ids.bruno,
    ]);
    expect(alteradas).toHaveLength(0);
  });

  it('coordenação altera cadastro de atendido do seu serviço', async () => {
    const alteradas = await b.como(ids.coordUR, `update core.pessoa set telefone = '16999990000' where id = $1 returning id`, [
      ids.ana,
    ]);
    expect(alteradas).toHaveLength(1);
  });

  it('só quem gerencia acessos cria atribuições', async () => {
    const perfil = await umId(`select id from core.perfil where codigo = 'diretoria'`);
    await expect(
      b.como(ids.coordUR, `insert into core.atribuicao (usuario_id, perfil_id, escopo_tipo) values ($1, $2, 'global')`, [
        ids.coordUR, perfil,
      ]),
    ).rejects.toThrow(/row-level security/);
    await b.como(ids.admin, `insert into core.atribuicao (usuario_id, perfil_id, escopo_tipo) values ($1, $2, 'global')`, [
      ids.semPerfil, perfil,
    ]);
    expect(await nomesVisiveis(ids.semPerfil)).toContain('Ana Atendida UR');
  });
});
