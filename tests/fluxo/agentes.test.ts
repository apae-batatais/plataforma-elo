import { describe, expect, it, vi } from 'vitest';
import { atualizarConflitos, avisarFalha, candidatoAAtualizar, mensagemFalha, situacaoDoMerge } from '../../.github/scripts/agentes.mjs';

const REPO = 'org/elo';
const contexto = { repo: { owner: 'org', repo: 'elo' }, serverUrl: 'https://github.com', runId: 42 };
const core = () => ({ info: vi.fn(), notice: vi.fn(), warning: vi.fn() });

type PR = {
  number: number;
  state?: string;
  draft?: boolean;
  labels?: { name: string }[];
  base?: { ref: string };
  head?: { repo: { full_name: string } };
};

function pr(number: number, extra: Partial<PR> = {}): PR {
  return {
    number,
    state: 'open',
    draft: false,
    labels: [{ name: 'PR: entrega' }],
    base: { ref: 'main' },
    head: { repo: { full_name: REPO } },
    ...extra,
  };
}

describe('aviso de falha dos agentes', () => {
  it('traz o link do registro e diz como tentar de novo, conforme o agente', () => {
    const texto = mensagemFalha({ agente: 'desenvolvedor', endereco: 'https://exemplo/runs/1' });
    expect(texto).toContain('O Desenvolvedor falhou');
    expect(texto).toContain('https://exemplo/runs/1');
    expect(texto).toContain('responda aqui');
    expect(mensagemFalha({ agente: 'claude', endereco: 'x' })).toContain('"@claude"');
    expect(mensagemFalha({ agente: 'ajuste', endereco: 'x' })).toContain('Request changes');
    expect(mensagemFalha({ agente: 'atualizar', endereco: 'x' })).toContain('@claude atualize este PR com a main');
  });

  it('recusa agente desconhecido', () => {
    expect(() => mensagemFalha({ agente: 'outro' as never, endereco: 'x' })).toThrow('agente desconhecido');
  });

  it('comenta na issue e põe a etiqueta "pergunta aberta"', async () => {
    const github = { rest: { issues: { createComment: vi.fn(), addLabels: vi.fn() } } };
    await avisarFalha({ github, context: contexto, core: core(), agente: 'arquiteto', numero: '131' });
    expect(github.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 131, body: expect.stringContaining('https://github.com/org/elo/actions/runs/42') }),
    );
    expect(github.rest.issues.addLabels).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 131, labels: ['pergunta aberta'] }));
  });
});

describe('atualização dos PRs em conflito', () => {
  it('só atualiza PR de proposta, aberto, fora de rascunho, do próprio repositório e contra a main', () => {
    expect(candidatoAAtualizar(pr(1), REPO)).toBe(true);
    expect(candidatoAAtualizar(pr(2, { labels: [{ name: 'PR: especificação' }] }), REPO)).toBe(true);
    expect(candidatoAAtualizar(pr(3, { labels: [] }), REPO)).toBe(false); // manutenção
    expect(candidatoAAtualizar(pr(4, { draft: true }), REPO)).toBe(false);
    expect(candidatoAAtualizar(pr(5, { head: { repo: { full_name: 'outro/elo' } } }), REPO)).toBe(false);
    expect(candidatoAAtualizar(pr(6, { base: { ref: 'outro' } }), REPO)).toBe(false);
    expect(candidatoAAtualizar(pr(7, { state: 'closed' }), REPO)).toBe(false);
  });

  it('lê a situação do merge informada pelo GitHub', () => {
    expect(situacaoDoMerge({ mergeable: false })).toBe('conflito');
    expect(situacaoDoMerge({ mergeable: null, mergeable_state: 'dirty' })).toBe('conflito');
    expect(situacaoDoMerge({ mergeable: true })).toBe('ok');
    expect(situacaoDoMerge({ mergeable: null })).toBe('desconhecido');
  });

  it('chama a atualização só para quem está em conflito, esperando o GitHub calcular', async () => {
    const respostas: Record<number, { mergeable: boolean | null }[]> = {
      10: [{ mergeable: null }, { mergeable: false }], // calcula na segunda consulta: conflito
      11: [{ mergeable: true }], // sem conflito
      12: [{ mergeable: null }, { mergeable: null }, { mergeable: null }], // GitHub não respondeu
    };
    const abertos = [pr(10), pr(11), pr(12), pr(13, { labels: [] })];
    const github = {
      paginate: vi.fn(async () => abertos),
      rest: {
        pulls: {
          list: vi.fn(),
          get: vi.fn(async ({ pull_number }: { pull_number: number }) => ({ data: respostas[pull_number].shift() })),
        },
        actions: { createWorkflowDispatch: vi.fn() },
      },
    };
    const c = core();
    const esperar = vi.fn(async () => {});
    const enviados = await atualizarConflitos({ github, context: contexto, core: c, tentativas: 3, esperar });

    expect(enviados).toEqual([10]);
    expect(github.rest.actions.createWorkflowDispatch).toHaveBeenCalledTimes(1);
    expect(github.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_id: 'atualizar-pr.yml', ref: 'main', inputs: { pr: '10' } }),
    );
    expect(c.warning).toHaveBeenCalledWith(expect.stringContaining('#12'));
    expect(github.rest.pulls.get).not.toHaveBeenCalledWith(expect.objectContaining({ pull_number: 13 }));
  });
});
