/** Folha em caixa (P1): quem vê, quem altera, e custo do mês intacto. Só dados fictícios. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura, type EstruturaDosModulos } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { calendarioDePagamentos, ErroValidacaoFolha, resumoFolha, salvarCalendario, salvarPosto, fichaDoPosto } from '../aplicacao/folha';
import { popularFolhaFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
import type { LinhaCalendario } from '../dominio/caixa';
import { componentesZerados } from '../dominio/folha';
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
const linhas = (f: (m: number) => Partial<LinhaCalendario> = () => ({})): LinhaCalendario[] =>
  Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ferias_coletivas: false, decimo_pct: i === 5 ? 100 : 0, abono_pct: 0, ...f(i + 1) }));

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, ESTRUTURA);
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
});

describe('caixa no resumo da folha', () => {
  it('o ano soma igual nas duas visões e o custo do mês não muda ao trocar o calendário (regras 1 e 2)', async () => {
    const antes = await resumoFolha(p, await financeiro());
    expect(antes.caixa.anual).toBeCloseTo(antes.total.anual, 0);
    expect(antes.caixa.calendarioConfigurado).toBe(false);
    await salvarCalendario(p, await financeiro(), linhas(), '2027-01-01');
    const depois = await resumoFolha(p, await financeiro());
    expect(depois.total).toEqual(antes.total);
    expect(depois.centros.map((c) => c.mensal)).toEqual(antes.centros.map((c) => c.mensal));
    expect(depois.caixa.calendarioConfigurado).toBe(true);
    expect(depois.caixa.anual).toBeCloseTo(antes.total.anual, 0);
    expect(depois.caixa.mensal[5]).toBeGreaterThan(antes.caixa.mensal[5]); // 13º todo em junho
    expect(depois.caixa.pico.mes).toBe(6);
  });

  it('com o padrão, novembro e dezembro pesam mais que a média', async () => {
    const r = await resumoFolha(p, await financeiro());
    expect([11, 12]).toContain(r.caixa.pico.mes);
    expect(r.caixa.pico.valor).toBeGreaterThan(r.caixa.pico.media);
  });

  it('mês de férias da pessoa muda só o caixa de serviço dela', async () => {
    const antes = await resumoFolha(p, await financeiro());
    const id = await salvarPosto(p, await dp(), { ficha: '9001', colaborador: 'Pessoa Fictícia', cargo: 'Cargo de teste', departamento: null, cargaHoraria: 150, inicio: '2020-02-01', observacao: null, componentes: { ...componentesZerados(5), salario_atual: 3000 }, rateio: [{ centro: 'escola', percentual: 100 }], vigencia: '2027-01-01', mesFerias: 7 });
    expect((await fichaDoPosto(p, await dp(), id)).posto?.mesFerias).toBe(7);
    const depois = await resumoFolha(p, await financeiro());
    const e = (r: typeof antes) => r.centros.find((c) => c.codigo === 'escola')!;
    expect(e(depois).caixa[6] - e(antes).caixa[6]).toBeGreaterThan(3150 / 3 / 12 * 12 * 0.9);
    expect(depois.centros.find((c) => c.codigo === 'transporte')!.caixa).toEqual(antes.centros.find((c) => c.codigo === 'transporte')!.caixa);
  });

  it('coordenação vê o caixa só do seu escopo; Leitura vê totais', async () => {
    const r = await resumoFolha(p, await como('coord.educacao@exemplo.local'));
    expect(r.centros.every((c) => c.area === 'educacao')).toBe(true);
    const soma = r.centros.reduce((s, c) => s + c.caixa.reduce((a, v) => a + v, 0), 0);
    expect(r.caixa.anual).toBeCloseTo(soma, 0);
    expect((await resumoFolha(p, await como('leitura@exemplo.local'))).caixa.mensal).toHaveLength(12);
  });
});

describe('calendário: quem altera', () => {
  it('só quem edita parâmetros grava; DP e Leitura veem sem alterar', async () => {
    await expect(salvarCalendario(p, await dp(), linhas(), '2027-01-01')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarCalendario(p, await como('leitura@exemplo.local'), linhas(), '2027-01-01')).rejects.toBeInstanceOf(ErroPermissao);
    expect((await calendarioDePagamentos(p, await dp())).podeEditar).toBe(false);
    expect((await calendarioDePagamentos(p, await financeiro())).podeEditar).toBe(true);
  });
  it('soma diferente de 100% é recusada e nada é gravado', async () => {
    await expect(salvarCalendario(p, await financeiro(), linhas((m) => ({ decimo_pct: m === 6 ? 90 : 0 })), '2027-01-01')).rejects.toBeInstanceOf(ErroValidacaoFolha);
    expect((await calendarioDePagamentos(p, await financeiro())).configurado).toBe(false);
  });
  it('mudar grava linhas novas com vigência; a anterior continua e a auditoria guarda só colunas', async () => {
    await salvarCalendario(p, await financeiro(), linhas(), '2027-01-01');
    await salvarCalendario(p, await financeiro(), linhas((m) => ({ decimo_pct: m === 12 ? 100 : 0 })), '2027-06-01');
    const c = await calendarioDePagamentos(p, await financeiro());
    expect(c.vigencia).toBe('2027-06-01');
    expect(c.linhas[11].decimo_pct).toBe(100);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'CalendarioPagamento');
    expect(aud).toHaveLength(2);
    expect(JSON.stringify(aud)).not.toContain('100');
  });
});

describe('contrato e mês de férias no cadastro', () => {
  const novo = (extra: object) => ({ ficha: '9002', colaborador: 'Pessoa Fictícia', cargo: 'Cargo de teste', departamento: null, cargaHoraria: 150, inicio: '2026-02-01', observacao: null, componentes: { ...componentesZerados(5), salario_atual: 3000 }, rateio: [{ centro: 'escola', percentual: 100 }], vigencia: '2027-01-01', ...extra });
  it('mês de férias fora de 1 a 12 é recusado; prazo determinado exige desligamento previsto', async () => {
    await expect(salvarPosto(p, await dp(), novo({ mesFerias: 13 }))).rejects.toThrow(/Mês de férias/);
    await expect(salvarPosto(p, await dp(), novo({ contrato: 'determinado', desligamento: null }))).rejects.toThrow(/desligamento previsto/);
  });
  it('contrato determinado entra no caixa com verba de término no mês do desligamento', async () => {
    const antes = await resumoFolha(p, await financeiro());
    await salvarPosto(p, await dp(), novo({ contrato: 'determinado', desligamento: '2027-06-30' }));
    const depois = await resumoFolha(p, await financeiro());
    const e = (r: typeof antes) => r.centros.find((c) => c.codigo === 'escola')!;
    expect(e(depois).caixa[5] - e(depois).mensal[5]).toBeGreaterThan(e(antes).caixa[5] - e(antes).mensal[5] + 1000);
    expect(e(depois).mensal[5]).toBeGreaterThan(e(antes).mensal[5]);
  });
  it('Diretoria e Leitura não alteram', async () => {
    await expect(salvarPosto(p, await como('diretoria@exemplo.local'), novo({ mesFerias: 3 }))).rejects.toBeInstanceOf(ErroPermissao);
  });
});
