/**
 * Custo real com profissionais cedidos (C2 da #125): regras puras, sem acesso a dados.
 *
 * O cedido entra como despesa (por serviço) e como receita (por cedente) de MESMO valor, sem passar pelo
 * caixa. Os dois lados saem da mesma conta em centavos, então são iguais em todo mês, por construção.
 */
import { ativoNoMes, type CessaoBasica, type TipoCedente } from './cedidos';
import type { LinhaRateio } from './folha';

export interface CedidoParaCusto {
  id: string;
  cedenteId: string;
  tipoCedente: TipoCedente;
  cessao: CessaoBasica;
  /** Valor mensal vigente no mês (1 a 12); nulo = ainda falta valor. */
  valorNoMes: (mes: number) => number | null;
  /** Lotação vigente no mês; nula ou que não soma 100% = fica fora (nunca soma errado em silêncio). */
  lotacaoNoMes: (mes: number) => LinhaRateio[] | undefined;
}

export interface CustoDosCedidos {
  /** Despesa por serviço, mês a mês (12 posições, em reais). */
  porServico: Map<string, number[]>;
  /** Receita por cedente, mês a mês (igual à despesa, somada por quem cede). */
  porCedente: Map<string, { tipo: TipoCedente; mensal: number[] }>;
  /** Profissionais por serviço (cada cedido ativo conta com o percentual da lotação, no último mês com valor). */
  profissionais: Map<string, number>;
  /** Cedidos que ficaram fora por falta de valor ou lotação. */
  semNumero: number;
}

const zeros = () => Array(12).fill(0) as number[];

/** Parte de `centavos` por percentual; o último serviço fica com o que sobrou, para a soma fechar. */
export function dividirEmCentavos(centavos: number, linhas: LinhaRateio[]): number[] {
  let restante = centavos;
  return linhas.map((l, i) => {
    const parte = i === linhas.length - 1 ? restante : Math.round((centavos * l.percentual) / 100);
    restante -= parte;
    return parte;
  });
}

export function custoDosCedidos(ano: number, cedidos: CedidoParaCusto[]): CustoDosCedidos {
  const porServico = new Map<string, number[]>();
  const porCedente = new Map<string, { tipo: TipoCedente; mensal: number[] }>();
  const profissionais = new Map<string, number>();
  let semNumero = 0;
  for (const c of cedidos) {
    let contou = false;
    let ultima: LinhaRateio[] | undefined;
    for (let mes = 1; mes <= 12; mes++) {
      if (!ativoNoMes(c.cessao, ano, mes)) continue;
      const valor = c.valorNoMes(mes);
      const lotacao = c.lotacaoNoMes(mes);
      const fecha = lotacao && lotacao.length > 0 && Math.round(lotacao.reduce((s, l) => s + l.percentual, 0) * 100) === 10000;
      if (valor === null || !fecha) continue;
      contou = true;
      ultima = lotacao;
      const partes = dividirEmCentavos(Math.round(valor * 100), lotacao);
      lotacao.forEach((l, i) => {
        const linha = porServico.get(l.centro) ?? zeros();
        linha[mes - 1] += partes[i] / 100;
        porServico.set(l.centro, linha);
      });
      const ced = porCedente.get(c.cedenteId) ?? { tipo: c.tipoCedente, mensal: zeros() };
      ced.mensal[mes - 1] += partes.reduce((s, v) => s + v, 0) / 100;
      porCedente.set(c.cedenteId, ced);
    }
    if (!contou) {
      // Só conta como "fora" quem estava ativo em algum mês do ano.
      if (Array.from({ length: 12 }, (_, i) => ativoNoMes(c.cessao, ano, i + 1)).some(Boolean)) semNumero++;
      continue;
    }
    for (const l of ultima ?? []) profissionais.set(l.centro, Math.round(((profissionais.get(l.centro) ?? 0) + l.percentual / 100) * 100) / 100);
  }
  const arred = (l: number[]) => l.map((v) => Math.round(v * 100) / 100);
  for (const [k, v] of porServico) porServico.set(k, arred(v));
  for (const v of porCedente.values()) v.mensal = arred(v.mensal);
  return { porServico, porCedente, profissionais, semNumero };
}

export const somaAno = (l: number[]) => Math.round(l.reduce((s, v) => s + v, 0) * 100) / 100;

/** Poder público conta como receita pública; empresa e "outro" são apoio de terceiros (resposta 2). */
export const contaComoPublico = (tipo: TipoCedente) => tipo === 'poder_publico';
