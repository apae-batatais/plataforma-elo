import { describe, expect, it } from 'vitest';
import { defineModulo, type Manifesto } from '@/nucleo/modulos/manifesto';
import { menuDoUsuario, validarRegistro } from '@/nucleo/modulos/registro';

function exemplo(parcial: Partial<Manifesto> = {}): Manifesto {
  return {
    id: 'orcamento',
    nome: 'Orçamento',
    descricao: 'Previsto e realizado',
    icone: 'wallet',
    schema: 'orcamento',
    rota: '/orcamento',
    permissaoAcesso: 'orcamento.painel.ver',
    menu: [
      { rotulo: 'Painel', caminho: '/', permissao: 'orcamento.painel.ver' },
      { rotulo: 'Lançamentos', caminho: '/lancamentos', permissao: 'orcamento.lancamentos.editar' },
    ],
    permissoes: {
      'orcamento.painel.ver': 'Ver execução e indicadores',
      'orcamento.lancamentos.editar': 'Registrar receitas e despesas',
    },
    eventos: { publica: ['LancamentoRegistrado'], consome: [] },
    indicadores: ['execucao_orcamentaria'],
    ...parcial,
  };
}

describe('defineModulo', () => {
  it('aceita um manifesto válido', () => {
    expect(defineModulo(exemplo()).id).toBe('orcamento');
  });

  it('exige que as permissões comecem pelo schema do módulo', () => {
    expect(() =>
      defineModulo(exemplo({ permissoes: { 'orcamento.painel.ver': 'x ver', 'core.pessoas.ver': 'invadir' } })),
    ).toThrow(/deve começar com "orcamento\."/);
  });

  it('exige que permissões usadas no menu estejam declaradas', () => {
    expect(() =>
      defineModulo(exemplo({ menu: [{ rotulo: 'Painel', caminho: '/', permissao: 'orcamento.outra.ver' }] })),
    ).toThrow(/não declarada/);
  });
});

describe('validarRegistro', () => {
  it('recusa dois módulos com o mesmo schema', () => {
    const a = exemplo();
    const b = exemplo({ id: 'outro', rota: '/outro', eventos: { publica: [], consome: [] } });
    expect(() => validarRegistro([a, b])).toThrow(/mesmo schema/);
  });

  it('recusa evento consumido que ninguém publica', () => {
    const m = exemplo({ eventos: { publica: [], consome: ['EventoFantasma'] } });
    expect(() => validarRegistro([m])).toThrow(/ninguém publica/);
  });

  it('aceita consumir eventos do Núcleo', () => {
    const m = exemplo({ eventos: { publica: [], consome: ['PessoaVinculadaAServico'] } });
    expect(() => validarRegistro([m])).not.toThrow();
  });

  it('recusa um módulo publicando evento do Núcleo', () => {
    const m = exemplo({ eventos: { publica: ['PessoaDesligadaDeServico'], consome: [] } });
    expect(() => validarRegistro([m])).toThrow(/publicado por/);
  });
});

describe('menuDoUsuario', () => {
  it('mostra só apps e itens permitidos', () => {
    const menu = menuDoUsuario([exemplo()], new Set(['orcamento.painel.ver']));
    expect(menu).toHaveLength(1);
    expect(menu[0].itens).toEqual([{ rotulo: 'Painel', href: '/orcamento' }]);
  });

  it('esconde o app sem a permissão de acesso', () => {
    expect(menuDoUsuario([exemplo()], new Set(['orcamento.lancamentos.editar']))).toEqual([]);
  });
});
