import { describe, expect, it, vi } from 'vitest';
import { aplicar, entregaParcial, etapaDaEtiqueta, etiquetaDe, executar, mudancas, podeConstruir, referencias, temPerguntaAberta, tipoDoPR, trocaDeEtiquetas } from '../../.github/scripts/fluxo-quadro.mjs';

type Issue = { number: number; state: string; labels: { name: string }[]; node_id: string; pull_request?: unknown };

function githubFalso(issues: Issue[]) {
  const achar = (n: number) => issues.find((i) => i.number === n)!;
  const rest = {
    issues: {
      get: vi.fn(async ({ issue_number }: { issue_number: number }) => ({ data: structuredClone(achar(issue_number)) })),
      addLabels: vi.fn(async ({ issue_number, labels }: { issue_number: number; labels: string[] }) => {
        achar(issue_number).labels.push(...labels.map((name) => ({ name })));
      }),
      removeLabel: vi.fn(async ({ issue_number, name }: { issue_number: number; name: string }) => {
        const i = achar(issue_number);
        i.labels = i.labels.filter((l) => l.name !== name);
      }),
      update: vi.fn(async ({ issue_number, state }: { issue_number: number; state: string }) => {
        achar(issue_number).state = state;
      }),
      listForRepo: vi.fn(),
    },
    actions: { createWorkflowDispatch: vi.fn() },
  };
  const paginate = vi.fn(async (_f: unknown, { labels }: { labels?: string }) =>
    issues.filter((i) => !labels || i.labels.some((l) => l.name === labels)).map((i) => structuredClone(i)),
  );
  return { rest, paginate };
}

const core = { info: vi.fn(), notice: vi.fn(), warning: vi.fn() };
const contexto = (eventName: string, payload: unknown) => ({ eventName, payload, repo: { owner: 'org', repo: 'elo' } });
const etiquetas = (i: Issue) => i.labels.map((l) => l.name);

describe('fluxo do quadro', () => {
  it('etiqueta e etapa vão e voltam', () => {
    expect(etiquetaDe('Pronta para construir')).toBe('etapa: pronta para construir');
    expect(etapaDaEtiqueta('etapa: entrega em aprovação')).toBe('Entrega em aprovação');
    expect(etapaDaEtiqueta('app: orçamento')).toBeNull();
    expect(etapaDaEtiqueta('etapa: inexistente')).toBeNull();
  });

  it('acha as issues citadas no PR, sem repetir', () => {
    expect(referencias('Especifica #12\nEntrega #7\nentrega #7\n  Especifica #3')).toEqual({ especifica: [12, 3], entrega: [7] });
    expect(referencias('Fecha #4')).toEqual({ especifica: [], entrega: [] });
  });

  it('só conta a referência no começo da linha, não citada no meio do texto (PR #83)', () => {
    const corpo = 'Entrega #55\n\n- **Não havia PR "Especifica #55"**: usei a especificação aprovada.\nVeja a Entrega #9.';
    expect(referencias(corpo)).toEqual({ especifica: [], entrega: [55] });
    expect(mudancas({ tipo: 'pr_merge', texto: corpo, etiquetas: ['PR: entrega'] })).toEqual([{ issue: 55, etapa: 'Aprovada', fechar: true }]);
  });

  it('issue nova entra em Proposta, menos pendência da Diretoria ou issue que já tem etapa', () => {
    expect(mudancas({ tipo: 'issue_aberta', numero: 5, etiquetas: [] })).toEqual([{ issue: 5, etapa: 'Proposta' }]);
    expect(mudancas({ tipo: 'issue_aberta', numero: 5, etiquetas: ['Pendência da Diretoria'] })).toEqual([]);
    expect(mudancas({ tipo: 'issue_aberta', numero: 5, etiquetas: ['etapa: em construção'] })).toEqual([]);
  });

  it('PR de especificação: aberto, aprovado e fechado sem merge', () => {
    const texto = 'Especifica #9';
    const etiquetas = ['PR: especificação'];
    expect(mudancas({ tipo: 'pr_aberto', texto, etiquetas })).toEqual([{ issue: 9, etapa: 'Especificação em aprovação' }]);
    expect(mudancas({ tipo: 'pr_merge', texto, etiquetas })).toEqual([{ issue: 9, etapa: 'Pronta para construir' }]);
    expect(mudancas({ tipo: 'pr_fechado', texto, etiquetas })).toEqual([{ issue: 9, etapa: 'Proposta' }]);
  });

  it('PR de entrega: rascunho, pronto, aprovado (fecha a issue) e fechado sem merge', () => {
    const texto = 'Entrega #9';
    const etiquetas = ['PR: entrega'];
    expect(mudancas({ tipo: 'pr_aberto', texto, etiquetas, rascunho: true })).toEqual([{ issue: 9, etapa: 'Em construção' }]);
    expect(mudancas({ tipo: 'pr_aberto', texto, etiquetas, rascunho: false })).toEqual([{ issue: 9, etapa: 'Entrega em aprovação' }]);
    expect(mudancas({ tipo: 'pr_merge', texto, etiquetas })).toEqual([{ issue: 9, etapa: 'Aprovada', fechar: true }]);
    expect(mudancas({ tipo: 'pr_fechado', texto, etiquetas })).toEqual([{ issue: 9, etapa: 'Pronta para construir' }]);
  });

  it('PR sem etiqueta de tipo, ou com tipo que não combina, não move nenhuma issue', () => {
    expect(mudancas({ tipo: 'pr_merge', texto: 'Entrega #9', etiquetas: [] })).toEqual([]);
    expect(mudancas({ tipo: 'pr_merge', texto: 'Entrega #9', etiquetas: ['PR: especificação'] })).toEqual([]);
  });
});

describe('temPerguntaAberta', () => {
  it('true com a etiqueta, em string ou em objeto', () => {
    expect(temPerguntaAberta(['pergunta aberta'])).toBe(true);
    expect(temPerguntaAberta([{ name: 'pergunta aberta' }])).toBe(true);
  });
  it('false sem a etiqueta, com lista vazia ou sem argumento', () => {
    expect(temPerguntaAberta(['etapa: proposta'])).toBe(false);
    expect(temPerguntaAberta([])).toBe(false);
    expect(temPerguntaAberta()).toBe(false);
  });
});

describe('tipoDoPR', () => {
  it('especificação: etiqueta e "Especifica #n"', () => {
    expect(tipoDoPR({ etiquetas: ['PR: especificação'], texto: 'Especifica #9\nresumo' })).toEqual({ tipo: 'especificacao', issues: [9], erro: null });
  });

  it('entrega: etiqueta e "Entrega #n"', () => {
    expect(tipoDoPR({ etiquetas: ['app: rede', 'PR: entrega'], texto: 'Entrega #9' })).toEqual({ tipo: 'entrega', issues: [9], erro: null });
  });

  it('PR de manutenção, sem etiqueta e sem referência, passa', () => {
    expect(tipoDoPR({ etiquetas: [], texto: 'Fluxo: ajuste' })).toEqual({ tipo: null, issues: [], erro: null });
  });

  it('recusa PR com as duas etiquetas', () => {
    expect(tipoDoPR({ etiquetas: ['PR: especificação', 'PR: entrega'], texto: 'Entrega #9' }).erro).toMatch(/as duas etiquetas/);
  });

  it('recusa referência sem etiqueta', () => {
    expect(tipoDoPR({ etiquetas: [], texto: 'Entrega #9' }).erro).toMatch(/falta a etiqueta "PR: entrega"/);
    expect(tipoDoPR({ etiquetas: [], texto: 'Especifica #9' }).erro).toMatch(/falta a etiqueta "PR: especificação"/);
  });

  it('recusa etiqueta sem a referência certa', () => {
    expect(tipoDoPR({ etiquetas: ['PR: entrega'], texto: 'resumo' }).erro).toMatch(/"Entrega #n"/);
    expect(tipoDoPR({ etiquetas: ['PR: especificação'], texto: 'Entrega #9' }).erro).toMatch(/"Especifica #n"/);
  });

  it('recusa PR que é especificação e entrega ao mesmo tempo', () => {
    expect(tipoDoPR({ etiquetas: ['PR: entrega'], texto: 'Entrega #9\nEspecifica #9' }).erro).toMatch(/especificação e entrega/);
  });


  it('deixa a issue com uma etapa só e não mexe nas outras etiquetas', () => {
    expect(trocaDeEtiquetas(['app: rede', 'etapa: proposta'], 'Pronta para construir')).toEqual({
      remover: ['etapa: proposta'],
      adicionar: 'etapa: pronta para construir',
    });
    expect(trocaDeEtiquetas(['etapa: aprovada'], 'Aprovada')).toEqual({ remover: [], adicionar: null });
  });

  it('merge do PR de entrega: issue vai para Aprovada e é fechada; sem quadro, só avisa', async () => {
    const issues: Issue[] = [{ number: 9, state: 'open', labels: [{ name: 'app: rede' }, { name: 'etapa: entrega em aprovação' }], node_id: 'I9' }];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('pull_request', { action: 'closed', pull_request: { title: 'R4', body: 'Entrega #9', merged: true, state: 'closed', labels: [{ name: 'PR: entrega' }] } }),
    });
    expect(etiquetas(issues[0])).toEqual(['app: rede', 'etapa: aprovada']);
    expect(issues[0].state).toBe('closed');
    expect(core.notice).toHaveBeenCalled();
  });

  it('PR já fechado e editado não volta a issue de etapa', async () => {
    const issues: Issue[] = [{ number: 9, state: 'closed', labels: [{ name: 'etapa: publicada' }], node_id: 'I9' }];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('pull_request', { action: 'edited', pull_request: { title: 'R4', body: 'Entrega #9', state: 'closed', draft: false, labels: [{ name: 'PR: entrega' }] } }),
    });
    expect(etiquetas(issues[0])).toEqual(['etapa: publicada']);
  });

  it('publicação oficial com sucesso passa as aprovadas para Publicada', async () => {
    const issues: Issue[] = [
      { number: 1, state: 'closed', labels: [{ name: 'etapa: aprovada' }], node_id: 'I1' },
      { number: 2, state: 'open', labels: [{ name: 'etapa: em construção' }], node_id: 'I2' },
    ];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('workflow_run', { workflow_run: { conclusion: 'success', event: 'workflow_dispatch', head_branch: 'main' } }),
    });
    expect(etiquetas(issues[0])).toEqual(['etapa: publicada']);
    expect(etiquetas(issues[1])).toEqual(['etapa: em construção']);
  });

  it('publicação agendada (semanal) também conta como oficial', async () => {
    const issues: Issue[] = [{ number: 1, state: 'closed', labels: [{ name: 'etapa: aprovada' }], node_id: 'I1' }];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('workflow_run', { workflow_run: { conclusion: 'success', event: 'schedule', head_branch: 'main' } }),
    });
    expect(etiquetas(issues[0])).toEqual(['etapa: publicada']);
  });

  it('aplicar põe a issue na etapa pedida sem depender de evento', async () => {
    const issues: Issue[] = [{ number: 7, state: 'open', labels: [{ name: 'etapa: pronta para construir' }], node_id: 'I7' }];
    const github = githubFalso(issues);
    await aplicar({ github, core, context: contexto('workflow_dispatch', {}), lista: [{ issue: 7, etapa: 'Em construção' }] });
    expect(etiquetas(issues[0])).toEqual(['etapa: em construção']);
  });

  it('aplicar não falha se outra automação já tirou a etiqueta antiga (#281)', async () => {
    const issues: Issue[] = [{ number: 8, state: 'open', labels: [{ name: 'etapa: em construção' }], node_id: 'I8' }];
    const github = githubFalso(issues);
    const tirar = github.rest.issues.removeLabel.getMockImplementation()!;
    github.rest.issues.removeLabel.mockImplementation(async (a) => {
      await tirar(a);
      throw Object.assign(new Error('Label does not exist'), { status: 404 });
    });
    await aplicar({ github, core, context: contexto('workflow_dispatch', {}), lista: [{ issue: 8, etapa: 'Entrega em aprovação' }] });
    expect(etiquetas(issues[0])).toEqual(['etapa: entrega em aprovação']);
  });

  it('entrega parcial aprovada devolve a proposta à fila e chama a Fila (#281)', async () => {
    const issues: Issue[] = [{ number: 281, state: 'open', labels: [{ name: 'etapa: entrega em aprovação' }], node_id: 'I281' }];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('pull_request', { action: 'closed', pull_request: { title: 'Entrega: evento (2 de 3)', body: 'Entrega #281', merged: true, state: 'closed', labels: [{ name: 'PR: entrega' }] } }),
    });
    expect(etiquetas(issues[0])).toEqual(['etapa: pronta para construir']);
    expect(github.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith(expect.objectContaining({ workflow_id: 'fila.yml', ref: 'main' }));
  });

  it('prévia de PR (publicação que não é a oficial) não publica nada', async () => {
    const issues: Issue[] = [{ number: 1, state: 'closed', labels: [{ name: 'etapa: aprovada' }], node_id: 'I1' }];
    const github = githubFalso(issues);
    await executar({
      github, core,
      context: contexto('workflow_run', { workflow_run: { conclusion: 'success', event: 'pull_request', head_branch: 'feat/x' } }),
    });
    expect(etiquetas(issues[0])).toEqual(['etapa: aprovada']);
  });

  it('com quadro configurado, move o cartão para a coluna da etapa', async () => {
    const issues: Issue[] = [{ number: 4, state: 'open', labels: [], node_id: 'I4' }];
    const github = githubFalso(issues);
    const chamadas: string[] = [];
    const respostas = [
      { organization: { projectV2: { id: 'P', field: { id: 'F', options: [{ id: 'O1', name: 'Proposta' }] } } } },
      { node: { projectItems: { nodes: [] } } },
      { addProjectV2ItemById: { item: { id: 'IT' } } },
      { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'IT' } } },
    ];
    const fetchFalso = vi.fn(async (_url: string, init: { body: string }) => {
      chamadas.push(JSON.parse(init.body).query.slice(0, 20));
      return { ok: true, json: async () => ({ data: respostas.shift() }) };
    });
    vi.stubGlobal('fetch', fetchFalso);
    await executar({
      github, core, tokenQuadro: 't', numeroQuadro: '3',
      context: contexto('issues', { action: 'opened', issue: { number: 4, labels: [] } }),
    });
    vi.unstubAllGlobals();
    expect(etiquetas(issues[0])).toEqual(['etapa: proposta']);
    expect(fetchFalso).toHaveBeenCalledTimes(4);
    const ultima = JSON.parse(fetchFalso.mock.calls[3][1].body);
    expect(ultima.variables).toEqual({ p: 'P', i: 'IT', f: 'F', o: 'O1' });
  });
});

describe('podeConstruir', () => {
  const issue = (state: string, etiquetas: string[]) => ({ state, labels: etiquetas.map((name) => ({ name })) });

  it('constrói issue aberta pronta para construir ou já em construção', () => {
    expect(podeConstruir(issue('open', ['etapa: pronta para construir', 'app: orçamento']))).toEqual({ pode: true });
    expect(podeConstruir(issue('open', ['etapa: em construção']))).toEqual({ pode: true });
  });

  it('não constrói issue fechada (já entregue), mesmo chamada por engano', () => {
    expect(podeConstruir(issue('closed', ['etapa: aprovada']))).toEqual({ pode: false, motivo: 'a issue está fechada' });
  });

  it('não constrói issue em outra etapa', () => {
    expect(podeConstruir(issue('open', ['etapa: proposta']))).toEqual({ pode: false, motivo: 'a issue está na etapa "Proposta"' });
    expect(podeConstruir(issue('open', ['etapa: entrega em aprovação']))).toEqual({ pode: false, motivo: 'a issue está na etapa "Entrega em aprovação"' });
    expect(podeConstruir(issue('open', []))).toEqual({ pode: false, motivo: 'a issue não tem etapa' });
  });

  it('entrega parcial ("1 de 3") devolve a proposta à fila sem fechar; a última aprova e fecha', () => {
    expect(entregaParcial('Entrega: app Saúde, aplicar e fechar (1 de 3)\nEntrega #68')).toBe(true);
    expect(entregaParcial('Entrega: Instagram (3 de 3)\nEntrega #64')).toBe(false);
    expect(entregaParcial('Entrega: feriados no Núcleo\nEntrega #67')).toBe(false);
    expect(entregaParcial('Entrega: algo\nTexto citando (1 de 3) no corpo')).toBe(false);
    const etiquetas = ['PR: entrega'];
    expect(mudancas({ tipo: 'pr_merge', texto: 'Entrega: Saúde (1 de 3)\nEntrega #68', etiquetas })).toEqual([{ issue: 68, etapa: 'Pronta para construir' }]);
    expect(mudancas({ tipo: 'pr_merge', texto: 'Entrega: Saúde (3 de 3)\nEntrega #68', etiquetas })).toEqual([{ issue: 68, etapa: 'Aprovada', fechar: true }]);
  });
});
