import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import type { NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import { adicionarItemMarco, adicionarMembro } from '../aplicacao/fases';
import { definirFonteDoItem, fotografarIndicadores, lerIndicadores, registrarMedicao, type NumerosDePessoas } from '../aplicacao/indicadores';
import { decidirPorta } from '../aplicacao/portas';
import { IndicadoresMedidos, MarcoLogico, Portas } from '../dados/tabelas';
import { situacaoDaMeta, fraseDoNumero } from '../dominio/indicadores';
import { AGORA, COORDENACAO, DIRETORIA, FUNCIONARIO, LEITURA, auditoriaDe, comBanca, comPortaAberta, como, planilhasDeProjetos, todosPareceres } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };

async function naFase1(p: P) {
  const r = await comPortaAberta(p);
  await todosPareceres(p, r.portaId);
  const versaoPorta = (await lerTabela(p, Portas)).porId(r.portaId)!.versao;
  await decidirPorta(p, await como(p, DIRETORIA), r.portaId, versaoPorta, 'seguir', 'Segue.', o);
  return r;
}

const agregado = (valor: number | null, base: number, motivo: NumeroAgregado['motivo'] = null): NumeroAgregado => ({ valor, base, motivo });
const leitorCom = (indiceMedio: NumeroAgregado, reavaliacaoEmDia: NumeroAgregado): NumerosDePessoas => ({ indicadoresDoServico: async () => ({ indiceMedio, reavaliacaoEmDia }) });

/** Projeto na fase 1 com um objetivo e um resultado com indicador. */
async function comMarco(p: P) {
  const r = await naFase1(p);
  const coord = await como(p, COORDENACAO);
  const item = (nivel: 'impacto' | 'objetivo' | 'resultado', acima: string | null, indicador: string | null) => ({ nivel, descricao: nivel, indicador, fonteVerificacao: 'f', pressuposto: null, acima });
  await adicionarItemMarco(p, coord, r.id, item('impacto', null, 'ind impacto'), o);
  const itens = async () => (await lerTabela(p, MarcoLogico)).ativos();
  const impacto = (await itens())[0];
  await adicionarItemMarco(p, coord, r.id, item('objetivo', impacto.id, null), o);
  return { r, coord, impacto: (await itens()).find((i) => i.nivel === 'impacto')!, objetivo: (await itens()).find((i) => i.nivel === 'objetivo')! };
}

const escolher = (p: P, quem: Awaited<ReturnType<typeof como>>, projeto: string, item: { id: string; versao: number }, e: Parameters<typeof definirFonteDoItem>[5]) =>
  definirFonteDoItem(p, quem, projeto, item.id, item.versao, e, o);

describe('domínio: situação contra a meta (L6)', () => {
  it('só calcula com número e meta', () => {
    expect(situacaoDaMeta(80, 80)).toBe('dentro');
    expect(situacaoDaMeta(79, 80)).toBe('abaixo');
    expect(situacaoDaMeta(10, null)).toBeNull();
    expect(situacaoDaMeta(null, 80)).toBeNull();
    expect(fraseDoNumero('vinculos_ativos', 42)).toBe('42 pessoas com vínculo ativo');
    expect(fraseDoNumero('vinculos_ativos', 1)).toBe('1 pessoa com vínculo ativo');
  });
});

describe('fonte do número do item (L1 e L5)', () => {
  it('exige indicador e serviço, e "à mão" limpa o serviço', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { r, coord, impacto, objetivo } = await comMarco(p);
    await expect(escolher(p, coord, r.id, objetivo, { fonte: 'vinculos_ativos', servico: 'escola' })).rejects.toThrow(/indicador/);
    await expect(escolher(p, coord, r.id, impacto, { fonte: 'vinculos_ativos' })).rejects.toThrow(/serviço/);
    await expect(escolher(p, coord, r.id, impacto, { fonte: 'vinculos_ativos', servico: 'nao_existe' })).rejects.toThrow(/existe/);
    await expect(escolher(p, coord, r.id, impacto, { fonte: 'outra' as never, servico: 'escola' })).rejects.toThrow(/fontes oferecidas/);
    await expect(escolher(p, coord, r.id, impacto, { fonte: 'manual', meta: -1 })).rejects.toThrow(/meta/);
    await escolher(p, coord, r.id, impacto, { fonte: 'vinculos_ativos', servico: 'escola', meta: 5 });
    const salvo = (await lerTabela(p, MarcoLogico)).porId(impacto.id)!;
    expect(salvo).toMatchObject({ fonte_numero: 'vinculos_ativos', servico_id: 'escola', servico_nome: 'Escola (exemplo)', meta: 5 });
    await escolher(p, coord, r.id, salvo, { fonte: 'manual' });
    expect((await lerTabela(p, MarcoLogico)).porId(impacto.id)).toMatchObject({ fonte_numero: 'manual', servico_id: null, servico_nome: null });
  });

  it('só quem gerencia altera; auditoria guarda as colunas, não os valores', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { r, coord, impacto } = await comMarco(p);
    await adicionarMembro(p, coord, r.id, LEITURA, 'Apoio', o);
    await expect(escolher(p, await como(p, FUNCIONARIO), r.id, impacto, { fonte: 'vinculos_ativos', servico: 'escola' })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(escolher(p, await como(p, LEITURA), r.id, impacto, { fonte: 'vinculos_ativos', servico: 'escola' })).rejects.toBeInstanceOf(ErroPermissao);
    await escolher(p, coord, r.id, impacto, { fonte: 'indice_cuidado', servico: 'escola', meta: 77 });
    const trilha = (await auditoriaDe(p, impacto.id)).map((a) => JSON.parse(a.detalhes as string));
    expect(trilha.at(-1)?.colunas).toContain('fonte_numero');
    expect(JSON.stringify(trilha)).not.toMatch(/77|indice_cuidado/);
  });
});

describe('números do cadastro no projeto (L2 a L6)', () => {
  async function comFonte(fonte: 'vinculos_ativos' | 'indice_cuidado' | 'reavaliacao_em_dia', servico: string, meta: number | null = null) {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const base = await comMarco(p);
    await escolher(p, base.coord, base.r.id, base.impacto, { fonte, servico, meta });
    return { p, ...base };
  }

  it('contagem com 5 pessoas ou mais mostra o número; base 0 mostra 0; só valor, base e motivo atravessam', async () => {
    const { p, r, coord } = await comFonte('vinculos_ativos', 'escola', 5);
    const lido = await lerIndicadores(p, coord, r.id, undefined, o);
    const item = lido.itens.find((i) => i.indicador === 'ind impacto')!;
    expect(item.hoje).toEqual({ estado: 'ok', valor: 6, base: 6, motivo: null, situacao: 'dentro' });
    expect(Object.keys((item.hoje as object))).toEqual(['estado', 'valor', 'base', 'motivo', 'situacao']);

    const zero = await comFonte('vinculos_ativos', 'transporte');
    const lido0 = await lerIndicadores(zero.p, zero.coord, zero.r.id, undefined, o);
    expect(lido0.itens[0].hoje).toEqual({ estado: 'ok', valor: 0, base: 0, motivo: null, situacao: null });
  });

  it('poucos casos nunca mostram o valor e não têm situação; média e % com base 0 são "sem dados"', async () => {
    const poucos = await comFonte('indice_cuidado', 'escola', 3);
    const l1 = await lerIndicadores(poucos.p, poucos.coord, poucos.r.id, leitorCom(agregado(null, 3, 'poucos_casos'), agregado(null, 3, 'poucos_casos')), o);
    expect(l1.itens[0].hoje).toEqual({ estado: 'ok', valor: null, base: 3, motivo: 'poucos_casos', situacao: null });
    const sem = await comFonte('reavaliacao_em_dia', 'escola', 80);
    const l2 = await lerIndicadores(sem.p, sem.coord, sem.r.id, leitorCom(agregado(null, 0, 'sem_dados'), agregado(null, 0, 'sem_dados')), o);
    expect(l2.itens[0].hoje).toEqual({ estado: 'ok', valor: null, base: 0, motivo: 'sem_dados', situacao: null });
  });

  it('situação contra a meta e sem meta', async () => {
    const abaixo = await comFonte('reavaliacao_em_dia', 'escola', 80);
    const leitor = leitorCom(agregado(2.5, 10), agregado(60, 10));
    expect((await lerIndicadores(abaixo.p, abaixo.coord, abaixo.r.id, leitor, o)).itens[0].hoje).toMatchObject({ valor: 60, situacao: 'abaixo' });
    const sem = await comFonte('indice_cuidado', 'escola');
    expect((await lerIndicadores(sem.p, sem.coord, sem.r.id, leitor, o)).itens[0].hoje).toMatchObject({ valor: 2.5, situacao: null });
  });

  it('Avaliação desligada ou com falha mostra "indisponível"; o item à mão não muda sozinho', async () => {
    const { p, r, coord, objetivo } = await comFonte('indice_cuidado', 'escola', 3);
    expect((await lerIndicadores(p, coord, r.id, undefined, o)).itens[0].hoje).toEqual({ estado: 'indisponivel' });
    const quebrado: NumerosDePessoas = { indicadoresDoServico: async () => Promise.reject(new Error('falhou')) };
    expect((await lerIndicadores(p, coord, r.id, quebrado, o)).itens[0].hoje).toEqual({ estado: 'indisponivel' });
    void objetivo;
    const mao = await planilhasDeProjetos();
    await comBanca(mao);
    const b = await comMarco(mao);
    expect((await lerIndicadores(mao, b.coord, b.r.id, undefined, o)).itens[0].hoje).toBeNull();
  });

  it('quem vê o projeto vê os números; quem não vê, não', async () => {
    const { p, r, coord } = await comFonte('vinculos_ativos', 'escola');
    await expect(lerIndicadores(p, await como(p, LEITURA), r.id, undefined, o)).rejects.toThrow(/não encontrado/);
    await adicionarMembro(p, coord, r.id, LEITURA, 'Apoio', o);
    const lido = await lerIndicadores(p, await como(p, LEITURA), r.id, undefined, o);
    expect(lido.podeAlterar).toBe(false);
    expect(lido.podeRegistrar).toBe(false);
    expect((await lerIndicadores(p, coord, r.id, undefined, o)).podeRegistrar).toBe(true);
  });
});

describe('fotografia dos indicadores (L12)', () => {
  it('grava uma linha por item automático, nunca edita, e nova medição é outra linha', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { r, coord, impacto } = await comMarco(p);
    await expect(registrarMedicao(p, coord, r.id, undefined, o)).rejects.toThrow(/Nenhum item/);
    await escolher(p, coord, r.id, impacto, { fonte: 'reavaliacao_em_dia', servico: 'escola', meta: 80 });
    expect(await registrarMedicao(p, coord, r.id, leitorCom(agregado(2, 10), agregado(70, 10)), o)).toBe(1);
    expect(await registrarMedicao(p, coord, r.id, leitorCom(agregado(2, 10), agregado(null, 3, 'poucos_casos')), o)).toBe(1);
    const linhas = (await lerTabela(p, IndicadoresMedidos)).ativos();
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ item_id: impacto.id, valor: 70, base: 10, motivo: null, origem: 'manual', registrado_por: COORDENACAO, data: '2026-11-12' });
    expect(linhas[1]).toMatchObject({ valor: null, base: 3, motivo: 'poucos_casos' });
    const lido = await lerIndicadores(p, coord, r.id, undefined, o);
    expect(lido.medicoes).toHaveLength(2);
    const trilha = await auditoriaDe(p, linhas[0].id);
    expect(JSON.parse(trilha[0].detalhes as string)).toEqual({ colunas: ['projeto_id', 'item_id', 'data', 'valor', 'base', 'motivo', 'origem', 'registrado_por'] });
  });

  it('Avaliação desligada grava "indisponível"; origens do relatório e do encerramento são aceitas', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { r, coord, impacto } = await comMarco(p);
    await escolher(p, coord, r.id, impacto, { fonte: 'indice_cuidado', servico: 'escola' });
    await fotografarIndicadores(p, coord, r.id, 'relatorio', undefined, o);
    await fotografarIndicadores(p, coord, r.id, 'encerramento', undefined, o);
    const linhas = (await lerTabela(p, IndicadoresMedidos)).ativos();
    expect(linhas.map((l) => l.origem)).toEqual(['relatorio', 'encerramento']);
    expect(linhas[0]).toMatchObject({ valor: null, base: 0, motivo: 'indisponivel' });
  });

  it('só quem gerencia registra', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { r, coord, impacto } = await comMarco(p);
    await escolher(p, coord, r.id, impacto, { fonte: 'vinculos_ativos', servico: 'escola' });
    await expect(registrarMedicao(p, await como(p, FUNCIONARIO), r.id, undefined, o)).rejects.toBeInstanceOf(ErroPermissao);
    expect((await lerTabela(p, IndicadoresMedidos)).ativos()).toHaveLength(0);
  });
});
