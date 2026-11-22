import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { adicionarMembro, avancarFase, iniciarImplementacao, lerFase, salvarDocumento } from '../aplicacao/fases';
import { projetosParaCompra } from '../aplicacao/ligacao';
import {
  adicionarAtividade,
  adicionarLinhaOrcamento,
  alterarAtividade,
  alterarLinhaOrcamento,
  lerPlanejamento,
  mudarSituacaoAtividade,
  retirarAtividade,
  retirarLinhaOrcamento,
  type DadosAtividade,
} from '../aplicacao/planejamento';
import { abrirPorta, darParecer, decidirPorta, lerFicha } from '../aplicacao/portas';
import { Atividades, Portas, ProjetoOrcamento, Projetos } from '../dados/tabelas';
import { itensDaFase } from '../dominio/fases';
import { andamentoPct, conferirPrazos, situacaoExibida, subtotaisPorCategoria, totalOrcamento } from '../dominio/planejamento';
import { destinoDaDecisao, usaPortaDoPlano } from '../dominio/projeto';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FINANCEIRO, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, comPortaAberta, como, planilhasDeProjetos, todosPareceres, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };

/** Projeto enxuto na fase 3 (Termo aprovado pela porta 2). */
async function naFase3(p: P, extra: Parameters<typeof comPortaAberta>[1] = { porte: 'enxuto' }) {
  const r = await comPortaAberta(p, extra);
  const coord = await como(p, COORDENACAO);
  const diretoria = await como(p, DIRETORIA);
  const decidir = async (portaId: string) => {
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
    await decidirPorta(p, diretoria, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Segue.', o);
  };
  if (extra.porte === 'completo') throw new Error('use naFase3Completo');
  await decidir(r.portaId);
  await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto' }, true, null, o);
  await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
  await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
  const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
  await decidir(portaId);
  return { ...r, coord };
}

const atividade = (x: Partial<DadosAtividade> = {}): DadosAtividade => ({ descricao: 'Comprar material', responsavel: FUNCIONARIO, inicioPrevisto: '2026-12-01', fimPrevisto: '2026-12-10', peso: null, ...x });
const linha = { categoria: 'Material', descricao: 'Livros', valor: '1.500,50', fonte: null };

describe('domínio: planejamento', () => {
  it('a fase 3 exige atividades e orçamento; o completo exige mais', () => {
    expect(itensDaFase('enxuto', 3)).toEqual(['atividades', 'orcamento']);
    expect(itensDaFase('completo', 3)).toContain('monitoramento');
    expect(usaPortaDoPlano('completo')).toBe(true);
    expect(usaPortaDoPlano('enxuto')).toBe(false);
  });

  it('atrasada é calculada: fim passado e atividade ainda aberta', () => {
    const a = { situacao: 'a_fazer' as const, fim_previsto: '2026-11-10' };
    expect(situacaoExibida(a, '2026-11-12')).toBe('atrasada');
    expect(situacaoExibida(a, '2026-11-10')).toBe('a_fazer');
    expect(situacaoExibida({ ...a, situacao: 'em_andamento' }, '2026-11-12')).toBe('atrasada');
    expect(situacaoExibida({ ...a, situacao: 'concluida' }, '2026-11-12')).toBe('concluida');
    expect(situacaoExibida({ ...a, situacao: 'cancelada' }, '2026-11-12')).toBe('cancelada');
  });

  it('prazos: data válida e fim depois do início', () => {
    expect(() => conferirPrazos('2026-02-30', '2026-03-01')).toThrow(/data válida/);
    expect(() => conferirPrazos('2026-03-02', '2026-03-01')).toThrow(/antes do início/);
    expect(conferirPrazos('2026-03-01', '2026-03-01')).toEqual({ inicioPrevisto: '2026-03-01', fimPrevisto: '2026-03-01' });
  });

  it('soma sem erro de centavos, subtotais e andamento pelo peso', () => {
    expect(totalOrcamento([{ valor_planejado: 0.1 }, { valor_planejado: 0.2 }])).toBe(0.3);
    expect(subtotaisPorCategoria([{ categoria: 'A', valor_planejado: 1 }, { categoria: 'B', valor_planejado: 2 }, { categoria: 'A', valor_planejado: 3 }])).toEqual([
      { categoria: 'A', total: 4 },
      { categoria: 'B', total: 2 },
    ]);
    expect(andamentoPct([{ situacao: 'concluida', peso: 3 }, { situacao: 'a_fazer', peso: 1 }, { situacao: 'cancelada', peso: 9 }])).toBe(75);
    expect(andamentoPct([])).toBe(0);
  });

  it('porta 3: seguir leva à implementação, ajustar volta à fase 3, parar para', () => {
    expect(destinoDaDecisao('diretoria', 'seguir', false, 'plano').etapa).toBe('implementacao');
    expect(destinoDaDecisao('diretoria', 'ajustar', false, 'plano').etapa).toBe('fase_3');
    expect(destinoDaDecisao('diretoria', 'parar', false, 'plano').etapa).toBe('parado');
  });
});

describe('atividades', () => {
  it('cadastra com prazos e responsável, mostra "Atrasada" e audita só as colunas', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    await adicionarAtividade(p, r.coord, r.id, atividade({ descricao: 'Já venceu', inicioPrevisto: '2026-10-01', fimPrevisto: '2026-11-01', peso: '2' }), o);
    const l = (await lerPlanejamento(p, r.coord, r.id, o))!;
    expect(l.atividades.map((a) => [a.descricao, a.exibida])).toEqual([
      ['Já venceu', 'atrasada'],
      ['Comprar material', 'a_fazer'],
    ]);
    const aud = (await auditoriaDe(p, l.atividades[0].id)).at(-1)!;
    expect(aud.detalhes).not.toContain('Já venceu');
  });

  it('recusa dados incompletos, pessoa sem acesso e datas trocadas', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await expect(adicionarAtividade(p, r.coord, r.id, atividade({ descricao: ' ' }))).rejects.toThrow(/Descreva/);
    await expect(adicionarAtividade(p, r.coord, r.id, atividade({ responsavel: '' }))).rejects.toThrow(/responsável/);
    await expect(adicionarAtividade(p, r.coord, r.id, atividade({ responsavel: 'ninguem@exemplo.local' }))).rejects.toThrow(/acesso/);
    await expect(adicionarAtividade(p, r.coord, r.id, atividade({ inicioPrevisto: '2026-12-10', fimPrevisto: '2026-12-01' }))).rejects.toThrow(/antes do início/);
    await expect(adicionarAtividade(p, r.coord, r.id, atividade({ peso: '-1' }))).rejects.toThrow(/Peso/);
  });

  it('concluir exige a data real; a data não pode estar no futuro; versão velha dá conflito', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    const a = (await lerTabela(p, Atividades)).ativos()[0];
    await expect(mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'concluida' }, o)).rejects.toThrow(/data/);
    await expect(mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'concluida', fimReal: '2027-01-01' }, o)).rejects.toThrow(/futuro/);
    await mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'concluida', fimReal: '2026-11-11' }, o);
    const depois = (await lerTabela(p, Atividades)).porId(a.id)!;
    expect(depois).toMatchObject({ situacao: 'concluida', fim_real: '2026-11-11', inicio_real: '2026-11-11' });
    await expect(mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'em_andamento' }, o)).rejects.toThrow();
    await mudarSituacaoAtividade(p, r.coord, r.id, a.id, depois.versao, { situacao: 'em_andamento' }, o);
    expect((await lerTabela(p, Atividades)).porId(a.id)).toMatchObject({ situacao: 'em_andamento', fim_real: null });
  });

  it('altera e retira (fica inativa, nada é apagado)', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    const a = (await lerTabela(p, Atividades)).ativos()[0];
    await alterarAtividade(p, r.coord, r.id, a.id, a.versao, atividade({ descricao: 'Outra' }), o);
    const b = (await lerTabela(p, Atividades)).porId(a.id)!;
    await retirarAtividade(p, r.coord, r.id, a.id, b.versao, o);
    expect((await lerTabela(p, Atividades)).porId(a.id)!.ativo).toBe(false);
    expect((await lerPlanejamento(p, r.coord, r.id, o))!.atividades).toHaveLength(0);
  });

  it('só quem gerencia o projeto altera; outras coordenações, funcionário e leitura não', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    for (const quem of [FUNCIONARIO, COORDENACAO_UR, LEITURA, FINANCEIRO]) {
      await expect(adicionarAtividade(p, await como(p, quem), r.id, atividade())).rejects.toBeInstanceOf(Error);
    }
    await expect(adicionarAtividade(p, await como(p, DIRETORIA), r.id, atividade())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('a equipe vê as atividades mas não o orçamento nem altera', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    await adicionarLinhaOrcamento(p, r.coord, r.id, linha, o);
    await adicionarMembro(p, r.coord, r.id, LEITURA, 'Apoio', o);
    const equipe = await como(p, LEITURA);
    const l = (await lerPlanejamento(p, equipe, r.id, o))!;
    expect(l.atividades).toHaveLength(1);
    expect(l.orcamento).toBeNull();
    expect(l.podeAlterarAtividades).toBe(false);
    await expect(adicionarAtividade(p, equipe, r.id, atividade())).rejects.toBeInstanceOf(ErroPermissao);
    const resp = (await lerPlanejamento(p, r.coord, r.id, o))!;
    expect(resp.orcamento?.total).toBe(1500.5);
  });

  it('quem não vê o projeto não lê nada', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    expect(await lerPlanejamento(p, await como(p, COORDENACAO_UR), r.id, o)).toBeNull();
  });

  it('antes da fase 3 não se cadastra atividade', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, { porte: 'enxuto' });
    await expect(adicionarAtividade(p, await como(p, COORDENACAO), r.id, atividade())).rejects.toThrow();
  });
});

describe('orçamento do projeto', () => {
  it('soma as linhas, guarda a versão do Termo e audita sem valores', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarLinhaOrcamento(p, r.coord, r.id, linha, o);
    await adicionarLinhaOrcamento(p, r.coord, r.id, { categoria: 'Pessoal', descricao: 'Oficineira', valor: 3000, fonte: 'Recurso próprio' }, o);
    const l = (await lerPlanejamento(p, r.coord, r.id, o))!;
    expect(l.orcamento).toMatchObject({ total: 4500.5, valorAprovado: 10000 });
    expect(l.orcamento!.porCategoria).toEqual([{ categoria: 'Material', total: 1500.5 }, { categoria: 'Pessoal', total: 3000 }]);
    expect(l.orcamento!.linhas[0].versao_termo).toBe(1);
    const aud = (await auditoriaDe(p, l.orcamento!.linhas[0].id)).at(-1)!;
    expect(aud.detalhes).not.toContain('Livros');
  });

  it('recusa linha sem categoria, sem descrição ou com valor inválido; altera e retira', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await expect(adicionarLinhaOrcamento(p, r.coord, r.id, { ...linha, categoria: '' })).rejects.toThrow(/categoria/);
    await expect(adicionarLinhaOrcamento(p, r.coord, r.id, { ...linha, descricao: '' })).rejects.toThrow(/Descreva/);
    await expect(adicionarLinhaOrcamento(p, r.coord, r.id, { ...linha, valor: '-5' })).rejects.toThrow(/Valor/);
    await expect(adicionarLinhaOrcamento(p, r.coord, r.id, { ...linha, valor: '' })).rejects.toThrow(/Valor/);
    await adicionarLinhaOrcamento(p, r.coord, r.id, linha, o);
    const x = (await lerTabela(p, ProjetoOrcamento)).ativos()[0];
    await alterarLinhaOrcamento(p, r.coord, r.id, x.id, x.versao, { ...linha, valor: 100 }, o);
    const y = (await lerTabela(p, ProjetoOrcamento)).porId(x.id)!;
    expect(y.valor_planejado).toBe(100);
    await retirarLinhaOrcamento(p, r.coord, r.id, x.id, y.versao, o);
    expect((await lerPlanejamento(p, r.coord, r.id, o))!.orcamento!.total).toBe(0);
  });

  it('só quem gerencia altera', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    for (const quem of [FUNCIONARIO, COORDENACAO_UR, LEITURA]) {
      await expect(adicionarLinhaOrcamento(p, await como(p, quem), r.id, linha)).rejects.toBeInstanceOf(Error);
    }
    await expect(adicionarLinhaOrcamento(p, await como(p, DIRETORIA), r.id, linha)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('fim da fase 3 e início da implementação', () => {
  it('enxuto: sem atividade e orçamento não inicia; com tudo pronto inicia direto (sem porta 3)', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    let f = (await lerFase(p, r.coord, r.id))!;
    expect(f.fase).toBe(3);
    expect(f.itens.map((i) => [i.item, i.pronto])).toEqual([['atividades', false], ['orcamento', false]]);
    expect(f.podeIniciarImplementacao).toBe(false);
    await expect(iniciarImplementacao(p, r.coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/falta na fase 3/);
    await expect(abrirPorta(p, r.coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/enxuto/);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    await adicionarLinhaOrcamento(p, r.coord, r.id, linha, o);
    f = (await lerFase(p, r.coord, r.id))!;
    expect(f.podeIniciarImplementacao).toBe(true);
    expect(f.podeAbrirPorta3).toBe(false);
    await expect(iniciarImplementacao(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id))).rejects.toBeInstanceOf(ErroPermissao);
    await iniciarImplementacao(p, r.coord, r.id, await versaoDe(p, r.id), o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('implementacao');
    // na implementação as atividades continuam mudando, o orçamento não
    expect((await lerPlanejamento(p, r.coord, r.id, o))).toMatchObject({ podeAlterarAtividades: true, podeAlterarOrcamento: false });
    await adicionarAtividade(p, r.coord, r.id, atividade({ descricao: 'Nova' }), o);
    await expect(adicionarLinhaOrcamento(p, r.coord, r.id, linha)).rejects.toThrow();
  });

  it('completo: passa pela porta 3 e, com "seguir", entra em implementação; só então aceita compra', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    // atalho: leva um projeto completo à fase 3 pelos mesmos casos de uso do enxuto e troca o porte
    const r = await naFase3(p);
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    await atualizar(p, Projetos, r.id, await versaoDe(p, r.id), { porte: 'completo' }, { email: DIRETORIA, agora: () => AGORA });
    const coord = r.coord;
    await adicionarAtividade(p, coord, r.id, atividade(), o);
    await adicionarLinhaOrcamento(p, coord, r.id, linha, o);
    await expect(iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/porta 3/);
    await expect(abrirPorta(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/complete/);
    for (const t of ['monitoramento', 'comunicacao', 'compras', 'sustentabilidade'] as const) await salvarDocumento(p, coord, r.id, t, { descricao: 'Texto' }, true, null, o);
    expect((await lerFase(p, coord, r.id))!.podeAbrirPorta3).toBe(true);
    const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    const porta = (await lerTabela(p, Portas)).porId(portaId)!;
    expect(porta).toMatchObject({ tipo: 'plano', valor_considerado: 10000 });
    await todosPareceres(p, portaId);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, porta.versao, 'seguir', 'Plano aprovado.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('implementacao');
    const ficha = (await lerFicha(p, coord, r.id))!;
    expect(ficha.portas.map((d) => d.porta.tipo)).toEqual(['ideia', 'termo', 'plano']);
  });

  it('as atividades abertas aparecem para a requisição de compra', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase3(p);
    await adicionarAtividade(p, r.coord, r.id, atividade(), o);
    await adicionarAtividade(p, r.coord, r.id, atividade({ descricao: 'Feita' }), o);
    await adicionarLinhaOrcamento(p, r.coord, r.id, linha, o);
    const feita = (await lerTabela(p, Atividades)).ativos().find((a) => a.descricao === 'Feita')!;
    await mudarSituacaoAtividade(p, r.coord, r.id, feita.id, feita.versao, { situacao: 'concluida', fimReal: '2026-11-11' }, o);
    await iniciarImplementacao(p, r.coord, r.id, await versaoDe(p, r.id), o);
    const lig = await projetosParaCompra(p, r.coord);
    const projeto = (lig as unknown as { dados: { id: string; atividades: { descricao: string }[] }[] }).dados.find((x) => x.id === r.id)!;
    expect(projeto.atividades.map((a) => a.descricao)).toEqual(['Comprar material']);
  });
});
