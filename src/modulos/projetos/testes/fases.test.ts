import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { adicionarItemMarco, adicionarMembro, avancarFase, encerrarMembro, exigirTermoAprovado, lerFase, registrarRisco, retirarItemMarco, salvarDocumento, termoPreenchido } from '../aplicacao/fases';
import { abrirPorta, darParecer, decidirPorta, lerFicha } from '../aplicacao/portas';
import { listarProjetos } from '../aplicacao/ideias';
import { MarcoLogico, Portas, ProjetoDocumentos, Projetos } from '../dados/tabelas';
import { itensDaFase, pendenciasDoMarco, validarConteudo, type ItemMarco } from '../dominio/fases';
import { AGORA, ALCADA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FINANCEIRO, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, comPortaAberta, como, planilhasDeProjetos, todosPareceres, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };

/** Projeto na fase 1 (porta 1 decidida com "seguir"). */
async function naFase1(p: P, extra: Parameters<typeof comPortaAberta>[1] = {}) {
  const r = await comPortaAberta(p, extra);
  if (extra.porte === 'enxuto') await darParecer(p, await como(p, TECNICO), r.portaId, 'tecnico', 'satisfatorio', null, o);
  else await todosPareceres(p, r.portaId);
  const versaoPorta = (await lerTabela(p, Portas)).porId(r.portaId)!.versao;
  await decidirPorta(p, await como(p, DIRETORIA), r.portaId, versaoPorta, 'seguir', 'Segue.', o);
  return r;
}

const texto = (descricao = 'Texto fictício.') => ({ descricao });
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };

async function preencherEnxuto(p: P, id: string) {
  const c = await como(p, COORDENACAO);
  await salvarDocumento(p, c, id, 'proposta', texto(), true, null, o);
  await avancarFase(p, c, id, await versaoDe(p, id), o);
  await salvarDocumento(p, c, id, 'termo_abertura', termo, true, null, o);
  return c;
}

describe('domínio: documentos e marco lógico', () => {
  it('o enxuto exige o mínimo e o completo exige mais', () => {
    expect(itensDaFase('enxuto', 1)).toEqual(['proposta']);
    expect(itensDaFase('enxuto', 2)).toEqual(['termo_abertura']);
    expect(itensDaFase('completo', 1)).toContain('marco_logico');
    expect(itensDaFase('completo', 2)).toEqual(['termo_abertura', 'riscos', 'lancamento']);
  });

  it('pronto exige os obrigatórios; rascunho aceita em branco; número inválido é recusado', () => {
    expect(() => validarConteudo('proposta', {}, true)).toThrow(/Preencha/);
    expect(validarConteudo('proposta', {}, false)).toEqual({ descricao: null });
    expect(() => validarConteudo('termo_abertura', { ...termo, valor_total: 'abc' }, true)).toThrow(/número/);
    expect(validarConteudo('termo_abertura', { ...termo, valor_total: '1.500,50' }, true).valor_total).toBe(1500.5);
  });

  it('marco lógico: regra 7', () => {
    const base: ItemMarco[] = [
      { id: 'i', nivel: 'impacto', descricao: 'I', indicador: 'x', fonte_verificacao: 'y', acima: null },
      { id: 'o', nivel: 'objetivo', descricao: 'O', indicador: 'x', fonte_verificacao: 'y', acima: 'i' },
      { id: 'r', nivel: 'resultado', descricao: 'R', indicador: 'x', fonte_verificacao: 'y', acima: 'o' },
    ];
    expect(pendenciasDoMarco([]).length).toBe(3);
    expect(pendenciasDoMarco(base).join()).toMatch(/falta ao menos uma atividade/);
    const completo = [...base, { id: 'a', nivel: 'atividade' as const, descricao: 'A', indicador: null, fonte_verificacao: null, acima: 'r' }];
    expect(pendenciasDoMarco(completo)).toEqual([]);
    expect(pendenciasDoMarco(completo.map((i) => (i.id === 'r' ? { ...i, indicador: null } : i))).join()).toMatch(/indicador/);
    expect(pendenciasDoMarco(completo.map((i) => (i.id === 'a' ? { ...i, acima: 'o' } : i))).join()).toMatch(/precisa apontar/);
  });
});

describe('fase 1: documentos', () => {
  it('salva rascunho, marca pronto, recusa quem não gerencia e a fase errada', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p, { porte: 'enxuto' });
    const coord = await como(p, COORDENACAO);
    await expect(salvarDocumento(p, await como(p, FUNCIONARIO), r.id, 'proposta', texto(), false, null)).rejects.toThrow();
    await expect(salvarDocumento(p, await como(p, COORDENACAO_UR), r.id, 'proposta', texto(), false, null)).rejects.toBeInstanceOf(Error);
    await expect(salvarDocumento(p, coord, r.id, 'termo_abertura', termo, false, null)).rejects.toThrow(/fase correspondente/);
    await expect(salvarDocumento(p, coord, r.id, 'necessidade', texto(), false, null)).rejects.toThrow(/não usa/);
    await salvarDocumento(p, coord, r.id, 'proposta', {}, false, null, o);
    let f = (await lerFase(p, coord, r.id))!;
    expect(f.itens[0]).toMatchObject({ item: 'proposta', pronto: false });
    await expect(avancarFase(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/falta na fase 1/);
    await expect(salvarDocumento(p, coord, r.id, 'proposta', {}, true, null)).rejects.toThrow(/Preencha/);
    await salvarDocumento(p, coord, r.id, 'proposta', texto(), true, f.documentos.proposta!.versao, o);
    f = (await lerFase(p, coord, r.id))!;
    expect(f.podeAvancar).toBe(true);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_2');
  });

  it('conflito de versão do documento', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p, { porte: 'enxuto' });
    const coord = await como(p, COORDENACAO);
    await salvarDocumento(p, coord, r.id, 'proposta', texto(), false, null, o);
    await expect(salvarDocumento(p, coord, r.id, 'proposta', texto('outro'), false, 99)).rejects.toThrow(/alterado por outra pessoa/);
  });

  it('a auditoria registra colunas, nunca o conteúdo', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p, { porte: 'enxuto' });
    await salvarDocumento(p, await como(p, COORDENACAO), r.id, 'proposta', texto('SEGREDO-DO-TEXTO'), false, null, o);
    const doc = (await lerTabela(p, ProjetoDocumentos)).ativos()[0];
    const trilha = await auditoriaDe(p, doc.id);
    expect(trilha.length).toBe(1);
    expect(JSON.stringify(trilha)).not.toContain('SEGREDO-DO-TEXTO');
  });
});

describe('marco lógico, riscos e equipe', () => {
  it('inclui, valida o nível acima e retira sem apagar', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p);
    const coord = await como(p, COORDENACAO);
    const item = (nivel: 'impacto' | 'objetivo', acima: string | null) => ({ nivel, descricao: nivel, indicador: 'i', fonteVerificacao: 'f', pressuposto: null, acima });
    await expect(adicionarItemMarco(p, coord, r.id, item('objetivo', null))).rejects.toThrow(/Escolha o item/);
    await adicionarItemMarco(p, coord, r.id, item('impacto', null), o);
    const impacto = (await lerTabela(p, MarcoLogico)).ativos()[0];
    await adicionarItemMarco(p, coord, r.id, item('objetivo', impacto.id), o);
    await expect(retirarItemMarco(p, coord, r.id, impacto.id, impacto.versao)).rejects.toThrow(/apontam/);
    const obj = (await lerTabela(p, MarcoLogico)).ativos().find((i) => i.nivel === 'objetivo')!;
    await retirarItemMarco(p, coord, r.id, obj.id, obj.versao, o);
    expect((await lerTabela(p, MarcoLogico)).todos().length).toBe(2);
    expect((await lerTabela(p, MarcoLogico)).ativos().length).toBe(1);
    await expect(adicionarItemMarco(p, await como(p, FUNCIONARIO), r.id, item('impacto', null))).rejects.toBeInstanceOf(Error);
  });

  it('equipe vê o projeto mas não altera nem vê pareceres', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p);
    const coord = await como(p, COORDENACAO);
    const lista = async (email: string) => (await listarProjetos(p, await como(p, email), 'todos').catch(() => [])).length;
    expect(await lerFicha(p, await como(p, LEITURA), r.id)).toBeNull();
    await adicionarMembro(p, coord, r.id, LEITURA, 'Apoio', o);
    const ficha = await lerFicha(p, await como(p, LEITURA), r.id);
    expect(ficha).not.toBeNull();
    expect(ficha!.portas.every((d) => d.pareceres.length === 0)).toBe(true);
    await expect(registrarRisco(p, await como(p, LEITURA), r.id, { descricao: 'x', probabilidade: 'baixo', impacto: 'baixo', resposta: null, dono: null })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(adicionarMembro(p, await como(p, LEITURA), r.id, FUNCIONARIO, 'x')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(adicionarMembro(p, coord, r.id, LEITURA, 'Apoio')).rejects.toThrow(/já está/);
    await expect(adicionarMembro(p, coord, r.id, 'ninguem@exemplo.local', 'x')).rejects.toThrow(/acesso/);
    expect(await lista(DIRETORIA)).toBeGreaterThan(0);
    const m = (await lerFase(p, coord, r.id))!.equipe[0];
    await encerrarMembro(p, coord, r.id, m.id, m.versao, o);
    expect(await lerFicha(p, await como(p, LEITURA), r.id)).toBeNull();
  });
});

describe('porta 2 e Termo de Abertura (enxuto)', () => {
  it('sem documentos prontos não abre; com tudo pronto abre, decide e aprova o Termo', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 50000 });
    const r = await naFase1(p, { porte: 'enxuto' });
    const coord = await como(p, COORDENACAO);
    await salvarDocumento(p, coord, r.id, 'proposta', texto(), true, null, o);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    await expect(exigirTermoAprovado(p, r.id)).rejects.toThrow(/Sem Termo de Abertura aprovado/);
    await expect(abrirPorta(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/complete: termo de abertura/);
    await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
    const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    const portas = await lerTabela(p, Portas);
    const porta = portas.porId(portaId)!;
    expect(porta.tipo).toBe('termo');
    expect(porta.valor_considerado).toBe(10000);
    // com a porta aberta o Termo fica travado
    await expect(salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null)).rejects.toThrow(/travados/);
    await expect(exigirTermoAprovado(p, r.id)).rejects.toThrow();
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, porta.versao, 'seguir', 'Autorizado.', o);
    const proj = (await lerTabela(p, Projetos)).porId(r.id)!;
    expect(proj.etapa).toBe('fase_3');
    expect(proj.valor_aprovado).toBe(10000);
    const aprovado = await exigirTermoAprovado(p, r.id);
    expect(aprovado.situacao).toBe('aprovado');
    await expect(salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null)).rejects.toThrow();
  });

  it('valor acima do limite espera a alçada e só então aprova; "ajustar" volta à fase 2', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 5000 });
    const r = await naFase1(p, { porte: 'enxuto', valorEstimado: 3000 });
    const coord = await preencherEnxuto(p, r.id);
    const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    const tabelaPortas = Portas;
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
    let porta = (await lerTabela(p, tabelaPortas)).porId(portaId)!;
    expect(porta.exige_alcada).toBe(true);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, porta.versao, 'seguir', 'Sobe.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('em_porta');
    await expect(exigirTermoAprovado(p, r.id)).rejects.toThrow();
    porta = (await lerTabela(p, tabelaPortas)).porId(portaId)!;
    await decidirPorta(p, await como(p, ALCADA), portaId, porta.versao, 'seguir', 'Autorizo.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_3');
    expect((await exigirTermoAprovado(p, r.id)).situacao).toBe('aprovado');
  });

  it('ajustar devolve à fase 2 e destrava o Termo', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p, { porte: 'enxuto' });
    const coord = await preencherEnxuto(p, r.id);
    const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
    const versao = (await lerTabela(p, Portas)).porId(portaId)!.versao;
    await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'ajustar', 'Ajuste o escopo.', o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_2');
    await salvarDocumento(p, coord, r.id, 'termo_abertura', { ...termo, escopo: 'Novo escopo' }, true, null, o);
    await expect(exigirTermoAprovado(p, r.id)).rejects.toThrow();
  });

  it('porte completo exige marco lógico, riscos e demais documentos antes da porta 2', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p);
    const coord = await como(p, COORDENACAO);
    let f = (await lerFase(p, coord, r.id))!;
    expect(f.itens.map((i) => i.item)).toEqual(['necessidade', 'partes_interessadas', 'problema_objetivos', 'marco_logico', 'estimativas', 'proposta']);
    expect(f.podeAvancar).toBe(false);
    await salvarDocumento(p, coord, r.id, 'necessidade', texto(), true, null, o);
    await salvarDocumento(p, coord, r.id, 'partes_interessadas', { quem: 'Famílias' }, true, null, o);
    await salvarDocumento(p, coord, r.id, 'problema_objetivos', { problema: 'P', objetivo: 'O' }, true, null, o);
    await salvarDocumento(p, coord, r.id, 'estimativas', { valor_total: '10000', duracao: '6 meses' }, true, null, o);
    await salvarDocumento(p, coord, r.id, 'proposta', texto(), true, null, o);
    f = (await lerFase(p, coord, r.id))!;
    expect(f.itens.filter((i) => !i.pronto).map((i) => i.item)).toEqual(['marco_logico']);
    await expect(avancarFase(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/marco lógico/);
    const novo = (nivel: 'impacto' | 'objetivo' | 'resultado' | 'atividade', acima: string | null) => ({ nivel, descricao: nivel, indicador: nivel === 'atividade' ? null : 'i', fonteVerificacao: nivel === 'atividade' ? null : 'f', pressuposto: null, acima });
    const ultimoDe = async (n: string) => (await lerTabela(p, MarcoLogico)).ativos().find((i) => i.nivel === n)!.id;
    await adicionarItemMarco(p, coord, r.id, novo('impacto', null), o);
    await adicionarItemMarco(p, coord, r.id, novo('objetivo', await ultimoDe('impacto')), o);
    await adicionarItemMarco(p, coord, r.id, novo('resultado', await ultimoDe('objetivo')), o);
    await adicionarItemMarco(p, coord, r.id, novo('atividade', await ultimoDe('resultado')), o);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    // fase 2: termo pré-preenchido com a proposta e as estimativas
    const pre = await termoPreenchido(p, coord, r.id);
    expect(pre.valor_total).toBe(10000);
    expect(pre.escopo).toBe('Texto fictício.');
    await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
    await salvarDocumento(p, coord, r.id, 'lancamento', texto(), true, null, o);
    await expect(abrirPorta(p, coord, r.id, await versaoDe(p, r.id))).rejects.toThrow(/riscos/);
    await registrarRisco(p, coord, r.id, { descricao: 'Atraso', probabilidade: 'medio', impacto: 'alto', resposta: 'Folga', dono: null }, o);
    await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('em_porta');
  });

  it('só o responsável abre a porta 2', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await naFase1(p, { porte: 'enxuto' });
    await preencherEnxuto(p, r.id);
    await expect(abrirPorta(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id))).rejects.toBeInstanceOf(ErroPermissao);
    await expect(abrirPorta(p, await como(p, FINANCEIRO), r.id, await versaoDe(p, r.id))).rejects.toBeInstanceOf(Error);
  });
});
