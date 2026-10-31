/**
 * Requisições (entrega 1: base e Materiais), com dados FICTÍCIOS: caminho
 * completo, quem aprova, quem atende, quem vê, histórico, auditoria e SLA.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  cancelarRequisicao,
  concluirRequisicao,
  contadoresRequisicoes,
  decidirRequisicao,
  detalharRequisicao,
  enviarRequisicao,
  listarRequisicoes,
  analisarItensEmLote,
  cadastrarItensEmLote,
  itensDoTipo,
  listarTipos,
  mudarSituacaoItemCatalogo,
  salvarItemCatalogo,
  receberRequisicao,
  reenviarRequisicao,
  salvarExpediente,
  salvarTipo,
  type CatalogoOrcamento,
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { RequisicaoHistorico, RequisicaoItens, Requisicoes, TABELAS_REQUISICOES, TiposRequisicao } from '../dados/tabelas';
import { conferirCentros, coordenadoresDoServico, proximoNumero, rotaDeAprovacao } from '../dominio/requisicao';
import { horasUteis, prazoDaEtapa, textoHoras } from '../dominio/sla';
import { manifesto } from '../manifesto';

let p: Planilhas;
const catalogo: CatalogoOrcamento = {
  gruposDeGasto: async () => [
    { id: 'g1', nome: 'Material de consumo (exemplo)' },
    { id: 'g2', nome: 'Alimentação (exemplo)' },
  ],
};
let tipoId: string;

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
const ficha = (x: Partial<DadosRequisicao> = {}): DadosRequisicao & { nomeRequisitante: string } => ({
  nomeRequisitante: 'Pessoa (fictícia)',
  tipoId,
  area: 'educacao',
  grupoId: 'g1',
  centros: [{ servico: 'escola', percentual: 100 }],
  itens: [
    { quantidade: 10, unidade: 'resma', descricao: 'Papel sulfite' },
    { quantidade: 2, unidade: 'cx', descricao: 'Giz de cera' },
  ],
  detalhes: { entrega: { modo: 'retirada', horario: '08:10', local: 'Almoxarifado', responsavel: 'Ana' } },
  ...x,
});
const segunda = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 2, h + 3, m)); // 2/11/2026 (segunda), horário de Brasília

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  const t = await inserir(
    p,
    TiposRequisicao,
    {
      nome: 'Material pedagógico',
      categoria: 'material',
      formulario: 'materiais',
      perfil_responsavel: 'almoxarifado',
      prazo_aprovacao: 8,
      prazo_atendimento: 16,
      descricao: null,
    },
    { email: 'teste' },
  );
  tipoId = t.id;
});

describe('regras puras', () => {
  it('centros de custo somam exatamente 100%, sem repetir serviço', () => {
    expect(
      conferirCentros([
        { servico: 'escola', percentual: 60 },
        { servico: 'transporte', percentual: 40 },
      ]),
    ).toEqual([]);
    expect(
      conferirCentros([
        { servico: 'escola', percentual: 60 },
        { servico: 'transporte', percentual: 30 },
      ]).join(' '),
    ).toMatch(/somam 90%/);
    expect(
      conferirCentros([
        { servico: 'escola', percentual: 50 },
        { servico: 'escola', percentual: 50 },
      ]).join(' '),
    ).toMatch(/mais de uma vez/);
    expect(conferirCentros([])).toEqual(['Informe pelo menos um centro de custo.']);
  });

  it('quem aprova: a coordenação comum; a Diretoria se quem pede é a coordenação ou se não há coordenação; coordenações diferentes, não', () => {
    const atr = [
      { email: 'ana@x', perfil: 'coord', escopoTipo: 'area' as const, escopo: 'educacao' },
      { email: 'bia@x', perfil: 'coord', escopoTipo: 'servico' as const, escopo: 'ur' },
      { email: 'dir@x', perfil: 'coord', escopoTipo: 'global' as const, escopo: null },
    ];
    const de = (codigo: string, area: string) => coordenadoresDoServico({ codigo, area, unidade: 'sede' }, atr, new Set(['coord']));
    expect([...de('escola', 'educacao')]).toEqual(['ana@x']); // global não é coordenação
    expect(rotaDeAprovacao('eu@x', [de('escola', 'educacao'), de('transporte', 'educacao')])).toEqual({ tipo: 'coordenacao', coordenadores: ['ana@x'] });
    expect(rotaDeAprovacao('ana@x', [de('escola', 'educacao')])).toEqual({ tipo: 'diretoria', motivo: 'propria_coordenacao' });
    expect(rotaDeAprovacao('eu@x', [de('cer', 'saude')])).toEqual({ tipo: 'diretoria', motivo: 'sem_coordenacao' });
    expect(() => rotaDeAprovacao('eu@x', [de('escola', 'educacao'), de('ur', 'assistencia_social')])).toThrow(/coordenações diferentes/);
    expect(() => rotaDeAprovacao('eu@x', [de('escola', 'educacao'), de('cer', 'saude')])).toThrow(/coordenações diferentes/);
  });

  it('numeração sequencial no ano', () => {
    expect(proximoNumero(2026, [])).toBe('REQ-2026-0001');
    expect(proximoNumero(2026, ['REQ-2026-0009', 'REQ-2025-0050', 'REQ-2026-0002'])).toBe('REQ-2026-0010');
  });

  it('horas úteis: só segunda a sexta, dentro do expediente, no horário de Brasília', () => {
    const iso = (d: string, h: number, m = 0) => new Date(`${d}T${String(h + 3).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`).toISOString();
    expect(horasUteis(iso('2026-11-02', 9), iso('2026-11-02', 11, 30))).toBe(2.5);
    expect(horasUteis(iso('2026-11-02', 6), iso('2026-11-02', 20))).toBe(9); // fora do expediente não conta
    expect(horasUteis(iso('2026-10-30', 16), iso('2026-11-02', 9))).toBe(2); // sexta 16h → segunda 9h: 1 h + 1 h
    expect(horasUteis(iso('2026-10-31', 9), iso('2026-11-01', 17))).toBe(0); // fim de semana
    expect(horasUteis(iso('2026-11-02', 9), iso('2026-11-02', 15), { inicio: 7, fim: 13 })).toBe(4);
    expect(prazoDaEtapa(iso('2026-11-02', 8), null, 8, iso('2026-11-03', 9)).situacao).toBe('atrasada');
    expect(textoHoras(2.5)).toBe('2 h e 30 min');
    expect(textoHoras(20)).toBe('2 dias úteis e 2 h');
  });
});

describe('caminho de uma requisição de materiais', () => {
  it('envia → coordenação aprova → Almoxarifado recebe e conclui; histórico, auditoria só com colunas e prazos', async () => {
    const pede = await como('financeiro@exemplo.local');
    const r = await enviarRequisicao(p, pede, catalogo, ficha(), { agora: segunda(9) });
    expect(r.numero).toBe('REQ-2026-0001');
    expect(r.rota).toEqual({ tipo: 'coordenacao', coordenadores: ['coord.educacao@exemplo.local'] });
    expect((await contadoresRequisicoes(p, await como('coord.educacao@exemplo.local'))).aprovar).toBe(1);

    // Ninguém de fora decide; o Almoxarifado ainda não vê.
    await expect(decidirRequisicao(p, await como('coord.ur@exemplo.local'), r.id, await versao(r.id), 'aprovar', null)).rejects.toBeInstanceOf(ErroPermissao);
    expect(await listarRequisicoes(p, await como('almoxarifado@exemplo.local'), 'atender')).toHaveLength(0);
    await expect(detalharRequisicao(p, await como('almoxarifado@exemplo.local'), r.id)).rejects.toBeInstanceOf(ErroPermissao);

    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'aprovar', null, { agora: segunda(11) });
    const almox = await como('almoxarifado@exemplo.local');
    expect((await contadoresRequisicoes(p, almox)).atender).toBe(1);
    await receberRequisicao(p, almox, r.id, await versao(r.id), { agora: segunda(13) });
    const itens = (await lerTabela(p, RequisicaoItens)).ativos().filter((i) => i.requisicao_id === r.id);
    const tudo = Object.fromEntries(itens.map((i) => [i.id, i.quantidade]));
    expect(await concluirRequisicao(p, almox, r.id, await versao(r.id), tudo, null, { agora: segunda(16) })).toBe('atendida');

    const d = await detalharRequisicao(p, pede, r.id, { agora: segunda(17) });
    expect(d.requisicao.situacao).toBe('atendida');
    expect(d.historico.map((h) => [h.acao, h.para])).toEqual([
      ['enviar', 'enviada'],
      ['aprovar', 'aprovada'],
      ['receber', 'em_atendimento'],
      ['concluir', 'atendida'],
    ]);
    expect(d.sla?.aprovacao).toMatchObject({ horas: 2, situacao: 'no_prazo' });
    expect(d.sla?.atendimento).toMatchObject({ horas: 5, situacao: 'no_prazo' });
    expect(d.itens.map((i) => i.atendido)).toEqual([10, 2]);

    const auditoria = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Requisicoes'));
    expect(auditoria).not.toContain('Papel sulfite');
    expect(auditoria).toContain('situacao');
  });

  it('devolver pede o motivo; quem pediu ajusta e reenvia; os centros e itens antigos ficam no histórico', async () => {
    const pede = await como('financeiro@exemplo.local');
    const coord = await como('coord.educacao@exemplo.local');
    const r = await enviarRequisicao(p, pede, catalogo, ficha(), { agora: segunda(9) });
    await expect(decidirRequisicao(p, coord, r.id, await versao(r.id), 'devolver', ' ')).rejects.toThrow(/ajustado/);
    await decidirRequisicao(p, coord, r.id, await versao(r.id), 'devolver', 'Divida com o Transporte.', { agora: segunda(10) });
    expect((await contadoresRequisicoes(p, pede)).devolvidas).toBe(1);
    await expect(reenviarRequisicao(p, coord, catalogo, r.id, await versao(r.id), ficha())).rejects.toBeInstanceOf(ErroPermissao);
    await reenviarRequisicao(
      p,
      pede,
      catalogo,
      r.id,
      await versao(r.id),
      ficha({
        centros: [
          { servico: 'escola', percentual: 70 },
          { servico: 'transporte', percentual: 30 },
        ],
        itens: [{ quantidade: 5, unidade: 'resma', descricao: 'Papel sulfite' }],
      }),
      { agora: segunda(14) },
    );
    const d = await detalharRequisicao(p, pede, r.id, { agora: segunda(15) });
    expect([d.requisicao.situacao, d.centros.map((c) => c.percentual), d.itens.length]).toEqual(['enviada', [70, 30], 1]);
    expect(d.sla?.aprovacao.horas).toBe(1); // o relógio recomeça no reenvio
    expect((await lerTabela(p, RequisicaoItens)).todos().filter((i) => i.requisicao_id === r.id)).toHaveLength(3);
  });

  it('pedido da própria coordenação e de serviço sem coordenação vão para a Diretoria; coordenações diferentes são recusadas na hora', async () => {
    const coord = await como('coord.educacao@exemplo.local');
    const propria = await enviarRequisicao(p, coord, catalogo, ficha(), { agora: segunda(9) });
    expect(propria.rota).toEqual({ tipo: 'diretoria', motivo: 'propria_coordenacao' });
    await expect(decidirRequisicao(p, coord, propria.id, await versao(propria.id), 'aprovar', null)).rejects.toThrow(/própria requisição/);
    await decidirRequisicao(p, await como('diretoria@exemplo.local'), propria.id, await versao(propria.id), 'aprovar', null);

    const semCoord = await enviarRequisicao(
      p,
      await como('tecnico.cer@exemplo.local'),
      catalogo,
      ficha({ area: 'saude', centros: [{ servico: 'cer_reabilitacao', percentual: 100 }] }),
    );
    expect(semCoord.rota).toEqual({ tipo: 'diretoria', motivo: 'sem_coordenacao' });

    await expect(
      enviarRequisicao(
        p,
        await como('financeiro@exemplo.local'),
        catalogo,
        ficha({
          centros: [
            { servico: 'escola', percentual: 50 },
            { servico: 'ur', percentual: 50 },
          ],
        }),
      ),
    ).rejects.toThrow(/coordenações diferentes/);
  });

  it('recusar e cancelar encerram; atendimento parcial exige explicação; ficha incompleta é recusada', async () => {
    const pede = await como('financeiro@exemplo.local');
    await expect(enviarRequisicao(p, pede, catalogo, ficha({ grupoId: 'x', itens: [] }))).rejects.toThrow(/grupo de despesa.*pelo menos um item/);
    await expect(enviarRequisicao(p, pede, catalogo, ficha({ detalhes: { evento: { nome: 'Festa', data: '' } } }))).rejects.toThrow(/data do evento/);

    const a = await enviarRequisicao(p, pede, catalogo, ficha());
    await cancelarRequisicao(p, pede, a.id, await versao(a.id), 'Não precisa mais.');
    await expect(decidirRequisicao(p, await como('coord.educacao@exemplo.local'), a.id, await versao(a.id), 'aprovar', null)).rejects.toThrow(/cancelada/);

    const b = await enviarRequisicao(p, pede, catalogo, ficha());
    await expect(cancelarRequisicao(p, await como('coord.educacao@exemplo.local'), b.id, await versao(b.id), null)).rejects.toBeInstanceOf(ErroPermissao);
    await decidirRequisicao(p, await como('diretoria@exemplo.local'), b.id, await versao(b.id), 'aprovar', null);
    const almox = await como('almoxarifado@exemplo.local');
    await expect(concluirRequisicao(p, almox, b.id, await versao(b.id), {}, null)).rejects.toThrow(/concluir uma requisição que está "aprovada/);
    await receberRequisicao(p, almox, b.id, await versao(b.id));
    const itens = (await lerTabela(p, RequisicaoItens)).ativos().filter((i) => i.requisicao_id === b.id);
    const parcial = Object.fromEntries(itens.map((i, k) => [i.id, k === 0 ? 4 : i.quantidade]));
    await expect(concluirRequisicao(p, almox, b.id, await versao(b.id), parcial, null)).rejects.toThrow(/em parte/);
    await expect(concluirRequisicao(p, almox, b.id, await versao(b.id), { ...parcial, [itens[0].id]: 99 }, 'x')).rejects.toThrow(/de 0 a 10/);
    expect(await concluirRequisicao(p, almox, b.id, await versao(b.id), parcial, 'Faltou papel.')).toBe('atendida_parcial');
    expect(
      (await lerTabela(p, RequisicaoHistorico))
        .todos()
        .filter((h) => h.requisicao_id === b.id)
        .at(-1)?.comentario,
    ).toBe('Faltou papel.');
  });

  it('quem vê o quê: cada um as suas; coordenação as do escopo; Diretoria todas; setor só depois de aprovadas', async () => {
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), catalogo, ficha());
    await enviarRequisicao(p, await como('dp@exemplo.local'), catalogo, ficha({ area: 'assistencia_social', centros: [{ servico: 'ur', percentual: 100 }] }));
    expect((await listarRequisicoes(p, await como('financeiro@exemplo.local'), 'minhas')).map((x) => x.numero)).toEqual(['REQ-2026-0001']);
    expect((await listarRequisicoes(p, await como('coord.educacao@exemplo.local'), 'aprovar')).map((x) => x.id)).toEqual([r.id]);
    expect(await listarRequisicoes(p, await como('diretoria@exemplo.local'), 'todas')).toHaveLength(2);
    await expect(listarRequisicoes(p, await como('financeiro@exemplo.local'), 'todas')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(detalharRequisicao(p, await como('dp@exemplo.local'), r.id)).rejects.toBeInstanceOf(ErroPermissao);
    const linha = (await listarRequisicoes(p, await como('financeiro@exemplo.local'), 'minhas'))[0];
    expect(linha.prazo?.etapa).toBe('aprovação');
  });
});

describe('tipos de requisição e expediente', () => {
  it('só quem gerencia cadastra; o setor precisa ser um perfil que atende; nome único; expediente válido', async () => {
    const adm = await como('admin@exemplo.local');
    const t = await listarTipos(p, adm, catalogo);
    expect(t.perfis.map((x) => x.codigo)).toEqual(['almoxarifado']);
    await salvarTipo(p, adm, catalogo, {
      nome: 'Higiene e limpeza',
      categoria: 'material',
      formulario: 'materiais',
      perfilResponsavel: 'almoxarifado',
      prazoAprovacao: 8,
      prazoAtendimento: 24,
    });
    await expect(
      salvarTipo(p, adm, catalogo, {
        nome: 'higiene e limpeza',
        categoria: 'material',
        formulario: 'materiais',
        perfilResponsavel: 'almoxarifado',
        prazoAprovacao: 8,
        prazoAtendimento: 24,
      }),
    ).rejects.toThrow(/Já existe/);
    await expect(
      salvarTipo(p, adm, catalogo, {
        nome: 'Outro',
        categoria: 'material',
        formulario: 'materiais',
        perfilResponsavel: 'financeiro',
        prazoAprovacao: 0,
        prazoAtendimento: 24,
      }),
    ).rejects.toThrow(/setor.*prazo de aprovação/);
    await expect(listarTipos(p, await como('financeiro@exemplo.local'), catalogo)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarExpediente(p, adm, { inicio: 18, fim: 8 })).rejects.toThrow(/depois do início/);
    await salvarExpediente(p, adm, { inicio: 7, fim: 16 });
    expect((await listarTipos(p, adm, catalogo)).expediente).toEqual({ inicio: 7, fim: 16 });
  });
});

describe('tipos: áreas, grupos e itens aceitos', () => {
  const lerTipo = async () => (await lerTabela(p, TiposRequisicao)).porId(tipoId)!;

  it('só a Administração da plataforma cria e altera tipos e listas (a Diretoria não)', async () => {
    const dir = await como('diretoria@exemplo.local');
    await expect(listarTipos(p, dir, catalogo)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarItemCatalogo(p, dir, tipoId, { descricao: 'X', unidade: 'un' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(analisarItensEmLote(p, dir, tipoId, 'X;un')).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('o tipo só aceita as áreas e os grupos marcados; sem marcação, aceita todos', async () => {
    const adm = await como('admin@exemplo.local');
    const t = await lerTipo();
    const base = {
      nome: t.nome,
      categoria: 'material' as const,
      formulario: 'materiais' as const,
      perfilResponsavel: 'almoxarifado',
      prazoAprovacao: 8,
      prazoAtendimento: 16,
    };
    await expect(salvarTipo(p, adm, catalogo, { ...base, areas: ['nao_existe'] }, { id: t.id, versao: t.versao })).rejects.toThrow(/área marcada/);
    await salvarTipo(p, adm, catalogo, { ...base, areas: ['educacao'], grupos: ['g2'] }, { id: t.id, versao: t.versao });
    expect((await listarTipos(p, adm, catalogo)).ativos[0]).toMatchObject({ nomesAreas: ['Educação'], nomesGrupos: ['Alimentação (exemplo)'] });

    const pede = await como('financeiro@exemplo.local');
    await expect(enviarRequisicao(p, pede, catalogo, ficha({ grupoId: 'g1' }))).rejects.toThrow(/não aceita o grupo de despesa Material de consumo/);
    await expect(enviarRequisicao(p, pede, catalogo, ficha({ grupoId: 'g2', area: 'saude' }))).rejects.toThrow(/não pode ser usado pela área Saúde/);
    expect((await enviarRequisicao(p, pede, catalogo, ficha({ grupoId: 'g2' }))).numero).toBe('REQ-2026-0001');

    const t2 = await lerTipo();
    await salvarTipo(p, adm, catalogo, { ...base, areas: [], grupos: [] }, { id: t2.id, versao: t2.versao });
    expect((await lerTipo()).areas).toBeNull();
    expect(
      (await enviarRequisicao(p, pede, catalogo, ficha({ grupoId: 'g1', area: 'saude', centros: [{ servico: 'cer_reabilitacao', percentual: 100 }] }))).numero,
    ).toBe('REQ-2026-0002');
  });

  it('com lista de itens, só entram itens da lista, com a unidade da lista; sem lista, texto livre', async () => {
    const adm = await como('admin@exemplo.local');
    const pede = await como('financeiro@exemplo.local');
    // Sem lista: aceita o que foi digitado.
    expect((await enviarRequisicao(p, pede, catalogo, ficha())).numero).toBe('REQ-2026-0001');

    await salvarItemCatalogo(p, adm, tipoId, { descricao: 'Papel sulfite A4', unidade: 'resma' });
    await expect(salvarItemCatalogo(p, adm, tipoId, { descricao: 'papel sulfite a4', unidade: 'un' })).rejects.toThrow(/já está na lista/);
    const lote = await analisarItensEmLote(p, adm, tipoId, 'Item\tUnidade\nGiz de cera\tcaixa\nPapel Sulfite A4;resma\nCola branca\nGiz de cera;cx');
    expect(lote.map((l) => [l.descricao, l.situacao])).toEqual([
      ['Giz de cera', 'ok'],
      ['Papel Sulfite A4', 'ja_existe'],
      ['Cola branca', 'erro'],
      ['Giz de cera', 'ja_existe'],
    ]);
    expect(await cadastrarItensEmLote(p, adm, tipoId, lote)).toBe(1);

    await expect(enviarRequisicao(p, pede, catalogo, ficha({ itens: [{ quantidade: 1, unidade: 'un', descricao: 'Tinta guache' }] }))).rejects.toThrow(
      /"Tinta guache" não está na lista deste tipo/,
    );
    const r = await enviarRequisicao(p, pede, catalogo, ficha({ itens: [{ quantidade: 2, unidade: 'qualquer', descricao: 'giz DE cera' }] }));
    const item = (await lerTabela(p, RequisicaoItens)).ativos().find((i) => i.requisicao_id === r.id)!;
    expect([item.descricao, item.unidade, Boolean(item.catalogo_id)]).toEqual(['Giz de cera', 'caixa', true]);

    // Tirar da lista não apaga e não muda requisições já feitas; contagem de pedidos por item.
    const c = await itensDoTipo(p, adm, tipoId);
    const giz = c.ativos.find((x) => x.descricao === 'Giz de cera')!;
    expect(giz.pedidos).toBe(1);
    await mudarSituacaoItemCatalogo(p, adm, giz.id, giz.versao, false);
    expect((await itensDoTipo(p, adm, tipoId)).excluidos.map((x) => x.descricao)).toEqual(['Giz de cera']);
  });
});
