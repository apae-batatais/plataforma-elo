/**
 * Saúde, entrega 3, com dados FICTÍCIOS: painel agregado por serviço e período, mínimo de 5 pessoas,
 * cada pessoa uma vez e quem vê.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { salvarAplicacao, type DadosAplicacao } from '../aplicacao/avaliacoes';
import { painelDeSaude, resumirPainel } from '../aplicacao/painel';
import { TABELAS_SAUDE } from '../dados/tabelas';
import { manifesto } from '../manifesto';

const respostas = (v: number[]) => Object.fromEntries(v.map((x, i) => [i + 1, x]));
const em = (iso: string) => new Date(`${iso}T15:00:00Z`);
const PADROES = [
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // 30, evoluindo
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 1, 1, 1, 1], // 16, parcial; Barreira mais baixa
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // 2, não evoluindo
  [3, 3, 3, 3, 2, 2, 3, 3, 3, 3], // 28, evoluindo
];

describe('painel de Saúde', () => {
  let p: Planilhas;
  let pessoas: string[];
  const como = async (email: string) => {
    const [u, a, pp, s] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, { usuarios: u.ativos(), atribuicoes: a.ativos(), perfilPermissoes: pp.ativos(), servicos: s.todos() });
  };
  const dados = (pessoaId: string, x: Partial<DadosAplicacao> = {}): DadosAplicacao => ({
    pessoaId,
    servico: 'cer_reabilitacao',
    periodoInicio: '2024-01-01',
    periodoFim: '2024-03-31',
    dataIngresso: '2023-12-10',
    profissional: 'Fisioterapeuta (fictícia)',
    funcao: 'Fisioterapia',
    justificativa: 'Conforme a pontuação (fictício).',
    respostas: respostas(PADROES[0]!),
    ...x,
  });
  const avaliar = async (n: number, extra: (i: number) => Partial<DadosAplicacao> = () => ({})) => {
    const t = await como('tecnico.cer@exemplo.local');
    for (let i = 0; i < n; i++) await salvarAplicacao(p, t, dados(pessoas[i]!, { respostas: respostas(PADROES[i]!), ...extra(i) }), { concluir: true, agora: em('2024-04-02') });
  };

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_saude']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_SAUDE] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
    const [vinculos] = await lerTabelas(p, [VinculosServico] as const);
    pessoas = [...new Set(vinculos.ativos().filter((v) => v.servico === 'cer_reabilitacao').map((v) => v.pessoa_id))];
    expect(pessoas.length).toBeGreaterThanOrEqual(5);
  });

  it('com 5 pessoas mostra total médio, % evoluindo, faixas e dimensões em % do máximo', async () => {
    await avaliar(5);
    const r = await painelDeSaude(p, await como('diretoria@exemplo.local'), { de: '2024-01', ate: '2024-12' });
    expect(r.pessoas).toMatchObject({ valor: 5, base: 5 });
    expect(r.totalMedio.valor).toBe(21.2); // (30+30+16+2+28)/5; a demonstração é de 2026 e fica fora do filtro
    expect(r.percentualEvoluindo.valor).toBe(60);
    expect(r.faixas.map((f) => f.pessoas.valor)).toEqual([3, 1, 1]);
    expect(r.dimensoes.map((d) => d.nome)).toEqual(['Evolução', 'Adequação', 'Barreira']);
    expect(r.principalBarreira.length).toBeGreaterThan(0);
  });

  it('com menos de 5 pessoas nenhum número sai (nem arredondado)', async () => {
    await avaliar(4);
    const r = await painelDeSaude(p, await como('diretoria@exemplo.local'), { de: '2024-01', ate: '2024-12' });
    {
      expect(r.pessoas.base).toBe(4);
      expect(r.pessoas.valor).toBeNull();
      expect(r.totalMedio.valor).toBeNull();
      expect(r.percentualEvoluindo.valor).toBeNull();
      expect(r.faixas.every((f) => f.percentual.valor === null && f.pessoas.valor === null)).toBe(true);
      expect(r.principalBarreira).toEqual([]);
    }
  });

  it('cada pessoa conta uma vez, pela avaliação mais recente do período; corrigida não conta', async () => {
    await avaliar(5);
    const t = await como('tecnico.cer@exemplo.local');
    await salvarAplicacao(p, t, dados(pessoas[3]!, { periodoInicio: '2024-04-01', periodoFim: '2024-06-30', respostas: respostas(PADROES[0]!) }), { concluir: true, agora: em('2024-07-02') });
    const dir = await como('diretoria@exemplo.local');
    const todas = await painelDeSaude(p, dir, { ate: '2024-12' });
    expect(todas.pessoas.valor).toBe(5);
    expect(todas.faixas[0]!.pessoas.valor).toBe(4); // a pessoa 4 passou a "evoluindo"
    const soPrimeiro = await painelDeSaude(p, dir, { de: '2024-01', ate: '2024-03' });
    expect(soPrimeiro.faixas[0]!.pessoas.valor).toBe(3);
  });

  it('rascunho não entra e o filtro de período sem avaliações mostra 0', async () => {
    await avaliar(5);
    const t = await como('tecnico.cer@exemplo.local');
    await salvarAplicacao(p, t, dados(pessoas[0]!, { periodoInicio: '2024-04-01', periodoFim: '2024-06-30', respostas: { 1: 0 } }), { agora: em('2024-07-02') });
    const dir = await como('diretoria@exemplo.local');
    expect((await painelDeSaude(p, dir, { ate: '2024-12' })).faixas[0]!.pessoas.valor).toBe(3);
    const vazio = await painelDeSaude(p, dir, { de: '2030-01' });
    expect(vazio.pessoas).toMatchObject({ valor: 0, base: 0 });
    expect(vazio.totalMedio.motivo).toBe('sem_dados');
  });

  it('o resumo por serviço esconde serviço com menos de 5 pessoas', () => {
    const escore = (total: number, nome: string) => ({ total, maximo: 30, dominios: [], enquadramento: { nome, de: 0, ate: 30 } });
    const pontos = [
      ...Array.from({ length: 5 }, () => ({ servico: 'a', escore: escore(25, 'Evoluindo adequadamente') })),
      { servico: 'b', escore: escore(5, 'Não evoluindo / serviço potencialmente inadequado') },
    ];
    const r = resumirPainel(pontos as never, new Map([['a', 'Serviço A'], ['b', 'Serviço B']]));
    expect(r.pessoas.valor).toBe(6);
    expect(r.porServico.find((s) => s.servico === 'a')!.pessoas.valor).toBe(5);
    expect(r.porServico.find((s) => s.servico === 'b')!.pessoas.valor).toBeNull();
    expect(r.porServico.find((s) => s.servico === 'b')!.faixas.every((f) => f.percentual.valor === null)).toBe(true);
  });

  describe('quem vê', () => {
    it('Conselho vê o painel; técnico e coordenação do serviço também; Financeiro e Administração não', async () => {
      await avaliar(5);
      const f = { ate: '2024-12' };
      expect((await painelDeSaude(p, await como('leitura@exemplo.local'), f)).pessoas.valor).toBe(5);
      expect((await painelDeSaude(p, await como('tecnico.cer@exemplo.local'), f)).pessoas.valor).toBe(5);
      for (const email of ['financeiro@exemplo.local', 'admin@exemplo.local']) {
        await expect(painelDeSaude(p, await como(email))).rejects.toThrow(ErroPermissao);
      }
    });

    it('coordenação de Educação não vê números do CER', async () => {
      await avaliar(5);
      const r = await painelDeSaude(p, await como('coord.educacao@exemplo.local'));
      expect(r.servicosDisponiveis).toEqual([]);
      expect(r.pessoas).toMatchObject({ valor: 0, base: 0 });
    });

    it('a resposta não traz nome, iniciais nem id de pessoa', async () => {
      await avaliar(5);
      const texto = JSON.stringify(await painelDeSaude(p, await como('diretoria@exemplo.local'), { ate: '2024-12' }));
      for (const id of pessoas) expect(texto).not.toContain(id);
    });
  });
});
