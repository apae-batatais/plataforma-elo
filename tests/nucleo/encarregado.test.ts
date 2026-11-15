/** Encarregado de dados (DPO): quem vê, quem altera, validação, troca com histórico e auditoria. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { cnpjValido, cpfValido } from '@/nucleo/encarregado/documento';
import {
  cadastrarEncarregado, corrigirEncarregado, lerEncarregadoAdmin, lerEncarregadoPublico, trocarEncarregado,
} from '@/nucleo/encarregado/encarregado';
import { Atribuicoes, Encarregados, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

/** Gera CPF/CNPJ válidos a partir de uma base, para os testes não usarem documentos reais. */
function dv(base: number[], pesos: number[]) {
  const r = base.reduce((s, n, i) => s + n * pesos[i], 0) % 11;
  return r < 2 ? 0 : 11 - r;
}
function gerarCpf(base: number[]) {
  const d1 = dv(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}
function gerarCnpj(base: number[]) {
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}
const CPF = gerarCpf([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const CPF2 = gerarCpf([9, 8, 7, 6, 5, 4, 3, 2, 1]);
const CNPJ = gerarCnpj([1, 1, 2, 2, 2, 3, 3, 3, 0, 0, 0, 1]);

let p: Planilhas;
async function como(email: string, perfil: string | null) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  const u = usuarios.ativos().map((x) => x);
  if (perfil) u.push({ email, pessoa_id: null, ativo: true } as (typeof u)[number]);
  const a = atribuicoes.ativos().map((x) => x);
  if (perfil) a.push({ usuario_email: email, perfil, escopo_tipo: 'global', escopo: null, inicio: null, fim: null, ativo: true } as (typeof a)[number]);
  return new Autorizador(email, { usuarios: u, atribuicoes: a, perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const dados = (extra = {}) => ({ tipo: 'fisica', nome: 'Pessoa Teste', documento: CPF, email: 'Encarregado@Exemplo.local', ...extra });

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('documentos', () => {
  it('confere dígitos verificadores', () => {
    expect(cpfValido(CPF)).toBe(true);
    expect(cpfValido('123.456.789-00')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cnpjValido(CNPJ)).toBe(true);
    expect(cnpjValido(CNPJ.slice(0, 13) + '0')).toBe(false);
  });
});

describe('permissões', () => {
  it('só a Diretoria cadastra, corrige, troca e lê a tela de administração', async () => {
    for (const perfil of ['administrador_plataforma', 'financeiro', 'leitura']) {
      const q = await como(`${perfil}@exemplo.local`, perfil);
      await expect(cadastrarEncarregado(p, q, dados())).rejects.toThrow(ErroPermissao);
      await expect(corrigirEncarregado(p, q, 'x', 1, dados())).rejects.toThrow(ErroPermissao);
      await expect(trocarEncarregado(p, q, 'x', 1, dados())).rejects.toThrow(ErroPermissao);
      await expect(lerEncarregadoAdmin(p, q)).rejects.toThrow(ErroPermissao);
    }
    const dir = await como('dir@exemplo.local', 'diretoria');
    await cadastrarEncarregado(p, dir, dados());
    expect((await lerTabela(p, Encarregados)).todos()).toHaveLength(1);
  });
});

describe('cadastro e validação', () => {
  it('grava só dígitos, e-mail em minúsculas, e recusa um segundo encarregado atual', async () => {
    const dir = await como('dir@exemplo.local', 'diretoria');
    await cadastrarEncarregado(p, dir, dados({ documento: CPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }), '2026-01-10');
    const r = (await lerTabela(p, Encarregados)).todos()[0];
    expect(r).toMatchObject({ documento: CPF, email: 'encarregado@exemplo.local', inicio: '2026-01-10', fim: null, tipo: 'fisica' });
    await expect(cadastrarEncarregado(p, dir, dados())).rejects.toThrow('Já existe um encarregado. Use Trocar encarregado.');
  });

  it('o tipo decide o documento; e-mail e nome são obrigatórios', async () => {
    const dir = await como('dir@exemplo.local', 'diretoria');
    await expect(cadastrarEncarregado(p, dir, dados({ documento: CNPJ }))).rejects.toThrow('CPF inválido');
    await expect(cadastrarEncarregado(p, dir, dados({ tipo: 'juridica', documento: CPF }))).rejects.toThrow('CNPJ inválido');
    await expect(cadastrarEncarregado(p, dir, dados({ documento: '123.456.789-00' }))).rejects.toThrow('CPF inválido');
    await expect(cadastrarEncarregado(p, dir, dados({ email: 'sem-arroba' }))).rejects.toThrow('e-mail válido');
    await expect(cadastrarEncarregado(p, dir, dados({ nome: '  ' }))).rejects.toThrow('nome');
    await expect(cadastrarEncarregado(p, dir, dados({ tipo: '' }))).rejects.toThrow('física ou jurídica');
    expect((await lerTabela(p, Encarregados)).todos()).toHaveLength(0);
    await cadastrarEncarregado(p, dir, dados({ tipo: 'juridica', documento: CNPJ }));
  });
});

describe('corrigir e trocar', () => {
  it('corrigir altera o atual e audita só as colunas', async () => {
    const dir = await como('dir@exemplo.local', 'diretoria');
    await cadastrarEncarregado(p, dir, dados());
    const r = (await lerTabela(p, Encarregados)).todos()[0];
    await corrigirEncarregado(p, dir, r.id, r.versao, dados({ nome: 'Outro Nome' }));
    expect((await lerTabela(p, Encarregados)).todos()[0].nome).toBe('Outro Nome');
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Encarregados');
    expect(aud.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(aud[1].detalhes).toContain('nome');
    expect(JSON.stringify(aud)).not.toContain('Outro Nome');
    expect(JSON.stringify(aud)).not.toContain(CPF);
    await expect(corrigirEncarregado(p, dir, r.id, r.versao, dados())).rejects.toThrow(); // versão antiga
  });

  it('trocar encerra o atual, cria o novo e guarda o histórico', async () => {
    const dir = await como('dir@exemplo.local', 'diretoria');
    await cadastrarEncarregado(p, dir, dados(), '2026-01-10');
    const r = (await lerTabela(p, Encarregados)).todos()[0];
    await expect(trocarEncarregado(p, dir, r.id, r.versao, dados({ tipo: 'juridica', documento: CNPJ }), '2026-01-09')).rejects.toThrow('anterior');
    await trocarEncarregado(p, dir, r.id, r.versao, dados({ tipo: 'juridica', nome: 'Assessoria', documento: CNPJ }), '2026-03-01');
    const todos = (await lerTabela(p, Encarregados)).todos();
    expect(todos).toHaveLength(2);
    expect(todos[0]).toMatchObject({ fim: '2026-03-01', ativo: false });
    expect(todos[1]).toMatchObject({ nome: 'Assessoria', inicio: '2026-03-01', fim: null, ativo: true });
    const painel = await lerEncarregadoAdmin(p, dir);
    expect(painel.atual?.nome).toBe('Assessoria');
    expect(painel.historico.map((h) => h.nome)).toEqual(['Pessoa Teste']);
    // depois da troca, o encerrado não pode ser trocado de novo
    await expect(trocarEncarregado(p, dir, r.id, r.versao + 1, dados({ documento: CPF2 }))).rejects.toThrow('não encontrado');
  });
});

describe('leitura', () => {
  it('a tela de administração audita a leitura; a Ajuda não e não vaza o documento', async () => {
    const dir = await como('dir@exemplo.local', 'diretoria');
    await cadastrarEncarregado(p, dir, dados());
    const antes = (await lerTabela(p, RegistrosAuditoria)).todos().length;
    const fin = await como('fin@exemplo.local', 'financeiro');
    const publico = await lerEncarregadoPublico(p, fin);
    expect(publico).toEqual({ nome: 'Pessoa Teste', email: 'encarregado@exemplo.local' });
    expect(JSON.stringify(publico)).not.toContain(CPF);
    expect((await lerTabela(p, RegistrosAuditoria)).todos()).toHaveLength(antes);
    await lerEncarregadoAdmin(p, dir);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(aud.at(-1)).toMatchObject({ acao: 'leitura', entidade: 'Encarregados' });
  });

  it('sem cadastro a Ajuda devolve nulo; quem não é do Elo não lê', async () => {
    const fin = await como('fin@exemplo.local', 'financeiro');
    expect(await lerEncarregadoPublico(p, fin)).toBeNull();
    await expect(lerEncarregadoPublico(p, await como('estranho@exemplo.local', null))).rejects.toThrow(ErroPermissao);
  });
});
