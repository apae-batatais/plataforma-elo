/**
 * Saldo para a conferência da requisição (L2): previsto aprovado menos realizado, por serviço e grupo. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { saldoParaConferencia } from '../aplicacao/ligacao';
import { salvarRealizadoDoMes, type EntradaLinha } from '../aplicacao/realizado';
import { Despesas, Exercicios, Fontes, GruposGasto, PLANILHA_EXECUCAO, TABELAS_ORCAMENTO } from '../dados/tabelas';
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

describe('saldoParaConferencia', () => {
  it('sem exercício aprovado, devolve estado "sem orçamento" (nunca erro) e a lista de grupos', async () => {
    const r = await saldoParaConferencia(p, await fin(), 'escola', { ano: ANO });
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.dados.previsaoAprovada).toBe(false);
    expect(r.dados.grupos.map((g) => g.nome)).toEqual(['Material (teste)', 'Salários (teste)']);
  });

  it('saldo do serviço e do grupo = previsto aprovado menos realizado informado', async () => {
    await aprovarPrevisao();
    await salvarRealizadoDoMes(p, await fin(), MES, [linha({ servico: 'escola', valor: 1000 }), linha({ servico: 'escola', grupoId: ids.grh, natureza: 'rh', valor: 200 }), linha({ servico: 'ur', valor: 50 })]);
    const r = await saldoParaConferencia(p, await fin(), 'escola', { grupoId: ids.g, ano: ANO });
    if (r.estado !== 'ok') throw new Error('esperava ok');
    expect(r.dados.servico).toEqual({ previsto: 14400, realizado: 1200, saldo: 13200 });
    expect(r.dados.grupo).toMatchObject({ nome: 'Material (teste)', previsto: 14400, realizado: 1000, saldo: 13400 });
    expect(r.dados.ultimoMes).toBe(MES);
  });

  it('quem tem permissão só no seu escopo não recebe valor de outro serviço', async () => {
    await aprovarPrevisao();
    const ur = await como('coord.ur@exemplo.local');
    expect((await saldoParaConferencia(p, ur, 'ur', { ano: ANO })).estado).toBe('ok');
    expect(await saldoParaConferencia(p, ur, 'escola', { ano: ANO })).toEqual({ estado: 'sem_permissao' });
    expect(await saldoParaConferencia(p, await como('compras@exemplo.local'), 'escola', { ano: ANO })).toEqual({ estado: 'sem_permissao' });
  });

  it('grupo inexistente vira "sem grupo", sem erro', async () => {
    await aprovarPrevisao();
    const r = await saldoParaConferencia(p, await fin(), 'escola', { grupoId: 'nao-existe', ano: ANO });
    if (r.estado !== 'ok') throw new Error('esperava ok');
    expect(r.dados.grupo).toBeNull();
  });
});
