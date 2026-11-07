/**
 * Grupos de gasto e fontes de recurso em lote, com dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { analisarCadastrosEmLote, cadastrarEmLote } from '../aplicacao/cadastros-em-lote';
import { excluirGrupo, salvarGrupo } from '../aplicacao/previsao';
import { Fontes, GruposGasto, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

describe('grupos de gasto em lote', () => {
  it('lê a lista colada (tabulação ou ponto e vírgula), pula cabeçalho, já existentes e repetidos, e cadastra só os prontos', async () => {
    const fin = await como('financeiro@exemplo.local');
    await salvarGrupo(p, fin, { nome: 'Alimentação', rh: false });
    await salvarGrupo(p, fin, { nome: 'Combustível', rh: false });
    const combustivel = (await lerTabela(p, GruposGasto)).ativos().find((g) => g.nome === 'Combustível')!;
    await excluirGrupo(p, fin, combustivel.id, combustivel.versao);

    const lista = 'Nome\tTipo\nMaterial de consumo\nRPA\tRH\nalimentacao\ncombustível\nMaterial de Consumo\nBolsas;talvez';
    const linhas = await analisarCadastrosEmLote(p, fin, 'grupo', lista);
    expect(linhas.map((l) => [l.nome, l.situacao])).toEqual([
      ['Material de consumo', 'ok'],
      ['RPA', 'ok'],
      ['alimentacao', 'ja_existe'],
      ['combustível', 'ja_existe'],
      ['Material de Consumo', 'ja_existe'],
      ['Bolsas', 'erro'],
    ]);
    expect(linhas[3].problema).toMatch(/excluídos/);
    expect(linhas.find((l) => l.nome === 'RPA')?.rh).toBe(true);

    expect(await cadastrarEmLote(p, fin, 'grupo', linhas)).toBe(2);
    const grupos = (await lerTabela(p, GruposGasto)).ativos();
    expect(grupos.map((g) => [g.nome, g.rh]).sort()).toEqual([
      ['Alimentação', false],
      ['Material de consumo', false],
      ['RPA', true],
    ]);
    // Confirmar de novo a mesma lista não duplica.
    await expect(cadastrarEmLote(p, fin, 'grupo', linhas)).rejects.toThrow(/Nenhum item pronto/);
  });
});

describe('fontes de recurso em lote', () => {
  it('exige natureza e uso reconhecidos; grava com auditoria só da quantidade', async () => {
    const fin = await como('financeiro@exemplo.local');
    const linhas = await analisarCadastrosEmLote(
      p,
      fin,
      'fonte',
      'Subvenção municipal\tpública\trestrito\nDoações;Própria;Livre\nBazar\tprópria\nConvênio estadual\testadual\tlivre',
    );
    expect(linhas.map((l) => [l.nome, l.situacao, l.natureza ?? null, l.uso ?? null])).toEqual([
      ['Subvenção municipal', 'ok', 'publica', 'restrita'],
      ['Doações', 'ok', 'propria', 'livre'],
      ['Bazar', 'erro', null, null],
      ['Convênio estadual', 'erro', null, null],
    ]);
    expect(await cadastrarEmLote(p, fin, 'fonte', linhas)).toBe(2);
    expect((await lerTabela(p, Fontes)).ativos().map((f) => f.nome).sort()).toEqual(['Doações', 'Subvenção municipal']);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Fontes');
    expect(auditoria.at(-1)?.detalhes).toBe('{"emLote":2}');
  });

  it('só quem pode editar a previsão cadastra em lote', async () => {
    const leitura = await como('leitura@exemplo.local');
    await expect(analisarCadastrosEmLote(p, leitura, 'fonte', 'X;pública;livre')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(cadastrarEmLote(p, leitura, 'grupo', [])).rejects.toBeInstanceOf(ErroPermissao);
  });
});
