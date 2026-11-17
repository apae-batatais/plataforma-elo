/**
 * Rede de instituições (ADR-012, entrega R2): quem administra, cadastro com
 * validações, situação, auditoria só com colunas e conferência sem ler dados.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { RegistrosAuditoria, Unidades } from '@/nucleo/estrutura/tabelas';
import {
  autorizadorDaRede,
  conferirInstituicao,
  incluirAdministradorRede,
  instituicoesCadastradas,
  mudarSituacao,
  painelDaRede,
  instituicoesEmVigor,
  prepararEstruturaDaInstituicao,
  prepararRede,
  retirarAdministradorRede,
  salvarInstituicao,
  type DadosInstituicao,
} from '@/nucleo/rede/rede';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';

const ID = (n: number) => `1${String(n).repeat(25)}AbC`;
let rede: Planilhas;
const operadora = () => autorizadorDaRede(rede, 'rede@operadora.org', ['rede@operadora.org']);

const franca = (extra: Partial<DadosInstituicao> = {}): DadosInstituicao => ({
  codigo: 'apae-franca',
  nome: 'Apae Franca',
  nomeCompleto: 'Associação de Pais e Amigos dos Excepcionais de Franca',
  dominio: 'inst-b-exemplo.org.br',
  enderecos: ['elo.inst-b-exemplo.org.br'],
  planilhas: { nucleo: ID(1), auditoria: ID(2) },
  administradoresIniciais: ['ti@inst-b-exemplo.org.br'],
  unidades: [{ codigo: 'sede', nome: 'Apae Franca (Sede)' }],
  ...extra,
});

beforeEach(async () => {
  rede = {
    armazenamento: new ArmazenamentoMemoria(['rede']),
    idDe: () => 'rede',
  };
  await prepararRede(rede);
});

describe('quem administra a rede', () => {
  it('o administrador inicial da configuração e os cadastrados na planilha; mais ninguém', async () => {
    expect((await operadora()).temPermissao('rede.instituicoes.gerenciar')).toBe(true);
    const estranho = await autorizadorDaRede(rede, 'alguem@inst-b-exemplo.org.br', ['rede@operadora.org']);
    expect(estranho.temPermissao('rede.instituicoes.gerenciar')).toBe(false);
    await expect(painelDaRede(rede, estranho)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarInstituicao(rede, estranho, franca())).rejects.toBeInstanceOf(ErroPermissao);

    await incluirAdministradorRede(rede, await operadora(), 'operadora.org', {
      email: 'Ana@operadora.org',
      nome: 'Ana',
    });
    expect((await autorizadorDaRede(rede, 'ana@operadora.org', [])).temPermissao('rede.instituicoes.gerenciar')).toBe(true);
    await expect(
      incluirAdministradorRede(rede, await operadora(), 'operadora.org', {
        email: 'x@gmail.com',
        nome: 'X',
      }),
    ).rejects.toThrow(/Operadora/);
    const ana = (await painelDaRede(rede, await operadora())).administradores[0];
    await expect(retirarAdministradorRede(rede, await autorizadorDaRede(rede, 'ana@operadora.org', []), ana.id, ana.versao)).rejects.toThrow(/próprio acesso/);
    await retirarAdministradorRede(rede, await operadora(), ana.id, ana.versao);
    expect((await autorizadorDaRede(rede, 'ana@operadora.org', [])).temPermissao('rede.instituicoes.gerenciar')).toBe(false);
  });
});

describe('cadastro de instituições', () => {
  it('cadastra em preparação; a instituição sai igual à cadastrada para o Elo usar', async () => {
    await salvarInstituicao(rede, await operadora(), franca());
    const [i] = await instituicoesCadastradas(rede);
    expect(i).toMatchObject({
      codigo: 'apae-franca',
      nome: 'Apae Franca',
      dominio: 'inst-b-exemplo.org.br',
      enderecos: ['elo.inst-b-exemplo.org.br'],
      situacao: 'preparacao',
      planilhas: { nucleo: ID(1), auditoria: ID(2) },
      administradoresIniciais: ['ti@inst-b-exemplo.org.br'],
      unidades: [{ codigo: 'sede', nome: 'Apae Franca (Sede)' }],
    });
  });

  it('recusa código, domínio ou endereço repetidos, planilha faltando, ID inválido e administrador de outro domínio', async () => {
    const op = await operadora();
    await salvarInstituicao(rede, op, franca());
    const outra = (x: Partial<DadosInstituicao>) =>
      franca({
        codigo: 'apae-batatais',
        dominio: 'inst-a-exemplo.org.br',
        enderecos: ['elo.inst-a-exemplo.org.br'],
        administradoresIniciais: [],
        ...x,
      });
    await expect(salvarInstituicao(rede, op, outra({ codigo: 'apae-franca' }))).rejects.toThrow(/código/);
    await expect(salvarInstituicao(rede, op, outra({ dominio: 'inst-b-exemplo.org.br' }))).rejects.toThrow(/domínio/);
    await expect(salvarInstituicao(rede, op, outra({ enderecos: ['elo.inst-b-exemplo.org.br'] }))).rejects.toThrow(/endereço/);
    await expect(salvarInstituicao(rede, op, outra({ planilhas: { nucleo: ID(3) } }))).rejects.toThrow(/link da pasta/);
    await expect(salvarInstituicao(rede, op, outra({ planilhas: { nucleo: 'abc', auditoria: ID(4) } }))).rejects.toThrow(/ID da planilha/);
    await expect(salvarInstituicao(rede, op, outra({ administradoresIniciais: ['ti@gmail.com'] }))).rejects.toThrow(/@inst-a-exemplo.org.br/);
    await expect(salvarInstituicao(rede, op, outra({ enderecos: ['https://elo.x.org.br/'] }))).rejects.toThrow(/sem https/);
    await salvarInstituicao(rede, op, outra({}));
    expect((await instituicoesCadastradas(rede)).map((i) => i.codigo).sort()).toEqual(['apae-batatais', 'apae-franca']);
  });

  it('altera sem mudar o código; suspende e reativa sem apagar; auditoria só com colunas', async () => {
    const op = await operadora();
    const id = await salvarInstituicao(rede, op, franca());
    let linha = (await painelDaRede(rede, op)).instituicoes[0];
    await expect(
      salvarInstituicao(rede, op, franca({ codigo: 'outro' }), {
        id,
        versao: linha.versao,
      }),
    ).rejects.toThrow(/código/);
    await salvarInstituicao(rede, op, franca({ nome: 'Apae de Franca' }), {
      id,
      versao: linha.versao,
    });
    linha = (await painelDaRede(rede, op)).instituicoes[0];
    await mudarSituacao(rede, op, id, linha.versao, 'ativa');
    linha = (await painelDaRede(rede, op)).instituicoes[0];
    await mudarSituacao(rede, op, id, linha.versao, 'suspensa');
    const [i] = await instituicoesCadastradas(rede);
    expect([i.nome, i.situacao]).toEqual(['Apae de Franca', 'suspensa']);

    const auditoria = (await lerTabela(rede, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Instituicoes');
    expect(auditoria.map((a) => a.acao)).toEqual(['inclusao', 'alteracao', 'alteracao', 'alteracao']);
    expect(auditoria.some((a) => (a.detalhes ?? '').includes('Apae de Franca'))).toBe(false);
  });
});

describe('migração das variáveis para a rede', () => {
  it('as variáveis valem até a rede ter uma instituição ativa; sem variáveis, vale a rede', async () => {
    const op = await operadora();
    const variaveis = [{ codigo: 'principal', nome: 'Apae Batatais' } as never];
    const id = await salvarInstituicao(rede, op, franca());
    expect(instituicoesEmVigor(await instituicoesCadastradas(rede), variaveis)).toBe(variaveis); // só em preparação: nada muda
    expect(instituicoesEmVigor(await instituicoesCadastradas(rede), []).map((i) => i.codigo)).toEqual(['apae-franca']);
    const v = (await painelDaRede(rede, op)).instituicoes[0].versao;
    await mudarSituacao(rede, op, id, v, 'ativa');
    expect(instituicoesEmVigor(await instituicoesCadastradas(rede), variaveis).map((i) => i.codigo)).toEqual(['apae-franca']);
  });
});

describe('conferência de uma instituição', () => {
  it('aponta planilha sem acesso, estrutura em branco e estrutura em dia, sem gravar nada', async () => {
    const op = await operadora();
    const armazenamento = new ArmazenamentoMemoria([ID(1), ID(2)]);
    const inst = {
      ...(await instituicoesCadastradas(rede))[0],
      ...franca(),
      planilhas: { nucleo: ID(1), auditoria: ID(2) },
      situacao: 'preparacao' as const,
      nomeCompleto: 'x',
    };
    const em = (c: Awaited<ReturnType<typeof conferirInstituicao>>, chave: string) => c.planilhas.find((x) => x.chave === chave);

    // Planilhas em branco: encontradas, estrutura ainda não preparada; as dos módulos não informadas.
    let c = await conferirInstituicao(op, armazenamento, inst as never, ESTRUTURA_DOS_MODULOS);
    expect([em(c, 'nucleo')?.ok, em(c, 'auditoria')?.ok, em(c, 'orcamento')?.ok, c.estrutura]).toEqual([true, true, false, 'nao_preparada']);

    // Depois de "Preparar estrutura" da instituição: em dia.
    await prepararEstrutura({ armazenamento, idDe: (k) => (k === 'nucleo' ? ID(1) : ID(2)) }, { tabelas: [] });
    c = await conferirInstituicao(op, armazenamento, inst as never, {
      perfis: [],
      permissoes: [],
    });
    expect(c.estrutura).toBe('em_dia');

    // Planilha que a conta de serviço não alcança.
    c = await conferirInstituicao(op, armazenamento, { ...inst, planilhas: { nucleo: ID(9), auditoria: ID(2) } } as never, { perfis: [], permissoes: [] });
    expect([em(c, 'nucleo')?.ok, c.estrutura]).toEqual([false, 'sem_acesso']);

    // Só a Administração da rede confere.
    await expect(conferirInstituicao(await autorizadorDaRede(rede, 'x@y.org', []), armazenamento, inst as never, {})).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('preparar estrutura pela rede', () => {
  it('cria abas e configuração inicial com as unidades do cadastro, pula apps sem planilha, repete sem mudar nada e audita nos dois lados', async () => {
    const op = await operadora();
    const id = await salvarInstituicao(rede, op, franca());
    const inst = (await instituicoesCadastradas(rede))[0];
    const armazenamento = new ArmazenamentoMemoria([ID(1), ID(2)]);
    const pInst: Planilhas = {
      armazenamento,
      idDe: (k) => (k === 'nucleo' ? ID(1) : ID(2)),
    };

    const r = await prepararEstruturaDaInstituicao(rede, op, armazenamento, inst, ESTRUTURA_DOS_MODULOS, id);
    expect(r.abasCriadas.length).toBeGreaterThan(0);
    expect(r.planilhasPuladas).toContain('Orçamento');
    expect((await lerTabela(pInst, Unidades)).ativos().map((u) => u.nome)).toEqual(['Apae Franca (Sede)']);
    expect(
      (
        await conferirInstituicao(op, armazenamento, inst, {
          ...ESTRUTURA_DOS_MODULOS,
          tabelas: [],
        })
      ).estrutura,
    ).toBe('em_dia');

    // Rodar de novo não cria nem altera nada.
    const de_novo = await prepararEstruturaDaInstituicao(rede, op, armazenamento, inst, ESTRUTURA_DOS_MODULOS, id);
    expect([de_novo.abasCriadas.length, de_novo.registrosIniciais]).toEqual([0, 0]);

    // Auditoria na rede (com o registro da instituição) e na instituição, sem valores.
    const naRede = (await lerTabela(rede, RegistrosAuditoria)).todos().filter((a) => a.acao === 'estrutura');
    expect(naRede.map((a) => a.registro_id)).toEqual([id, id]);
    const naInstituicao = (await lerTabela(pInst, RegistrosAuditoria)).todos().filter((a) => a.acao === 'estrutura');
    expect(naInstituicao).toHaveLength(2);
    expect(naInstituicao.some((a) => (a.detalhes ?? '').includes('Apae Franca'))).toBe(false);
  });

  it('só a Administração da rede prepara; planilha sem acesso é explicada', async () => {
    const op = await operadora();
    await salvarInstituicao(rede, op, franca());
    const inst = (await instituicoesCadastradas(rede))[0];
    const estranho = await autorizadorDaRede(rede, 'x@y.org', []);
    await expect(prepararEstruturaDaInstituicao(rede, estranho, new ArmazenamentoMemoria([ID(1), ID(2)]), inst, {})).rejects.toBeInstanceOf(ErroPermissao);
    await expect(prepararEstruturaDaInstituicao(rede, op, new ArmazenamentoMemoria([ID(2)]), inst, {})).rejects.toThrow(
      /Apae Franca: não foi possível preparar/,
    );
  });
});
