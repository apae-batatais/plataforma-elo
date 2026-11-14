/** Agenda única e busca única (ADR-024): o que a pessoa já vê em Projetos, nada além. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { contem, MAX_RESULTADOS_POR_APP, type ItemDaAgenda, type ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import { Projetos } from '../dados/tabelas';
import { ETAPAS_ENCERRADAS, NOME_ETAPA } from '../dominio/projeto';
import { lerConfig, podeVerProjeto } from './comum';

async function projetosVisiveis(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) return [];
  const [[projetos], config] = await Promise.all([lerTabelas(p, [Projetos] as const), lerConfig(p)]);
  return projetos.ativos().filter((r) => podeVerProjeto(quem, r, config));
}

/** Início e fim previstos dos projetos abertos. */
export async function itensDaAgenda(p: Planilhas, quem: Autorizador): Promise<ItemDaAgenda[]> {
  const itens: ItemDaAgenda[] = [];
  for (const r of (await projetosVisiveis(p, quem)).filter((x) => !ETAPAS_ENCERRADAS.has(x.etapa))) {
    const base = { app: 'projetos', ate: null, mes: null, servico: r.servico ?? null, href: `/projetos/${r.id}` };
    if (r.inicio_previsto) itens.push({ ...base, tipo: 'Início previsto', titulo: `Início previsto: ${r.titulo}`, data: r.inicio_previsto, vencivel: false });
    if (r.fim_previsto) itens.push({ ...base, tipo: 'Fim previsto', titulo: `Fim previsto: ${r.titulo}`, data: r.fim_previsto, vencivel: true });
  }
  return itens;
}

/** Projetos por código ou título. */
export async function buscar(p: Planilhas, quem: Autorizador, termo: string): Promise<ResultadoDaBusca[]> {
  return (await projetosVisiveis(p, quem))
    .filter((r) => contem(r.codigo, termo) || contem(r.titulo, termo))
    .slice(0, MAX_RESULTADOS_POR_APP)
    .map((r) => ({ app: 'projetos', tipo: 'Projeto', titulo: r.titulo, apoio: `${r.codigo} · ${NOME_ETAPA[r.etapa]}`, href: `/projetos/${r.id}` }));
}
