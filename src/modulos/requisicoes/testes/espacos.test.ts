/**
 * Reserva de espaço (proposta #230), com dados FICTÍCIOS: pedir, conflito, quem decide,
 * fechamento depois do uso, cadastro de espaços e períodos, quem vê e quem altera.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  adicionarPeriodoDeEspaco,
  cancelarRequisicao,
  contadoresRequisicoes,
  decidirRequisicao,
  detalharRequisicao,
  encerrarPeriodoDeEspaco,
  enviarRequisicao,
  ErroRequisicao,
  fecharReserva,
  listarEspacos,
  listarRequisicoes,
  mudarSituacaoEspaco,
  opcoesDoFormulario,
  painelDePrazos,
  reenviarRequisicao,
  salvarEspaco,
  salvarTipo,
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { EspacoIndisponibilidades, Espacos, RequisicaoCentros, RequisicaoHistorico, Requisicoes, TABELAS_REQUISICOES } from '../dados/tabelas';
import { conferirFechamento, horariosSeCruzam, reservasEmConflito } from '../dominio/espaco';
import { manifesto } from '../manifesto';

let p: Planilhas;
let tipoId: string;
let salao: string;
let sala: string;

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
  detalhes: { espacoId: salao, data: '2026-11-10', inicio: '14:00', fim: '16:00', finalidade: 'Reunião de equipe', pessoas: 20, usoExterno: false, ...detalhes },
  ...x,
});
const pedir = async (email: string, detalhes: object = {}, x: Partial<DadosRequisicao> = {}) =>
  enviarRequisicao(p, await como(email), ficha(detalhes, x), { agora: AGORA });
const decidir = async (email: string, id: string, acao: 'aprovar' | 'devolver' | 'recusar', comentario: string | null = null, confirmar = false) =>
  decidirRequisicao(p, await como(email), id, await versao(id), acao, comentario, { agora: AGORA, confirmarConflito: confirmar });

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  const admin = await como('admin@exemplo.local');
  await salvarEspaco(p, admin, { nome: 'Salão 1', local: 'Sede', capacidade: 50 });
  await salvarEspaco(p, admin, { nome: 'Sala de reuniões', local: 'Sede', capacidade: 10 });
  const [espacos] = await lerTabelas(p, [Espacos] as const);
  salao = espacos.ativos().find((e) => e.nome === 'Salão 1')!.id;
  sala = espacos.ativos().find((e) => e.nome === 'Sala de reuniões')!.id;
  await salvarTipo(p, admin, {
    nome: 'Reserva de espaço',
    categoria: 'servico',
    formulario: 'espaco',
    perfilResponsavel: 'espacos',
    prazoAprovacao: 8,
    prazoAtendimento: 8,
  });
  const [tipos] = await lerTabelas(p, [(await import('../dados/tabelas')).TiposRequisicao] as const);
  tipoId = tipos.ativos().find((t) => t.formulario === 'espaco')!.id;
  // Um segundo funcionário do setor Espaços, para o caso "quem é do setor também pede".
  await inserir(p, Atribuicoes, { usuario_email: 'financeiro@exemplo.local', perfil: 'espacos', escopo_tipo: 'global', escopo: null, inicio: null, fim: null }, { email: 'teste' });
});

describe('regras puras', () => {
  it('encostar não cruza; sobrepor cruza; só conta enviada e aprovada no mesmo espaço e data', () => {
    expect(horariosSeCruzam({ inicio: '10:00', fim: '11:00' }, { inicio: '11:00', fim: '12:00' })).toBe(false);
    expect(horariosSeCruzam({ inicio: '10:00', fim: '11:30' }, { inicio: '11:00', fim: '12:00' })).toBe(true);
    const base = { espacoId: 'a', data: '2026-11-10', inicio: '10:00', fim: '12:00' };
    const alvo = { id: '1', situacao: 'enviada', ...base };
    const lista = [
      { id: '2', situacao: 'aprovada', ...base },
      { id: '3', situacao: 'recusada', ...base },
      { id: '4', situacao: 'enviada', ...base, espacoId: 'b' },
      { id: '5', situacao: 'enviada', ...base, data: '2026-11-11' },
      { id: '6', situacao: 'enviada', ...base, inicio: '12:00', fim: '13:00' },
    ];
    expect(reservasEmConflito(alvo, lista).map((x) => x.id)).toEqual(['2']);
  });

  it('fechamento: só depois da hora de fim; "com problema" exige texto', () => {
    const r = { data: '2026-11-10', fim: '16:00' };
    expect(conferirFechamento(r, 'sem_problema', null, hora(15, 59, 10))).toHaveProperty('erro');
    expect(conferirFechamento(r, 'sem_problema', null, hora(16, 0, 10))).toEqual({ resultado: 'sem_problema', texto: null });
    expect(conferirFechamento(r, 'com_problema', 'curto', hora(17, 0, 10))).toHaveProperty('erro');
    expect(conferirFechamento(r, null, null, hora(17, 0, 10))).toHaveProperty('erro');
  });
});

describe('pedir um espaço', () => {
  it('qualquer pessoa pede; o pedido vai ao setor Espaços e grava centros de custo', async () => {
    const r = await pedir('dp@exemplo.local');
    expect(r.espaco).toBe(true);
    expect(r.rota.tipo).toBe('coordenacao');
    const [centros] = await lerTabelas(p, [RequisicaoCentros] as const);
    expect(centros.ativos().filter((c) => c.requisicao_id === r.id)).toHaveLength(1);
  });

  it('valida campos, horário, data passada e espaço', async () => {
    await expect(pedir('dp@exemplo.local', { finalidade: 'abc' })).rejects.toThrow(/finalidade/i);
    await expect(pedir('dp@exemplo.local', { pessoas: 0 })).rejects.toThrow(/pessoas/i);
    await expect(pedir('dp@exemplo.local', { inicio: '16:00', fim: '14:00' })).rejects.toThrow(/depois da hora de início/);
    await expect(pedir('dp@exemplo.local', { data: '2026-11-01' })).rejects.toThrow(/anterior a hoje/);
    await expect(pedir('dp@exemplo.local', { espacoId: 'nao-existe' })).rejects.toThrow(/não está disponível/);
    await expect(pedir('dp@exemplo.local', {}, { centros: [{ servico: 'escola', percentual: 50 }] })).rejects.toThrow(/somam 50%/);
  });

  it('uso externo: sem centros de custo, com nome da organização; sem uso externo, centros obrigatórios', async () => {
    await expect(pedir('dp@exemplo.local', { usoExterno: true, organizacaoExterna: 'ab' }, { centros: [] })).rejects.toThrow(/organização ou pessoa/);
    const r = await pedir('dp@exemplo.local', { usoExterno: true, organizacaoExterna: 'Associação de moradores' }, { centros: [] });
    const [centros] = await lerTabelas(p, [RequisicaoCentros] as const);
    expect(centros.ativos().filter((c) => c.requisicao_id === r.id)).toHaveLength(0);
    await expect(pedir('dp@exemplo.local', {}, { centros: [] })).rejects.toThrow(/centro de custo/);
  });

  it('espaço com período de indisponibilidade na data não é aceito, nem no reenvio; inativo também', async () => {
    const admin = await como('admin@exemplo.local');
    await adicionarPeriodoDeEspaco(p, admin, salao, { inicio: '2026-11-09', fim: '2026-11-12', motivo: 'Reforma' });
    await expect(pedir('dp@exemplo.local')).rejects.toThrow(/indisponível.*Reforma/);
    await pedir('dp@exemplo.local', { data: '2026-11-13' });
    const opcoes = await opcoesDoFormulario(p, await como('dp@exemplo.local'));
    expect(opcoes.espacos.find((e) => e.id === salao)!.indisponiveis).toEqual([{ inicio: '2026-11-09', fim: '2026-11-12' }]);
    const [espacos] = await lerTabelas(p, [Espacos] as const);
    await mudarSituacaoEspaco(p, admin, sala, espacos.porId(sala)!.versao, false);
    await expect(pedir('dp@exemplo.local', { espacoId: sala })).rejects.toThrow(/não está disponível/);
  });

  it('capacidade acima do limite não bloqueia; a ficha avisa quem decide', async () => {
    const r = await pedir('dp@exemplo.local', { espacoId: sala, pessoas: 30 });
    const d = await detalharRequisicao(p, await como('espacos@exemplo.local'), r.id, { agora: AGORA });
    expect(d.reserva?.acimaDaCapacidade).toBe(true);
  });
});

describe('quem decide', () => {
  it('só o Espaços decide; coordenação, Diretoria (pedido comum) e quem pediu não', async () => {
    const r = await pedir('dp@exemplo.local');
    for (const e of ['coord.educacao@exemplo.local', 'diretoria@exemplo.local', 'dp@exemplo.local'])
      await expect(decidir(e, r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await decidir('espacos@exemplo.local', r.id, 'aprovar');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('aprovada');
  });

  it('pedido de quem é do Espaços é decidido pela Diretoria; ninguém decide o próprio', async () => {
    const r = await pedir('financeiro@exemplo.local');
    expect(r.rota.tipo).toBe('diretoria');
    await expect(decidir('financeiro@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await expect(decidir('espacos@exemplo.local', r.id, 'aprovar')).rejects.toThrow(ErroPermissao);
    await decidir('diretoria@exemplo.local', r.id, 'aprovar');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('aprovada');
  });

  it('devolver e recusar exigem comentário; devolvido pode ser ajustado e reenviado', async () => {
    const r = await pedir('dp@exemplo.local');
    await expect(decidir('espacos@exemplo.local', r.id, 'devolver')).rejects.toThrow(/o que precisa ser ajustado/);
    await decidir('espacos@exemplo.local', r.id, 'devolver', 'Troque o horário');
    const d = ficha({ inicio: '15:00', fim: '17:00' });
    await reenviarRequisicao(p, await como('dp@exemplo.local'), r.id, await versao(r.id), d, { agora: AGORA });
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('enviada');
    await decidir('espacos@exemplo.local', r.id, 'recusar', 'Sem vaga');
    expect((await lerTabela(p, Requisicoes)).porId(r.id)!.situacao).toBe('recusada');
  });

  it('quem pede cancela enquanto não aprovado; aprovado não cancela', async () => {
    const r = await pedir('dp@exemplo.local');
    const outra = await pedir('dp@exemplo.local', { inicio: '18:00', fim: '19:00' });
    await cancelarRequisicao(p, await como('dp@exemplo.local'), r.id, await versao(r.id), null, { agora: AGORA });
    await decidir('espacos@exemplo.local', outra.id, 'aprovar');
    await expect(cancelarRequisicao(p, await como('dp@exemplo.local'), outra.id, await versao(outra.id), null)).rejects.toThrow(ErroRequisicao);
  });
});

describe('conflito de horário', () => {
  it('não bloqueia o pedido; quem decide vê só os que cruzam (encostar não conta)', async () => {
    const a = await pedir('dp@exemplo.local');
    const b = await pedir('tecnico.cer@exemplo.local', { inicio: '15:00', fim: '17:00' });
    await pedir('dp@exemplo.local', { inicio: '16:00', fim: '17:00' }); // encosta em A (14–16): não cruza
    const dA = await detalharRequisicao(p, await como('espacos@exemplo.local'), a.id, { agora: AGORA });
    expect(dA.reserva?.conflitos?.map((x) => x.numero)).toEqual([b.numero]);
  });

  it('aprovar contra pedido só enviado não pede confirmação', async () => {
    const a = await pedir('dp@exemplo.local');
    await pedir('tecnico.cer@exemplo.local', { inicio: '15:00', fim: '17:00' });
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    expect((await lerTabela(p, Requisicoes)).porId(a.id)!.situacao).toBe('aprovada');
  });

  it('aprovar sobre horário já aprovado pede confirmação explícita', async () => {
    const a = await pedir('dp@exemplo.local');
    const b = await pedir('tecnico.cer@exemplo.local', { inicio: '15:00', fim: '17:00' });
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    await expect(decidir('espacos@exemplo.local', b.id, 'aprovar')).rejects.toThrow(/já está aprovado/);
    await decidir('espacos@exemplo.local', b.id, 'aprovar', null, true);
    expect((await lerTabela(p, Requisicoes)).porId(b.id)!.situacao).toBe('aprovada');
  });

  it('o conflito só aparece para quem decide as reservas; quem pede não vê os outros', async () => {
    const a = await pedir('dp@exemplo.local');
    await pedir('tecnico.cer@exemplo.local');
    const dono = await detalharRequisicao(p, await como('dp@exemplo.local'), a.id, { agora: AGORA });
    expect(dono.reserva?.conflitos).toBeNull();
    await expect(detalharRequisicao(p, await como('tecnico.cer@exemplo.local'), a.id)).rejects.toThrow(ErroPermissao);
  });

  it('período novo sobre pedido aprovado não cancela nada: aparece o aviso', async () => {
    const a = await pedir('dp@exemplo.local');
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    await adicionarPeriodoDeEspaco(p, await como('admin@exemplo.local'), salao, { inicio: '2026-11-10', fim: '2026-11-10', motivo: 'Obra' });
    const d = await detalharRequisicao(p, await como('espacos@exemplo.local'), a.id, { agora: AGORA });
    expect((await lerTabela(p, Requisicoes)).porId(a.id)!.situacao).toBe('aprovada');
    expect(d.reserva?.aviso).toMatch(/indisponibilidade/);
  });
});

describe('quem vê', () => {
  it('Espaços vê todas as reservas e só elas; coordenação comum não vê; Diretoria vê tudo', async () => {
    const a = await pedir('dp@exemplo.local');
    const espacos = await como('espacos@exemplo.local');
    expect((await listarRequisicoes(p, espacos, 'espacos', { agora: AGORA })).map((x) => x.id)).toEqual([a.id]);
    await expect(listarRequisicoes(p, await como('dp@exemplo.local'), 'espacos')).rejects.toThrow(ErroPermissao);
    await expect(detalharRequisicao(p, await como('coord.educacao@exemplo.local'), a.id)).rejects.toThrow(ErroPermissao);
    await detalharRequisicao(p, await como('diretoria@exemplo.local'), a.id);
    const c = await contadoresRequisicoes(p, espacos, { agora: AGORA });
    expect(c.espacosDecidir).toBe(1);
    expect((await contadoresRequisicoes(p, await como('dp@exemplo.local'), { agora: AGORA })).espacosDecidir).toBe(0);
  });

  it('o pedido do Espaços aparece em "Para aprovar" da Diretoria, e o comum não', async () => {
    await pedir('dp@exemplo.local');
    const f = await pedir('financeiro@exemplo.local', { inicio: '08:00', fim: '09:00' });
    const lista = await listarRequisicoes(p, await como('diretoria@exemplo.local'), 'aprovar', { agora: AGORA });
    expect(lista.map((x) => x.id)).toEqual([f.id]);
  });
});

describe('fechar a reserva', () => {
  it('só o Espaços, só depois da hora de fim, só em pedido aprovado; "com problema" exige texto', async () => {
    const a = await pedir('dp@exemplo.local');
    const espacos = await como('espacos@exemplo.local');
    await expect(fecharReserva(p, espacos, a.id, await versao(a.id), { resultado: 'sem_problema' }, { agora: hora(17, 0, 10) })).rejects.toThrow(/Não dá para/);
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    await expect(fecharReserva(p, espacos, a.id, await versao(a.id), { resultado: 'sem_problema' }, { agora: hora(15, 0, 10) })).rejects.toThrow(/depois de 16:00 de 10\/11\/2026/);
    await expect(fecharReserva(p, await como('diretoria@exemplo.local'), a.id, await versao(a.id), { resultado: 'sem_problema' }, { agora: hora(17, 0, 10) })).rejects.toThrow(ErroPermissao);
    await expect(fecharReserva(p, await como('dp@exemplo.local'), a.id, await versao(a.id), { resultado: 'sem_problema' }, { agora: hora(17, 0, 10) })).rejects.toThrow(ErroPermissao);
    await expect(fecharReserva(p, espacos, a.id, await versao(a.id), { resultado: 'com_problema', texto: 'curto' }, { agora: hora(17, 0, 10) })).rejects.toThrow(/mínimo de 10/);
    expect((await listarRequisicoes(p, espacos, 'fechar', { agora: hora(15, 0, 10) })).length).toBe(0);
    expect((await listarRequisicoes(p, espacos, 'fechar', { agora: hora(17, 0, 10) })).length).toBe(1);
    await fecharReserva(p, espacos, a.id, await versao(a.id), { resultado: 'com_problema', texto: 'Projetor ficou ligado e quebrou' }, { agora: hora(17, 0, 10) });
    const r = (await lerTabela(p, Requisicoes)).porId(a.id)!;
    expect(r.situacao).toBe('atendida');
    expect(JSON.parse(r.detalhes!).fechamento.resultado).toBe('com_problema');
    const [hist] = await lerTabelas(p, [RequisicaoHistorico] as const);
    expect(hist.todos().some((h) => h.requisicao_id === a.id && h.acao === 'fechar' && /Projetor/.test(h.comentario ?? ''))).toBe(true);
    // Fechado não reabre nem fecha de novo.
    await expect(fecharReserva(p, espacos, a.id, await versao(a.id), { resultado: 'sem_problema' }, { agora: hora(18, 0, 10) })).rejects.toThrow(/Não dá para/);
  });

  it('a reserva não tem "receber" nem "concluir" e fica fora do prazo de atendimento', async () => {
    const a = await pedir('dp@exemplo.local');
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    const d = await detalharRequisicao(p, await como('espacos@exemplo.local'), a.id, { agora: AGORA });
    expect(d.acoes).toEqual(['fechar']);
    expect(d.sla?.atendimento).toBeNull();
    const painel = await painelDePrazos(p, await como('diretoria@exemplo.local'), {}, { agora: hora(9, 0, 20) });
    expect(painel.atrasadas.some((x) => x.id === a.id)).toBe(false);
  });
});

describe('cadastro de espaços', () => {
  it('só a Administração cadastra; nome sem repetir; capacidade inteira; nada é apagado', async () => {
    const admin = await como('admin@exemplo.local');
    for (const e of ['espacos@exemplo.local', 'diretoria@exemplo.local', 'dp@exemplo.local'])
      await expect(salvarEspaco(p, await como(e), { nome: 'Pátio', capacidade: 5 })).rejects.toThrow(ErroPermissao);
    await expect(salvarEspaco(p, admin, { nome: 'salão 1', capacidade: 5 })).rejects.toThrow(/já existe/i);
    await expect(salvarEspaco(p, admin, { nome: 'Pátio', capacidade: 0 })).rejects.toThrow(/capacidade/i);
    await expect(listarEspacos(p, await como('espacos@exemplo.local'))).rejects.toThrow(ErroPermissao);
    const r = await pedir('dp@exemplo.local');
    const [espacos] = await lerTabelas(p, [Espacos] as const);
    await mudarSituacaoEspaco(p, admin, salao, espacos.porId(salao)!.versao, false);
    const lista = await listarEspacos(p, admin);
    expect(lista.encerrados.map((e) => e.nome)).toEqual(['Salão 1']);
    // Pedido antigo continua mostrando o espaço.
    const d = await detalharRequisicao(p, await como('dp@exemplo.local'), r.id, { agora: AGORA });
    expect(d.reserva?.espaco).toBe('Salão 1');
  });

  it('período: fim não antes do início, motivo obrigatório; encerrar não apaga; só a Administração', async () => {
    const admin = await como('admin@exemplo.local');
    await expect(adicionarPeriodoDeEspaco(p, admin, salao, { inicio: '2026-11-12', fim: '2026-11-10', motivo: 'Reforma' })).rejects.toThrow(/fim do período/);
    await expect(adicionarPeriodoDeEspaco(p, admin, salao, { inicio: '2026-11-10', fim: '2026-11-12', motivo: ' ' })).rejects.toThrow(/motivo/);
    await expect(adicionarPeriodoDeEspaco(p, await como('espacos@exemplo.local'), salao, { inicio: '2026-11-10', fim: '2026-11-12', motivo: 'Reforma' })).rejects.toThrow(ErroPermissao);
    await adicionarPeriodoDeEspaco(p, admin, salao, { inicio: '2026-11-10', fim: '2026-11-12', motivo: 'Reforma' });
    await adicionarPeriodoDeEspaco(p, admin, salao, { inicio: '2026-12-01', fim: '2026-12-02', motivo: 'Obra' });
    const [per] = await lerTabelas(p, [EspacoIndisponibilidades] as const);
    expect(per.ativos()).toHaveLength(2);
    const um = per.ativos()[0];
    await encerrarPeriodoDeEspaco(p, admin, um.id, um.versao);
    expect((await lerTabela(p, EspacoIndisponibilidades)).todos()).toHaveLength(2);
    expect((await lerTabela(p, EspacoIndisponibilidades)).ativos()).toHaveLength(1);
  });

  it('o tipo de espaço só aceita o setor Espaços; toda gravação audita só colunas', async () => {
    const admin = await como('admin@exemplo.local');
    await expect(
      salvarTipo(p, admin, { nome: 'Outra reserva', categoria: 'servico', formulario: 'espaco', perfilResponsavel: 'almoxarifado', prazoAprovacao: 4, prazoAtendimento: 4 }),
    ).rejects.toThrow(/setor Espaços/);
    const a = await pedir('dp@exemplo.local');
    await decidir('espacos@exemplo.local', a.id, 'aprovar');
    const [aud] = await lerTabelas(p, [RegistrosAuditoria] as const);
    const mexeu = aud.todos().filter((x) => x.entidade === 'Requisicoes' || x.entidade === 'Espacos');
    expect(mexeu.length).toBeGreaterThan(2);
    expect(JSON.stringify(mexeu)).not.toMatch(/Reunião de equipe/);
  });
});
