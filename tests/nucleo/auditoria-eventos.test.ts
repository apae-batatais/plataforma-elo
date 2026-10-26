/**
 * Auditoria automática, auditoria de leitura e eventos publicados pelo Núcleo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarBancoTeste, criarUsuarioTeste, type BancoTeste } from '../apoio/banco-teste';

let b: BancoTeste;
let coord: string;
let diretora: string;
let servicoId: string;

beforeAll(async () => {
  b = await criarBancoTeste();
  const [{ id: sede }] = (await b.admin(`select id from core.unidade where codigo = 'sede'`)) as { id: string }[];
  [{ id: servicoId }] = (await b.admin(
    `insert into core.servico (codigo, nome, eixo, unidade_id) values ('ur', 'UR', 'assistencia_social', $1) returning id`,
    [sede],
  )) as { id: string }[];
  coord = await criarUsuarioTeste(b, 'Coordenadora', [
    { perfil: 'coordenacao_servico', escopoTipo: 'servico', escopoId: servicoId },
  ]);
  diretora = await criarUsuarioTeste(b, 'Diretora', [{ perfil: 'diretoria' }]);
});

afterAll(async () => b.fechar());

describe('auditoria', () => {
  it('registra inclusão e alteração com o usuário e só os nomes das colunas', async () => {
    const [{ id }] = (await b.como(coord, `insert into core.pessoa (nome, cpf) values ('Elisa', '12345678901') returning id`)) as {
      id: string;
    }[];
    await b.como(coord, `insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2)`, [id, servicoId]);
    await b.como(coord, `update core.pessoa set telefone = '16988887777' where id = $1`, [id]);

    const registros = (await b.admin(
      `select usuario_id, acao, detalhes from core.auditoria where entidade = 'core.pessoa' and registro_id = $1 order by id`,
      [id],
    )) as { usuario_id: string; acao: string; detalhes: { colunas?: string[] } }[];

    expect(registros.map((r) => r.acao)).toEqual(['inclusao', 'alteracao']);
    expect(registros.every((r) => r.usuario_id === coord)).toBe(true);
    expect(registros[1].detalhes.colunas).toEqual(['telefone']);
    expect(JSON.stringify(registros)).not.toContain('16988887777');
  });

  it('é imutável, até para o dono do banco', async () => {
    await expect(b.admin(`update core.auditoria set acao = 'leitura'`)).rejects.toThrow(/somente inclusão/);
    await expect(b.admin(`delete from core.auditoria`)).rejects.toThrow(/somente inclusão/);
  });

  it('registra leitura individual com motivo', async () => {
    await b.como(diretora, `select core.registrar_acesso('leitura', 'assistencia.avaliacao', 'abc', 'revisão do enquadramento')`);
    const [linha] = (await b.admin(
      `select usuario_id, detalhes from core.auditoria where acao = 'leitura' order by id desc limit 1`,
    )) as { usuario_id: string; detalhes: { motivo: string } }[];
    expect(linha.usuario_id).toBe(diretora);
    expect(linha.detalhes.motivo).toBe('revisão do enquadramento');
  });

  it('só quem tem permissão lê a auditoria', async () => {
    expect(await b.como(coord, `select * from core.auditoria`)).toHaveLength(0);
    expect((await b.como(diretora, `select * from core.auditoria`)).length).toBeGreaterThan(0);
  });
});

describe('eventos do Núcleo', () => {
  it('vincular e desligar publica PessoaVinculadaAServico e PessoaDesligadaDeServico', async () => {
    const [{ id }] = (await b.como(coord, `insert into core.pessoa (nome) values ('Fábio') returning id`)) as { id: string }[];
    const [{ id: vinculo }] = (await b.como(
      coord,
      `insert into core.vinculo_servico (pessoa_id, servico_id) values ($1, $2) returning id`,
      [id, servicoId],
    )) as { id: string }[];
    await b.como(coord, `update core.vinculo_servico set saida = current_date, motivo_saida = 'mudança de serviço' where id = $1`, [
      vinculo,
    ]);

    const eventos = (await b.admin(
      `select tipo, payload from core.evento_dominio where payload->>'pessoaId' = $1 order by id`,
      [id],
    )) as { tipo: string; payload: Record<string, string> }[];
    expect(eventos.map((e) => e.tipo)).toEqual(['PessoaVinculadaAServico', 'PessoaDesligadaDeServico']);
    expect(eventos[1].payload.motivo).toBe('mudança de serviço');
  });

  it('usuários comuns não leem a fila de eventos', async () => {
    expect(await b.como(diretora, `select * from core.evento_dominio`)).toHaveLength(0);
  });
});
