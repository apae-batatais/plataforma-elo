/**
 * Ligações L2: requisição ligada a projeto, valor estimado e grupo (quem aprova), valor gasto (quem atende).
 * Dados FICTÍCIOS; o app Projetos é simulado por uma lista, porque Requisições não o importa (ADR-022).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  comprasDoProjeto,
  concluirRequisicao,
  corrigirValorGasto,
  decidirRequisicao,
  enviarRequisicao,
  ErroRequisicao,
  receberRequisicao,
  reenviarRequisicao,
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { Requisicoes, TABELAS_REQUISICOES, TiposRequisicao } from '../dados/tabelas';
import { conferirProjeto, conferirValor, type ProjetoEscolhivel } from '../dominio/requisicao';
import { manifesto } from '../manifesto';

let p: Planilhas;
let tipoId: string;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const versao = async (id: string) => (await lerTabela(p, Requisicoes)).porId(id)!.versao;
const linha = async (id: string) => (await lerTabela(p, Requisicoes)).porId(id)!;
const projetoA: ProjetoEscolhivel = { id: 'proj-a', codigo: 'PRJ-0001', titulo: 'Projeto A (teste)', servico: 'escola', atividades: [{ id: 'at-1', descricao: 'Atividade 1' }] };
const projetoSemServico: ProjetoEscolhivel = { id: 'proj-b', codigo: 'PRJ-0002', titulo: 'Projeto B (teste)', servico: null, atividades: [] };
const ficha = (x: Partial<DadosRequisicao> = {}): DadosRequisicao & { nomeRequisitante: string } => ({
  nomeRequisitante: 'Pessoa (fictícia)',
  tipoId,
  area: 'educacao',
  centros: [{ servico: 'escola', percentual: 100 }],
  itens: [{ quantidade: 10, unidade: 'resma', descricao: 'Papel sulfite' }],
  detalhes: { entrega: { modo: 'retirada', horario: '08:10', local: 'Almoxarifado', responsavel: 'Ana' } },
  ...x,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  tipoId = (
    await inserir(
      p,
      TiposRequisicao,
      { nome: 'Material (teste)', categoria: 'material', formulario: 'materiais', perfil_responsavel: 'almoxarifado', prazo_aprovacao: 8, prazo_atendimento: 16, descricao: null },
      { email: 'teste' },
    )
  ).id;
});

describe('regras puras da ligação com projeto', () => {
  it('sem projeto não há o que conferir; atividade sem projeto é erro', () => {
    expect(conferirProjeto(null, null, [], [projetoA]).erros).toEqual([]);
    expect(conferirProjeto(null, 'at-1', [], [projetoA]).erros).toHaveLength(1);
  });
  it('projeto fora da lista (ou sem lista) é recusado', () => {
    expect(conferirProjeto('x', null, [{ servico: 'escola', percentual: 100 }], [projetoA]).erros[0]).toMatch(/não está mais em implementação/);
    expect(conferirProjeto('proj-a', null, [{ servico: 'escola', percentual: 100 }], null).erros).toHaveLength(1);
  });
  it('com serviço no projeto, o centro é só o serviço a 100%; sem serviço, centros livres', () => {
    expect(conferirProjeto('proj-a', null, [{ servico: 'escola', percentual: 100 }], [projetoA]).erros).toEqual([]);
    expect(conferirProjeto('proj-a', null, [{ servico: 'ur', percentual: 100 }], [projetoA]).erros[0]).toMatch(/serviço vem do projeto/);
    expect(
      conferirProjeto('proj-a', null, [{ servico: 'escola', percentual: 50 }, { servico: 'ur', percentual: 50 }], [projetoA]).erros,
    ).toHaveLength(1);
    expect(conferirProjeto('proj-b', null, [{ servico: 'ur', percentual: 100 }], [projetoSemServico]).erros).toEqual([]);
  });
  it('atividade é opcional, mas tem de ser do projeto', () => {
    const c = [{ servico: 'escola', percentual: 100 }];
    expect(conferirProjeto('proj-a', 'at-1', c, [projetoA]).atividade?.descricao).toBe('Atividade 1');
    expect(conferirProjeto('proj-a', 'outra', c, [projetoA]).erros[0]).toMatch(/atividade/);
  });
  it('valor: zero ou mais, duas casas', () => {
    expect(conferirValor(0, 'Valor')).toBeNull();
    expect(conferirValor(10.5, 'Valor')).toBeNull();
    expect(conferirValor(-1, 'Valor')).not.toBeNull();
    expect(conferirValor(1.234, 'Valor')).not.toBeNull();
    expect(conferirValor(NaN, 'Valor')).not.toBeNull();
  });
});

describe('requisição ligada a projeto', () => {
  it('grava projeto (id, código, título) e atividade; só o projeto é obrigatório', async () => {
    const pede = await como('financeiro@exemplo.local');
    const a = await enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a' }), { projetos: [projetoA] });
    const b = await enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a', atividadeId: 'at-1' }), { projetos: [projetoA] });
    expect(await linha(a.id)).toMatchObject({ projeto_id: 'proj-a', projeto_codigo: 'PRJ-0001', projeto_titulo: 'Projeto A (teste)', atividade_id: null });
    expect(await linha(b.id)).toMatchObject({ atividade_id: 'at-1', atividade_descricao: 'Atividade 1' });
  });

  it('o servidor recusa projeto que a pessoa não vê (fora da lista), sem Projetos ou com serviço diferente', async () => {
    const pede = await como('financeiro@exemplo.local');
    await expect(enviarRequisicao(p, pede, ficha({ projetoId: 'proj-oculto' }), { projetos: [projetoA] })).rejects.toThrow(/não está mais em implementação/);
    await expect(enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a' }), {})).rejects.toBeInstanceOf(ErroRequisicao);
    await expect(
      enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a', centros: [{ servico: 'ur', percentual: 100 }] }), { projetos: [projetoA] }),
    ).rejects.toThrow(/serviço vem do projeto/);
    expect((await lerTabela(p, Requisicoes)).todos()).toHaveLength(0);
  });

  it('requisição sem projeto continua como antes; linha antiga (sem as colunas) é válida', async () => {
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha());
    expect(await linha(r.id)).toMatchObject({ projeto_id: null, valor_estimado: null, valor_gasto: null });
  });

  it('ao ajustar e reenviar, o projeto já ligado continua e pode ser trocado só por um válido', async () => {
    const pede = await como('financeiro@exemplo.local');
    const r = await enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a' }), { projetos: [projetoA] });
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'devolver', 'ajuste');
    // O projeto saiu da lista de compras: manter o que já estava grava normalmente.
    await reenviarRequisicao(p, pede, r.id, await versao(r.id), ficha({ projetoId: 'proj-a' }), { projetos: [] });
    expect((await linha(r.id)).projeto_codigo).toBe('PRJ-0001');
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'devolver', 'ajuste');
    await expect(reenviarRequisicao(p, pede, r.id, await versao(r.id), ficha({ projetoId: 'proj-novo' }), { projetos: [projetoA] })).rejects.toBeInstanceOf(ErroRequisicao);
    await reenviarRequisicao(p, pede, r.id, await versao(r.id), ficha({ projetoId: null }), { projetos: [projetoA] });
    expect((await linha(r.id)).projeto_id).toBeNull();
  });
});

describe('quem aprova informa valor estimado e grupo (R5)', () => {
  it('grava só na aprovação, audita colunas e nunca bloqueia quando não informa', async () => {
    const pede = await como('financeiro@exemplo.local');
    const coord = await como('coord.educacao@exemplo.local');
    const a = await enviarRequisicao(p, pede, ficha());
    await decidirRequisicao(p, coord, a.id, await versao(a.id), 'aprovar', null, { conferencia: { valorEstimado: 250.5, grupo: { id: 'g1', nome: 'Material (teste)' } } });
    expect(await linha(a.id)).toMatchObject({ situacao: 'aprovada', valor_estimado: 250.5, grupo_id: 'g1', grupo_nome: 'Material (teste)' });
    const b = await enviarRequisicao(p, pede, ficha());
    await decidirRequisicao(p, coord, b.id, await versao(b.id), 'aprovar', null);
    expect(await linha(b.id)).toMatchObject({ situacao: 'aprovada', valor_estimado: null, grupo_id: null });
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Requisicoes' && x.registro_id === a.id).at(-1);
    expect(auditoria?.detalhes).toContain('valor_estimado');
    expect(auditoria?.detalhes).not.toContain('250');
  });

  it('valor inválido é recusado; devolver ignora a conferência; quem não aprova continua sem poder', async () => {
    const pede = await como('financeiro@exemplo.local');
    const coord = await como('coord.educacao@exemplo.local');
    const r = await enviarRequisicao(p, pede, ficha());
    await expect(decidirRequisicao(p, coord, r.id, await versao(r.id), 'aprovar', null, { conferencia: { valorEstimado: -5 } })).rejects.toThrow(/Valor estimado/);
    await expect(decidirRequisicao(p, pede, r.id, await versao(r.id), 'aprovar', null, { conferencia: { valorEstimado: 5 } })).rejects.toBeInstanceOf(ErroPermissao);
    await decidirRequisicao(p, coord, r.id, await versao(r.id), 'devolver', 'ajuste', { conferencia: { valorEstimado: 99 } });
    expect((await linha(r.id)).valor_estimado).toBeNull();
  });
});

describe('valor gasto ao concluir (R7)', () => {
  async function emAtendimento(projeto = false) {
    const pede = await como('financeiro@exemplo.local');
    const r = await enviarRequisicao(p, pede, ficha(projeto ? { projetoId: 'proj-a', atividadeId: 'at-1' } : {}), { projetos: [projetoA] });
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'aprovar', null);
    const almox = await como('almoxarifado@exemplo.local');
    await receberRequisicao(p, almox, r.id, await versao(r.id));
    return { r, almox };
  }
  const itensCompletos = async (id: string) => {
    const d = (await lerTabelas(p, [(await import('../dados/tabelas')).RequisicaoItens] as const))[0];
    return Object.fromEntries(d.ativos().filter((i) => i.requisicao_id === id).map((i) => [i.id, i.quantidade]));
  };

  it('é opcional, guarda zero ou mais com duas casas e recusa o resto', async () => {
    const { r, almox } = await emAtendimento();
    await expect(concluirRequisicao(p, almox, r.id, await versao(r.id), await itensCompletos(r.id), null, { valorGasto: -1 })).rejects.toThrow(/Valor gasto/);
    await concluirRequisicao(p, almox, r.id, await versao(r.id), await itensCompletos(r.id), null, { valorGasto: 123.45 });
    expect((await linha(r.id)).valor_gasto).toBe(123.45);
  });

  it('sem informar, conclui como hoje', async () => {
    const { r, almox } = await emAtendimento();
    await concluirRequisicao(p, almox, r.id, await versao(r.id), await itensCompletos(r.id), null);
    expect(await linha(r.id)).toMatchObject({ situacao: 'atendida', valor_gasto: null });
  });

  it('corrigir depois: só quem atende, só depois de concluir, com histórico', async () => {
    const { r, almox } = await emAtendimento();
    await expect(corrigirValorGasto(p, almox, r.id, await versao(r.id), 10)).rejects.toThrow(/depois de concluir/);
    await concluirRequisicao(p, almox, r.id, await versao(r.id), await itensCompletos(r.id), null, { valorGasto: 100 });
    await expect(corrigirValorGasto(p, await como('financeiro@exemplo.local'), r.id, await versao(r.id), 10)).rejects.toBeInstanceOf(ErroPermissao);
    await corrigirValorGasto(p, almox, r.id, await versao(r.id), 90);
    expect((await linha(r.id)).valor_gasto).toBe(90);
  });
});

describe('compras do projeto (R9)', () => {
  it('lista as requisições ligadas ao projeto, sem o nome de quem pediu', async () => {
    const pede = await como('financeiro@exemplo.local');
    const r = await enviarRequisicao(p, pede, ficha({ projetoId: 'proj-a', atividadeId: 'at-1' }), { projetos: [projetoA] });
    await enviarRequisicao(p, pede, ficha());
    const lida = await comprasDoProjeto(p, await como('diretoria@exemplo.local'), 'proj-a');
    expect(lida.estado).toBe('ok');
    if (lida.estado !== 'ok') return;
    expect(lida.dados).toHaveLength(1);
    expect(lida.dados[0]).toMatchObject({ id: r.id, atividade: 'Atividade 1', valorGasto: null });
    expect(JSON.stringify(lida.dados)).not.toMatch(/Pessoa \(fictícia\)|financeiro@/);
  });
});
