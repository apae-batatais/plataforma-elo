import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULOS } from '@/plataforma/registro-modulos';
import { ICONE_DO_APP } from '@/plataforma/icones-dos-apps';
import { agruparItens, chaveDoGrupo, grupoAberto } from '@/ui/grupos-do-menu';

const css = readFileSync('src/app/globals.css', 'utf8');

function cor(app: string, tema: 'claro' | 'escuro', variavel = '--destaque'): string {
  const seletor = tema === 'claro' ? `^\\[data-app='${app}'\\] \\{` : `^:root\\[data-tema='escuro'\\] \\[data-app='${app}'\\] \\{`;
  const m = css.match(new RegExp(`${seletor}([^}]*)\\}`, 'm'));
  expect(m, `bloco de cor de ${app} (${tema})`).not.toBeNull();
  const v = m![1].match(new RegExp(`${variavel}:\\s*(#[0-9a-fA-F]{6})`));
  expect(v, `${variavel} de ${app}`).not.toBeNull();
  return v![1].toLowerCase();
}

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function matiz(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const diferencaDeMatiz = (a: string, b: string) => {
  const d = Math.abs(matiz(a) - matiz(b));
  return Math.min(d, 360 - d);
};

const APPS = MODULOS.map((m) => m.id);
const FUNDOS = { claro: { fundo: '#f6f7fb', cartao: '#ffffff' }, escuro: { fundo: '#101521', cartao: '#171d2b' } };

describe('ícone e cor de cada app', () => {
  it('todo app ativo tem ícone próprio, diferente dos outros', () => {
    const icones = APPS.map((id) => ICONE_DO_APP[id]);
    for (const i of icones) expect(i).toBeDefined();
    expect(new Set(icones).size).toBe(APPS.length);
  });

  it('todo app ativo tem cor própria nos dois temas, diferente das outras', () => {
    for (const tema of ['claro', 'escuro'] as const) {
      const cores = APPS.map((id) => cor(id, tema));
      expect(new Set(cores).size).toBe(APPS.length);
    }
  });

  it('lilás e oliva passam de 4,5:1 sobre o fundo e o cartão, nos dois temas', () => {
    for (const app of ['parcerias', 'projetos']) {
      for (const tema of ['claro', 'escuro'] as const) {
        const c = cor(app, tema);
        expect(contraste(c, FUNDOS[tema].fundo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(c, FUNDOS[tema].cartao)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('lilás e oliva ficam a pelo menos 15° de tom das outras cores de app', () => {
    for (const app of ['parcerias', 'projetos']) {
      for (const outro of APPS.filter((x) => x !== app)) {
        expect(diferencaDeMatiz(cor(app, 'claro'), cor(outro, 'claro'))).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('as cores seguem a identidade visual', () => {
    expect(cor('parcerias', 'claro')).toBe('#7e3f98');
    expect(cor('parcerias', 'escuro')).toBe('#d2a2ea');
    expect(cor('projetos', 'claro')).toBe('#5f6b12');
    expect(cor('projetos', 'escuro')).toBe('#b8c65a');
  });
});

describe('grupos do menu', () => {
  it('nenhum grupo tem o mesmo nome do app', () => {
    for (const m of MODULOS) {
      for (const i of m.menu) expect(i.secao?.toLowerCase(), `${m.nome}: grupo igual ao nome do app`).not.toBe(m.nome.toLowerCase());
    }
  });

  it('a tela atual sempre vem aberta; sem escolha, só o grupo dela', () => {
    expect(grupoAberto('Painéis', 'Painéis', {})).toBe(true);
    expect(grupoAberto('Cadastros', 'Painéis', {})).toBe(false);
    expect(grupoAberto('Painéis', 'Painéis', { Painéis: false })).toBe(true);
  });

  it('a escolha lembrada vale para os outros grupos', () => {
    expect(grupoAberto('Cadastros', 'Painéis', { Cadastros: true })).toBe(true);
    expect(grupoAberto('Cadastros', undefined, { Cadastros: false })).toBe(false);
  });

  it('agrupa na ordem; app sem grupos não tem cabeçalho', () => {
    const g = agruparItens([{ secao: 'A' }, { secao: 'A' }, { secao: 'B' }]);
    expect(g.map((x) => [x.titulo, x.itens.length])).toEqual([['A', 2], ['B', 1]]);
    const sem = agruparItens([{}, {}]);
    expect(sem).toHaveLength(1);
    expect(sem[0].titulo).toBeUndefined();
  });

  it('a chave de armazenamento é por app e grupo', () => {
    expect(chaveDoGrupo('/orcamento', 'Painéis')).not.toBe(chaveDoGrupo('/projetos', 'Painéis'));
  });
});

import { maiusculaInicial } from '@/ui/texto';
describe('maiúscula só na primeira letra', () => {
  it('não põe maiúscula em "de"', () => {
    expect(maiusculaInicial('novembro de 2026')).toBe('Novembro de 2026');
    expect(maiusculaInicial('')).toBe('');
    expect(maiusculaInicial('Março de 2026')).toBe('Março de 2026');
  });
});

import { agruparPendencias } from '@/plataforma/pendencias';
describe('pendências da tela inicial por app', () => {
  it('juntam as do mesmo app, na ordem do menu, com a plataforma por último', () => {
    const p = [{ n: 1, app: 'comunicacao' }, { n: 2 }, { n: 3, app: 'orcamento' }, { n: 4, app: 'comunicacao' }];
    const g = agruparPendencias(p, ['orcamento', 'requisicoes', 'comunicacao']);
    expect(g.map((x) => [x.app, x.itens.map((i) => i.n)])).toEqual([['orcamento', [3]], ['comunicacao', [1, 4]], [null, [2]]]);
  });
  it('sem pendências, nenhum grupo', () => {
    expect(agruparPendencias([], ['orcamento'])).toEqual([]);
  });
});

import { temMaisColunasADireita } from '@/ui/rolagem';
describe('aviso de mais colunas na tabela', () => {
  it('avisa só quando sobra largura à direita', () => {
    expect(temMaisColunasADireita(0, 600, 900)).toBe(true);
    expect(temMaisColunasADireita(300, 600, 900)).toBe(false);
    expect(temMaisColunasADireita(0, 600, 600)).toBe(false);
    expect(temMaisColunasADireita(299.5, 600, 900)).toBe(false);
  });
});
