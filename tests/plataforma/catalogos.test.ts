/**
 * Catálogo de Parcerias entregue ao Orçamento (R3a, #140): termos fictícios no formato dos termos reais
 * (um termo com 3 fontes; um federal com 2 contas). Nenhum módulo importa outro; quem liga é a plataforma.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { listarFontesDosTermos } from '@/modulos/orcamento/aplicacao/fontes-termo';
import { catalogoParcerias } from '@/plataforma/catalogos';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

let p: Planilhas;
const AGORA = new Date('2026-10-15T12:00:00Z');

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

describe('catálogo de Parcerias para o Orçamento', () => {
  it('entrega os termos em vigor com as fontes, sem o Orçamento importar Parcerias', async () => {
    const termos = await catalogoParcerias(p, AGORA)();
    expect(termos.length).toBeGreaterThan(0);
    const fontes = termos.flatMap((t) => t.fontes);
    expect(fontes.length).toBeGreaterThanOrEqual(3);
    expect(fontes.some((f) => f.nome === 'Piso da enfermagem')).toBe(true);
  });

  it('a tela Fontes dos termos lista tudo sem ligação nos dados fictícios', async () => {
    const lista = await listarFontesDosTermos(p, await como('financeiro@exemplo.local'), catalogoParcerias(p, AGORA));
    expect(lista.linhas.length).toBeGreaterThanOrEqual(3);
    expect(lista.semLigacao).toBe(lista.linhas.length);
  });
});
