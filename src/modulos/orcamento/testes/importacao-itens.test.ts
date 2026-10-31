/**
 * Importação de despesas e receitas com DE-PARA, com planilhas FICTÍCIAS.
 */
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { lerXlsx } from '../aplicacao/importacao';
import { analisarImportacaoItens, descreverArquivoItens, importarItens, type PropostaItens } from '../aplicacao/importacao-itens';
import { salvarDespesa } from '../aplicacao/previsao';
import { popularPrevisaoFicticia } from '../dados/ficticios';
import { Despesas, Exercicios, GruposGasto, ItensImportados, Receitas, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { conferirMapeamentoItens, lerItens, type MapeamentoItens } from '../dominio/importacao-itens';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularPrevisaoFicticia(p); // exercício 2027 em elaboração, grupos e fontes fictícios
});

/** Planilha FICTÍCIA de despesas com uma coluna por mês e uma linha de total no fim. */
async function planilhaDespesas(): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const a = livro.addWorksheet('Despesas 2027');
  a.addRow(['Previsão de despesas (fictícia)']);
  a.addRow(['Centro de custo', 'Grupo de despesa', 'Fonte', 'Descrição', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']);
  a.addRow(['Escola (exemplo)', 'Material de consumo (exemplo)', 'Leilão anual (exemplo)', 'Papel sulfite', 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
  a.addRow(['escola', 'Alimentacao (exemplo)', '', 'Lanches', 0, 500, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  a.addRow(['Oficina de arte', 'Material didático', 'Bazar', 'Tintas', '1.200,50']);
  a.addRow(['Escola (exemplo)', 'Material de consumo (exemplo)', null, '', 10]); // sem descrição
  a.addRow(['Escola (exemplo)', '', null, 'Sem grupo', 10]);
  a.addRow([]);
  a.addRow(['TOTAL', null, null, null, 1700.5]);
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Planilha FICTÍCIA de receitas com valor anual. */
async function planilhaReceitas(): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const a = livro.addWorksheet('Receitas');
  a.addRow(['Fonte de recurso', 'Descrição', 'Área', 'Situação', 'Valor anual']);
  a.addRow(['Leilão anual (exemplo)', 'Leilão 2027', '', 'em negociação', 120000]);
  a.addRow(['Doações e contribuições (exemplo)', 'Campanha de sócios', 'Educação', '', 24000]);
  a.addRow(['Doações e contribuições (exemplo)', 'Rifa', '', 'talvez', 5000]);
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

const escolher = (proposta: PropostaItens, escolhas: Record<string, string>): PropostaItens => ({
  ...proposta,
  nomes: Object.fromEntries(
    Object.entries(proposta.nomes).map(([k, lista]) => [k, lista.map((n) => ({ ...n, valor: n.nome in escolhas ? escolhas[n.nome] : n.valor }))]),
  ) as PropostaItens['nomes'],
});

describe('leitura e DE-PARA', () => {
  it('sugere aba, tipo, cabeçalho, colunas e modo pelos títulos; lê os meses, pula branco e total e aponta problemas', async () => {
    const abas = await lerXlsx(await planilhaDespesas());
    const d = descreverArquivoItens(await fin(), abas);
    const m = d.sugestao!;
    expect(m).toMatchObject({ tipo: 'despesa', aba: 'Despesas 2027', cabecalho: 2, valores: 'meses', colunas: { servico: 0, grupo: 1, fonte: 2, descricao: 3, m1: 4, m12: 15 } });
    expect(conferirMapeamentoItens(abas, m)).toEqual([]);
    const itens = lerItens(abas, m);
    expect(itens.map((x) => [x.descricao, x.total, x.problema])).toEqual([
      ['Papel sulfite', 1200, null],
      ['Lanches', 1000, null],
      ['Tintas', 1200.5, null],
      ['', 10, 'Falta a descrição.'],
      ['Sem grupo', 10, 'Falta o grupo de gasto.'],
    ]);
    expect(itens[1].meses.slice(0, 4)).toEqual([0, 500, 500, 0]);
    expect(itens[1].distribuicao).toBe('manual');
  });

  it('valor anual é dividido igualmente; quantidade × vezes × unitário nas despesas', async () => {
    const abas = await lerXlsx(await planilhaReceitas());
    const m = descreverArquivoItens(await fin(), abas).sugestao!;
    expect(m).toMatchObject({ tipo: 'receita', valores: 'total', colunas: { fonte: 0, descricao: 1, area: 2, captacao: 3, total: 4 } });
    const itens = lerItens(abas, m);
    expect(itens.map((x) => [x.descricao, x.captacao, x.problema])).toEqual([
      ['Leilão 2027', 'negociacao', null],
      ['Campanha de sócios', 'garantida', null], // vazio = captação padrão
      ['Rifa', null, 'Situação da captação "talvez" não reconhecida.'],
    ]);
    expect(itens[0].meses.reduce((s, v) => s + v, 0)).toBeCloseTo(120000, 2);

    const livro = new ExcelJS.Workbook();
    const a = livro.addWorksheet('D');
    a.addRow(['Serviço', 'Grupo', 'Item', 'Qtd', 'Vezes', 'Valor unitário']);
    a.addRow(['escola', 'Material de consumo (exemplo)', 'Lápis', 10, 2, 1.5]);
    const abasU = await lerXlsx((await livro.xlsx.writeBuffer()) as ArrayBuffer);
    const mu = descreverArquivoItens(await fin(), abasU, 'despesa').sugestao!;
    expect(mu.valores).toBe('unitario');
    expect(lerItens(abasU, mu)[0]).toMatchObject({ quantidade: 10, ocorrencias: 2, valorUnitario: 1.5, total: 30 });
  });

  it('recusa DE-PARA incompleto com mensagem clara', async () => {
    const abas = await lerXlsx(await planilhaDespesas());
    const m: MapeamentoItens = { tipo: 'despesa', aba: 'Despesas 2027', cabecalho: 2, colunas: { descricao: 3 }, valores: 'total' };
    const erros = conferirMapeamentoItens(abas, m).join(' ');
    expect(erros).toMatch(/Serviço/);
    expect(erros).toMatch(/Grupo de gasto/);
    expect(erros).toMatch(/valor anual/);
  });
});

describe('análise e importação', () => {
  it('reconhece cadastros pelo nome ou código, pede a correspondência dos outros e grava no exercício em elaboração', async () => {
    const f = await fin();
    const abas = await lerXlsx(await planilhaDespesas());
    const a = await analisarImportacaoItens(p, f, abas, descreverArquivoItens(f, abas).sugestao!);
    expect(a.relatorio).toMatchObject({ ano: 2027, itens: 3, total: 3400.5, substituir: 0 });
    expect(a.relatorio.problemas.map((x) => x.linha)).toEqual([6, 7]);
    expect(a.proposta.nomes.servico.map((n) => [n.nome, n.valor])).toEqual([
      ['escola', 'escola'], // pelo código
      ['Escola (exemplo)', 'escola'], // pelo nome
      ['Oficina de arte', null],
    ]);
    expect(a.proposta.nomes.grupo.find((n) => n.nome === 'Alimentacao (exemplo)')?.valor).toBeTruthy(); // sem acento também
    expect(a.proposta.nomes.fonte.map((n) => n.nome)).toEqual(['Bazar', 'Leilão anual (exemplo)']);

    await expect(importarItens(p, f, a.proposta)).rejects.toThrow(/Escolha o serviço correspondente a: Oficina de arte/);
    const grupoMaterial = a.opcoes.grupo.find((g) => g.nome.startsWith('Material de consumo'))!.valor;
    const pronta = escolher(a.proposta, { 'Oficina de arte': 'escola', 'Material didático': grupoMaterial, Bazar: '' }); // Bazar = a definir
    const antes = (await lerTabela(p, Despesas)).ativos().length;
    expect(await importarItens(p, f, pronta)).toEqual({ itens: 3, substituidos: 0 });
    const despesas = (await lerTabela(p, Despesas)).ativos();
    expect(despesas).toHaveLength(antes + 3);
    const lanches = despesas.find((d) => d.descricao === 'Lanches')!;
    expect([lanches.ano, lanches.servico, lanches.fonte_id, lanches.distribuicao, lanches.m2, lanches.m4, lanches.situacao]).toEqual([2027, 'escola', null, 'manual', 500, 0, 'aceito']);
    expect(despesas.find((d) => d.descricao === 'Tintas')?.fonte_id).toBeNull();
  });

  it('importar de novo substitui só os itens importados antes: os lançados à mão ficam, os antigos vão para o histórico', async () => {
    const f = await fin();
    const abas = await lerXlsx(await planilhaReceitas());
    const m = descreverArquivoItens(f, abas).sugestao!;
    const primeira = await analisarImportacaoItens(p, f, abas, m);
    expect(await importarItens(p, f, primeira.proposta)).toEqual({ itens: 2, substituidos: 0 });
    const ativasAntes = (await lerTabela(p, Receitas)).ativos().length;

    const segunda = await analisarImportacaoItens(p, f, abas, m);
    expect(segunda.relatorio.substituir).toBe(2);
    expect(await importarItens(p, f, segunda.proposta)).toEqual({ itens: 2, substituidos: 2 });
    const receitas = await lerTabela(p, Receitas);
    expect(receitas.ativos()).toHaveLength(ativasAntes);
    expect(receitas.todos().filter((r) => r.descricao === 'Leilão 2027').map((r) => r.ativo)).toEqual([false, true]);
    expect((await lerTabela(p, ItensImportados)).ativos()).toHaveLength(2);

    // Despesas importadas não são tocadas por uma importação de receitas, e vice-versa.
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'ImportacaoItens' && x.acao === 'inclusao');
    expect(auditoria.at(-1)?.detalhes).toContain('"substituidos":2');
    expect(JSON.stringify(auditoria)).not.toContain('Leilão 2027');
  });

  it('item lançado à mão no mesmo ano continua; exercício aprovado não recebe importação', async () => {
    const f = await fin();
    const abas = await lerXlsx(await planilhaDespesas());
    const m = descreverArquivoItens(f, abas).sugestao!;
    const [grupos] = await lerTabelas(p, [GruposGasto] as const);
    await salvarDespesa(p, f, {
      ano: 2027, servico: 'escola', grupo_id: grupos.ativos()[0].id, fonte_id: null, descricao: 'Lançado à mão', quantidade: 1, ocorrencias: 1, valor_unitario: 50, distribuicao: 'igual',
    });
    const a = await analisarImportacaoItens(p, f, abas, m);
    const grupoMaterial = a.opcoes.grupo.find((g) => g.nome.startsWith('Material de consumo'))!.valor;
    const pronta = escolher(a.proposta, { 'Oficina de arte': 'escola', 'Material didático': grupoMaterial, Bazar: '' });
    await importarItens(p, f, pronta);
    await importarItens(p, f, pronta); // de novo: substitui a primeira importação
    expect((await lerTabela(p, Despesas)).ativos().filter((d) => d.descricao === 'Lançado à mão')).toHaveLength(1);
    expect((await lerTabela(p, Despesas)).ativos().filter((d) => d.descricao === 'Papel sulfite')).toHaveLength(1);

    const [exercicios] = await lerTabelas(p, [Exercicios] as const);
    const e = exercicios.ativos().find((x) => x.ano === 2027)!;
    await atualizar(p, Exercicios, e.id, e.versao, { situacao: 'aprovado' }, { email: 'teste' });
    await expect(importarItens(p, f, pronta)).rejects.toThrow(/não está mais em elaboração/);
    await expect(analisarImportacaoItens(p, f, abas, m)).rejects.toThrow(/Não há exercício em elaboração/);
  });

  it('só quem lança despesas e receitas importa', async () => {
    const abas = await lerXlsx(await planilhaReceitas());
    const leitura = await como('leitura@exemplo.local');
    expect(() => descreverArquivoItens(leitura, abas)).toThrow(ErroPermissao);
    await expect(importarItens(p, await como('coordenacao@exemplo.local'), {})).rejects.toBeInstanceOf(ErroPermissao);
  });
});
