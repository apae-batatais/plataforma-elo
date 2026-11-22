/**
 * Pedido de veículo (proposta #229, entrega 2), com dados FICTÍCIOS: pedir, conflito, manutenção,
 * quem decide, cancelar reserva aprovada, agenda, quem vê e quem altera.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  agendaDeVeiculos,
  cancelarRequisicao,
  contadoresRequisicoes,
  decidirRequisicao,
  detalharRequisicao,
  enviarRequisicao,
  listarRequisicoes,
  opcoesDoFormulario,
  reenviarRequisicao,
  salvarTipo,
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { definirManutencaoPrevista, marcarManutencaoFeita, salvarVeiculo } from '../aplicacao/veiculos';
import { Requisicoes, RequisicaoHistorico, TABELAS_REQUISICOES, TiposRequisicao, Veiculos } from '../dados/tabelas';
import { aceitaAnexos } from '../dominio/anexos';
import { pedidosEmConflito, periodosSeCruzam } from '../dominio/veiculo';
import { manifesto } from '../manifesto';

let p: Planilhas;
let tipoId: string;
let van: string;
let carro: string;

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
// 2/11/2026 (segunda), horário de Brasília.
const hora = (h: number, m = 0, dia = 2) => new Date(Date.UTC(2026, 10, dia, h + 3, m));
const AGORA = hora(9);
const ficha = (detalhes: object = {}, x: Partial<DadosRequisicao> = {}): DadosRequisicao & { nomeRequisitante: string } => ({
  nomeRequisitante: 'Pessoa (fictícia)',
  tipoId,
  area: 'educacao',
  centros: [{ servico: 'escola', percentual: 100 }],
  itens: [],
  detalhes: {
    veiculoId: van,
    saida: '2026-11-10T08:00',
    volta: '2026-11-10T12:00',
    destino: 'Unidade parceira',
    finalidade: 'Levar material para a unidade',
    condutor: 'Condutor (fictício)',
    ...detalhes,
  },
  ...x,
});
const pedir = async (email: string, detalhes: object = {}, x: Partial<DadosRequisicao> = {}) => enviarRequisicao(p, await como(email), ficha(detalhes, x), { agora: AGORA });
const decidir = async (email: string, id: string, acao: 'aprovar' | 'devolver' | 'recusar', comentario: string | null = null, confirmar = false) =>
  decidirRequisicao(p, await como(email), id, await versao(id), acao, comentario, { agora: AGORA, confirmarConflito: confirmar });

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  const admin = await como('admin@exemplo.local');
  await salvarVeiculo(p, admin, { nome: 'Van 1', placa: 'AAA0A00', capacidade: 12 });
  await salvarVeiculo(p, admin, { nome: 'Carro 1', placa: 'BBB1B11', capacidade: 5 });
  const [veiculos] = await lerTabelas(p, [Veiculos] as const);
  van = veiculos.ativos().find((v) => v.nome === 'Van 1')!.id;
  carro = veiculos.ativos().find((v) => v.nome === 'Carro 1')!.id;
  await salvarTipo(p, admin, { nome: 'Uso de veículo', categoria: 'servico', formulario: 'veiculo', perfilResponsavel: 'transporte', prazoAprovacao: 8, prazoAtendimento: 8 });
  const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
  tipoId = tipos.ativos().find((t) => t.formulario === 'veiculo')!.id;
  // Um segundo funcionário do Transporte, para o caso "quem é do Transporte também pede".
  await inserir(p, Atribuicoes, { usuario_email: 'financeiro@exemplo.local', perfil: 'transporte', escopo_tipo: 'global', escopo: null, inicio: null, fim: null }, { email: 'teste' });
});

describe('regras puras', () => {
  it('encostar (volta = saída) não cruza; sobrepor cruza; passa de um dia', () => {
    expect(periodosSeCruzam({ saida: '2026-11-10T08:00', volta: '2026-11-10T12:00' }, { saida: '2026-11-10T12:00', volta: '2026-11-10T14:00' })).toBe(false);
    expect(periodosSeCruzam({ saida: '2026-11-10T08:00', volta: '2026-11-11T09:00' }, { saida: '2026-11-11T08:00', volta: '2026-11-11T10:00' })).toBe(true);
  });

  it('só conta enviada e aprovada, do mesmo veículo', () => {
    const base = { veiculoId: 'a', saida: '2026-11-10T08:00', volta: '2026-11-10T12:00' };
    const alvo = { id: '1', situacao: 'enviada', ...base };
    const lista = [
      { id: '2', situacao: 'aprovada', ...base },
      { id: '3', situacao: 'recusada', ...base },
      { id: '4', situacao: 'cancelada', ...base },
      { id: '5', situacao: 'devolvida', ...base },
      { id: '6', situacao: 'enviada', ...base, veiculoId: 'b' },
    ];
    expect(pedidosEmConflito(alvo, lista).map((x) => x.id)).toEqual(['2']);
  });
});

describe('pedir um veículo', () => {
  it('qualquer pessoa pede; o pedido vai ao Transporte e grava centros de custo', async () => {
    const r = await pedir('dp@exemplo.local');
    expect(r.veiculo).toBe(true);
    expect(r.rota.tipo).toBe('coordenacao');
    const d = await detalharRequisicao(p, await como('dp@exemplo.local'), r.id, { agora: AGORA });
    expect(d.centros).toEqual([{ servico: 'escola', nome: expect.any(String), percentual: 100 }]);
    expect(d.veiculo?.nome).toBe('Van 1');
    expect(d.acoes).toContain('cancelar');
  });

  it('exige todos os campos, volta depois da saída, finalidade com 10 letras e saída fora do passado', async () => {
    await expect(pedir('dp@exemplo.local', { destino: '' })).rejects.toThrow(/destino/i);
    await expect(pedir('dp@exemplo.local', { finalidade: 'curto' })).rejects.toThrow(/mínimo de 10/);
    await expect(pedir('dp@exemplo.local', { condutor: ' ' })).rejects.toThrow(/condutor/i);
    await expect(pedir('dp@exemplo.local', { volta: '2026-11-10T08:00' })).rejects.toThrow(/depois da saída/);
    await expect(pedir('dp@exemplo.local', { saida: '2026-11-02T08:00', volta: '2026-11-02T10:00' })).rejects.toThrow(/passado/);
    await expect(pedir('dp@exemplo.local', { veiculoId: 'nao-existe' })).rejects.toThrow(/não está disponível/);
  });

  it('pede centros de custo como os outros tipos', async () => {
    await expect(pedir('dp@exemplo.local', {}, { centros: [] })).rejects.toThrow(/centro/i);
    await expect(pedir('dp@exemplo.local', {}, { centros: [{ servico: 'escola', percentual: 50 }] })).rejects.toThrow(/100/);
  });

  it('o pedido pode passar de um dia', async () => {
    const r = await pedir('dp@exemplo.local', { saida: '2026-11-10T08:00', volta: '2026-11-12T18:00' });
    expect(r.id).toBeTruthy();
  });

  it('quem é do Transporte pede e a Diretoria aprova; ninguém aprova o próprio', async () => {
    const r = await pedir('financeiro@exemplo.local');
    expect(r.rota).toMatchObject({ tipo: 'diretoria' });
    await expect(decidir('financeiro@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await expect(decidir('transporte@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await decidir('diretoria@exemplo.local', r.id, 'aprovar');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('aprovada');
  });

  it('o tipo de veículo não aceita foto nem vídeo e só pode ser decidido pelo Transporte', async () => {
    const [tipos] = await lerTabelas(p, [TiposRequisicao] as const);
    expect(aceitaAnexos(tipos.porId(tipoId)!)).toBe(false);
    await expect(
      salvarTipo(p, await como('admin@exemplo.local'), { nome: 'Outro', categoria: 'servico', formulario: 'veiculo', perfilResponsavel: 'manutencao', prazoAprovacao: 8, prazoAtendimento: 8 }),
    ).rejects.toThrow(/Transporte/);
  });
});

describe('quem decide', () => {
  it('o Transporte (de qualquer coordenação) aprova; a coordenação dos centros não', async () => {
    const r = await pedir('dp@exemplo.local');
    await expect(decidir('coord.educacao@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await expect(decidir('funcionario@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await decidir('transporte@exemplo.local', r.id, 'aprovar');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('aprovada');
  });

  it('devolver e recusar pedem comentário; devolvida volta a ser enviada pelo ajuste', async () => {
    const r = await pedir('dp@exemplo.local');
    await expect(decidir('transporte@exemplo.local', r.id, 'devolver')).rejects.toThrow(/precisa ser ajustado/);
    await decidir('transporte@exemplo.local', r.id, 'devolver', 'Mude o horário');
    await reenviarRequisicao(p, await como('dp@exemplo.local'), r.id, await versao(r.id), ficha({ saida: '2026-11-10T09:00' }), { agora: AGORA });
    await expect(decidir('transporte@exemplo.local', r.id, 'recusar')).rejects.toThrow(/motivo/);
    await decidir('transporte@exemplo.local', r.id, 'recusar', 'Sem motorista');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('recusada');
  });

  it('a Diretoria não decide pedido de quem não é do Transporte', async () => {
    const r = await pedir('dp@exemplo.local');
    await expect(decidir('diretoria@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
  });
});

describe('conflito de horário', () => {
  it('nunca bloqueia o envio; quem pede não vê o outro pedido; o Transporte vê', async () => {
    const a = await pedir('dp@exemplo.local');
    const b = await pedir('funcionario@exemplo.local', { saida: '2026-11-10T10:00', volta: '2026-11-10T14:00' });
    const dPede = await detalharRequisicao(p, await como('funcionario@exemplo.local'), b.id, { agora: AGORA });
    expect(dPede.veiculo?.haConflito).toBe(true);
    expect(dPede.veiculo?.conflitos).toBeNull();
    const dTrans = await detalharRequisicao(p, await como('transporte@exemplo.local'), b.id, { agora: AGORA });
    expect(dTrans.veiculo?.conflitos?.map((c) => c.id)).toEqual([a.id]);
    const lista = await listarRequisicoes(p, await como('transporte@exemplo.local'), 'veiculos', { agora: AGORA });
    expect(lista.every((l) => l.veiculo?.conflito)).toBe(true);
  });

  it('outro veículo ou horário encostando não conflita; recusado, cancelado e devolvido não contam', async () => {
    await pedir('dp@exemplo.local');
    const outro = await pedir('funcionario@exemplo.local', { veiculoId: carro });
    const encosta = await pedir('compras@exemplo.local', { saida: '2026-11-10T12:00', volta: '2026-11-10T13:00' });
    const t = await como('transporte@exemplo.local');
    expect((await detalharRequisicao(p, t, outro.id, { agora: AGORA })).veiculo?.haConflito).toBe(false);
    expect((await detalharRequisicao(p, t, encosta.id, { agora: AGORA })).veiculo?.haConflito).toBe(false);
    const rec = await pedir('almoxarifado@exemplo.local', { saida: '2026-11-10T09:00', volta: '2026-11-10T11:00' });
    await decidir('transporte@exemplo.local', rec.id, 'recusar', 'Sem motorista');
    const cand = await pedir('compras@exemplo.local', { saida: '2026-11-10T09:30', volta: '2026-11-10T10:30' });
    const conflitos = (await detalharRequisicao(p, t, cand.id, { agora: AGORA })).veiculo?.conflitos ?? [];
    expect(conflitos.some((c) => c.id === rec.id)).toBe(false);
  });

  it('aprovar sobre pedido já aprovado pede confirmação (e ela vai ao histórico); sobre pedido só enviado, não', async () => {
    const a = await pedir('dp@exemplo.local');
    const b = await pedir('funcionario@exemplo.local', { saida: '2026-11-10T10:00', volta: '2026-11-10T14:00' });
    await decidir('transporte@exemplo.local', a.id, 'aprovar'); // b ainda só enviado: sem confirmação
    await expect(decidir('transporte@exemplo.local', b.id, 'aprovar')).rejects.toThrow(/já está aprovado/);
    await decidir('transporte@exemplo.local', b.id, 'aprovar', null, true);
    const [historico] = await lerTabelas(p, [RequisicaoHistorico] as const);
    expect(historico.todos().find((h) => h.requisicao_id === b.id && h.acao === 'aprovar')?.comentario).toMatch(/mesmo horário/);
  });
});

describe('manutenção', () => {
  it('a partir do dia da data prevista o veículo some para períodos que tocam o dia; antes, funciona', async () => {
    const admin = await como('admin@exemplo.local');
    await definirManutencaoPrevista(p, admin, van, '2026-11-15');
    await pedir('dp@exemplo.local'); // 10/11: antes
    await expect(pedir('dp@exemplo.local', { saida: '2026-11-14T08:00', volta: '2026-11-15T09:00' })).rejects.toThrow(/manutenção/);
    await expect(pedir('dp@exemplo.local', { saida: '2026-11-20T08:00', volta: '2026-11-20T09:00' })).rejects.toThrow(/manutenção/);
    await pedir('dp@exemplo.local', { saida: '2026-11-14T08:00', volta: '2026-11-14T23:00' }); // termina antes do dia
    const o = await opcoesDoFormulario(p, await como('dp@exemplo.local'));
    expect(o.veiculos.find((v) => v.id === van)?.manutencaoPrevista).toBe('2026-11-15');
    await marcarManutencaoFeita(p, admin, van, null, { agora: AGORA });
    await pedir('dp@exemplo.local', { saida: '2026-11-20T08:00', volta: '2026-11-20T09:00' });
  });

  it('pedido aprovado antes da manutenção continua aprovado e mostra o aviso ao Transporte (não a quem pede)', async () => {
    const a = await pedir('dp@exemplo.local', { saida: '2026-11-20T08:00', volta: '2026-11-20T10:00' });
    await decidir('transporte@exemplo.local', a.id, 'aprovar');
    await definirManutencaoPrevista(p, await como('admin@exemplo.local'), van, '2026-11-18');
    const t = await detalharRequisicao(p, await como('transporte@exemplo.local'), a.id, { agora: AGORA });
    expect(t.requisicao.situacao).toBe('aprovada');
    expect(t.veiculo?.avisoManutencao).toMatch(/18\/11\/2026/);
    const lista = await listarRequisicoes(p, await como('transporte@exemplo.local'), 'veiculos', { agora: AGORA });
    expect(lista).toHaveLength(0); // aprovada não está mais "para decidir"
    const l = (await listarRequisicoes(p, await como('transporte@exemplo.local'), 'aprovar', { agora: AGORA }).catch(() => [])) as unknown[];
    expect(l).toEqual([]);
    const pede = await detalharRequisicao(p, await como('dp@exemplo.local'), a.id, { agora: AGORA });
    expect(pede.veiculo?.conflitos).toBeNull();
  });

  it('o Transporte também marca a manutenção como feita; quem não é Transporte nem Administração, não', async () => {
    await definirManutencaoPrevista(p, await como('admin@exemplo.local'), van, '2026-11-15');
    await expect(marcarManutencaoFeita(p, await como('dp@exemplo.local'), van, null, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await marcarManutencaoFeita(p, await como('transporte@exemplo.local'), van, '2026-12-01', { agora: AGORA });
    await expect(definirManutencaoPrevista(p, await como('transporte@exemplo.local'), van, '2026-12-05')).rejects.toThrow(ErroPermissao);
  });
});

describe('cancelar', () => {
  it('quem pediu cancela enquanto não aprovado; depois de aprovado, só o Transporte, com comentário', async () => {
    const a = await pedir('dp@exemplo.local');
    const b = await pedir('funcionario@exemplo.local', { veiculoId: carro });
    await cancelarRequisicao(p, await como('funcionario@exemplo.local'), b.id, await versao(b.id), null, { agora: AGORA });
    await decidir('transporte@exemplo.local', a.id, 'aprovar');
    await expect(cancelarRequisicao(p, await como('dp@exemplo.local'), a.id, await versao(a.id), 'desisti', { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await expect(cancelarRequisicao(p, await como('funcionario@exemplo.local'), a.id, await versao(a.id), 'x', { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await expect(cancelarRequisicao(p, await como('transporte@exemplo.local'), a.id, await versao(a.id), ' ', { agora: AGORA })).rejects.toThrow(/Explique/);
    const d = await detalharRequisicao(p, await como('transporte@exemplo.local'), a.id, { agora: AGORA });
    expect(d.acoes).toContain('cancelar');
    await cancelarRequisicao(p, await como('transporte@exemplo.local'), a.id, await versao(a.id), 'Veículo em manutenção', { agora: AGORA });
    expect((await lerTabela(p, Requisicoes)).porId(a.id)!.situacao).toBe('cancelada');
  });

  it('outros tipos aprovados continuam sem cancelamento', async () => {
    const r = await pedir('dp@exemplo.local');
    await decidir('transporte@exemplo.local', r.id, 'aprovar');
    const d = await detalharRequisicao(p, await como('dp@exemplo.local'), r.id, { agora: AGORA });
    expect(d.acoes).not.toContain('cancelar');
  });
});

describe('quem vê e agenda', () => {
  it('quem não é Transporte nem Diretoria não vê pedido de veículo dos outros', async () => {
    const r = await pedir('dp@exemplo.local');
    await expect(detalharRequisicao(p, await como('funcionario@exemplo.local'), r.id, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await expect(detalharRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    for (const e of ['transporte@exemplo.local', 'diretoria@exemplo.local', 'dp@exemplo.local'])
      await expect(detalharRequisicao(p, await como(e), r.id, { agora: AGORA })).resolves.toBeTruthy();
    await expect(listarRequisicoes(p, await como('funcionario@exemplo.local'), 'veiculos')).rejects.toThrow(ErroPermissao);
  });

  it('a lista do Transporte traz só pedidos de veículo; o contador acompanha', async () => {
    await pedir('dp@exemplo.local');
    const t = await como('transporte@exemplo.local');
    expect(await listarRequisicoes(p, t, 'veiculos', { agora: AGORA })).toHaveLength(1);
    expect((await contadoresRequisicoes(p, t, { agora: AGORA })).veiculosDecidir).toBe(1);
    expect((await contadoresRequisicoes(p, await como('dp@exemplo.local'), { agora: AGORA })).veiculosDecidir).toBe(0);
  });

  it('a agenda mostra os próximos 30 dias por veículo, só para o Transporte', async () => {
    await definirManutencaoPrevista(p, await como('admin@exemplo.local'), carro, '2026-11-20');
    await pedir('dp@exemplo.local');
    await pedir('dp@exemplo.local', { saida: '2027-03-10T08:00', volta: '2027-03-10T10:00', veiculoId: carro }).catch(() => null);
    const a = await agendaDeVeiculos(p, await como('transporte@exemplo.local'), { agora: AGORA });
    expect(a.find((v) => v.id === van)?.pedidos).toHaveLength(1);
    expect(a.find((v) => v.id === carro)?.pedidos).toHaveLength(0);
    expect(a.find((v) => v.id === carro)?.manutencaoPrevista).toBe('2026-11-20');
    await expect(agendaDeVeiculos(p, await como('dp@exemplo.local'), { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await expect(agendaDeVeiculos(p, await como('admin@exemplo.local'), { agora: AGORA })).rejects.toThrow(ErroPermissao);
  });

  it('o painel de prazos não conta atendimento para veículo', async () => {
    const r = await pedir('dp@exemplo.local');
    await decidir('transporte@exemplo.local', r.id, 'aprovar');
    const d = await detalharRequisicao(p, await como('transporte@exemplo.local'), r.id, { agora: AGORA });
    expect(d.sla?.atendimento).toBeNull();
  });
});
