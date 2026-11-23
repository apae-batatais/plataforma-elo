/**
 * Ligações entre apps (ADR-022). A plataforma é o único lugar que liga um app a outro:
 * cada app oferece uma função de leitura (visão de ligação) e esta composição a entrega à tela.
 *
 * Regras: app desligado vira `indisponivel`; leitura que falha vira `erro` só naquele bloco
 * (a tela não cai); a permissão é conferida pelo app dono do dado.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { contarAtendidos } from '@/nucleo/pessoas/contagem';
import { Servicos, type RegServico } from '@/nucleo/estrutura/tabelas';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import type { Ligacao, LigacaoLida } from '@/nucleo/ligacoes/ligacao';
import { avaliacaoDoServico, indicadoresDoServico, type AvaliacaoDoServico } from '@/modulos/avaliacao';
import { criarRascunhoDeTermo, listarRascunhos, termoParaProjeto, termosParaOrcamento, type NumerosDePessoas, type RascunhoDeTermo } from '@/modulos/parcerias';
import { publicacoesDoServico, type PublicacoesDoServico } from '@/modulos/comunicacao';
import { custoDoServico, encerrarReceitaDoProjeto, fontesParaEvento, registrarReceitaDoProjeto, resultadoDoProjeto, saldoParaConferencia, type CatalogoParcerias, type CustoDoServico, type ProjetoParaRealizado as ProjetoDoRealizado, type ResultadoDoProjeto, type SaldoParaConferencia } from '@/modulos/orcamento';
import { projetosComTermoParadosOuCancelados, type CatalogoReceitas, projetosDoServico, projetosParaCompra, projetosParaRealizado, type CatalogoLeitura, type CatalogoTermos, type ProjetosDoServico } from '@/modulos/projetos';
import { comprasDoProjeto, requisicoesDoServico, type ProjetoEscolhivel, type RequisicoesDoServico } from '@/modulos/requisicoes';
import { MODULOS } from './registro-modulos';

export type { Ligacao, LigacaoLida } from '@/nucleo/ligacoes/ligacao';

export const PERMISSAO_FICHA = 'plataforma.servicos.ver';

/** Serviços cuja Ficha a pessoa pode abrir (escopo de `plataforma.servicos.ver`). */
export function servicosVisiveis(servicos: readonly RegServico[], quem: Autorizador): RegServico[] {
  return servicos.filter((s) => s.ativo && quem.temPermissao(PERMISSAO_FICHA, { tipo: 'servico', codigo: s.codigo }));
}

/**
 * Lê uma ligação de um app. `desligados` (ids de módulo) simula app não ativo na instituição.
 * Falha de leitura vira `erro`, nunca exceção.
 */
export async function lerLigacao<T>(
  appId: string,
  ler: () => Promise<Ligacao<T>>,
  opcoes: { desligados?: ReadonlySet<string> } = {},
): Promise<LigacaoLida<T>> {
  if (opcoes.desligados?.has(appId) || !MODULOS.some((m) => m.id === appId)) return { estado: 'indisponivel' };
  try {
    return await ler();
  } catch {
    return { estado: 'erro' };
  }
}

export interface Vagas {
  vagas: number | null;
  /** Pessoas com vínculo ativo hoje: só a quantidade. */
  ocupadas: number;
}

export interface FichaDoServico {
  servico: RegServico;
  area: string | null;
  encerradoEm: string | null;
  hoje: string;
  vagas: Vagas;
  custo: LigacaoLida<CustoDoServico>;
  projetos: LigacaoLida<ProjetosDoServico>;
  requisicoes: LigacaoLida<RequisicoesDoServico>;
  publicacoes: LigacaoLida<PublicacoesDoServico>;
  avaliacao: LigacaoLida<AvaliacaoDoServico>;
}

/**
 * Monta a Ficha de um serviço. Devolve `null` se a pessoa não pode abri-la (a rota responde "não encontrada").
 * Cada bloco vem de um app, com a permissão dele; nada é guardado.
 */
export async function fichaDoServico(
  p: Planilhas,
  quem: Autorizador,
  codigo: string,
  opcoes: { agora?: Date; desligados?: ReadonlySet<string> } = {},
): Promise<FichaDoServico | null> {
  const agora = opcoes.agora ?? new Date();
  const servico = (await lerTabela(p, Servicos)).todos().find((s) => s.codigo === codigo);
  if (!servico || !servico.ativo || !quem.temPermissao(PERMISSAO_FICHA, { tipo: 'servico', codigo })) return null;
  const hoje = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília
  const comApp = { desligados: opcoes.desligados };
  const [ocupadas, custo, projetos, requisicoes, publicacoes, avaliacao] = await Promise.all([
    contarAtendidos(p, [codigo], [hoje.slice(0, 7)], hoje).then((m) => m.get(codigo)?.get(hoje.slice(0, 7)) ?? 0),
    lerLigacao('orcamento', () => custoDoServico(p, quem, codigo, { ano: Number(hoje.slice(0, 4)) }), comApp),
    lerLigacao('projetos', () => projetosDoServico(p, quem, codigo), comApp),
    lerLigacao('requisicoes', () => requisicoesDoServico(p, quem, codigo, { agora }), comApp),
    lerLigacao('comunicacao', () => publicacoesDoServico(p, quem, codigo, { agora }), comApp),
    lerLigacao('avaliacao', () => avaliacaoDoServico(p, quem, codigo, { agora }), comApp),
  ]);
  return {
    servico,
    area: servico.area,
    encerradoEm: servico.fim && servico.fim < hoje ? servico.fim : null,
    hoje,
    vagas: { vagas: servico.vagas, ocupadas },
    custo,
    projetos,
    requisicoes,
    publicacoes,
    avaliacao,
  };
}

/**
 * Números de pessoas (índice de cuidado e reavaliação em dia) entregues a Parcerias, que não importa a Avaliação
 * (ADR-023). Avaliação desligada devolve `null` e a meta mostra "Ligação indisponível".
 */
export function numerosDePessoas(p: Planilhas, opcoes: { desligados?: ReadonlySet<string>; agora?: Date } = {}): NumerosDePessoas {
  return {
    async indicadoresDoServico(servico) {
      if (opcoes.desligados?.has('avaliacao') || !MODULOS.some((m) => m.id === 'avaliacao')) return null;
      return indicadoresDoServico(p, servico, { agora: opcoes.agora });
    },
  };
}

/**
 * Termos de Parcerias entregues ao painel de sustentabilidade do Orçamento (ADR-022). Só números e nomes de
 * parceiros; nenhum dado pessoal. Parcerias desligado devolve `null` e o painel mostra só o custo.
 */
export function catalogoDeParcerias(p: Planilhas, opcoes: { desligados?: ReadonlySet<string>; agora?: Date } = {}): CatalogoParcerias | null {
  if (opcoes.desligados?.has('parcerias') || !MODULOS.some((m) => m.id === 'parcerias')) return null;
  return {
    async termos() {
      return (await termosParaOrcamento(p, opcoes.agora)).map((t) => ({
        id: t.id,
        parceiro: t.parceiro,
        numero: t.numero,
        tipo: t.tipo,
        inicio: t.inicio,
        fim: t.fim,
        unidadePessoa: t.unidadePessoa,
        parcelas: t.fontes.flatMap((f) => [...f.parcelas, ...f.aportesParcelas]),
        servicos: t.vagasPorServico.map((v) => ({ servico: v.servico, vagasCusteadas: v.vagasCusteadas })),
      }));
    },
  };
}

type Desligados = { desligados?: ReadonlySet<string> };

/**
 * Projetos que a pessoa pode escolher numa requisição (L2): os que ela vê e que estão em implementação.
 * `null` = Projetos desligado, sem permissão ou falha: a requisição funciona sem o campo (G2).
 * O servidor chama esta função de novo ao gravar; a lista da tela não vale como prova.
 */
export async function projetosParaRequisicao(p: Planilhas, quem: Autorizador, opcoes: Desligados = {}): Promise<ProjetoEscolhivel[] | null> {
  const lida = await lerLigacao('projetos', () => projetosParaCompra(p, quem), opcoes);
  return lida.estado === 'ok' ? lida.dados : null;
}

/**
 * Projetos que a pessoa pode marcar numa linha do realizado (L18): os que ela vê e que já gastam ou recebem.
 * `null` = Projetos desligado, sem permissão ou falha: o campo some e o realizado funciona sem ele.
 * O servidor chama esta função de novo ao gravar; a lista da tela não vale como prova.
 */
export async function projetosParaRealizadoDoOrcamento(p: Planilhas, quem: Autorizador, opcoes: Desligados = {}): Promise<ProjetoDoRealizado[] | null> {
  const lida = await lerLigacao('projetos', () => projetosParaRealizado(p, quem), opcoes);
  return lida.estado === 'ok' ? lida.dados : null;
}

/** Resultado realizado de um projeto (L18), lido do Orçamento com a permissão dele. O Projetos já conferiu que a pessoa vê o projeto. */
export function resultadoDoProjetoLido(p: Planilhas, quem: Autorizador, projetoId: string, opcoes: Desligados = {}): Promise<LigacaoLida<ResultadoDoProjeto>> {
  return lerLigacao('orcamento', () => resultadoDoProjeto(p, quem, projetoId), opcoes);
}

export interface ConferenciaDoCentro {
  servico: string;
  saldo: LigacaoLida<SaldoParaConferencia>;
}

/** Saldo do orçamento de cada centro de custo, para quem aprova (L2). Só aviso: nunca bloqueia a aprovação. */
export async function conferenciaDosCentros(
  p: Planilhas,
  quem: Autorizador,
  servicos: readonly string[],
  grupoId: string | null,
  opcoes: Desligados & { ano?: number } = {},
): Promise<ConferenciaDoCentro[]> {
  return Promise.all(
    servicos.map(async (servico) => ({
      servico,
      saldo: await lerLigacao('orcamento', () => saldoParaConferencia(p, quem, servico, { grupoId, ano: opcoes.ano }), opcoes),
    })),
  );
}

/** Confere o grupo de gasto escolhido por quem aprova contra o cadastro do Orçamento (nome copiado). */
export async function grupoDeGastoConferido(
  p: Planilhas,
  quem: Autorizador,
  servicos: readonly string[],
  grupoId: string,
  opcoes: Desligados = {},
): Promise<{ id: string; nome: string } | null> {
  for (const c of await conferenciaDosCentros(p, quem, servicos.slice(0, 1), grupoId, opcoes)) {
    if (c.saldo.estado === 'ok') {
      const g = c.saldo.dados.grupos.find((x) => x.id === grupoId);
      if (g) return g;
    }
  }
  return null;
}

/**
 * Parcerias visto pelo Projetos (ADR-023): cria o rascunho do termo e lê o termo ligado. Parcerias desligado
 * devolve `null` e o projeto mostra "Ligação indisponível". Um módulo nunca importa o outro: só esta composição.
 */
export function catalogoDeTermos(p: Planilhas, opcoes: Desligados = {}): CatalogoTermos | null {
  if (opcoes.desligados?.has('parcerias') || !MODULOS.some((m) => m.id === 'parcerias')) return null;
  return {
    criarRascunhoDeTermo: (quem, pedido, agora) => criarRascunhoDeTermo(p, quem, pedido, agora),
    termoParaProjeto: (quem, termoId, agora) => termoParaProjeto(p, quem, termoId, agora),
  };
}

/**
 * Rascunhos de termo para o Financeiro completar (regra L11): Parcerias não importa Projetos, então a
 * composição informa quais projetos de origem foram cancelados ou parados.
 */
export async function rascunhosDeTermo(p: Planilhas, quem: Autorizador, opcoes: Desligados = {}): Promise<RascunhoDeTermo[]> {
  const comProblema = opcoes.desligados?.has('projetos') || !MODULOS.some((m) => m.id === 'projetos') ? new Set<string>() : await projetosComTermoParadosOuCancelados(p).catch(() => new Set<string>());
  return listarRascunhos(p, quem, comProblema);
}

/**
 * Catálogo de leitura do Projetos (regra 26): compras ligadas ao projeto, vindas de Requisições. Os leitores dos
 * demais apps entram nas entregas de ligação de cada onda; até lá a aba mostra "Ligação indisponível".
 * O Projetos confere que a pessoa vê o projeto antes de chamar.
 */
export function catalogoDeLeitura(p: Planilhas, opcoes: Desligados = {}): CatalogoLeitura {
  return {
    leitores: {},
    async compras(quem, projetoId) {
      const lida = await lerLigacao('requisicoes', () => comprasDoProjeto(p, quem, projetoId), opcoes);
      if (lida.estado !== 'ok') return lida;
      return { estado: 'ok', dados: lida.dados.map((c) => ({ id: c.id, numero: c.numero, tipo: c.tipo, situacaoNome: c.situacaoNome, enviadaEm: c.enviadaEm })) };
    },
  };
}

/**
 * Orçamento visto pelo Projetos (L17): fontes próprias, receita "A captar" do evento e seu encerramento.
 * Orçamento desligado devolve `null`: o evento funciona e a ligação com a receita fica pendente e visível.
 */
export function catalogoDeReceitas(p: Planilhas, opcoes: Desligados = {}): CatalogoReceitas | null {
  if (opcoes.desligados?.has('orcamento') || !MODULOS.some((m) => m.id === 'orcamento')) return null;
  return {
    async fontesProprias(quem) {
      const lida = await fontesParaEvento(p, quem);
      return lida.estado === 'ok' ? lida.dados : null;
    },
    registrarReceita: (quem, pedido) => registrarReceitaDoProjeto(p, quem, pedido),
    encerrarReceita: (quem, projetoId) => encerrarReceitaDoProjeto(p, quem, projetoId),
  };
}
