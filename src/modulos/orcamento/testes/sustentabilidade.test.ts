/**
 * Painel de sustentabilidade financeira (#131, S1): origem, cobertura, aporte, peso, limites e acesso.
 * Dados FICTÍCIOS; os termos vêm de um catálogo falso (Parcerias é testado à parte).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { painelPorArea } from '../aplicacao/analise-area';
import { alterarOrigem, listarLimites, painelSustentabilidade, removerLimite, salvarLimite, type CatalogoParcerias } from '../aplicacao/sustentabilidade';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { CentrosCusto, TABELAS_ORCAMENTO } from '../dados/tabelas';
import {
  coberturaDoServico, conferirLimite, ErroSustentabilidade, origemEfetiva, pesoDoAporte, repassePorServico, sugerirOrigem, type TermoDoPainel,
} from '../dominio/sustentabilidade';
import { manifesto } from '../manifesto';

const termo = (extra: Partial<TermoDoPainel> = {}): TermoDoPainel => ({
  id: 't1', parceiro: 'Secretaria (exemplo)', numero: '001/2026', tipo: 'colaboracao', inicio: '2026-01-01', fim: '2026-12-31', unidadePessoa: true,
  parcelas: [{ mes: '2026-03', valor: 6000 }, { mes: '2026-09', valor: 4000 }, { mes: '2027-01', valor: 999 }],
  servicos: [{ servico: 'a', vagasCusteadas: 30 }, { servico: 'b', vagasCusteadas: 10 }], ...extra,
});

describe('origem do serviço (regras 1 a 3)', () => {
  it('colaboração e convênio sugerem contratado; fomento, iniciativa própria com apoio; o resto não sugere', () => {
    expect(sugerirOrigem([termo()]).origem).toBe('contratado');
    expect(sugerirOrigem([termo({ tipo: 'convenio' })]).origem).toBe('contratado');
    expect(sugerirOrigem([termo({ tipo: 'fomento' })]).origem).toBe('propria_apoio');
    expect(sugerirOrigem([termo({ tipo: 'fomento' }), termo({ tipo: 'colaboracao' })]).origem).toBe('contratado');
    expect(origemEfetiva(null, [termo({ tipo: 'acordo_cooperacao' })])).toMatchObject({ origem: 'propria', fonte: 'sem_termo' });
    expect(origemEfetiva(null, [])).toMatchObject({ origem: 'propria', fonte: 'sem_termo' });
  });
  it('o campo preenchido vale mais que o termo', () => {
    expect(origemEfetiva('propria', [termo()])).toMatchObject({ origem: 'propria', fonte: 'definida' });
    expect(origemEfetiva(null, [termo()])).toMatchObject({ origem: 'contratado', fonte: 'sugerida' });
  });
});

describe('repasse e cobertura (regras 6 a 12, 28)', () => {
  it('distribui as parcelas do ano pelas vagas custeadas e ignora outros anos', () => {
    const r = repassePorServico([termo()], 2026);
    expect(r.get('a')?.valor).toBe(7500);
    expect(r.get('b')?.valor).toBe(2500);
    expect(r.get('a')?.vagas).toBe(30);
    expect(repassePorServico([termo()], 2028).size).toBe(0);
  });
  it('termo sem vagas custeadas não distribui e avisa', () => {
    const r = repassePorServico([termo({ servicos: [{ servico: 'a', vagasCusteadas: null }] })], 2026);
    expect(r.get('a')?.valor).toBe(0);
    expect(r.get('a')?.avisos[0]).toContain('não tem vagas custeadas');
  });
  it('vários termos no mesmo serviço somam', () => {
    const r = repassePorServico([termo(), termo({ id: 't2', numero: '002/2026', servicos: [{ servico: 'a', vagasCusteadas: 5 }] })], 2026);
    expect(r.get('a')?.valor).toBe(17500);
    expect(r.get('a')?.vagas).toBe(35);
  });
  it('déficit, aporte, repasse acima do custo e per capita', () => {
    const r = repassePorServico([termo()], 2026).get('a')!;
    const c = coberturaDoServico({ codigo: 'a', nome: 'A', area: null, campoOrigem: null, custoTotal: 9000, repasse: r, atendidosMedios: 25 });
    expect(c).toMatchObject({ deficit: 1500, aporte: 1500, repasseAcima: 0, custoPorVagaMes: 25, repassePorVagaMes: 20.83, custoPorAtendidoMes: 30 });
    expect(c.coberturaTermo).toBeCloseTo(7500 / 9000);
    const acima = coberturaDoServico({ codigo: 'a', nome: 'A', area: null, campoOrigem: null, custoTotal: 5000, repasse: r, atendidosMedios: null });
    expect(acima).toMatchObject({ aporte: 0, repasseAcima: 2500, custoPorAtendidoMes: null });
  });
  it('sem termo: repasse zero, aporte = custo, origem própria; sem vagas, sem per capita; custo zero, sem porcentagem', () => {
    const c = coberturaDoServico({ codigo: 'x', nome: 'X', area: null, campoOrigem: null, custoTotal: 1200, repasse: null, atendidosMedios: null });
    expect(c).toMatchObject({ repasse: 0, aporte: 1200, custoPorVagaMes: null, origem: { origem: 'propria' } });
    expect(coberturaDoServico({ codigo: 'x', nome: 'X', area: null, campoOrigem: null, custoTotal: 0, repasse: null, atendidosMedios: null }).coberturaTermo).toBeNull();
  });
});

describe('peso do aporte (regras 13 e 14)', () => {
  const c = (codigo: string, campoOrigem: 'contratado' | 'propria' | null, custoTotal: number) =>
    coberturaDoServico({ codigo, nome: codigo, area: null, campoOrigem, custoTotal, repasse: null, atendidosMedios: null });
  it('só serviço contratado entra no indicador; o limite dispara o alerta', () => {
    const lista = [c('a', 'contratado', 3000), c('b', 'contratado', 1000), c('p', 'propria', 50000)];
    expect(pesoDoAporte(lista, 40000, null)).toMatchObject({ aporteContratado: 4000, peso: 10, acimaDoLimite: false, limite: null });
    expect(pesoDoAporte(lista, 40000, 8).acimaDoLimite).toBe(true);
    expect(pesoDoAporte(lista, 40000, 10).acimaDoLimite).toBe(false);
  });
  it('receita livre zero: sem número e com explicação', () => {
    expect(pesoDoAporte([c('a', 'contratado', 3000)], 0, 10)).toMatchObject({ peso: null, semReceitaLivre: true, acimaDoLimite: false });
  });
  it('limite entre 0 e 100', () => {
    expect(conferirLimite(12.5)).toBe(12.5);
    for (const v of [0, -1, 101, NaN]) expect(() => conferirLimite(v)).toThrow(ErroSustentabilidade);
  });
});

describe('painel (aplicação)', () => {
  let p: Planilhas;
  const como = async (email: string) => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
  };
  const parcelas = (valor: number) => [{ mes: '2026-06', valor }];
  const catalogo = (termos: TermoDoPainel[]): CatalogoParcerias => ({ termos: async () => termos });
  const TERMOS = [
    termo({ id: 'e', servicos: [{ servico: 'escola', vagasCusteadas: 100 }], parcelas: parcelas(100000) }),
    termo({ id: 'c', numero: '014/2026', tipo: 'fomento', servicos: [{ servico: 'centro_dia_intergeracional', vagasCusteadas: 80 }], parcelas: parcelas(20000) }),
  ];

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
    await prepararEstrutura(p, {
      tabelas: [...TABELAS_ORCAMENTO] as never,
      perfis: manifesto.perfis,
      permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
    });
    await popularDadosFicticios(p);
    await popularFolhaFicticia(p);
    await popularPrevisaoFicticia(p);
  });

  it('o custo do serviço é o mesmo da Análise por área e o repasse vem dos termos', async () => {
    const fin = await como('financeiro@exemplo.local');
    const painel = await painelSustentabilidade(p, fin, catalogo(TERMOS), { ano: 2026 });
    const escola = painel.servicos.find((s) => s.codigo === 'escola')!;
    const area = (await painelPorArea(p, fin, { ano: 2026, area: escola.area ? 'educacao' : undefined })).analise!;
    expect(escola.custoTotal).toBe(area.rateio.find((r) => r.codigo === 'escola')!.total);
    expect(escola.repasse).toBe(100000);
    expect(escola.origem).toMatchObject({ origem: 'contratado', fonte: 'sugerida' });
    expect(escola.aporte).toBe(Math.max(0, escola.custoTotal - 100000));
    const centro = painel.servicos.find((s) => s.codigo === 'centro_dia_intergeracional')!;
    expect(centro.origem.origem).toBe('propria_apoio');
    // A soma dos aportes contratados bate com o indicador, e o fomento fica de fora.
    expect(painel.peso!.aporteContratado).toBe(painel.servicos.filter((s) => s.origem.origem === 'contratado').reduce((t, s) => t + s.aporte, 0));
    expect(painel.peso!.limite).toBe(10);
  });

  it('Leitura vê o mesmo painel; coordenação não vê', async () => {
    const fin = await painelSustentabilidade(p, await como('financeiro@exemplo.local'), catalogo(TERMOS), { ano: 2026 });
    const leitura = await painelSustentabilidade(p, await como('leitura@exemplo.local'), catalogo(TERMOS), { ano: 2026 });
    expect(leitura.servicos.map((s) => [s.codigo, s.custoTotal])).toEqual(fin.servicos.map((s) => [s.codigo, s.custoTotal]));
    expect(leitura.podeEditar).toBe(false);
    await expect(painelSustentabilidade(p, await como('coord.educacao@exemplo.local'), catalogo(TERMOS))).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('Parcerias desligado: só o custo, sem repasse', async () => {
    const painel = await painelSustentabilidade(p, await como('financeiro@exemplo.local'), null, { ano: 2026 });
    expect(painel.parceriasDesligado).toBe(true);
    expect(painel.servicos.every((s) => s.repasse === 0)).toBe(true);
  });

  it('ano em elaboração avisa pela situação; ano inexistente volta ao último aprovado', async () => {
    const fin = await como('financeiro@exemplo.local');
    expect((await painelSustentabilidade(p, fin, null, { ano: 2027 })).situacao).toBe('elaboracao');
    // Ano que não existe volta para o último exercício aprovado.
    expect((await painelSustentabilidade(p, fin, null, { ano: 1999 })).ano).toBe(2026);
  });

  it('alterar a origem muda o painel, audita só a coluna e exige permissão', async () => {
    const fin = await como('financeiro@exemplo.local');
    await alterarOrigem(p, fin, { servico: 'escola', origem: 'propria' });
    const antes = await painelSustentabilidade(p, fin, catalogo(TERMOS), { ano: 2026 });
    expect(antes.servicos.find((s) => s.codigo === 'escola')!.origem).toMatchObject({ origem: 'propria', fonte: 'definida' });
    const [c] = await lerTabelas(p, [CentrosCusto] as const);
    expect(c.ativos().find((x) => x.servico === 'escola')!.origem).toBe('propria');
    const [aud] = await lerTabelas(p, [RegistrosAuditoria] as const);
    const ultima = aud.todos().filter((a) => a.entidade === 'CentrosCusto').at(-1)!;
    expect(JSON.stringify(ultima)).toContain('origem');
    expect(JSON.stringify(ultima)).not.toContain('"propria"');
    await alterarOrigem(p, fin, { servico: 'escola', origem: null });
    expect((await painelSustentabilidade(p, fin, catalogo(TERMOS), { ano: 2026 })).servicos.find((s) => s.codigo === 'escola')!.origem.fonte).toBe('sugerida');
    await expect(alterarOrigem(p, fin, { servico: 'escola', origem: 'invalida' as never })).rejects.toBeInstanceOf(ErroSustentabilidade);
    await expect(alterarOrigem(p, fin, { servico: 'transporte', origem: 'contratado' })).rejects.toBeInstanceOf(ErroSustentabilidade);
    await expect(alterarOrigem(p, await como('leitura@exemplo.local'), { servico: 'escola', origem: 'propria' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(alterarOrigem(p, await como('diretoria@exemplo.local'), { servico: 'escola', origem: 'propria' })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('limites: um da instituição e um por serviço; trocar, remover (encerra) e recusar valor ruim', async () => {
    const fin = await como('financeiro@exemplo.local');
    await salvarLimite(p, fin, { indicador: 'peso_aporte', servico: null, valor: 0.01 });
    await salvarLimite(p, fin, { indicador: 'peso_aporte', servico: 'escola', valor: 0.01 });
    const painel = await painelSustentabilidade(p, fin, catalogo(TERMOS), { ano: 2026 });
    expect(painel.peso!.limite).toBe(0.01);
    expect(painel.peso!.acimaDoLimite).toBe(painel.peso!.peso! > 0.01);
    const escola = painel.servicos.find((s) => s.codigo === 'escola')!;
    expect(escola.limiteServico).toBe(0.01);
    expect(escola.acimaDoLimiteServico).toBe(escola.aporte > 0);
    const { limites } = await listarLimites(p, fin);
    expect(limites).toHaveLength(2); // o da demonstração foi trocado, não duplicado
    await removerLimite(p, fin, limites.find((l) => l.servico === 'escola')!.id);
    expect((await listarLimites(p, fin)).limites).toHaveLength(1);
    await expect(salvarLimite(p, fin, { indicador: 'peso_aporte', servico: null, valor: 150 })).rejects.toBeInstanceOf(ErroSustentabilidade);
    await expect(salvarLimite(p, fin, { indicador: 'margem_operacional', servico: null, valor: 5 })).rejects.toBeInstanceOf(ErroSustentabilidade);
    await expect(salvarLimite(p, await como('leitura@exemplo.local'), { indicador: 'peso_aporte', servico: null, valor: 5 })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(removerLimite(p, await como('leitura@exemplo.local'), limites[0].id)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
