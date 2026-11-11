import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS_INICIAIS } from '@/nucleo/estrutura/dados-iniciais';

// Regra da Diretoria (11/11/2026): nada que a pessoa vê cita instituição, unidade, marca ou cidade reais.
const PROIBIDOS = /apae|batatais|franca|rural/i;
const EXCECOES = ['src/ui/saudacao.ts']; // lista de e-mails de setor: não é exibida

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === 'testes' ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe('sem nomes próprios', () => {
  it('nenhum arquivo de src/ (fora testes e especificações) cita instituição, marca ou cidade reais', () => {
    const achados = arquivos('src')
      .filter((a) => !EXCECOES.includes(a.replace(/\\/g, '/')))
      .filter((a) => PROIBIDOS.test(readFileSync(a, 'utf8')));
    expect(achados).toEqual([]);
  });

  it('a configuração inicial não traz a área "Rural": são 7 áreas', () => {
    expect(AREAS_INICIAIS).toHaveLength(7);
    expect(AREAS_INICIAIS.some((a) => /rural/i.test(a.nome))).toBe(false);
  });
});
