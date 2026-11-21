import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { avancarFase, lerFase, registrarRisco, salvarDocumento, adicionarItemMarco } from '../aplicacao/fases';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { adicionarAtividade, adicionarLinhaOrcamento, alterarAtividade, alterarLinhaOrcamento, iniciarImplementacao, lancarAndamento, resumoDoOrcamento, retirarAtividade, retirarLinhaOrcamento } from '../aplicacao/planejamento';
import { aceitaCompra } from '../dominio/projeto';
import { andamentoPercentual, conferirAndamento, conferirLinhaOrcamento, conferirPlanoAtividade, estaAtrasada, dataValida, totalOrcamento } from '../dominio/planejamento';
import { itensDaFase } from '../dominio/fases';
import { Atividades, Portas, ProjetoOrcamento, Projetos } from '../dados/tabelas';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, TECNICO, comBanca, comPortaAberta, como, planilhasDeProjetos, todosPareceres, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const texto = (descricao = 'Texto fictício.') => ({ descricao });
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };
const atividade = (x = {}) => ({ descricao: 'Montar a sala', responsavel: FUNCIONARIO, inicioPrevisto: '2026-11-01', fimPrevisto: '2026-11-30', peso: null, ...x });
const linha = (x = {}) => ({ categoria: 'Materiais', descricao: 'Tinta e pincéis', valorPlanejado: 2500, fonte: 'Recurso próprio', ...x });

/** Projeto enxuto com o Termo aprovado: está na fase 3. */
async function naFase3(p: P) {
  await comBanca(p);
  const r = await comPortaAberta(p, { porte: 'enxuto' });
  const coord = await como(p, COORDENACAO);
  const dir = await como(p, DIRETORIA);
  await darParecer(p, await como(p, TECNICO), r.portaId, 'tecnico', 'satisfatorio', null, o);
  await decidirPorta(p, dir, r.portaId, (await lerTabela(p, Portas)).porId(r.portaId)!.versao, 'seguir', 'Segue.', o);
  await salvarDocumento(p, coord, r.id, 'proposta', texto(), true, null, o);
  await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
  await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
  const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
  await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
  await decidirPorta(p, dir, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Autorizo.', o);
  expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_3');
  return { r, coord, dir };
}

describe('domínio: planejamento', () => {
  it('fase 3 por porte', () => {
    expect(itensDaFase('enxuto', 3)).toEqual(['atividades']);
    expect(itensDaFase('completo', 3)).toContain('orcamento');
  });

  it('atividade atrasada é calculada: fim passado e ainda aberta', () => {
    expect(estaAtrasada({ situacao: 'a_fazer', fim_previsto: '2026-11-01' }, '2026-11-02')).toBe(true);
    expect(estaAtrasada({ situacao: 'em_andamento', fim_previsto: '2026-11-02' }, '2026-11-02')).toBe(false);
    expect(estaAtrasada({ situacao: 'concluida', fim_previsto: '2026-11-01' }, '2026-11-02')).toBe(false);
    expect(estaAtrasada({ situacao: 'cancelada', fim_previsto: '2026-11-01' }, '2026-11-02')).toBe(false);
  });

  it('confere datas, responsável e peso', () => {
    expect(dataValida('2026-02-30')).toBe(false);
    expect(() => conferirPlanoAtividade(atividade({ descricao: ' ' }))).toThrow(/Descreva/);
    expect(() => conferirPlanoAtividade(atividade({ responsavel: '' }))).toThrow(/responsável/);
    expect(() => conferirPlanoAtividade(atividade({ inicioPrevisto: '' }))).toThrow(/início/);
    expect(() => conferirPlanoAtividade(atividade({ fimPrevisto: '2026-10-01' }))).toThrow(/antes do início/);
    expect(() => conferirPlanoAtividade(atividade({ peso: 0 }))).toThrow(/peso/);
  });

  it('concluir exige a data real; data real não vai para o futuro', () => {
    expect(() => conferirAndamento({ situacao: 'concluida', inicioReal: null, fimReal: null }, '2026-11-12')).toThrow(/data real de fim/);
    expect(() => conferirAndamento({ situacao: 'em_andamento', inicioReal: null, fimReal: '2026-11-10' }, '2026-11-12')).toThrow(/só vale/);
    expect(() => conferirAndamento({ situacao: 'concluida', inicioReal: null, fimReal: '2026-11-13' }, '2026-11-12')).toThrow(/futuro/);
    expect(() => conferirAndamento({ situacao: 'concluida', inicioReal: '2026-11-11', fimReal: '2026-11-10' }, '2026-11-12')).toThrow(/antes/);
    expect(conferirAndamento({ situacao: 'concluida', inicioReal: null, fimReal: '2026-11-10' }, '2026-11-12').fimReal).toBe('2026-11-10');
  });

  it('andamento pelo peso e total do orçamento', () => {
    expect(andamentoPercentual([])).toBeNull();
    expect(andamentoPercentual([{ situacao: 'concluida', peso: 3 }, { situacao: 'a_fazer', peso: 1 }, { situacao: 'cancelada', peso: 10 }])).toBe(75);
    expect(totalOrcamento([{ valor_planejado: 0.1 }, { valor_planejado: 0.2 }])).toBe(0.3);
    expect(() => conferirLinhaOrcamento(linha({ valorPlanejado: -1 }))).toThrow(/maior que zero|igual ou maior/);
    expect(() => conferirLinhaOrcamento(linha({ categoria: '' }))).toThrow(/categoria/);
    expect(resumoDoOrcamento([{ valor_planejado: 12000 }], 10000).diferenca).toBe(2000);
  });
});

describe('fase 3: atividades', () => {
  it('quem gerencia cadastra, altera e retira; a lista soma ao porte; auditoria só com colunas', async () => {
    const p = await planilhasDeProjetos();
    const { r, coord } = await naFase3(p);
    await adicionarAtividade(p, coord, r.id, atividade(), o);
    const [a] = (await lerTabela(p, Atividades)).ativos();
    expect(a).toMatchObject({ situacao: 'a_fazer', responsavel: FUNCIONARIO });
    await alterarAtividade(p, coord, r.id, a.id, a.versao, atividade({ descricao: 'Montar a sala nova' }), o);
    const atual = (await lerTabela(p, Atividades)).porId(a.id)!;
    expect(atual.descricao).toBe('Montar a sala nova');
    const audit = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.registro_id === a.id);
    expect(audit.length).toBe(2);
    expect(JSON.stringify(audit)).not.toContain('Montar a sala');
    await retirarAtividade(p, coord, r.id, a.id, atual.versao, o);
    expect((await lerTabela(p, Atividades)).porId(a.id)!.ativo).toBe(false);
    expect((await lerFase(p, coord, r.id))!.atividades).toHaveLength(0);
  });

  it('recusa responsável sem acesso à plataforma e atividade de outro projeto', async () => {
    const p = await planilhasDeProjetos();
    const { r, coord } = await naFase3(p);
    await expect(adicionarAtividade(p, coord, r.id, atividade({ responsavel: 'ninguem@exemplo.local' }), o)).rejects.toThrow(/acesso à plataforma/);
    await expect(alterarAtividade(p, coord, r.id, 'inexistente', 1, atividade(), o)).rejects.toThrow(/não encontrada/);
  });

  it('quem não gerencia não altera: proponente, equipe de outro escopo e leitura', async () => {
    const p = await planilhasDeProjetos();
    const { r } = await naFase3(p);
    for (const email of [FUNCIONARIO, COORDENACAO_UR, LEITURA]) {
      await expect(adicionarAtividade(p, await como(p, email), r.id, atividade())).rejects.toBeInstanceOf(Error);
      await expect(adicionarLinhaOrcamento(p, await como(p, email), r.id, linha())).rejects.toBeInstanceOf(Error);
    }
    // A Diretoria decide nas portas, mas não altera o planejamento de quem é responsável.
    await expect(adicionarAtividade(p, await como(p, DIRETORIA), r.id, atividade())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('andamento: concluir exige data real e entra no cálculo de atrasada', async () => {
    const p = await planilhasDeProjetos();
    const { r, coord } = await naFase3(p);
    await adicionarAtividade(p, coord, r.id, atividade({ fimPrevisto: '2026-11-05' }), o);
    const a = (await lerTabela(p, Atividades)).ativos()[0];
    await expect(lancarAndamento(p, coord, r.id, a.id, a.versao, { situacao: 'concluida', inicioReal: null, fimReal: null }, o)).rejects.toThrow(/data real/);
    await lancarAndamento(p, coord, r.id, a.id, a.versao, { situacao: 'concluida', inicioReal: '2026-11-02', fimReal: '2026-11-04' }, o);
    const depois = (await lerTabela(p, Atividades)).porId(a.id)!;
    expect(depois).toMatchObject({ situacao: 'concluida', fim_real: '2026-11-04' });
    await expect(lancarAndamento(p, await como(p, FUNCIONARIO), r.id, a.id, depois.versao, { situacao: 'a_fazer', inicioReal: null, fimReal: null }, o)).rejects.toBeInstanceOf(Error);
  });
});

describe('fase 3: orçamento do projeto', () => {
  it('soma as linhas, compara com o Termo e grava a versão do Termo', async () => {
    const p = await planilhasDeProjetos();
    const { r, coord } = await naFase3(p);
    await adicionarLinhaOrcamento(p, coord, r.id, linha(), o);
    await adicionarLinhaOrcamento(p, coord, r.id, linha({ categoria: 'Pessoal', descricao: 'Oficineiro', valorPlanejado: 7500.5 }), o);
    const f = (await lerFase(p, coord, r.id))!;
    const resumo = resumoDoOrcamento(f.orcamento, 10000);
    expect(resumo.total).toBe(10000.5);
    expect(resumo.diferenca).toBe(0.5);
    expect(f.orcamento.every((l) => l.versao_termo === 1)).toBe(true);
    const l = f.orcamento[0];
    await alterarLinhaOrcamento(p, coord, r.id, l.id, l.versao, linha({ valorPlanejado: 100 }), o);
    const nova = (await lerTabela(p, ProjetoOrcamento)).porId(l.id)!;
    await retirarLinhaOrcamento(p, coord, r.id, l.id, nova.versao, o);
    expect((await lerFase(p, coord, r.id))!.orcamento).toHaveLength(1);
    await expect(adicionarLinhaOrcamento(p, coord, r.id, linha({ valorPlanejado: -5 }), o)).rejects.toThrow();
  });
});

describe('fim da fase 3', () => {
  it('enxuto: só inicia a implementação com a atividade cadastrada; porta 3 fica desligada', async () => {
    const p = await planilhasDeProjetos();
    const { r, coord } = await naFase3(p);
    expect((await lerFase(p, coord, r.id))!.podeIniciarImplementacao).toBe(false);
    await expect(iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o)).rejects.toThrow(/atividades/);
    await adicionarAtividade(p, coord, r.id, atividade(), o);
    await expect(abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o)).rejects.toThrow(/desligada/);
    await expect(iniciarImplementacao(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id), o)).rejects.toBeInstanceOf(ErroPermissao);
    expect((await lerFase(p, coord, r.id))!.podeIniciarImplementacao).toBe(true);
    await iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('implementacao');
    expect(aceitaCompra('implementacao')).toBe(true);
    // Na implementação o planejamento fica travado; o andamento continua valendo.
    await expect(adicionarAtividade(p, coord, r.id, atividade(), o)).rejects.toThrow(/fase correspondente/);
    await expect(adicionarLinhaOrcamento(p, coord, r.id, linha(), o)).rejects.toThrow();
    const a = (await lerTabela(p, Atividades)).ativos()[0];
    await lancarAndamento(p, coord, r.id, a.id, a.versao, { situacao: 'em_andamento', inicioReal: '2026-11-02', fimReal: null }, o);
  });

  it('completo: porta 3 com os pareceres e a decisão da Diretoria leva à implementação; ajustar volta à fase 3', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, {});
    const coord = await como(p, COORDENACAO);
    const dir = await como(p, DIRETORIA);
    await todosPareceres(p, r.portaId);
    await decidirPorta(p, dir, r.portaId, (await lerTabela(p, Portas)).porId(r.portaId)!.versao, 'seguir', 'Segue.', o);
    const docs1 = [['necessidade', texto()], ['partes_interessadas', { quem: 'Famílias' }], ['problema_objetivos', { problema: 'P', objetivo: 'O' }], ['estimativas', { valor_total: '10000', duracao: '6 meses' }], ['proposta', texto()]] as const;
    for (const [t, c] of docs1) await salvarDocumento(p, coord, r.id, t, c, true, null, o);
    const novo = (nivel: 'impacto' | 'objetivo' | 'resultado' | 'atividade', acima: string | null) => ({ nivel, descricao: nivel, indicador: nivel === 'atividade' ? null : 'i', fonteVerificacao: nivel === 'atividade' ? null : 'f', pressuposto: null, acima });
    const idDe = async (n: string) => (await lerTabela(p, (await import('../dados/tabelas')).MarcoLogico)).ativos().find((i) => i.nivel === n)!.id;
    await adicionarItemMarco(p, coord, r.id, novo('impacto', null), o);
    await adicionarItemMarco(p, coord, r.id, novo('objetivo', await idDe('impacto')), o);
    await adicionarItemMarco(p, coord, r.id, novo('resultado', await idDe('objetivo')), o);
    await adicionarItemMarco(p, coord, r.id, novo('atividade', await idDe('resultado')), o);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
    await salvarDocumento(p, coord, r.id, 'lancamento', texto(), true, null, o);
    await registrarRisco(p, coord, r.id, { descricao: 'Atraso', probabilidade: 'medio', impacto: 'alto', resposta: null, dono: null }, o);
    const porta2 = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    await todosPareceres(p, porta2.portaId);
    await decidirPorta(p, dir, porta2.portaId, (await lerTabela(p, Portas)).porId(porta2.portaId)!.versao, 'seguir', 'Autorizo.', o);

    await expect(iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o)).rejects.toThrow(/porta 3/);
    await expect(abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o)).rejects.toThrow(/atividades|orçamento/);
    await adicionarAtividade(p, coord, r.id, atividade(), o);
    await adicionarLinhaOrcamento(p, coord, r.id, linha({ valorPlanejado: 10000 }), o);
    for (const t of ['monitoramento', 'comunicacao', 'compras', 'sustentabilidade'] as const) {
      const c = { monitoramento: { como: 'x', avaliacao: 'y' }, comunicacao: { plano: 'x' }, compras: { plano: 'x' }, sustentabilidade: { sustentabilidade: 'x', encerramento: 'y' } }[t];
      await salvarDocumento(p, coord, r.id, t, c, true, null, o);
    }
    expect((await lerFase(p, coord, r.id))!.podeAbrirPorta3).toBe(true);
    const porta3 = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    const reg = (await lerTabela(p, Portas)).porId(porta3.portaId)!;
    expect(reg).toMatchObject({ tipo: 'plano', valor_considerado: 10000 });
    // Porta aberta: o planejamento fica travado.
    await expect(adicionarAtividade(p, coord, r.id, atividade(), o)).rejects.toThrow(/porta está aberta/);
    await todosPareceres(p, porta3.portaId);
    await decidirPorta(p, dir, porta3.portaId, reg.versao, 'ajustar', 'Ajuste o cronograma.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_3');
    await adicionarAtividade(p, coord, r.id, atividade({ descricao: 'Outra' }), o);
    const porta3b = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    await todosPareceres(p, porta3b.portaId);
    await decidirPorta(p, dir, porta3b.portaId, (await lerTabela(p, Portas)).porId(porta3b.portaId)!.versao, 'seguir', 'Plano aprovado.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('implementacao');
  });
});
