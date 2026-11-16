// Consumo de minutos do GitHub Actions no mês (ADR-031).
//
// O DevOps não vê a página de cobrança; estima o gasto pelas execuções registradas: cada execução
// que rodou (não pulada) conta, no mínimo, 1 minuto, arredondando para cima. É uma aproximação: o
// GitHub cobra por job e pode diferir um pouco do número oficial.
//
// Uso no raio-x: node .github/scripts/consumo.mjs execucoes.json [AAAA-MM-01]
// (execucoes.json = lista de execuções da API do GitHub, um objeto { workflow_runs } ou uma lista).
// Funções puras com teste em tests/fluxo/consumo.test.ts.

export const COTA_MENSAL = 2000;

/** Minutos estimados das execuções criadas a partir de `desde` (ISO), por automação e no total. */
export function minutosEstimados(execucoes, desde) {
  const porAutomacao = {};
  let total = 0;
  for (const r of execucoes) {
    if (desde && r.created_at < desde) continue;
    if (!r.conclusion || r.conclusion === 'skipped') continue;
    const inicio = Date.parse(r.run_started_at ?? r.created_at);
    const fim = Date.parse(r.updated_at);
    const minutos = Math.max(1, Math.ceil((fim - inicio) / 60000));
    porAutomacao[r.name] = (porAutomacao[r.name] ?? 0) + minutos;
    total += minutos;
  }
  return { total, porAutomacao };
}

/**
 * Faixa do mês: até 70% segue normal; acima de 70%, aviso ao Scrum Master; acima de 85%, pausa
 * (nenhuma entrega nova começa sem o "pode seguir" da Diretoria).
 * @returns {'normal' | 'aviso' | 'pausa'}
 */
export function faixaDoMes(minutos, cota = COTA_MENSAL) {
  const p = minutos / cota;
  if (p > 0.85) return 'pausa';
  if (p > 0.7) return 'aviso';
  return 'normal';
}

/** Quantas entregas ainda cabem até a pausa (85%), dado o custo médio de uma entrega. */
export function entregasQueCabem(minutos, custoPorEntrega, cota = COTA_MENSAL) {
  if (!(custoPorEntrega > 0)) return 0;
  return Math.max(0, Math.floor((cota * 0.85 - minutos) / custoPorEntrega));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const dados = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const lista = Array.isArray(dados) ? dados : dados.workflow_runs;
  const desde = process.argv[3] ?? `${new Date().toISOString().slice(0, 7)}-01`;
  const { total, porAutomacao } = minutosEstimados(lista, desde);
  console.log(JSON.stringify({ desde, total, faixa: faixaDoMes(total), porAutomacao }, null, 2));
}
