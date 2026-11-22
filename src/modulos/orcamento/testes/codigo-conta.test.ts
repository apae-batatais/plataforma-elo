/**
 * Código da conta contábil nos cadastros (grupos de gasto e fontes de recurso), com dados FICTÍCIOS.
 */
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { baixarCadastrosCsv, baixarItensCsv } from '../aplicacao/baixar-planilha';
import { analisarCadastrosEmLote, cadastrarEmLote } from '../aplicacao/cadastros-em-lote';
import { lerXlsx } from '../aplicacao/importacao';
import { analisarImportacaoItens, descreverArquivoItens } from '../aplicacao/importacao-itens';
import { excluirGrupo, listarCadastros, lerPrevisao, reativarGrupo, salvarDespesa, salvarFonte, salvarGrupo } from '../aplicacao/previsao';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { Fontes, GruposGasto, Postos, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { celulaSegura, chaveCodigoConta, limparCodigoConta, montarCsv } from '../dominio/codigo-conta';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularPrevisaoFicticia(p);
});

describe('regras puras do código', () => {
  it('é opcional, limpa espaços e recusa formato ou tamanho inválido', () => {
    expect(limparCodigoConta(undefined)).toBeNull();
    expect(limparCodigoConta('   ')).toBeNull();
    expect(limparCodigoConta('  3.1.02.001 ')).toBe('3.1.02.001');
    expect(limparCodigoConta('00123')).toBe('00123');
    expect(limparCodigoConta('A-1/2')).toBe('A-1/2');
    expect(() => limparCodigoConta('3 1')).toThrow(/letras, números/);
    expect(() => limparCodigoConta('3.1;2')).toThrow(/letras, números/);
    expect(() => limparCodigoConta('1'.repeat(31))).toThrow(/no máximo 30/);
    expect(limparCodigoConta('1'.repeat(30))).toHaveLength(30);
    expect(chaveCodigoConta(' AB-1 ')).toBe('ab-1');
  });

  it('CSV: acentos (BOM), ponto e vírgula, número puro e proteção de fórmula', () => {
    expect(celulaSegura('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(celulaSegura('+1')).toBe("'+1");
    expect(celulaSegura('-1')).toBe("'-1");
    expect(celulaSegura('@x')).toBe("'@x");
    expect(celulaSegura('Normal')).toBe('Normal');
    const csv = montarCsv(['Nome', 'Valor'], [['Açúcar; "doce"', 1234.5], ['=1+1', null]]);
    expect(csv.startsWith('﻿Nome;Valor\r\n')).toBe(true);
    expect(csv).toContain('"Açúcar; ""doce""";1234,5');
    expect(csv).toContain("'=1+1;");
  });
});

describe('cadastros com código', () => {
  it('grava, limpa, mantém quando não informado e audita só a coluna', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Alimentação', rh: false, codigo_conta: ' 3.1.02.001 ' });
    let g = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Alimentação')!;
    expect(g.codigo_conta).toBe('3.1.02.001');
    await salvarGrupo(p, f, { id: g.id, versao: g.versao, nome: 'Alimentação', rh: false }); // sem o campo: mantém
    g = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Alimentação')!;
    expect(g.codigo_conta).toBe('3.1.02.001');
    await salvarGrupo(p, f, { id: g.id, versao: g.versao, nome: 'Alimentação', rh: false, codigo_conta: '' }); // vazio: limpa
    g = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Alimentação')!;
    expect(g.codigo_conta).toBeNull();
    await salvarGrupo(p, f, { id: g.id, versao: g.versao, nome: 'Alimentação', rh: false, codigo_conta: '3.1.02.009' });
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'GruposGasto');
    expect(aud.some((a) => (a.detalhes ?? '').includes('codigo_conta'))).toBe(true);
    expect(aud.every((a) => !(a.detalhes ?? '').includes('3.1.02'))).toBe(true);
  });

  it('recusa formato inválido, sem gravar', async () => {
    const f = await fin();
    const antes = (await listarCadastros(p, f)).fontes.ativos.length;
    await expect(salvarFonte(p, f, { nome: 'Nova fonte', natureza: 'propria', uso: 'livre', codigo_conta: 'a b' })).rejects.toThrow(/letras, números/);
    expect((await listarCadastros(p, f)).fontes.ativos).toHaveLength(antes);
  });

  it('código único dentro do cadastro (sem diferença de maiúscula); grupo e fonte podem repetir entre si', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Alimentação', rh: false, codigo_conta: 'ab-1' });
    await expect(salvarGrupo(p, f, { nome: 'Combustível', rh: false, codigo_conta: 'AB-1' })).rejects.toThrow(/já é do grupo "Alimentação"/);
    await salvarFonte(p, f, { nome: 'Fonte um', natureza: 'propria', uso: 'livre', codigo_conta: 'AB-1' });
    await expect(salvarFonte(p, f, { nome: 'Fonte dois', natureza: 'propria', uso: 'livre', codigo_conta: 'ab-1' })).rejects.toThrow(/já é da fonte "Fonte um"/);
    const g = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Alimentação')!;
    // regravar o próprio código não é repetição
    await salvarGrupo(p, f, { id: g.id, versao: g.versao, nome: 'Alimentação', rh: false, codigo_conta: 'AB-1' });
  });

  it('excluir libera o código; reativar recusa se outro já o tomou', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Alimentação', rh: false, codigo_conta: '3.1' });
    const a = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Alimentação')!;
    await excluirGrupo(p, f, a.id, a.versao);
    await salvarGrupo(p, f, { nome: 'Combustível', rh: false, codigo_conta: '3.1' }); // liberado
    const excluido = (await listarCadastros(p, f)).grupos.excluidos.find((x) => x.nome === 'Alimentação')!;
    await expect(reativarGrupo(p, f, excluido.id, excluido.versao)).rejects.toThrow(/código 3\.1 agora é do grupo "Combustível"/);
    const comb = (await listarCadastros(p, f)).grupos.ativos.find((x) => x.nome === 'Combustível')!;
    await salvarGrupo(p, f, { id: comb.id, versao: comb.versao, nome: 'Combustível', rh: false, codigo_conta: '3.2' });
    await reativarGrupo(p, f, excluido.id, excluido.versao);
  });

  it('dados antigos sem coluna preenchida funcionam; quem não edita não altera', async () => {
    const f = await fin();
    expect((await listarCadastros(p, f)).grupos.ativos.every((g) => g.codigo_conta === null)).toBe(true);
    const leitura = await como('leitura@exemplo.local');
    await expect(salvarGrupo(p, leitura, { nome: 'X', rh: false, codigo_conta: '1' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarFonte(p, leitura, { nome: 'X', natureza: 'propria', uso: 'livre', codigo_conta: '1' })).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('cadastro em lote com código', () => {
  it('lê a coluna de código; repetido na lista ou já usado vira erro da linha', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Alimentação', rh: false, codigo_conta: '3.1' });
    const lista = 'Material novo;;3.2\nRPA novo;RH;3.3\nOutro;;3.1\nMais um;;3.2\nSem código\nRuim;;3 4';
    const linhas = await analisarCadastrosEmLote(p, f, 'grupo', lista);
    expect(linhas.map((l) => [l.nome, l.situacao, l.codigo_conta ?? null])).toEqual([
      ['Material novo', 'ok', '3.2'],
      ['RPA novo', 'ok', '3.3'],
      ['Outro', 'erro', null],
      ['Mais um', 'erro', null],
      ['Sem código', 'ok', null],
      ['Ruim', 'erro', null],
    ]);
    expect(linhas[2].problema).toMatch(/já é do grupo "Alimentação"/);
    expect(linhas[3].problema).toMatch(/repetido na lista/);
    expect(await cadastrarEmLote(p, f, 'grupo', linhas)).toBe(3);
    const grupos = (await lerTabela(p, GruposGasto)).ativos();
    expect(grupos.find((g) => g.nome === 'RPA novo')).toMatchObject({ rh: true, codigo_conta: '3.3' });
    expect(grupos.find((g) => g.nome === 'Sem código')?.codigo_conta).toBeNull();
  });

  it('fontes: nome; natureza; uso; código', async () => {
    const f = await fin();
    const linhas = await analisarCadastrosEmLote(p, f, 'fonte', 'Fonte lote;pública;restrito;4.1.01\nOutra lote;própria;livre;4.1.01');
    expect(linhas.map((l) => l.situacao)).toEqual(['ok', 'erro']);
    expect(await cadastrarEmLote(p, f, 'fonte', linhas)).toBe(1);
    expect((await lerTabela(p, Fontes)).ativos().find((x) => x.nome === 'Fonte lote')).toMatchObject({ natureza: 'publica', uso: 'restrita', codigo_conta: '4.1.01' });
  });
});

async function planilhaPorCodigo(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const a = livro.addWorksheet('Despesas 2027');
  a.addRow(['Centro de custo', 'Grupo de despesa', 'Fonte', 'Descrição', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']);
  for (const l of linhas) a.addRow(l);
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('importar despesas reconhecendo pelo código', () => {
  it('casa grupo e fonte pelo código; nome e código divergentes ficam sem correspondência', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Grupo por código', rh: false, codigo_conta: '3.9.01' });
    await salvarGrupo(p, f, { nome: 'Outro grupo', rh: false, codigo_conta: '3.9.02' });
    await salvarFonte(p, f, { nome: 'Fonte por código', natureza: 'propria', uso: 'livre', codigo_conta: '4.9.01' });
    const base = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const abas = await lerXlsx(
      await planilhaPorCodigo([
        ['escola', '3.9.01', '4.9.01', 'Casa pelo código', ...base],
        ['escola', 'Outro grupo', '4.9.01', 'Nome e código batem', ...base],
        ['escola', 'Grupo por código', '3.9.02', 'Divergente', ...base],
        ['escola', '3.9.02', 'Fonte por código', 'Outro código', ...base],
      ]),
    );
    const a = await analisarImportacaoItens(p, f, abas, descreverArquivoItens(f, abas).sugestao!);
    const ids = new Map((await lerTabela(p, GruposGasto)).ativos().map((g) => [g.nome, g.id]));
    const grupo = (nome: string) => a.proposta.nomes.grupo.find((n) => n.nome === nome)?.valor;
    expect(grupo('3.9.01')).toBe(ids.get('Grupo por código'));
    expect(grupo('Outro grupo')).toBe(ids.get('Outro grupo'));
    expect(grupo('3.9.02')).toBe(ids.get('Outro grupo'));
    const fontes = new Map((await lerTabela(p, Fontes)).ativos().map((x) => [x.nome, x.id]));
    expect(a.proposta.nomes.fonte.find((n) => n.nome === '4.9.01')?.valor).toBe(fontes.get('Fonte por código'));
    // "3.9.02" como fonte não existe: precisa associar
    expect(a.proposta.nomes.fonte.find((n) => n.nome === '3.9.02')?.valor).toBeNull();
  });
});

describe('Baixar planilha', () => {
  async function comCodigos() {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Grupo =cmd', rh: false, codigo_conta: '3.1.02.001' });
    await salvarFonte(p, f, { nome: 'Fonte baixar', natureza: 'publica', uso: 'restrita', codigo_conta: '4.1.01.001' });
    const c = await listarCadastros(p, f);
    const prev = await lerPrevisao(p, f, 2027);
    await salvarDespesa(p, f, {
      ano: 2027, servico: 'escola', grupo_id: c.grupos.ativos.find((g) => g.nome === 'Grupo =cmd')!.id,
      fonte_id: c.fontes.ativos.find((x) => x.nome === 'Fonte baixar')!.id, descricao: 'Item com código',
      quantidade: 2, ocorrencias: 1, valor_unitario: 50.25, distribuicao: 'igual',
    });
    return { f, prev };
  }

  it('cadastros: nome, código e demais campos; texto do usuário não vira fórmula', async () => {
    const { f } = await comCodigos();
    const g = await baixarCadastrosCsv(p, f, 'grupo');
    expect(g.nome).toBe('grupos-de-gasto.csv');
    expect(g.conteudo).toContain('Nome;Código da conta;Tipo');
    expect(g.conteudo).toContain("'Grupo =cmd;3.1.02.001;Despesa geral".replace("'Grupo", 'Grupo'));
    const fo = await baixarCadastrosCsv(p, f, 'fonte');
    expect(fo.conteudo).toContain('Fonte baixar;4.1.01.001;Pública;Restrita');
  });

  it('despesas: códigos do grupo e da fonte em colunas próprias, valor como número puro', async () => {
    const { f } = await comCodigos();
    const d = await baixarItensCsv(p, f, 'despesa', 2027);
    expect(d.nome).toBe('despesas-2027.csv');
    const linhas = d.conteudo.split('\r\n');
    expect(linhas[0]).toContain('Código da conta do grupo;Item contábil;Área do plano;Fonte;Código da conta da fonte');
    const linha = linhas.find((l) => l.includes('Item com código'))!;
    expect(linha).toContain('3.1.02.001;;;Fonte baixar;4.1.01.001;Item com código;100,5;');
    expect(linha).not.toContain('R$');
  });

  it('receitas: código da fonte; sem itens recusa com aviso simples', async () => {
    const { f } = await comCodigos();
    const r = await baixarItensCsv(p, f, 'receita', 2027);
    expect(r.conteudo.split('\r\n')[0]).toContain('Código da conta da fonte');
    await expect(baixarItensCsv(p, f, 'receita', 2031)).rejects.toThrow(/Nada para baixar/);
  });

  it('a folha entra só como total por serviço (nunca valor de pessoa); quem não vê a lista não baixa', async () => {
    const { f } = await comCodigos();
    await popularFolhaFicticia(p);
    const postos = (await lerTabela(p, Postos)).ativos();
    const arquivo = await baixarItensCsv(p, f, 'despesa', 2027);
    expect(arquivo.conteudo).toContain('RH automático da folha');
    for (const colaborador of postos.map((x) => x.colaborador).filter(Boolean)) expect(arquivo.conteudo).not.toContain(String(colaborador));
    const leitura = await como('leitura@exemplo.local');
    expect((await baixarItensCsv(p, leitura, 'despesa', 2027)).conteudo).toContain('RH automático da folha');
    await expect(baixarItensCsv(p, await como('dp@exemplo.local'), 'despesa', 2027)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(baixarCadastrosCsv(p, await como('coord.ur@exemplo.local'), 'grupo')).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('baixar não grava nada nem audita', async () => {
    const { f } = await comCodigos();
    const antes = (await lerTabela(p, RegistrosAuditoria)).todos().length;
    await baixarCadastrosCsv(p, f, 'grupo');
    await baixarItensCsv(p, f, 'despesa', 2027);
    expect((await lerTabela(p, RegistrosAuditoria)).todos()).toHaveLength(antes);
  });
});
