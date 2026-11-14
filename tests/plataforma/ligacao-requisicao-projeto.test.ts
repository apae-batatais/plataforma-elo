/**
 * Composição da plataforma para a requisição (L2): lista de projetos, conferência do saldo e grupo.
 * Nenhum módulo importa outro; quem liga é `src/plataforma/ligacoes.ts`. Dados FICTÍCIOS.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { conferenciaDosCentros, grupoDeGastoConferido, projetosParaRequisicao } from '@/plataforma/ligacoes';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

let p: Planilhas;

async function como(email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

describe('projetos para a requisição', () => {
  it('só projeto em implementação entra; hoje nenhum está (etapa chega com Projetos P2 a P4)', async () => {
    expect(await projetosParaRequisicao(p, await como('diretoria@exemplo.local'))).toEqual([]);
  });

  it('com Projetos desligado, a lista é nula e a requisição funciona sem o campo; sem permissão também', async () => {
    expect(await projetosParaRequisicao(p, await como('diretoria@exemplo.local'), { desligados: new Set(['projetos']) })).toBeNull();
    expect(await projetosParaRequisicao(p, await como('compras@exemplo.local'))).toBeNull();
  });
});

describe('conferência do orçamento', () => {
  it('orçamento desligado vira "indisponível"; sem permissão não traz valor', async () => {
    const off = await conferenciaDosCentros(p, await como('diretoria@exemplo.local'), ['escola'], null, { desligados: new Set(['orcamento']) });
    expect(off[0].saldo).toEqual({ estado: 'indisponivel' });
    const sem = await conferenciaDosCentros(p, await como('coord.ur@exemplo.local'), ['escola'], null);
    expect(sem[0].saldo).toEqual({ estado: 'sem_permissao' });
    expect(JSON.stringify(sem)).not.toMatch(/previsto/);
  });

  it('grupo de gasto só vale se existir no cadastro do Orçamento', async () => {
    expect(await grupoDeGastoConferido(p, await como('financeiro@exemplo.local'), ['escola'], 'nao-existe')).toBeNull();
  });
});
