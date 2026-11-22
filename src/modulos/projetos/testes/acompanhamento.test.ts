import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import {
  decidirMudanca,
  enviarRelatorio,
  avaliarPedido,
  lerAcompanhamento,
  pedirMudanca,
  registrarProblema,
  resolverProblema,
  type DadosPedido,
} from '../aplicacao/acompanhamento';
import { adicionarMembro, avancarFase, encerrarRisco, iniciarImplementacao, registrarRisco, salvarDocumento } from '../aplicacao/fases';
import { adicionarAtividade, adicionarLinhaOrcamento, mudarSituacaoAtividade } from '../aplicacao/planejamento';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { Atividades, PedidosMudanca, Portas, ProjetoDocumentos, ProjetoOrcamento, Projetos, Relatorios } from '../dados/tabelas';
import {
  avaliarCusto,
  avaliarEscopo,
  avaliarPrazo,
  diasEntre,
  ePior,
  eMelhor,
  foraDaTolerancia,
  fraseDaVariacao,
  planejadoPct,
  problemaAberto,
  quemDecide,
  realizadoPct,
  situacaoCalculada,
  variacaoCustoPct,
} from '../dominio/acompanhamento';
import { AGORA, ALCADA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, comPortaAberta, como, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const termoBase = { objetivo: 'Objetivo', escopo: 'Escopo inicial', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };

/** Projeto enxuto em implementação: Termo aprovado (R$ 10.000), duas linhas de orçamento e duas atividades. */
async function emImplementacao(p: P, termo: Record<string, string> = termoBase) {
  const r = await comPortaAberta(p, { porte: 'enxuto' });
  const coord = await como(p, COORDENACAO);
  const diretoria = await como(p, DIRETORIA);
  const decidir = async (portaId: string) => {
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
    await decidirPorta(p, diretoria, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Segue.', o);
  };
  await decidir(r.portaId);
  await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto' }, true, null, o);
  await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
  await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
  const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
  await decidir(portaId);
  await adicionarAtividade(p, coord, r.id, { descricao: 'Comprar material', responsavel: FUNCIONARIO, inicioPrevisto: '2026-11-01', fimPrevisto: '2026-11-20', peso: null }, o);
  await adicionarAtividade(p, coord, r.id, { descricao: 'Oficinas', responsavel: FUNCIONARIO, inicioPrevisto: '2026-11-21', fimPrevisto: '2026-12-10', peso: null }, o);
  await adicionarLinhaOrcamento(p, coord, r.id, { categoria: 'Pessoal', descricao: 'Instrutores', valor: 6000, fonte: null }, o);
  await adicionarLinhaOrcamento(p, coord, r.id, { categoria: 'Material', descricao: 'Livros', valor: 4000, fonte: null }, o);
  await iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o);
  const linhas = (await lerTabela(p, ProjetoOrcamento)).ativos().filter((l) => l.projeto_id === r.id);
  const atividades = (await lerTabela(p, Atividades)).ativos().filter((a) => a.projeto_id === r.id);
  return { ...r, coord, diretoria, pessoal: linhas.find((l) => l.categoria === 'Pessoal')!, material: linhas.find((l) => l.categoria === 'Material')!, comprar: atividades.find((a) => a.descricao === 'Comprar material')!, oficinas: atividades.find((a) => a.descricao === 'Oficinas')! };
}

const custo = (alvo: string, proposto: string, extra: Partial<DadosPedido> = {}): DadosPedido => ({ tipo: 'custo', alvo, proposto, justificativa: 'Preço subiu.', ...extra });
const prazo = (alvo: string | null, proposto: string, extra: Partial<DadosPedido> = {}): DadosPedido => ({ tipo: 'prazo', alvo, proposto, justificativa: 'Chuva.', ...extra });
const pedidos = async (p: P) => (await lerTabela(p, PedidosMudanca)).ativos();
const termos = async (p: P, id: string) => (await lerTabela(p, ProjetoDocumentos)).ativos().filter((d) => d.projeto_id === id && d.tipo === 'termo_abertura');

describe('domínio: acompanhamento', () => {
  it('variação de custo sobe em %, reduzir nunca passa da tolerância', () => {
    expect(variacaoCustoPct(1000, 1030)).toBe(3);
    expect(variacaoCustoPct(1000, 900)).toBe(-10);
    expect(variacaoCustoPct(0, 5)).toBe(100);
    expect(variacaoCustoPct(0, 0)).toBe(0);
  });

  it('custo: linha e total precisam caber; frase em palavras', () => {
    const base = { baseLinha: 1000, baseTotal: 10000, limiteLinhaPct: 10, limiteTotalPct: 5 };
    const dentro = avaliarCusto({ ...base, novoLinha: 1030, novoTotal: 10030 });
    expect(dentro.dentro).toBe(true);
    expect(fraseDaVariacao('custo', dentro)).toBe('Custo: a linha sobe 3% de 10% permitidos; o total sobe 0,3% de 5% permitidos.');
    expect(avaliarCusto({ ...base, novoLinha: 1200, novoTotal: 10200 }).dentro).toBe(false);
    expect(avaliarCusto({ ...base, novoLinha: 1090, novoTotal: 10600 }).dentro).toBe(false);
    expect(avaliarCusto({ ...base, novoLinha: 500, novoTotal: 9500 }).dentro).toBe(true);
  });

  it('prazo e escopo; quem decide', () => {
    expect(diasEntre('2026-12-01', '2026-12-11')).toBe(10);
    const a = avaliarPrazo({ base: '2026-12-01', novo: '2026-12-11', limiteDias: 15 });
    expect(a.dentro).toBe(true);
    expect(fraseDaVariacao('prazo', a)).toBe('O prazo atrasa 10 dias de 15 dias permitidos.');
    expect(avaliarPrazo({ base: '2026-12-01', novo: '2026-12-20', limiteDias: 15 }).dentro).toBe(false);
    expect(avaliarPrazo({ base: '2026-12-01', novo: '2026-11-20', limiteDias: 0 }).dentro).toBe(true);
    expect(avaliarEscopo({ escopoLivreDoTermo: null, cabeNoEscopoLivre: true }).dentro).toBe(false);
    expect(avaliarEscopo({ escopoLivreDoTermo: 'Datas das oficinas', cabeNoEscopoLivre: false }).dentro).toBe(false);
    expect(avaliarEscopo({ escopoLivreDoTermo: 'Datas das oficinas', cabeNoEscopoLivre: true }).dentro).toBe(true);
    expect(quemDecide(true, false)).toBe('Dentro da tolerância: você aplica.');
    expect(quemDecide(false, false)).toBe('Fora da tolerância: vai para a Diretoria.');
    expect(quemDecide(false, true)).toMatch(/Presidência ou o Conselho/);
  });

  it('problema aberto até ter solução e data', () => {
    expect(problemaAberto({ solucao: null, resolvido_em: null })).toBe(true);
    expect(problemaAberto({ solucao: 'Feito', resolvido_em: null })).toBe(true);
    expect(problemaAberto({ solucao: 'Feito', resolvido_em: '2026-11-10' })).toBe(false);
  });

  it('situação do relatório: calculada, e só pode piorar', () => {
    const base = { motivosForaTolerancia: [], problemasAbertos: [], atrasadas: 0, planejadoPct: 50, realizadoPct: 50 };
    expect(situacaoCalculada(base)).toBe('verde');
    expect(situacaoCalculada({ ...base, atrasadas: 1 })).toBe('amarelo');
    expect(situacaoCalculada({ ...base, realizadoPct: 40 })).toBe('amarelo');
    expect(situacaoCalculada({ ...base, problemasAbertos: [{ gravidade: 'baixo' }] })).toBe('amarelo');
    expect(situacaoCalculada({ ...base, problemasAbertos: [{ gravidade: 'alto' }] })).toBe('vermelho');
    expect(situacaoCalculada({ ...base, motivosForaTolerancia: ['x'] })).toBe('vermelho');
    expect(ePior('vermelho', 'amarelo')).toBe(true);
    expect(eMelhor('verde', 'amarelo')).toBe(true);
    expect(ePior('amarelo', 'amarelo')).toBe(false);
  });

  it('planejado e realizado pelo peso das atividades', () => {
    const at = [
      { situacao: 'concluida' as const, peso: 3, fim_previsto: '2026-11-10', fim_real: '2026-11-09' },
      { situacao: 'em_andamento' as const, peso: 1, fim_previsto: '2026-11-15', fim_real: null },
      { situacao: 'cancelada' as const, peso: 9, fim_previsto: '2026-11-01', fim_real: null },
    ];
    expect(planejadoPct(at, '2026-11-12')).toBe(75);
    expect(planejadoPct(at, '2026-11-20')).toBe(100);
    expect(realizadoPct(at, '2026-11-12')).toBe(75);
    expect(realizadoPct(at, '2026-11-05')).toBe(0);
    expect(planejadoPct([], '2026-11-12')).toBe(0);
  });

  it('fora da tolerância (regra 19)', () => {
    const e = { hoje: '2026-11-12', tolerancias: { custoTotalPct: 5, prazoFimDias: 15, prazoMarcoDias: 7 }, valorAprovado: 10000, totalOrcamento: 10000, gastoRealizado: null, fimPrevistoProjeto: '2026-12-10', atividades: [] };
    expect(foraDaTolerancia(e)).toEqual([]);
    expect(foraDaTolerancia({ ...e, totalOrcamento: 10600 })[0]).toMatch(/6% acima/);
    expect(foraDaTolerancia({ ...e, gastoRealizado: 10600 })[0]).toMatch(/gasto realizado/);
    expect(foraDaTolerancia({ ...e, atividades: [{ descricao: 'A', situacao: 'a_fazer', fim_previsto: '2026-12-30' }] })[0]).toMatch(/20 dias depois/);
    expect(foraDaTolerancia({ ...e, atividades: [{ descricao: 'A', situacao: 'em_andamento', fim_previsto: '2026-11-01' }] })[0]).toMatch(/atrasada há 11 dias/);
    expect(foraDaTolerancia({ ...e, atividades: [{ descricao: 'A', situacao: 'concluida', fim_previsto: '2026-11-01' }] })).toEqual([]);
  });
});

describe('problemas e riscos na implementação', () => {
  it('registra e resolve; sem solução e data fica aberto; só quem gerencia altera', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await registrarProblema(p, r.coord, r.id, { descricao: 'Fornecedor atrasou', gravidade: 'alto', dono: COORDENACAO }, o);
    let a = (await lerAcompanhamento(p, r.coord, r.id, o))!;
    expect(a.problemas).toHaveLength(1);
    expect(a.problemas[0].resolvido_em).toBeNull();
    await expect(resolverProblema(p, r.coord, r.id, a.problemas[0].id, a.problemas[0].versao, '', '2026-11-12', o)).rejects.toThrow(/Escreva como/);
    await expect(resolverProblema(p, r.coord, r.id, a.problemas[0].id, a.problemas[0].versao, 'Trocou', '2026-11-13', o)).rejects.toThrow(/futuro/);
    await expect(resolverProblema(p, r.coord, r.id, a.problemas[0].id, a.problemas[0].versao, 'Trocou', '2026-11-01', o)).rejects.toThrow(/antes da abertura/);
    await resolverProblema(p, r.coord, r.id, a.problemas[0].id, a.problemas[0].versao, 'Trocou de fornecedor', '2026-11-12', o);
    a = (await lerAcompanhamento(p, r.coord, r.id, o))!;
    expect(a.problemas[0].solucao).toBe('Trocou de fornecedor');
    await expect(resolverProblema(p, r.coord, r.id, a.problemas[0].id, a.problemas[0].versao, 'De novo', '2026-11-12', o)).rejects.toThrow(/já foi resolvido/);
    await expect(registrarProblema(p, await como(p, FUNCIONARIO), r.id, { descricao: 'x', gravidade: 'baixo', dono: null }, o)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(registrarProblema(p, r.coord, r.id, { descricao: ' ', gravidade: 'baixo', dono: null }, o)).rejects.toThrow(/Descreva/);
    const aud = JSON.stringify(await auditoriaDe(p, a.problemas[0].id));
    expect(aud).not.toMatch(/fornecedor/i);
  });

  it('só com o projeto em implementação', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, { porte: 'enxuto' });
    await expect(registrarProblema(p, await como(p, COORDENACAO), r.id, { descricao: 'x', gravidade: 'baixo', dono: null }, o)).rejects.toThrow(/implementação/);
  });

  it('riscos continuam na implementação', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await registrarRisco(p, r.coord, r.id, { descricao: 'Chuva', probabilidade: 'medio', impacto: 'baixo', resposta: null, dono: null }, o);
    const a = (await lerAcompanhamento(p, r.coord, r.id, o))!;
    expect(a.riscos).toHaveLength(1);
    await encerrarRisco(p, r.coord, r.id, a.riscos[0].id, a.riscos[0].versao, o);
    await expect(registrarRisco(p, await como(p, FUNCIONARIO), r.id, { descricao: 'x', probabilidade: 'baixo', impacto: 'baixo', resposta: null, dono: null }, o)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('pedidos de mudança: custo', () => {
  it('dentro da tolerância se aplica sozinha, sem nova versão do Termo', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    const previa = await avaliarPedido(p, r.coord, r.id, custo(r.pessoal.id, '6300'));
    expect(previa.quem).toBe('Dentro da tolerância: você aplica.');
    expect(previa.frase).toMatch(/a linha sobe 5% de 10% permitidos; o total sobe 3% de 5% permitidos/);
    expect((await pedidos(p)).length).toBe(0);
    const res = await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '6300'), o);
    expect(res.situacao).toBe('aplicada');
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.pessoal.id)!.valor_planejado).toBe(6300);
    expect((await termos(p, r.id)).filter((t) => t.situacao === 'aprovado')).toHaveLength(1);
    expect((await pedidos(p))[0].situacao).toBe('aplicada');
    // Auditoria: só colunas, nunca a justificativa.
    expect(JSON.stringify(await auditoriaDe(p, (await pedidos(p))[0].id))).not.toMatch(/Preço subiu/);
  });

  it('fora da tolerância fica pendente, nada muda e, aprovada, gera nova versão do Termo', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    const res = await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7000'), o);
    expect(res.situacao).toBe('pendente');
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.pessoal.id)!.valor_planejado).toBe(6000);
    expect((await termos(p, r.id)).length).toBe(1);
    // Quem gerencia mas não é a Diretoria não decide.
    const ped = (await pedidos(p))[0];
    await expect(decidirMudanca(p, r.coord, ped.id, ped.versao, 'aprovar', 'Ok', o)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', ' ', o)).rejects.toThrow(/justificativa/);
    await decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', 'Aprovado.', o);
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.pessoal.id)!.valor_planejado).toBe(7000);
    const ts = await termos(p, r.id);
    expect(ts.map((t) => [t.numero, t.situacao]).sort()).toEqual([[1, 'substituido'], [2, 'aprovado']]);
    expect(JSON.parse(ts.find((t) => t.numero === 2)!.conteudo).valor_total).toBe(11000);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.valor_aprovado).toBe(11000);
    expect((await lerTabela(p, ProjetoOrcamento)).ativos().every((l) => l.projeto_id !== r.id || l.versao_termo === 2)).toBe(true);
    const fim = (await pedidos(p))[0];
    expect(fim.situacao).toBe('aprovada');
    expect(fim.versao_termo_nova).toBe(2);
    await expect(decidirMudanca(p, r.diretoria, fim.id, fim.versao, 'recusar', 'Tarde', o)).rejects.toThrow(/já foi decidido/);
  });

  it('recusar não muda nada', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await pedirMudanca(p, r.coord, r.id, custo(r.material.id, '5000'), o);
    const ped = (await pedidos(p))[0];
    await decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'recusar', 'Sem verba.', o);
    expect((await pedidos(p))[0].situacao).toBe('recusada');
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.material.id)!.valor_planejado).toBe(4000);
    expect((await termos(p, r.id)).length).toBe(1);
  });

  it('acima do limite de alçada, a Diretoria aprova e a Presidência ou o Conselho decide', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 10500 });
    const r = await emImplementacao(p);
    const previa = await avaliarPedido(p, r.coord, r.id, custo(r.pessoal.id, '7000'));
    expect(previa.exigeAlcada).toBe(true);
    await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7000'), o);
    let ped = (await pedidos(p))[0];
    await decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', 'Diretoria ok.', o);
    ped = (await pedidos(p))[0];
    expect(ped.situacao).toBe('aguardando_alcada');
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.pessoal.id)!.valor_planejado).toBe(6000);
    await expect(decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', 'De novo', o)).rejects.toThrow(/Presidência ou o Conselho/);
    const a = (await lerAcompanhamento(p, await como(p, ALCADA), r.id, o))!;
    expect(a.podeDecidirAlcada).toBe(true);
    await decidirMudanca(p, await como(p, ALCADA), ped.id, ped.versao, 'aprovar', 'Aprovado pela alçada.', o);
    expect((await pedidos(p))[0].situacao).toBe('aprovada');
    expect((await lerTabela(p, ProjetoOrcamento)).porId(r.pessoal.id)!.valor_planejado).toBe(7000);
    expect((await termos(p, r.id)).filter((t) => t.situacao === 'aprovado').map((t) => t.numero)).toEqual([2]);
  });

  it('a variação acumula sobre a última versão aprovada (regra 19)', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    expect((await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '6400'), o)).situacao).toBe('aplicada');
    // 6.400 -> 6.700 são só 4,7% sobre 6.400, mas 11,7% sobre os 6.000 aprovados.
    expect((await avaliarPedido(p, r.coord, r.id, custo(r.pessoal.id, '6700'))).avaliacao.dentro).toBe(false);
    expect((await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '6700'), o)).situacao).toBe('pendente');
  });

  it('confere linha, valor e justificativa; não repete pedido pendente', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await expect(pedirMudanca(p, r.coord, r.id, custo('inexistente', '100'), o)).rejects.toThrow(/linha do orçamento/);
    await expect(pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '6000'), o)).rejects.toThrow(/igual ao atual/);
    await expect(pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '-5'), o)).rejects.toThrow(/Valor/);
    await expect(pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7000', { justificativa: ' ' }), o)).rejects.toThrow(/justificativa/);
    await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7000'), o);
    await expect(pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7100'), o)).rejects.toThrow(/esperando decisão/);
  });
});

describe('pedidos de mudança: prazo e escopo', () => {
  it('prazo do projeto: dentro aplica e grava o fim; o acumulado passa a contar', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    expect((await pedirMudanca(p, r.coord, r.id, prazo('projeto', '2026-12-20'), o)).situacao).toBe('aplicada');
    expect((await lerTabela(p, Projetos)).porId(r.id)!.fim_previsto).toBe('2026-12-20');
    // +10 dias sobre o aprovado (10/12); mais 10 daria 20 dias, acima dos 15 permitidos.
    const previa = await avaliarPedido(p, r.coord, r.id, prazo('projeto', '2026-12-30'));
    expect(previa.avaliacao.variacao).toBe(20);
    expect(previa.avaliacao.dentro).toBe(false);
    expect(previa.frase).toBe('O prazo atrasa 20 dias de 15 dias permitidos.');
    const res = await pedirMudanca(p, r.coord, r.id, prazo('projeto', '2026-12-30'), o);
    expect(res.situacao).toBe('pendente');
    const ped = (await pedidos(p)).find((x) => x.situacao === 'pendente')!;
    await decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', 'Prazo novo.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.fim_previsto).toBe('2026-12-30');
    expect((await termos(p, r.id)).filter((t) => t.situacao === 'aprovado').map((t) => t.numero)).toEqual([2]);
  });

  it('prazo de uma atividade usa a tolerância de marco', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    expect((await pedirMudanca(p, r.coord, r.id, prazo(r.oficinas.id, '2026-12-16'), o)).situacao).toBe('aplicada');
    expect((await lerTabela(p, Atividades)).porId(r.oficinas.id)!.fim_previsto).toBe('2026-12-16');
    expect((await pedirMudanca(p, r.coord, r.id, prazo(r.comprar.id, '2026-11-29'), o)).situacao).toBe('pendente');
    await expect(pedirMudanca(p, r.coord, r.id, prazo(r.comprar.id, '2026-10-01', { justificativa: 'x' }), o)).rejects.toThrow(/antes do início/);
  });

  it('escopo sem escopo livre sempre vai para a Diretoria; com escopo livre e declarado, se aplica', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    const e = (x: Partial<DadosPedido> = {}): DadosPedido => ({ tipo: 'escopo', alvo: null, proposto: 'Escopo novo com uma oficina a mais', justificativa: 'Demanda.', ...x });
    expect((await pedirMudanca(p, r.coord, r.id, e({ cabeNoEscopoLivre: true }), o)).situacao).toBe('pendente');
    const ped = (await pedidos(p))[0];
    await decidirMudanca(p, r.diretoria, ped.id, ped.versao, 'aprovar', 'Pode.', o);
    const v2 = (await termos(p, r.id)).find((t) => t.situacao === 'aprovado')!;
    expect(JSON.parse(v2.conteudo).escopo).toBe('Escopo novo com uma oficina a mais');
    expect(JSON.parse(v2.conteudo).valor_total).toBe(10000);

    const q = await planilhasDeProjetos();
    await comBanca(q);
    const s = await emImplementacao(q, { ...termoBase, escopo_livre: 'Datas e local das oficinas' });
    expect((await pedirMudanca(q, s.coord, s.id, e({ proposto: 'Escopo inicial, oficinas em outro local', cabeNoEscopoLivre: false }), o)).situacao).toBe('pendente');
    const q2 = await planilhasDeProjetos();
    await comBanca(q2);
    const t = await emImplementacao(q2, { ...termoBase, escopo_livre: 'Datas e local das oficinas' });
    expect((await pedirMudanca(q2, t.coord, t.id, e({ proposto: 'Escopo inicial, oficinas em outro local', cabeNoEscopoLivre: true }), o)).situacao).toBe('aplicada');
    expect((await termos(q2, t.id)).length).toBe(1);
  });
});

describe('regra 13 e quem vê o quê', () => {
  it('sem implementação não há pedido nem relatório', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, { porte: 'enxuto' });
    const coord = await como(p, COORDENACAO);
    await expect(pedirMudanca(p, coord, r.id, prazo('projeto', '2026-12-20'), o)).rejects.toThrow(/implementação/);
    await expect(enviarRelatorio(p, coord, r.id, { periodoInicio: '2026-11-01', periodoFim: '2026-11-10', texto: 'x', gasto: null }, undefined, o)).rejects.toThrow(/implementação/);
  });

  it('só quem gerencia o projeto pede mudança, relata e registra', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    for (const email of [FUNCIONARIO, COORDENACAO_UR, LEITURA]) {
      const quem = await como(p, email);
      await expect(pedirMudanca(p, quem, r.id, prazo('projeto', '2026-12-20'), o)).rejects.toThrow();
      await expect(enviarRelatorio(p, quem, r.id, { periodoInicio: '2026-11-01', periodoFim: '2026-11-10', texto: 'x', gasto: null }, undefined, o)).rejects.toThrow();
    }
  });

  it('a equipe vê problemas e riscos, mas não pedidos, relatórios nem orçamento; quem não vê o projeto não lê nada', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await adicionarMembro(p, r.coord, r.id, LEITURA, 'Apoio', o);
    await registrarProblema(p, r.coord, r.id, { descricao: 'P', gravidade: 'medio', dono: null }, o);
    await pedirMudanca(p, r.coord, r.id, custo(r.pessoal.id, '7000'), o);
    const equipe = (await lerAcompanhamento(p, await como(p, LEITURA), r.id, o))!;
    expect(equipe.problemas).toHaveLength(1);
    expect(equipe.pedidos).toBeNull();
    expect(equipe.relatorios).toBeNull();
    expect(equipe.foraDaTolerancia).toBeNull();
    expect(equipe.linhas).toEqual([]);
    expect(equipe.podeAlterar).toBe(false);
    expect(await lerAcompanhamento(p, await como(p, COORDENACAO_UR), r.id, o)).toBeNull();
    const dir = (await lerAcompanhamento(p, r.diretoria, r.id, o))!;
    expect(dir.pedidos).toHaveLength(1);
    expect(dir.pedidos![0].frase).toMatch(/Custo: a linha sobe/);
    expect(dir.podeDecidir).toBe(true);
    const resp = (await lerAcompanhamento(p, r.coord, r.id, o))!;
    expect(resp.podeAlterar).toBe(true);
    expect(resp.podeDecidir).toBe(false);
  });
});

describe('relatório de monitoramento', () => {
  const rel = (x: Partial<Parameters<typeof enviarRelatorio>[3]> = {}) => ({ periodoInicio: '2026-11-01', periodoFim: '2026-11-12', texto: 'Tudo certo.', gasto: null, ...x });

  it('situação calculada: verde, amarelo com atividade atrasada, vermelho com problema alto', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await mudarSituacaoAtividade(p, r.coord, r.id, r.comprar.id, r.comprar.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
    let res = await enviarRelatorio(p, r.coord, r.id, rel({ periodoFim: '2026-11-12' }), undefined, o);
    expect(res.situacao).toBe('verde');
    expect(res.medidos).toBeNull();
    const [linha] = (await lerTabela(p, Relatorios)).ativos();
    expect(linha.planejado_pct).toBe(0);
    expect(linha.realizado_pct).toBe(50);
    expect(linha.orcamento_total).toBe(10000);
    await registrarProblema(p, r.coord, r.id, { descricao: 'Grave', gravidade: 'alto', dono: null }, o);
    res = await enviarRelatorio(p, r.coord, r.id, rel(), undefined, o);
    expect(res.situacao).toBe('vermelho');
    const p2 = await planilhasDeProjetos();
    await comBanca(p2);
    const s = await emImplementacao(p2);
    res = await enviarRelatorio(p2, s.coord, s.id, rel(), undefined, { agora: new Date('2026-11-25T15:00:00Z') });
    // a atividade "Comprar material" (fim 20/11) passou 5 dias, dentro dos 7 de marco: amarelo, não vermelho
    expect(res.situacao).toBe('amarelo');
  });

  it('fora da tolerância (atraso maior que o permitido) deixa vermelho', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    const res = await enviarRelatorio(p, r.coord, r.id, rel({ periodoFim: '2026-11-30' }), undefined, { agora: new Date('2026-12-01T15:00:00Z') });
    expect(res.situacao).toBe('vermelho');
    const [l] = (await lerTabela(p, Relatorios)).ativos();
    expect(l.fora_tolerancia).toBe(true);
    const a = (await lerAcompanhamento(p, r.coord, r.id, { agora: new Date('2026-12-01T15:00:00Z') }))!;
    expect(a.foraDaTolerancia!.join(' ')).toMatch(/atrasada há 11 dias/);
  });

  it('gasto acima do aprovado, mais a tolerância, deixa vermelho', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await mudarSituacaoAtividade(p, r.coord, r.id, r.comprar.id, r.comprar.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
    expect((await enviarRelatorio(p, r.coord, r.id, rel({ gasto: '10.400,00' }), undefined, o)).situacao).toBe('verde');
    expect((await enviarRelatorio(p, r.coord, r.id, rel({ gasto: '10.600,00' }), undefined, o)).situacao).toBe('vermelho');
  });

  it('o responsável pode piorar com justificativa, nunca melhorar', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await mudarSituacaoAtividade(p, r.coord, r.id, r.comprar.id, r.comprar.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
    await expect(enviarRelatorio(p, r.coord, r.id, rel({ situacao: 'amarelo' }), undefined, o)).rejects.toThrow(/explique o motivo/);
    const res = await enviarRelatorio(p, r.coord, r.id, rel({ situacao: 'amarelo', justificativa: 'Equipe reduzida.' }), undefined, o);
    expect(res.situacao).toBe('amarelo');
    const l = (await lerTabela(p, Relatorios)).ativos()[0];
    expect([l.situacao_calculada, l.situacao, l.justificativa]).toEqual(['verde', 'amarelo', 'Equipe reduzida.']);
    await registrarProblema(p, r.coord, r.id, { descricao: 'Grave', gravidade: 'alto', dono: null }, o);
    await expect(enviarRelatorio(p, r.coord, r.id, rel({ situacao: 'verde' }), undefined, o)).rejects.toThrow(/não pode ser melhor/);
  });

  it('confere período e texto; auditoria sem o texto do relatório', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await emImplementacao(p);
    await expect(enviarRelatorio(p, r.coord, r.id, rel({ periodoInicio: '2026-11-20', periodoFim: '2026-11-10' }), undefined, o)).rejects.toThrow(/antes do início/);
    await expect(enviarRelatorio(p, r.coord, r.id, rel({ periodoFim: '2026-11-30' }), undefined, o)).rejects.toThrow(/futuro/);
    await expect(enviarRelatorio(p, r.coord, r.id, rel({ texto: ' ' }), undefined, o)).rejects.toThrow(/o que aconteceu/);
    await enviarRelatorio(p, r.coord, r.id, rel({ texto: 'Texto sigiloso do relatório' }), undefined, o);
    const [l] = (await lerTabela(p, Relatorios)).ativos();
    expect(JSON.stringify(await auditoriaDe(p, l.id))).not.toMatch(/sigiloso/);
  });
});
