import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito, lerTabela } from '@/nucleo/armazenamento/tabela';
import { assumirIdeia, cadastrarIdeia, cancelarProjeto, editarIdeia, enviarParaAssumir, listarProjetos, retomarProjeto, trocarResponsavel } from '../aplicacao/ideias';
import { Projetos } from '../dados/tabelas';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, auditoriaDe, comResponsavel, como, ideia, planilhasDeProjetos, versaoDe } from './apoio';

describe('ideia e responsável', () => {
  it('qualquer funcionário cadastra: nasce rascunho, com código e histórico, e a auditoria guarda só colunas', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia(), { agora: AGORA });
    const [reg] = (await lerTabela(p, Projetos)).ativos();
    expect(r.codigo).toBe('PRJ-0001');
    expect(reg.etapa).toBe('rascunho');
    expect(reg.responsavel).toBeNull();
    const aud = await auditoriaDe(p, r.id);
    expect(aud).toHaveLength(1);
    expect(aud[0].detalhes).toContain('titulo');
    expect(aud[0].detalhes).not.toContain('Ideia de teste');
  });

  it('segundo código é sequencial, mesmo com o primeiro cancelado', async () => {
    const p = await planilhasDeProjetos();
    const quem = await como(p, FUNCIONARIO);
    const a = await cadastrarIdeia(p, quem, ideia(), { agora: AGORA });
    await cancelarProjeto(p, quem, a.id, 1, 'Não vale mais.', { agora: AGORA });
    expect((await cadastrarIdeia(p, quem, ideia(), { agora: AGORA })).codigo).toBe('PRJ-0002');
  });

  it('exige título, resumo, valor válido e serviço existente', async () => {
    const p = await planilhasDeProjetos();
    const quem = await como(p, FUNCIONARIO);
    await expect(cadastrarIdeia(p, quem, ideia({ titulo: ' ' }))).rejects.toThrow(/título/);
    await expect(cadastrarIdeia(p, quem, ideia({ resumo: '' }))).rejects.toThrow(/resumo/);
    await expect(cadastrarIdeia(p, quem, ideia({ valorEstimado: -1 }))).rejects.toThrow(/valor/);
    await expect(cadastrarIdeia(p, quem, ideia({ servico: 'nao-existe' }))).rejects.toThrow(/Serviço/);
  });

  it('quem só tem leitura não cadastra', async () => {
    const p = await planilhasDeProjetos();
    await expect(cadastrarIdeia(p, await como(p, LEITURA), ideia())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('só quem propôs envia o rascunho, e só rascunho', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia(), { agora: AGORA });
    await expect(enviarParaAssumir(p, await como(p, DIRETORIA), r.id, 1)).rejects.toBeInstanceOf(ErroPermissao);
    await enviarParaAssumir(p, await como(p, FUNCIONARIO), r.id, 1, { agora: AGORA });
    await expect(enviarParaAssumir(p, await como(p, FUNCIONARIO), r.id, 2)).rejects.toThrow(/rascunho/);
  });

  it('só a coordenação assume; funcionário não; vira responsável', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia(), { agora: AGORA, enviar: true });
    await expect(assumirIdeia(p, await como(p, FUNCIONARIO), r.id, 1)).rejects.toBeInstanceOf(ErroPermissao);
    await assumirIdeia(p, await como(p, COORDENACAO), r.id, 1, { agora: AGORA });
    const reg = (await lerTabela(p, Projetos)).porId(r.id)!;
    expect(reg.responsavel).toBe(COORDENACAO);
    expect(reg.etapa).toBe('ideia');
    await expect(assumirIdeia(p, await como(p, COORDENACAO), r.id, reg.versao)).rejects.toThrow(/esperando/);
  });

  it('coordenação de outro escopo não assume ideia de serviço fora do escopo', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia({ servico: 'escola' }), { agora: AGORA, enviar: true });
    await expect(assumirIdeia(p, await como(p, COORDENACAO_UR), r.id, 1)).rejects.toBeInstanceOf(ErroPermissao);
    expect(await listarProjetos(p, await como(p, COORDENACAO_UR), 'aguardando')).toHaveLength(0);
    expect(await listarProjetos(p, await como(p, COORDENACAO), 'aguardando')).toHaveLength(1);
  });

  it('versão desatualizada dá conflito', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia(), { agora: AGORA, enviar: true });
    await expect(assumirIdeia(p, await como(p, COORDENACAO), r.id, 99)).rejects.toBeInstanceOf(ErroConflito);
  });

  it('responsável muda o porte antes da porta; outra pessoa não edita', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    await editarIdeia(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), ideia({ porte: 'enxuto' }), { agora: AGORA });
    expect((await lerTabela(p, Projetos)).porId(r.id)!.porte).toBe('enxuto');
    await expect(editarIdeia(p, await como(p, FUNCIONARIO), r.id, await versaoDe(p, r.id), ideia())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('só a Diretoria troca o responsável, com registro e conta ativa', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const v = await versaoDe(p, r.id);
    await expect(trocarResponsavel(p, await como(p, COORDENACAO), r.id, v, 'coord.ur@exemplo.local')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(trocarResponsavel(p, await como(p, DIRETORIA), r.id, v, 'ninguem@exemplo.local')).rejects.toThrow(/acesso/);
    await trocarResponsavel(p, await como(p, DIRETORIA), r.id, v, 'coord.ur@exemplo.local', { agora: AGORA });
    expect((await lerTabela(p, Projetos)).porId(r.id)!.responsavel).toBe('coord.ur@exemplo.local');
  });

  it('cancelar exige motivo e nada é apagado; retomar só parado e só pela Diretoria', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    await expect(cancelarProjeto(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), ' ')).rejects.toThrow(/motivo/);
    await expect(cancelarProjeto(p, await como(p, FUNCIONARIO), r.id, await versaoDe(p, r.id), 'x')).rejects.toBeInstanceOf(ErroPermissao);
    await expect(retomarProjeto(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id))).rejects.toThrow(/parado/);
    await cancelarProjeto(p, await como(p, COORDENACAO), r.id, await versaoDe(p, r.id), 'Mudou a prioridade.', { agora: AGORA });
    const reg = (await lerTabela(p, Projetos)).porId(r.id)!;
    expect(reg.etapa).toBe('cancelado');
    expect(reg.ativo).toBe(true);
  });
});
