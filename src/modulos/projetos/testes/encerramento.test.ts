import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { abrirPortaDeEncerramento, consultarLicoes, iniciarEncerramento, lerEncerramento, marcarChecklist, registrarLicao, salvarTextoDeEncerramento } from '../aplicacao/encerramento';
import { registrarProblema, resolverProblema } from '../aplicacao/acompanhamento';
import { adicionarMembro, avancarFase, iniciarImplementacao, salvarDocumento } from '../aplicacao/fases';
import { adicionarAtividade, adicionarLinhaOrcamento, mudarSituacaoAtividade } from '../aplicacao/planejamento';
import { cancelarProjeto } from '../aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta, lerFicha } from '../aplicacao/portas';
import { Atividades, Encerramento, Portas, Problemas, Projetos } from '../dados/tabelas';
import { CATEGORIAS_LICAO, DIAS_ENCERRAMENTO_PADRAO, encerramentoAtrasado, faltaParaEncerrar, licaoCombina } from '../dominio/encerramento';
import { destinoDaDecisao } from '../dominio/projeto';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, comPortaAberta, como, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };
const licao = { categoria: 'execucao' as const, oQueAconteceu: 'Material chegou tarde.', fazerDiferente: 'Comprar com um mês de folga.' };

async function emImplementacao(p: P) {
  await comBanca(p);
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
  await adicionarAtividade(p, coord, r.id, { descricao: 'Oficinas', responsavel: FUNCIONARIO, inicioPrevisto: '2026-11-01', fimPrevisto: '2026-11-20', peso: null }, o);
  await adicionarLinhaOrcamento(p, coord, r.id, { categoria: 'Pessoal', descricao: 'Instrutores', valor: 10000, fonte: null }, o);
  await iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o);
  return { ...r, coord, diretoria };
}

/** Fase 5 com a atividade concluída. */
async function emEncerramento(p: P) {
  const r = await emImplementacao(p);
  const a = (await lerTabela(p, Atividades)).ativos().find((x) => x.projeto_id === r.id)!;
  await mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
  await iniciarEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), o);
  return r;
}

async function tudoPronto(p: P, r: Awaited<ReturnType<typeof emImplementacao>>) {
  for (const i of ['contratual', 'financeiro', 'administrativo'] as const) await marcarChecklist(p, r.coord, r.id, i, true, null, o);
  await salvarTextoDeEncerramento(p, r.coord, r.id, 'relatorio_final', 'Entregamos o combinado.', o);
  await registrarLicao(p, r.coord, r.id, licao, o);
}

describe('domínio: encerramento', () => {
  it('lista o que falta para encerrar (regra 23)', () => {
    expect(faltaParaEncerrar({ atividadesAbertas: 0, problemasAbertos: 0, checklistFaltando: [], temRelatorioFinal: true, licoes: 1 })).toEqual([]);
    const falta = faltaParaEncerrar({ atividadesAbertas: 2, problemasAbertos: 1, checklistFaltando: ['financeiro'], temRelatorioFinal: false, licoes: 0 });
    expect(falta).toHaveLength(5);
    expect(falta.join(' ')).toMatch(/Relatório final/);
    expect(falta.join(' ')).toMatch(/lição/);
  });

  it('encerramento atrasado (regra 25)', () => {
    expect(encerramentoAtrasado({ etapa: 'implementacao', fim_previsto: '2026-11-01', encerramento_iniciado_em: null }, '2026-11-12')).toMatch(/passou há 11 dias/);
    expect(encerramentoAtrasado({ etapa: 'implementacao', fim_previsto: '2026-12-01', encerramento_iniciado_em: null }, '2026-11-12')).toBeNull();
    expect(encerramentoAtrasado({ etapa: 'encerramento', fim_previsto: null, encerramento_iniciado_em: '2026-10-01' }, '2026-11-12')).toMatch(/42 dias/);
    expect(encerramentoAtrasado({ etapa: 'encerramento', fim_previsto: null, encerramento_iniciado_em: '2026-11-01' }, '2026-11-12')).toBeNull();
    expect(encerramentoAtrasado({ etapa: 'encerramento', fim_previsto: null, encerramento_iniciado_em: '2026-10-01' }, '2026-11-12', 60)).toBeNull();
    expect(DIAS_ENCERRAMENTO_PADRAO).toBe(30);
  });

  it('filtro de lições sem diferenciar acento', () => {
    const l = { categoria: 'pessoas' as const, o_que_aconteceu: 'Faltou comunicação', fazer_diferente: 'Reunião semanal' };
    expect(licaoCombina(l, { tipo: 'interno', porte: 'enxuto' }, { texto: 'comunicacao' })).toBe(true);
    expect(licaoCombina(l, { tipo: 'interno', porte: 'enxuto' }, { categoria: 'financeiro' })).toBe(false);
    expect(licaoCombina(l, { tipo: 'interno', porte: 'enxuto' }, { porte: 'completo' })).toBe(false);
    expect(CATEGORIAS_LICAO).toHaveLength(6);
  });

  it('a porta de encerramento: seguir encerra, ajustar mantém, parar volta à implementação', () => {
    expect(destinoDaDecisao('diretoria', 'seguir', false, 'encerramento').etapa).toBe('encerrado');
    expect(destinoDaDecisao('diretoria', 'ajustar', false, 'encerramento').etapa).toBe('encerramento');
    expect(destinoDaDecisao('diretoria', 'parar', false, 'encerramento').etapa).toBe('implementacao');
  });
});

describe('encerrar um projeto', () => {
  it('só o responsável leva a fase 5; cria a data e audita só colunas', async () => {
    const p = await planilhasDeProjetos();
    const r = await emImplementacao(p);
    await expect(iniciarEncerramento(p, await como(p, COORDENACAO_UR), r.id, await versaoDe(p, r.id), o)).rejects.toThrow();
    await iniciarEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), o);
    const proj = (await lerTabela(p, Projetos)).porId(r.id)!;
    expect(proj.etapa).toBe('encerramento');
    expect(proj.encerramento_iniciado_em).toBe('2026-11-12');
    await expect(iniciarEncerramento(p, r.coord, r.id, proj.versao, o)).rejects.toThrow(/etapa/);
  });

  it('a porta só abre com tudo pronto, e diz o que falta', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await expect(abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o)).rejects.toThrow(/Check-list.*Relatório final.*lição/);
    await marcarChecklist(p, r.coord, r.id, 'contratual', true, null, o);
    await marcarChecklist(p, r.coord, r.id, 'financeiro', true, null, o);
    await marcarChecklist(p, r.coord, r.id, 'administrativo', true, null, o);
    await salvarTextoDeEncerramento(p, r.coord, r.id, 'relatorio_final', 'Relatório.', o);
    await expect(abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o)).rejects.toThrow(/lição/);
    await registrarLicao(p, r.coord, r.id, licao, o);
    const s = await lerEncerramento(p, r.coord, r.id, o);
    expect(s?.falta).toEqual([]);
    expect(s?.podeAbrirPorta).toBe(true);
  });

  it('atividade aberta ou problema sem solução impedem a porta', async () => {
    const p = await planilhasDeProjetos();
    const r = await emImplementacao(p);
    await iniciarEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), o);
    await tudoPronto(p, r);
    await expect(abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o)).rejects.toThrow(/atividade/);
  });

  it('problema aberto impede; resolvido libera; a Diretoria decide e o projeto encerra', async () => {
    const p = await planilhasDeProjetos();
    const r = await emImplementacao(p);
    await registrarProblema(p, r.coord, r.id, { descricao: 'Goteira', gravidade: 'baixo', dono: null }, o);
    const a = (await lerTabela(p, Atividades)).ativos().find((x) => x.projeto_id === r.id)!;
    await mudarSituacaoAtividade(p, r.coord, r.id, a.id, a.versao, { situacao: 'concluida', fimReal: '2026-11-10' }, o);
    await iniciarEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), o);
    await tudoPronto(p, r);
    await expect(abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o)).rejects.toThrow(/problema/);
    const prob = (await lerTabela(p, Problemas)).ativos().find((x) => x.projeto_id === r.id)!;
    await resolverProblema(p, r.coord, r.id, prob.id, prob.versao, 'Consertada', '2026-11-12', o);
    await abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o);
  });

  it('fluxo completo: porta, decisão da Diretoria e projeto encerrado e travado', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await tudoPronto(p, r);
    const { portaId } = await abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('em_porta');
    const porta = (await lerTabela(p, Portas)).porId(portaId)!;
    expect(porta.tipo).toBe('encerramento');
    await expect(decidirPorta(p, r.coord, portaId, porta.versao, 'seguir', 'Ok.', o)).rejects.toThrow(ErroPermissao);
    await decidirPorta(p, r.diretoria, portaId, porta.versao, 'seguir', 'Aceito o encerramento.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('encerrado');
    await expect(registrarLicao(p, r.coord, r.id, licao, o)).rejects.toThrow(/Lição só/);
    await expect(marcarChecklist(p, r.coord, r.id, 'contratual', false, null, o)).rejects.toThrow();
    await expect(cancelarProjeto(p, r.coord, r.id, await versaoDe(p, r.id), 'Motivo', o)).rejects.toThrow(/encerrado/);
    expect((await lerFicha(p, r.coord, r.id))?.pode.cancelar).toBe(false);
  });

  it('ajustar devolve à fase 5; parar volta à implementação', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await tudoPronto(p, r);
    const { portaId } = await abrirPortaDeEncerramento(p, r.coord, r.id, await versaoDe(p, r.id), undefined, o);
    await decidirPorta(p, r.diretoria, portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'ajustar', 'Falta detalhe.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('encerramento');
    expect((await lerEncerramento(p, r.coord, r.id, o))?.podeAbrirPorta).toBe(true);
  });

  it('texto do relatório e das lições nunca vai para a auditoria', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await tudoPronto(p, r);
    const linhas = (await lerTabela(p, Encerramento)).ativos().filter((x) => x.projeto_id === r.id);
    const rel = linhas.find((x) => x.item === 'relatorio_final')!;
    const aud = await auditoriaDe(p, rel.id);
    expect(aud.length).toBeGreaterThan(0);
    expect(JSON.stringify(aud)).not.toContain('Entregamos o combinado');
    expect(JSON.stringify(aud)).not.toContain('Material chegou tarde');
  });

  it('relatório final em branco é recusado; check-list guarda quem e quando', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await expect(salvarTextoDeEncerramento(p, r.coord, r.id, 'relatorio_final', '  ', o)).rejects.toThrow(/relatório final/);
    await marcarChecklist(p, r.coord, r.id, 'contratual', true, 'Tudo assinado', o);
    const s = await lerEncerramento(p, r.coord, r.id, o);
    expect(s?.checklist[0]).toMatchObject({ item: 'contratual', feito: true, data: '2026-11-12', por: COORDENACAO, observacao: 'Tudo assinado' });
    await marcarChecklist(p, r.coord, r.id, 'contratual', false, null, o);
    expect((await lerEncerramento(p, r.coord, r.id, o))?.checklist[0].feito).toBe(false);
  });

  it('só quem gerencia altera; equipe e Leitura só leem', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await adicionarMembro(p, r.coord, r.id, FUNCIONARIO, 'Apoio', o);
    const equipe = await como(p, FUNCIONARIO);
    await expect(marcarChecklist(p, equipe, r.id, 'contratual', true, null, o)).rejects.toThrow(ErroPermissao);
    await expect(registrarLicao(p, equipe, r.id, licao, o)).rejects.toThrow(ErroPermissao);
    const s = await lerEncerramento(p, equipe, r.id, o);
    expect(s?.podeAlterar).toBe(false);
    expect(await lerEncerramento(p, await como(p, LEITURA), r.id, o)).toBeNull();
  });
});

describe('projeto parado ou cancelado', () => {
  it('registra relatório resumido e lição', async () => {
    const p = await planilhasDeProjetos();
    const r = await emImplementacao(p);
    await cancelarProjeto(p, r.coord, r.id, await versaoDe(p, r.id), 'Sem verba.', o);
    const s = await lerEncerramento(p, r.coord, r.id, o);
    expect(s?.podeSalvarResumo).toBe(true);
    await salvarTextoDeEncerramento(p, r.coord, r.id, 'relatorio_final', 'Parou por falta de verba.', o);
    await registrarLicao(p, r.coord, r.id, licao, o);
    expect((await lerEncerramento(p, r.coord, r.id, o))?.licoes).toHaveLength(1);
    await expect(salvarTextoDeEncerramento(p, r.coord, r.id, 'transicao', 'x', o)).rejects.toThrow();
  });
});

describe('lições aprendidas (regra 24)', () => {
  it('a lição aparece na consulta; quem não vê o projeto vê só o texto', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await registrarLicao(p, r.coord, r.id, licao, o);
    const dona = await consultarLicoes(p, r.coord);
    expect(dona).toHaveLength(1);
    expect(dona[0].projeto?.id).toBe(r.id);
    const leitura = await consultarLicoes(p, await como(p, LEITURA));
    expect(leitura).toHaveLength(1);
    expect(leitura[0].projeto).toBeNull();
    expect(leitura[0].fazerDiferente).toMatch(/folga/);
    expect(await consultarLicoes(p, r.coord, { categoria: 'financeiro' })).toHaveLength(0);
    expect(await consultarLicoes(p, r.coord, { texto: 'MATERIAL' })).toHaveLength(1);
    expect(await consultarLicoes(p, r.coord, { tipo: 'financiado' })).toHaveLength(0);
  });

  it('exige categoria válida e os dois textos', async () => {
    const p = await planilhasDeProjetos();
    const r = await emEncerramento(p);
    await expect(registrarLicao(p, r.coord, r.id, { ...licao, oQueAconteceu: ' ' }, o)).rejects.toThrow(/o que aconteceu/);
    await expect(registrarLicao(p, r.coord, r.id, { ...licao, fazerDiferente: '' }, o)).rejects.toThrow(/diferente/);
    await expect(registrarLicao(p, r.coord, r.id, { ...licao, categoria: 'x' as never }, o)).rejects.toThrow(/categoria/);
  });
});
