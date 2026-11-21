/**
 * Indicadores do marco lógico com número do cadastro (ligações, onda 2, entrega L4; regras L1 a L6 e L12).
 *
 * - Nada é guardado a cada leitura: a tela calcula na hora; `IndicadoresMedidos` guarda só a fotografia (L12).
 * - O mínimo de 5 pessoas é aplicado na origem; aqui só se repassa `valor`, `base` e `motivo` (L2 e L4).
 * - A Avaliação não é importada: a plataforma entrega a leitura (`NumerosDePessoas`), como em Parcerias (ADR-023).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import type { NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { vinculosAtivosProtegido } from '@/nucleo/pessoas/contagem';
import { IndicadoresMedidos, MarcoLogico, type RegMarco, type RegMedicao } from '../dados/tabelas';
import { NIVEIS_MARCO } from '../dominio/fases';
import {
  ehFonteAutomatica,
  FONTES_NUMERO,
  situacaoDaMeta,
  type FonteNumero,
  type MotivoMedicao,
  type OrigemMedicao,
  type SituacaoDaMeta,
} from '../dominio/indicadores';
import { ETAPAS_ENCERRADAS, ErroProjetos } from '../dominio/projeto';
import { auditar, autoriaDe, registrarHistorico, type Opcoes } from './comum';
import { podeGerenciar, projetoVisivel } from './fases';

/**
 * Leitura de números de pessoas declarada aqui e entregue pela plataforma (Projetos não importa a Avaliação).
 * Devolve `null` quando o app de origem está desligado.
 */
export interface NumerosDePessoas {
  indicadoresDoServico(servico: string): Promise<{ indiceMedio: NumeroAgregado; reavaliacaoEmDia: NumeroAgregado } | null>;
}

/** "Hoje" de um item automático: só `valor`, `base` e `motivo` atravessam (L4). */
export type HojeDoItem =
  | { estado: 'ok'; valor: number | null; base: number; motivo: 'poucos_casos' | 'sem_dados' | null; situacao: SituacaoDaMeta | null }
  | { estado: 'sem_servico' | 'indisponivel' };

export interface IndicadorDoItem {
  itemId: string;
  versao: number;
  nivel: RegMarco['nivel'];
  descricao: string;
  indicador: string | null;
  fonte: FonteNumero;
  servicoId: string | null;
  servicoNome: string | null;
  meta: number | null;
  /** `null` para item digitado à mão: não há número calculado. */
  hoje: HojeDoItem | null;
}

export interface MedicaoRegistrada {
  id: string;
  itemId: string;
  data: string;
  valor: number | null;
  base: number;
  motivo: MotivoMedicao | null;
  origem: OrigemMedicao;
  registradoPor: string;
}

export interface IndicadoresDoProjeto {
  projetoId: string;
  data: string;
  podeAlterar: boolean;
  /** Projeto cancelado ou parado: lê, mas não registra. */
  podeRegistrar: boolean;
  itens: IndicadorDoItem[];
  medicoes: MedicaoRegistrada[];
}

/** Dia de Brasília (UTC−3), como no resto da plataforma. */
const diaDe = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Lê o número de um item automático. Falha de leitura vira "indisponível" (L5); nunca derruba a tela. */
async function lerHoje(
  p: Planilhas,
  item: Pick<RegMarco, 'fonte_numero' | 'servico_id' | 'meta'>,
  leitor: NumerosDePessoas | undefined,
  dia: string,
  cache: Map<string, Awaited<ReturnType<NumerosDePessoas['indicadoresDoServico']>>>,
): Promise<HojeDoItem> {
  if (!item.servico_id) return { estado: 'sem_servico' };
  let numero: NumeroAgregado;
  if (item.fonte_numero === 'vinculos_ativos') numero = await vinculosAtivosProtegido(p, item.servico_id, dia);
  else {
    if (!cache.has(item.servico_id)) cache.set(item.servico_id, leitor ? await leitor.indicadoresDoServico(item.servico_id).catch(() => null) : null);
    const ind = cache.get(item.servico_id);
    if (!ind) return { estado: 'indisponivel' };
    numero = item.fonte_numero === 'indice_cuidado' ? ind.indiceMedio : ind.reavaliacaoEmDia;
  }
  return { estado: 'ok', valor: numero.valor, base: numero.base, motivo: numero.motivo, situacao: situacaoDaMeta(numero.valor, item.meta) };
}

const paraMedicao = (m: RegMedicao): MedicaoRegistrada => ({
  id: m.id,
  itemId: m.item_id,
  data: m.data,
  valor: m.valor,
  base: m.base,
  motivo: m.motivo,
  origem: m.origem,
  registradoPor: m.registrado_por,
});

/**
 * Indicadores do projeto: cada item do marco lógico que tem indicador, com meta, "hoje" e situação, mais o
 * histórico de fotografias. Quem vê o projeto vê os números (são agregados, sem nomes).
 */
export async function lerIndicadores(p: Planilhas, quem: Autorizador, projetoId: string, leitor?: NumerosDePessoas, opcoes: Opcoes = {}): Promise<IndicadoresDoProjeto> {
  const agora = opcoes.agora ?? new Date();
  const dia = diaDe(agora);
  const r = await projetoVisivel(p, quem, projetoId);
  const [marco, medidas] = await lerTabelas(p, [MarcoLogico, IndicadoresMedidos] as const);
  const doProjeto = marco
    .ativos()
    .filter((m) => m.projeto_id === projetoId && (m.indicador || ehFonteAutomatica(m.fonte_numero)))
    .sort((a, b) => NIVEIS_MARCO.indexOf(a.nivel) - NIVEIS_MARCO.indexOf(b.nivel) || a.ordem - b.ordem);
  const cache = new Map<string, Awaited<ReturnType<NumerosDePessoas['indicadoresDoServico']>>>();
  const itens: IndicadorDoItem[] = [];
  for (const m of doProjeto) {
    itens.push({
      itemId: m.id,
      versao: m.versao,
      nivel: m.nivel,
      descricao: m.descricao,
      indicador: m.indicador,
      fonte: m.fonte_numero,
      servicoId: m.servico_id,
      servicoNome: m.servico_nome,
      meta: m.meta,
      hoje: ehFonteAutomatica(m.fonte_numero) ? await lerHoje(p, m, leitor, dia, cache) : null,
    });
  }
  const ids = new Set(doProjeto.map((m) => m.id));
  const medicoes = medidas
    .ativos()
    .filter((x) => x.projeto_id === projetoId && ids.has(x.item_id))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em))
    .map(paraMedicao);
  const gerencia = podeGerenciar(quem, r);
  return { projetoId, data: dia, podeAlterar: gerencia && !ETAPAS_ENCERRADAS.has(r.etapa), podeRegistrar: gerencia && !ETAPAS_ENCERRADAS.has(r.etapa) && r.etapa !== 'parado', itens, medicoes };
}

/**
 * Regras L1 e L5: escolhe de onde vem o número do item e para qual serviço. Fonte automática exige serviço
 * ativo do Núcleo; "digitado à mão" limpa o serviço. Só quem gerencia o projeto altera, em qualquer fase
 * enquanto o projeto não estiver cancelado.
 */
export async function definirFonteDoItem(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  itemId: string,
  versao: number,
  escolha: { fonte: FonteNumero; servico?: string | null; meta?: number | null },
  opcoes: Opcoes = {},
): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera de onde vem o número.');
  if (ETAPAS_ENCERRADAS.has(r.etapa)) throw new ErroProjetos('Projeto cancelado: o marco lógico fica só para leitura.');
  if (!FONTES_NUMERO.includes(escolha.fonte)) throw new ErroProjetos('Escolha uma das fontes oferecidas.');
  const meta = escolha.meta ?? null;
  if (meta !== null && (!Number.isFinite(meta) || meta < 0)) throw new ErroProjetos('A meta é um número a partir de zero. ex.: 80');
  const [marco, servicos] = await lerTabelas(p, [MarcoLogico, Servicos] as const);
  const item = marco.ativos().find((m) => m.id === itemId && m.projeto_id === projetoId);
  if (!item) throw new ErroProjetos('Item não encontrado.');
  let servicoId: string | null = null;
  let servicoNome: string | null = null;
  if (ehFonteAutomatica(escolha.fonte)) {
    if (!item.indicador) throw new ErroProjetos('Escreva o indicador do item antes de ligar um número do cadastro.');
    const codigo = escolha.servico?.trim();
    if (!codigo) throw new ErroProjetos('Escolha o serviço para calcular o número.');
    const s = servicos.todos().find((x) => x.codigo === codigo && x.ativo);
    if (!s) throw new ErroProjetos('Escolha um serviço que existe no cadastro.');
    servicoId = s.codigo;
    servicoNome = s.nome;
  }
  const { colunasAlteradas } = await atualizar(
    p,
    MarcoLogico,
    itemId,
    versao,
    { fonte_numero: escolha.fonte, servico_id: servicoId, servico_nome: servicoNome, meta },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'alteracao', 'MarcoLogico', itemId, colunasAlteradas, agora);
  await registrarHistorico(p, quem, projetoId, 'Fonte do número de um indicador alterada', null, agora);
}

/**
 * Regra L12: grava uma linha em `IndicadoresMedidos` por item automático. Linha nunca é editada.
 * Reaproveitada pelo relatório de monitoramento e pelo encerramento (origens `relatorio` e `encerramento`),
 * que chegam com as entregas P4 e P5. Devolve quantas linhas gravou.
 */
export async function fotografarIndicadores(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  origem: OrigemMedicao,
  leitor?: NumerosDePessoas,
  opcoes: Opcoes = {},
): Promise<number> {
  const agora = opcoes.agora ?? new Date();
  const dia = diaDe(agora);
  const r = await projetoVisivel(p, quem, projetoId);
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto registra a medição.');
  if (ETAPAS_ENCERRADAS.has(r.etapa) || r.etapa === 'parado') throw new ErroProjetos('Projeto parado ou cancelado: não há medição a registrar.');
  const [marco] = await lerTabelas(p, [MarcoLogico] as const);
  const automaticos = marco.ativos().filter((m) => m.projeto_id === projetoId && ehFonteAutomatica(m.fonte_numero));
  if (automaticos.length === 0) throw new ErroProjetos('Nenhum item usa número do cadastro. Escolha “De onde vem o número” em um indicador.');
  const cache = new Map<string, Awaited<ReturnType<NumerosDePessoas['indicadoresDoServico']>>>();
  for (const m of automaticos) {
    const hoje = await lerHoje(p, m, leitor, dia, cache);
    const campos = {
      projeto_id: projetoId,
      item_id: m.id,
      data: dia,
      valor: hoje.estado === 'ok' ? hoje.valor : null,
      base: hoje.estado === 'ok' ? hoje.base : 0,
      motivo: hoje.estado === 'ok' ? hoje.motivo : ('indisponivel' as const),
      origem,
      registrado_por: quem.email,
    };
    const nova = await inserir(p, IndicadoresMedidos, campos, autoriaDe(quem, agora));
    await auditar(p, quem, 'inclusao', 'IndicadoresMedidos', nova.id, Object.keys(campos), agora);
  }
  await registrarHistorico(p, quem, projetoId, 'Medição dos indicadores registrada', null, agora);
  return automaticos.length;
}

/** Botão "Registrar medição" (origem `manual`). */
export const registrarMedicao = (p: Planilhas, quem: Autorizador, projetoId: string, leitor?: NumerosDePessoas, opcoes: Opcoes = {}) =>
  fotografarIndicadores(p, quem, projetoId, 'manual', leitor, opcoes);
