/**
 * Várias instituições no Elo (ADR-012, entrega R1): configuração, descoberta
 * pelo endereço, sessão por instituição e dados isolados.
 */
import { describe, expect, it, vi } from 'vitest';
import { inserir, lerTabela } from '@/nucleo/armazenamento/tabela';
import { acharInstituicao, lerConfigGeral, lerConfig, ErroConfiguracao, type ConfigGeral } from '@/nucleo/config';
import { Unidades, Usuarios } from '@/nucleo/estrutura/tabelas';
import { assinarSessao, lerSessao, sessaoValeNa } from '@/nucleo/sessao/token';

vi.mock('server-only', () => ({}));

const CREDENCIAIS = {
  GOOGLE_CONTA_SERVICO: '{"client_email":"sa@proj.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----x"}',
  GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com',
  SESSAO_SEGREDO: 'x'.repeat(40),
};
const plan = (n: number) => ({ nucleo: `1Nucleo${n}xxxxxx`, auditoria: `1Auditoria${n}xxxx` });
const DUAS = JSON.stringify([
  { codigo: 'batatais', nome: 'Apae Batatais', dominio: 'apaebatatais.org.br', enderecos: ['elo.apaebatatais.org.br'], planilhas: plan(1) },
  { codigo: 'franca', nome: 'Apae Franca', nomeCompleto: 'Apae de Franca', dominio: 'apaefranca.org.br', enderecos: ['https://Elo.ApaeFranca.org.br/'], planilhas: plan(2), administradoresIniciais: ['TI@apaefranca.org.br'] },
]);

describe('configuração das instituições', () => {
  it('uma instituição só, com as variáveis de antes; nada da Apae Batatais fixo no código', () => {
    const c = lerConfigGeral({ ...CREDENCIAIS, PLANILHAS: JSON.stringify(plan(1)), DOMINIO: 'apaeexemplo.org.br', INSTITUICAO_NOME: 'Apae Exemplo' });
    expect(c.instituicoes).toHaveLength(1);
    expect(c.instituicoes[0]).toMatchObject({ nome: 'Apae Exemplo', dominio: 'apaeexemplo.org.br', unidades: [{ codigo: 'sede', nome: 'Sede' }] });
    // Sem nome, usa o domínio; sem DOMINIO, explica o que falta.
    expect(lerConfigGeral({ ...CREDENCIAIS, PLANILHAS: JSON.stringify(plan(1)), DOMINIO: 'x.org.br' }).instituicoes[0].nome).toBe('x.org.br');
    expect(() => lerConfigGeral({ ...CREDENCIAIS, PLANILHAS: JSON.stringify(plan(1)) })).toThrow(/DOMINIO/);
  });

  it('várias instituições pela variável INSTITUICOES; endereços normalizados', () => {
    const c = lerConfigGeral({ ...CREDENCIAIS, INSTITUICOES: DUAS });
    expect(c.instituicoes.map((i) => i.codigo)).toEqual(['batatais', 'franca']);
    expect(c.instituicoes[1]).toMatchObject({ enderecos: ['elo.apaefranca.org.br'], administradoresIniciais: ['ti@apaefranca.org.br'], nomeCompleto: 'Apae de Franca' });
    // O atalho lerConfig devolve a visão da primeira, no formato usado pelas telas.
    expect(lerConfig({ ...CREDENCIAIS, INSTITUICOES: DUAS })).toMatchObject({ modo: 'producao', dominio: 'apaebatatais.org.br' });
  });

  it('recusa código repetido, endereço em duas instituições e instituição sem endereço', () => {
    const base = JSON.parse(DUAS);
    const comErro = (lista: unknown) => () => lerConfigGeral({ ...CREDENCIAIS, INSTITUICOES: JSON.stringify(lista) });
    expect(comErro([base[0], { ...base[1], codigo: 'batatais' }])).toThrow(/mais de uma vez/);
    expect(comErro([base[0], { ...base[1], enderecos: ['elo.apaebatatais.org.br'] }])).toThrow(/mais de uma instituição/);
    expect(comErro([base[0], { ...base[1], enderecos: [] }])).toThrow(/endereço de acesso/);
    expect(comErro('nada')).toThrow(ErroConfiguracao);
  });
});

describe('descoberta da instituição pelo endereço', () => {
  const duas = lerConfigGeral({ ...CREDENCIAIS, INSTITUICOES: DUAS });

  it('acha pelo endereço (sem diferenciar maiúsculas, com ou sem porta); endereço desconhecido não acha nada', () => {
    expect(acharInstituicao(duas, 'elo.apaefranca.org.br')?.codigo).toBe('franca');
    expect(acharInstituicao(duas, 'ELO.apaebatatais.org.br:443')?.codigo).toBe('batatais');
    expect(acharInstituicao(duas, 'plataforma-apae.netlify.app')).toBeNull();
    expect(acharInstituicao(duas, null)).toBeNull();
  });

  it('com uma instituição só, qualquer endereço serve (como antes)', () => {
    const uma = lerConfigGeral({ ...CREDENCIAIS, PLANILHAS: JSON.stringify(plan(1)), DOMINIO: 'apaeexemplo.org.br' });
    expect(acharInstituicao(uma, 'plataforma-apae.netlify.app')?.dominio).toBe('apaeexemplo.org.br');
  });

  it('demonstração: duas instituições fictícias; vale a escolha da pessoa', () => {
    const demo = lerConfigGeral({});
    expect(demo.modo).toBe('demonstracao');
    expect(demo.instituicoes.map((i) => i.nome)).toEqual(['Apae Exemplo', 'Apae Modelo']);
    expect(acharInstituicao(demo, null, 'modelo')?.codigo).toBe('modelo');
    expect(acharInstituicao(demo, null, 'inexistente')?.codigo).toBe('exemplo');
  });
});

describe('sessão por instituição', () => {
  const segredo = 'um-segredo-de-teste-com-mais-de-32-caracteres';

  it('a sessão de uma instituição não vale em outra; sessão antiga só com uma instituição', async () => {
    const t = await assinarSessao(segredo, 'ana@apaefranca.org.br', 'Ana', 'franca');
    const s = (await lerSessao(segredo, t))!;
    expect(s.instituicao).toBe('franca');
    expect(sessaoValeNa(s, 'franca', false)).toBe(true);
    expect(sessaoValeNa(s, 'batatais', false)).toBe(false);
    const antiga = (await lerSessao(segredo, await assinarSessao(segredo, 'ana@x.org.br', 'Ana')))!;
    expect(sessaoValeNa(antiga, 'qualquer', true)).toBe(true);
    expect(sessaoValeNa(antiga, 'qualquer', false)).toBe(false);
  });
});

describe('dados isolados entre instituições', () => {
  it('cada instituição tem o próprio armazenamento: o que se grava numa não aparece na outra', async () => {
    const { aplicacaoDa } = await import('@/plataforma/aplicacao');
    const demo: ConfigGeral = lerConfigGeral({});
    const [exemplo, modelo] = await Promise.all(demo.instituicoes.map((i) => aplicacaoDa(demo, i)));
    expect(exemplo.planilhas).not.toBe(modelo.planilhas);
    await inserir(exemplo.planilhas, Usuarios, { email: 'so.no.exemplo@exemplo.local', nome: 'Só no Exemplo', pessoa_id: null } as never, { email: 'teste' });
    expect((await lerTabela(exemplo.planilhas, Usuarios)).ativos().some((u) => u.email === 'so.no.exemplo@exemplo.local')).toBe(true);
    expect((await lerTabela(modelo.planilhas, Usuarios)).ativos().some((u) => u.email === 'so.no.exemplo@exemplo.local')).toBe(false);
    // As unidades vêm do cadastro de cada instituição.
    expect((await lerTabela(modelo.planilhas, Unidades)).ativos().map((u) => u.codigo).sort()).toEqual(['rural', 'sede']);
    expect([exemplo.instituicao.nome, modelo.instituicao.nome, exemplo.unica]).toEqual(['Apae Exemplo', 'Apae Modelo', false]);
  });
});
