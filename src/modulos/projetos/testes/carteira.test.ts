import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { lerCarteira } from '../aplicacao/carteira';
import { registrarProblema } from '../aplicacao/acompanhamento';
import { avancarFase, iniciarImplementacao, salvarDocumento } from '../aplicacao/fases';
import { adicionarAtividade, adicionarLinhaOrcamento } from '../aplicacao/planejamento';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { Portas } from '../dados/tabelas';
import { AGORA, COORDENACAO, COORDENACAO_UR, DIRETORIA, FUNCIONARIO, LEITURA, TECNICO, comBanca, comPortaAberta, como, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '10000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };

async function emImplementacao(p: P) {
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
  await adicionarLinhaOrcamento(p, coord, r.id, { categoria: 'Pessoal', descricao: 'Instrutores', valor: 10000, fonte: null }, o);
  await iniciarImplementacao(p, coord, r.id, await versaoDe(p, r.id), o);
  return { ...r, coord };
}

describe('carteira (P6)', () => {
  it('conta porta pendente, problema alto e fora da tolerância, só dos projetos que a pessoa vê', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const a = await emImplementacao(p);
    await registrarProblema(p, a.coord, a.id, { descricao: 'Fornecedor sumiu', gravidade: 'alto', dono: null }, o);
    const b = await comPortaAberta(p, { titulo: 'Outra ideia' });

    const dir = await lerCarteira(p, await como(p, DIRETORIA), o);
    expect(dir.numeros.portas).toBe(1);
    expect(dir.listas.portas[0].id).toBe(b.id);
    expect(dir.numeros.problemas).toBe(1);
    expect(dir.listas.problemas[0].motivos).toEqual(['Fornecedor sumiu']);
    expect(dir.numeros.fora).toBe(0);
    expect(dir.numeros.andamento).toBe(2);

    // Dias depois, a atividade passou da tolerância de marco.
    const depois = await lerCarteira(p, await como(p, DIRETORIA), { agora: new Date('2026-12-30T15:00:00Z') });
    expect(depois.listas.fora.map((x) => x.id)).toEqual([a.id]);
    expect(depois.listas.fora[0].motivos.join(' ')).toContain('Comprar material');
  });

  it('Leitura vê a carteira inteira, sem rascunhos; quem não tem a permissão é recusado', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    await comPortaAberta(p);
    const { cadastrarIdeia } = await import('../aplicacao/ideias');
    await cadastrarIdeia(p, await como(p, FUNCIONARIO), { titulo: 'Rascunho', resumo: 'x', tipo: 'interno', porte: 'enxuto', valorEstimado: 1, servico: null }, o);
    const leitura = await lerCarteira(p, await como(p, LEITURA), o);
    expect(leitura.numeros.portas).toBe(1);
    expect(JSON.stringify(leitura)).not.toContain('Rascunho');
    await expect(lerCarteira(p, await como(p, FUNCIONARIO), o)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerCarteira(p, await como(p, COORDENACAO_UR), o)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
