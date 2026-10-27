/**
 * Importação da planilha da folha, com um arquivo FICTÍCIO no mesmo formato
 * (abas Tabela Salarial, Estudo, Rateio e a aba anual quebrada).
 */
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { listarPostos, resumoFolha } from '../aplicacao/folha';
import { analisarImportacao, importarFolha, lerXlsx } from '../aplicacao/importacao';
import { Postos, Rateios, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { lerPlanilhaFolha, paraData, paraNumero } from '../dominio/importacao';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

/** Planilha fictícia no formato da "Folha Pagamento 2027". */
async function arquivoFicticio(): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const tab = livro.addWorksheet('Tabela Salarial');
  tab.addRow(['PLANO DE CARGOS E SALÁRIOS 2027 (fictício)']);
  tab.addRow([]);
  tab.addRow(['Grupo', 'Cargo', 'Requisitos', 'Classe', 'C.H.', 'A', 'B', 'C', 'D']);
  tab.addRow(['Educação', 'Professora de Educação Especial', 'Pedagogia', 'III', 30, 3000, 3120, 3244.8, 3374.59]);
  tab.addRow(['Apoio', 'Cuidadora', 'Ensino médio', 'I', 40, 1900, 1976, 2055.04, 2137.24]);

  const est = livro.addWorksheet('Estudo');
  est.addRow(['Ficha', 'Nome', 'Cargo', 'Nível', 'CH', 'Admissão', 'Salário Base', 'Adicional', 'Insalubridade', 'Alimentação', 'Plano de Saúde', 'Férias', '1/3 Férias', '13º', 'FGTS', 'Total', 'Obs. interna']);
  est.addRow([101, 'Maria Exemplo da Silva', 'Professora de Educação Especial', 'B', 30, new Date(Date.UTC(2015, 2, 2)), 3120, 0, 0, 450, 180, 260, 86.67, 260, 249.6, 4606.27, 'x']);
  est.addRow([102, 'João Exemplo Souza', 'Cuidadora', 'A', 40, '10/08/2019', 1900, 0, 303.6, 450, 0, 0, 0, 0, 0, 3258.27, '']);
  est.addRow([103, 'Ana Exemplo Lima', 'Cuidadora', 'C', 40, '2021-05-03', 2055.04, 0, 303.6, 450, 0, 0, 0, 0, 0, 9999, '']);
  est.addRow([104, 'Paulo Exemplo Reis', 'Motorista', null, 44, '2018-01-15', 2400, 0, 0, 450, 0, 0, 0, 0, 0, null, '']);
  est.addRow([null, 'VAGA - Centro Dia', 'Cuidadora', 'A', 40, '2027-03-01', 1900, 0, 303.6, 450, 0, 0, 0, 0, 0, null, '']);
  est.addRow([null, 'TOTAL', null, null, null, null, 11375.04, 0, 910.8, 2250, 180, 0, 0, 0, 0, 0, '']);

  const rat = livro.addWorksheet('Rateio');
  rat.addRow(['Ficha', 'Nome', 'Escola', 'Centro Dia Intergeracional', 'Apae Rural › Viveiro de mudas', 'Soma']);
  rat.addRow([101, 'Maria Exemplo da Silva', 1, null, null, 1]);
  rat.addRow([102, 'João Exemplo Souza', null, 0.5, 0.5, 1]);
  rat.addRow([103, 'Ana Exemplo Lima', 0.63, 0.5, null, 1.13]); // 113%: não pode ser gravado
  // 104 sem rateio

  const anual = livro.addWorksheet('Folha Pagto Anual 2027');
  anual.addRow(['Mês', 'Total']);
  anual.addRow(['Jan', { formula: '#REF!', result: { error: '#REF!' } } as never]);

  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

describe('leitura da planilha', () => {
  it('converte números e datas no formato brasileiro', () => {
    expect(paraNumero('R$ 1.234,56')).toBe(1234.56);
    expect(paraNumero('3120,5')).toBe(3120.5);
    expect(paraNumero(1900)).toBe(1900);
    expect(paraData('10/08/2019')).toBe('2019-08-10');
    expect(paraData(43687)).toBe('2019-08-10');
  });

  it('reconhece as abas e colunas, ignora linha de total e marca as provisões como calculadas pelo app', async () => {
    const l = lerPlanilhaFolha(await lerXlsx(await arquivoFicticio()));
    expect(l.abas).toEqual({ tabela: 'Tabela Salarial', estudo: 'Estudo', rateio: 'Rateio' });
    expect(l.cargos.map((c) => c.nome)).toEqual(['Professora de Educação Especial', 'Cuidadora']);
    expect(l.cargos[0].valores).toEqual({ A: 3000, B: 3120, C: 3244.8, D: 3374.59 });
    expect(l.postos).toHaveLength(5);
    expect(l.postos[4]).toMatchObject({ ficha: null, colaborador: null, inicio: '2027-03-01' });
    expect(l.colunasCalculadas).toEqual(expect.arrayContaining(['ferias', '1 3 ferias', '13', 'fgts']));
    expect(l.colunasIgnoradas).toEqual([{ aba: 'Estudo', colunas: ['obs interna'] }]);
    expect(l.rateios.get('102')).toEqual([
      { centro: 'Centro Dia Intergeracional', percentual: 50 },
      { centro: 'Apae Rural › Viveiro de mudas', percentual: 50 },
    ]);
  });
});

describe('análise antes de gravar', () => {
  it('mostra rateios fora de 100%, postos sem rateio, cargos e centros novos e diferenças de custo', async () => {
    const a = await analisarImportacao(p, await como('dp@exemplo.local'), await lerXlsx(await arquivoFicticio()));
    const r = a.relatorio;
    expect(r.postos).toEqual({ total: 5, vagas: 1, comRateio: 2 });
    expect(r.rateiosForaDe100).toEqual([{ ficha: '103', colaborador: 'Ana Exemplo Lima', soma: 113 }]);
    expect(r.postosSemRateio.map((x) => x.ficha)).toEqual(['104', null]);
    expect(r.cargos.novos).toBe(3); // Motorista não está na tabela salarial
    expect(r.centrosNovos).toBe(3);
    expect(r.diferencasCusto.map((d) => d.ficha)).toContain('103');
    // Nada foi gravado na folha.
    expect((await lerTabela(p, Postos)).todos()).toHaveLength(0);
  });

  it('Diretoria e Leitura não importam', async () => {
    const abas = await lerXlsx(await arquivoFicticio());
    await expect(analisarImportacao(p, await como('diretoria@exemplo.local'), abas)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(analisarImportacao(p, await como('leitura@exemplo.local'), abas)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('arquivo que não é planilha recebe mensagem clara', async () => {
    await expect(lerXlsx(new TextEncoder().encode('não é xlsx').buffer as ArrayBuffer)).rejects.toThrow(/\.xlsx/);
  });
});

describe('confirmação', () => {
  it('exige a área dos centros novos; depois grava tudo e o resumo passa a mostrar a folha', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    await expect(importarFolha(p, dp, a.proposta)).rejects.toThrow(/área do centro/);

    const proposta = { ...a.proposta, centrosNovos: a.proposta.centrosNovos.map((c) => ({ ...c, area: 'assistencia_social' })) };
    expect(await importarFolha(p, dp, proposta)).toEqual({ postos: 5 });

    const lista = await listarPostos(p, dp);
    expect(lista.postos.find((x) => x.ficha === '103')?.situacaoRateio).toBe('sem_rateio');
    expect(lista.postos.find((x) => x.ficha === '102')?.situacaoRateio).toBe('ok');
    const resumo = await resumoFolha(p, await como('financeiro@exemplo.local'));
    expect(resumo.alertas?.semRateio).toBe(3);
    expect(resumo.total.anual).toBeGreaterThan(0);
    // Nenhum rateio fora de 100% foi gravado.
    const somas = new Map<string, number>();
    for (const r of (await lerTabela(p, Rateios)).todos()) somas.set(r.lote, (somas.get(r.lote) ?? 0) + r.percentual);
    expect([...somas.values()].every((s) => Math.abs(s - 100) < 1e-9)).toBe(true);
  });

  it('importar o mesmo arquivo de novo não duplica fichas', async () => {
    const dp = await como('dp@exemplo.local');
    const primeira = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    await importarFolha(p, dp, { ...primeira.proposta, centrosNovos: primeira.proposta.centrosNovos.map((c) => ({ ...c, area: 'educacao' })) });
    const segunda = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    expect(segunda.relatorio.fichasJaCadastradas).toEqual(['101', '102', '103', '104']);
    expect(segunda.relatorio.cargos.novos).toBe(0);
    expect(segunda.relatorio.centrosNovos).toBe(0);
    await importarFolha(p, dp, segunda.proposta);
    expect((await lerTabela(p, Postos)).todos().filter((x) => x.ficha)).toHaveLength(4);
  });

  it('a auditoria registra a importação sem nomes nem valores', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    await importarFolha(p, dp, { ...a.proposta, centrosNovos: a.proposta.centrosNovos.map((c) => ({ ...c, area: 'educacao' })) });
    const texto = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos());
    expect(texto).toContain('ImportacaoFolha');
    expect(texto).not.toContain('Maria Exemplo');
    expect(texto).not.toContain('3120');
  });
});
