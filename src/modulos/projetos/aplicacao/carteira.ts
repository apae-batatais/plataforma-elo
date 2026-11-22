/**
 * Carteira (entrega P6): números que pedem ação, antes da lista. Não cria aba: lê Projetos, Portas, Problemas e
 * o que P4 e P5 já calculam. Regras 21, 25 e 28; regra de borda 6 (números contam só projetos que a pessoa vê).
 * Nunca devolve texto de parecer.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Portas, Problemas, Projetos, type RegProjeto } from '../dados/tabelas';
import { problemaAberto } from '../dominio/acompanhamento';
import { encerramentoAtrasado } from '../dominio/encerramento';
import { hojeEmBrasilia } from '../dominio/planejamento';
import { NOME_PORTA, type Etapa } from '../dominio/projeto';
import { motivosForaDaTolerancia } from './acompanhamento';
import { equipesAtivas, lerConfig, podeVerProjeto, type Opcoes } from './comum';

export const VISOES_CARTEIRA = ['andamento', 'portas', 'fora', 'problemas', 'atrasados'] as const;
export type VisaoCarteira = (typeof VISOES_CARTEIRA)[number];

export const ETAPAS_EM_ANDAMENTO: ReadonlySet<Etapa> = new Set<Etapa>(['em_porta', 'fase_1', 'fase_2', 'fase_3', 'implementacao', 'encerramento']);

export interface LinhaCarteira {
  id: string;
  codigo: string;
  titulo: string;
  etapa: Etapa;
  responsavel: string | null;
  /** Por que o projeto está nesta visão, em palavras. */
  motivos: string[];
}

export interface Carteira {
  numeros: Record<VisaoCarteira, number>;
  listas: Record<VisaoCarteira, LinhaCarteira[]>;
}

/**
 * Quem tem `projetos.carteira` (global) vê todos os projetos que já saíram do rascunho; os demais, só os que já
 * podiam ver. Quem não tem a permissão não acessa a carteira.
 */
export async function lerCarteira(p: Planilhas, quem: Autorizador, opcoes: Opcoes = {}): Promise<Carteira> {
  if (!quem.temPermissaoAlgumEscopo('projetos.carteira')) throw new ErroPermissao();
  const hoje = hojeEmBrasilia(opcoes.agora ?? new Date());
  const global = quem.temPermissao('projetos.carteira');
  const [config, equipes, [projetos, portas, problemas]] = await Promise.all([lerConfig(p), equipesAtivas(p), lerTabelas(p, [Projetos, Portas, Problemas] as const)]);
  const visiveis = projetos.ativos().filter((r) => podeVerProjeto(quem, r, config, equipes.get(r.id)) || (global && r.etapa !== 'rascunho'));
  const linha = (r: RegProjeto, motivos: string[]): LinhaCarteira => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, etapa: r.etapa, responsavel: r.responsavel, motivos });
  const listas: Record<VisaoCarteira, LinhaCarteira[]> = { andamento: [], portas: [], fora: [], problemas: [], atrasados: [] };
  for (const r of visiveis.sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    if (ETAPAS_EM_ANDAMENTO.has(r.etapa)) listas.andamento.push(linha(r, []));
    const abertas = portas.ativos().filter((x) => x.projeto_id === r.id && x.situacao !== 'decidida');
    if (abertas.length > 0) listas.portas.push(linha(r, abertas.map((x) => `${NOME_PORTA[x.tipo]}: ${x.situacao === 'aguardando_alcada' ? 'espera a Presidência ou o Conselho' : 'espera decisão'}`)));
    const fora = await motivosForaDaTolerancia(p, r, hoje);
    if (fora.length > 0) listas.fora.push(linha(r, fora));
    const altos = problemas.ativos().filter((x) => x.projeto_id === r.id && problemaAberto(x) && x.gravidade === 'alto');
    if (altos.length > 0) listas.problemas.push(linha(r, altos.map((x) => x.descricao)));
    const atraso = encerramentoAtrasado(r, hoje);
    if (atraso) listas.atrasados.push(linha(r, [atraso]));
  }
  const numeros = Object.fromEntries(VISOES_CARTEIRA.map((v) => [v, listas[v].length])) as Record<VisaoCarteira, number>;
  return { numeros, listas };
}
