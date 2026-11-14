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
import type { NumerosDePessoas } from '@/modulos/parcerias';
import { publicacoesDoServico, type PublicacoesDoServico } from '@/modulos/comunicacao';
import { custoDoServico, type CustoDoServico } from '@/modulos/orcamento';
import { projetosDoServico, type ProjetosDoServico } from '@/modulos/projetos';
import { requisicoesDoServico, type RequisicoesDoServico } from '@/modulos/requisicoes';
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
