/**
 * Avaliações FICTÍCIAS de Educação para a demonstração: gravadas pelos próprios casos de uso, com pessoas do
 * Cadastro Único fictício que estão no serviço "escola". Algumas concluídas (com e sem ciente) e um rascunho.
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { darCiente, salvarAplicacao } from '../aplicacao/avaliacoes';

const SERVICO = 'escola';
const NOTAS = [
  [3, 2, 3, 2, 3, 2, 3, 3, 2, 3], // 26 · evoluindo adequadamente
  [2, 2, 1, 2, 2, 1, 2, 2, 1, 2], // 17 · parcial
  [1, 0, 1, 1, 2, 1, 1, 0, 1, 1], // 9 · não evoluindo
  [3, 3, 2, 3, 2, 3, 2, 3, 3, 2], // 26
  [2, 1, 2, 1, 1, 2, 2, 1, 2, 1], // 15
] as const;

export async function popularEducacaoFicticia(p: Planilhas): Promise<void> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos, vinculos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos, VinculosServico] as const);
  if (!servicos.ativos().some((s) => s.codigo === SERVICO)) return;
  const diretoria = new Autorizador('diretoria@exemplo.local', {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
  const pessoas = vinculos.ativos().filter((v) => v.servico === SERVICO && !v.saida).map((v) => v.pessoa_id);
  const agora = new Date('2026-11-05T15:00:00Z');
  for (const [i, notas] of NOTAS.entries()) {
    const pessoaId = pessoas[i];
    if (!pessoaId) break;
    const { id, versao } = await salvarAplicacao(
      p,
      diretoria,
      {
        pessoaId,
        instrumento: 'ensino_fundamental',
        servico: SERVICO,
        periodoInicio: '2026-02-01',
        periodoFim: '2026-06-30',
        dataIngresso: '2024-02-05',
        profissional: 'Profissional de exemplo',
        funcao: 'Educador(a)',
        justificativa: 'Enquadramento de exemplo, com dados fictícios.',
        respostas: Object.fromEntries(notas.map((n, k) => [String(k + 1), n])),
      },
      { concluir: true, agora },
    );
    if (i < 2) await darCiente(p, diretoria, id, versao, { agora });
  }
  // Um rascunho, para mostrar a avaliação aberta.
  if (pessoas[NOTAS.length]) {
    await salvarAplicacao(
      p,
      diretoria,
      {
        pessoaId: pessoas[NOTAS.length]!,
        instrumento: 'ensino_fundamental',
        servico: SERVICO,
        periodoInicio: '2026-07-01',
        respostas: { '1': 2, '2': 2, '3': 1 },
      },
      { agora },
    );
  }
}
