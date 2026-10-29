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
import { CentrosCusto } from '../dados/tabelas';
import { ErroValidacaoFolha, profissionaisPorServico } from './folha';
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
        vagas: s.vagas ?? null,
        classificado: Boolean(c),
      };
    })
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarCentro(
  p: Planilhas,
  quem: Autorizador,
  dados: { servico: string; tipo: TipoCentro; atendidos: number | null; sessoes: number | null; area_m2: number | null },
): Promise<void> {
  if (!quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
  const [servicos, centros] = await lerTabelas(p, [Servicos, CentrosCusto] as const);
  if (!servicos.ativos().some((s) => s.codigo === dados.servico)) throw new ErroCentro('Serviço não encontrado.');
  if (!['direto', 'indireto', 'despesa'].includes(dados.tipo)) throw new ErroCentro('Escolha o tipo do centro de custo.');
  for (const [v, nome] of [[dados.atendidos, 'Atendidos'], [dados.sessoes, 'Sessões'], [dados.area_m2, 'Área (m²)']] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) throw new ErroCentro(`${nome}: informe um número positivo ou deixe em branco.`);
  }
  const campos = { servico: dados.servico, tipo: dados.tipo, atendidos: dados.atendidos, sessoes: dados.sessoes, area_m2: dados.area_m2 };
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
          custos,
          receitas: prev.receitas.map((r) => ({ area: r.area, restrita: r.uso === 'restrita', valor: r.valor })),
          ordemGrupos: [GRUPO_FOLHA, ...prev.opcoes.grupos.map((g) => g.nome)],
        })
      : null,
    semClassificacao: centros.filter((c) => !c.classificado).length,
  };
}
