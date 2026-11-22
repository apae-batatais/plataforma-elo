/** Veículos institucionais, entrega 1 (#229): cadastro e manutenção, com quem altera e a auditoria. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  definirManutencaoPrevista,
  listarVeiculos,
  marcarManutencaoFeita,
  mudarSituacaoVeiculo,
  salvarVeiculo,
} from '../aplicacao/veiculos';
import { TABELAS_REQUISICOES, VeiculoManutencoes } from '../dados/tabelas';
import { conferirVeiculo, dataValida, emManutencaoNoPeriodo, normalizarPlaca } from '../dominio/veiculo';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
}
const hoje = new Date('2026-11-23T15:00:00Z'); // 12h em Brasília

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
});

describe('regras puras', () => {
  it('placa: aceita o modelo antigo e o Mercosul, com ou sem hífen', () => {
    expect(normalizarPlaca(' abc-1234 ')).toBe('ABC1234');
    expect(conferirVeiculo({ nome: 'Van', placa: 'abc-1234', capacidade: 8 })).toEqual([]);
    expect(conferirVeiculo({ nome: 'Van', placa: 'ABC1D23', capacidade: 8 })).toEqual([]);
    expect(conferirVeiculo({ nome: 'Van', placa: '12', capacidade: 8 }).join(' ')).toMatch(/placa/);
  });

  it('nome obrigatório e capacidade inteira de 1 em diante', () => {
    expect(conferirVeiculo({ nome: ' ', placa: 'ABC1234', capacidade: 8 }).join(' ')).toMatch(/nome/);
    for (const c of [0, -1, 2.5, NaN]) expect(conferirVeiculo({ nome: 'Van', placa: 'ABC1234', capacidade: c }).join(' ')).toMatch(/capacidade/);
  });

  it('manutenção: indisponível a partir do dia previsto, inclusive; antes, normal', () => {
    expect(emManutencaoNoPeriodo(null, '2026-12-31')).toBe(false);
    expect(emManutencaoNoPeriodo('2026-12-10', '2026-12-09')).toBe(false);
    expect(emManutencaoNoPeriodo('2026-12-10', '2026-12-10')).toBe(true);
    expect(emManutencaoNoPeriodo('2026-12-10', '2026-12-20')).toBe(true);
  });

  it('data real AAAA-MM-DD', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('28/02/2026')).toBe(false);
  });
});

describe('cadastro de veículos', () => {
  it('só a Administração da plataforma cadastra, altera, exclui e vê o cadastro', async () => {
    const admin = await como('admin@exemplo.local');
    const id = await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'abc-1234', capacidade: 12 });
    const v = (await listarVeiculos(p, admin)).ativos;
    expect(v).toMatchObject([{ id, nome: 'Van 1', placa: 'ABC1234', capacidade: 12, manutencaoPrevista: null }]);
    for (const email of ['diretoria@exemplo.local', 'coordenacao@exemplo.local', 'funcionario@exemplo.local']) {
      const quem = await como(email);
      await expect(listarVeiculos(p, quem)).rejects.toBeInstanceOf(ErroPermissao);
      await expect(salvarVeiculo(p, quem, { nome: 'X', placa: 'ABC1234', capacidade: 4 })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(salvarVeiculo(p, quem, { nome: 'X', placa: 'ZZZ9999', capacidade: 4 }, { id, versao: v[0].versao })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(mudarSituacaoVeiculo(p, quem, id, v[0].versao, false)).rejects.toBeInstanceOf(ErroPermissao);
      await expect(definirManutencaoPrevista(p, quem, id, '2026-12-10')).rejects.toBeInstanceOf(ErroPermissao);
      await expect(marcarManutencaoFeita(p, quem, id, null)).rejects.toBeInstanceOf(ErroPermissao);
    }
  });

  it('não repete placa, nem a de um veículo excluído', async () => {
    const admin = await como('admin@exemplo.local');
    const id = await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 12 });
    await expect(salvarVeiculo(p, admin, { nome: 'Van 2', placa: 'abc 1234', capacidade: 8 })).rejects.toThrow(/já está cadastrada/);
    const versao = (await listarVeiculos(p, admin)).ativos[0].versao;
    await mudarSituacaoVeiculo(p, admin, id, versao, false);
    await expect(salvarVeiculo(p, admin, { nome: 'Van 2', placa: 'ABC1234', capacidade: 8 })).rejects.toThrow(/reative/);
  });

  it('altera e exclui sem apagar; reativa; audita só as colunas', async () => {
    const admin = await como('admin@exemplo.local');
    const id = await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 12 });
    let v = (await listarVeiculos(p, admin)).ativos[0];
    await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 9 }, { id, versao: v.versao });
    v = (await listarVeiculos(p, admin)).ativos[0];
    expect(v.capacidade).toBe(9);
    await mudarSituacaoVeiculo(p, admin, id, v.versao, false);
    let l = await listarVeiculos(p, admin);
    expect(l.ativos).toEqual([]);
    expect(l.excluidos.map((x) => x.nome)).toEqual(['Van 1']);
    await mudarSituacaoVeiculo(p, admin, id, l.excluidos[0].versao, true);
    l = await listarVeiculos(p, admin);
    expect(l.ativos).toHaveLength(1);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Veiculos');
    expect(auditoria.map((a) => a.acao)).toEqual(['inclusao', 'alteracao', 'encerramento', 'alteracao']);
    expect(auditoria[1].detalhes).toContain('capacidade');
    expect(auditoria[1].detalhes).not.toContain('9');
  });

  it('versão antiga é recusada', async () => {
    const admin = await como('admin@exemplo.local');
    const id = await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 12 });
    await expect(salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 5 }, { id, versao: 99 })).rejects.toThrow();
  });
});

describe('manutenção preventiva', () => {
  let admin: Autorizador;
  let id: string;
  beforeEach(async () => {
    admin = await como('admin@exemplo.local');
    id = await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'ABC1234', capacidade: 12 });
  });
  const pendentes = async () => (await lerTabela(p, VeiculoManutencoes)).ativos().filter((m) => !m.feita_em);

  it('no máximo uma pendente por veículo: mudar a data altera a mesma linha', async () => {
    await definirManutencaoPrevista(p, admin, id, '2026-12-10');
    await definirManutencaoPrevista(p, admin, id, '2026-12-15');
    expect(await pendentes()).toMatchObject([{ veiculo_id: id, data_prevista: '2026-12-15' }]);
    expect((await listarVeiculos(p, admin)).ativos[0].manutencaoPrevista).toBe('2026-12-15');
  });

  it('data vazia encerra a pendente sem apagar', async () => {
    await definirManutencaoPrevista(p, admin, id, '2026-12-10');
    await definirManutencaoPrevista(p, admin, id, null);
    expect(await pendentes()).toEqual([]);
    expect((await lerTabela(p, VeiculoManutencoes)).todos()).toHaveLength(1);
    expect((await listarVeiculos(p, admin)).ativos[0].manutencaoPrevista).toBeNull();
  });

  it('recusa data inválida e veículo inexistente', async () => {
    await expect(definirManutencaoPrevista(p, admin, id, '10/12/2026')).rejects.toThrow(/data prevista/);
    await expect(definirManutencaoPrevista(p, admin, 'nao-existe', '2026-12-10')).rejects.toThrow(/não encontrado/);
  });

  it('marcar como feita registra quem e quando e libera o veículo', async () => {
    await definirManutencaoPrevista(p, admin, id, '2026-11-20');
    await marcarManutencaoFeita(p, admin, id, null, { agora: hoje });
    const todas = (await lerTabela(p, VeiculoManutencoes)).todos();
    expect(todas).toMatchObject([{ feita_em: '2026-11-23', feita_por: 'admin@exemplo.local' }]);
    const v = (await listarVeiculos(p, admin)).ativos[0];
    expect(v.manutencaoPrevista).toBeNull();
    expect(v.ultimaManutencao).toBe('2026-11-23');
  });

  it('a próxima data vira nova pendente e não pode ser antes de hoje', async () => {
    await definirManutencaoPrevista(p, admin, id, '2026-11-20');
    await expect(marcarManutencaoFeita(p, admin, id, '2026-11-22', { agora: hoje })).rejects.toThrow(/antes de hoje/);
    expect(await pendentes()).toHaveLength(1); // nada gravado na recusa
    await marcarManutencaoFeita(p, admin, id, '2027-05-10', { agora: hoje });
    expect(await pendentes()).toMatchObject([{ data_prevista: '2027-05-10' }]);
    const v = (await listarVeiculos(p, admin)).ativos[0];
    expect(v.manutencaoPrevista).toBe('2027-05-10');
    expect(v.ultimaManutencao).toBe('2026-11-23');
  });

  it('sem manutenção pendente não há o que marcar como feita', async () => {
    await expect(marcarManutencaoFeita(p, admin, id, null, { agora: hoje })).rejects.toThrow(/não tem manutenção prevista/);
  });

  it('audita só colunas, nunca valores', async () => {
    await definirManutencaoPrevista(p, admin, id, '2026-12-10');
    await definirManutencaoPrevista(p, admin, id, '2026-12-15');
    const a = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'VeiculoManutencoes');
    expect(a.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(a[1].detalhes).toContain('data_prevista');
    expect(a.map((x) => x.detalhes ?? '').join('')).not.toContain('2026-12');
  });
});

describe('permissão no manifesto', () => {
  it('só o perfil Administração da plataforma tem requisicoes.veiculos.cadastrar', () => {
    const com = Object.entries(manifesto.permissoesPorPerfil).filter(([, l]) => l.includes('requisicoes.veiculos.cadastrar'));
    expect(com.map(([perfil]) => perfil)).toEqual(['administrador_plataforma']);
    expect(manifesto.permissoes['requisicoes.veiculos.cadastrar']).toBeTruthy();
  });
});
