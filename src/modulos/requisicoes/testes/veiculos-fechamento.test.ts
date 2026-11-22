/**
 * Fechamento do pedido de veículo (proposta #229, entrega 3), com dados FICTÍCIOS:
 * confirmar o uso com a quilometragem, quem pode, quando, validações, aba e auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';

import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  cancelarRequisicao,
  contadoresRequisicoes,
  decidirRequisicao,
  detalharRequisicao,
  enviarRequisicao,
  fecharVeiculo,
  listarRequisicoes,
  salvarTipo,
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { salvarVeiculo } from '../aplicacao/veiculos';
import { RequisicaoHistorico, Requisicoes, TABELAS_REQUISICOES, TiposRequisicao, VeiculoUsos, Veiculos } from '../dados/tabelas';
import { conferirUsoVeiculo } from '../dominio/veiculo';
import { manifesto } from '../manifesto';

let p: Planilhas;
let pedidoId: string;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
}
const versao = async (id: string) => (await lerTabela(p, Requisicoes)).porId(id)!.versao;
const hora = (h: number, m = 0, dia = 2) => new Date(Date.UTC(2026, 10, dia, h + 3, m));
const ANTES = hora(9); // 2/11, antes da saída (10/11 às 08:00)
const DEPOIS = hora(13, 0, 10); // 10/11, depois da saída
const ok = { resultado: 'sem_problema', kmSaida: 1000, kmVolta: 1042 };

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  const admin = await como('admin@exemplo.local');
  await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'AAA0A00', capacidade: 12 });
  const [veiculos] = await lerTabelas(p, [Veiculos] as const);
  const van = veiculos.ativos()[0].id;
  await salvarTipo(p, admin, { nome: 'Uso de veículo', categoria: 'servico', formulario: 'veiculo', perfilResponsavel: 'transporte', prazoAprovacao: 8, prazoAtendimento: 8 });
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  const dados: DadosRequisicao & { nomeRequisitante: string } = {
    nomeRequisitante: 'Pessoa (fictícia)',
    tipoId: tipos.ativos().find((t) => t.formulario === 'veiculo')!.id,
    area: 'educacao',
    centros: [{ servico: 'escola', percentual: 100 }],
    itens: [],
    detalhes: { veiculoId: van, saida: '2026-11-10T08:00', volta: '2026-11-10T12:00', destino: 'Unidade parceira', finalidade: 'Levar material para a unidade', condutor: 'Condutor (fictício)' },
  };
  pedidoId = (await enviarRequisicao(p, await como('dp@exemplo.local'), dados, { agora: ANTES })).id;
});

const aprovar = async () => decidirRequisicao(p, await como('transporte@exemplo.local'), pedidoId, await versao(pedidoId), 'aprovar', null, { agora: ANTES });
const fechar = async (email: string, e: object = ok, agora = DEPOIS) => fecharVeiculo(p, await como(email), pedidoId, await versao(pedidoId), e, { agora });

describe('regras puras do fechamento', () => {
  const x = { saida: '2026-11-10T08:00' };
  it('confere resultado, texto, quilometragem e horário', () => {
    expect(conferirUsoVeiculo(x, ok, ANTES)).toMatchObject({ erro: expect.stringMatching(/depois da saída/) });
    expect(conferirUsoVeiculo(x, { ...ok, resultado: undefined }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/sem ou com problema/) });
    expect(conferirUsoVeiculo(x, { ...ok, resultado: 'com_problema', problema: 'curto' }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/mínimo de 10/) });
    expect(conferirUsoVeiculo(x, { ...ok, kmSaida: null }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/de saída/) });
    expect(conferirUsoVeiculo(x, { ...ok, kmVolta: 10.5 }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/de volta/) });
    expect(conferirUsoVeiculo(x, { ...ok, kmSaida: -1 }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/de saída/) });
    expect(conferirUsoVeiculo(x, { ...ok, kmVolta: 999 }, DEPOIS)).toMatchObject({ erro: expect.stringMatching(/menor/) });
    expect(conferirUsoVeiculo(x, { ...ok, kmVolta: 1000 }, DEPOIS)).toMatchObject({ resultado: 'sem_problema', kmVolta: 1000 });
  });
});

describe('confirmar o uso', () => {
  it('só o Transporte fecha; pedido não aprovado ou antes da saída não fecha', async () => {
    await expect(fechar('transporte@exemplo.local')).rejects.toThrow(/Não dá para/); // ainda só enviado
    await aprovar();
    await expect(fechar('dp@exemplo.local')).rejects.toThrow(ErroPermissao);
    await expect(fechar('diretoria@exemplo.local')).rejects.toThrow(ErroPermissao);
    await expect(fechar('admin@exemplo.local')).rejects.toThrow(ErroPermissao);
    await expect(fechar('transporte@exemplo.local', ok, ANTES)).rejects.toThrow(/depois da saída/);
  });

  it('grava o uso, encerra o pedido, registra histórico e auditoria sem valores', async () => {
    await aprovar();
    await fechar('transporte@exemplo.local', { resultado: 'com_problema', problema: 'Pneu furou na volta', kmSaida: 1000, kmVolta: 1042 });
    const r = (await lerTabela(p, Requisicoes)).porId(pedidoId)!;
    expect(r.situacao).toBe('atendida');
    expect(r.concluida_em).toBe(DEPOIS.toISOString());
    const [usos] = await lerTabelas(p, [VeiculoUsos] as const);
    expect(usos.ativos()).toHaveLength(1);
    expect(usos.ativos()[0]).toMatchObject({ requisicao_id: pedidoId, resultado: 'com_problema', problema: 'Pneu furou na volta', km_saida: 1000, km_volta: 1042, registrado_por: 'transporte@exemplo.local' });
    const [hist] = await lerTabelas(p, [RequisicaoHistorico] as const);
    const h = hist.todos().find((x) => x.requisicao_id === pedidoId && x.acao === 'fechar')!;
    expect(h.comentario).toMatch(/com problema \(42 km\): Pneu furou/);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'VeiculoUsos' || (a.entidade === 'Requisicoes' && a.registro_id === pedidoId));
    expect(auditoria.some((a) => a.entidade === 'VeiculoUsos' && a.acao === 'inclusao')).toBe(true);
    expect(JSON.stringify(auditoria)).not.toMatch(/Pneu|1042/);
  });

  it('não reabre nem fecha duas vezes, nem cancela depois de encerrado', async () => {
    await aprovar();
    await fechar('transporte@exemplo.local');
    await expect(fechar('transporte@exemplo.local')).rejects.toThrow(/Não dá para/);
    await expect(cancelarRequisicao(p, await como('transporte@exemplo.local'), pedidoId, await versao(pedidoId), 'tarde')).rejects.toThrow(/Não dá para/);
    expect((await lerTabela(p, VeiculoUsos)).ativos()).toHaveLength(1);
  });

  it('erro de validação não grava nada', async () => {
    await aprovar();
    await expect(fechar('transporte@exemplo.local', { ...ok, kmVolta: 5 })).rejects.toThrow(/menor/);
    expect((await lerTabela(p, Requisicoes)).porId(pedidoId)!.situacao).toBe('aprovada');
    expect((await lerTabela(p, VeiculoUsos)).ativos()).toHaveLength(0);
  });
});

describe('lista, contador e detalhe', () => {
  it('"para confirmar o uso" lista só aprovados com saída passada, e só para o Transporte', async () => {
    const t = await como('transporte@exemplo.local');
    expect(await listarRequisicoes(p, t, 'usar', { agora: DEPOIS })).toHaveLength(0);
    await aprovar();
    expect(await listarRequisicoes(p, t, 'usar', { agora: ANTES })).toHaveLength(0);
    expect((await listarRequisicoes(p, t, 'usar', { agora: DEPOIS })).map((l) => l.id)).toEqual([pedidoId]);
    expect((await contadoresRequisicoes(p, t, { agora: DEPOIS })).veiculosUsar).toBe(1);
    await expect(listarRequisicoes(p, await como('dp@exemplo.local'), 'usar', { agora: DEPOIS })).rejects.toThrow(ErroPermissao);
    expect((await contadoresRequisicoes(p, await como('dp@exemplo.local'), { agora: DEPOIS })).veiculosUsar).toBe(0);
    await fechar('transporte@exemplo.local');
    expect(await listarRequisicoes(p, t, 'usar', { agora: DEPOIS })).toHaveLength(0);
  });

  it('o detalhe oferece "fechar" ao Transporte e mostra o uso a quem pode ver o pedido', async () => {
    await aprovar();
    const t = await como('transporte@exemplo.local');
    const antes = await detalharRequisicao(p, t, pedidoId, { agora: ANTES });
    expect(antes.acoes).toContain('fechar');
    expect(antes.veiculo?.jaPodeConfirmarUso).toBe(false);
    expect((await detalharRequisicao(p, await como('dp@exemplo.local'), pedidoId, { agora: DEPOIS })).acoes).not.toContain('fechar');
    await fechar('transporte@exemplo.local');
    const depois = await detalharRequisicao(p, await como('dp@exemplo.local'), pedidoId, { agora: DEPOIS });
    expect(depois.acoes).not.toContain('fechar');
    expect(depois.veiculo?.uso).toMatchObject({ resultadoNome: 'Usado sem problema', kmSaida: 1000, kmVolta: 1042 });
    await expect(detalharRequisicao(p, await como('funcionario@exemplo.local'), pedidoId, { agora: DEPOIS })).rejects.toThrow(ErroPermissao);
  });
});

it('a aba VeiculoUsos entra na preparação da estrutura', () => {
  expect(TABELAS_REQUISICOES).toContain(VeiculoUsos);
});
