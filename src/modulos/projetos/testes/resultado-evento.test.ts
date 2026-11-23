/** Entrega L5, parte 3 (regras L18, L19 e L21): resultado do evento, fotografia ao encerrar e comparação da série. */
import { describe, expect, it } from 'vitest';
import { atualizar, lerTabela } from '@/nucleo/armazenamento/tabela';
import type { LigacaoLida } from '@/nucleo/ligacoes/ligacao';
import type { LeitorResultado, ResultadoLido } from '../aplicacao/catalogo-orcamento';
import { cadastrarIdeia, type DadosIdeia } from '../aplicacao/ideias';
import { fotografarResultadoDoEvento, lerResultadoDoEvento } from '../aplicacao/resultado-evento';
import { Encerramento, Projetos } from '../dados/tabelas';
import { compararEdicoes, fotografiaDoTexto, fotografiaEmTexto, leituraDoResultado, resultadoDoEvento, rotularEdicoes } from '../dominio/evento';
import { abrirPortaDeEncerramento, iniciarEncerramento, marcarChecklist, registrarLicao, salvarTextoDeEncerramento } from '../aplicacao/encerramento';
import { adicionarAtividade, adicionarLinhaOrcamento, mudarSituacaoAtividade } from '../aplicacao/planejamento';
import { avancarFase, iniciarImplementacao, salvarDocumento } from '../aplicacao/fases';
import { assumirIdeia } from '../aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { Atividades, Portas } from '../dados/tabelas';
import { AGORA, COORDENACAO, DIRETORIA, FUNCIONARIO, TECNICO, auditoriaDe, comBanca, como, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };

const lido = (receita: number, custo: number, lancamentos = 3): ResultadoLido => ({ receita, custo, lancamentos, semLancamentos: lancamentos === 0, resultado: resultadoDoEvento({ receita, custo }) });
/** Leitor falso do Orçamento: a permissão é dele, aqui só a lista de quem não vê. */
function leitor(porProjeto: Record<string, ResultadoLido>, semPermissao: string[] = []): LeitorResultado {
  return async (quem, id): Promise<LigacaoLida<ResultadoLido>> => (semPermissao.includes(quem.email) ? { estado: 'sem_permissao' } : { estado: 'ok', dados: porProjeto[id] ?? lido(0, 0, 0) });
}

const evento = (serie: string | null, dataEvento: string): DadosIdeia => ({ titulo: `Evento ${dataEvento}`, resumo: 'Objetivo fictício.', tipo: 'captacao', porte: 'enxuto', valorEstimado: 1000, servico: null, evento: { serie, dataEvento, metaReceita: 5000, fonteReceitaId: null } });

async function criar(p: P, serie: string | null, dataEvento: string, etapa: 'implementacao' | 'encerramento' | 'encerrado') {
  const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), evento(serie, dataEvento), { ...o, enviar: false });
  const v = (await lerTabela(p, Projetos)).porId(r.id)!;
  await atualizar(p, Projetos, r.id, v.versao, { etapa }, { email: DIRETORIA });
  return r.id;
}

describe('regras puras do resultado (L18 e L19)', () => {
  it('resultado = receita − custo, sem erro de centavos, e a leitura diz sobrou, faltou ou zero', () => {
    expect(resultadoDoEvento({ receita: 0.3, custo: 0.1 })).toBe(0.2);
    expect(leituraDoResultado(1500)).toEqual({ palavra: 'Sobrou', valor: 1500 });
    expect(leituraDoResultado(-250.5)).toEqual({ palavra: 'Faltou', valor: 250.5 });
    expect(leituraDoResultado(0).palavra).toBe('Ficou no zero');
  });

  it('a fotografia vai e volta como texto e texto estragado vira nada', () => {
    const t = fotografiaEmTexto({ receita: 10, custo: 4, lancamentos: 2 }, '2026-11-12T15:00:00Z');
    expect(fotografiaDoTexto(t)).toEqual({ receita: 10, custo: 4, lancamentos: 2, em: '2026-11-12T15:00:00Z' });
    expect(fotografiaDoTexto('não é json')).toBeNull();
    expect(fotografiaDoTexto('{"receita":"x"}')).toBeNull();
    expect(fotografiaDoTexto(null)).toBeNull();
  });

  it('a variação é contra a edição imediatamente anterior e "melhor" conta a atual', () => {
    const antes = [
      { rotulo: '2025', resultado: 1000, dataEvento: '2025-06-01' },
      { rotulo: '2026', resultado: 4000, dataEvento: '2026-06-01' },
    ];
    expect(compararEdicoes({ rotulo: '2027', resultado: 3000 }, antes)).toMatchObject({ anterior: { rotulo: '2026' }, variacao: -1000, melhor: { rotulo: '2026' } });
    expect(compararEdicoes({ rotulo: '2027', resultado: 9000 }, antes).melhor?.rotulo).toBe('2027');
    expect(compararEdicoes({ rotulo: '2027', resultado: 1 }, [])).toEqual({ anterior: null, variacao: null, melhor: null });
  });

  it('duas edições no mesmo ano ganham o código no nome', () => {
    const l = rotularEdicoes([
      { codigo: 'PRJ-1', dataEvento: '2026-03-01' },
      { codigo: 'PRJ-2', dataEvento: '2026-09-01' },
      { codigo: 'PRJ-3', dataEvento: '2027-03-01' },
    ]);
    expect(l.map((x) => x.rotulo)).toEqual(['2026 (PRJ-1)', '2026 (PRJ-2)', '2027']);
  });
});

describe('cartão "Resultado do evento"', () => {
  it('evento em andamento: números do momento, marcados como parciais', async () => {
    const p = await planilhasDeProjetos();
    const id = await criar(p, 'Bazar anual', '2027-06-12', 'implementacao');
    const r = await lerResultadoDoEvento(p, await como(p, DIRETORIA), id, leitor({ [id]: lido(7000, 2500) }));
    expect(r).toMatchObject({ aplica: true, estado: 'ok', parcial: true, receita: 7000, custo: 2500, resultado: 4500, daFotografia: false });
  });

  it('sem lançamentos: devolve zero lançamentos (a tela diz "Sem lançamentos", nunca R$ 0,00)', async () => {
    const p = await planilhasDeProjetos();
    const id = await criar(p, null, '2027-06-12', 'encerramento');
    const r = await lerResultadoDoEvento(p, await como(p, DIRETORIA), id, leitor({}));
    expect(r).toMatchObject({ estado: 'ok', lancamentos: 0 });
    expect(r?.comparacao.anterior).toBeNull();
  });

  it('quem não vê o Orçamento não recebe valor nenhum, nem o das edições anteriores', async () => {
    const p = await planilhasDeProjetos();
    const velho = await criar(p, 'Bazar anual', '2026-06-12', 'encerrado');
    await fotografarResultadoDoEvento(p, await como(p, DIRETORIA), velho, leitor({ [velho]: lido(5000, 3000) }), o);
    const id = await criar(p, 'Bazar anual', '2027-06-12', 'encerramento');
    const r = await lerResultadoDoEvento(p, await como(p, DIRETORIA), id, leitor({ [id]: lido(1, 1) }, [DIRETORIA]));
    expect(r).toMatchObject({ estado: 'sem_permissao', receita: 0, custo: 0, anteriores: [] });
  });

  it('Orçamento desligado ou com falha: ligação indisponível, o projeto continua abrindo', async () => {
    const p = await planilhasDeProjetos();
    const id = await criar(p, null, '2027-06-12', 'implementacao');
    expect((await lerResultadoDoEvento(p, await como(p, DIRETORIA), id, null))?.estado).toBe('indisponivel');
    const quebrado: LeitorResultado = async () => {
      throw new Error('falhou');
    };
    expect((await lerResultadoDoEvento(p, await como(p, DIRETORIA), id, quebrado))?.estado).toBe('indisponivel');
  });

  it('projeto que não é evento, ou ainda em ideia, não tem o cartão', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), { titulo: 'Interno', resumo: 'x', tipo: 'interno', porte: 'enxuto', valorEstimado: 10, servico: null }, { ...o, enviar: false });
    expect((await lerResultadoDoEvento(p, await como(p, DIRETORIA), r.id, leitor({})))?.aplica).toBe(false);
    const cedo = await cadastrarIdeia(p, await como(p, FUNCIONARIO), evento('S', '2027-06-12'), { ...o, enviar: false });
    expect((await lerResultadoDoEvento(p, await como(p, DIRETORIA), cedo.id, leitor({})))?.aplica).toBe(false);
  });

  it('compara com as edições encerradas da série (ignora acento e maiúscula) e deixa de fora a que não foi encerrada', async () => {
    const p = await planilhasDeProjetos();
    const d = await como(p, DIRETORIA);
    const e1 = await criar(p, 'Leilão anual', '2025-06-12', 'encerrado');
    const e2 = await criar(p, 'leilao ANUAL', '2026-06-12', 'encerrado');
    const andamento = await criar(p, 'Leilão anual', '2026-11-01', 'implementacao');
    const outra = await criar(p, 'Outra série', '2026-02-01', 'encerrado');
    const atual = await criar(p, 'Leilão anual', '2027-06-12', 'encerramento');
    const nums = { [e1]: lido(5000, 3000), [e2]: lido(8000, 3000), [andamento]: lido(100, 50), [outra]: lido(900, 100), [atual]: lido(9000, 4000) };
    for (const id of [e1, e2, andamento, outra]) await fotografarResultadoDoEvento(p, d, id, leitor(nums), o);
    const r = await lerResultadoDoEvento(p, d, atual, leitor(nums));
    expect(r?.anteriores.map((x) => x.rotulo)).toEqual(['2025', '2026']);
    expect(r?.comparacao).toMatchObject({ anterior: { rotulo: '2026', resultado: 5000 }, variacao: 0, melhor: { rotulo: '2026' } });
  });

  it('primeira edição da série: sem com o que comparar; série em branco = evento único', async () => {
    const p = await planilhasDeProjetos();
    const d = await como(p, DIRETORIA);
    const so = await criar(p, 'Série nova', '2027-06-12', 'encerramento');
    expect((await lerResultadoDoEvento(p, d, so, leitor({ [so]: lido(10, 5) })))?.anteriores).toEqual([]);
    const unico = await criar(p, null, '2027-06-12', 'encerramento');
    const r = await lerResultadoDoEvento(p, d, unico, leitor({ [unico]: lido(10, 5) }));
    expect(r?.serie).toBeNull();
    expect(r?.comparacao.anterior).toBeNull();
  });
});

describe('fotografia do resultado (L19 e L21)', () => {
  it('encerrado mostra a fotografia, não o que o Orçamento diz depois', async () => {
    const p = await planilhasDeProjetos();
    const d = await como(p, DIRETORIA);
    const id = await criar(p, 'S', '2026-06-12', 'encerrado');
    await fotografarResultadoDoEvento(p, d, id, leitor({ [id]: lido(100, 40, 2) }), o);
    const r = await lerResultadoDoEvento(p, d, id, leitor({ [id]: lido(999, 1, 9) }));
    expect(r).toMatchObject({ daFotografia: true, parcial: false, receita: 100, custo: 40, lancamentos: 2 });
  });

  it('grava de novo sem duplicar a linha, e falha ou falta de permissão não apagam a anterior', async () => {
    const p = await planilhasDeProjetos();
    const d = await como(p, DIRETORIA);
    const id = await criar(p, 'S', '2026-06-12', 'encerramento');
    expect(await fotografarResultadoDoEvento(p, d, id, leitor({ [id]: lido(100, 40) }), o)).toBe(true);
    expect(await fotografarResultadoDoEvento(p, d, id, leitor({ [id]: lido(120, 40) }), o)).toBe(true);
    expect(await fotografarResultadoDoEvento(p, d, id, leitor({}, [DIRETORIA]), o)).toBe(false);
    expect(await fotografarResultadoDoEvento(p, d, id, null, o)).toBe(false);
    const linhas = (await lerTabela(p, Encerramento)).ativos().filter((x) => x.projeto_id === id && x.item === 'resultado_evento');
    expect(linhas).toHaveLength(1);
    expect(fotografiaDoTexto(linhas[0].texto)?.receita).toBe(120);
  });

  it('projeto que não é evento não ganha fotografia, e a auditoria guarda só as colunas', async () => {
    const p = await planilhasDeProjetos();
    const d = await como(p, DIRETORIA);
    const interno = await cadastrarIdeia(p, await como(p, FUNCIONARIO), { titulo: 'Interno', resumo: 'x', tipo: 'interno', porte: 'enxuto', valorEstimado: 10, servico: null }, { ...o, enviar: false });
    expect(await fotografarResultadoDoEvento(p, d, interno.id, leitor({}), o)).toBe(false);
    const id = await criar(p, 'S', '2026-06-12', 'encerramento');
    await fotografarResultadoDoEvento(p, d, id, leitor({ [id]: lido(123456, 7) }), o);
    const linha = (await lerTabela(p, Encerramento)).ativos().find((x) => x.projeto_id === id)!;
    const audit = JSON.stringify(await auditoriaDe(p, linha.id));
    expect(audit).toContain('texto');
    expect(audit).not.toContain('123456');
  });
});

describe('fotografia no fluxo de encerramento (L19)', () => {
  it('abrir a porta e a decisão de encerrar gravam a fotografia; depois de encerrado ela vale no cartão', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const coord = await como(p, COORDENACAO);
    const diretoria = await como(p, DIRETORIA);
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), evento('Bazar anual', '2026-12-05'), { ...o, enviar: true });
    await assumirIdeia(p, coord, r.id, await versaoDe(p, r.id), o);
    const decidir = async (portaId: string) => {
      await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
      await decidirPorta(p, diretoria, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Segue.', o);
    };
    await decidir((await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o)).portaId);
    await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto' }, true, null, o);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    await salvarDocumento(p, coord, r.id, 'termo_abertura', { objetivo: 'Objetivo', valor_total: '1000' }, true, null, o);
    await decidir((await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o)).portaId);
    await adicionarAtividade(p, coord, r.id, { descricao: 'Montar', responsavel: FUNCIONARIO, inicioPrevisto: '2026-11-01', fimPrevisto: '2026-11-10', peso: null }, o);
    await adicionarLinhaOrcamento(p, coord, r.id, { categoria: 'Custos', descricao: 'Material', valor: 1000, fonte: null }, o);
    await iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o);
    const a = (await lerTabela(p, Atividades)).ativos().find((x) => x.projeto_id === r.id)!;
    await mudarSituacaoAtividade(p, coord, r.id, a.id, a.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
    await iniciarEncerramento(p, coord, r.id, await versaoDe(p, r.id), o);
    for (const i of ['contratual', 'financeiro', 'administrativo'] as const) await marcarChecklist(p, coord, r.id, i, true, null, o);
    await salvarTextoDeEncerramento(p, coord, r.id, 'relatorio_final', 'Foi bom.', o);
    await registrarLicao(p, coord, r.id, { categoria: 'execucao', oQueAconteceu: 'x', fazerDiferente: 'y' }, o);

    // Quem abre a porta (coordenação) não vê o Orçamento: a fotografia espera a decisão, e abrir a porta não trava.
    const { portaId } = await abrirPortaDeEncerramento(p, coord, r.id, await versaoDe(p, r.id), undefined, { ...o, resultado: leitor({}, [COORDENACAO]) });
    expect((await lerTabela(p, Encerramento)).ativos().filter((x) => x.item === 'resultado_evento')).toHaveLength(0);

    // A Diretoria decide encerrar: a fotografia final é gravada com o que o Orçamento tem nesse momento.
    await decidirPorta(p, diretoria, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Encerrado.', { ...o, resultado: leitor({ [r.id]: lido(6000, 2000, 4) }) });
    const foto = (await lerTabela(p, Encerramento)).ativos().find((x) => x.projeto_id === r.id && x.item === 'resultado_evento');
    expect(fotografiaDoTexto(foto?.texto)).toMatchObject({ receita: 6000, custo: 2000, lancamentos: 4 });
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('encerrado');
    const cartao = await lerResultadoDoEvento(p, diretoria, r.id, leitor({ [r.id]: lido(1, 1) }));
    expect(cartao).toMatchObject({ daFotografia: true, parcial: false, resultado: 4000 });
  });
});
