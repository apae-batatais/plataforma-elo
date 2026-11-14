/**
 * Visão de ligação de Projetos (ADR-022): os projetos de um serviço, para a Ficha do serviço.
 * Cada pessoa recebe só os projetos que já vê em Projetos (mesma regra de "quem vê o quê").
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import { Projetos } from '../dados/tabelas';
import { aceitaCompra, NOME_ETAPA, type Etapa } from '../dominio/projeto';
import { lerConfig, podeVerProjeto } from './comum';

export interface ProjetoDoServico {
  id: string;
  codigo: string;
  titulo: string;
  etapa: Etapa;
  etapaNome: string;
}

export interface ProjetosDoServico {
  projetos: ProjetoDoServico[];
  /** Quantidade de projetos por etapa (só das etapas que têm algum). */
  porEtapa: { etapa: Etapa; nome: string; quantidade: number }[];
  /** Quem pode cadastrar uma ideia (para o atalho do bloco vazio). */
  podePropor: boolean;
}

export async function projetosDoServico(p: Planilhas, quem: Autorizador, servico: string): Promise<Ligacao<ProjetosDoServico>> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) return ligacaoSemPermissao();
  const [projetos, config] = await Promise.all([lerTabela(p, Projetos), lerConfig(p)]);
  const lista = projetos
    .ativos()
    .filter((r) => r.servico === servico && podeVerProjeto(quem, r, config))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, etapa: r.etapa, etapaNome: NOME_ETAPA[r.etapa] }));
  const contagem = new Map<Etapa, number>();
  for (const r of lista) contagem.set(r.etapa, (contagem.get(r.etapa) ?? 0) + 1);
  const porEtapa = [...contagem].map(([etapa, quantidade]) => ({ etapa, nome: NOME_ETAPA[etapa], quantidade }));
  return ligacaoOk({ projetos: lista, porEtapa, podePropor: quem.temPermissaoAlgumEscopo('projetos.propor') });
}

/** O que a requisição precisa saber de um projeto para ligar uma compra a ele (ADR-022). */
export interface ProjetoParaCompra {
  id: string;
  codigo: string;
  titulo: string;
  /** Serviço do projeto (código); quando existe, a requisição fica nele a 100%. */
  servico: string | null;
  /** Atividades ainda não concluídas nem canceladas (opcionais na requisição). */
  atividades: { id: string; descricao: string }[];
}

/** Projetos que a pessoa vê e que aceitam compra (em implementação). */
export async function projetosParaCompra(p: Planilhas, quem: Autorizador): Promise<Ligacao<ProjetoParaCompra[]>> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) return ligacaoSemPermissao();
  const [projetos, config] = await Promise.all([lerTabela(p, Projetos), lerConfig(p)]);
  return ligacaoOk(
    projetos
      .ativos()
      .filter((r) => aceitaCompra(r.etapa) && podeVerProjeto(quem, r, config))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      // As atividades do projeto chegam com a entrega P3; até lá a lista é vazia.
      .map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, servico: r.servico, atividades: [] })),
  );
}
