/**
 * Saúde, entrega 2, com dados FICTÍCIOS: comparativo entre períodos, reavaliação (atrasadas e
 * vencendo), ficha para imprimir, quem vê e a auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { listarAplicacoes, salvarAplicacao, type DadosAplicacao } from '../aplicacao/avaliacoes';
import { comparativoDaPessoa, fichaDaAplicacao } from '../aplicacao/comparativo';
import { TABELAS_SAUDE } from '../dados/tabelas';
import { ErroSaude, situacaoDaReavaliacao } from '../dominio/cer';
import { manifesto } from '../manifesto';

const respostas = (v: number[]) => Object.fromEntries(v.map((x, i) => [i + 1, x]));

describe('situação da reavaliação (regra 12)', () => {
  it('em dia, vence em breve (30 dias antes) e atrasada', () => {
    expect(situacaoDaReavaliacao('2026-12-31', '2026-11-20').situacao).toBe('em_dia');
    expect(situacaoDaReavaliacao('2026-12-20', '2026-11-20').situacao).toBe('vence_em_breve');
    expect(situacaoDaReavaliacao('2026-11-20', '2026-11-20').situacao).toBe('vence_em_breve');
    expect(situacaoDaReavaliacao('2026-11-19', '2026-11-20').situacao).toBe('atrasada');
  });
});

describe('comparativo e ficha', () => {
  let p: Planilhas;
  let pessoaId: string;
  const como = async (email: string) => {
    const [u, a, pp, s] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, { usuarios: u.ativos(), atribuicoes: a.ativos(), perfilPermissoes: pp.ativos(), servicos: s.todos() });
  };
  const dados = (x: Partial<DadosAplicacao> = {}): DadosAplicacao => ({
    pessoaId,
    servico: 'cer_reabilitacao',
    periodoInicio: '2025-01-01',
    periodoFim: '2025-03-31',
    dataIngresso: '2024-12-10',
    profissional: 'Fisioterapeuta (fictícia)',
    funcao: 'Fisioterapia',
    justificativa: 'Conforme a pontuação (fictício).',
    respostas: respostas([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ...x,
  });
  const em = (iso: string) => new Date(`${iso}T15:00:00Z`);

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_saude']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_SAUDE] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
    const [vinculos] = await lerTabelas(p, [VinculosServico] as const);
    pessoaId = vinculos.ativos().find((v) => v.servico === 'cer_reabilitacao')!.pessoa_id;
  });

  it('compara os períodos do mais antigo ao mais recente, com subtotais e diferença do total', async () => {
    const t = await como('tecnico.cer@exemplo.local');
    await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
    const b = await salvarAplicacao(p, t, dados({ periodoInicio: '2025-04-01', periodoFim: '2025-06-30', respostas: respostas([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]) }), { concluir: true, agora: em('2025-07-02') });
    const c = await comparativoDaPessoa(p, t, b.id, { agora: em('2025-07-10') });
    expect(c.comparativo.pontos.map((x) => x.escore.total)).toEqual([10, 20]);
    expect(c.comparativo.diferencaDoTotal).toBe(10);
    expect(c.periodos.map((x) => x.periodoFim)).toEqual(['2025-03-31', '2025-06-30']);
    expect(c.comparativo.pontos[1]!.escore.dominios.map((d) => d.pontos)).toEqual([8, 4, 8]);
    expect(c.periodos[0]!.notas[7]).toBe(1);
    expect(c.reavaliacao).toMatchObject({ vence: '2026-07-02', situacao: 'em_dia' });
  });

  it('a avaliação corrigida sai do comparativo; rascunho não entra e aparece como aberta', async () => {
    const t = await como('tecnico.cer@exemplo.local');
    const a = await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
    await salvarAplicacao(p, t, dados({ respostas: respostas([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]) }), { corrige: a.id, concluir: true, agora: em('2025-04-03') });
    const rasc = await salvarAplicacao(p, t, dados({ periodoInicio: '2025-04-01', periodoFim: '2025-06-30', respostas: { 1: 1 } }), { agora: em('2025-07-02') });
    const c = await comparativoDaPessoa(p, t, a.id);
    expect(c.comparativo.pontos.map((x) => x.escore.total)).toEqual([30]);
    expect(c.comparativo.diferencaDoTotal).toBeNull();
    expect(c.abertaId).toBe(rasc.id);
  });

  it('abrir o comparativo registra leitura e a ficha registra exportação, sem valores', async () => {
    const t = await como('tecnico.cer@exemplo.local');
    const a = await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
    await comparativoDaPessoa(p, t, a.id);
    await fichaDaAplicacao(p, t, a.id);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(aud.some((x) => x.acao === 'leitura' && x.registro_id === a.id && /comparativo/.test(x.detalhes ?? ''))).toBe(true);
    expect(aud.some((x) => x.acao === 'exportacao' && x.registro_id === a.id)).toBe(true);
    expect(aud.every((x) => !/Fisioterap|Conforme/.test(x.detalhes ?? ''))).toBe(true);
  });

  it('a ficha só existe para avaliação concluída', async () => {
    const t = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, t, dados({ respostas: { 1: 1 } }), { agora: em('2025-04-02') });
    await expect(fichaDaAplicacao(p, t, r.id)).rejects.toThrow(ErroSaude);
  });

  it('a lista marca atrasadas e vencendo só na avaliação mais recente da pessoa', async () => {
    const t = await como('tecnico.cer@exemplo.local');
    const a = await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
    const b = await salvarAplicacao(p, t, dados({ periodoInicio: '2025-04-01', periodoFim: '2025-06-30' }), { concluir: true, agora: em('2025-12-05') });
    const lista = await listarAplicacoes(p, t, { agora: em('2026-11-20') });
    const por = (id: string) => lista.find((x) => x.id === id)!;
    expect(por(b.id)).toMatchObject({ proximaAvaliacao: '2026-12-05', reavaliacao: 'vence_em_breve' });
    expect(por(a.id)).toMatchObject({ proximaAvaliacao: null, reavaliacao: null });
    const depois = await listarAplicacoes(p, t, { agora: em('2027-01-10') });
    expect(depois.find((x) => x.id === b.id)!.reavaliacao).toBe('atrasada');
  });

  describe('quem vê', () => {
    it('Conselho, Financeiro e Administração não abrem comparativo nem ficha', async () => {
      const t = await como('tecnico.cer@exemplo.local');
      const a = await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
      for (const email of ['leitura@exemplo.local', 'financeiro@exemplo.local', 'admin@exemplo.local']) {
        const quem = await como(email);
        await expect(comparativoDaPessoa(p, quem, a.id)).rejects.toThrow(ErroPermissao);
        await expect(fichaDaAplicacao(p, quem, a.id)).rejects.toThrow(ErroPermissao);
      }
    });

    it('coordenação de Educação não vê o comparativo do CER; a Diretoria vê', async () => {
      const t = await como('tecnico.cer@exemplo.local');
      const a = await salvarAplicacao(p, t, dados(), { concluir: true, agora: em('2025-04-02') });
      await expect(comparativoDaPessoa(p, await como('coord.educacao@exemplo.local'), a.id)).rejects.toThrow(ErroPermissao);
      expect((await comparativoDaPessoa(p, await como('diretoria@exemplo.local'), a.id)).comparativo.pontos).toHaveLength(1);
    });
  });
});
