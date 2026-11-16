// Fila de construção (ADR-031): no máximo 2 entregas em construção ao mesmo tempo, na ordem do
// quadro "Elo", e pausa quando a cota de minutos do GitHub Actions passa de 85%.
//
// - Ocupa vaga a issue em "Em construção" sem "pergunta aberta" (quem espera a Diretoria não gasta
//   minutos). As que esperam em "Pronta para construir" são chamadas quando abre vaga.
// - Pausa: uma issue aberta com a etiqueta "cota: pausa" (aberta pelo DevOps ao passar de 85%).
//   Enquanto ela existir, nenhuma entrega nova começa; as que estão em construção terminam.
// - Ordem: a do quadro (posição dos cartões). Sem chave do quadro, ou se a leitura falhar, vale a
//   issue mais antiga (menor número).
//
// As funções puras têm teste em tests/fluxo/fila.test.ts.

import { aplicar, etapaDaEtiqueta, temPerguntaAberta } from './fluxo-quadro.mjs';

export const LIMITE_EM_CONSTRUCAO = 2;
export const ETIQUETA_PAUSA = 'cota: pausa';

const nomes = (issue) => (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
const etapa = (issue) => nomes(issue).map(etapaDaEtiqueta).find(Boolean) ?? null;

/** A issue ocupa uma vaga de construção (está em construção e não espera resposta da Diretoria). */
export function ocupaVaga(issue) {
  return issue.state !== 'closed' && etapa(issue) === 'Em construção' && !temPerguntaAberta(nomes(issue));
}

/**
 * Quais issues prontas chamar agora.
 * @param {{ abertas: any[], ordem?: number[], pausa?: boolean, limite?: number }} p
 *   abertas: issues abertas (com etiquetas); ordem: números das issues na ordem do quadro.
 * @returns {{ chamar: number[], motivo: string }}
 */
export function escolherProximas({ abertas, ordem = [], pausa = false, limite = LIMITE_EM_CONSTRUCAO }) {
  const prontas = abertas.filter((i) => i.state !== 'closed' && etapa(i) === 'Pronta para construir');
  if (!prontas.length) return { chamar: [], motivo: 'nenhuma proposta pronta para construir' };
  if (pausa) return { chamar: [], motivo: `pausa por cota (etiqueta "${ETIQUETA_PAUSA}")` };
  const vagas = limite - abertas.filter(ocupaVaga).length;
  if (vagas <= 0) return { chamar: [], motivo: `já há ${limite} entregas em construção` };
  const posicao = (n) => {
    const i = ordem.indexOf(n);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const fila = [...prontas].sort((a, b) => posicao(a.number) - posicao(b.number) || a.number - b.number);
  return { chamar: fila.slice(0, vagas).map((i) => i.number), motivo: `${vagas} vaga(s)` };
}

/** Números das issues na ordem dos cartões do quadro (posição). Lança erro se não conseguir ler. */
async function ordemDoQuadro(token, org, numero) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($org:String!,$num:Int!){organization(login:$org){projectV2(number:$num){items(first:100,orderBy:{field:POSITION,direction:ASC}){nodes{content{... on Issue{number}}}}}}}`,
      variables: { org, num: numero },
    }),
  });
  const corpo = await r.json();
  if (!r.ok || corpo.errors) throw new Error(JSON.stringify(corpo.errors ?? corpo));
  return (corpo.data.organization?.projectV2?.items?.nodes ?? []).map((n) => n.content?.number).filter(Boolean);
}

/**
 * Chama o Desenvolvedor das próximas propostas da fila, se houver vaga e não houver pausa.
 * Põe cada uma em "Em construção" antes de chamar, para a próxima conferência já contar a vaga.
 * @param {{ github: any, context: any, core: any, tokenQuadro?: string, numeroQuadro?: string }} opcoes
 * @returns {Promise<number[]>} issues chamadas
 */
export async function chamarProximas({ github, context, core, tokenQuadro, numeroQuadro }) {
  const { owner, repo } = context.repo;
  const abertas = (await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', per_page: 100 })).filter(
    (i) => !i.pull_request,
  );
  const pausa = abertas.some((i) => nomes(i).includes(ETIQUETA_PAUSA));
  let ordem = [];
  if (tokenQuadro && numeroQuadro) {
    try {
      ordem = await ordemDoQuadro(tokenQuadro, owner, Number(numeroQuadro));
      core.info('Ordem: a do quadro');
    } catch (e) {
      core.warning(`Não consegui ler a ordem do quadro (${e.message}); vale a proposta mais antiga.`);
    }
  } else {
    core.info('Quadro não configurado: vale a proposta mais antiga.');
  }
  const { chamar, motivo } = escolherProximas({ abertas, ordem, pausa });
  core.info(`Fila: ${motivo}${chamar.length ? `; chamando #${chamar.join(', #')}` : ''}`);
  for (const n of chamar) {
    await aplicar({ github, context, core, tokenQuadro, numeroQuadro, lista: [{ issue: n, etapa: 'Em construção' }] });
    await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: 'claude-desenvolvedor.yml', ref: 'main', inputs: { issue: String(n) } });
  }
  return chamar;
}

