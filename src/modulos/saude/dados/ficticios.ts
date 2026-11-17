/**
 * Avaliações FICTÍCIAS da demonstração: as pessoas inventadas do serviço de reabilitação de exemplo,
 * umas com avaliação fechada (e uma delas com o ciente da coordenação), outra com a avaliação aberta
 * e outra sem nenhuma. Gravadas pelos próprios casos de uso. Respostas fixas: a demonstração mostra
 * sempre os mesmos números.
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { Aplicacoes } from './tabelas';
import { darCiente, salvarAplicacao, type DadosAplicacao } from '../aplicacao/avaliacoes';

const SERVICO = 'cer_reabilitacao';

/** Respostas dos itens 1 a 10, uma linha por pessoa. */
const PADROES: readonly (readonly number[])[] = [
  [3, 2, 2, 3, 3, 3, 3, 2, 3, 2], // 26: evoluindo adequadamente
  [2, 2, 1, 2, 2, 2, 2, 1, 2, 1], // 17: evolução parcial
  [1, 1, 1, 2, 1, 1, 1, 2, 1, 0], // 11: no limite de baixo da faixa parcial
  [0, 1, 0, 1, 1, 1, 0, 1, 1, 1], // 7: não evoluindo
  [3, 3, 2, 2, 2, 3, 3, 3, 2, 3], // 26
  [2, 1, 2, 1, 2, 1, 1, 2, 1, 2], // 15
];

export async function popularSaudeFicticia(p: Planilhas): Promise<void> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos, vinculos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos, VinculosServico] as const);
  if (!servicos.ativos().some((s) => s.codigo === SERVICO)) return;
  const quem = (email: string) =>
    new Autorizador(email, {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    });
  const diretoria = quem('diretoria@exemplo.local');
  const pessoas = vinculos
    .ativos()
    .filter((v) => v.servico === SERVICO && !v.saida)
    .map((v) => ({ id: v.pessoa_id, entrada: v.entrada ?? '2026-01-15' }))
    .slice(0, PADROES.length);

  for (const [i, pessoa] of pessoas.entries()) {
    const aberta = i === pessoas.length - 1 && pessoas.length > 3;
    const semAvaliacao = i === pessoas.length - 2 && pessoas.length > 4;
    if (semAvaliacao) continue;
    const dados: DadosAplicacao = {
      pessoaId: pessoa.id,
      servico: SERVICO,
      periodoInicio: '2026-07-01',
      periodoFim: '2026-09-30',
      dataIngresso: pessoa.entrada > '2026-09-30' ? '2026-01-15' : pessoa.entrada,
      profissional: 'Fisioterapeuta (fictícia)',
      funcao: 'Fisioterapia',
      justificativa: aberta ? '' : 'Enquadramento conforme a pontuação do período (dado fictício).',
      respostas: Object.fromEntries(PADROES[i]!.map((v, k) => [k + 1, v])),
    };
    const r = await salvarAplicacao(p, diretoria, dados, { concluir: !aberta, agora: new Date('2026-10-05T15:00:00Z') });
    if (i === 0) {
      const [aplicacoes] = await lerTabelas(p, [Aplicacoes] as const);
      await darCiente(p, diretoria, r.id, aplicacoes.porId(r.id)!.versao, { agora: new Date('2026-10-06T15:00:00Z') });
    }
  }
}
