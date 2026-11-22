import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { defineModulo } from '@/nucleo/modulos/manifesto';
import { validarRegistro } from '@/nucleo/modulos/registro';
import { agruparPorFamilia, FAMILIAS } from '@/plataforma/familias';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { MODULOS } from '@/plataforma/registro-modulos';

/** Autorizador mínimo: só as permissões, que é o que o menu consulta. */
function com(...permissoes: string[]): Autorizador {
  const set = new Set(permissoes);
  return {
    permissoes: () => set,
    temPermissao: (p: string) => set.has(p),
    temPermissaoAlgumEscopo: (p: string) => set.has(p),
  } as unknown as Autorizador;
}

const apps = (aut: Autorizador) => navegacaoDoUsuario(aut, false).find((g) => g.titulo === 'Apps')?.itens ?? [];

describe('família Avaliações no menu', () => {
  it('com os três apps: um item "Avaliações" com Assistência Social, Educação e Saúde, nessa ordem', () => {
    const itens = apps(com('avaliacao.acessar', 'avaliacao.avaliar', 'saude.acessar', 'saude.avaliar', 'educacao.acessar', 'educacao.avaliar'));
    const familia = itens.find((i) => i.rotulo === 'Avaliações');
    expect(familia?.apps?.map((a) => a.rotulo)).toEqual(['Assistência Social', 'Educação', 'Saúde']);
    expect(itens.filter((i) => ['Assistência Social', 'Educação', 'Saúde'].includes(i.rotulo))).toEqual([]);
    expect(familia?.apps?.[0].filhos?.map((f) => f.rotulo)).toContain('Nova avaliação');
    expect(familia?.href).toBe('/avaliacao');
  });

  it('a família fica na posição do primeiro app dela, e apps sem família continuam soltos', () => {
    const itens = apps(com('orcamento.acessar', 'saude.acessar', 'educacao.acessar', 'requisicoes.acessar'));
    const nomes = itens.map((i) => i.rotulo);
    expect(nomes.indexOf('Avaliações')).toBeGreaterThan(-1);
    expect(nomes).toContain('Orçamento');
    expect(itens.find((i) => i.rotulo === 'Avaliações')?.apps?.map((a) => a.rotulo)).toEqual(['Educação', 'Saúde']);
  });

  it('com um app só (perfil de Conselho): a família aparece com esse app dentro, só com o que ele pode ver', () => {
    const familia = apps(com('avaliacao.acessar', 'avaliacao.painel')).find((i) => i.rotulo === 'Avaliações');
    expect(familia?.apps).toHaveLength(1);
    expect(familia?.apps?.[0].rotulo).toBe('Assistência Social');
    expect(familia?.apps?.[0].filhos?.map((f) => f.rotulo)).toEqual(['Painel', 'Sobre o instrumento']);
  });

  it('sem nenhum dos três: a família não aparece', () => {
    const itens = apps(com('orcamento.acessar'));
    expect(itens.some((i) => i.rotulo === 'Avaliações' || i.apps)).toBe(false);
  });

  it('o nome antigo do app não aparece em lugar nenhum de src/', () => {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (/\.(ts|tsx|md)$/.test(nome) && !nome.endsWith('especificacao.md') && readFileSync(caminho, 'utf8').includes('Avaliação de Serviços Sociais')) achados.push(caminho);
      }
    };
    varrer('src');
    expect(achados).toEqual([]);
  });

  it('id, rota e permissões da Assistência Social não mudaram', () => {
    const m = MODULOS.find((x) => x.id === 'avaliacao')!;
    expect(m.nome).toBe('Assistência Social');
    expect(m.rota).toBe('/avaliacao');
    expect(m.permissaoAcesso).toBe('avaliacao.acessar');
  });
});

describe('família no manifesto', () => {
  const base = MODULOS[0];
  it('família desconhecida invalida o registro de módulos', () => {
    expect(() => validarRegistro([{ ...base, familia: 'inexistente' }], Object.keys(FAMILIAS))).toThrow(/família "inexistente"/);
  });
  it('família conhecida passa, e o campo é opcional', () => {
    expect(() => validarRegistro(MODULOS, Object.keys(FAMILIAS))).not.toThrow();
    expect(defineModulo({ ...base, familia: undefined }).familia).toBeUndefined();
  });
  it('agrupa só quem tem família, na ordem do mapa', () => {
    const g = agruparPorFamilia([{ id: 'saude', familia: 'avaliacoes' }, { id: 'x' }, { id: 'avaliacao', familia: 'avaliacoes' }]);
    expect(g.map((i) => i.tipo)).toEqual(['familia', 'app']);
    expect(g[0].tipo === 'familia' && g[0].apps.map((a) => a.id)).toEqual(['avaliacao', 'saude']);
  });
});

describe('tela Instrumentos em Educação e Saúde', () => {
  const filhos = (app: string, ...p: string[]) =>
    apps(com(...p)).find((i) => i.rotulo === 'Avaliações')?.apps?.find((a) => a.rotulo === app)?.filhos?.map((f) => f.rotulo) ?? [];

  it('quem avalia vê "Instrumentos" no menu, depois de "Nova avaliação"', () => {
    const e = filhos('Educação', 'educacao.acessar', 'educacao.avaliar');
    expect(e.indexOf('Instrumentos')).toBe(e.indexOf('Nova avaliação') + 1);
    const s = filhos('Saúde', 'saude.acessar', 'saude.avaliar');
    expect(s.indexOf('Instrumentos')).toBe(s.indexOf('Nova avaliação') + 1);
  });

  it('quem só tem acesso de leitura não vê "Instrumentos"', () => {
    expect(filhos('Educação', 'educacao.acessar', 'educacao.painel')).not.toContain('Instrumentos');
    expect(filhos('Saúde', 'saude.acessar', 'saude.painel')).not.toContain('Instrumentos');
  });
});
