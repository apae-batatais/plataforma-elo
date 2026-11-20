import type { ReactNode } from 'react';
import type { DefinicaoTabela } from '@/nucleo/armazenamento/tabela';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { EstadoVazio } from '@/ui/pagina';
import type { z } from 'zod';
import { ConfiguracaoInvalida } from '../configuracao-invalida';

/**
 * Confere se as abas existem na planilha antes de mostrar a tela. Quem administra vê o que fazer (Preparar
 * estrutura); as demais pessoas só veem um aviso simples.
 */
export async function ExigirAbas({
  tabelas,
  nome,
  administra,
  children,
}: {
  tabelas: readonly DefinicaoTabela<z.ZodObject>[];
  nome: string;
  administra: boolean;
  children: ReactNode;
}) {
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, tabelas);
  } catch (erro) {
    const simples = (
      <section className="mx-auto max-w-2xl py-8">
        <EstadoVazio titulo={`${nome} ainda não está disponível`}>Fale com a administração da sua instituição.</EstadoVazio>
      </section>
    );
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      if (!administra) return simples;
      return (
        <ConfiguracaoInvalida
          titulo={`Falta preparar as abas de ${nome}`}
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      if (!administra) return simples;
      return (
        <ConfiguracaoInvalida
          titulo={`${nome} ainda não tem planilha`}
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição, compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Orçamento — execução e tesouraria).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
