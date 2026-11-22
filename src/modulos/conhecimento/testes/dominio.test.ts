import { describe, expect, it } from 'vitest';
import { codigoDaCategoria, conferirAnexo, pendenciaVencida, situacaoDaPessoa } from '../dominio/publicacao';
import { membrosDoPublico, type DadosDoPublico } from '../dominio/publico';

describe('situação da pessoa', () => {
  it('sem exigência, pendente, em dia e precisa renovar', () => {
    expect(situacaoDaPessoa(false, 1, [])).toBe('sem_exigencia');
    expect(situacaoDaPessoa(true, 1, [])).toBe('pendente');
    expect(situacaoDaPessoa(true, 1, [1])).toBe('em_dia');
    expect(situacaoDaPessoa(true, 2, [1])).toBe('precisa_renovar');
    expect(situacaoDaPessoa(true, 2, [1, 2])).toBe('em_dia');
  });
});

describe('prazo de 15 dias', () => {
  it('vence depois de 15 dias da edição atual', () => {
    const inicio = '2026-11-01T00:00:00Z';
    expect(pendenciaVencida(inicio, new Date('2026-11-16T00:00:00Z'))).toBe(false);
    expect(pendenciaVencida(inicio, new Date('2026-11-16T00:00:01Z'))).toBe(true);
  });
});

describe('anexo', () => {
  it('PDF até 10 MB e imagem até 1,5 MB', () => {
    expect(conferirAnexo({ mime: 'application/pdf', tamanho: 10 * 1024 * 1024 })).toEqual([]);
    expect(conferirAnexo({ mime: 'application/pdf', tamanho: 10 * 1024 * 1024 + 1 })).toHaveLength(1);
    expect(conferirAnexo({ mime: 'image/png', tamanho: 1_500_000 })).toEqual([]);
    expect(conferirAnexo({ mime: 'image/png', tamanho: 1_500_001 })).toHaveLength(1);
    expect(conferirAnexo({ mime: 'video/mp4', tamanho: 10 })).toHaveLength(1);
    expect(conferirAnexo({ mime: 'application/pdf', tamanho: 0 })).toHaveLength(1);
  });
});

it('código da categoria sem acento', () => {
  expect(codigoDaCategoria('Segurança e saúde')).toBe('seguranca_e_saude');
});

describe('público', () => {
  const d: DadosDoPublico = {
    usuarios: [{ email: 'a@x.local' }, { email: 'b@x.local' }, { email: 'c@x.local' }],
    atribuicoes: [
      { usuario_email: 'a@x.local', perfil: 'p1', escopo_tipo: 'global', escopo: null, inicio: null, fim: null },
      { usuario_email: 'b@x.local', perfil: 'p1', escopo_tipo: 'area', escopo: 'edu', inicio: null, fim: '2026-01-01' },
      { usuario_email: 'b@x.local', perfil: 'p2', escopo_tipo: 'area', escopo: 'edu', inicio: null, fim: null },
      { usuario_email: 'c@x.local', perfil: 'sem_acesso', escopo_tipo: 'global', escopo: null, inicio: null, fim: null },
      { usuario_email: 'fora@x.local', perfil: 'p1', escopo_tipo: 'global', escopo: null, inicio: null, fim: null },
    ],
    perfilPermissoes: [
      { perfil: 'p1', permissao: 'conhecimento.acessar' },
      { perfil: 'p2', permissao: 'conhecimento.acessar' },
    ],
  };
  it('todos: usuário ativo, atribuição vigente e perfil com acesso', () => {
    expect(membrosDoPublico({ publico_tipo: 'todos', publico_valor: null }, d, '2026-11-21')).toEqual(['a@x.local', 'b@x.local']);
  });
  it('perfil e área respeitam vigência e escopo', () => {
    expect(membrosDoPublico({ publico_tipo: 'perfil', publico_valor: 'p1' }, d, '2026-11-21')).toEqual(['a@x.local']);
    expect(membrosDoPublico({ publico_tipo: 'area', publico_valor: 'edu' }, d, '2026-11-21')).toEqual(['b@x.local']);
    expect(membrosDoPublico({ publico_tipo: 'area', publico_valor: 'outra' }, d, '2026-11-21')).toEqual([]);
  });
});
