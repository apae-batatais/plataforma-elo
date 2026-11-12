import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { cadastrarIdeia, listarProjetos } from '../aplicacao/ideias';
import { darParecer, lerFicha } from '../aplicacao/portas';
import { salvarConfig } from '../aplicacao/configuracoes';
import { lerConfig } from '../aplicacao/comum';
import { CONFIG_PADRAO } from '../dominio/projeto';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, OUTRO_FUNCIONARIO, TECNICO, comBanca, comPortaAberta, comResponsavel, como, ideia, planilhasDeProjetos } from './apoio';

describe('quem vê o quê', () => {
  it('rascunho só para quem propôs e para a Diretoria', async () => {
    const p = await planilhasDeProjetos();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), ideia(), { agora: AGORA });
    expect(await lerFicha(p, await como(p, FUNCIONARIO), r.id)).not.toBeNull();
    expect(await lerFicha(p, await como(p, DIRETORIA), r.id)).not.toBeNull();
    expect(await lerFicha(p, await como(p, COORDENACAO), r.id)).toBeNull();
    expect(await lerFicha(p, await como(p, OUTRO_FUNCIONARIO), r.id)).toBeNull();
    expect(await listarProjetos(p, await como(p, OUTRO_FUNCIONARIO), 'meus')).toHaveLength(0);
  });

  it('projeto de serviço aparece para a coordenação do escopo, não para a de outro escopo', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p, { servico: 'escola' });
    expect(await lerFicha(p, await como(p, COORDENACAO), r.id)).not.toBeNull();
    expect(await lerFicha(p, await como(p, COORDENACAO_UR), r.id)).toBeNull();
    expect(await lerFicha(p, await como(p, OUTRO_FUNCIONARIO), r.id)).toBeNull();
  });

  it('"todos os projetos" é só da Diretoria', async () => {
    const p = await planilhasDeProjetos();
    await comResponsavel(p);
    await expect(listarProjetos(p, await como(p, COORDENACAO), 'todos')).rejects.toBeInstanceOf(ErroPermissao);
    expect(await listarProjetos(p, await como(p, DIRETORIA), 'todos')).toHaveLength(1);
  });

  it('quem propôs vê a decisão e a justificativa, mas não o texto dos pareceres', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { id, portaId } = await comPortaAberta(p);
    await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'com_ressalvas', 'Texto reservado', { agora: AGORA });
    const doProponente = (await lerFicha(p, await como(p, FUNCIONARIO), id))!;
    expect(doProponente.portas[0].pareceres).toEqual([]);
    expect(doProponente.portas[0].faltando).toEqual(['financeiro', 'juridico']);
    const doTecnico = (await lerFicha(p, await como(p, TECNICO), id))!;
    expect(doTecnico.portas[0].pareceres[0].texto).toBe('Texto reservado');
    const daDiretoria = (await lerFicha(p, await como(p, DIRETORIA), id))!;
    expect(daDiretoria.portas[0].pareceres).toHaveLength(1);
  });

  it('quem foi designado vê o projeto em porta; sem designação não vê', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { id } = await comPortaAberta(p);
    expect(await lerFicha(p, await como(p, TECNICO), id)).not.toBeNull();
    expect(await lerFicha(p, await como(p, LEITURA), id)).toBeNull();
  });

  it('os botões da ficha seguem as permissões', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const { id } = await comPortaAberta(p);
    expect((await lerFicha(p, await como(p, TECNICO), id))!.pode.parecerDos).toEqual(['tecnico']);
    expect((await lerFicha(p, await como(p, FUNCIONARIO), id))!.pode).toMatchObject({ parecerDos: [], decidir: false, abrirPorta: false, assumir: false });
  });
});

describe('configurações', () => {
  it('só a Diretoria configura; a configuração volta como foi salva', async () => {
    const p = await planilhasDeProjetos();
    const nova = { ...CONFIG_PADRAO, limiteAlcada: 7500.5, proponenteDecide: true, designados: { ...CONFIG_PADRAO.designados, tecnico: ['x@exemplo.local'] } };
    await expect(salvarConfig(p, await como(p, COORDENACAO), nova)).rejects.toBeInstanceOf(ErroPermissao);
    await salvarConfig(p, await como(p, DIRETORIA), nova, { agora: AGORA });
    expect(await lerConfig(p)).toEqual(nova);
  });

  it('sem configuração vale o padrão, e pareceres podem ficar sem ninguém designado', async () => {
    const p = await planilhasDeProjetos();
    expect(await lerConfig(p)).toEqual(CONFIG_PADRAO);
  });

  it('recusa limite negativo', async () => {
    const p = await planilhasDeProjetos();
    await expect(salvarConfig(p, await como(p, DIRETORIA), { ...CONFIG_PADRAO, limiteAlcada: -1 })).rejects.toThrow(/limite/);
  });
});
