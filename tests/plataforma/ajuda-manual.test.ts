import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { PERMISSOES_INICIAIS } from '@/nucleo/estrutura/dados-iniciais';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { autorizadorTotal, calcularPode, menuCompleto, montarAssuntos, perfisPara, textoPara, type Assunto } from '@/app/(elo)/ajuda/assuntos';

const instituicao = { nome: 'Instituição' };

function com(...permissoes: string[]): Autorizador {
  const set = new Set(permissoes);
  return { permissoes: () => set, temPermissao: (p: string) => set.has(p), temPermissaoAlgumEscopo: (p: string) => set.has(p) } as unknown as Autorizador;
}
const manual = () => montarAssuntos({ pode: calcularPode(autorizadorTotal(), true), instituicao, encarregado: null });
const daAjuda = (a: Autorizador) => montarAssuntos({ pode: calcularPode(a), instituicao, encarregado: null });
const html = (s: Assunto) => renderToStaticMarkup(createElement('div', null, s.conteudo));

/** Perfis que existem nas permissões iniciais e nas dos módulos. */
const permissoesDoPerfil = (perfil: string) =>
  [...PERMISSOES_INICIAIS, ...(ESTRUTURA_DOS_MODULOS.permissoes ?? [])].filter((x) => x.perfil === perfil).map((x) => x.permissao);

describe('Ajuda e manual: fonte única (ADR-040)', () => {
  it('regra 1: o manual traz todos os assuntos, sem repetir id', () => {
    const ids = manual().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('primeiros-passos');
    expect(ids).toContain('duvidas');
    expect(ids).toContain('orcamento');
  });

  it('regra 2: "Para:" vem das permissões e muda quando a permissão do perfil muda', () => {
    const orc = manual().find((s) => s.id === 'orcamento')!;
    expect(textoPara(orc)).toContain('Diretoria');
    expect(textoPara(orc)).toContain('Financeiro');
    expect(textoPara(orc)).not.toContain('Funcionário');
    const doFuncionario = { perfil: 'funcionario', permissao: 'orcamento.previsao.editar' };
    PERMISSOES_INICIAIS.push(doFuncionario);
    try {
      expect(textoPara(orc)).toContain('Funcionário');
    } finally {
      PERMISSOES_INICIAIS.splice(PERMISSOES_INICIAIS.indexOf(doFuncionario), 1);
    }
    expect(textoPara(orc)).not.toContain('Funcionário');
  });

  it('regra 2: assunto sem permissão vale para todos os perfis', () => {
    const primeiros = manual().find((s) => s.id === 'primeiros-passos')!;
    expect(perfisPara(primeiros.permissoes)).toEqual([]);
    expect(textoPara(primeiros)).toBe('todos os perfis');
  });

  it('regra 3: a Ajuda de cada perfil é parte do manual, na mesma ordem', () => {
    const todos = manual();
    const perfis = ['administrador_plataforma', 'diretoria', 'financeiro', 'coordenacao_servico', 'tecnico_avaliador', 'leitura', 'funcionario'];
    for (const perfil of perfis) {
      const ajuda = daAjuda(com(...permissoesDoPerfil(perfil)));
      const ids = ajuda.map((s) => s.id);
      expect(ids.length).toBeGreaterThan(1);
      expect(todos.map((s) => s.id).filter((id) => ids.includes(id))).toEqual(ids);
    }
  });

  it('regra 3: um perfil limitado não vê na Ajuda o que é de outro perfil', () => {
    const ids = daAjuda(com(...permissoesDoPerfil('funcionario'))).map((s) => s.id);
    expect(ids).not.toContain('orcamento');
    expect(ids).not.toContain('administracao');
    expect(daAjuda(com()).map((s) => s.id)).toEqual(['primeiros-passos', 'duvidas']);
  });

  it('regra 3: o texto de um assunto é o mesmo na Ajuda e no manual quando a pessoa pode tudo daquele assunto', () => {
    const ajuda = daAjuda(autorizadorTotal());
    // "propor" é só de quem não decide a previsão; o manual traz todos.
    const tudo = manual();
    for (const s of ajuda) expect(html(tudo.find((t) => t.id === s.id)!)).toBe(html(s));
  });

  it('regra 4: toda tela do menu (app ou item de primeiro nível) tem um assunto cujos atalhos a alcançam', () => {
    // Pendentes: ganham assunto nas entregas 2 e 3 da proposta #232. A lista só pode encolher.
    const pendentes: Record<string, string> = {
      '/agenda': 'entrega 2 (Agenda e busca)',
      '/nucleo/pessoas': 'entrega 2 (Pessoas)',
      '/indicadores': 'entrega 2 (Indicadores)',
      '/servicos': 'entrega 2 (Fichas de serviço)',
      '/admin/feriados': 'entrega 2 (Administração: Feriados)',
      '/admin/encarregado': 'entrega 2 (Administração: Encarregado de dados)',
      '/admin/estrutura': 'entrega 2 (Administração: Estrutura das planilhas)',
    };
    // Telas só de apoio, sem passo a passo próprio (motivo ao lado).
    const apoio: Record<string, string> = { '/ajuda': 'A própria Ajuda.' };
    const atalhos = manual().flatMap((s) => s.atalhos ?? []).map((t) => t.href);
    const principais = menuCompleto().flatMap((g) => g.itens.flatMap((i) => (i.apps ? i.apps : [i])));
    const semAssunto = principais
      .filter((t) => !(t.href in apoio) && t.href !== '/')
      .filter((t) => !atalhos.some((h) => t.href === h || h.startsWith(`${t.href}/`) || t.href.startsWith(`${h}/`)))
      .map((t) => t.href);
    expect(semAssunto.sort()).toEqual(Object.keys(pendentes).sort());
  });

  it('regra 6: nenhum PDF do manual fica no repositório e nada aponta para ele', () => {
    expect(existsSync(join(process.cwd(), 'public/manual/manual-elo.pdf'))).toBe(false);
    const achados: string[] = [];
    const ler = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) ler(p);
        else if (/\.(tsx?|css)$/.test(nome) && readFileSync(p, 'utf8').includes('manual-elo.pdf')) achados.push(p);
      }
    };
    ler(join(process.cwd(), 'src'));
    expect(achados).toEqual([]);
  });
});
