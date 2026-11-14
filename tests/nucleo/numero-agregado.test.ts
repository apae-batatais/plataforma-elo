/** Número agregado protegido (ADR-023): mínimo de 5 pessoas, aplicado na origem. */
import { describe, expect, it } from 'vitest';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { VinculosServico } from '@/nucleo/estrutura/tabelas';
import { MINIMO_DE_PESSOAS, numeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { vinculosAtivosProtegido } from '@/nucleo/pessoas/contagem';

describe('numeroAgregado', () => {
  it('o mínimo é de 5 pessoas', () => expect(MINIMO_DE_PESSOAS).toBe(5));

  it('base de 1 a 4 nunca mostra o valor, em nenhum tipo', () => {
    for (const base of [1, 2, 3, 4]) {
      for (const tipo of ['contagem', 'media', 'percentual'] as const) {
        expect(numeroAgregado({ valor: base, base, tipo })).toEqual({ valor: null, base, motivo: 'poucos_casos' });
      }
    }
  });

  it('com 5 pessoas ou mais mostra o valor', () => {
    expect(numeroAgregado({ valor: 5, base: 5, tipo: 'contagem' })).toEqual({ valor: 5, base: 5, motivo: null });
    expect(numeroAgregado({ valor: 62.5, base: 8, tipo: 'percentual' })).toEqual({ valor: 62.5, base: 8, motivo: null });
  });

  it('base 0: contagem mostra 0; média e percentual são "sem dados"', () => {
    expect(numeroAgregado({ valor: 0, base: 0, tipo: 'contagem' })).toEqual({ valor: 0, base: 0, motivo: null });
    expect(numeroAgregado({ valor: null, base: 0, tipo: 'media' })).toEqual({ valor: null, base: 0, motivo: 'sem_dados' });
    expect(numeroAgregado({ valor: null, base: 0, tipo: 'percentual' })).toEqual({ valor: null, base: 0, motivo: 'sem_dados' });
  });

  it('a resposta só tem valor, base e motivo', () => {
    expect(Object.keys(numeroAgregado({ valor: 3, base: 9, tipo: 'media' })).sort()).toEqual(['base', 'motivo', 'valor']);
  });
});

describe('vinculosAtivosProtegido', () => {
  async function planilhaCom(qtd: number, extra?: { saida: string }) {
    const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria']), idDe: (c) => c };
    await prepararEstrutura(p, { tabelas: [], perfis: [], permissoes: [] });
    for (let i = 0; i < qtd; i++) await inserir(p, VinculosServico, { pessoa_id: `p${i}`, servico: 'escola', entrada: '2026-01-01', ...(extra ?? {}) }, { email: 'teste' });
    await inserir(p, VinculosServico, { pessoa_id: 'outro', servico: 'outro_servico', entrada: '2026-01-01' }, { email: 'teste' });
    return p;
  }

  it('4 pessoas: poucos casos; 5 pessoas: mostra 5; 0: mostra 0', async () => {
    expect(await vinculosAtivosProtegido(await planilhaCom(4), 'escola', '2026-11-14')).toEqual({ valor: null, base: 4, motivo: 'poucos_casos' });
    expect(await vinculosAtivosProtegido(await planilhaCom(5), 'escola', '2026-11-14')).toEqual({ valor: 5, base: 5, motivo: null });
    expect(await vinculosAtivosProtegido(await planilhaCom(0), 'escola', '2026-11-14')).toEqual({ valor: 0, base: 0, motivo: null });
  });

  it('quem já saiu do serviço não conta', async () => {
    expect((await vinculosAtivosProtegido(await planilhaCom(6, { saida: '2026-05-01' }), 'escola', '2026-11-14')).base).toBe(0);
  });
});
