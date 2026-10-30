/**
 * Painel geral: compara os exercícios com os mesmos números da Previsão de cada ano.
 * Dados FICTÍCIOS (2025, 2026 e 2027).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { GRUPO_RH, painelGeral, variacao } from '../aplicacao/painel-geral';
import { lerPrevisao } from '../aplicacao/previsao';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;
const como = async (email: string) => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
};

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
  await popularPrevisaoFicticia(p);
});

describe('painel geral', () => {
  it('um resumo por exercício, em ordem, com os mesmos totais da Previsão', async () => {
    const quem = await como('leitura@exemplo.local');
    const painel = await painelGeral(p, quem);
    expect(painel.anos.map((a) => [a.ano, a.situacao])).toEqual([[2025, 'encerrado'], [2026, 'encerrado'], [2027, 'elaboracao']]);
    for (const a of painel.anos) {
      const prev = await lerPrevisao(p, quem, a.ano);
      expect(a.despesa).toBe(prev.totais.despesa.anual);
      expect(a.receita).toBe(prev.totais.receita.anual);
      expect(a.receitaPublica + a.receitaPropria).toBeCloseTo(a.receita, 1);
      // Todo o RH numa linha só (folha automática, folha consolidada e grupos de RH).
      expect(a.porGrupo[GRUPO_RH]).toBeCloseTo(a.rh, 1);
      expect(Object.values(a.porArea).reduce((s, v) => s + v, 0)).toBeCloseTo(a.despesa, 1);
      // Fontes: somam a receita e a despesa do ano; "A definir" (sem receita) fica por último.
      expect(a.porFonte.reduce((s, f) => s + f.receita, 0)).toBeCloseTo(a.receita, 1);
      expect(a.porFonte.reduce((s, f) => s + f.despesa, 0)).toBeCloseTo(a.despesa, 1);
      const semReceita = a.porFonte.findIndex((f) => f.receita === 0 && f.despesa > 0);
      if (semReceita >= 0) expect(a.porFonte.slice(semReceita).every((f) => f.receita === 0)).toBe(true);
      expect(a.porCaptacao.garantida + a.porCaptacao.negociacao + a.porCaptacao.a_captar).toBeCloseTo(a.receita, 1);
    }
    expect(painel.grupos[0]).toBe(GRUPO_RH);
  });

  it('variação em relação ao ano anterior e permissão', async () => {
    expect(variacao(110, 100)).toBe(10);
    expect(variacao(90, 100)).toBe(-10);
    expect(variacao(5, 0)).toBeNull();
    await expect(painelGeral(p, await como('dp@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });
});
