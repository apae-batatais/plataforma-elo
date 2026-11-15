/**
 * Fontes dos termos (R3a, #140): liga cada fonte de um termo (lida de Parcerias pelo catálogo) à Fonte do
 * cadastro e à conta vinculada, e diz de onde vem cada categoria do plano de aplicação.
 *
 * - Ver (com os valores do termo): `orcamento.painel.ver`.
 * - Ligar fontes e categorias: só `orcamento.parametros.editar` (Financeiro).
 * Nada é apagado: tirar uma origem encerra a linha (ativo = FALSE). Auditoria registra colunas, nunca valores.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizarVarios, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { atualizar } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { CategoriasPlanoOrigens, Contas, Fontes, FontesTermo, GruposGasto } from '../dados/tabelas';
import {
  contasRepetidas, diferencaDeOrigens, erroDaConta, ORIGEM_FOLHA, origemDoGrupo, origensValidas, situacaoDaLigacao,
  type ContaParaLigacao, type SituacaoLigacao,
} from '../dominio/fontes-termo';
import type { CatalogoParcerias } from './catalogo-parcerias';
import { ErroValidacaoFolha } from './folha';

const PERM_EDITAR = 'orcamento.parametros.editar';
const PERM_VER = 'orcamento.painel.ver';

export const ErroFonteTermo = ErroValidacaoFolha;

function exigirVer(quem: Autorizador) {
  if (!quem.temPermissao(PERM_VER) && !quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}
function exigirEditar(quem: Autorizador) {
  if (!quem.temPermissao(PERM_EDITAR)) throw new ErroPermissao();
}

export interface CategoriaDoPlano {
  categoria: string;
  valor: number;
  /** Origens ligadas: "folha" ou "grupo:<id>". Vazio = "sem categoria no plano". */
  origens: string[];
}

export interface LinhaFonteDoTermo {
  fonteTermoId: string;
  termoId: string;
  termo: string;
  fonte: string;
  valorAtual: number;
  fonteId: string | null;
  contaId: string | null;
  /** Versão da ligação gravada; 0 quando ainda não existe. */
  versao: number;
  situacao: SituacaoLigacao;
  /** Outras fontes de termo que usam a mesma conta (aviso, não bloqueia). */
  contaRepetidaCom: string[];
  categorias: CategoriaDoPlano[];
  servicos: string[];
}

export interface FontesDosTermos {
  linhas: LinhaFonteDoTermo[];
  semLigacao: number;
  opcoes: {
    fontes: { id: string; nome: string; natureza: string }[];
    contas: { id: string; rotulo: string; fonteId: string | null }[];
    grupos: { id: string; nome: string }[];
  };
}

const ordemTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
const rotuloConta = (c: { banco: string; agencia: string | null; conta: string | null }) =>
  [c.banco, c.agencia && `ag. ${c.agencia}`, c.conta && `conta ${c.conta}`].filter(Boolean).join(' · ');

export async function listarFontesDosTermos(p: Planilhas, quem: Autorizador, catalogo: CatalogoParcerias): Promise<FontesDosTermos> {
  exigirVer(quem);
  const [termos, [ligacoes, origens, contas, fontes, grupos]] = await Promise.all([
    catalogo(),
    lerTabelas(p, [FontesTermo, CategoriasPlanoOrigens, Contas, Fontes, GruposGasto] as const),
  ]);
  const contasAtivas = contas.ativos().filter((c) => c.classe === 'vinculada');
  const mapaContas = new Map<string, ContaParaLigacao>(contas.todos().map((c) => [c.id, { id: c.id, classe: c.classe, fonteId: c.fonte_id }]));
  const ligacaoDe = new Map(ligacoes.ativos().map((l) => [l.fonte_termo_id, l]));
  const repetidas = contasRepetidas(
    [...ligacaoDe.values()].map((l) => ({ fonteTermoId: l.fonte_termo_id, fonteId: l.fonte_id, contaId: l.conta_id })),
  );
  const nomeDaFonteDoTermo = new Map(termos.flatMap((t) => t.fontes.map((f) => [f.id, `${t.numero} · ${f.nome}`] as const)));

  const linhas: LinhaFonteDoTermo[] = termos.flatMap((t) =>
    t.fontes.map((f) => {
      const lig = ligacaoDe.get(f.id);
      const registro = lig ? { fonteTermoId: f.id, fonteId: lig.fonte_id, contaId: lig.conta_id } : undefined;
      const usadas = lig?.conta_id ? (repetidas.get(lig.conta_id) ?? []).filter((x) => x !== f.id) : [];
      return {
        fonteTermoId: f.id,
        termoId: t.id,
        termo: `${t.numero} · ${t.parceiro}`,
        fonte: f.nome,
        valorAtual: f.valorAtual,
        fonteId: lig?.fonte_id ?? null,
        contaId: lig?.conta_id ?? null,
        versao: lig?.versao ?? 0,
        situacao: situacaoDaLigacao(registro, mapaContas),
        contaRepetidaCom: usadas.map((x) => nomeDaFonteDoTermo.get(x) ?? x),
        categorias: f.categorias.map((c) => ({
          categoria: c.categoria,
          valor: c.valor,
          origens: origens.ativos().filter((o) => o.fonte_termo_id === f.id && o.categoria === c.categoria).map((o) => o.origem).sort(),
        })),
        servicos: t.servicos,
      };
    }),
  );
  return {
    linhas,
    semLigacao: linhas.filter((l) => l.situacao === 'sem_ligacao').length,
    opcoes: {
      fontes: fontes.ativos().map((f) => ({ id: f.id, nome: f.nome, natureza: f.natureza })).sort((a, b) => ordemTexto(a.nome, b.nome)),
      contas: contasAtivas.map((c) => ({ id: c.id, rotulo: rotuloConta(c), fonteId: c.fonte_id })).sort((a, b) => ordemTexto(a.rotulo, b.rotulo)),
      grupos: grupos.ativos().map((g) => ({ id: g.id, nome: g.nome })).sort((a, b) => ordemTexto(a.nome, b.nome)),
    },
  };
}

async function exigirFonteDoCatalogo(catalogo: CatalogoParcerias, fonteTermoId: string) {
  const termos = await catalogo();
  const achou = termos.flatMap((t) => t.fontes).find((f) => f.id === fonteTermoId);
  if (!achou) throw new ErroFonteTermo('Esta fonte não está em nenhum termo em vigor. Atualize a página.');
  return achou;
}

/** Liga (ou troca a ligação de) uma fonte de termo. `versao` é a lida na tela (0 = ainda sem ligação). */
export async function salvarLigacao(
  p: Planilhas,
  quem: Autorizador,
  catalogo: CatalogoParcerias,
  dados: { fonteTermoId: string; fonteId: string; contaId: string | null; versao: number },
): Promise<void> {
  exigirEditar(quem);
  await exigirFonteDoCatalogo(catalogo, dados.fonteTermoId);
  const [ligacoes, contas, fontes] = await lerTabelas(p, [FontesTermo, Contas, Fontes] as const);
  if (!fontes.ativos().some((f) => f.id === dados.fonteId)) throw new ErroFonteTermo('Escolha a Fonte do cadastro.');
  if (dados.contaId) {
    const c = contas.ativos().find((x) => x.id === dados.contaId);
    const erro = erroDaConta(c && { id: c.id, classe: c.classe, fonteId: c.fonte_id });
    if (erro) throw new ErroFonteTermo(erro);
  }
  const atual = ligacoes.ativos().find((l) => l.fonte_termo_id === dados.fonteTermoId);
  if (!atual) {
    const r = await inserir(p, FontesTermo, { fonte_termo_id: dados.fonteTermoId, fonte_id: dados.fonteId, conta_id: dados.contaId }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'FontesTermo', registroId: r.id });
    return;
  }
  const r = await atualizar(p, FontesTermo, atual.id, dados.versao, { fonte_id: dados.fonteId, conta_id: dados.contaId }, { email: quem.email });
  if (r.colunasAlteradas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'FontesTermo', registroId: atual.id, detalhes: { colunas: r.colunasAlteradas } });
  }
}

/**
 * Grava de onde vem cada categoria do plano de uma fonte de termo. Só inclui as origens novas e encerra as tiradas.
 * Categoria que não está no plano da fonte (em Parcerias) é ignorada.
 */
export async function salvarOrigensDoPlano(
  p: Planilhas,
  quem: Autorizador,
  catalogo: CatalogoParcerias,
  fonteTermoId: string,
  categorias: { categoria: string; origens: string[] }[],
): Promise<void> {
  exigirEditar(quem);
  const fonte = await exigirFonteDoCatalogo(catalogo, fonteTermoId);
  const [origensT, grupos] = await lerTabelas(p, [CategoriasPlanoOrigens, GruposGasto] as const);
  const gruposAtivos = new Set(grupos.ativos().map((g) => g.id));
  const doPlano = new Set(fonte.categorias.map((c) => c.categoria));
  const incluir: { fonte_termo_id: string; categoria: string; origem: string }[] = [];
  const encerrar: { id: string; versao: number; mudancas: { ativo: boolean } }[] = [];
  for (const { categoria, origens } of categorias) {
    if (!doPlano.has(categoria)) continue;
    const guardadas = origensT.ativos().filter((o) => o.fonte_termo_id === fonteTermoId && o.categoria === categoria);
    const dif = diferencaDeOrigens(guardadas.map((o) => o.origem), origensValidas(origens, gruposAtivos));
    for (const o of dif.incluir) incluir.push({ fonte_termo_id: fonteTermoId, categoria, origem: o });
    for (const o of guardadas.filter((g) => dif.encerrar.includes(g.origem))) encerrar.push({ id: o.id, versao: o.versao, mudancas: { ativo: false } });
  }
  if (!incluir.length && !encerrar.length) return;
  const autoria = { email: quem.email };
  const novas = await inserirRegistros(p, origensT, incluir, autoria);
  await atualizarVarios(p, CategoriasPlanoOrigens, encerrar, autoria);
  for (const r of novas) await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'CategoriasPlanoOrigens', registroId: r.id });
  for (const e of encerrar) await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'CategoriasPlanoOrigens', registroId: e.id, detalhes: { colunas: ['ativo'] } });
}

export { ORIGEM_FOLHA, origemDoGrupo };
