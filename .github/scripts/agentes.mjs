// Cuidados com os agentes (Arquiteto, Desenvolvedor, ajustes e pedidos "@claude").
//
// Falha de agente é assunto técnico: quem resolve é o DevOps, nunca a Diretoria
// (docs/metodologia.md, "Scrum Master e DevOps: quem resolve o quê").
// 1. Marca de falha: quando um agente falha, a issue ou o PR recebe a etiqueta "falha de agente",
//    sem comentário (não chama a Diretoria). O DevOps acha a marca no raio-x, lê o registro e
//    roda de novo ou corrige; ao resolver, tira a etiqueta.
// 2. Atualização de PRs em conflito: depois que algo entra na main, os PRs de proposta abertos
//    que ficaram em conflito são entregues ao workflow "Atualizar PR", que une o ramo com a main.
//
// As funções puras têm teste em tests/fluxo/agentes.test.ts.

import { ETIQUETA_ENTREGA, ETIQUETA_ESPECIFICACAO } from './fluxo-quadro.mjs';

export const ETIQUETA_FALHA = 'falha de agente';

/**
 * Marca a issue ou o PR com "falha de agente". Usado no último passo dos workflows dos agentes,
 * só quando algo falhou. Não comenta: o e-mail do GitHub iria para a Diretoria.
 */
export async function marcarFalha({ github, context, core, agente, numero }) {
  const { owner, repo } = context.repo;
  await github.rest.issues.addLabels({ owner, repo, issue_number: Number(numero), labels: [ETIQUETA_FALHA] });
  core.notice(`${agente}: falha marcada em #${numero} para o DevOps`);
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

/**
 * Por que o GitHub recusou o merge. A mensagem do erro ("Pull Request has merge conflicts") vale
 * como conflito mesmo quando a consulta ao PR ainda não tem "mergeable" calculado (vem null logo
 * depois de outro merge).
 * @returns {'conflito' | 'outro'}
 */
export function motivoDoMergeRecusado(erro, pr) {
  if (/conflict/i.test(String(erro?.message ?? erro ?? ''))) return 'conflito';
  return situacaoDoMerge(pr) === 'conflito' ? 'conflito' : 'outro';
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
