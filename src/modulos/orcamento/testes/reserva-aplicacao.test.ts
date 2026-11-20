/**
 * 1D.2: conferência, fim do ano, reserva e Visão geral, com acesso. Só dados FICTÍCIOS.
 * Data fixa: 20/11/2026 (mês atual 2026-11; último mês fechado 2026-10).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, inserir, inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { lerConferencia, mesesComDiferenca } from '../aplicacao/conferencia';
import { lerFimDoAno } from '../aplicacao/fim-do-ano';
import {
  cancelarPedidoDeUso, decidirPolitica, decidirUsoDaReserva, ErroReserva, lerReserva, marcarRecomposicao, pedirUsoDaReserva, proporPolitica,
} from '../aplicacao/reserva';
import { lerBase } from '../aplicacao/base-execucao';
import { lerVisaoGeral } from '../aplicacao/visao-geral';
import {
  AjustesConciliacao, Contas, Despesas, Exercicios, Fontes, GruposGasto, PLANILHA_EXECUCAO, PoliticaReserva, Realizado, Receitas, Saldos, TABELAS_ORCAMENTO, UsosReserva,
} from '../dados/tabelas';
import { FAIXAS_DE_FABRICA } from '../dominio/reserva';
import { manifesto } from '../manifesto';

const AGORA = new Date('2026-11-20T12:00:00Z');
let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');
const dir = () => como('diretoria@exemplo.local');
const leitura = () => como('leitura@exemplo.local');
const coord = () => como('coord.educacao@exemplo.local');
const autor = { email: 'carga@exemplo.local' };

const mes = (ano: number, m: number) => `${ano}-${String(m).padStart(2, '0')}`;
const ids: Record<string, string> = {};

/** Linha de realizado já gravada (sem passar pela tela, que só aceita os últimos 24 meses a partir de hoje). */
const linha = (m: string, tipo: 'despesa' | 'receita', fonte: string, valor: number, extra: Partial<{ natureza: string; naoRecorrente: boolean }> = {}) => ({
  ano: Number(m.slice(0, 4)), mes: m, tipo, servico: tipo === 'despesa' ? 'administracao' : null, grupo_id: tipo === 'despesa' ? ids.grupo : null, fonte_id: fonte,
  natureza: extra.natureza ?? (tipo === 'receita' ? 'receita_comum' : 'custeio'), valor, nao_recorrente: !!extra.naoRecorrente, motivo_nao_recorrente: extra.naoRecorrente ? 'Doação única' : null, observacao: null,
}) as never;

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  const [fontes, grupos, contas, saldos, realizado, exercicios, receitas, despesas] = await lerTabelas(p, [Fontes, GruposGasto, Contas, Saldos, Realizado, Exercicios, Receitas, Despesas] as const);
  const [livre, termo] = await inserirRegistros(p, fontes, [
    { nome: 'Fonte livre (exemplo)', natureza: 'propria', uso: 'livre', codigo_conta: null },
    { nome: 'Termo (exemplo)', natureza: 'publica', uso: 'restrita', codigo_conta: null },
  ], autor);
  const [grupo] = await inserirRegistros(p, grupos, [{ nome: 'Custeio (exemplo)', rh: false, regra_rateio_id: null, codigo_conta: null } as never], autor);
  const [a, r, v] = await inserirRegistros(p, contas, [
    { banco: 'Banco A', agencia: '1', conta: '1', tipo: 'movimento', classe: 'livre_disponivel', fonte_id: null, unidade: null },
    { banco: 'Banco R', agencia: '2', conta: '2', tipo: 'aplicacao', classe: 'reserva', fonte_id: null, unidade: null },
    { banco: 'Banco V', agencia: '3', conta: '3', tipo: 'movimento', classe: 'vinculada', fonte_id: termo.id, unidade: null },
  ], autor);
  Object.assign(ids, { livre: livre.id, termo: termo.id, grupo: grupo.id, a: a.id, r: r.id, v: v.id });

  // Saldos de 2025-09 a 2026-10: livre sobe 100 por mês, reserva fixa em 5.000; vinculada: 1.000 em setembro, 1.500 em outubro.
  const meses: string[] = [];
  for (let i = 0; i < 14; i++) meses.push(i < 4 ? mes(2025, 9 + i) : mes(2026, i - 3));
  const s: { conta_id: string; mes: string; saldo: number }[] = [];
  meses.forEach((m, i) => {
    s.push({ conta_id: a.id, mes: m, saldo: 10000 + i * 100 }, { conta_id: r.id, mes: m, saldo: 5000 });
  });
  s.push({ conta_id: v.id, mes: '2026-09', saldo: 1000 }, { conta_id: v.id, mes: '2026-10', saldo: 1500 });
  await inserirRegistros(p, saldos, s, autor);

  // Realizado de 2025 inteiro e de 2026 até outubro: receita livre 1.000 e despesa livre 900 por mês (resultado +100,
  // igual à subida do saldo livre, então o recurso livre confere). Em novembro de 2025 há uma doação não recorrente de 3.000.
  const linhas = [];
  for (let m = 1; m <= 12; m++) {
    linhas.push(linha(mes(2025, m), 'receita', livre.id, 1000), linha(mes(2025, m), 'despesa', livre.id, 900));
    if (m <= 10) linhas.push(linha(mes(2026, m), 'receita', livre.id, 1000), linha(mes(2026, m), 'despesa', livre.id, 900));
  }
  linhas.push(linha('2025-11', 'receita', livre.id, 3000, { naoRecorrente: true }));
  // Termo em outubro de 2026: entra 800 e sai 300 (1.000 + 800 − 300 = 1.500: confere).
  linhas.push(linha('2026-10', 'receita', termo.id, 800), linha('2026-10', 'despesa', termo.id, 300));
  await inserirRegistros(p, realizado, linhas, autor);

  // Previsão aprovada de 2026: receita livre 1.200/mês, despesa livre 1.000/mês, RH 600/mês (grupo de RH).
  await inserirRegistros(p, exercicios, [{ ano: 2026, situacao: 'aprovado', aprovado_em: '2026-01-10', aprovado_por: 'diretoria@exemplo.local' }], autor);
  const m12 = (v: number) => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i + 1}`, v]));
  await inserirRegistros(p, receitas, [{ ano: 2026, fonte_id: livre.id, descricao: 'Receita (exemplo)', valor: 14400, captacao: 'garantida', area: null, distribuicao: 'igual', ...m12(1200), observacao: null } as never], autor);
  await inserirRegistros(p, despesas, [{ ano: 2026, servico: 'administracao', grupo_id: grupo.id, fonte_id: livre.id, descricao: 'Despesa (exemplo)', quantidade: 1, ocorrencias: 1, valor_unitario: 12000, distribuicao: 'igual', ...m12(1000), categoria: 'operacional', situacao: 'aceito' } as never], autor);
});

describe('acesso (C8, F7, R8, S8)', () => {
  it('Coordenação não vê Conferência, Fim do ano, Reserva nem a Visão geral', async () => {
    const c = await coord();
    await expect(lerConferencia(p, c, '2026-10', AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerFimDoAno(p, c, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerReserva(p, c, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerVisaoGeral(p, c, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });
  it('Leitura não vê as telas de saldo; na Visão geral vê só os três sinais que não dependem de saldo', async () => {
    const l = await leitura();
    await expect(lerConferencia(p, l, '2026-10', AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerFimDoAno(p, l, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerReserva(p, l, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    const v = await lerVisaoGeral(p, l, AGORA);
    expect(v.sinais.map((s) => s.chave).sort()).toEqual(['execucao', 'folha', 'gasto']);
    expect(v.podeVerSaldos).toBe(false);
    expect(v.pendencias.every((x) => !x.href.includes('tesouraria'))).toBe(true);
  });
  it('Diretoria e Financeiro veem os seis sinais', async () => {
    for (const quem of [await dir(), await fin()]) {
      const v = await lerVisaoGeral(p, quem, AGORA);
      expect(v.sinais.map((s) => s.chave).sort()).toEqual(['execucao', 'fim', 'folha', 'gasto', 'livre', 'reserva']);
    }
  });
});

describe('conferência (C1 a C7)', () => {
  it('termo confere quando saldo = anterior + entradas − saídas; mostra de onde veio', async () => {
    const r = await lerConferencia(p, await fin(), '2026-10', AGORA);
    expect(r.termos).toHaveLength(1);
    expect(r.termos[0]).toMatchObject({ fonteNome: 'Termo (exemplo)', situacao: 'confere', diferenca: 0, saldoMes: 1500, saldoAnterior: 1000, entradas: 800, saidas: 300, contas: ['Banco V 3'] });
  });
  it('mês sem o saldo do mês anterior diz o que falta, sem diferença falsa (C3)', async () => {
    const r = await lerConferencia(p, await dir(), '2026-09', AGORA);
    expect(r.termos[0]).toMatchObject({ situacao: 'sem_dado', diferenca: null });
    expect(r.termos[0].faltam).toEqual([{ o: 'saldo', mes: '2026-08' }]);
  });
  it('diferença diferente de zero é alerta (C2), e duas contas da mesma fonte são somadas (C4)', async () => {
    const [contas, saldos] = await lerTabelas(p, [Contas, Saldos] as const);
    const [v2] = await inserirRegistros(p, contas, [{ banco: 'Banco W', agencia: '4', conta: '4', tipo: 'aplicacao', classe: 'vinculada', fonte_id: ids.termo, unidade: null }], autor);
    await inserirRegistros(p, saldos, [{ conta_id: v2.id, mes: '2026-09', saldo: 200 }, { conta_id: v2.id, mes: '2026-10', saldo: 260 }], autor);
    const r = await lerConferencia(p, await fin(), '2026-10', AGORA);
    expect(r.termos).toHaveLength(1);
    expect(r.termos[0].contas).toHaveLength(2);
    expect(r.termos[0]).toMatchObject({ saldoMes: 1760, saldoAnterior: 1200, situacao: 'diferenca', diferenca: 60 });
    expect(mesesComDiferenca(await lerBase(p), AGORA)).toEqual(['2026-10']);
  });
  it('recurso livre: variação do saldo (livre + reserva) contra o resultado das fontes livres; ajuste aparece como diferença (C7)', async () => {
    const f = await fin();
    expect((await lerConferencia(p, f, '2026-10', AGORA)).recursoLivre).toMatchObject({ situacao: 'confere', variacao: 100, resultadoLivre: 100, diferenca: 0 });
    const [aj] = await lerTabelas(p, [AjustesConciliacao] as const);
    await inserirRegistros(p, aj, [{ conta_id: ids.a, mes: '2026-10', valor: 35.5, motivo: 'Rendimento (exemplo)' }], autor);
    expect((await lerConferencia(p, f, '2026-10', AGORA)).recursoLivre).toMatchObject({ situacao: 'diferenca', diferenca: 35.5 });
  });
  it('mês futuro ou inválido é recusado', async () => {
    await expect(lerConferencia(p, await fin(), '2026-12', AGORA)).rejects.toThrow('mês');
    await expect(lerConferencia(p, await fin(), 'xx', AGORA)).rejects.toThrow('mês');
  });
});

describe('fim do ano (F1 a F6)', () => {
  it('ponto de partida é o último mês com saldo; reserva atual é a classe reserva desse mês', async () => {
    const r = await lerFimDoAno(p, await fin(), AGORA);
    expect(r.partida).toBe('2026-10');
    expect(r.saldoPartida).toBe(10000 + 13 * 100 + 5000);
    expect(r.reservaAtual).toBe(5000);
  });
  it('repetir 2025: resultado livre de nov e dez, com e sem a doação não recorrente; folga desconta a reserva', async () => {
    const r = await lerFimDoAno(p, await fin(), AGORA);
    const por = (id: string) => r.cenarios.find((x) => x.id === id)!;
    const partida = 16300;
    expect(por('ano1_sem').saldoDezembro).toBe(partida + 200);
    expect(por('ano1_com').saldoDezembro).toBe(partida + 200 + 3000);
    expect(por('ano1_com').folga).toBe(partida + 3200 - 5000);
    expect(r.folgaDoSinal).toBe(por('ano1_com').folga);
  });
  it('dois anos antes sem realizado é "sem dado" com os meses que faltam, nunca zero (F4)', async () => {
    const r = await lerFimDoAno(p, await fin(), AGORA);
    const c = r.cenarios.find((x) => x.id === 'ano2_com')!;
    expect(c.saldoDezembro).toBeNull();
    expect(c.folga).toBeNull();
    expect(c.faltam).toEqual(['2024-11', '2024-12']);
  });
  it('pela Previsão: receita livre − despesa livre prevista de nov e dez, sem cedidos (F3)', async () => {
    const r = await lerFimDoAno(p, await fin(), AGORA);
    expect(r.cenarios.find((x) => x.id === 'previsao')!.saldoDezembro).toBe(16300 + 2 * 200);
  });
  it('sem Previsão aprovada, o cenário diz o motivo', async () => {
    const [ex] = await lerTabelas(p, [Exercicios] as const);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    const e = ex.ativos()[0];
    await atualizar(p, Exercicios, e.id, e.versao, { situacao: 'elaboracao' } as never, autor);
    const r = await lerFimDoAno(p, await fin(), AGORA);
    const c = r.cenarios.find((x) => x.id === 'previsao')!;
    expect(c.saldoDezembro).toBeNull();
    expect(c.motivo).toMatch(/não está aprovada/);
  });
  it('sem nenhum saldo no ano: sem ponto de partida e sem cenário (F1)', async () => {
    const [saldos] = await lerTabelas(p, [Saldos] as const);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    for (const s of saldos.ativos().filter((x) => x.mes.startsWith('2026-'))) await atualizar(p, Saldos, s.id, s.versao, { ativo: false } as never, autor);
    const r = await lerFimDoAno(p, await fin(), AGORA);
    expect(r.partida).toBeNull();
    expect(r.cenarios.every((x) => x.saldoDezembro === null)).toBe(true);
    expect(r.series[0].valores.every((v) => v === null)).toBe(true);
  });
  it('a série do gráfico deixa buraco (null) nos meses sem saldo e marca o ano em andamento como parcial', async () => {
    const r = await lerFimDoAno(p, await fin(), AGORA);
    expect(r.series.map((s) => [s.ano, s.parcial])).toEqual([[2026, true], [2025, false], [2024, false]]);
    expect(r.series[0].valores.slice(0, 10).every((v) => v !== null)).toBe(true);
    expect(r.series[0].valores.slice(10)).toEqual([null, null]);
    expect(r.series[2].valores.every((v) => v === null)).toBe(true);
  });
});

describe('reserva: política (R2, R3, R7)', () => {
  it('sem política aprovada valem as faixas de fábrica e o mínimo não existe', async () => {
    const r = await lerReserva(p, await fin(), AGORA);
    expect(r).toMatchObject({ aprovada: false, minimo: null, percentual: null, reservaAtual: 5000, proposta: null });
    expect(r.faixas).toEqual(FAIXAS_DE_FABRICA);
  });
  it('Financeiro propõe, Diretoria aprova; só então vale, e o mínimo vem do RH previsto', async () => {
    const f = await fin();
    const id = await proporPolitica(p, f, { ...FAIXAS_DE_FABRICA, meses_minimo: 3 }, AGORA);
    let r = await lerReserva(p, await dir(), AGORA);
    expect(r.aprovada).toBe(false);
    expect(r.proposta?.id).toBe(id);
    expect(r.podeAprovar).toBe(true);
    const prop = r.proposta!;
    await decidirPolitica(p, await dir(), prop.id, prop.versao, 'aprovada');
    r = await lerReserva(p, await dir(), AGORA);
    expect(r.aprovada).toBe(true);
    expect(r.faixas.meses_minimo).toBe(3);
    expect(r.proposta).toBeNull();
    // RH previsto é zero neste cenário (sem grupo de RH): mínimo de R$ 0, então sem percentual.
    expect(r.minimo).toBe(0);
    expect(r.percentual).toBeNull();
  });
  it('só o Financeiro propõe; só a Diretoria decide; Leitura e Coordenação não', async () => {
    await expect(proporPolitica(p, await dir(), FAIXAS_DE_FABRICA, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(proporPolitica(p, await leitura(), FAIXAS_DE_FABRICA, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await proporPolitica(p, await fin(), FAIXAS_DE_FABRICA, AGORA);
    const prop = (await lerReserva(p, await fin(), AGORA)).proposta!;
    await expect(decidirPolitica(p, await fin(), prop.id, prop.versao, 'aprovada')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirPolitica(p, await coord(), prop.id, prop.versao, 'aprovada')).rejects.toBeInstanceOf(ErroPermissao);
  });
  it('R3: quem propôs não aprova o próprio pedido, mesmo com as duas permissões', async () => {
    await inserir(p, Atribuicoes, { usuario_email: 'diretoria@exemplo.local', perfil: 'financeiro', escopo_tipo: 'global', escopo: null } as never, autor);
    const duplo = await dir();
    expect(duplo.temPermissao('orcamento.tesouraria.editar') && duplo.temPermissao('orcamento.reserva.aprovar')).toBe(true);
    await proporPolitica(p, duplo, FAIXAS_DE_FABRICA, AGORA);
    const prop = (await lerReserva(p, duplo, AGORA)).proposta!;
    await expect(decidirPolitica(p, duplo, prop.id, prop.versao, 'aprovada')).rejects.toThrow(/próprio pedido/);
  });
  it('recusa exige motivo; proposta decidida não muda mais (R6); uma proposta pendente por vez', async () => {
    const f = await fin();
    await proporPolitica(p, f, FAIXAS_DE_FABRICA, AGORA);
    await expect(proporPolitica(p, f, FAIXAS_DE_FABRICA, AGORA)).rejects.toThrow(/aguardando a Diretoria/);
    const prop = (await lerReserva(p, f, AGORA)).proposta!;
    await expect(decidirPolitica(p, await dir(), prop.id, prop.versao, 'recusada', '  ')).rejects.toThrow(/motivo/);
    await decidirPolitica(p, await dir(), prop.id, prop.versao, 'recusada', 'Faixas altas demais');
    const [pol] = await lerTabelas(p, [PoliticaReserva] as const);
    expect(pol.porId(prop.id)).toMatchObject({ situacao: 'recusada', motivo: 'Faixas altas demais' });
    await expect(decidirPolitica(p, await dir(), prop.id, prop.versao + 1, 'aprovada')).rejects.toThrow(/já foi decidida/);
    await expect(proporPolitica(p, f, FAIXAS_DE_FABRICA, AGORA)).resolves.toBeTruthy();
  });
  it('faixas inválidas são recusadas e não gravam nada', async () => {
    await expect(proporPolitica(p, await fin(), { ...FAIXAS_DE_FABRICA, meses_minimo: 0 }, AGORA)).rejects.toBeInstanceOf(ErroReserva);
    const [pol] = await lerTabelas(p, [PoliticaReserva] as const);
    expect(pol.todos()).toHaveLength(0);
  });
  it('R7: a auditoria guarda as colunas, nunca os valores', async () => {
    await proporPolitica(p, await fin(), { ...FAIXAS_DE_FABRICA, fim_ok: 123456 }, AGORA);
    const prop = (await lerReserva(p, await dir(), AGORA)).proposta!;
    await decidirPolitica(p, await dir(), prop.id, prop.versao, 'aprovada');
    const [aud] = await lerTabelas(p, [RegistrosAuditoria] as const);
    const regs = aud.todos().filter((a) => a.entidade === 'PoliticaReserva');
    expect(regs.map((a) => a.acao)).toEqual(['inclusao', 'alteracao']);
    expect(JSON.stringify(regs)).not.toContain('123456');
    expect(regs[1].detalhes).toContain('situacao');
  });
});

describe('reserva: uso (R4 a R6)', () => {
  const pedido = { valor: 1500, motivo: 'Atraso de repasse (exemplo)', prazo: '2027-03' };
  it('o Financeiro pede; valor zero, acima do saldo, sem motivo ou com prazo no passado é recusado', async () => {
    const f = await fin();
    await expect(pedirUsoDaReserva(p, f, { ...pedido, valor: 0 }, AGORA)).rejects.toThrow(/maior que zero/);
    await expect(pedirUsoDaReserva(p, f, { ...pedido, valor: 5000.01 }, AGORA)).rejects.toThrow(/maior que o saldo/);
    await expect(pedirUsoDaReserva(p, f, { ...pedido, motivo: '' }, AGORA)).rejects.toThrow(/motivo/);
    await expect(pedirUsoDaReserva(p, f, { ...pedido, prazo: '2026-10' }, AGORA)).rejects.toThrow(/prazo/);
    await expect(pedirUsoDaReserva(p, await dir(), pedido, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(pedirUsoDaReserva(p, f, { ...pedido, valor: 5000 }, AGORA)).resolves.toBeTruthy();
  });
  it('a Diretoria aprova; o saldo não se mexe; depois o Financeiro marca a recomposição', async () => {
    const f = await fin();
    await pedirUsoDaReserva(p, f, pedido, AGORA);
    const u = (await lerReserva(p, f, AGORA)).usos[0];
    expect(u.situacao).toBe('pedido');
    await decidirUsoDaReserva(p, await dir(), u.id, u.versao, 'aprovado');
    let r = await lerReserva(p, f, AGORA);
    expect(r.usos[0]).toMatchObject({ situacao: 'aprovado', vencido: false });
    expect(r.reservaAtual).toBe(5000);
    await marcarRecomposicao(p, f, u.id, r.usos[0].versao, '2026-11', AGORA);
    r = await lerReserva(p, f, AGORA);
    expect(r.usos[0]).toMatchObject({ situacao: 'recomposto', mes_recomposicao: '2026-11' });
  });
  it('recusa pede motivo; decidido não muda; Financeiro não decide', async () => {
    const f = await fin();
    await pedirUsoDaReserva(p, f, pedido, AGORA);
    const u = (await lerReserva(p, f, AGORA)).usos[0];
    await expect(decidirUsoDaReserva(p, f, u.id, u.versao, 'aprovado')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirUsoDaReserva(p, await dir(), u.id, u.versao, 'recusado', '')).rejects.toThrow(/motivo/);
    await decidirUsoDaReserva(p, await dir(), u.id, u.versao, 'recusado', 'Há outra saída');
    await expect(decidirUsoDaReserva(p, await dir(), u.id, u.versao + 1, 'aprovado')).rejects.toThrow(/já foi decidido/);
    await expect(cancelarPedidoDeUso(p, f, u.id, u.versao + 1)).rejects.toThrow(/ainda não foi decidido/);
    await expect(marcarRecomposicao(p, f, u.id, u.versao + 1, '2026-11', AGORA)).rejects.toThrow(/uso aprovado/);
  });
  it('R6: o Financeiro cancela enquanto é pedido; o registro fica encerrado, não é apagado', async () => {
    const f = await fin();
    await pedirUsoDaReserva(p, f, pedido, AGORA);
    const u = (await lerReserva(p, f, AGORA)).usos[0];
    await cancelarPedidoDeUso(p, f, u.id, u.versao);
    expect((await lerReserva(p, f, AGORA)).usos).toHaveLength(0);
    const [usos] = await lerTabelas(p, [UsosReserva] as const);
    expect(usos.todos()).toHaveLength(1);
    expect(usos.todos()[0].ativo).toBe(false);
  });
  it('versão velha vira conflito', async () => {
    const f = await fin();
    await pedirUsoDaReserva(p, f, pedido, AGORA);
    const u = (await lerReserva(p, f, AGORA)).usos[0];
    await expect(decidirUsoDaReserva(p, await dir(), u.id, u.versao + 5, 'aprovado')).rejects.toBeInstanceOf(ErroConflito);
  });
  it('R5: recomposição vencida aparece na lista e como pendência da Visão geral', async () => {
    const [usos] = await lerTabelas(p, [UsosReserva] as const);
    await inserirRegistros(p, usos, [{ mes_pedido: '2026-05', valor: 100, motivo: 'Antigo (exemplo)', prazo_recomposicao: '2026-09', situacao: 'aprovado', motivo_decisao: null, mes_recomposicao: null }], autor);
    const r = await lerReserva(p, await fin(), AGORA);
    expect(r.usos[0].vencido).toBe(true);
    const v = await lerVisaoGeral(p, await dir(), AGORA);
    expect(v.pendencias.map((x) => x.texto)).toContain('Recomposição da reserva vencida');
  });
});

describe('Visão geral (S1 a S10)', () => {
  it('Sinais: valores, ordem do mais grave ao mais tranquilo e dado de origem', async () => {
    const v = await lerVisaoGeral(p, await fin(), AGORA);
    const por = (k: string) => v.sinais.find((s) => s.chave === k)!;
    // S2: livre disponível (10.000 + 13×100 = 11.300) ÷ gasto médio 900 = 12,6 meses.
    expect(por('livre')).toMatchObject({ valor: 12.6, situacao: 'ok', desatualizado: false });
    expect(por('livre').dado).toBe('saldos até outubro · realizado até outubro');
    // S3: folga = 16.300 + 3.200 − 5.000 = 14.500 (faixa: ok ≥ 100.000, atenção até zero).
    expect(por('fim')).toMatchObject({ valor: 14500, situacao: 'atencao' });
    // S4: realizado (100 por mês + 500 do termo) menos previsto (200 por mês) até outubro.
    expect(por('execucao').valor).toBe(10 * 100 + 500 - 10 * 200);
    // S6: mesma variação de receita e despesa livres entre os anos, mas a doação de 2025 não conta (não recorrente).
    expect(por('gasto')).toMatchObject({ valor: 0, situacao: 'ok' });
    // Sem política aprovada: reserva "sem política aprovada" e as faixas aparecem como propostas.
    expect(por('reserva')).toMatchObject({ valor: null, situacao: 'sem_dado', motivo: 'Sem política aprovada' });
    expect(por('livre').faixaProposta).toBe(true);
    const ordem = ['critico', 'atencao', 'ok', 'sem_dado'];
    const idx = v.sinais.map((s) => ordem.indexOf(s.situacao));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(v.faixasAprovadas).toBe(false);
  });
  it('S5: folha sobre a receita usa o realizado; sem RH realizado dá 0%', async () => {
    const v = await lerVisaoGeral(p, await fin(), AGORA);
    expect(v.sinais.find((s) => s.chave === 'folha')).toMatchObject({ valor: 0, situacao: 'ok', previsto: false });
  });
  it('S5: sem realizado, usa o previsto do ano com a marca "previsto"', async () => {
    const [r] = await lerTabelas(p, [Realizado] as const);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    for (const x of r.ativos()) await atualizar(p, Realizado, x.id, x.versao, { ativo: false } as never, autor);
    const f = (await lerVisaoGeral(p, await fin(), AGORA)).sinais.find((s) => s.chave === 'folha')!;
    expect(f).toMatchObject({ previsto: true, valor: 0, dado: 'previsto do ano' });
  });
  it('S10: dado mais velho que o mês anterior ao atual aparece como desatualizado', async () => {
    const velho = new Date('2027-01-15T12:00:00Z'); // atual = 2027-01; último dado = 2026-10
    const v = await lerVisaoGeral(p, await fin(), velho);
    expect(v.sinais.find((s) => s.chave === 'livre')!.desatualizado).toBe(true);
  });
  it('pendências: contas sem saldo, termos com diferença e realizado do último mês fechado', async () => {
    const [saldos, realizado] = await lerTabelas(p, [Saldos, Realizado] as const);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    const s = saldos.ativos().find((x) => x.conta_id === ids.r && x.mes === '2026-10')!;
    await atualizar(p, Saldos, s.id, s.versao, { ativo: false } as never, autor);
    for (const x of realizado.ativos().filter((y) => y.mes === '2026-10' && y.fonte_id === ids.livre)) await atualizar(p, Realizado, x.id, x.versao, { ativo: false } as never, autor);
    const v = await lerVisaoGeral(p, await fin(), AGORA);
    const textos = v.pendencias.map((x) => x.texto);
    expect(textos).toContain('1 conta sem saldo em outubro');
  });
  it('Financeiro vê "Falta informar o realizado"; Diretoria não, porque não informa', async () => {
    const [realizado] = await lerTabelas(p, [Realizado] as const);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    for (const x of realizado.ativos().filter((y) => y.mes === '2026-10')) await atualizar(p, Realizado, x.id, x.versao, { ativo: false } as never, autor);
    expect((await lerVisaoGeral(p, await fin(), AGORA)).pendencias.map((x) => x.texto)).toContain('Falta informar o realizado de outubro');
    expect((await lerVisaoGeral(p, await dir(), AGORA)).pendencias.map((x) => x.texto)).not.toContain('Falta informar o realizado de outubro');
  });
  it('sem saldos e sem realizado a Visão geral está vazia e nenhum sinal vira zero', async () => {
    const vazio: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
    const antes = p;
    p = vazio;
    await prepararEstrutura(p, {
      tabelas: [...TABELAS_ORCAMENTO] as never,
      perfis: manifesto.perfis,
      permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
    });
    await popularDadosFicticios(p);
    const v = await lerVisaoGeral(p, await fin(), AGORA);
    p = antes;
    expect(v.vazia).toBe(true);
    expect(v.sinais.every((s) => s.valor === null && s.situacao === 'sem_dado')).toBe(true);
  });
});

describe('Preparar estrutura (critério de pronto)', () => {
  it('cria as duas abas e liga orcamento.reserva.aprovar só à Diretoria', async () => {
    const abas = await p.armazenamento.listarAbas(PLANILHA_EXECUCAO);
    expect(abas).toEqual(expect.arrayContaining(['PoliticaReserva', 'UsosReserva']));
    expect([PoliticaReserva, UsosReserva].every((t) => t.planilha === PLANILHA_EXECUCAO)).toBe(true);
    const comPermissao = Object.entries(manifesto.permissoesPorPerfil).filter(([, l]) => l.includes('orcamento.reserva.aprovar')).map(([perfil]) => perfil);
    expect(comPermissao).toEqual(['diretoria']);
    expect(manifesto.permissoes['orcamento.reserva.aprovar']).toBeTruthy();
  });
});
