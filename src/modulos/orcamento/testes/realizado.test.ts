/**
 * Realizado informado à mão (Entrega 1C.1): grade, salvar o mês, escopo e auditoria. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, inserirRegistros, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { ErroHistorico, importarHistorico } from '../aplicacao/historico';
import { ErroRealizado, lerGradeDoMes, lerRealizadoDoAno, pendenciaDeRealizado, salvarRealizadoDoMes, type EntradaLinha } from '../aplicacao/realizado';
import { Despesas, Exercicios, Fontes, GruposGasto, PLANILHA_EXECUCAO, Realizado, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;
const MES = mesAnterior(mesAtualBrasilia());
const ANO = Number(MES.slice(0, 4));

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

let ids: { g: string; grh: string; f: string; flivre: string };

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const [g, grh] = await inserirRegistros(p, grupos, [{ nome: 'Material (teste)', rh: false }, { nome: 'Salários (teste)', rh: true }], { email: 'teste' });
  const [f, flivre] = await inserirRegistros(p, fontes, [{ nome: 'Termo (teste)', natureza: 'publica', uso: 'restrita' }, { nome: 'Doações (teste)', natureza: 'propria', uso: 'livre' }], { email: 'teste' });
  ids = { g: g.id, grh: grh.id, f: f.id, flivre: flivre.id };
});

/** Previsão aprovada do ano do mês: um item da escola e um da UR, 1.200 por mês cada. */
async function aprovarPrevisao() {
  const [ex, desp] = await lerTabelas(p, [Exercicios, Despesas] as const);
  await inserirRegistros(p, ex, [{ ano: ANO, situacao: 'aprovado', aprovado_em: '2026-01-01', aprovado_por: 'x' }], { email: 'teste' });
  const base = { ano: ANO, grupo_id: ids.g, fonte_id: ids.f, quantidade: 1, ocorrencias: 12, valor_unitario: 1200, distribuicao: 'igual' as const, situacao: 'aceito' as const, observacao: null };
  const meses = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i + 1}`, 1200]));
  await inserirRegistros(p, desp, [
    { ...base, servico: 'escola', descricao: 'Item escola', ...meses },
    { ...base, servico: 'ur', descricao: 'Item UR', ...meses },
  ] as never, { email: 'teste' });
}

const linha = (extra: Partial<EntradaLinha> = {}): EntradaLinha => ({
  tipo: 'despesa', servico: 'escola', grupoId: ids.g, fonteId: ids.f, natureza: 'custeio', valor: 1000, ...extra,
});

describe('quem vê e quem altera', () => {
  it('Financeiro informa; Diretoria só vê; Leitura e Compras não veem a grade', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha()]);
    const dir = await como('diretoria@exemplo.local');
    expect((await lerGradeDoMes(p, dir, MES)).despesas).toHaveLength(1);
    expect((await lerGradeDoMes(p, dir, MES)).podeEditar).toBe(false);
    await expect(salvarRealizadoDoMes(p, dir, MES, [linha()])).rejects.toBeInstanceOf(ErroPermissao);
    for (const email of ['leitura@exemplo.local', 'compras@exemplo.local', 'dp@exemplo.local']) {
      await expect(lerGradeDoMes(p, await como(email), MES)).rejects.toBeInstanceOf(ErroPermissao);
    }
  });

  it('Leitura vê só os totais agregados do ano', async () => {
    await salvarRealizadoDoMes(p, await fin(), MES, [linha({ valor: 300 }), linha({ tipo: 'receita', servico: null, grupoId: null, fonteId: ids.flivre, natureza: 'receita_comum', valor: 500 })]);
    const r = await lerRealizadoDoAno(p, await como('leitura@exemplo.local'), ANO);
    expect(r.total).toEqual({ despesa: 300, receita: 500, resultado: 200 });
    expect(r.incluiReceita).toBe(true);
  });

  it('Coordenação vê e soma só o seu escopo, sem receitas', async () => {
    await aprovarPrevisao();
    await salvarRealizadoDoMes(p, await fin(), MES, [
      linha({ servico: 'escola', valor: 100 }),
      linha({ servico: 'ur', valor: 40 }),
      linha({ tipo: 'receita', servico: null, grupoId: null, fonteId: ids.flivre, natureza: 'receita_comum', valor: 900 }),
    ]);
    const ur = await como('coord.ur@exemplo.local');
    const g = await lerGradeDoMes(p, ur, MES);
    expect(g.despesas.map((l) => l.servico)).toEqual(['ur']);
    expect(g.receitas).toEqual([]);
    expect(g.totais.despesa).toBe(40);
    expect(g.opcoes.servicos.map((s) => s.codigo)).toEqual(['ur']);
    const ano = await lerRealizadoDoAno(p, ur, ANO);
    expect(ano.total).toEqual({ despesa: 40, receita: 0, resultado: -40 });
    expect(ano.escopoParcial).toBe(true);
    await expect(salvarRealizadoDoMes(p, ur, MES, [linha({ servico: 'ur' })])).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('grade montada pela Previsão', () => {
  it('traz o previsto do mês e sugere a natureza pelo grupo', async () => {
    await aprovarPrevisao();
    const g = await lerGradeDoMes(p, await fin(), MES);
    expect(g.previsaoAprovada).toBe(true);
    expect(g.despesas.map((l) => [l.servico, l.previsto, l.natureza, l.realizado])).toEqual([
      ['escola', 1200, 'custeio', null],
      ['ur', 1200, 'custeio', null],
    ]);
  });

  it('R10: sem Previsão aprovada a grade vem vazia, mas aceita linhas à mão', async () => {
    const f = await fin();
    expect((await lerGradeDoMes(p, f, MES)).previsaoAprovada).toBe(false);
    await salvarRealizadoDoMes(p, f, MES, [linha()]);
    const g = await lerGradeDoMes(p, f, MES);
    expect(g.despesas).toHaveLength(1);
    expect(g.despesas[0].prevista).toBe(false);
  });

  it('mês futuro e mês fora dos últimos 24 meses não são aceitos', async () => {
    const f = await fin();
    await expect(lerGradeDoMes(p, f, '2999-01')).rejects.toBeInstanceOf(ErroRealizado);
    await expect(salvarRealizadoDoMes(p, f, '2001-01', [linha()])).rejects.toBeInstanceOf(ErroRealizado);
  });
});

describe('salvar o mês', () => {
  it('R1: salvar de novo atualiza a linha, não duplica; valor zerado é aceito', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 100 })]);
    let g = await lerGradeDoMes(p, f, MES);
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 0, versao: g.despesas[0].versao! })]);
    g = await lerGradeDoMes(p, f, MES);
    expect(g.despesas).toHaveLength(1);
    expect(g.despesas[0].realizado).toBe(0);
    expect((await lerTabela(p, Realizado)).ativos()).toHaveLength(1);
  });

  it('R2: versão desatualizada ou linha criada por outra pessoa dá conflito e nada é gravado', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 100 }), linha({ servico: 'ur', valor: 50 })]);
    const g = await lerGradeDoMes(p, f, MES);
    const [a, b] = g.despesas;
    await salvarRealizadoDoMes(p, f, MES, [linha({ servico: b.servico, valor: 60, versao: b.versao! })]);
    await expect(
      salvarRealizadoDoMes(p, f, MES, [
        linha({ servico: a.servico, valor: 999, versao: a.versao! }),
        linha({ servico: b.servico, valor: 70, versao: b.versao! }),
      ]),
    ).rejects.toBeInstanceOf(ErroConflito);
    const depois = await lerGradeDoMes(p, f, MES);
    expect(depois.despesas.map((l) => l.realizado).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([60, 100]);
    // Linha nova para uma chave que já existe (sem versão) também é conflito: não duplica.
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ valor: 5 })])).rejects.toBeInstanceOf(ErroConflito);
    expect((await lerTabela(p, Realizado)).ativos()).toHaveLength(2);
  });

  it('uma linha inválida impede gravar as outras', async () => {
    const f = await fin();
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ valor: 10 }), linha({ servico: 'ur', valor: -5 })])).rejects.toThrow(/negativo/);
    expect((await lerTabela(p, Realizado)).ativos()).toHaveLength(0);
  });

  it('valida natureza, motivo de não recorrente, repetição, serviço e fonte', async () => {
    const f = await fin();
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ natureza: 'ressarcimento' })])).rejects.toThrow(/natureza/i);
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ naoRecorrente: true })])).rejects.toThrow(/motivo/);
    await expect(salvarRealizadoDoMes(p, f, MES, [linha(), linha()])).rejects.toThrow(/duas vezes/);
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ servico: 'nao_existe' })])).rejects.toThrow(/serviço/);
    await expect(salvarRealizadoDoMes(p, f, MES, [linha({ fonteId: 'x' })])).rejects.toThrow(/fonte/);
    await salvarRealizadoDoMes(p, f, MES, [linha({ naoRecorrente: true, motivo: 'Reforma da quadra' })]);
    expect((await lerGradeDoMes(p, f, MES)).despesas[0]).toMatchObject({ naoRecorrente: true, motivo: 'Reforma da quadra' });
  });

  it('R7: os totais são a soma das linhas, em centavos', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [
      linha({ valor: 0.1 }), linha({ servico: 'ur', valor: 0.2 }),
      linha({ tipo: 'receita', servico: null, grupoId: null, fonteId: ids.flivre, natureza: 'ressarcimento', valor: 1 }),
    ]);
    expect((await lerGradeDoMes(p, f, MES)).totais).toEqual({ despesa: 0.3, receita: 1, resultado: 0.7 });
  });

  it('R8: corrigir é auditado só com as colunas; remover encerra (ativo = FALSE) e nada é apagado', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 123.45, observacao: 'Nota sigilosa' })]);
    let g = await lerGradeDoMes(p, f, MES);
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 200, observacao: 'Nota sigilosa', versao: g.despesas[0].versao! })]);
    g = await lerGradeDoMes(p, f, MES);
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: null, versao: g.despesas[0].versao! })]);
    expect((await lerGradeDoMes(p, f, MES)).despesas).toHaveLength(0);
    const todos = (await lerTabela(p, Realizado)).todos();
    expect(todos).toHaveLength(1);
    expect(todos[0].ativo).toBe(false);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Realizado');
    expect(aud.map((x) => x.acao)).toEqual(['inclusao', 'alteracao', 'alteracao']);
    expect(JSON.parse(aud[1].detalhes as string)).toEqual({ colunas: ['valor'] });
    expect(JSON.parse(aud[2].detalhes as string)).toEqual({ colunas: ['ativo'] });
    // Só os campos de conteúdo: id, registro_id e ocorrido_em são aleatórios ou do relógio e podem
    // conter "123" ou "200" por acaso (falha intermitente na main em 11/11/2026).
    expect(JSON.stringify(aud.map((x) => [x.usuario, x.acao, x.entidade, x.detalhes]))).not.toMatch(/123|200|sigilosa/);
  });

  it('R9: a grade guarda RH só agregado por serviço (sem coluna de pessoa)', async () => {
    const colunas = Object.keys(Realizado.esquema.shape);
    expect(colunas).not.toContain('colaborador');
    expect(colunas).not.toContain('fornecedor');
    await salvarRealizadoDoMes(p, await fin(), MES, [linha({ grupoId: ids.grh, natureza: 'rh', valor: 8000 }), linha({ grupoId: ids.grh, natureza: 'encargos', valor: 2000 })]);
    expect((await lerGradeDoMes(p, await fin(), MES)).despesas).toHaveLength(2);
  });
});

describe('pendência, ano e histórico', () => {
  it('R11: só quem informa vê a pendência; some quando o mês tem linha', async () => {
    const f = await fin();
    expect(await pendenciaDeRealizado(p, f)).toBe(mesAnterior(mesAtualBrasilia()));
    expect(await pendenciaDeRealizado(p, await como('diretoria@exemplo.local'))).toBeNull();
    await salvarRealizadoDoMes(p, f, MES, [linha()]);
    expect(await pendenciaDeRealizado(p, f)).toBeNull();
  });

  it('realizado do ano: mês sem linha aparece sem total', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha({ valor: 70 })]);
    const r = await lerRealizadoDoAno(p, f, ANO);
    const m = r.meses.find((x) => x.mes === MES)!;
    expect(m.totais?.despesa).toBe(70);
    expect(r.meses.filter((x) => x.informado)).toHaveLength(1);
    expect(r.meses.find((x) => !x.informado)!.totais).toBeNull();
  });

  it('R13: importar o histórico de um ano que já tem realizado é recusado', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [linha()]);
    await expect(importarHistorico(p, f, { ano: ANO, linhas: [], folha: 0, despesaTotal: 0, totalPlanilha: 0 })).rejects.toBeInstanceOf(ErroHistorico);
  });
});

describe('abas e menu', () => {
  it('Preparar estrutura cria a aba Realizado na planilha de execução', async () => {
    expect((await lerTabela(p, Realizado)).todos()).toEqual([]);
  });
  it('o menu da Execução usa as permissões certas', () => {
    expect(manifesto.menu.filter((m) => m.secao === 'Execução').map((m) => [m.rotulo, m.permissao])).toEqual([
      ['Informar realizado', 'orcamento.realizado.editar'],
      ['Realizado do ano', 'orcamento.execucao.ver'],
    ]);
  });
});
