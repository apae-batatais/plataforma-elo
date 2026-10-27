/**
 * Casos de uso do Cadastro Único de Pessoas (camada de aplicação).
 * Toda leitura passa pelo Autorizador; toda gravação é auditada.
 */
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { Papeis, Pessoas, Servicos, VinculosFamiliares, VinculosServico } from '@/nucleo/estrutura/tabelas';

export interface PessoaNaLista {
  id: string;
  nome: string;
  papeis: string[];
  servicos: string[];
}

export async function listarPessoasVisiveis(p: Planilhas, quem: Autorizador): Promise<PessoaNaLista[]> {
  const [pessoas, papeis, vinculosServico, vinculosFamiliares, servicos] = await lerTabelas(p, [
    Pessoas,
    Papeis,
    VinculosServico,
    VinculosFamiliares,
    Servicos,
  ] as const);
  const dados = {
    pessoas: pessoas.ativos(),
    vinculosServico: vinculosServico.ativos(),
    vinculosFamiliares: vinculosFamiliares.ativos(),
  };
  const nomeServico = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));

  return dados.pessoas
    .filter((pessoa) => quem.podeVerPessoa(pessoa.id, dados))
    .map((pessoa) => ({
      id: pessoa.id,
      nome: pessoa.nome_social ?? pessoa.nome,
      papeis: papeis
        .ativos()
        .filter((x) => x.pessoa_id === pessoa.id && !x.fim)
        .map((x) => x.papel)
        .sort(),
      servicos: dados.vinculosServico
        .filter((v) => v.pessoa_id === pessoa.id && !v.saida)
        .map((v) => nomeServico.get(v.servico) ?? v.servico)
        .sort(),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
