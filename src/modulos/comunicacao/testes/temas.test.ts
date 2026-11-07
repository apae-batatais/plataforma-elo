import { describe, expect, it } from 'vitest';
import type { TipoPeca } from '../dominio/pedido';
import { dataPorExtenso, distanciaDoTema, sugerirTemas } from '../telas/temas';

const item = (id: string, inicio: string, fim: string, tipos: TipoPeca[] = ['post_instagram']) => ({ id, tema: id, inicio, fim, tipos });

const consciencia = item('consciencia', '2026-11-01', '2026-11-30', ['post_instagram', 'artigo']);
const campanha = item('campanha', '2026-11-16', '2026-12-18', ['release', 'post_instagram']);
const festa = item('festa', '2026-11-21', '2026-11-21', ['reel_instagram']);
const natal = item('natal', '2026-12-24', '2026-12-24');
const pascoa = item('pascoa', '2027-04-04', '2027-04-04');
const itens = [consciencia, campanha, festa, natal, pascoa];

describe('sugestão de temas no pedido', () => {
  it('mede a distância até o período do tema, zero dentro dele', () => {
    expect(distanciaDoTema(campanha, '2026-12-01')).toBe(0);
    expect(distanciaDoTema(festa, '2026-11-18')).toBe(3);
    expect(distanciaDoTema(festa, '2026-11-25')).toBe(4);
  });

  it('sem data, sugere os temas perto de hoje e deixa de fora os distantes', () => {
    const ids = sugerirTemas(itens, { data: '', tipo: '', hoje: '2026-11-07' }).map((i) => i.id);
    expect(ids).toEqual(['consciencia', 'campanha', 'festa']);
  });

  it('com data, os temas que cobrem a data vêm primeiro', () => {
    const ids = sugerirTemas(itens, { data: '2026-12-10', tipo: '', hoje: '2026-11-07' }).map((i) => i.id);
    expect(ids).toEqual(['campanha', 'consciencia', 'natal', 'festa']);
  });

  it('no empate, vem primeiro o tema que sugere o tipo de peça escolhido', () => {
    const ids = sugerirTemas(itens, { data: '2026-11-21', tipo: 'reel_instagram', hoje: '2026-11-07' }).map((i) => i.id);
    expect(ids.slice(0, 3)).toEqual(['festa', 'consciencia', 'campanha']);
  });

  it('data no passado conta como hoje e mostra no máximo 4 temas', () => {
    expect(sugerirTemas(itens, { data: '2026-01-01', tipo: '', hoje: '2026-11-07' }).map((i) => i.id)).toEqual(['consciencia', 'campanha', 'festa']);
    const muitos = Array.from({ length: 6 }, (_, n) => item(`t${n}`, '2026-11-10', '2026-11-10'));
    expect(sugerirTemas(muitos, { data: '2026-11-10', tipo: '', hoje: '2026-11-07' })).toHaveLength(4);
  });

  it('escreve a data por extenso', () => {
    expect(dataPorExtenso('2026-11-13')).toBe('sexta-feira, 13 de novembro');
    expect(dataPorExtenso('2026-11-15')).toBe('domingo, 15 de novembro');
  });
});
