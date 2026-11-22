/**
 * Cálculo e recálculo das despesas geradas por rateio (#225, ADR-038).
 *
 * Arquivo sem dependência de folha, previsão ou regras-rateio (os números de profissionais chegam por
 * parâmetro), para a folha, as regras e os centros de custo poderem chamar o recálculo sem formar ciclo.
 */
import { atualizarVarios, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { CentrosCusto, Despesas, Exercicios, LancamentosRateio, type RegLancamentoRateio } from '../dados/tabelas';
import { ratearMeses, totalDosMeses } from '../dominio/lancamento-rateio';
import { arred, valorDoItem } from '../dominio/previsao';
import { conferirRegra, ErroRegra, ratearPelaRegra, type CentroRateio, type RegraRateio } from '../dominio/rateio-custos';
import { regrasParaCalculo } from './regras-calculo';

/** Nº de profissionais por serviço (vem da folha; injetado para não criar ciclo). */
export type Profissionais = () => Promise<Map<string, number>>;

export const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
export const mesesDe = (r: object) => MESES.map((m) => Number((r as Record<string, unknown>)[`m${m}`] ?? 0) || 0);
export const colunasMeses = (lista: number[]) => Object.fromEntries(lista.map((v, i) => [`m${i + 1}`, v]));

export interface ContextoCalculo {
  centros: CentroRateio[];
  regras: Map<string, RegraRateio>;
  basesDoAno: (ano: number) => Map<string, Map<string, number>>;
  custoDireto: (ano: number) => Map<string, number>;
  nomeServico: Map<string, string>;
}

export async function contextoDeCalculo(p: Planilhas, profissionais: Profissionais): Promise<ContextoCalculo> {
  const [servicos, centrosT, despesas] = await lerTabelas(p, [Servicos, CentrosCusto, Despesas] as const);
  const prof = await profissionais();
  const porServ = new Map(centrosT.ativos().map((c) => [c.servico, c]));
  const centros: CentroRateio[] = servicos.ativos().map((s) => {
    const c = porServ.get(s.codigo);
    return { codigo: s.codigo, area: s.area ?? null, tipo: c?.tipo ?? 'direto', atendidos: c?.atendidos ?? s.vagas ?? null, vagas: c?.vagas ?? s.vagas ?? null, m2: c?.area_m2 ?? null, profissionais: prof.get(s.codigo) ?? 0, regraId: c?.regra_rateio_id ?? null };
  });
  const { regras, basesDoAno } = await regrasParaCalculo(p);
  return {
    centros,
    regras: new Map(regras.map((r) => [r.id, r])),
    basesDoAno,
    // Base "custo direto": só as despesas lançadas à mão (as geradas por rateio não entram, senão a conta giraria em círculo).
    custoDireto: (ano) => {
      const m = new Map<string, number>();
      for (const d of despesas.ativos().filter((x) => x.ano === ano && x.situacao === 'aceito' && !x.lancamento_rateio_id)) {
        m.set(d.servico, arred((m.get(d.servico) ?? 0) + valorDoItem(d.quantidade, d.ocorrencias, d.valor_unitario)));
      }
      return m;
    },
    nomeServico: new Map(servicos.ativos().map((s) => [s.codigo, s.nome])),
  };
}

/** Quanto cada serviço participante recebe em cada mês (mesmos pesos em todos os meses). */
export function partesPorServico(ctx: ContextoCalculo, regraId: string, ano: number, meses: number[]): Map<string, number[]> {
  const regra = ctx.regras.get(regraId);
  if (!regra) return new Map();
  const base = { centros: ctx.centros, custoDireto: ctx.custoDireto(ano), basesProprias: ctx.basesDoAno(ano) };
  try {
    conferirRegra(regra, ctx.centros);
  } catch (e) {
    if (e instanceof ErroRegra) return new Map();
    throw e;
  }
  return ratearMeses(meses, (valor) => ratearPelaRegra(valor, regra, base, () => true));
}


/** Chave de comparação: mesmos serviços e mesmos meses = nada a regravar. */
const assinatura = (m: Map<string, number[]>) => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));

/**
 * Deixa as despesas geradas de um lançamento como o cálculo atual manda. Só mexe se algo mudou.
 * Devolve quantas despesas foram geradas e quantas encerradas.
 */
export async function sincronizar(p: Planilhas, quem: Autorizador, lanc: RegLancamentoRateio, ctx: ContextoCalculo): Promise<{ geradas: number; encerradas: number; semDespesa: boolean }> {
  const [despesasT] = await lerTabelas(p, [Despesas] as const);
  const atuais = despesasT.ativos().filter((d) => d.lancamento_rateio_id === lanc.id);
  const novas = partesPorServico(ctx, lanc.regra_rateio_id, lanc.ano, mesesDe(lanc));
  const antes = new Map(atuais.map((d) => [d.servico, mesesDe(d)]));
  if (assinatura(antes) === assinatura(novas)) return { geradas: 0, encerradas: 0, semDespesa: novas.size === 0 };
  const autoria = { email: quem.email };
  if (atuais.length) {
    await atualizarVarios(p, Despesas, atuais.map((d) => ({ id: d.id, versao: d.versao, mudancas: { ativo: false } })), autoria);
    for (const d of atuais) {
      await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Despesas', registroId: d.id, detalhes: { colunas: ['ativo'], lancamento_rateio_id: lanc.id } });
    }
  }
  const criadas = await inserirRegistros(
    p,
    despesasT,
    [...novas].map(([servico, meses]) => ({
      ano: lanc.ano,
      servico,
      grupo_id: lanc.grupo_id,
      fonte_id: lanc.fonte_id,
      descricao: lanc.descricao,
      regra_rateio_id: null,
      quantidade: 1,
      ocorrencias: 1,
      valor_unitario: totalDosMeses(meses),
      distribuicao: 'manual' as const,
      ...colunasMeses(meses),
      categoria: lanc.categoria,
      situacao: 'aceito' as const,
      lancamento_rateio_id: lanc.id,
    })) as never[],
    autoria,
  );
  for (const d of criadas) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Despesas', registroId: d.id, detalhes: { lancamento_rateio_id: lanc.id } });
  }
  return { geradas: criadas.length, encerradas: atuais.length, semDespesa: novas.size === 0 };
}

export interface Gatilho {
  /** Regra de rateio que foi salva. */
  regraId?: string;
  /** Base própria cujos valores mudaram. */
  baseId?: string;
  /** Serviço cujos números (atendidos, m², vagas ou lotação) mudaram. */
  servico?: string;
}

/**
 * Único ponto de recálculo (ADR-038): chamado depois de salvar a regra, os valores de uma base, os números
 * de um serviço ou a lotação. Só atinge lançamentos de exercício em elaboração; os de exercício aprovado
 * ficam congelados. Não pede permissão de lançar: quem alterou a origem já foi autorizado lá.
 */
export async function recalcularLancamentosAfetados(p: Planilhas, quem: Autorizador, gatilho: Gatilho, profissionais: Profissionais): Promise<number> {
  const [exercicios, lancT, servicos] = await lerTabelas(p, [Exercicios, LancamentosRateio, Servicos] as const);
  const abertos = new Set(exercicios.ativos().filter((e) => e.situacao === 'elaboracao').map((e) => e.ano));
  const candidatos = lancT.ativos().filter((l) => abertos.has(l.ano));
  if (candidatos.length === 0) return 0;
  const ctx = await contextoDeCalculo(p, profissionais);
  const area = gatilho.servico ? (servicos.ativos().find((s) => s.codigo === gatilho.servico)?.area ?? null) : null;
  const atinge = (l: RegLancamentoRateio) => {
    const r = ctx.regras.get(l.regra_rateio_id);
    if (!r) return false;
    if (gatilho.regraId && r.id === gatilho.regraId) return true;
    if (gatilho.baseId && (r.base1 === `propria:${gatilho.baseId}` || r.base2 === `propria:${gatilho.baseId}`)) return true;
    if (gatilho.servico) return r.participantes.includes(gatilho.servico) || (r.tipo === 'area' && area !== null && r.participantes.includes(area));
    return false;
  };
  let mudou = 0;
  for (const l of candidatos.filter(atinge)) {
    const r = await sincronizar(p, quem, l, ctx);
    mudou += r.geradas + r.encerradas;
  }
  return mudou;
}

