import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito, lerTabela } from '@/nucleo/armazenamento/tabela';
import { retomarProjeto, cancelarProjeto } from '../aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta, lerFicha, pendenciasDe } from '../aplicacao/portas';
import { Decisoes, Pareceres, Portas, Projetos } from '../dados/tabelas';
import {
  AGORA, ALCADA, COORDENACAO, DIRETORIA, FINANCEIRO, FUNCIONARIO, OUTRO_FUNCIONARIO, TECNICO, auditoriaDe, comBanca, comPortaAberta, comResponsavel, como, planilhasDeProjetos, todosPareceres, versaoDe,
} from './apoio';

const porta = async (p: Awaited<ReturnType<typeof planilhasDeProjetos>>, id: string) => (await lerTabela(p, Portas)).porId(id)!;
const etapa = async (p: Awaited<ReturnType<typeof planilhasDeProjetos>>, id: string) => (await lerTabela(p, Projetos)).porId(id)!.etapa;

describe('abrir a porta 1', () => {
  it('só o responsável abre; ideia sem responsável não abre', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comResponsavel(p);
    await expect(abrirPorta(p, await como(p, FUNCIONARIO), r.id, await versaoDe(p, r.id))).rejects.toBeInstanceOf(ErroPermissao);
    await expect(abrirPorta(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id))).rejects.toBeInstanceOf(ErroPermissao);
    const { portaId } = await abrirPorta(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), { agora: AGORA });
    expect((await porta(p, portaId)).situacao).toBe('aberta');
    expect(await etapa(p, r.id)).toBe('em_porta');
    await expect(abrirPorta(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id))).rejects.toThrow(/Só uma ideia/);
  });

  it('grava valor, exigência de alçada e pareceres exigidos; mudar o limite depois não muda a porta', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 5000 });
    const { portaId } = await comPortaAberta(p, { valorEstimado: 10000 });
    const antes = await porta(p, portaId);
    expect(antes.exige_alcada).toBe(true);
    expect(antes.valor_considerado).toBe(10000);
    expect(antes.pareceres_exigidos).toBe('tecnico,financeiro,juridico');
    await comBanca(p, { limiteAlcada: 1000000 });
    expect((await porta(p, portaId)).exige_alcada).toBe(true);
  });

  it('porte enxuto exige só o parecer técnico', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { portaId } = await comPortaAberta(p, { porte: 'enxuto' });
    expect((await porta(p, portaId)).pareceres_exigidos).toBe('tecnico');
  });
});

describe('pareceres', () => {
  it('só quem foi designado para o tipo dá o parecer, uma vez por porta', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { portaId } = await comPortaAberta(p);
    await expect(darParecer(p, await como(p, FINANCEIRO), portaId, 'tecnico', 'satisfatorio', null)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(darParecer(p, await como(p, COORDENACAO), portaId, 'tecnico', 'satisfatorio', null)).rejects.toBeInstanceOf(ErroPermissao);
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, { agora: AGORA });
    await expect(darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null)).rejects.toThrow(/já foi dado/);
  });

  it('ressalvas e insatisfatório exigem texto', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { portaId } = await comPortaAberta(p);
    await expect(darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'com_ressalvas', ' ')).rejects.toThrow(/Explique/);
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'insatisfatorio', 'Texto fictício.', { agora: AGORA });
    expect((await lerTabela(p, Pareceres)).ativos()).toHaveLength(1);
  });

  it('o histórico e a auditoria não guardam o texto do parecer', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { id, portaId } = await comPortaAberta(p);
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'com_ressalvas', 'Segredo do parecer', { agora: AGORA });
    const ficha = (await lerFicha(p, await como(p, DIRETORIA), id))!;
    expect(JSON.stringify(ficha.historico)).not.toContain('Segredo do parecer');
    const pareceres = (await lerTabela(p, Pareceres)).ativos();
    expect(JSON.stringify(await auditoriaDe(p, pareceres[0].id))).not.toContain('Segredo do parecer');
  });

  it('tipo não exigido pela porta é recusado', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { portaId } = await comPortaAberta(p, { porte: 'enxuto' });
    await expect(darParecer(p, await como(p, FINANCEIRO), portaId, 'financeiro', 'satisfatorio', null)).rejects.toThrow(/não exige/);
  });
});

describe('decisão da Diretoria e alçada', () => {
  it('só decide com todos os pareceres, com justificativa, e só a Diretoria', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    const { portaId } = await comPortaAberta(p);
    const dir = await como(p, DIRETORIA);
    await expect(decidirPorta(p, dir, portaId, 1, 'seguir', 'ok')).rejects.toThrow(/Faltam pareceres/);
    await todosPareceres(p, portaId);
    await expect(decidirPorta(p, await como(p, COORDENACAO), portaId, 1, 'seguir', 'ok')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirPorta(p, dir, portaId, 1, 'seguir', '  ')).rejects.toThrow(/justificativa/);
    await decidirPorta(p, dir, portaId, 1, 'seguir', 'Vale a pena.', { agora: AGORA });
    expect((await porta(p, portaId)).situacao).toBe('decidida');
    expect((await porta(p, portaId)).resultado).toBe('seguir');
    expect((await lerTabela(p, Decisoes)).ativos()).toHaveLength(1);
  });

  it('seguir avança, ajustar devolve para nova porta, parar leva a parado (e só a Diretoria retoma)', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    const dir = await como(p, DIRETORIA);
    const a = await comPortaAberta(p);
    await todosPareceres(p, a.portaId);
    await decidirPorta(p, dir, a.portaId, 1, 'seguir', 'ok', { agora: AGORA });
    expect(await etapa(p, a.id)).toBe('fase_1');

    const b = await comPortaAberta(p);
    await todosPareceres(p, b.portaId);
    await decidirPorta(p, dir, b.portaId, 1, 'ajustar', 'Ajuste o escopo.', { agora: AGORA });
    expect(await etapa(p, b.id)).toBe('ideia');
    // Reenvio: nova porta, pareceres de novo (os da porta anterior ficam no histórico).
    const nova = await abrirPorta(p, await como(p, COORDENACAO), b.id, await versaoDe(p, b.id), { agora: AGORA });
    expect(nova.portaId).not.toBe(b.portaId);
    await darParecer(p, await como(p, TECNICO), nova.portaId, 'tecnico', 'satisfatorio', null, { agora: AGORA });
    expect((await lerTabela(p, Pareceres)).ativos().filter((x) => x.porta_id === b.portaId)).toHaveLength(3);

    const c = await comPortaAberta(p);
    await todosPareceres(p, c.portaId);
    await decidirPorta(p, dir, c.portaId, 1, 'parar', 'Sem recursos.', { agora: AGORA });
    expect(await etapa(p, c.id)).toBe('parado');
    await expect(retomarProjeto(p, await como(p, COORDENACAO), c.id, await versaoDe(p, c.id))).rejects.toBeInstanceOf(ErroPermissao);
    await retomarProjeto(p, dir, c.id, await versaoDe(p, c.id), { agora: AGORA });
    expect(await etapa(p, c.id)).toBe('ideia');
  });

  it('decidir de novo uma porta decidida é recusado; versão antiga dá conflito', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    const dir = await como(p, DIRETORIA);
    const { portaId } = await comPortaAberta(p);
    await todosPareceres(p, portaId);
    await expect(decidirPorta(p, dir, portaId, 99, 'seguir', 'ok')).rejects.toBeInstanceOf(ErroConflito);
    await decidirPorta(p, dir, portaId, 1, 'seguir', 'ok', { agora: AGORA });
    await expect(decidirPorta(p, dir, portaId, 2, 'seguir', 'ok')).rejects.toThrow(/já foi decidida/);
  });

  it('quem propôs não decide a própria porta; a configuração pode liberar', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    // O proponente é a própria Diretoria.
    const { portaId } = await comPortaAberta(p, {}, DIRETORIA);
    await todosPareceres(p, portaId);
    const dir = await como(p, DIRETORIA);
    await expect(decidirPorta(p, dir, portaId, 1, 'seguir', 'ok')).rejects.toThrow(/Quem propôs/);
    expect((await pendenciasDe(p, dir)).filter((x) => x.acao === 'decisao')).toHaveLength(0);
    await comBanca(p, { limiteAlcada: null, proponenteDecide: true });
    expect((await pendenciasDe(p, dir)).filter((x) => x.acao === 'decisao')).toHaveLength(1);
    await decidirPorta(p, dir, portaId, 1, 'seguir', 'ok', { agora: AGORA });
  });

  it('acima do limite, o seguir da Diretoria espera a alçada; só a pessoa designada decide, e é final', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 5000 });
    const { id, portaId } = await comPortaAberta(p, { valorEstimado: 9000 });
    await todosPareceres(p, portaId);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, 1, 'seguir', 'Segue.', { agora: AGORA });
    expect((await porta(p, portaId)).situacao).toBe('aguardando_alcada');
    expect(await etapa(p, id)).toBe('em_porta');
    // A Diretoria não decide pela alçada; quem tem a permissão mas não foi designado também não.
    await expect(decidirPorta(p, await como(p, DIRETORIA), portaId, 2, 'seguir', 'de novo')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirPorta(p, await como(p, FINANCEIRO), portaId, 2, 'seguir', 'x')).rejects.toBeInstanceOf(ErroPermissao);
    await decidirPorta(p, await como(p, ALCADA), portaId, 2, 'seguir', 'Aprovado pelo Conselho.', { agora: AGORA });
    expect((await porta(p, portaId)).situacao).toBe('decidida');
    expect(await etapa(p, id)).toBe('fase_1');
    const decisoes = (await lerTabela(p, Decisoes)).ativos();
    expect(decisoes.map((d) => d.nivel)).toEqual(['diretoria', 'alcada']);
  });

  it('acima do limite, ajustar e parar da Diretoria valem sem subir', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: 5000 });
    const { id, portaId } = await comPortaAberta(p, { valorEstimado: 9000 });
    await todosPareceres(p, portaId);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, 1, 'parar', 'Não.', { agora: AGORA });
    expect((await porta(p, portaId)).situacao).toBe('decidida');
    expect(await etapa(p, id)).toBe('parado');
  });

  it('não dá para cancelar nem trocar responsável com a porta aberta', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { id } = await comPortaAberta(p);
    await expect(cancelarProjeto(p, await como(p, COORDENACAO), id, await versaoDe(p, id), 'x')).rejects.toThrow(/porta/);
  });

  it('toda decisão e parecer deixa auditoria com colunas, sem valores', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    const { portaId } = await comPortaAberta(p);
    await todosPareceres(p, portaId);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, 1, 'seguir', 'Justificativa fictícia única', { agora: AGORA });
    const [dec] = (await lerTabela(p, Decisoes)).ativos();
    const aud = await auditoriaDe(p, dec.id);
    expect(aud).toHaveLength(1);
    expect(aud[0].detalhes).toContain('justificativa');
    expect(aud[0].detalhes).not.toContain('Justificativa fictícia única');
  });
});

describe('pendências', () => {
  it('cada pessoa vê só o que espera por ela', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p, { limiteAlcada: null });
    const { portaId } = await comPortaAberta(p);
    expect((await pendenciasDe(p, await como(p, TECNICO))).map((x) => x.acao)).toEqual(['parecer']);
    expect(await pendenciasDe(p, await como(p, FUNCIONARIO))).toEqual([]);
    expect(await pendenciasDe(p, await como(p, DIRETORIA))).toEqual([]);
    await todosPareceres(p, portaId);
    expect(await pendenciasDe(p, await como(p, TECNICO))).toEqual([]);
    expect((await pendenciasDe(p, await como(p, DIRETORIA))).map((x) => x.acao)).toEqual(['decisao']);
    void OUTRO_FUNCIONARIO;
  });
});
