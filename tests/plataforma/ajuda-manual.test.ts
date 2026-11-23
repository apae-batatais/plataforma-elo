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
    expect(daAjuda(com()).map((s) => s.id)).toEqual(['primeiros-passos', 'agenda-busca', 'duvidas']);
  });

  it('regra 3: o texto de um assunto é o mesmo na Ajuda e no manual quando a pessoa pode tudo daquele assunto', () => {
    const ajuda = daAjuda(autorizadorTotal());
    // "propor" é só de quem não decide a previsão; o manual traz todos.
    const tudo = manual();
    for (const s of ajuda) expect(html(tudo.find((t) => t.id === s.id)!)).toBe(html(s));
  });

  it('regra 4: toda tela do menu (app ou item de primeiro nível) tem um assunto cujos atalhos a alcançam', () => {
    // Pendentes: nenhuma (a entrega 3 da proposta #232 cobriu as últimas). Não deve voltar a crescer sem motivo.
    const pendentes: Record<string, string> = {
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

  it('entrega 2: os assuntos de Agenda, Pessoas, Indicadores, Fichas e Administração existem e dizem para quem são', () => {
    const todos = manual();
    for (const id of ['agenda-busca', 'pessoas', 'indicadores', 'fichas-de-servico', 'administracao']) expect(todos.map((s) => s.id)).toContain(id);
    expect(textoPara(todos.find((s) => s.id === 'agenda-busca')!)).toBe('todos os perfis');
    expect(textoPara(todos.find((s) => s.id === 'indicadores')!)).toContain('Diretoria');
    expect(textoPara(todos.find((s) => s.id === 'indicadores')!)).not.toContain('Funcionário');
    const adm = todos.find((s) => s.id === 'administracao')!;
    expect(adm.atalhos?.map((a) => a.href)).toEqual(expect.arrayContaining(['/admin/feriados', '/admin/encarregado', '/admin/estrutura']));
  });

  it('entrega 2: perfil limitado vê Agenda e busca, mas não Pessoas, Indicadores nem Administração', () => {
    const ids = daAjuda(com(...permissoesDoPerfil('funcionario'))).map((s) => s.id);
    expect(ids).toContain('agenda-busca');
    for (const id of ['pessoas', 'indicadores', 'administracao']) expect(ids).not.toContain(id);
  });

  it('entrega 3: Saúde, Educação, Projetos, Parcerias e Comunicação têm assunto e dizem para quem são', () => {
    const todos = manual();
    for (const id of ['saude', 'educacao', 'projetos', 'parcerias', 'comunicacao', 'comunicacao-avisos', 'resultado-instagram']) expect(todos.map((s) => s.id)).toContain(id);
    expect(textoPara(todos.find((s) => s.id === 'parcerias')!)).toContain('Financeiro');
    expect(textoPara(todos.find((s) => s.id === 'comunicacao')!)).toContain('Coordenação da Comunicação');
    const hrefs = todos.find((s) => s.id === 'comunicacao')!.atalhos!.map((a) => a.href);
    expect(hrefs).toEqual(expect.arrayContaining(['/comunicacao/novo', '/comunicacao/pedidos', '/comunicacao/calendario', '/comunicacao/contatos', '/comunicacao/configuracoes']));
  });

  it('entrega 3: Parcerias e a parte da equipe de Comunicação só aparecem para quem tem a permissão', () => {
    const limitado = daAjuda(com('comunicacao.solicitar'));
    expect(limitado.map((s) => s.id)).toContain('comunicacao');
    expect(limitado.map((s) => s.id)).not.toContain('parcerias');
    expect(html(limitado.find((s) => s.id === 'comunicacao')!)).not.toContain('Calendário e contatos');
    expect(html(manual().find((s) => s.id === 'comunicacao')!)).toContain('Calendário e contatos');
    const leitura = daAjuda(com('parcerias.termos.ver'));
    expect(html(leitura.find((s) => s.id === 'parcerias')!)).not.toContain('Novo termo e siga');
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
