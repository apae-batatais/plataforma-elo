/**
 * Folha: quem vê, quem altera, e as regras aplicadas pelos casos de uso.
 * Só dados fictícios.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura, type EstruturaDosModulos } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Perfis, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  encerrarPosto, ErroValidacaoFolha, fichaDoPosto, gradeDeRateio, listarPostos, resumoFolha, salvarParametros, salvarPosto, salvarRateios,
} from '../aplicacao/folha';
import { popularFolhaFicticia } from '../dados/ficticios';
import { Postos, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { componentesZerados, parametrosCom } from '../dominio/folha';
import { manifesto } from '../manifesto';

const ESTRUTURA: EstruturaDosModulos = {
  tabelas: [...TABELAS_ORCAMENTO] as never,
  perfis: manifesto.perfis,
  permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
};

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

const financeiro = () => como('financeiro@exemplo.local');
const dp = () => como('dp@exemplo.local');

function novoPosto(extra: Partial<Parameters<typeof salvarPosto>[2]> = {}): Parameters<typeof salvarPosto>[2] {
  return {
    ficha: '9001',
    colaborador: 'Pessoa Fictícia de Teste',
    cargo: 'professor',
    nivel: 'A',
    cargaHoraria: 30,
    inicio: '2020-02-01',
    observacao: null,
    componentes: { ...componentesZerados(), salario_base: 3000 },
    rateio: [{ centro: 'edu_escola', percentual: 100 }],
    vigencia: '2027-01-01',
    ...extra,
  };
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
  await prepararEstrutura(p, ESTRUTURA);
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
});

describe('resumo por centro de custo (totais)', () => {
  it('Financeiro vê todas as áreas, com alertas; o total bate com a soma dos centros', async () => {
    const r = await resumoFolha(p, await financeiro());
    expect(r.todasAsAreas).toBe(true);
    expect(new Set(r.centros.map((c) => c.area)).size).toBeGreaterThan(4);
    expect(r.alertas?.semRateio).toBe(2);
    expect(r.alertas?.vagasPrevistas).toBe(2);
    expect(r.total.anual).toBeCloseTo(r.centros.reduce((s, c) => s + c.anual, 0), 1);
  });

  it('coordenação com escopo de área vê só os centros da própria área, sem alertas', async () => {
    const r = await resumoFolha(p, await como('coord.educacao@exemplo.local'));
    expect(r.todasAsAreas).toBe(false);
    expect(r.centros.length).toBeGreaterThan(0);
    expect(r.centros.every((c) => c.area === 'educacao')).toBe(true);
    expect(r.alertas).toBeNull();
  });

  it('coordenação de um serviço (sem escopo de área) não vê centros', async () => {
    expect((await resumoFolha(p, await como('coord.ur@exemplo.local'))).centros).toEqual([]);
  });

  it('Leitura vê totais; quem não tem permissão é recusado', async () => {
    expect((await resumoFolha(p, await como('leitura@exemplo.local'))).centros.length).toBeGreaterThan(0);
    await expect(resumoFolha(p, await como('tecnico.cer@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('valores individuais (regra 11)', () => {
  it('só Diretoria, Financeiro e Departamento Pessoal veem postos; Leitura e coordenação não', async () => {
    expect((await listarPostos(p, await como('diretoria@exemplo.local'))).postos.length).toBeGreaterThan(20);
    expect((await listarPostos(p, await dp())).postos.length).toBeGreaterThan(20);
    await expect(listarPostos(p, await como('leitura@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
    await expect(listarPostos(p, await como('coord.educacao@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('abrir a lista e a ficha registra auditoria de leitura, sem nomes nem valores', async () => {
    const lista = await listarPostos(p, await dp());
    const posto = lista.postos.find((x) => x.colaborador)!;
    const ficha = await fichaDoPosto(p, await dp(), posto.id);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(auditoria.filter((a) => a.acao === 'leitura' && a.entidade === 'Postos').map((a) => a.registro_id)).toEqual([null, posto.id]);
    const texto = JSON.stringify(auditoria);
    expect(texto).not.toContain(posto.colaborador!);
    expect(texto).not.toContain(String(ficha.componentes.salario_base));
  });
});

describe('cadastro do posto e do rateio', () => {
  it('Departamento Pessoal cadastra; o posto entra no resumo do centro', async () => {
    const antes = (await resumoFolha(p, await financeiro())).centros.find((c) => c.codigo === 'edu_escola')!.anual;
    await salvarPosto(p, await dp(), novoPosto());
    const depois = (await resumoFolha(p, await financeiro())).centros.find((c) => c.codigo === 'edu_escola')!.anual;
    expect(depois).toBeGreaterThan(antes + 36000);
  });

  it('rateio fora de 100% não é salvo (regra 3)', async () => {
    await expect(
      salvarPosto(p, await dp(), novoPosto({ rateio: [{ centro: 'edu_escola', percentual: 60 }, { centro: 'edu_transporte', percentual: 53 }] })),
    ).rejects.toThrow(/113%/);
    expect((await lerTabela(p, Postos)).todos().some((x) => x.ficha === '9001')).toBe(false);
  });

  it('todo posto precisa de rateio, com centros que existem, e a ficha não se repete (regras 4 e 7)', async () => {
    await expect(salvarPosto(p, await dp(), novoPosto({ rateio: [] }))).rejects.toBeInstanceOf(ErroValidacaoFolha);
    await expect(salvarPosto(p, await dp(), novoPosto({ rateio: [{ centro: 'nao_existe', percentual: 100 }] }))).rejects.toThrow(/não existe/);
    await salvarPosto(p, await dp(), novoPosto());
    await expect(salvarPosto(p, await dp(), novoPosto())).rejects.toThrow(/ficha 9001/);
  });

  it('Diretoria e Leitura não alteram a folha', async () => {
    await expect(salvarPosto(p, await como('diretoria@exemplo.local'), novoPosto())).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarPosto(p, await como('leitura@exemplo.local'), novoPosto())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('mudar o rateio a partir de julho preserva o primeiro semestre (regra 10)', async () => {
    const id = await salvarPosto(p, await dp(), novoPosto());
    const ficha = await fichaDoPosto(p, await dp(), id);
    await salvarPosto(p, await dp(), {
      ...novoPosto(),
      id,
      versao: ficha.posto!.versao,
      rateio: [{ centro: 'edu_transporte', percentual: 100 }],
      vigencia: '2027-07-01',
    });
    const r = await resumoFolha(p, await financeiro());
    const transporte = r.centros.find((c) => c.codigo === 'edu_transporte')!;
    const escola = r.centros.find((c) => c.codigo === 'edu_escola')!;
    // O custo do posto aparece na Escola de janeiro a junho e no Transporte de julho em diante.
    const custo = (await listarPostos(p, await dp())).postos.find((x) => x.id === id)!.custoMensal;
    expect(escola.mensal[5] - escola.mensal[6]).toBeCloseTo(custo, 1);
    expect(transporte.mensal[6] - transporte.mensal[5]).toBeCloseTo(custo, 1);
    // Nada foi apagado: as linhas do rateio antigo continuam na planilha.
    expect((await lerTabela(p, Postos)).todos().filter((x) => x.id === id)).toHaveLength(1);
  });

  it('desligamento tira o custo dos meses seguintes', async () => {
    const id = await salvarPosto(p, await dp(), novoPosto());
    const ficha = await fichaDoPosto(p, await dp(), id);
    await encerrarPosto(p, await dp(), id, ficha.posto!.versao, '2027-03-20');
    const posto = (await listarPostos(p, await dp())).postos.find((x) => x.id === id)!;
    expect(posto.custoAnual).toBeCloseTo(posto.custoMensal * 3, 1);
  });
});

describe('rateio geral', () => {
  it('corrige vários postos de uma vez e zera o alerta "sem rateio"', async () => {
    const grade = await gradeDeRateio(p, await dp());
    const sem = grade.postos.filter((x) => x.situacao === 'sem_rateio');
    expect(sem).toHaveLength(2);
    const n = await salvarRateios(p, await dp(), [
      ...sem.map((x) => ({ postoId: x.id, rateio: [{ centro: 'adm_geral', percentual: 100 }] })),
      { postoId: grade.postos[0].id, rateio: grade.postos[0].rateio }, // sem mudança: ignorado
    ], '2027-01-01');
    expect(n).toBe(2);
    expect((await resumoFolha(p, await financeiro())).alertas?.semRateio).toBe(0);
  });

  it('recusa o lote inteiro se algum rateio não fecha 100%', async () => {
    const grade = await gradeDeRateio(p, await dp());
    const [a, b] = grade.postos;
    await expect(
      salvarRateios(p, await dp(), [
        { postoId: a.id, rateio: [{ centro: 'adm_geral', percentual: 100 }] },
        { postoId: b.id, rateio: [{ centro: 'adm_geral', percentual: 125 }] },
      ], '2027-01-01'),
    ).rejects.toThrow(/125%/);
    expect((await gradeDeRateio(p, await dp())).postos.find((x) => x.id === a.id)!.rateio).toEqual(a.rateio);
  });
});

describe('parâmetros', () => {
  it('só o Financeiro altera; o reajuste aumenta o custo a partir do mês definido', async () => {
    await expect(salvarParametros(p, await dp(), parametrosCom({ reajuste_percentual: 5, reajuste_mes: 5 }))).rejects.toBeInstanceOf(ErroPermissao);
    const antes = await resumoFolha(p, await financeiro());
    await salvarParametros(p, await financeiro(), parametrosCom({ reajuste_percentual: 5, reajuste_mes: 5 }));
    const depois = await resumoFolha(p, await financeiro());
    expect(depois.total.mensal[3]).toBe(antes.total.mensal[3]);
    expect(depois.total.mensal[4]).toBeGreaterThan(antes.total.mensal[4]);
  });
});

describe('Preparar estrutura em planilhas já em uso', () => {
  it('cria o perfil Departamento Pessoal e liga as permissões, sem duplicar ao rodar de novo', async () => {
    const perfis = (await lerTabela(p, Perfis)).todos();
    expect(perfis.filter((x) => x.codigo === 'departamento_pessoal')).toHaveLength(1);
    expect((await prepararEstrutura(p, ESTRUTURA)).registrosIniciais).toBe(0);
  });
});
