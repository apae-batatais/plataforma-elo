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
import { analisarImportacao, descreverArquivo, importarFolha, lerXlsx, type PropostaImportacao } from '../aplicacao/importacao';
import { Postos, Rateios, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { conferirMapeamento, lerPlanilhaFolha, mapeamentoSugerido, paraData, paraNumero, type Mapeamento } from '../dominio/importacao';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
}

const CABECALHO_ESTUDO = [
  'Código',
  'Nome',
  'Admissão',
  'Cargo',
  'Departamento',
  'Lotação',
  'Carga Horaria',
  'Valor Hora',
  'Salario Atual',
  'Reajuste',
  'VHora Base',
  'SalárioBase',
  'Adicional Salarial',
  'Hora Atividade',
  'Ajuda de Custo',
  'Bolsa Estágio',
  'Insalubridade',
  'Periculosidade',
  'G. Função',
  'Plano de Saúde',
  'Bolsa Estudo',
  'Locomoção',
  'Alimentação',
  'FÉRIAS',
  '1/3 FÉRIAS',
  'ABONO',
  'INDEZ.',
  '13º SAL',
  'FGTS',
  'TOTAL',
  'Coluna 1',
];

/** Uma linha da aba Estudo com valores FICTÍCIOS (as colunas com fórmula levam o resultado, como no .xlsx baixado). */
function linha(d: {
  codigo?: number;
  nome: string;
  admissao?: Date | string;
  cargo: string;
  lotacao?: string;
  salario: number;
  ha?: boolean;
  insal?: number;
  bolsa?: number;
  total?: number;
}) {
  const sb = d.salario * 1.05;
  const ha = d.ha ? sb * 0.05 : 0;
  const terco = sb / 36;
  const dec = sb / 12;
  const fgts = (sb + ha + (d.insal ?? 0) + terco + dec) * 0.08;
  const total = sb + ha + (d.insal ?? 0) + (d.bolsa ?? 0) + 340 + terco + dec + fgts;
  return [
    d.codigo ?? null,
    d.nome,
    d.admissao ?? null,
    d.cargo,
    null,
    d.lotacao ?? null,
    200,
    d.salario / 200,
    d.salario,
    0.05,
    sb / 200,
    sb,
    null,
    d.ha ? ha : null,
    null,
    d.bolsa ?? null,
    d.insal ?? null,
    null,
    null,
    null,
    null,
    null,
    340,
    null,
    terco,
    null,
    null,
    dec,
    fgts,
    d.total ?? total,
    null,
  ];
}

/** Planilha fictícia no formato da aba "Estudo" da "Folha Pagamento 2027", com o resumo abaixo da relação. */
async function arquivoFicticio(opcoes: { abaRateio?: boolean } = {}): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const est = livro.addWorksheet('Estudo');
  est.addRow([]);
  est.addRow([]);
  est.addRow(CABECALHO_ESTUDO);
  est.addRow(
    linha({
      codigo: 101,
      nome: 'MARIA EXEMPLO DA SILVA',
      admissao: new Date(Date.UTC(2015, 2, 2)),
      cargo: 'PROFESSOR(A)',
      lotacao: 'Educação',
      salario: 3000,
      ha: true,
    }),
  );
  est.addRow(
    linha({
      codigo: 102,
      nome: 'JOÃO EXEMPLO SOUZA',
      admissao: '10/08/2019',
      cargo: 'CUIDADOR(A)',
      salario: 1900,
    }),
  );
  est.addRow(
    linha({
      codigo: 103,
      nome: 'ANA EXEMPLO LIMA',
      admissao: '2021-05-03',
      cargo: 'CUIDADOR(A)',
      lotacao: 'Saúde',
      salario: 1957.2,
      insal: 303.6,
      total: 9999,
    }),
  );
  est.addRow(
    linha({
      codigo: 104,
      nome: 'PAULO EXEMPLO REIS',
      admissao: '2018-01-15',
      cargo: 'MOTORISTA',
      lotacao: 'Escola',
      salario: 2400,
    }),
  );
  est.addRow(
    linha({
      nome: 'A contratar - Cuidador(a)',
      cargo: 'CUIDADOR(A)',
      salario: 1900,
    }),
  );
  est.addRow(
    linha({
      nome: 'Estagiários',
      cargo: 'ESTAGIÁRIO',
      salario: 0,
      bolsa: 1406.76,
    }),
  );
  est.addRow([null, null, null, null, null, null, null, null, 11157.2]); // linha de soma da tabela
  est.addRow([null, 'Total', null, null, null, null, null, null, 11157.2]);
  est.addRow([null, null, null, null, null, null, null, null, null, null, null, 'a', 'a', 'a', 'h', 'i', 'b']);
  est.addRow([]);
  est.addRow([null, 'REMUNERAÇÃO SALARIAL']);
  est.addRow(['a', 'Vencimentos e Salários', 12345.67]);
  est.addRow([0.2, 'INSS - 20% Empresa', 2469.13]);
  est.addRow([null, 'TOTAL GERAL', 99999]);
  if (opcoes.abaRateio) {
    const rat = livro.addWorksheet('Rateio');
    rat.addRow(['Código', 'Nome', 'escola', 'Centro Dia Intergeracional', 'Apae Rural › Viveiro de mudas']);
    rat.addRow([102, 'JOÃO', 0.5, 0.5, null]);
    rat.addRow([104, 'PAULO', 0.63, 0.5, null]); // 113%: não pode ser gravado
  }
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

beforeEach(async () => {
  p = {
    armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']),
    idDe: (c) => c,
  };
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

  it('lê a aba Estudo: todas as colunas, vagas sem código, e para antes do resumo', async () => {
    const l = lerPlanilhaFolha(await lerXlsx(await arquivoFicticio()));
    expect(l.abas).toEqual({ estudo: 'Estudo', rateio: null });
    expect(l.postos.map((x) => x.ficha)).toEqual(['101', '102', '103', '104', null, null]);
    expect(l.postos[0]).toMatchObject({
      colaborador: 'MARIA EXEMPLO DA SILVA',
      cargo: 'PROFESSOR(A)',
      inicio: '2015-03-02',
      cargaHoraria: 200,
      reajuste: 5,
      horaAtividade: true,
    });
    expect(l.postos[0].componentes).toMatchObject({
      salario_atual: 3000,
      alimentacao: 340,
    });
    expect(l.postos[4]).toMatchObject({
      ficha: null,
      colaborador: 'A contratar - Cuidador(a)',
    });
    expect(l.postos[5].componentes.bolsa_estagio).toBe(1406.76);
    expect(l.colunasCalculadas.sort()).toEqual(['1 3 ferias', '13 sal', 'coluna 1', 'fgts', 'salariobase', 'valor hora', 'vhora base']);
    expect(l.colunasIgnoradas).toEqual([]);
    // Sem aba Rateio, a coluna "Lotação" vale 100%.
    expect(l.postos[0].lotacao).toEqual([{ centro: 'Educação', percentual: 100 }]);
    expect(l.postos[1].lotacao).toBeNull();
  });

  it('o cálculo do app bate com a coluna TOTAL da planilha', async () => {
    const a = await analisarImportacao(p, await como('dp@exemplo.local'), await lerXlsx(await arquivoFicticio()));
    expect(a.relatorio.diferencasCusto.map((d) => d.ficha)).toEqual(['103']); // a 103 tem TOTAL digitado errado na planilha
  });
});

describe('análise antes de gravar', () => {
  it('mostra quem está sem lotação, as lotações a escolher e não grava nada', async () => {
    const a = await analisarImportacao(p, await como('dp@exemplo.local'), await lerXlsx(await arquivoFicticio()));
    const r = a.relatorio;
    expect(r.postos).toEqual({ total: 6, vagas: 2, comLotacao: 3 });
    expect(r.semLotacao.map((x) => x.ficha)).toEqual(['102', null, null]);
    // "Escola" é reconhecida (código do serviço); "Educação" e "Saúde" a pessoa escolhe.
    expect(r.servicos).toEqual({ reconhecidos: 1, aEscolher: 2 });
    expect((await lerTabela(p, Postos)).todos()).toHaveLength(0);
  });

  it('com aba Rateio, a lotação pode ser dividida; fora de 100% não é gravada', async () => {
    const a = await analisarImportacao(p, await como('dp@exemplo.local'), await lerXlsx(await arquivoFicticio({ abaRateio: true })));
    expect(a.relatorio.abas.rateio).toBe('Rateio');
    expect(a.relatorio.lotacoesForaDe100).toEqual([{ ficha: '104', colaborador: 'PAULO EXEMPLO REIS', soma: 113 }]);
    expect(a.proposta.postos.find((x) => x.ficha === '102')?.lotacao).toHaveLength(2);
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

const ESCOLHAS: Record<string, string> = {
  Educação: 'escola',
  Saúde: 'cer_reabilitacao',
};
const mapear = (proposta: PropostaImportacao, escolhas = ESCOLHAS): PropostaImportacao => ({
  ...proposta,
  servicos: proposta.servicos.map((m) => ({
    ...m,
    servico: escolhas[m.nome] ?? m.servico,
  })),
});

describe('confirmação', () => {
  it('exige escolher o serviço de cada lotação; depois grava tudo e o resumo passa a mostrar a folha', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    await expect(importarFolha(p, dp, a.proposta)).rejects.toThrow(/Escolha o serviço correspondente a: Educação, Saúde/);
    expect(await importarFolha(p, dp, mapear(a.proposta))).toEqual({
      postos: 6,
      lotacoes: 0,
    });

    const lista = await listarPostos(p, dp);
    expect(lista.postos.find((x) => x.ficha === '101')).toMatchObject({
      situacaoRateio: 'ok',
      centros: ['escola'],
    });
    expect(lista.postos.find((x) => x.ficha === '102')?.situacaoRateio).toBe('sem_rateio');
    const resumo = await resumoFolha(p, await como('financeiro@exemplo.local'));
    expect(resumo.alertas?.semRateio).toBe(3);
    expect(resumo.estudoMes.pessoas).toBe(6);
    expect(
      resumo.centros
        .map((c) => c.codigo)
        .filter((c) => !c.startsWith('__'))
        .sort(),
    ).toEqual(['cer_reabilitacao', 'escola']);
  });

  it('importar o mesmo arquivo de novo não duplica funcionários nem vagas', async () => {
    const dp = await como('dp@exemplo.local');
    await importarFolha(p, dp, mapear((await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()))).proposta));
    const segunda = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    expect(segunda.relatorio.fichasJaCadastradas).toEqual(['101', '102', '103', '104']);
    expect(segunda.relatorio.vagasJaCadastradas).toBe(2);
    expect(segunda.proposta.postos).toHaveLength(0);
    expect((await lerTabela(p, Postos)).todos()).toHaveLength(6);
  });

  it('a auditoria registra a importação sem nomes nem valores', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio()));
    await importarFolha(p, dp, mapear(a.proposta));
    const texto = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos());
    expect(texto).toContain('ImportacaoFolha');
    expect(texto).not.toContain('MARIA EXEMPLO');
    expect(texto).not.toContain('3000');
  });

  it('dois nomes da planilha que caem no mesmo serviço são somados na lotação', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoFicticio({ abaRateio: true })));
    await importarFolha(
      p,
      dp,
      mapear(a.proposta, {
        ...ESCOLHAS,
        'Centro Dia Intergeracional': 'escola',
      }),
    );
    const lista = await listarPostos(p, dp);
    expect(lista.postos.find((x) => x.ficha === '102')).toMatchObject({
      situacaoRateio: 'ok',
      centros: ['escola'],
    });
    const somas = new Map<string, number>();
    for (const r of (await lerTabela(p, Rateios)).todos()) somas.set(r.lote, (somas.get(r.lote) ?? 0) + r.percentual);
    expect([...somas.values()].every((s) => Math.abs(s - 100) < 1e-9)).toBe(true);
  });
});

/** Planilha FICTÍCIA com nomes de abas e colunas diferentes, para o DE-PARA escolhido pela pessoa. */
async function arquivoOutroFormato(): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  livro.addWorksheet('Capa').addRow(['Folha fictícia']);
  const f = livro.addWorksheet('Pessoal 2027');
  f.addRow(['Relação de pessoal']);
  f.addRow(['Mat.', 'Empregado', 'Função exercida', 'Remuneração', 'VA', 'Observação']);
  f.addRow([7, 'CARLA EXEMPLO', 'PSICÓLOGO(A)', 4200, 340, 'qualquer']);
  f.addRow([8, 'DIEGO EXEMPLO', 'MOTORISTA', 2400, 340, null]);
  f.addRow([null, 'A contratar', 'CUIDADOR(A)', 1900, 0, null]);
  const r = livro.addWorksheet('Distribuição');
  r.addRow(['Quem', 'Onde', 'Quanto']);
  r.addRow(['7', 'Centro Dia Intergeracional', '60%']);
  r.addRow(['7', 'escola', '40%']);
  r.addRow(['DIEGO EXEMPLO', 'escola', '100%']); // achado pelo nome
  r.addRow([99, 'escola', '100%']); // não está na folha
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

const DE_PARA: Mapeamento = {
  folha: {
    aba: 'Pessoal 2027',
    cabecalho: 2,
    colunas: {
      ficha: 0,
      colaborador: 1,
      cargo: 2,
      salario_atual: 3,
      alimentacao: 4,
    },
  },
  lotacao: {
    modo: 'linhas',
    aba: 'Distribuição',
    cabecalho: 1,
    funcionario: 0,
    servico: 1,
    percentual: 2,
  },
};

describe('DE-PARA escolhido na tela', () => {
  it('mostra as abas com as primeiras linhas e sugere aba, cabeçalho e colunas', async () => {
    const abas = await lerXlsx(await arquivoFicticio({ abaRateio: true }));
    const d = descreverArquivo(await como('dp@exemplo.local'), abas);
    expect(d.abas.map((a) => [a.nome, a.cabecalhoSugerido])).toEqual([
      ['Estudo', 3],
      ['Rateio', 1],
    ]);
    expect(d.sugestao?.folha).toMatchObject({
      aba: 'Estudo',
      cabecalho: 3,
      colunas: { ficha: 0, colaborador: 1, cargo: 3, salario_atual: 8 },
    });
    expect(d.sugestao?.lotacao).toEqual({
      modo: 'colunas',
      aba: 'Rateio',
      cabecalho: 1,
      funcionario: 0,
      servicos: [2, 3, 4],
    });
    await expect(async () => descreverArquivo(await como('leitura@exemplo.local'), abas)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('lê qualquer aba e colunas pelo DE-PARA; a lotação acha o funcionário pelo código ou pelo nome', async () => {
    const abas = await lerXlsx(await arquivoOutroFormato());
    expect(mapeamentoSugerido(abas)?.folha.aba).toBe('Pessoal 2027'); // achada pelas colunas, mesmo com outro nome
    const l = lerPlanilhaFolha(abas, DE_PARA);
    expect(l.postos.map((x) => [x.ficha, x.cargo, x.componentes.salario_atual, x.componentes.alimentacao])).toEqual([
      ['7', 'PSICÓLOGO(A)', 4200, 340],
      ['8', 'MOTORISTA', 2400, 340],
      [null, 'CUIDADOR(A)', 1900, 0],
    ]);
    expect(l.postos[0].lotacao).toEqual([
      { centro: 'Centro Dia Intergeracional', percentual: 60 },
      { centro: 'escola', percentual: 40 },
    ]);
    expect(l.postos[1].lotacao).toEqual([{ centro: 'escola', percentual: 100 }]);
    expect(l.postos[2].lotacao).toBeNull();
    expect(l.lotacaoSemFuncionario).toEqual(['99']);
    expect(l.colunasIgnoradas).toEqual([{ aba: 'Pessoal 2027', colunas: ['Observação'] }]);
  });

  it('com o DE-PARA, a análise reconhece os serviços e importa', async () => {
    const dp = await como('dp@exemplo.local');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoOutroFormato()), DE_PARA);
    expect(a.relatorio.servicos).toEqual({ reconhecidos: 2, aEscolher: 0 });
    expect(a.relatorio.lotacaoSemFuncionario).toEqual(['99']);
    expect(await importarFolha(p, dp, a.proposta)).toEqual({
      postos: 3,
      lotacoes: 0,
    });
    const lista = await listarPostos(p, dp);
    expect(lista.postos.find((x) => x.ficha === '7')).toMatchObject({
      situacaoRateio: 'ok',
    });
  });

  it('lotação pela coluna da folha, ou nenhuma', async () => {
    const abas = await lerXlsx(await arquivoFicticio());
    const base = mapeamentoSugerido(abas)!;
    expect(
      lerPlanilhaFolha(abas, {
        ...base,
        lotacao: { modo: 'nenhuma' },
      }).postos.every((x) => x.lotacao === null),
    ).toBe(true);
    expect(lerPlanilhaFolha(abas, { ...base, lotacao: { modo: 'coluna' } }).postos[0].lotacao).toEqual([{ centro: 'Educação', percentual: 100 }]);
  });

  it('recusa DE-PARA incompleto com mensagem clara', async () => {
    const abas = await lerXlsx(await arquivoOutroFormato());
    const semSalario: Mapeamento = {
      ...DE_PARA,
      folha: {
        ...DE_PARA.folha,
        colunas: { ficha: 0, cargo: 2, alimentacao: 2 },
      },
    };
    const erros = conferirMapeamento(abas, semSalario);
    expect(erros.join(' ')).toMatch(/Salário atual/);
    expect(erros.join(' ')).toMatch(/mesma coluna/);
    expect(
      conferirMapeamento(abas, {
        ...DE_PARA,
        folha: { ...DE_PARA.folha, aba: 'Não existe' },
      }),
    ).toEqual(['A aba "Não existe" não existe no arquivo.']);
    expect(
      conferirMapeamento(abas, {
        ...DE_PARA,
        lotacao: { modo: 'coluna' },
      }).join(' '),
    ).toMatch(/coluna "Lotação"/);
    await expect(analisarImportacao(p, await como('dp@exemplo.local'), abas, semSalario)).rejects.toThrow(/Salário atual/);
  });
});

/** Arquivo FICTÍCIO só com a aba de lotação. */
async function arquivoSoLotacao(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const r = livro.addWorksheet('Rateio 2027');
  r.addRow(['Código', 'Serviço', '%']);
  for (const l of linhas) r.addRow(l);
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}
const SO_LOTACAO: Mapeamento = {
  soLotacao: true,
  folha: { aba: 'Rateio 2027', cabecalho: 1, colunas: {} },
  lotacao: {
    modo: 'linhas',
    aba: 'Rateio 2027',
    cabecalho: 1,
    funcionario: 0,
    servico: 1,
    percentual: 2,
  },
};

describe('reimportar e importar a lotação depois', () => {
  async function folhaSemLotacao() {
    const dp = await como('dp@exemplo.local');
    const abas = await lerXlsx(await arquivoOutroFormato());
    const a = await analisarImportacao(p, dp, abas, {
      ...DE_PARA,
      lotacao: { modo: 'nenhuma' },
    });
    await importarFolha(p, dp, a.proposta);
    return dp;
  }
  const centrosDe = async (dp: Autorizador, ficha: string) => (await listarPostos(p, dp)).postos.find((x) => x.ficha === ficha);

  it('reimportar a folha com a aba de rateio inclui a lotação de quem foi importado sem ela, sem duplicar ninguém', async () => {
    const dp = await folhaSemLotacao();
    expect((await centrosDe(dp, '7'))?.situacaoRateio).toBe('sem_rateio');
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoOutroFormato()), DE_PARA);
    expect(a.proposta.postos).toHaveLength(0);
    expect(a.relatorio.lotacoesExistentes.incluir.map((x) => x.ficha)).toEqual(['7', '8']);
    expect(await importarFolha(p, dp, a.proposta)).toEqual({
      postos: 0,
      lotacoes: 2,
    });
    expect(await centrosDe(dp, '7')).toMatchObject({ situacaoRateio: 'ok' });
    expect((await lerTabela(p, Postos)).todos()).toHaveLength(3);

    // De novo, com o mesmo arquivo: nada muda.
    const b = await analisarImportacao(p, dp, await lerXlsx(await arquivoOutroFormato()), DE_PARA);
    expect(b.relatorio.lotacoesExistentes).toMatchObject({
      incluir: [],
      atualizar: [],
      iguais: 2,
    });
    await expect(importarFolha(p, dp, b.proposta)).rejects.toThrow(/Não há nada para importar/);
  });

  it('arquivo só com a lotação: inclui para quem não tem, atualiza a partir da data escolhida e guarda o histórico', async () => {
    const dp = await folhaSemLotacao();
    const abas = await lerXlsx(
      await arquivoSoLotacao([
        [7, 'escola', 100],
        ['DIEGO EXEMPLO', 'escola', 100],
        [99, 'escola', 100],
      ]),
    );
    const a = await analisarImportacao(p, dp, abas, SO_LOTACAO);
    expect(a.relatorio.soLotacao).toBe(true);
    expect(descreverArquivo(dp, abas).sugestao).toMatchObject({
      soLotacao: true,
      lotacao: { modo: 'linhas', funcionario: 0, servico: 1, percentual: 2 },
    }); // percebe que é só lotação; "%" reconhecido
    expect(a.relatorio.lotacoesExistentes.incluir).toHaveLength(2);
    expect(a.relatorio.lotacaoSemFuncionario).toEqual(['99']);
    expect(await importarFolha(p, dp, a.proposta)).toEqual({
      postos: 0,
      lotacoes: 2,
    });

    // Rateio novo para a ficha 7: dividido entre dois serviços.
    const nova = await lerXlsx(
      await arquivoSoLotacao([
        [7, 'escola', 60],
        [7, 'Centro Dia Intergeracional', 40],
        [8, 'escola', 100],
      ]),
    );
    const b = await analisarImportacao(p, dp, nova, SO_LOTACAO);
    expect(b.relatorio.lotacoesExistentes.atualizar.map((x) => x.ficha)).toEqual(['7']);
    expect(b.relatorio.lotacoesExistentes.iguais).toBe(1);
    await expect(importarFolha(p, dp, b.proposta)).rejects.toThrow(/a partir de quando/);
    // Desmarcado "atualizar": nada é gravado.
    await expect(importarFolha(p, dp, { ...b.proposta, atualizarLotacoes: false })).rejects.toThrow(/nada para importar/);
    expect(await importarFolha(p, dp, { ...b.proposta, vigencia: '2027-07-01' })).toEqual({ postos: 0, lotacoes: 1 });

    const posto = (await centrosDe(dp, '7'))!;
    const linhas = (await lerTabela(p, Rateios)).todos().filter((r) => r.posto_id === posto.id);
    expect(new Set(linhas.map((r) => r.lote)).size).toBe(2); // a lotação anterior continua no histórico
    const novas = linhas.filter((r) => r.vigencia === '2027-07-01');
    expect(novas.map((r) => r.percentual).sort()).toEqual([40, 60]);
    expect(novas.find((r) => r.percentual === 60)?.servico).toBe('escola');
  });

  it('lotação que não soma 100% não é gravada; só quem pode editar a folha importa', async () => {
    const dp = await folhaSemLotacao();
    const a = await analisarImportacao(p, dp, await lerXlsx(await arquivoSoLotacao([[7, 'escola', 70]])), SO_LOTACAO);
    expect(a.relatorio.lotacoesForaDe100).toEqual([{ ficha: '7', colaborador: 'CARLA EXEMPLO', soma: 70 }]);
    expect(a.proposta.lotacoes).toHaveLength(0);
    await expect(
      analisarImportacao(p, await como('leitura@exemplo.local'), await lerXlsx(await arquivoSoLotacao([[7, 'escola', 100]])), SO_LOTACAO),
    ).rejects.toBeInstanceOf(ErroPermissao);
  });
});
