/**
 * Painel de sustentabilidade financeira (#131, S1).
 *
 * - orcamento.sustentabilidade.ver: ver o painel (Diretoria, Financeiro, Leitura).
 * - orcamento.parametros.editar: alterar a origem de um serviço e os limites de alerta (auditado, só colunas).
 * Nada é guardado: os números são calculados na hora a partir da Previsão (mesmo custo da Análise por área)
 * e dos termos de Parcerias, que a plataforma entrega por `CatalogoParcerias` (ADR-022).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { contarAtendidos } from '@/nucleo/pessoas/contagem';
import { MINIMO_DE_PESSOAS } from '@/nucleo/ligacoes/numero-agregado';
import { CentrosCusto, Exercicios, LimitesSustentabilidade } from '../dados/tabelas';
import { arred } from '../dominio/previsao';
import {
  coberturaDoServico, conferirLimite, ErroSustentabilidade, INDICADORES_COM_LIMITE, ORIGENS, pesoDoAporte, pesoDoServico, repassePorServico,
  type CoberturaServico, type LimiteDefinido, type Origem, type PesoDoAporte, type TermoDoPainel,
} from '../dominio/sustentabilidade';
import { listarCentros, painelPorArea } from './analise-area';
import { lerPrevisao } from './previsao';

export const PERMISSAO_VER = 'orcamento.sustentabilidade.ver';
const PERMISSAO_EDITAR = 'orcamento.parametros.editar';

/** Leitura de Parcerias que a plataforma entrega (Orçamento não importa outro app). */
export interface CatalogoParcerias {
  termos(): Promise<TermoDoPainel[]>;
}

export interface ServicoDoPainel extends CoberturaServico {
  /** Aporte do serviço ÷ receita livre, em %. */
  pesoNaReceitaLivre: number | null;
  limiteServico: number | null;
  acimaDoLimiteServico: boolean;
}

export interface AnoDoPainel {
  ano: number;
  situacao: 'elaboracao' | 'aprovado' | 'encerrado';
  servicos: ServicoDoPainel[];
  peso: PesoDoAporte;
}

export interface PainelSustentabilidade {
  ano: number;
  anos: number[];
  situacao: 'elaboracao' | 'aprovado' | 'encerrado' | null;
  /** Parcerias desligado: só o custo, sem repasse. */
  parceriasDesligado: boolean;
  servicos: ServicoDoPainel[];
  peso: PesoDoAporte | null;
  /** Peso nos anos anteriores com previsão aprovada (nulo = sem dado). */
  evolucao: { ano: number; peso: number | null }[];
  podeEditar: boolean;
  /** Serviços diretos sem termo e sem origem definida. */
  semOrigem: number;
}

function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERMISSAO_VER)) throw new ErroPermissao();
}

const hojeBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Limites ativos: um da instituição e, opcional, um por serviço. */
async function limitesAtivos(p: Planilhas): Promise<LimiteDefinido[]> {
  const [t] = await lerTabelas(p, [LimitesSustentabilidade] as const);
  return t.ativos().map((l) => ({ indicador: l.indicador, servico: l.servico ?? null, valor: l.valor }));
}

async function atendidosMedios(p: Planilhas, servicos: string[], ano: number, hoje: string): Promise<Map<string, number | null>> {
  const ate = hoje.startsWith(`${ano}-`) ? Number(hoje.slice(5, 7)) : ano < Number(hoje.slice(0, 4)) ? 12 : 0;
  const r = new Map<string, number | null>();
  if (ate === 0 || servicos.length === 0) return r;
  const meses = Array.from({ length: ate }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  const c = await contarAtendidos(p, servicos, meses, hoje);
  for (const s of servicos) {
    const v = [...(c.get(s)?.values() ?? [])];
    const media = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    // Mínimo de pessoas (ADR-023): média baixa não vira per capita.
    r.set(s, media >= MINIMO_DE_PESSOAS ? media : null);
  }
  return r;
}

/** Calcula um ano inteiro (custo pela Análise por área + repasse dos termos). */
async function calcularAno(p: Planilhas, quem: Autorizador, termos: TermoDoPainel[] | null, ano: number, limites: LimiteDefinido[], hoje: string): Promise<{ servicos: ServicoDoPainel[]; peso: PesoDoAporte }> {
  const [prev, centros, [centrosT]] = await Promise.all([lerPrevisao(p, quem, ano), listarCentros(p, quem), lerTabelas(p, [CentrosCusto] as const)]);
  const origemDe = new Map(centrosT.ativos().map((c) => [c.servico, c.origem ?? null]));
  const diretos = centros.filter((c) => c.tipo === 'direto' && c.area);
  // Custo total do serviço = o "Total" da Análise por área (mesmas categorias e base padrão).
  const custo = new Map<string, number>();
  for (const area of [...new Set(diretos.map((c) => c.area!))]) {
    const a = (await painelPorArea(p, quem, { ano, area })).analise;
    for (const r of a?.rateio ?? []) custo.set(r.codigo, r.total);
  }
  const repasse = termos ? repassePorServico(termos, ano) : new Map();
  const comTermoPessoa = new Set((termos ?? []).filter((t) => t.unidadePessoa).flatMap((t) => t.servicos.map((s) => s.servico)));
  const atendidos = await atendidosMedios(p, [...comTermoPessoa], ano, hoje);
  const receitaLivre = arred(prev.receitas.filter((r) => r.uso === 'livre').reduce((s, r) => s + r.valor, 0));
  const limiteServico = new Map(limites.filter((l) => l.indicador === 'peso_aporte' && l.servico).map((l) => [l.servico!, l.valor]));

  const servicos = diretos
    .filter((c) => (custo.get(c.codigo) ?? 0) > 0 || repasse.has(c.codigo))
    .map((c) => {
      const cob = coberturaDoServico({
        codigo: c.codigo, nome: c.nome, area: c.areaNome, campoOrigem: origemDe.get(c.codigo) ?? null,
        custoTotal: custo.get(c.codigo) ?? 0, repasse: repasse.get(c.codigo) ?? null, atendidosMedios: atendidos.get(c.codigo) ?? null,
      });
      const limite = limiteServico.get(c.codigo) ?? null;
      const peso = pesoDoServico(cob.aporte, receitaLivre);
      return { ...cob, pesoNaReceitaLivre: peso, limiteServico: limite, acimaDoLimiteServico: peso !== null && limite !== null && peso > limite };
    })
    .sort((a, b) => b.aporte - a.aporte || a.nome.localeCompare(b.nome, 'pt-BR'));
  const limiteInstituicao = limites.find((l) => l.indicador === 'peso_aporte' && !l.servico)?.valor ?? null;
  return { servicos, peso: pesoDoAporte(servicos, receitaLivre, limiteInstituicao) };
}

export async function painelSustentabilidade(
  p: Planilhas,
  quem: Autorizador,
  catalogo: CatalogoParcerias | null,
  opcoes: { ano?: number; agora?: Date } = {},
): Promise<PainelSustentabilidade> {
  exigirVer(quem);
  const hoje = hojeBrasilia(opcoes.agora ?? new Date());
  const [[exercicios], limites, termos] = await Promise.all([lerTabelas(p, [Exercicios] as const), limitesAtivos(p), catalogo ? catalogo.termos() : Promise.resolve(null)]);
  const lista = exercicios.ativos().sort((a, b) => a.ano - b.ano);
  const anos = lista.map((e) => e.ano);
  const aprovados = lista.filter((e) => e.situacao !== 'elaboracao');
  const ano = opcoes.ano && anos.includes(opcoes.ano) ? opcoes.ano : (aprovados.at(-1)?.ano ?? anos.at(-1) ?? Number(hoje.slice(0, 4)));
  const ex = lista.find((e) => e.ano === ano) ?? null;
  const base = { ano, anos, situacao: ex?.situacao ?? null, parceriasDesligado: catalogo === null, podeEditar: quem.temPermissao(PERMISSAO_EDITAR) };
  if (!ex) return { ...base, servicos: [], peso: null, evolucao: [], semOrigem: 0 };

  const atual = await calcularAno(p, quem, termos, ano, limites, hoje);
  const anteriores = aprovados.filter((e) => e.ano < ano).slice(-3);
  const evolucao: PainelSustentabilidade['evolucao'] = [];
  for (const e of anteriores) evolucao.push({ ano: e.ano, peso: (await calcularAno(p, quem, termos, e.ano, limites, hoje)).peso.peso });
  return {
    ...base,
    ...atual,
    evolucao,
    semOrigem: atual.servicos.filter((s) => s.origem.fonte === 'sem_termo').length,
  };
}

/** Altera a origem de um serviço (vazio = voltar a usar a sugestão do termo). Auditado, com a versão lida. */
export async function alterarOrigem(p: Planilhas, quem: Autorizador, dados: { servico: string; origem: Origem | null }): Promise<void> {
  if (!quem.temPermissao(PERMISSAO_EDITAR)) throw new ErroPermissao();
  if (dados.origem !== null && !ORIGENS.includes(dados.origem)) throw new ErroSustentabilidade('Escolha uma origem da lista.');
  const [centros] = await lerTabelas(p, [CentrosCusto] as const);
  const c = centros.ativos().find((x) => x.servico === dados.servico);
  if (c && c.tipo !== 'direto') throw new ErroSustentabilidade('Só serviço de custo direto tem origem.');
  const servicos = (await listarCentros(p, quem)).find((x) => x.codigo === dados.servico);
  if (!servicos) throw new ErroSustentabilidade('Serviço não encontrado.');
  if (servicos.tipo !== 'direto') throw new ErroSustentabilidade('Só serviço de custo direto tem origem.');
  if (!c) {
    if (dados.origem === null) return;
    const novo = await inserir(p, CentrosCusto, { servico: dados.servico, tipo: 'direto', atendidos: null, sessoes: null, area_m2: null, vagas: null, regra_rateio_id: null, origem: dados.origem }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'CentrosCusto', registroId: novo.id, detalhes: { colunas: ['origem'] } });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, CentrosCusto, c.id, c.versao, { origem: dados.origem }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'CentrosCusto', registroId: c.id, detalhes: { colunas: colunasAlteradas } });
}

export interface LinhaLimite {
  id: string;
  versao: number;
  indicador: string;
  servico: string | null;
  servicoNome: string | null;
  valor: number;
}

export async function listarLimites(p: Planilhas, quem: Autorizador): Promise<{ limites: LinhaLimite[]; servicos: { codigo: string; nome: string }[]; podeEditar: boolean }> {
  exigirVer(quem);
  const [t] = await lerTabelas(p, [LimitesSustentabilidade] as const);
  const centros = (await listarCentros(p, quem)).filter((c) => c.tipo === 'direto');
  const nome = new Map(centros.map((c) => [c.codigo, c.nome]));
  return {
    limites: t.ativos().map((l) => ({ id: l.id, versao: l.versao, indicador: l.indicador, servico: l.servico ?? null, servicoNome: l.servico ? (nome.get(l.servico) ?? l.servico) : null, valor: l.valor })),
    servicos: centros.map((c) => ({ codigo: c.codigo, nome: c.nome })),
    podeEditar: quem.temPermissao(PERMISSAO_EDITAR),
  };
}

/** Define (ou troca) o limite de um indicador; uma linha ativa por indicador e serviço. */
export async function salvarLimite(p: Planilhas, quem: Autorizador, dados: { indicador: string; servico: string | null; valor: number }): Promise<void> {
  if (!quem.temPermissao(PERMISSAO_EDITAR)) throw new ErroPermissao();
  if (!(INDICADORES_COM_LIMITE as readonly string[]).includes(dados.indicador)) throw new ErroSustentabilidade('Escolha um indicador da lista.');
  const valor = conferirLimite(dados.valor);
  const servico = dados.servico || null;
  if (servico && !(await listarCentros(p, quem)).some((c) => c.codigo === servico && c.tipo === 'direto')) throw new ErroSustentabilidade('Serviço não encontrado.');
  const [t] = await lerTabelas(p, [LimitesSustentabilidade] as const);
  const atual = t.ativos().find((l) => l.indicador === dados.indicador && (l.servico ?? null) === servico);
  if (!atual) {
    const novo = await inserir(p, LimitesSustentabilidade, { indicador: dados.indicador as 'peso_aporte', servico, valor }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'LimitesSustentabilidade', registroId: novo.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, LimitesSustentabilidade, atual.id, atual.versao, { valor }, { email: quem.email });
  if (colunasAlteradas.length) await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'LimitesSustentabilidade', registroId: atual.id, detalhes: { colunas: colunasAlteradas } });
}

/** Remover = encerrar a linha (`ativo = FALSE`); pode ser adicionado de novo. */
export async function removerLimite(p: Planilhas, quem: Autorizador, id: string): Promise<void> {
  if (!quem.temPermissao(PERMISSAO_EDITAR)) throw new ErroPermissao();
  const [t] = await lerTabelas(p, [LimitesSustentabilidade] as const);
  const atual = t.ativos().find((l) => l.id === id);
  if (!atual) throw new ErroSustentabilidade('Limite não encontrado.');
  const { colunasAlteradas } = await atualizar(p, LimitesSustentabilidade, atual.id, atual.versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'LimitesSustentabilidade', registroId: atual.id, detalhes: { colunas: colunasAlteradas.length ? colunasAlteradas : ['ativo'] } });
}
