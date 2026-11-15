/**
 * Participação de quem cede (C2c da #125) e leitura por serviço e cedente para o painel de sustentabilidade (#131).
 *
 * Quem vê: `orcamento.folha.ver` (totais, sem nome nem valor de pessoa). A leitura por serviço passa pelo `Autorizador`
 * no escopo do serviço. Só leitura; nada é gravado.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Cedentes } from '../dados/tabelas';
import { avisosDeCessao } from './cedidos';
import { calcularCedidosDoAno } from './cedidos-custo';
import { lerPrevisao } from './previsao';
import { ROTULO_TIPO_CEDENTE, TIPOS_CEDENTE, type TipoCedente } from '../dominio/cedidos';

const arred = (v: number) => Math.round(v * 100) / 100;

export interface ParticipacaoDoAno {
  ano: number;
  /** Custo de todos os serviços no ano, já com os cedidos (base dos percentuais). */
  custoTotal: number;
  total: number;
  porTipo: { tipo: TipoCedente; rotulo: string; valor: number; percentual: number }[];
  /** Cada cedente cadastrado e ativo; sem cedido no ano aparece zerado. "Dinheiro do termo" ainda não é ligado (ver especificação). */
  porCedente: { id: string; nome: string; tipo: TipoCedente; tipoRotulo: string; pessoas: number; percentual: number }[];
  /** Ano corrente: os números são a previsão até dezembro. */
  previstoAteDezembro: boolean;
  /** Quantas cessões terminam no prazo do aviso (para a leitura ao lado). */
  cessoesPerto: number;
}

export async function participacaoDeQuemCede(p: Planilhas, quem: Autorizador, ano: number, agora: Date = new Date()): Promise<ParticipacaoDoAno> {
  if (!quem.temPermissao('orcamento.folha.ver')) throw new ErroPermissao();
  const [cedentes] = await lerTabelas(p, [Cedentes] as const);
  const c = await calcularCedidosDoAno(p, ano);
  const prev = await lerPrevisao(p, quem, ano, { incluirCedidos: true });
  const custoTotal = prev.totais.despesa.anual;
  const pct = (v: number) => (custoTotal > 0 ? Math.round((v / custoTotal) * 10000) / 100 : 0);
  const valorDe = new Map(c.porCedente.map((x) => [x.cedenteId, x.anual]));
  const porCedente = cedentes
    .ativos()
    .map((x) => ({ id: x.id, nome: x.nome, tipo: x.tipo, tipoRotulo: ROTULO_TIPO_CEDENTE[x.tipo], pessoas: valorDe.get(x.id) ?? 0, percentual: pct(valorDe.get(x.id) ?? 0) }))
    .sort((a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome, 'pt-BR'));
  const porTipo = TIPOS_CEDENTE.map((tipo) => {
    const valor = arred(porCedente.filter((x) => x.tipo === tipo).reduce((s, x) => s + x.pessoas, 0));
    return { tipo, rotulo: ROTULO_TIPO_CEDENTE[tipo], valor, percentual: pct(valor) };
  });
  const avisos = await avisosDeCessao(p, quem, agora);
  return {
    ano,
    custoTotal,
    total: c.anual,
    porTipo,
    porCedente,
    previstoAteDezembro: ano === Number(new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 4)),
    cessoesPerto: avisos.itens.length,
  };
}

/** Leitura por serviço e cedente (tipo e valor anual), sem dado pessoal, para o painel de sustentabilidade (#131). */
export interface CedidoDoServicoPorCedente {
  servico: string;
  cedente: string;
  tipo: TipoCedente;
  valorAnual: number;
}

/** Só devolve os serviços em que a pessoa tem `orcamento.folha.ver` (escopo de serviço). */
export async function cedidosPorServicoECedente(p: Planilhas, quem: Autorizador, ano: number): Promise<CedidoDoServicoPorCedente[]> {
  const c = await calcularCedidosDoAno(p, ano);
  return c.porServicoCedente
    .filter((x) => quem.temPermissao('orcamento.folha.ver', { tipo: 'servico', codigo: x.servico }))
    .map((x) => ({ servico: x.servico, cedente: x.nome, tipo: x.tipo, valorAnual: x.anual }));
}
