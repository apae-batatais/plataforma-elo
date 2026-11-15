// Cuidados com os agentes (Arquiteto, Desenvolvedor, ajustes e pedidos "@claude").
//
// 1. Aviso de falha: quando um agente falha, a issue ou o PR recebe um comentário com o link do
//    registro e a etiqueta "pergunta aberta". Assim a falha aparece na caixa da Diretoria em vez
//    de deixar o trabalho parado em silêncio.
// 2. Atualização de PRs em conflito: depois que algo entra na main, os PRs de proposta abertos
//    que ficaram em conflito são entregues ao workflow "Atualizar PR", que une o ramo com a main.
//
// As funções puras têm teste em tests/fluxo/agentes.test.ts.

import { ETIQUETA_ENTREGA, ETIQUETA_ESPECIFICACAO, ETIQUETA_PERGUNTA } from './fluxo-quadro.mjs';

/** Como a Diretoria pede uma nova tentativa, conforme o agente que falhou. */
const COMO_TENTAR_DE_NOVO = {
  arquiteto: 'Para tentar de novo, responda aqui com qualquer texto (por exemplo, "tente de novo").',
  desenvolvedor: 'Para tentar de novo, responda aqui com qualquer texto (por exemplo, "tente de novo").',
  ajuste: 'Para tentar de novo, peça os ajustes outra vez ("Request changes" com os comentários).',
  claude: 'Para tentar de novo, repita o pedido num comentário com "@claude".',
  atualizar: 'Para tentar de novo, comente "@claude atualize este PR com a main".',
};

const NOMES = {
  arquiteto: 'O Arquiteto',
  desenvolvedor: 'O Desenvolvedor',
  ajuste: 'O ajuste pedido',
  claude: 'O pedido ao "@claude"',
  atualizar: 'A atualização deste PR com a main',
};

/**
 * Texto do aviso de falha de um agente.
 * @param {{ agente: keyof typeof NOMES, endereco: string }} p endereco = link do registro da execução
 */
export function mensagemFalha({ agente, endereco }) {
  if (!NOMES[agente]) throw new Error(`agente desconhecido: ${agente}`);
  return [
    `**${NOMES[agente]} falhou e parou sem terminar.** Nada foi perdido do que já estava no GitHub.`,
    '',
    `- Registro da execução: ${endereco}`,
    '- Causas comuns: limite de uso da assinatura do Claude (passa sozinho em algumas horas), chave vencida ou falha momentânea do GitHub. O DevOps lê o registro no próximo raio-x.',
    `- ${COMO_TENTAR_DE_NOVO[agente]}`,
    '',
    `A etiqueta "${ETIQUETA_PERGUNTA}" fica aqui até você responder.`,
  ].join('\n');
}

/**
 * Comenta o aviso de falha na issue ou no PR e põe a etiqueta "pergunta aberta".
 * Usado no último passo dos workflows dos agentes, só quando algo falhou.
 */
export async function avisarFalha({ github, context, core, agente, numero }) {
  const { owner, repo } = context.repo;
  const endereco = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  await github.rest.issues.createComment({ owner, repo, issue_number: Number(numero), body: mensagemFalha({ agente, endereco }) });
  await github.rest.issues.addLabels({ owner, repo, issue_number: Number(numero), labels: [ETIQUETA_PERGUNTA] });
  core.notice(`Aviso de falha publicado em #${numero}`);
}

/**
 * PRs que entram na atualização automática: abertos, do próprio repositório, contra a main,
 * fora de rascunho e de proposta (etiqueta "PR: especificação" ou "PR: entrega").
 * PRs de manutenção ficam de fora: podem estar em uso por uma sessão do DevOps.
 */
export function candidatoAAtualizar(pr, repositorio) {
  const etiquetas = (pr.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  return (
    pr.state === 'open' &&
    !pr.draft &&
    pr.base?.ref === 'main' &&
    pr.head?.repo?.full_name === repositorio &&
    (etiquetas.includes(ETIQUETA_ESPECIFICACAO) || etiquetas.includes(ETIQUETA_ENTREGA))
  );
}

/**
 * Situação do PR em relação à main, como o GitHub informa.
 * "mergeable" vem null enquanto o GitHub ainda calcula; por isso a consulta se repete.
 * @returns {'conflito' | 'ok' | 'desconhecido'}
 */
export function situacaoDoMerge(pr) {
  if (pr.mergeable === false || pr.mergeable_state === 'dirty') return 'conflito';
  if (pr.mergeable === true) return 'ok';
  return 'desconhecido';
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Procura os PRs de proposta em conflito com a main e chama o workflow "Atualizar PR" para cada um.
 * Opções: tentativas (consultas por PR), intervalo (ms entre consultas) e esperar (trocável no teste).
 * @returns {Promise<number[]>} números dos PRs enviados para atualização
 */
export async function atualizarConflitos({ github, context, core, tentativas = 6, intervalo = 10000, esperar = pausa }) {
  const { owner, repo } = context.repo;
  const repositorio = `${owner}/${repo}`;
  const abertos = await github.paginate(github.rest.pulls.list, { owner, repo, state: 'open', base: 'main', per_page: 100 });
  const enviados = [];
  for (const resumo of abertos.filter((pr) => candidatoAAtualizar(pr, repositorio))) {
    let situacao = 'desconhecido';
    for (let i = 0; i < tentativas && situacao === 'desconhecido'; i++) {
      if (i > 0) await esperar(intervalo);
      const { data } = await github.rest.pulls.get({ owner, repo, pull_number: resumo.number });
      situacao = situacaoDoMerge(data);
    }
    if (situacao === 'conflito') {
      await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: 'atualizar-pr.yml', ref: 'main', inputs: { pr: String(resumo.number) } });
      core.info(`PR #${resumo.number} em conflito com a main: atualização chamada`);
      enviados.push(resumo.number);
    } else if (situacao === 'desconhecido') {
      core.warning(`PR #${resumo.number}: o GitHub não informou se há conflito; fica para a próxima conferência`);
    }
  }
  return enviados;
}
