/**
 * Agenda única (ADR-024): junta os itens que cada app devolve, ordena e separa em vencidos, dia e mês.
 * Nada é guardado; cada app já filtrou pelo que a pessoa pode ver.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { hojeEmBrasilia, type ItemDaAgenda } from '@/nucleo/modulos/agenda-busca';
import { FONTES } from './fontes-agenda-busca';
import { MODULOS } from './registro-modulos';

export const nomeDoApp = (id: string) => MODULOS.find((m) => m.id === id)?.nome ?? id;
const ordemDoApp = (id: string) => {
  const i = FONTES.findIndex((f) => f.id === id);
  return i < 0 ? FONTES.length : i;
};

export interface AgendaLida {
  hoje: string;
  itens: ItemDaAgenda[];
  /** Nomes dos apps que não puderam ser lidos. */
  falhas: string[];
}

/** Lê os itens de todos os apps ativos. `desligados` simula app não ativo. Falha de um app não derruba os outros. */
export async function lerAgenda(
  p: Planilhas,
  quem: Autorizador,
  opcoes: { agora?: Date; desligados?: ReadonlySet<string> } = {},
): Promise<AgendaLida> {
  const agora = opcoes.agora ?? new Date();
  const fontes = FONTES.filter((f) => f.agenda && !opcoes.desligados?.has(f.id) && MODULOS.some((m) => m.id === f.id));
  const lidas = await Promise.allSettled(fontes.map((f) => f.agenda!(p, quem, { agora })));
  const itens: ItemDaAgenda[] = [];
  const falhas: string[] = [];
  lidas.forEach((r, i) => (r.status === 'fulfilled' ? itens.push(...r.value) : falhas.push(nomeDoApp(fontes[i].id))));
  return { hoje: hojeEmBrasilia(agora), itens, falhas };
}

export interface FiltrosAgenda {
  /** Mês mostrado (AAAA-MM). */
  mes: string;
  app?: string;
  servico?: string;
  /** Dia aberto na grade (AAAA-MM-DD). */
  dia?: string;
}

export interface AgendaMontada {
  /** Apps que têm algum item para a pessoa (os que aparecem no filtro). */
  apps: { id: string; nome: string }[];
  /** Serviços que aparecem para a pessoa (o seletor de serviço). */
  servicos: string[];
  vencidos: ItemDaAgenda[];
  /** Itens com dia (ou período) no mês, sem os vencidos, na ordem da lista. */
  doMes: ItemDaAgenda[];
  /** Itens que só têm o mês ("Neste mês"). */
  soMes: ItemDaAgenda[];
  /** Todos os itens datados do mês (a grade mostra também os vencidos). */
  naGrade: ItemDaAgenda[];
  /** Itens de cada dia do mês (período aparece em cada dia). */
  porDia: Map<string, ItemDaAgenda[]>;
  semItensNoMes: boolean;
  /** Há item, mas o filtro escondeu todos. */
  filtroEsvaziou: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const mesValido = (m: string | undefined): m is string => !!m && MES.test(m);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
export const diaValido = (d: string | undefined): d is string => !!d && DIA.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function diasDoMes(mes: string): string[] {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

const dataDe = (i: ItemDaAgenda) => i.data ?? `${i.mes}-01`;
const comparar = (a: ItemDaAgenda, b: ItemDaAgenda) =>
  dataDe(a).localeCompare(dataDe(b)) || ordemDoApp(a.app) - ordemDoApp(b.app) || a.titulo.localeCompare(b.titulo, 'pt-BR');

export const ehVencido = (i: ItemDaAgenda, hoje: string) => i.vencivel && i.data !== null && i.data < hoje;

/** Aplica os filtros (app e serviço combinam; item sem serviço só com "todos os serviços") e separa a agenda. */
export function montarAgenda(itens: readonly ItemDaAgenda[], f: FiltrosAgenda, hoje: string): AgendaMontada {
  const apps = [...new Set(itens.map((i) => i.app))].sort((a, b) => ordemDoApp(a) - ordemDoApp(b)).map((id) => ({ id, nome: nomeDoApp(id) }));
  const servicos = [...new Set(itens.map((i) => i.servico).filter((s): s is string => !!s))].sort();
  const filtrados = itens.filter((i) => (!f.app || i.app === f.app) && (!f.servico || i.servico === f.servico)).sort(comparar);
  const primeiro = `${f.mes}-01`;
  const dias = diasDoMes(f.mes);
  const ultimo = dias[dias.length - 1];
  const noMes = (i: ItemDaAgenda) => i.data !== null && i.data <= ultimo && (i.ate ?? i.data) >= primeiro;
  const naGrade = filtrados.filter(noMes);
  const vencidos = filtrados.filter((i) => ehVencido(i, hoje));
  const porDia = new Map<string, ItemDaAgenda[]>(dias.map((d) => [d, []]));
  for (const i of naGrade) for (const d of dias) if (d >= i.data! && d <= (i.ate ?? i.data!)) porDia.get(d)!.push(i);
  const doMes = naGrade.filter((i) => !ehVencido(i, hoje));
  const soMes = filtrados.filter((i) => i.data === null && i.mes === f.mes);
  const semItensNoMes = doMes.length + soMes.length + vencidos.length === 0;
  return { apps, servicos, vencidos, doMes, soMes, naGrade, porDia, semItensNoMes, filtroEsvaziou: semItensNoMes && itens.length > 0 && (!!f.app || !!f.servico) && filtradosSemFiltro(itens, f.mes, hoje) };
}

/** Sem filtro, o mês teria algo? (distingue "Nada com este filtro" de "Nada vence neste mês"). */
function filtradosSemFiltro(itens: readonly ItemDaAgenda[], mes: string, hoje: string): boolean {
  const dias = diasDoMes(mes);
  return itens.some(
    (i) => ehVencido(i, hoje) || (i.data !== null ? i.data <= dias[dias.length - 1] && (i.ate ?? i.data) >= `${mes}-01` : i.mes === mes),
  );
}
