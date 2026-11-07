/**
 * Tesouraria (Entrega 1D.1): saldos do mês e ajustes de conciliação. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  ErroTesouraria,
  excluirConta,
  incluirAjuste,
  lerSaldosDoMes,
  listarContas,
  salvarConta,
  salvarSaldosDoMes,
  tirarAjuste,
} from '../aplicacao/tesouraria';
import { PLANILHA_EXECUCAO, Saldos, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { mesAnterior, mesAtualBrasilia, type DadosConta } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

const conta = (extra: Partial<DadosConta> = {}): DadosConta => ({
  banco: 'Banco Fictício A', agencia: '0001', conta: '10001-0', tipo: 'movimento', classe: 'livre_disponivel', fonteId: null, unidade: 'sede', ...extra,
});

const MES = mesAnterior(mesAtualBrasilia());
const ANTES = mesAnterior(MES);

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

/** Três contas: livre (A), reserva (B) e livre (C). */
async function tresContas() {
  const f = await fin();
  const a = await salvarConta(p, f, conta());
  const b = await salvarConta(p, f, conta({ banco: 'Banco Fictício B', conta: '20002-0', classe: 'reserva', tipo: 'aplicacao' }));
  const c = await salvarConta(p, f, conta({ banco: 'Banco Fictício C', conta: '30003-0' }));
  return { a, b, c };
}

describe('saldos do mês', () => {
  it('financeiro grava 3 saldos; a leitura mostra totais por classe e o mês anterior ao lado', async () => {
    const { a, b, c } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, ANTES, [{ contaId: a, valor: 100 }]);
    const r = await salvarSaldosDoMes(p, f, MES, [
      { contaId: a, valor: 1000.1 },
      { contaId: b, valor: 500 },
      { contaId: c, valor: 0.2 },
    ]);
    expect(r.gravados).toBe(3);
    const s = await lerSaldosDoMes(p, f, MES);
    expect(s.mes).toBe(MES);
    expect(s.mesAtual).toBe(mesAtualBrasilia());
    expect(s.totais).toEqual({ livre_disponivel: 1000.3, reserva: 500, vinculada: 0 });
    expect(s.totaisAnterior.livre_disponivel).toBe(100);
    expect(s.pendentes).toEqual([]);
    expect(s.linhas.map((l) => l.conta.id)).toEqual([a, c, b]);
    expect(s.linhas[0].saldo?.saldo).toBe(1000.1);
    expect(s.linhas[0].saldoAnterior).toBe(100);
    expect(s.linhas[1].saldoAnterior).toBeNull();
  });

  it('reenviar o mesmo valor não audita; alterar audita alteracao com a coluna saldo', async () => {
    const { a } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 10 }]);
    let l = (await lerSaldosDoMes(p, f, MES)).linhas[0];
    expect((await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 10, versao: l.saldo!.versao }])).gravados).toBe(0);
    expect((await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: null, versao: l.saldo!.versao }])).gravados).toBe(0);
    let aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Saldos');
    expect(aud.map((x) => x.acao)).toEqual(['inclusao']);

    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 20, versao: l.saldo!.versao }]);
    l = (await lerSaldosDoMes(p, f, MES)).linhas[0];
    expect(l.saldo?.saldo).toBe(20);
    aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Saldos');
    expect(aud.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(JSON.parse(aud[1].detalhes as string)).toEqual({ colunas: ['saldo'] });
  });

  it('duas gravações com a mesma versão lida: a segunda dá ErroConflito e nada é gravado pela metade', async () => {
    const { a, b } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 10 }]);
    const lida = (await lerSaldosDoMes(p, f, MES)).linhas.find((l) => l.conta.id === a)!.saldo!;
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 11, versao: lida.versao }]);
    await expect(
      salvarSaldosDoMes(p, f, MES, [
        { contaId: b, valor: 99 },
        { contaId: a, valor: 12, versao: lida.versao },
      ]),
    ).rejects.toBeInstanceOf(ErroConflito);
    const s = await lerSaldosDoMes(p, f, MES);
    expect(s.linhas.find((l) => l.conta.id === a)!.saldo!.saldo).toBe(11);
    expect(s.linhas.find((l) => l.conta.id === b)!.saldo).toBeNull();
    expect((await lerTabela(p, Saldos)).todos()).toHaveLength(1);
  });

  it('recusa mês futuro e mês inválido', async () => {
    const f = await fin();
    const futuro = '2099-01';
    for (const m of [futuro, '2026-13', 'abc']) {
      await expect(lerSaldosDoMes(p, f, m)).rejects.toThrow('Escolha um mês até o mês atual.');
      await expect(salvarSaldosDoMes(p, f, m, [])).rejects.toBeInstanceOf(ErroTesouraria);
    }
    await expect(lerSaldosDoMes(p, f, mesAtualBrasilia())).resolves.toBeTruthy();
  });

  it('pendentes: conta ativa sem saldo; excluída sai das pendências e continua nos totais do mês em que tinha saldo', async () => {
    const { a, b } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, ANTES, [{ contaId: a, valor: 700 }]);
    await salvarSaldosDoMes(p, f, MES, [{ contaId: b, valor: 5 }]);
    let s = await lerSaldosDoMes(p, f, MES);
    expect(s.pendentes.map((x) => x.id).sort()).toEqual([a, (await listarContas(p, f)).ativas.find((x) => x.id !== a && x.id !== b)!.id].sort());
    expect(s.pendentes[0].nome).toContain('Banco Fictício');

    const alvo = (await listarContas(p, f)).ativas.find((x) => x.id === a)!;
    await excluirConta(p, f, a, alvo.versao);
    s = await lerSaldosDoMes(p, f, MES);
    expect(s.pendentes.map((x) => x.id)).not.toContain(a);
    expect(s.linhas.map((l) => l.conta.id)).not.toContain(a);
    const passado = await lerSaldosDoMes(p, f, ANTES);
    expect(passado.totais.livre_disponivel).toBe(700);
    expect(passado.linhas.map((l) => l.conta.id)).toContain(a);
    expect(s.totaisAnterior.livre_disponivel).toBe(700);
  });
});

describe('saldos: entradas inválidas', () => {
  it('recusa a mesma conta duas vezes na mesma chamada, sem gravar nada', async () => {
    const { a, b } = await tresContas();
    const f = await fin();
    await expect(salvarSaldosDoMes(p, f, MES, [{ contaId: b, valor: 1 }, { contaId: a, valor: 1 }, { contaId: a, valor: 2 }])).rejects.toThrow('A mesma conta apareceu duas vezes.');
    expect((await lerTabela(p, Saldos)).todos()).toHaveLength(0);
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 5 }]);
    const v = (await lerSaldosDoMes(p, f, MES)).linhas.find((l) => l.conta.id === a)!.saldo!.versao;
    await expect(salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 6, versao: v }, { contaId: a, valor: 7, versao: v }])).rejects.toBeInstanceOf(ErroTesouraria);
    expect((await lerTabela(p, Saldos)).todos().map((x) => x.saldo)).toEqual([5]);
  });

  it('saldo novo para conta e mês que já têm saldo (outra pessoa gravou antes) dá ErroConflito', async () => {
    const { a, b } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 5 }]);
    await expect(salvarSaldosDoMes(p, f, MES, [{ contaId: b, valor: 9 }, { contaId: a, valor: 6 }])).rejects.toBeInstanceOf(ErroConflito);
    expect((await lerTabela(p, Saldos)).todos().map((x) => x.saldo)).toEqual([5]);
  });

  it('conta que não existe é recusada e nada é gravado', async () => {
    const { a } = await tresContas();
    const f = await fin();
    await expect(salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 1 }, { contaId: 'nao-existe', valor: 2 }])).rejects.toThrow('Conta não encontrada.');
    expect((await lerTabela(p, Saldos)).todos()).toHaveLength(0);
  });
});

describe('ajustes de conciliação', () => {
  it('ajuste de -300 muda o total da classe; tirado deixa de somar', async () => {
    const { a } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 1000 }]);
    const id = await incluirAjuste(p, f, { contaId: a, mes: MES, valor: -300, motivo: 'Cheque não compensado' });
    let s = await lerSaldosDoMes(p, f, MES);
    expect(s.totais.livre_disponivel).toBe(700);
    const aj = s.linhas.find((l) => l.conta.id === a)!.ajustes;
    expect(aj.map((x) => x.id)).toEqual([id]);
    await tirarAjuste(p, f, id, aj[0].versao);
    s = await lerSaldosDoMes(p, f, MES);
    expect(s.totais.livre_disponivel).toBe(1000);
    expect(s.linhas.find((l) => l.conta.id === a)!.ajustes).toEqual([]);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'AjustesConciliacao');
    expect(aud.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(JSON.stringify(aud)).not.toContain('Cheque');
  });

  it('recusa ajuste sem motivo, com valor zero, em mês futuro ou em conta excluída', async () => {
    const { a } = await tresContas();
    const f = await fin();
    await expect(incluirAjuste(p, f, { contaId: a, mes: MES, valor: 5, motivo: '  ' })).rejects.toThrow('Informe o motivo do ajuste.');
    await expect(incluirAjuste(p, f, { contaId: a, mes: MES, valor: 0, motivo: 'x' })).rejects.toThrow('O ajuste não pode ser zero.');
    await expect(incluirAjuste(p, f, { contaId: a, mes: '2099-01', valor: 1, motivo: 'x' })).rejects.toThrow('Escolha um mês até o mês atual.');
    const alvo = (await listarContas(p, f)).ativas.find((x) => x.id === a)!;
    await excluirConta(p, f, a, alvo.versao);
    await expect(incluirAjuste(p, f, { contaId: a, mes: MES, valor: 1, motivo: 'x' })).rejects.toBeInstanceOf(ErroTesouraria);
  });
});

describe('permissões', () => {
  it('diretoria lê e não grava; coordenação e leitura não leem', async () => {
    const { a } = await tresContas();
    const f = await fin();
    await salvarSaldosDoMes(p, f, MES, [{ contaId: a, valor: 1 }]);
    const d = await como('diretoria@exemplo.local');
    await expect(lerSaldosDoMes(p, d, MES)).resolves.toBeTruthy();
    await expect(salvarSaldosDoMes(p, d, MES, [{ contaId: a, valor: 2 }])).rejects.toBeInstanceOf(ErroPermissao);
    await expect(incluirAjuste(p, d, { contaId: a, mes: MES, valor: 1, motivo: 'x' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(tirarAjuste(p, d, 'x', 1)).rejects.toBeInstanceOf(ErroPermissao);
    for (const email of ['coord.ur@exemplo.local', 'leitura@exemplo.local']) {
      await expect(lerSaldosDoMes(p, await como(email), MES)).rejects.toBeInstanceOf(ErroPermissao);
    }
  });
});
