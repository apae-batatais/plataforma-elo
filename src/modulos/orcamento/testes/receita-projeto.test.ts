/**
 * Receita "A captar" vinda de um projeto (ligações onda 2, L17 e L21). Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { cancelarItem, abrirExercicio, salvarReceita } from '../aplicacao/previsao';
import { encerrarReceitaDoProjeto, fontesParaEvento, registrarReceitaDoProjeto } from '../aplicacao/receita-projeto';
import { Fontes, PLANILHA_EXECUCAO, Receitas, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;
let propria: string;
let publica: string;
const QUEM = { email: 'diretoria@exemplo.local' };
const pedido = (extra = {}) => ({ projetoId: 'prj-1', projetoCodigo: 'PRJ-0001', titulo: 'Evento de teste', fonteId: propria, valor: 8000, dataEvento: '2027-06-12', ...extra });

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: [...Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))), { perfil: 'coordenacao_servico', permissao: 'projetos.propor' }],
  });
  await popularDadosFicticios(p);
  const [fontes] = await lerTabelas(p, [Fontes] as const);
  const [a, b] = await inserirRegistros(p, fontes, [{ nome: 'Receitas do evento (teste)', natureza: 'propria', uso: 'livre' }, { nome: 'Termo (teste)', natureza: 'publica', uso: 'restrita' }], { email: 'teste' });
  propria = a.id;
  publica = b.id;
  await abrirExercicio(p, await como('financeiro@exemplo.local'), 2027);
});

describe('L17: receita "A captar" do projeto', () => {
  it('cria o item na fonte própria, no mês do evento, com a origem do projeto', async () => {
    const r = await registrarReceitaDoProjeto(p, QUEM, pedido());
    expect(r.criada).toBe(true);
    const item = (await lerTabela(p, Receitas)).porId(r.receitaId)!;
    expect(item).toMatchObject({ ano: 2027, fonte_id: propria, valor: 8000, captacao: 'a_captar', projeto_id: 'prj-1', projeto_codigo: 'PRJ-0001', m6: 8000, m1: 0 });
  });

  it('é idempotente: repetir não duplica; valor novo troca sem apagar', async () => {
    const a = await registrarReceitaDoProjeto(p, QUEM, pedido());
    const b = await registrarReceitaDoProjeto(p, QUEM, pedido());
    expect(b).toEqual({ receitaId: a.receitaId, criada: false });
    await registrarReceitaDoProjeto(p, QUEM, pedido({ valor: 9000 }));
    const todos = (await lerTabela(p, Receitas)).todos().filter((r) => r.projeto_id === 'prj-1');
    expect(todos).toHaveLength(1);
    expect(todos[0].valor).toBe(9000);
  });

  it('só aceita fonte própria e exercício em elaboração', async () => {
    await expect(registrarReceitaDoProjeto(p, QUEM, pedido({ fonteId: publica }))).rejects.toThrow(/fonte de recurso própria/);
    await expect(registrarReceitaDoProjeto(p, QUEM, pedido({ dataEvento: '2031-01-10' }))).rejects.toThrow(/Abra o exercício 2031/);
    await expect(registrarReceitaDoProjeto(p, QUEM, pedido({ valor: 0 }))).rejects.toThrow(/maior que zero/);
    await expect(registrarReceitaDoProjeto(p, QUEM, pedido({ dataEvento: '' }))).rejects.toThrow(/data/);
  });

  it('encerrar tira o item do orçamento sem apagar; sem item devolve falso', async () => {
    expect(await encerrarReceitaDoProjeto(p, QUEM, 'prj-1')).toBe(false);
    const r = await registrarReceitaDoProjeto(p, QUEM, pedido());
    expect(await encerrarReceitaDoProjeto(p, QUEM, 'prj-1')).toBe(true);
    expect((await lerTabela(p, Receitas)).porId(r.receitaId)!.ativo).toBe(false);
  });

  it('só o projeto altera ou cancela o item: o Financeiro é recusado', async () => {
    const r = await registrarReceitaDoProjeto(p, QUEM, pedido());
    const f = await como('financeiro@exemplo.local');
    const item = (await lerTabela(p, Receitas)).porId(r.receitaId)!;
    await expect(salvarReceita(p, f, { ano: 2027, fonte_id: propria, descricao: 'x', valor: 1, captacao: 'garantida', distribuicao: 'igual' }, { id: item.id, versao: item.versao })).rejects.toThrow(/vem de um projeto/);
    await expect(cancelarItem(p, f, 'receita', item.id, item.versao)).rejects.toThrow(/vem de um projeto/);
  });

  it('a auditoria guarda só as colunas, nunca os valores', async () => {
    await registrarReceitaDoProjeto(p, QUEM, pedido({ valor: 7777 }));
    const registros = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Receitas');
    expect(registros.length).toBeGreaterThan(0);
    expect(JSON.stringify(registros)).not.toContain('7777');
  });
});

describe('Fontes oferecidas ao evento', () => {
  it('lista só as próprias, para quem vê o painel e para quem propõe projeto; os demais são recusados', async () => {
    for (const email of ['financeiro@exemplo.local', 'coord.ur@exemplo.local']) {
      const l = await fontesParaEvento(p, await como(email));
      expect(l.estado === 'ok' ? l.dados.map((f) => f.id) : null, email).toEqual([propria]);
    }
    expect((await fontesParaEvento(p, await como('dp@exemplo.local'))).estado).toBe('sem_permissao');
  });
});
