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
  incluirFeriadosNacionais,
  iniciarEnvioAnexo,
  lerAnexo,
  painelDePrazos,
  salvarFeriado,
  tirarFeriado,
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
  type DadosRequisicao,
} from '../aplicacao/requisicoes';
import { RequisicaoHistorico, RequisicaoItens, Requisicoes, TABELAS_REQUISICOES, TiposRequisicao } from '../dados/tabelas';
import { conferirCentros, coordenadoresDoServico, proximoNumero, rotaDeAprovacao } from '../dominio/requisicao';
import { aceitaAnexos, conferirArquivo, conferirQuantidade, tipoDoArquivo } from '../dominio/anexos';
import { conferirFeriado, feriadosNacionais } from '../dominio/feriados';
import { mesesEntre } from '../dominio/painel';
import { horasUteis, prazoDaEtapa, textoHoras } from '../dominio/sla';
import { FeriadosRequisicoes, RequisicaoAnexos } from '../dados/tabelas';
import { ArquivosMemoria } from '@/nucleo/armazenamento/arquivos';
import { manifesto } from '../manifesto';

let p: Planilhas;
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
    const r = await enviarRequisicao(p, pede, ficha(), { agora: segunda(9) });
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
    const r = await enviarRequisicao(p, pede, ficha(), { agora: segunda(9) });
    await expect(decidirRequisicao(p, coord, r.id, await versao(r.id), 'devolver', ' ')).rejects.toThrow(/ajustado/);
    await decidirRequisicao(p, coord, r.id, await versao(r.id), 'devolver', 'Divida com o Transporte.', { agora: segunda(10) });
    expect((await contadoresRequisicoes(p, pede)).devolvidas).toBe(1);
    await expect(reenviarRequisicao(p, coord, r.id, await versao(r.id), ficha())).rejects.toBeInstanceOf(ErroPermissao);
    await reenviarRequisicao(
      p,
      pede,
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
    const propria = await enviarRequisicao(p, coord, ficha(), { agora: segunda(9) });
    expect(propria.rota).toEqual({ tipo: 'diretoria', motivo: 'propria_coordenacao' });
    await expect(decidirRequisicao(p, coord, propria.id, await versao(propria.id), 'aprovar', null)).rejects.toThrow(/própria requisição/);
    await decidirRequisicao(p, await como('diretoria@exemplo.local'), propria.id, await versao(propria.id), 'aprovar', null);

    const semCoord = await enviarRequisicao(
      p,
      await como('tecnico.cer@exemplo.local'),
      ficha({ area: 'saude', centros: [{ servico: 'cer_reabilitacao', percentual: 100 }] }),
    );
    expect(semCoord.rota).toEqual({ tipo: 'diretoria', motivo: 'sem_coordenacao' });

    await expect(
      enviarRequisicao(
        p,
        await como('financeiro@exemplo.local'),
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
    await expect(enviarRequisicao(p, pede, ficha({ itens: [] }))).rejects.toThrow(/pelo menos um item/);
    await expect(enviarRequisicao(p, pede, ficha({ detalhes: { evento: { nome: 'Festa', data: '' } } }))).rejects.toThrow(/data do evento/);

    const a = await enviarRequisicao(p, pede, ficha());
    await cancelarRequisicao(p, pede, a.id, await versao(a.id), 'Não precisa mais.');
    await expect(decidirRequisicao(p, await como('coord.educacao@exemplo.local'), a.id, await versao(a.id), 'aprovar', null)).rejects.toThrow(/cancelada/);

    const b = await enviarRequisicao(p, pede, ficha());
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
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha());
    await enviarRequisicao(p, await como('dp@exemplo.local'), ficha({ area: 'assistencia_social', centros: [{ servico: 'ur', percentual: 100 }] }));
    expect((await listarRequisicoes(p, await como('financeiro@exemplo.local'), 'minhas')).map((x) => x.numero)).toEqual(['REQ-2026-0001']);
    expect((await listarRequisicoes(p, await como('coord.educacao@exemplo.local'), 'aprovar')).map((x) => x.id)).toEqual([r.id]);
    expect(await listarRequisicoes(p, await como('diretoria@exemplo.local'), 'todas')).toHaveLength(2);
    await expect(listarRequisicoes(p, await como('financeiro@exemplo.local'), 'todas')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(detalharRequisicao(p, await como('dp@exemplo.local'), r.id)).rejects.toBeInstanceOf(ErroPermissao);
    const linha = (await listarRequisicoes(p, await como('financeiro@exemplo.local'), 'minhas'))[0];
    expect(linha.prazo?.etapa).toBe('aprovação');
  });
});

describe('perfil Funcionário', () => {
  it('pede e acompanha as próprias requisições, e nada mais', async () => {
    expect(manifesto.permissoesPorPerfil.funcionario).toEqual(['requisicoes.acessar', 'requisicoes.solicitar']);
    const f = await como('funcionario@exemplo.local');
    const r = await enviarRequisicao(p, f, ficha());
    expect((await listarRequisicoes(p, f, 'minhas')).map((x) => x.id)).toEqual([r.id]);
    await expect(listarRequisicoes(p, f, 'todas')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(painelDePrazos(p, f)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('tipos de requisição e expediente', () => {
  it('só quem gerencia cadastra; o setor precisa ser um perfil que atende; nome único; expediente válido', async () => {
    const adm = await como('admin@exemplo.local');
    const t = await listarTipos(p, adm);
    expect(t.perfis.map((x) => x.codigo).sort()).toEqual(['almoxarifado', 'informatica', 'manutencao', 'patrimonio']);
    await salvarTipo(p, adm, {
      nome: 'Higiene e limpeza',
      categoria: 'material',
      formulario: 'materiais',
      perfilResponsavel: 'almoxarifado',
      prazoAprovacao: 8,
      prazoAtendimento: 24,
    });
    await expect(
      salvarTipo(p, adm, {
        nome: 'higiene e limpeza',
        categoria: 'material',
        formulario: 'materiais',
        perfilResponsavel: 'almoxarifado',
        prazoAprovacao: 8,
        prazoAtendimento: 24,
      }),
    ).rejects.toThrow(/Já existe/);
    await expect(
      salvarTipo(p, adm, {
        nome: 'Outro',
        categoria: 'material',
        formulario: 'materiais',
        perfilResponsavel: 'financeiro',
        prazoAprovacao: 0,
        prazoAtendimento: 24,
      }),
    ).rejects.toThrow(/setor.*prazo de aprovação/);
    await expect(listarTipos(p, await como('financeiro@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarExpediente(p, adm, { inicio: 18, fim: 8 })).rejects.toThrow(/depois do início/);
    await salvarExpediente(p, adm, { inicio: 7, fim: 16 });
    expect((await listarTipos(p, adm)).expediente).toMatchObject({ inicio: 7, fim: 16 });
  });
});

describe('tipos: áreas e itens aceitos', () => {
  const lerTipo = async () => (await lerTabela(p, TiposRequisicao)).porId(tipoId)!;

  it('só a Administração da plataforma cria e altera tipos e listas (a Diretoria não)', async () => {
    const dir = await como('diretoria@exemplo.local');
    await expect(listarTipos(p, dir)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarItemCatalogo(p, dir, tipoId, { descricao: 'X', unidade: 'un' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(analisarItensEmLote(p, dir, tipoId, 'X;un')).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('o tipo só aceita as áreas marcadas; sem marcação, aceita todas; a ficha não tem mais grupo de despesa', async () => {
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
    await expect(salvarTipo(p, adm, { ...base, areas: ['nao_existe'] }, { id: t.id, versao: t.versao })).rejects.toThrow(/área marcada/);
    await salvarTipo(p, adm, { ...base, areas: ['educacao'] }, { id: t.id, versao: t.versao });
    expect((await listarTipos(p, adm)).ativos[0]).toMatchObject({ nomesAreas: ['Educação'] });

    const pede = await como('financeiro@exemplo.local');
    await expect(enviarRequisicao(p, pede, ficha({ area: 'saude' }))).rejects.toThrow(/não pode ser usado pela área Saúde/);
    const r1 = await enviarRequisicao(p, pede, ficha());
    expect(r1.numero).toBe('REQ-2026-0001');
    // Grupo de despesa saiu da ficha: a requisição é gravada sem ele.
    expect((await lerTabela(p, Requisicoes)).porId(r1.id)).toMatchObject({ grupo_id: null, grupo_nome: null });

    const t2 = await lerTipo();
    await salvarTipo(p, adm, { ...base, areas: [] }, { id: t2.id, versao: t2.versao });
    expect((await lerTipo()).areas).toBeNull();
    expect((await enviarRequisicao(p, pede, ficha({ area: 'saude', centros: [{ servico: 'cer_reabilitacao', percentual: 100 }] }))).numero).toBe(
      'REQ-2026-0002',
    );
  });

  it('com lista de itens, só entram itens da lista, com a unidade da lista; sem lista, texto livre', async () => {
    const adm = await como('admin@exemplo.local');
    const pede = await como('financeiro@exemplo.local');
    // Sem lista: aceita o que foi digitado.
    expect((await enviarRequisicao(p, pede, ficha())).numero).toBe('REQ-2026-0001');

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

    await expect(enviarRequisicao(p, pede, ficha({ itens: [{ quantidade: 1, unidade: 'un', descricao: 'Tinta guache' }] }))).rejects.toThrow(
      /"Tinta guache" não está na lista deste tipo/,
    );
    const r = await enviarRequisicao(p, pede, ficha({ itens: [{ quantidade: 2, unidade: 'qualquer', descricao: 'giz DE cera' }] }));
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

describe('chamado de TI (Setor de Informática)', () => {
  const chamado = (x: object = {}) => ({
    categoria: 'impressora',
    equipamento: 'Impressora da recepção',
    patrimonio: 'PAT-0457',
    local: 'Recepção',
    problema: 'A impressora puxa duas folhas e o papel enrosca.',
    urgencia: 'alta',
    contato: 'Ramal 214',
    ...x,
  });
  async function tipoTi() {
    const t = await inserir(
      p,
      TiposRequisicao,
      {
        nome: 'Chamado de TI',
        categoria: 'servico',
        formulario: 'ti',
        perfil_responsavel: 'informatica',
        prazo_aprovacao: 4,
        prazo_atendimento: 8,
        descricao: null,
      },
      { email: 'teste' },
    );
    return t.id;
  }

  it('o chamado não tem itens; problema, local e urgência são obrigatórios', async () => {
    const id = await tipoTi();
    const pede = await como('financeiro@exemplo.local');
    await expect(
      enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes: chamado({ problema: 'quebrou', local: '', urgencia: undefined }) })),
    ).rejects.toThrow(/onde está o problema.*mais de detalhe.*urgência/);
    const r = await enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes: chamado() }));
    const d = await detalharRequisicao(p, pede, r.id);
    expect(d.itens).toHaveLength(0);
    expect(d.detalhes).toMatchObject({ categoria: 'impressora', urgencia: 'alta', patrimonio: 'PAT-0457' });
    expect((await listarRequisicoes(p, pede, 'minhas'))[0].urgencia).toBe('alta');
  });

  it('só o Setor de Informática atende; concluir pede o resultado e o que foi feito', async () => {
    const id = await tipoTi();
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha({ tipoId: id, itens: [], detalhes: chamado() }));
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'aprovar', null);
    expect(await listarRequisicoes(p, await como('almoxarifado@exemplo.local'), 'atender')).toHaveLength(0);
    await expect(receberRequisicao(p, await como('almoxarifado@exemplo.local'), r.id, await versao(r.id))).rejects.toBeInstanceOf(ErroPermissao);
    const ti = await como('informatica@exemplo.local');
    expect((await contadoresRequisicoes(p, ti)).atender).toBe(1);
    await receberRequisicao(p, ti, r.id, await versao(r.id));
    await expect(concluirRequisicao(p, ti, r.id, await versao(r.id), {}, 'Troquei o rolete.')).rejects.toThrow(/foi resolvido/);
    await expect(concluirRequisicao(p, ti, r.id, await versao(r.id), {}, ' ', { resultado: 'parcial' })).rejects.toThrow(/ficou pendente/);
    expect(await concluirRequisicao(p, ti, r.id, await versao(r.id), {}, 'Troquei o rolete de tração.', { resultado: 'resolvido' })).toBe('atendida');
    const h = (await lerTabela(p, RequisicaoHistorico)).todos().filter((x) => x.requisicao_id === r.id);
    expect(h.at(-1)).toMatchObject({ acao: 'concluir', para: 'atendida', comentario: 'Troquei o rolete de tração.' });
  });

  it('o tipo de TI é sempre serviço, mesmo que a tela mande material', async () => {
    const adm = await como('admin@exemplo.local');
    await salvarTipo(p, adm, {
      nome: 'Chamado de TI',
      categoria: 'material',
      formulario: 'ti',
      perfilResponsavel: 'informatica',
      prazoAprovacao: 4,
      prazoAtendimento: 8,
    });
    const t = (await lerTabela(p, TiposRequisicao)).ativos().find((x) => x.nome === 'Chamado de TI')!;
    expect([t.formulario, t.categoria]).toEqual(['ti', 'servico']);
    expect((await listarTipos(p, adm)).perfis.map((x) => x.codigo).sort()).toEqual(['almoxarifado', 'informatica', 'manutencao', 'patrimonio']);
  });
});

describe('mobiliário (Setor de Patrimônio)', () => {
  const pedido = (x: object = {}) => ({
    servico: 'emprestimo',
    moveis: [{ quantidade: 40, descricao: 'Cadeira plástica', patrimonio: null }],
    origem: 'Depósito',
    destino: 'Quadra',
    data: '2026-11-07',
    horario: '08:00',
    devolucao: '2026-11-09',
    contato: null,
    ...x,
  });
  async function tipoMobiliario() {
    const t = await inserir(
      p,
      TiposRequisicao,
      {
        nome: 'Mobiliário',
        categoria: 'servico',
        formulario: 'mobiliario',
        perfil_responsavel: 'patrimonio',
        prazo_aprovacao: 8,
        prazo_atendimento: 24,
        descricao: null,
      },
      { email: 'teste' },
    );
    return t.id;
  }

  it('lista de móveis, de onde e para quando são obrigatórios; empréstimo exige destino e devolução', async () => {
    const id = await tipoMobiliario();
    const pede = await como('financeiro@exemplo.local');
    const enviar = (d: object) => enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes: d }));
    await expect(enviar(pedido({ moveis: [], origem: '' }))).rejects.toThrow(/pelo menos um móvel.*de onde/);
    await expect(enviar(pedido({ destino: null, devolucao: null }))).rejects.toThrow(/para onde.*quando os móveis voltam/);
    await expect(enviar(pedido({ devolucao: '2026-11-01' }))).rejects.toThrow(/não pode ser antes/);
    await expect(enviar(pedido({ moveis: [{ quantidade: 1.5, descricao: 'Mesa', patrimonio: null }] }))).rejects.toThrow(/número inteiro/);
    // Recolher: sem destino nem devolução.
    const r = await enviar(pedido({ servico: 'recolhimento', destino: null, devolucao: null }));
    expect((await detalharRequisicao(p, pede, r.id)).detalhes).toMatchObject({ servico: 'recolhimento', moveis: [{ quantidade: 40 }] });
  });

  it('só o Setor de Patrimônio atende, e conclui dizendo o que foi feito', async () => {
    const id = await tipoMobiliario();
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha({ tipoId: id, itens: [], detalhes: pedido() }));
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'aprovar', null);
    await expect(receberRequisicao(p, await como('informatica@exemplo.local'), r.id, await versao(r.id))).rejects.toBeInstanceOf(ErroPermissao);
    const pat = await como('patrimonio@exemplo.local');
    expect((await contadoresRequisicoes(p, pat)).atender).toBe(1);
    await receberRequisicao(p, pat, r.id, await versao(r.id));
    await expect(concluirRequisicao(p, pat, r.id, await versao(r.id), {}, null, { resultado: 'parcial' })).rejects.toThrow(/pendente/);
    expect(await concluirRequisicao(p, pat, r.id, await versao(r.id), {}, 'Levadas 30 cadeiras; 10 estavam quebradas.', { resultado: 'parcial' })).toBe(
      'atendida_parcial',
    );
  });
});

describe('manutenção (Setor de Manutenção)', () => {
  const pedido = (x: object = {}) => ({
    servico: 'ar_condicionado',
    local: 'Sala 2 da Escola',
    problema: 'Liga, mas não gela e faz barulho alto.',
    urgencia: 'alta',
    equipamento: 'Ar-condicionado split',
    patrimonio: 'PAT-0390',
    horario: 'Depois das 16h',
    contato: '',
    ...x,
  });
  async function tipoManutencao() {
    const t = await inserir(
      p,
      TiposRequisicao,
      {
        nome: 'Manutenção',
        categoria: 'servico',
        formulario: 'manutencao',
        perfil_responsavel: 'manutencao',
        prazo_aprovacao: 8,
        prazo_atendimento: 40,
        descricao: null,
      },
      { email: 'teste' },
    );
    return t.id;
  }

  it('tipo de serviço, local, problema detalhado e urgência são obrigatórios; sem itens', async () => {
    const id = await tipoManutencao();
    const pede = await como('financeiro@exemplo.local');
    const enviar = (d: object) => enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes: d }));
    await expect(enviar(pedido({ servico: 'foguete', local: ' ', problema: 'quebrou', urgencia: undefined }))).rejects.toThrow(
      /tipo de serviço.*onde é o serviço.*mais de detalhe.*urgência/,
    );
    const r = await enviar(pedido());
    const d = await detalharRequisicao(p, pede, r.id);
    expect(d.itens).toHaveLength(0);
    expect(d.detalhes).toMatchObject({ servico: 'ar_condicionado', urgencia: 'alta', patrimonio: 'PAT-0390', contato: null });
    expect((await listarRequisicoes(p, pede, 'minhas'))[0].urgencia).toBe('alta');
  });

  it('só o Setor de Manutenção atende, e conclui com o resultado e o que foi feito', async () => {
    const id = await tipoManutencao();
    const r = await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha({ tipoId: id, itens: [], detalhes: pedido() }));
    // Antes da aprovação, o setor não vê o pedido.
    expect(await listarRequisicoes(p, await como('manutencao@exemplo.local'), 'atender')).toHaveLength(0);
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'aprovar', null);
    await expect(receberRequisicao(p, await como('patrimonio@exemplo.local'), r.id, await versao(r.id))).rejects.toBeInstanceOf(ErroPermissao);
    const man = await como('manutencao@exemplo.local');
    expect((await contadoresRequisicoes(p, man)).atender).toBe(1);
    await receberRequisicao(p, man, r.id, await versao(r.id));
    await expect(concluirRequisicao(p, man, r.id, await versao(r.id), {}, 'Limpei o filtro.')).rejects.toThrow(/foi resolvido/);
    expect(await concluirRequisicao(p, man, r.id, await versao(r.id), {}, 'Limpei o filtro e completei o gás.', { resultado: 'resolvido' })).toBe('atendida');
    const h = (await lerTabela(p, RequisicaoHistorico)).todos().filter((x) => x.requisicao_id === r.id);
    expect(h.at(-1)).toMatchObject({ acao: 'concluir', para: 'atendida', usuario: 'manutencao@exemplo.local' });
  });
});

describe('feriados e painel de prazos (SLA)', () => {
  const em = (dia: string, h: number) => new Date(`${dia}T${String(h).padStart(2, '0')}:00:00-03:00`);

  it('feriado não conta nas horas úteis; nacionais com a Sexta-feira Santa móvel; data inválida é recusada', () => {
    const e = { inicio: 8, fim: 17, feriados: new Set(['2026-11-02']) };
    // Sexta 30/10 16h → segunda 2/11 (Finados) → terça 3/11 10h: 1 h + 2 h.
    expect(horasUteis(em('2026-10-30', 16).toISOString(), em('2026-11-03', 10).toISOString(), e)).toBe(3);
    expect(horasUteis(em('2026-10-30', 16).toISOString(), em('2026-11-03', 10).toISOString())).toBe(12);
    const f2026 = feriadosNacionais(2026);
    expect(f2026).toHaveLength(11);
    expect(f2026.find((f) => f.nome === 'Sexta-feira Santa')?.data).toBe('2026-04-03');
    expect(feriadosNacionais(2027).find((f) => f.nome === 'Sexta-feira Santa')?.data).toBe('2027-03-26');
    expect(() => conferirFeriado({ data: '2026-02-30', nome: 'X' })).toThrow(/data/);
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('só a Administração da plataforma cadastra feriados; data repetida é recusada; o feriado entra no prazo da ficha', async () => {
    const adm = await como('admin@exemplo.local');
    await expect(salvarFeriado(p, await como('diretoria@exemplo.local'), { data: '2026-11-02', nome: 'Finados' })).rejects.toBeInstanceOf(ErroPermissao);
    const pede = await como('financeiro@exemplo.local');
    const r = await enviarRequisicao(p, pede, ficha(), { agora: em('2026-10-30', 16) });
    const antes = (await detalharRequisicao(p, pede, r.id, { agora: em('2026-11-03', 10) })).sla!.aprovacao.horas;
    expect(await incluirFeriadosNacionais(p, adm, 2026)).toBe(11);
    expect(await incluirFeriadosNacionais(p, adm, 2026)).toBe(0);
    await expect(salvarFeriado(p, adm, { data: '2026-11-02', nome: 'Outro' })).rejects.toThrow(/Já há feriado em 02\/11\/2026: Finados/);
    expect((await detalharRequisicao(p, pede, r.id, { agora: em('2026-11-03', 10) })).sla!.aprovacao.horas).toBe(antes - 9);
    // Tirar o feriado: o dia volta a contar.
    const finados = (await lerTabela(p, FeriadosRequisicoes)).ativos().find((f) => f.data === '2026-11-02')!;
    await tirarFeriado(p, adm, finados.id, finados.versao);
    expect((await detalharRequisicao(p, pede, r.id, { agora: em('2026-11-03', 10) })).sla!.aprovacao.horas).toBe(antes);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'FeriadosRequisicoes');
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'encerramento']);
  });

  it('painel: no prazo por mês da decisão e da conclusão; atrasadas agora; cada um vê só o que acompanha', async () => {
    const pede = await como('financeiro@exemplo.local');
    const coord = await como('coord.educacao@exemplo.local');
    const almox = await como('almoxarifado@exemplo.local');
    const tudo = async (id: string) =>
      Object.fromEntries(
        (await lerTabela(p, RequisicaoItens))
          .ativos()
          .filter((i) => i.requisicao_id === id)
          .map((i) => [i.id, i.quantidade]),
      );
    // A: decidida em 1 h (no prazo de 8 h); concluída em 25 h (fora do prazo de 16 h).
    const a = await enviarRequisicao(p, pede, ficha(), { agora: em('2026-10-05', 9) });
    await decidirRequisicao(p, coord, a.id, await versao(a.id), 'aprovar', null, { agora: em('2026-10-05', 10) });
    await receberRequisicao(p, almox, a.id, await versao(a.id), { agora: em('2026-10-05', 11) });
    await concluirRequisicao(p, almox, a.id, await versao(a.id), await tudo(a.id), null, { agora: em('2026-10-07', 17) });
    // B: decidida em 18 h (fora do prazo) e ainda não atendida.
    const b = await enviarRequisicao(p, pede, ficha(), { agora: em('2026-10-06', 9) });
    await decidirRequisicao(p, coord, b.id, await versao(b.id), 'aprovar', null, { agora: em('2026-10-08', 9) });

    const agora = em('2026-10-30', 12);
    const dir = await painelDePrazos(p, await como('diretoria@exemplo.local'), { de: '2026-10', ate: '2026-10' }, { agora });
    expect(dir.todas).toBe(true);
    expect(dir.total.aprovacao).toMatchObject({ total: 2, noPrazo: 1, pct: 50 });
    expect(dir.total.atendimento).toMatchObject({ total: 1, noPrazo: 0, pct: 0, mediaHoras: 25 });
    expect(dir.atrasadas.map((x) => [x.numero, x.etapa])).toEqual([[b.numero, 'atendimento']]);
    expect(dir.porSetor.map((x) => x.nome)).toEqual(['Almoxarifado']);
    // Fora do período: nada conta, mas a atrasada continua aparecendo.
    const set = await painelDePrazos(p, await como('diretoria@exemplo.local'), { de: '2026-09', ate: '2026-09' }, { agora });
    expect([set.total.aprovacao.total, set.atrasadas.length]).toEqual([0, 1]);

    expect((await painelDePrazos(p, coord, { de: '2026-10', ate: '2026-10' }, { agora })).total.aprovacao.total).toBe(2);
    expect((await painelDePrazos(p, almox, { de: '2026-10', ate: '2026-10' }, { agora })).todas).toBe(false);
    expect((await painelDePrazos(p, await como('informatica@exemplo.local'), { de: '2026-10', ate: '2026-10' }, { agora })).total.aprovacao.total).toBe(0);
    await expect(painelDePrazos(p, pede, {}, { agora })).rejects.toBeInstanceOf(ErroPermissao);
    // Período padrão: os últimos 6 meses.
    expect(await painelDePrazos(p, coord, {}, { agora })).toMatchObject({ de: '2026-05', ate: '2026-10' });
  });
});

describe('fotos e vídeo (ADR-014)', () => {
  const MB = 1024 * 1024;
  async function tipoManutencao(anexos: string | null = null) {
    const t = await inserir(
      p,
      TiposRequisicao,
      {
        nome: 'Manutenção',
        categoria: 'servico',
        formulario: 'manutencao',
        perfil_responsavel: 'manutencao',
        prazo_aprovacao: 8,
        prazo_atendimento: 40,
        descricao: null,
        anexos,
      },
      { email: 'teste' },
    );
    return t.id;
  }
  const detalhes = { servico: 'eletrica', local: 'Sala 4', problema: 'Tomada soltando faísca perto da mesa.', urgencia: 'alta' };
  /** Abre o envio e "manda" o arquivo, como o navegador faria. */
  async function enviarArquivo(
    arquivos: ArquivosMemoria,
    quem: Autorizador,
    tipoId: string,
    tipo: 'foto' | 'video',
    tamanho: number,
    duracao: number | null = null,
  ) {
    const mime = tipo === 'foto' ? 'image/jpeg' : 'video/mp4';
    const { url } = await iniciarEnvioAnexo(p, quem, arquivos, { tipoId, tipo, mime, tamanho, duracao, origem: 'https://elo.exemplo' });
    const f = arquivos.receber(url.split('/').pop()!, new Uint8Array(tamanho).fill(7));
    return { arquivoId: f.id, tipo, nome: `${tipo}.bin`, duracao };
  }

  it('regras: só foto e vídeo, limites de tamanho e duração, quantidade e quem aceita por padrão', () => {
    expect(tipoDoArquivo('image/jpeg')).toBe('foto');
    expect(tipoDoArquivo('video/quicktime')).toBe('video');
    expect(tipoDoArquivo('application/pdf')).toBeNull();
    expect(conferirArquivo({ tipo: 'foto', mime: 'image/jpeg', tamanho: 2 * MB })).toEqual([expect.stringMatching(/passa de 1,4 MB/)]);
    expect(conferirArquivo({ tipo: 'video', mime: 'video/mp4', tamanho: 30 * MB, duracao: 45 })).toEqual([
      expect.stringMatching(/30 MB; o limite é 25 MB/),
      expect.stringMatching(/45 segundos; grave até 30/),
    ]);
    expect(conferirArquivo({ tipo: 'video', mime: 'video/mp4', tamanho: 10 * MB, duracao: 30.6 })).toEqual([]);
    expect(conferirQuantidade([{ tipo: 'foto' }, { tipo: 'foto' }, { tipo: 'foto' }, { tipo: 'foto' }, { tipo: 'video' }, { tipo: 'video' }])).toHaveLength(2);
    expect(aceitaAnexos({ anexos: null, formulario: 'manutencao' })).toBe(true);
    expect(aceitaAnexos({ anexos: null, formulario: 'materiais' })).toBe(false);
    expect(aceitaAnexos({ anexos: 'sim', formulario: 'materiais' })).toBe(true);
    expect(aceitaAnexos({ anexos: 'nao', formulario: 'ti' })).toBe(false);
  });

  it('envia com 2 fotos e 1 vídeo; a ficha mostra; quem vê lê aos poucos, com auditoria; quem não vê, não', async () => {
    const arquivos = new ArquivosMemoria();
    const id = await tipoManutencao();
    const pede = await como('financeiro@exemplo.local');
    const anexos = [
      await enviarArquivo(arquivos, pede, id, 'foto', 300_000),
      await enviarArquivo(arquivos, pede, id, 'foto', 400_000),
      await enviarArquivo(arquivos, pede, id, 'video', 3 * MB, 12),
    ];
    const r = await enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos }), { arquivos });
    const d = await detalharRequisicao(p, pede, r.id);
    expect(d.anexos.map((a) => [a.tipo, a.tamanho])).toEqual([
      ['foto', 300_000],
      ['foto', 400_000],
      ['video', 3 * MB],
    ]);
    const video = d.anexos[2];
    const t = await lerAnexo(p, pede, arquivos, video.id, { inicio: 0, fim: null });
    expect([t.inicio, t.fim, t.total, t.tipo]).toEqual([0, 3 * MB - 1, 3 * MB, 'video/mp4']);
    const parte = await lerAnexo(p, pede, arquivos, video.id, { inicio: MB, fim: MB + 99 });
    expect(parte.dados.length).toBe(100);
    // Só a primeira leitura (início do arquivo) vai para a auditoria.
    const leituras = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'RequisicaoAnexos' && a.acao === 'leitura');
    expect(leituras).toHaveLength(1);
    // O setor só vê depois de aprovada; outra pessoa, nunca.
    await expect(lerAnexo(p, await como('manutencao@exemplo.local'), arquivos, video.id, { inicio: 0, fim: null })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerAnexo(p, await como('dp@exemplo.local'), arquivos, video.id, { inicio: 0, fim: null })).rejects.toBeInstanceOf(ErroPermissao);
    expect((await lerAnexo(p, await como('coord.educacao@exemplo.local'), arquivos, d.anexos[0].id, { inicio: 0, fim: null })).total).toBe(300_000);
  });

  it('recusa: tipo que não aceita, instituição sem pasta, arquivo que não chegou, limites e arquivo de outra requisição', async () => {
    const arquivos = new ArquivosMemoria();
    const pede = await como('financeiro@exemplo.local');
    // Tipo de materiais (padrão: sem anexos) e tipo marcado "nao".
    await expect(iniciarEnvioAnexo(p, pede, arquivos, { tipoId, tipo: 'foto', mime: 'image/jpeg', tamanho: 1000, origem: 'x' })).rejects.toThrow(
      /não aceita foto nem vídeo/,
    );
    const id = await tipoManutencao();
    await expect(iniciarEnvioAnexo(p, pede, null, { tipoId: id, tipo: 'foto', mime: 'image/jpeg', tamanho: 1000, origem: 'x' })).rejects.toThrow(
      /ainda não estão ativos/,
    );
    await expect(
      iniciarEnvioAnexo(p, pede, arquivos, { tipoId: id, tipo: 'video', mime: 'video/mp4', tamanho: 3 * MB, duracao: 50, origem: 'x' }),
    ).rejects.toThrow(/grave até 30/);
    await expect(iniciarEnvioAnexo(p, pede, arquivos, { tipoId: id, tipo: 'foto', mime: 'application/pdf', tamanho: 1000, origem: 'x' })).rejects.toThrow(
      /JPG, PNG ou WebP/,
    );
    const naoChegou = { arquivoId: 'arquivo-inventado', tipo: 'foto' as const, nome: 'x.jpg' };
    await expect(enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: [naoChegou] }), { arquivos })).rejects.toThrow(
      /não chegou à pasta/,
    );
    const fotos = [];
    for (let i = 0; i < 4; i++) fotos.push(await enviarArquivo(arquivos, pede, id, 'foto', 1000));
    await expect(enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: fotos }), { arquivos })).rejects.toThrow(/No máximo 3 fotos/);
    await enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: fotos.slice(0, 1) }), { arquivos });
    await expect(enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: fotos.slice(0, 1) }), { arquivos })).rejects.toThrow(
      /já pertence a outra requisição/,
    );
    // Sem pasta na instituição, a requisição com anexo é recusada; sem anexo, segue normal.
    await expect(enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: fotos.slice(1, 2) }))).rejects.toThrow(/ainda não estão ativos/);
    expect((await enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes }))).numero).toMatch(/^REQ-/);
  });

  it('ao ajustar uma devolvida: o anexo tirado é encerrado e o novo entra', async () => {
    const arquivos = new ArquivosMemoria();
    const id = await tipoManutencao('sim');
    const pede = await como('financeiro@exemplo.local');
    const a1 = await enviarArquivo(arquivos, pede, id, 'foto', 1000);
    const a2 = await enviarArquivo(arquivos, pede, id, 'foto', 2000);
    const r = await enviarRequisicao(p, pede, ficha({ tipoId: id, itens: [], detalhes, anexos: [a1, a2] }), { arquivos });
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), r.id, await versao(r.id), 'devolver', 'Mande uma foto de longe.');
    const a3 = await enviarArquivo(arquivos, pede, id, 'foto', 3000);
    await reenviarRequisicao(p, pede, r.id, await versao(r.id), ficha({ tipoId: id, itens: [], detalhes, anexos: [a2, a3] }), { arquivos });
    expect((await detalharRequisicao(p, pede, r.id)).anexos.map((a) => a.tamanho)).toEqual([2000, 3000]);
    const todos = (await lerTabela(p, RequisicaoAnexos)).todos().filter((x) => x.requisicao_id === r.id);
    expect(todos.filter((x) => !x.ativo).map((x) => x.tamanho)).toEqual([1000]);
  });

  it('a Administração marca no tipo se aceita foto e vídeo', async () => {
    const adm = await como('admin@exemplo.local');
    const t = (await lerTabela(p, TiposRequisicao)).porId(tipoId)!;
    const base = {
      nome: t.nome,
      categoria: 'material' as const,
      formulario: 'materiais' as const,
      perfilResponsavel: 'almoxarifado',
      prazoAprovacao: 8,
      prazoAtendimento: 16,
    };
    expect((await listarTipos(p, adm)).ativos[0].aceitaAnexos).toBe(false);
    await salvarTipo(p, adm, { ...base, anexos: true }, { id: t.id, versao: t.versao });
    expect((await lerTabela(p, TiposRequisicao)).porId(tipoId)!.anexos).toBe('sim');
    expect((await listarTipos(p, adm)).ativos[0].aceitaAnexos).toBe(true);
  });
});
