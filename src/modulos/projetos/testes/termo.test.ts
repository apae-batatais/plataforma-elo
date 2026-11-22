/** Entrega L2 (regras L7 a L11 e L14): rascunho do termo ao aprovar a porta 2 de projeto financiado. */
import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { avancarFase, lerFase, salvarDocumento } from '../aplicacao/fases';
import { cancelarProjeto } from '../aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { criarRascunhoDoProjeto, lerLigacaoTermo, projetosComTermoParadosOuCancelados, type CatalogoTermos, type PedidoRascunhoDeTermo, type TermoLigado } from '../aplicacao/termo';
import { Portas, Projetos } from '../dados/tabelas';
import { camposDe, faltaDoFinanciamento, validarConteudo } from '../dominio/fases';
import { AGORA, ALCADA, COORDENACAO, DIRETORIA, FINANCEIRO, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, como, comPortaAberta, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const termo = { objetivo: 'Objetivo', escopo: 'Escopo', valor_total: '30000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '15', tolerancia_prazo_marco: '7' };
const financ = { financiador: 'Financiador (exemplo)', objeto: 'Oficinas de arte (exemplo)' };

/** Catálogo falso de Parcerias: guarda o que foi pedido e é idempotente por projeto, como o real. */
function parceriasFalsas(opcoes: { falha?: string; valorDoTermo?: number; semPermissao?: boolean } = {}) {
  const criados = new Map<string, string>();
  const pedidos: PedidoRascunhoDeTermo[] = [];
  const catalogo: CatalogoTermos = {
    async criarRascunhoDeTermo(_quem, pedido) {
      if (opcoes.falha) throw new Error(opcoes.falha);
      pedidos.push(pedido);
      const antes = criados.get(pedido.projetoId);
      if (antes) return { termoId: antes, criado: false };
      const id = `termo-${criados.size + 1}`;
      criados.set(pedido.projetoId, id);
      return { termoId: id, criado: true };
    },
    async termoParaProjeto(_quem, termoId): Promise<TermoLigado | null> {
      if (opcoes.semPermissao) return null;
      return { termoId, parceiro: 'Financiador (exemplo)', situacao: 'rascunho', valor: opcoes.valorDoTermo ?? 30000 };
    },
  };
  return { catalogo, criados, pedidos };
}

/** Projeto financiado (enxuto) na fase 2 com o Termo de Abertura pronto, ainda sem a porta 2 aberta. */
async function financiadoNaFase2(p: P, conteudo: Record<string, unknown> = { ...termo, ...financ }, extra: Parameters<typeof comPortaAberta>[1] = {}) {
  await comBanca(p, { limiteAlcada: 100000 });
  const r = await comPortaAberta(p, { tipo: 'financiado', porte: 'enxuto', valorEstimado: 30000, ...extra });
  await darParecer(p, await como(p, TECNICO), r.portaId, 'tecnico', 'satisfatorio', null, o);
  await decidirPorta(p, await como(p, DIRETORIA), r.portaId, (await lerTabela(p, Portas)).porId(r.portaId)!.versao, 'seguir', 'Segue.', o);
  const coord = await como(p, COORDENACAO);
  await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto fictício.' }, true, null, o);
  await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
  await salvarDocumento(p, coord, r.id, 'termo_abertura', conteudo, true, null, o);
  return { ...r, coord };
}

async function portaDois(p: P, id: string) {
  const coord = await como(p, COORDENACAO);
  const { portaId } = await abrirPorta(p, coord, id, await versaoDe(p, id), o);
  await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
  return { portaId, versao: (await lerTabela(p, Portas)).porId(portaId)!.versao };
}

describe('L7: financiador e objeto no Termo de Abertura de projeto financiado', () => {
  it('os campos só existem no financiado e são obrigatórios nele', () => {
    expect(camposDe('termo_abertura', 'interno').map((c) => c.nome)).not.toContain('financiador');
    expect(camposDe('termo_abertura', 'financiado').map((c) => c.nome)).toEqual(expect.arrayContaining(['financiador', 'objeto']));
    expect(() => validarConteudo('termo_abertura', termo, true, 'financiado')).toThrow(/financia/);
    expect(validarConteudo('termo_abertura', { ...termo, ...financ }, true, 'financiado')).toMatchObject(financ);
    expect(validarConteudo('termo_abertura', { ...termo, ...financ }, true, 'interno')).not.toHaveProperty('financiador');
    expect(faltaDoFinanciamento({ financiador: ' ', objeto: 'x' })).toEqual(['o financiador']);
  });

  it('sem eles a porta 2 não abre e a mensagem diz o que falta', async () => {
    const p = await planilhasDeProjetos();
    const { id, coord } = await financiadoNaFase2(p, { ...termo, ...financ });
    // Termo "pronto" gravado antes da regra (sem financiador): a conferência da porta pega.
    const [{ versao }] = [(await lerTabela(p, (await import('../dados/tabelas')).ProjetoDocumentos)).ativos().find((d) => d.tipo === 'termo_abertura')!];
    expect(versao).toBeGreaterThan(0);
    await expect(salvarDocumento(p, coord, id, 'termo_abertura', termo, true, 1, o)).rejects.toThrow(/Preencha/);
    await salvarDocumento(p, coord, id, 'termo_abertura', termo, false, 1, o);
    const f = await lerFase(p, coord, id);
    expect(f!.podeAbrirPorta2).toBe(false);
    await salvarDocumento(p, coord, id, 'termo_abertura', { ...termo, financiador: 'Financiador (exemplo)' }, false, 2, o);
    await expect(abrirPorta(p, coord, id, await versaoDe(p, id))).rejects.toThrow(/complete/);
  });

  it('projeto interno não pede financiador nem objeto', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, { tipo: 'interno', porte: 'enxuto' });
    await darParecer(p, await como(p, TECNICO), r.portaId, 'tecnico', 'satisfatorio', null, o);
    await decidirPorta(p, await como(p, DIRETORIA), r.portaId, 1, 'seguir', 'Segue.', o);
    const coord = await como(p, COORDENACAO);
    await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto.' }, true, null, o);
    await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
    await salvarDocumento(p, coord, r.id, 'termo_abertura', termo, true, null, o);
    expect((await lerFase(p, coord, r.id))!.podeAbrirPorta2).toBe(true);
  });
});

describe('L8: a decisão de seguir cria o rascunho, uma vez só', () => {
  it('cria com financiador, objeto, serviço, vigência e valor aprovado e guarda o vínculo no projeto', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p, { ...termo, ...financ }, { servico: 'escola' });
    const { portaId, versao } = await portaDois(p, id);
    const { catalogo, pedidos } = parceriasFalsas();
    const r = await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'seguir', 'Autorizado.', { ...o, parcerias: catalogo });
    expect(r.rascunho).toEqual({ estado: 'criado', termoId: 'termo-1' });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ projetoId: id, financiador: 'Financiador (exemplo)', objeto: 'Oficinas de arte (exemplo)', servico: 'escola', valorAprovado: 30000 });
    const proj = (await lerTabela(p, Projetos)).porId(id)!;
    expect(proj).toMatchObject({ etapa: 'fase_3', termo_id: 'termo-1', termo_nome: 'Financiador (exemplo)' });
    const audit = (await auditoriaDe(p, id)).filter((a) => a.acao === 'alteracao');
    expect(audit.some((a) => (a.detalhes ?? '').includes('termo_id'))).toBe(true);
    expect(audit.every((a) => !(a.detalhes ?? '').includes('Financiador'))).toBe(true);
  });

  it('projeto interno não cria rascunho', async () => {
    const p = await planilhasDeProjetos();
    await comBanca(p);
    const r = await comPortaAberta(p, { tipo: 'interno', porte: 'enxuto' });
    await darParecer(p, await como(p, TECNICO), r.portaId, 'tecnico', 'satisfatorio', null, o);
    const { catalogo, pedidos } = parceriasFalsas();
    const res = await decidirPorta(p, await como(p, DIRETORIA), r.portaId, 1, 'seguir', 'Segue.', { ...o, parcerias: catalogo });
    expect(res.rascunho).toEqual({ estado: 'nao_se_aplica' });
    expect(pedidos).toHaveLength(0);
  });

  it('decidir "ajustar" ou "parar" na porta 2 não cria rascunho', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const { catalogo, pedidos } = parceriasFalsas();
    const res = await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'ajustar', 'Ajuste.', { ...o, parcerias: catalogo });
    expect(res.rascunho).toEqual({ estado: 'nao_se_aplica' });
    expect(pedidos).toHaveLength(0);
  });

  it('acima da alçada, o rascunho só nasce quando a alçada decide', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    await comBanca(p, { limiteAlcada: 1000 });
    const { portaId, versao } = await portaDois(p, id);
    const { catalogo, pedidos } = parceriasFalsas();
    const a = await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'seguir', 'Sobe.', { ...o, parcerias: catalogo });
    expect(a.rascunho).toEqual({ estado: 'nao_se_aplica' });
    expect(pedidos).toHaveLength(0);
    const v2 = (await lerTabela(p, Portas)).porId(portaId)!.versao;
    const b = await decidirPorta(p, await como(p, ALCADA), portaId, v2, 'seguir', 'Autorizo.', { ...o, parcerias: catalogo });
    expect(b.rascunho.estado).toBe('criado');
  });
});

describe('L9: a decisão vale mesmo se o rascunho falhar; o botão refaz sem duplicar', () => {
  it('Parcerias com erro: decisão gravada, aviso na aba e histórico; depois o botão cria uma vez só', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const dir = await como(p, DIRETORIA);
    const res = await decidirPorta(p, dir, portaId, versao, 'seguir', 'Autorizado.', { ...o, parcerias: parceriasFalsas({ falha: 'erro de gravação' }).catalogo });
    expect(res.rascunho).toEqual({ estado: 'falhou', motivo: 'erro de gravação' });
    expect((await lerTabela(p, Projetos)).porId(id)).toMatchObject({ etapa: 'fase_3', termo_id: null });
    const l = await lerLigacaoTermo(p, dir, id, null, o);
    expect(l).toMatchObject({ aplica: true, rascunhoPendente: true, podeCriarRascunho: true, termo: { estado: 'nenhum' } });

    const { catalogo, pedidos } = parceriasFalsas();
    const a = await criarRascunhoDoProjeto(p, dir, id, catalogo, o);
    const b = await criarRascunhoDoProjeto(p, dir, id, catalogo, o);
    expect(a).toEqual({ termoId: 'termo-1', criado: true });
    expect(b).toEqual({ termoId: 'termo-1', criado: false });
    expect(pedidos).toHaveLength(2);
    expect((await lerTabela(p, Projetos)).porId(id)!.termo_id).toBe('termo-1');
    const depois = await lerLigacaoTermo(p, dir, id, catalogo, o);
    expect(depois).toMatchObject({ podeCriarRascunho: false, rascunhoPendente: false, termo: { estado: 'ok' } });
  });

  it('Parcerias desligado: decisão vale, resultado "falhou" e a ligação aparece como indisponível depois de criada', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const dir = await como(p, DIRETORIA);
    const res = await decidirPorta(p, dir, portaId, versao, 'seguir', 'Autorizado.', { ...o, parcerias: null });
    expect(res.rascunho).toMatchObject({ estado: 'falhou', motivo: expect.stringMatching(/Parcerias não está ativo/) });
    await criarRascunhoDoProjeto(p, dir, id, parceriasFalsas().catalogo, o);
    expect((await lerLigacaoTermo(p, dir, id, null, o))!.termo).toEqual({ estado: 'indisponivel', nome: 'Financiador (exemplo)' });
  });

  it('só quem decide porta ou gerencia o projeto cria o rascunho; só depois da porta 2 e só no financiado', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { catalogo } = parceriasFalsas();
    await expect(criarRascunhoDoProjeto(p, await como(p, COORDENACAO), id, catalogo, o)).rejects.toThrow(/depois que a porta 2/);
    const { portaId, versao } = await portaDois(p, id);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'seguir', 'Ok.', { ...o, parcerias: parceriasFalsas({ falha: 'x' }).catalogo });
    for (const email of [FUNCIONARIO, LEITURA, FINANCEIRO]) {
      await expect(criarRascunhoDoProjeto(p, await como(p, email), id, catalogo, o)).rejects.toBeInstanceOf(ErroPermissao);
    }
    // o responsável (gerencia) pode refazer
    expect((await criarRascunhoDoProjeto(p, await como(p, COORDENACAO), id, catalogo, o)).criado).toBe(true);

    const interno = await comPortaAberta(p, { tipo: 'interno' });
    await expect(criarRascunhoDoProjeto(p, await como(p, DIRETORIA), interno.id, catalogo, o)).rejects.toThrow(/financiamento externo/);
  });

  it('erro de Parcerias na repetição vira erro tratado e não grava vínculo', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const dir = await como(p, DIRETORIA);
    await decidirPorta(p, dir, portaId, versao, 'seguir', 'Ok.', { ...o, parcerias: null });
    await expect(criarRascunhoDoProjeto(p, dir, id, parceriasFalsas({ falha: 'Serviço desconhecido: x.' }).catalogo, o)).rejects.toThrow(/Serviço desconhecido/);
    expect((await lerTabela(p, Projetos)).porId(id)!.termo_id).toBeNull();
  });
});

describe('L10: valor do projeto × valor do termo só informa', () => {
  it('mostra o ponto de atenção quando os valores diferem e não reescreve nada', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const dir = await como(p, DIRETORIA);
    await decidirPorta(p, dir, portaId, versao, 'seguir', 'Ok.', { ...o, parcerias: parceriasFalsas().catalogo });
    const igual = await lerLigacaoTermo(p, dir, id, parceriasFalsas().catalogo, o);
    expect(igual!.pontosDeAtencao).toEqual([]);
    const antes = (await lerTabela(p, Projetos)).porId(id)!;
    const diferente = await lerLigacaoTermo(p, dir, id, parceriasFalsas({ valorDoTermo: 25000 }).catalogo, o);
    expect(diferente!.pontosDeAtencao).toEqual([expect.stringMatching(/valor aprovado do projeto \(R\$\s30\.000,00\) é diferente do valor do termo \(R\$\s25\.000,00\)/)]);
    expect((await lerTabela(p, Projetos)).porId(id)!.versao).toBe(antes.versao);
  });

  it('sem permissão de Parcerias a pessoa vê só o vínculo, nunca os valores', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    await decidirPorta(p, await como(p, DIRETORIA), portaId, versao, 'seguir', 'Ok.', { ...o, parcerias: parceriasFalsas().catalogo });
    const l = await lerLigacaoTermo(p, await como(p, COORDENACAO), id, parceriasFalsas({ semPermissao: true }).catalogo, o);
    expect(l!.termo).toEqual({ estado: 'sem_permissao', nome: 'Financiador (exemplo)' });
    expect(l!.pontosDeAtencao).toEqual([]);
  });

  it('quem não vê o projeto não lê a ligação', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    expect(await lerLigacaoTermo(p, await como(p, 'compras@exemplo.local'), id, null, o)).toBeNull();
  });
});

describe('L11: projeto cancelado não apaga o rascunho; o Financeiro é avisado pela situação', () => {
  it('cancelar mantém o vínculo, avisa na aba e aparece na lista de origens com problema', async () => {
    const p = await planilhasDeProjetos();
    const { id } = await financiadoNaFase2(p);
    const { portaId, versao } = await portaDois(p, id);
    const dir = await como(p, DIRETORIA);
    const { catalogo } = parceriasFalsas();
    await decidirPorta(p, dir, portaId, versao, 'seguir', 'Ok.', { ...o, parcerias: catalogo });
    expect((await projetosComTermoParadosOuCancelados(p)).size).toBe(0);
    await cancelarProjeto(p, dir, id, await versaoDe(p, id), 'Financiador desistiu.', o);
    const proj = (await lerTabela(p, Projetos)).porId(id)!;
    expect(proj).toMatchObject({ etapa: 'cancelado', termo_id: 'termo-1' });
    expect([...(await projetosComTermoParadosOuCancelados(p))]).toEqual([id]);
    const l = await lerLigacaoTermo(p, dir, id, catalogo, o);
    expect(l!.pontosDeAtencao.join(' ')).toMatch(/cancelado: o termo não é apagado/);
    expect(l!.podeCriarRascunho).toBe(false);
  });
});
