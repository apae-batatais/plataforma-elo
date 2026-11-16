import { describe, expect, it, vi } from 'vitest';
import { chamarProximas, escolherProximas, ocupaVaga } from '../../.github/scripts/fila.mjs';

const issue = (number: number, ...labels: string[]) => ({ number, state: 'open', labels: labels.map((name) => ({ name })) });
const EM = 'etapa: em construção';
const PRONTA = 'etapa: pronta para construir';

describe('fila de construção', () => {
  it('ocupa vaga quem está em construção, exceto quem espera resposta da Diretoria', () => {
    expect(ocupaVaga(issue(1, EM))).toBe(true);
    expect(ocupaVaga(issue(2, EM, 'pergunta aberta'))).toBe(false);
    expect(ocupaVaga(issue(3, PRONTA))).toBe(false);
  });

  it('chama só até completar 2 em construção, na ordem do quadro', () => {
    const abertas = [issue(10, EM), issue(20, PRONTA), issue(30, PRONTA), issue(40, PRONTA)];
    expect(escolherProximas({ abertas, ordem: [40, 20, 30] }).chamar).toEqual([40]);
  });

  it('sem ordem do quadro, vale a proposta mais antiga', () => {
    const abertas = [issue(30, PRONTA), issue(20, PRONTA)];
    expect(escolherProximas({ abertas }).chamar).toEqual([20, 30]);
  });

  it('proposta fora do quadro vai para o fim da fila', () => {
    const abertas = [issue(5, PRONTA), issue(9, PRONTA)];
    expect(escolherProximas({ abertas, ordem: [9] }).chamar).toEqual([9, 5]);
  });

  it('não chama ninguém com 2 em construção, nem com a pausa por cota', () => {
    expect(escolherProximas({ abertas: [issue(1, EM), issue(2, EM), issue(3, PRONTA)] }).chamar).toEqual([]);
    const r = escolherProximas({ abertas: [issue(3, PRONTA)], pausa: true });
    expect(r.chamar).toEqual([]);
    expect(r.motivo).toContain('pausa');
  });

  it('quem espera resposta da Diretoria não segura a fila', () => {
    const abertas = [issue(1, EM, 'pergunta aberta'), issue(2, EM), issue(3, PRONTA)];
    expect(escolherProximas({ abertas }).chamar).toEqual([3]);
  });

  it('chama o Desenvolvedor e já põe a issue em construção; respeita a etiqueta de pausa', async () => {
    const issues = [issue(1, EM), issue(7, PRONTA), issue(8, PRONTA)];
    const github = {
      paginate: vi.fn(async () => issues),
      rest: {
        issues: {
          listForRepo: vi.fn(),
          get: vi.fn(async ({ issue_number }: { issue_number: number }) => ({ data: { ...issues.find((i) => i.number === issue_number)!, node_id: 'x' } })),
          removeLabel: vi.fn(),
          addLabels: vi.fn(),
          update: vi.fn(),
        },
        actions: { createWorkflowDispatch: vi.fn() },
      },
    };
    const core = { info: vi.fn(), notice: vi.fn(), warning: vi.fn() };
    const context = { repo: { owner: 'org', repo: 'elo' } };
    expect(await chamarProximas({ github, context, core })).toEqual([7]);
    expect(github.rest.issues.addLabels).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 7, labels: [EM] }));
    expect(github.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_id: 'claude-desenvolvedor.yml', inputs: { issue: '7' } }),
    );

    issues.push(issue(99, 'pendência da Diretoria', 'cota: pausa'));
    github.rest.actions.createWorkflowDispatch.mockClear();
    expect(await chamarProximas({ github, context, core })).toEqual([]);
    expect(github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled();
  });
});
