// Fluxo de trabalho do Elo (docs/metodologia.md).
//
// A etapa de cada proposta (issue) fica numa etiqueta "etapa: …". Esta automação
// troca a etiqueta conforme os eventos do GitHub e, se o quadro estiver
// configurado, copia a etapa para a coluna "Status" do quadro (GitHub Projects).
//
// As funções de cima são puras e têm teste (tests/fluxo/fluxo-quadro.test.ts).

export const ETAPAS = [
  'Proposta',
  'Especificação em aprovação',
  'Pronta para construir',
  'Em construção',
  'Entrega em aprovação',
  'Aprovada',
  'Publicada',
];

export const PREFIXO = 'etapa: ';

/** Etiqueta de uma etapa: "Pronta para construir" → "etapa: pronta para construir". */
export function etiquetaDe(etapa) {
  return PREFIXO + etapa.toLowerCase();
}

/** Etapa de uma etiqueta, ou null se não for etiqueta de etapa. */
export function etapaDaEtiqueta(etiqueta) {
  if (!etiqueta.toLowerCase().startsWith(PREFIXO)) return null;
  const nome = etiqueta.slice(PREFIXO.length).toLowerCase();
  return ETAPAS.find((e) => e.toLowerCase() === nome) ?? null;
}

/**
 * Issues citadas no texto de um PR.
 * "Especifica #12" → PR de especificação; "Entrega #12" → PR de construção.
 * Só vale no começo de uma linha: citação no meio do texto não conta (PR #83).
 */
export function referencias(texto) {
  const r = { especifica: [], entrega: [] };
  for (const m of (texto ?? '').matchAll(/^[ \t]*(especifica|entrega)\s+#(\d+)/gim)) {
    const lista = m[1].toLowerCase() === 'especifica' ? r.especifica : r.entrega;
    const n = Number(m[2]);
    if (!lista.includes(n)) lista.push(n);
  }
  return r;
}

/**
 * Mudanças de etapa para um evento.
 * evento: { tipo, numero?, etiquetas?, texto?, rascunho? }
 *  - issue_aberta: issue nova entra em "Proposta" (pendências da Diretoria ficam de fora)
 *  - pr_aberto: PR aberto, reaberto, editado ou pronto para revisão
 *  - pr_merge / pr_fechado: PR fechado com ou sem merge
 * Devolve [{ issue, etapa, fechar? }].
 */
/**
 * O Desenvolvedor só constrói issue aberta, em "Pronta para construir" ou "Em construção".
 * Evita reconstruir proposta já entregue quando é chamado por engano.
 */
export function podeConstruir(issue) {
  if (issue.state !== 'open') return { pode: false, motivo: 'a issue está fechada' };
  const etapa = (issue.labels ?? []).map((l) => etapaDaEtiqueta(typeof l === 'string' ? l : l.name)).find(Boolean);
  if (!etapa) return { pode: false, motivo: 'a issue não tem etapa' };
  if (etapa === 'Pronta para construir' || etapa === 'Em construção') return { pode: true };
  return { pode: false, motivo: `a issue está na etapa "${etapa}"` };
}

export function mudancas(evento) {
  if (evento.tipo === 'issue_aberta') {
    const etiquetas = (evento.etiquetas ?? []).map((e) => e.toLowerCase());
    if (etiquetas.some((e) => e.startsWith(PREFIXO)) || etiquetas.includes('pendência da diretoria')) return [];
    return [{ issue: evento.numero, etapa: 'Proposta' }];
  }
  const ref = referencias(evento.texto);
  const saida = [];
  for (const issue of ref.especifica) {
    if (evento.tipo === 'pr_aberto') saida.push({ issue, etapa: 'Especificação em aprovação' });
    if (evento.tipo === 'pr_merge') saida.push({ issue, etapa: 'Pronta para construir' });
    if (evento.tipo === 'pr_fechado') saida.push({ issue, etapa: 'Proposta' });
  }
  for (const issue of ref.entrega) {
    if (evento.tipo === 'pr_aberto') saida.push({ issue, etapa: evento.rascunho ? 'Em construção' : 'Entrega em aprovação' });
    if (evento.tipo === 'pr_merge') saida.push({ issue, etapa: 'Aprovada', fechar: true });
    if (evento.tipo === 'pr_fechado') saida.push({ issue, etapa: 'Pronta para construir' });
  }
  return saida;
}

/** Publicação oficial com sucesso: pedida à mão ou agendada, sempre no ramo main. */
export function ehPublicacaoOficial(run) {
  return run.conclusion === 'success' && ['workflow_dispatch', 'schedule'].includes(run.event) && run.head_branch === 'main';
}

/** Etiquetas a tirar e a pôr para deixar a issue só na etapa nova. */
export function trocaDeEtiquetas(atuais, etapa) {
  const nova = etiquetaDe(etapa);
  const remover = atuais.filter((e) => etapaDaEtiqueta(e) !== null && e.toLowerCase() !== nova);
  const adicionar = atuais.some((e) => e.toLowerCase() === nova) ? null : nova;
  return { remover, adicionar };
}

// ---------------------------------------------------------------------------
// Execução no GitHub Actions (actions/github-script).

async function graphql(token, query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const corpo = await r.json();
  if (!r.ok || corpo.errors) throw new Error(`Quadro: ${JSON.stringify(corpo.errors ?? corpo)}`);
  return corpo.data;
}

async function lerQuadro(token, org, numero) {
  const d = await graphql(
    token,
    `query($org:String!,$num:Int!){organization(login:$org){projectV2(number:$num){id field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}`,
    { org, num: numero },
  );
  const p = d.organization?.projectV2;
  if (!p?.field) throw new Error('Quadro: projeto ou campo "Status" não encontrado.');
  return { id: p.id, campo: p.field.id, opcoes: p.field.options };
}

async function moverNoQuadro(token, quadro, issueNodeId, etapa, core) {
  const opcao = quadro.opcoes.find((o) => o.name.trim().toLowerCase() === etapa.toLowerCase());
  if (!opcao) {
    core.warning(`Quadro: a coluna "${etapa}" não existe no campo Status.`);
    return;
  }
  const d = await graphql(
    token,
    `query($id:ID!){node(id:$id){... on Issue{projectItems(first:50){nodes{id project{id}}}}}}`,
    { id: issueNodeId },
  );
  let item = d.node?.projectItems?.nodes?.find((n) => n.project.id === quadro.id)?.id;
  if (!item) {
    const a = await graphql(
      token,
      `mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}`,
      { p: quadro.id, c: issueNodeId },
    );
    item = a.addProjectV2ItemById.item.id;
  }
  await graphql(
    token,
    `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}`,
    { p: quadro.id, i: item, f: quadro.campo, o: opcao.id },
  );
}

/**
 * Lê o evento, troca as etiquetas e, se houver quadro configurado, move os cartões.
 * @param {{ github: any, context: any, core: any, tokenQuadro?: string, numeroQuadro?: string }} opcoes
 */
export async function executar({ github, context, core, tokenQuadro, numeroQuadro }) {
  const { owner, repo } = context.repo;
  const p = context.payload;
  const nome = context.eventName;
  let lista = [];
  const sincronizar = []; // issues cuja etapa atual deve ir para o quadro

  if (nome === 'issues' && p.action === 'opened') {
    const etiquetas = p.issue.labels.map((l) => l.name);
    lista = mudancas({ tipo: 'issue_aberta', numero: p.issue.number, etiquetas });
    if (etiquetas.some((e) => etapaDaEtiqueta(e))) sincronizar.push(p.issue.number);
  } else if (nome === 'issues' && (p.action === 'labeled' || p.action === 'unlabeled')) {
    if (etapaDaEtiqueta(p.label?.name ?? '')) sincronizar.push(p.issue.number);
  } else if (nome === 'pull_request') {
    const texto = `${p.pull_request.title}\n${p.pull_request.body ?? ''}`;
    if (p.action === 'closed') {
      lista = mudancas({ tipo: p.pull_request.merged ? 'pr_merge' : 'pr_fechado', texto });
    } else if (p.pull_request.state === 'open') {
      lista = mudancas({ tipo: 'pr_aberto', texto, rascunho: p.pull_request.draft });
    }
  } else if (nome === 'workflow_run') {
    const run = p.workflow_run;
    if (ehPublicacaoOficial(run)) {
      const aprovadas = await github.paginate(github.rest.issues.listForRepo, {
        owner, repo, state: 'all', labels: etiquetaDe('Aprovada'), per_page: 100,
      });
      lista = aprovadas.filter((i) => !i.pull_request).map((i) => ({ issue: i.number, etapa: 'Publicada' }));
    }
  } else if (nome === 'workflow_dispatch') {
    const todas = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'all', per_page: 100 });
    for (const i of todas) if (!i.pull_request && i.labels.some((l) => etapaDaEtiqueta(l.name))) sincronizar.push(i.number);
  }

  await aplicar({ github, context, core, tokenQuadro, numeroQuadro, lista, sincronizar });
}

/**
 * Põe cada issue da lista na etapa indicada (etiqueta, e fecha se pedido) e copia para o quadro.
 * Usada pelos workflows que agem com o GITHUB_TOKEN, cujas ações não disparam o Fluxo.
 * @param {{ github: any, context: any, core: any, tokenQuadro?: string, numeroQuadro?: string,
 *   lista: { issue: number, etapa: string, fechar?: boolean }[], sincronizar?: number[] }} opcoes
 */
export async function aplicar({ github, context, core, tokenQuadro, numeroQuadro, lista, sincronizar = [] }) {
  const { owner, repo } = context.repo;
  for (const m of lista) {
    const { data: issue } = await github.rest.issues.get({ owner, repo, issue_number: m.issue });
    if (issue.pull_request) continue;
    const troca = trocaDeEtiquetas(issue.labels.map((l) => l.name), m.etapa);
    for (const e of troca.remover) await github.rest.issues.removeLabel({ owner, repo, issue_number: m.issue, name: e });
    if (troca.adicionar) await github.rest.issues.addLabels({ owner, repo, issue_number: m.issue, labels: [troca.adicionar] });
    if (m.fechar && issue.state === 'open') {
      await github.rest.issues.update({ owner, repo, issue_number: m.issue, state: 'closed', state_reason: 'completed' });
    }
    core.info(`#${m.issue} → ${m.etapa}`);
    sincronizar.push(m.issue);
  }

  if (!sincronizar.length) return;
  if (!tokenQuadro || !numeroQuadro) {
    core.notice('Quadro não configurado (QUADRO_TOKEN e QUADRO_NUMERO): só as etiquetas foram atualizadas.');
    return;
  }
  const quadro = await lerQuadro(tokenQuadro, owner, Number(numeroQuadro));
  for (const n of [...new Set(sincronizar)]) {
    const { data: issue } = await github.rest.issues.get({ owner, repo, issue_number: n });
    const etapa = issue.labels.map((l) => etapaDaEtiqueta(l.name)).find(Boolean);
    if (etapa) await moverNoQuadro(tokenQuadro, quadro, issue.node_id, etapa, core);
  }
}
