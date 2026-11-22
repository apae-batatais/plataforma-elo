import { describe, expect, it, vi } from 'vitest';
import { chamarProximas, escolherProximas, LIMITE_EM_CONSTRUCAO, ocupaVaga } from '../../.github/scripts/fila.mjs';

const issue = (number: number, ...labels: string[]) => ({ number, state: 'open', labels: labels.map((name) => ({ name })) });
const EM = 'etapa: em construção';
const PRONTA = 'etapa: pronta para construir';

describe('fila de construção', () => {
  it('ocupa vaga quem está em construção, exceto quem espera resposta da Diretoria', () => {
    expect(ocupaVaga(issue(1, EM))).toBe(true);
    expect(ocupaVaga(issue(2, EM, 'pergunta aberta'))).toBe(false);
    expect(ocupaVaga(issue(3, PRONTA))).toBe(false);
  });

  it('proposta mãe (com sub-issues) não ocupa vaga nem é chamada: quem constrói é cada sub-issue', () => {
    const mae = (number: number, ...labels: string[]) => ({ ...issue(number, ...labels), sub_issues_summary: { total: 5, completed: 1 } });
    expect(ocupaVaga(mae(1, EM))).toBe(false);
    const abertas = [mae(1, EM), mae(2, EM), issue(3, EM), mae(4, PRONTA), issue(5, PRONTA), issue(6, PRONTA)];
    expect(escolherProximas({ abertas, ordem: [4, 5, 6] }).chamar).toEqual([5, 6]);
  });

  it('o limite é de 3 em construção (revisão de 20/11/2026)', () => {
    expect(LIMITE_EM_CONSTRUCAO).toBe(3);
  });

  it('chama só até completar o limite, na ordem do quadro', () => {
    const abertas = [issue(10, EM), issue(20, PRONTA), issue(30, PRONTA), issue(40, PRONTA)];
    expect(escolherProximas({ abertas, ordem: [40, 20, 30], limite: 2 }).chamar).toEqual([40]);
    expect(escolherProximas({ abertas, ordem: [40, 20, 30] }).chamar).toEqual([40, 20]);
  });

  it('controle de conflitos: evita duas do mesmo app ao mesmo tempo, mas não deixa vaga parada', () => {
    const ORC = 'app: orçamento';
    const COM = 'app: comunicação';
    // Orçamento já em construção: pula a 2ª do Orçamento e chama a de outro app, mesmo depois na ordem.
    let abertas = [issue(1, EM, ORC), issue(2, PRONTA, ORC), issue(3, PRONTA, COM)];
    expect(escolherProximas({ abertas, ordem: [2, 3], limite: 2 }).chamar).toEqual([3]);
    // Duas prontas do mesmo app e nada em construção: chama só uma delas e a de outro app.
    abertas = [issue(2, PRONTA, ORC), issue(4, PRONTA, ORC), issue(3, PRONTA, COM)];
    expect(escolherProximas({ abertas, ordem: [2, 4, 3], limite: 2 }).chamar).toEqual([2, 3]);
    // Sem alternativa de outro app: completa a vaga mesmo repetindo o app.
    abertas = [issue(1, EM, ORC), issue(2, PRONTA, ORC)];
    expect(escolherProximas({ abertas, limite: 2 }).chamar).toEqual([2]);
    // "app: novo" não conta como o mesmo app.
    abertas = [issue(1, EM, 'app: novo'), issue(2, PRONTA, 'app: novo')];
    expect(escolherProximas({ abertas, limite: 2 }).chamar).toEqual([2]);
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
    expect(escolherProximas({ abertas: [issue(1, EM), issue(2, EM), issue(5, EM), issue(3, PRONTA)] }).chamar).toEqual([]);
    const r = escolherProximas({ abertas: [issue(3, PRONTA)], pausa: true });
    expect(r.chamar).toEqual([]);
    expect(r.motivo).toContain('pausa');
  });

  it('quem espera resposta da Diretoria não segura a fila', () => {
    const abertas = [issue(1, EM, 'pergunta aberta'), issue(2, EM), issue(3, PRONTA)];
    expect(escolherProximas({ abertas, limite: 2 }).chamar).toEqual([3]);
  });

  it('chama o Desenvolvedor e já põe a issue em construção; respeita a etiqueta de pausa', async () => {
    const issues = [issue(1, EM), issue(6, EM), issue(7, PRONTA), issue(8, PRONTA)];
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
