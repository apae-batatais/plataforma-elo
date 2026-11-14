/**
 * Custo real com cedidos (C2 da #125): leitura dos totais por serviço e por cedente, sem nome nem valor por pessoa.
 *
 * Quem vê: `orcamento.folha.ver` (totais); coordenação só dos serviços do seu escopo (`custoCedidosPorServico`).
 * Nada aqui grava dado nem mexe na folha, no caixa ou no passivo.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Cedentes, Cedidos, LotacaoCedidos, ValoresCedidos } from '../dados/tabelas';
import { ROTULO_TIPO_CEDENTE, type TipoCedente } from '../dominio/cedidos';
import { custoDosCedidos, somaAno, type CedidoParaCusto } from '../dominio/cedidos-custo';
import { vigenteNoMes, type LinhaRateio } from '../dominio/folha';

export interface CedidosDoAno {
  ano: number;
  /** Há pelo menos um cedido que conta nos números do ano (o seletor só aparece então). */
  temCedidos: boolean;
  mensal: number[];
  anual: number;
  porServico: { servico: string; mensal: number[]; anual: number }[];
  porCedente: { cedenteId: string; nome: string; tipo: TipoCedente; tipoRotulo: string; mensal: number[]; anual: number }[];
  /** Cada cedido ativo conta com o percentual da lotação. */
  profissionais: Map<string, number>;
  /** Cedidos ativos no ano que ficaram de fora por falta de valor ou lotação. */
  semNumero: number;
}

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

export const SEM_CEDIDOS = (ano: number): CedidosDoAno => ({ ano, temCedidos: false, mensal: Array(12).fill(0), anual: 0, porServico: [], porCedente: [], profissionais: new Map(), semNumero: 0 });

/** Totais do ano. Sem `orcamento.folha.ver` (global) devolve "sem cedidos". */
export async function cedidosDoAno(p: Planilhas, quem: Autorizador, ano: number): Promise<CedidosDoAno> {
  if (!quem.temPermissao('orcamento.folha.ver')) return SEM_CEDIDOS(ano);
  const [cedentes, cedidos, valores, lotacoes] = await lerTabelas(p, [Cedentes, Cedidos, ValoresCedidos, LotacaoCedidos] as const);
  const ativos = cedidos.ativos();
  if (ativos.length === 0) return SEM_CEDIDOS(ano);
  const cedente = new Map(cedentes.todos().map((c) => [c.id, c]));

  const entradas: CedidoParaCusto[] = ativos.map((c) => {
    const meusValores = valores.ativos().filter((v) => v.cedido_id === c.id);
    const lotes = new Map<string, { vigencia: string; criado_em: string; linhas: LinhaRateio[] }>();
    for (const l of lotacoes.ativos().filter((x) => x.cedido_id === c.id)) {
      const atual = lotes.get(l.lote) ?? { vigencia: l.vigencia, criado_em: l.criado_em, linhas: [] };
      atual.linhas.push({ centro: l.servico, percentual: l.percentual });
      lotes.set(l.lote, atual);
    }
    const meusLotes = [...lotes.values()];
    return {
      id: c.id,
      cedenteId: c.cedente_id,
      tipoCedente: cedente.get(c.cedente_id)?.tipo ?? 'outro',
      cessao: c,
      valorNoMes: (mes) => {
        const limite = ultimoDia(ano, mes);
        const v = vigenteNoMes(meusValores.filter((x) => x.vigencia <= limite), ano, mes);
        return v ? v.valor_mensal : null;
      },
      lotacaoNoMes: (mes) => vigenteNoMes(meusLotes, ano, mes)?.linhas,
    };
  });

  const r = custoDosCedidos(ano, entradas);
  const zeros = () => Array(12).fill(0) as number[];
  const mensal = [...r.porServico.values()].reduce((acc, l) => acc.map((v, i) => v + l[i]), zeros()).map((v) => Math.round(v * 100) / 100);
  return {
    ano,
    temCedidos: r.porServico.size > 0,
    mensal,
    anual: somaAno(mensal),
    porServico: [...r.porServico].map(([servico, m]) => ({ servico, mensal: m, anual: somaAno(m) })).sort((a, b) => b.anual - a.anual),
    porCedente: [...r.porCedente]
      .map(([id, x]) => ({ cedenteId: id, nome: cedente.get(id)?.nome ?? '—', tipo: x.tipo, tipoRotulo: ROTULO_TIPO_CEDENTE[x.tipo], mensal: x.mensal, anual: somaAno(x.mensal) }))
      .sort((a, b) => b.anual - a.anual),
    profissionais: r.profissionais,
    semNumero: r.semNumero,
  };
}
