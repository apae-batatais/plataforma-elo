/**
 * Centros de custo (classificação) e Análise por área.
 *
 * - orcamento.painel.ver: ver os centros e a análise.
 * - orcamento.previsao.editar: classificar os centros (tipo, atendidos, sessões, m²).
 * O nº de profissionais vem da lotação da folha (só totais).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { analisarArea, type AnaliseArea, type BaseRateio, type CentroAnalise, type CustoLancado, type TipoCentro } from '../dominio/analise-area';
import type { Categoria } from '../dominio/previsao';
import { CentrosCusto, Despesas, GruposGasto, RegrasRateio, RegrasRateioParticipantes } from '../dados/tabelas';
import { aplicarRegras, conferirRegra, ErroRegra, type CentroRateio, type CustoRateado } from '../dominio/rateio-custos';
import { ErroValidacaoFolha, profissionaisPorServico } from './folha';
import { regrasParaCalculo } from './regras-rateio';
import { lerPrevisao } from './previsao';

const ErroCentro = ErroValidacaoFolha;

function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.painel.ver') && !quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
}

export interface LinhaCentro extends CentroAnalise {
  id: string | null;
  versao: number | null;
  areaNome: string;
  /** Vagas cadastradas no serviço (sugestão para "atendidos"). */
  vagas: number | null;
  /** Regra de rateio do serviço (apoio e administrativo). */
  regraId: string | null;
  classificado: boolean;
}

export async function listarCentros(p: Planilhas, quem: Autorizador): Promise<LinhaCentro[]> {
  exigirVer(quem);
  const [servicos, areas, centros] = await lerTabelas(p, [Servicos, Areas, CentrosCusto] as const);
  const prof = quem.temPermissao('orcamento.folha.ver') ? await profissionaisPorServico(p) : new Map<string, number>();
  const nomeArea = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  const porServico = new Map(centros.ativos().map((c) => [c.servico, c]));
  return servicos
    .ativos()
    .map((s) => {
      const c = porServico.get(s.codigo);
      return {
        id: c?.id ?? null,
        versao: c?.versao ?? null,
        codigo: s.codigo,
        nome: s.nome,
        area: s.area ?? null,
        areaNome: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área',
        tipo: c?.tipo ?? 'direto',
        atendidos: c?.atendidos ?? s.vagas ?? null,
        sessoes: c?.sessoes ?? null,
        m2: c?.area_m2 ?? null,
        profissionais: prof.get(s.codigo) ?? 0,
        vagas: c?.vagas ?? s.vagas ?? null,
        regraId: c?.regra_rateio_id ?? null,
        classificado: Boolean(c),
      };
    })
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarCentro(
  p: Planilhas,
  quem: Autorizador,
  dados: { servico: string; tipo: TipoCentro; atendidos: number | null; sessoes: number | null; area_m2: number | null; vagas?: number | null; regra_rateio_id?: string | null },
): Promise<void> {
  if (!quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
  const [servicos, centros] = await lerTabelas(p, [Servicos, CentrosCusto] as const);
  if (!servicos.ativos().some((s) => s.codigo === dados.servico)) throw new ErroCentro('Serviço não encontrado.');
  if (!['direto', 'indireto', 'despesa'].includes(dados.tipo)) throw new ErroCentro('Escolha o tipo do centro de custo.');
  for (const [v, nome] of [[dados.atendidos, 'Atendidos'], [dados.sessoes, 'Sessões'], [dados.area_m2, 'Área (m²)'], [dados.vagas ?? null, 'Vagas']] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) throw new ErroCentro(`${nome}: informe um número positivo ou deixe em branco.`);
  }
  const regraId = dados.regra_rateio_id || null;
  if (regraId) {
    if (dados.tipo === 'direto') throw new ErroCentro('Só serviço de apoio ou administrativo tem regra própria de rateio.');
    const [regrasT, partT] = await lerTabelas(p, [RegrasRateio, RegrasRateioParticipantes] as const);
    const regra = regrasT.ativos().find((r) => r.id === regraId);
    if (!regra) throw new ErroCentro('Regra de rateio não encontrada.');
    const todos = servicos.ativos().map((s) => ({ codigo: s.codigo, area: s.area ?? null, tipo: (centros.ativos().find((c) => c.servico === s.codigo)?.tipo ?? 'direto') as TipoCentro }));
    const parts = partT.ativos().filter((x) => x.regra_id === regraId).map((x) => x.participante);
    try {
      conferirRegra({ tipo: regra.tipo, participantes: parts }, todos, { apoio: dados.tipo === 'indireto', administrativo: dados.tipo === 'despesa' });
    } catch (e) {
      if (e instanceof ErroRegra) throw new ErroCentro(e.message);
      throw e;
    }
  }
  const campos = { servico: dados.servico, tipo: dados.tipo, atendidos: dados.atendidos, sessoes: dados.sessoes, area_m2: dados.area_m2, vagas: dados.vagas ?? null, regra_rateio_id: regraId };
  const existente = centros.ativos().find((c) => c.servico === dados.servico);
  if (!existente) {
    const c = await inserir(p, CentrosCusto, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'CentrosCusto', registroId: c.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, CentrosCusto, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'CentrosCusto', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  }
}

export const GRUPO_FOLHA = 'Recursos Humanos – folha';

export interface PainelArea {
  ano: number;
  anos: number[];
  areas: { codigo: string; nome: string }[];
  area: { codigo: string; nome: string } | null;
  categorias: Categoria[];
  base: BaseRateio;
  analise: AnaliseArea | null;
  semClassificacao: number;
  /** Avisos do cálculo das regras de rateio. */
  avisosRegras: string[];
}

export async function painelPorArea(
  p: Planilhas,
  quem: Autorizador,
  filtro: { ano?: number; area?: string; categorias?: Categoria[]; base?: BaseRateio },
): Promise<PainelArea> {
  exigirVer(quem);
  const prev = await lerPrevisao(p, quem, filtro.ano);
  const centros = await listarCentros(p, quem);
  const categorias: Categoria[] = filtro.categorias?.length ? filtro.categorias : ['operacional', 'projetos'];
  const base: BaseRateio = filtro.base && ['custo', 'profissionais', 'atendidos', 'm2'].includes(filtro.base) ? filtro.base : 'custo';

  const nomeArea = new Map(prev.opcoes.areas.map((a) => [a.codigo, a.nome]));
  const comCentros = [...new Set(centros.filter((c) => c.tipo !== 'despesa' && c.area).map((c) => c.area!))]
    .map((codigo) => ({ codigo, nome: nomeArea.get(codigo) ?? codigo }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const area = comCentros.find((a) => a.codigo === filtro.area) ?? comCentros[0] ?? null;

  const custos: CustoLancado[] = [
    ...prev.despesas.filter((d) => categorias.includes(d.categoria)).map((d) => ({ servico: d.servico, grupo: d.grupoNome, valor: d.valor })),
    // A folha é custo operacional.
    ...(categorias.includes('operacional') ? (prev.folha?.linhas ?? []).map((l) => ({ servico: l.servico, grupo: GRUPO_FOLHA, valor: l.anual })) : []),
  ];

  // Regras de rateio (R1): o que tem regra vai direto aos serviços; o resto segue a base do painel.
  const [regrasCalc, despesasT, gruposT] = await Promise.all([regrasParaCalculo(p), lerTabelas(p, [Despesas] as const), lerTabelas(p, [GruposGasto] as const)]);
  const regraDoItem = new Map(despesasT[0].ativos().map((d) => [d.id, d.regra_rateio_id]));
  const regraDoGrupo = new Map(gruposT[0].ativos().map((g) => [g.id, g.regra_rateio_id]));
  const profPorServico = new Map(centros.map((c) => [c.codigo, c.profissionais]));
  const centrosRateio: CentroRateio[] = centros.map((c) => ({
    codigo: c.codigo, area: c.area, tipo: c.tipo, atendidos: c.atendidos, vagas: c.vagas, m2: c.m2,
    profissionais: profPorServico.get(c.codigo) ?? 0, regraId: c.regraId,
  }));
  const regraAplicada = aplicarRegras({
    centros: centrosRateio,
    regras: regrasCalc.regras,
    basesProprias: regrasCalc.basesDoAno(prev.ano),
    custos: [
      ...prev.despesas.filter((d) => categorias.includes(d.categoria)).map((d) => ({ servico: d.servico, grupo: d.grupoNome, valor: d.valor, regraItem: regraDoItem.get(d.id) ?? null, regraGrupo: regraDoGrupo.get(d.grupo_id) ?? null })),
      ...(categorias.includes('operacional') ? (prev.folha?.linhas ?? []).map((l) => ({ servico: l.servico, grupo: GRUPO_FOLHA, valor: l.anual })) : []),
    ],
  });
  const custosFinais: CustoLancado[] = regraAplicada.mantidos;
  const porRegra = regraAplicada.rateados.map((r: CustoRateado) => ({ servico: r.servico, grupo: r.grupo, valor: r.valor, regraNome: r.regraNome, origem: r.origem }));
  void custos;

  return {
    ano: prev.ano,
    anos: prev.anos,
    areas: comCentros,
    area,
    categorias,
    base,
    analise: area
      ? analisarArea({
          area: area.codigo,
          base,
          centros,
          custos: custosFinais,
          porRegra,
          receitas: prev.receitas.map((r) => ({ area: r.area, restrita: r.uso === 'restrita', valor: r.valor })),
          ordemGrupos: [GRUPO_FOLHA, ...prev.opcoes.grupos.map((g) => g.nome)],
        })
      : null,
    semClassificacao: centros.filter((c) => !c.classificado).length,
    avisosRegras: regraAplicada.avisos,
  };
}
