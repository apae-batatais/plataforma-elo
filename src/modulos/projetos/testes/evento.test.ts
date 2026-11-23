/** Entrega L5, parte 2 (regras L15 a L17 e L21): tipo captacao, modelo curto, série e receita "A captar" na porta 2. */
import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { lancarReceitaDoEvento, lerLigacaoEvento } from '../aplicacao/evento';
import type { CatalogoReceitas, PedidoReceitaDoEvento } from '../aplicacao/catalogo-orcamento';
import { avancarFase, lerFase, salvarDocumento } from '../aplicacao/fases';
import { assumirIdeia, cadastrarIdeia, cancelarProjeto, editarIdeia, seriesDeEventos, type DadosIdeia } from '../aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { LigacoesProjeto, Portas, Projetos } from '../dados/tabelas';
import { camposDe, toleranciasDoTermo, validarConteudo } from '../dominio/fases';
import { chaveDaSerie, conferirEvento, mesmaSerie, sugestoesDeSerie } from '../dominio/evento';
import { AGORA, COORDENACAO, DIRETORIA, FINANCEIRO, FUNCIONARIO, LEITURA, TECNICO, auditoriaDe, comBanca, como, planilhasDeProjetos, versaoDe } from './apoio';

type P = Awaited<ReturnType<typeof planilhasDeProjetos>>;
const o = { agora: AGORA };
const FONTE = { id: 'fonte-1', nome: 'Receitas do evento (exemplo)' };

/** Catálogo falso do Orçamento: idempotente por projeto, como o real. */
function orcamentoFalso(opcoes: { falha?: string; semFontes?: boolean; semAcesso?: boolean } = {}) {
  const itens = new Map<string, { id: string; ativo: boolean; pedido: PedidoReceitaDoEvento }>();
  const catalogo: CatalogoReceitas = {
    async fontesProprias() {
      if (opcoes.semAcesso) return null;
      return opcoes.semFontes ? [] : [FONTE];
    },
    async registrarReceita(_quem, pedido) {
      if (opcoes.falha) throw new Error(opcoes.falha);
      const antes = itens.get(pedido.projetoId);
      if (antes?.ativo) {
        antes.pedido = pedido;
        return { receitaId: antes.id, criada: false };
      }
      const id = `receita-${itens.size + 1}`;
      itens.set(pedido.projetoId, { id, ativo: true, pedido });
      return { receitaId: id, criada: true };
    },
    async encerrarReceita(_quem, projetoId) {
      const x = itens.get(projetoId);
      if (!x?.ativo) return false;
      x.ativo = false;
      return true;
    },
  };
  return { catalogo, itens };
}

const evento = { serie: 'Leilão anual', dataEvento: '2027-06-12', metaReceita: 8000, fonteReceitaId: FONTE.id };
const dados = (x: Partial<DadosIdeia> = {}): DadosIdeia => ({ titulo: 'Leilão de teste', resumo: 'Objetivo fictício do evento.', tipo: 'captacao', porte: 'enxuto', valorEstimado: 2000, servico: null, evento, ...x });
const termo = { objetivo: 'Objetivo do evento', valor_total: '2000' };

async function eventoNaFase2(p: P, receitas = orcamentoFalso().catalogo, d: Partial<DadosIdeia> = {}, config: Parameters<typeof comBanca>[1] = {}) {
  await comBanca(p, { limiteAlcada: 100000, ...config });
  const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), dados(d), { ...o, enviar: true, receitas });
  const coord = await como(p, COORDENACAO);
  await assumirIdeia(p, coord, r.id, await versaoDe(p, r.id), o);
  const { portaId } = await abrirPorta(p, coord, r.id, await versaoDe(p, r.id), o);
  await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
  await decidirPorta(p, await como(p, DIRETORIA), portaId, (await lerTabela(p, Portas)).porId(portaId)!.versao, 'seguir', 'Segue.', o);
  await salvarDocumento(p, coord, r.id, 'proposta', { descricao: 'Texto fictício.' }, true, null, o);
  await avancarFase(p, coord, r.id, await versaoDe(p, r.id), o);
  const completo = { ...termo, escopo: 'Escopo', tolerancia_custo_linha: '1', tolerancia_custo_total: '1', tolerancia_prazo_fim: '1', tolerancia_prazo_marco: '1' };
  await salvarDocumento(p, coord, r.id, 'termo_abertura', d.tipo && d.tipo !== 'captacao' ? completo : termo, true, null, o);
  return { ...r, coord };
}

async function decidirPortaDois(p: P, id: string, orcamento: CatalogoReceitas | null, decisao: 'seguir' | 'parar' = 'seguir') {
  const { portaId } = await abrirPorta(p, await como(p, COORDENACAO), id, await versaoDe(p, id), o);
  await darParecer(p, await como(p, TECNICO), portaId, 'tecnico', 'satisfatorio', null, o);
  const versao = (await lerTabela(p, Portas)).porId(portaId)!.versao;
  return decidirPorta(p, await como(p, DIRETORIA), portaId, versao, decisao, 'Decisão.', { ...o, orcamento });
}

describe('L16: série do evento', () => {
  it('ignora acento, maiúscula e espaço sobrando; série em branco nunca é igual a outra', () => {
    expect(chaveDaSerie('  Leilão   Anual ')).toBe('leilao anual');
    expect(mesmaSerie('Leilão anual', 'LEILAO ANUAL')).toBe(true);
    expect(mesmaSerie('Leilão anual', 'Bazar')).toBe(false);
    expect(mesmaSerie('', '')).toBe(false);
    expect(mesmaSerie(null, undefined)).toBe(false);
  });

  it('as sugestões trazem uma grafia por série, a mais usada, em ordem', () => {
    expect(sugestoesDeSerie(['Leilão anual', 'leilao anual', 'Leilão anual', 'Bazar', '', null, ' Bazar '])).toEqual(['Bazar', 'Leilão anual']);
  });
});

describe('L15: modelo curto do evento', () => {
  it('confere data, meta e série', () => {
    expect(conferirEvento({ serie: '  Festa  junina ', dataEvento: '2027-06-12', metaReceita: 100.456, fonteReceitaId: ' ' })).toEqual({ serie: 'Festa junina', dataEvento: '2027-06-12', metaReceita: 100.46, fonteReceitaId: null });
    expect(() => conferirEvento({ dataEvento: '2027-02-30', metaReceita: 10 })).toThrow(/data do evento/);
    expect(() => conferirEvento({ dataEvento: '', metaReceita: 10 })).toThrow(/data do evento/);
    expect(() => conferirEvento({ dataEvento: '2027-06-12', metaReceita: 0 })).toThrow(/meta de receita/);
    expect(() => conferirEvento({ dataEvento: '2027-06-12', metaReceita: null })).toThrow(/meta de receita/);
    expect(() => conferirEvento({ dataEvento: '2027-06-12', metaReceita: 10, serie: 'x'.repeat(81) })).toThrow(/80 letras/);
  });

  it('o Termo de Abertura do evento não pede escopo nem tolerâncias; valem as da configuração', async () => {
    expect(camposDe('termo_abertura', 'captacao').map((c) => c.nome)).toEqual(['objetivo', 'valor_total']);
    expect(validarConteudo('termo_abertura', { objetivo: 'x', valor_total: 10 }, true, 'captacao')).toEqual({ objetivo: 'x', valor_total: 10 });
    const p = await planilhasDeProjetos();
    const r = await eventoNaFase2(p, undefined, {}, { tolerancias: { custoLinhaPct: 12, custoTotalPct: 6, prazoFimDias: 20, prazoMarcoDias: 9 } });
    const f = await lerFase(p, await como(p, COORDENACAO), r.id);
    expect(f!.projeto.tipo).toBe('captacao');
    const doc = (await lerFase(p, await como(p, COORDENACAO), r.id))!.documentos.termo_abertura!;
    expect(toleranciasDoTermo(JSON.parse(doc.conteudo))).toMatchObject({ custoLinhaPct: 12, custoTotalPct: 6, prazoFimDias: 20, prazoMarcoDias: 9 });
  });

  it('grava o evento na ficha, confere a fonte no Orçamento e guarda só colunas na auditoria', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), dados(), { ...o, receitas: catalogo });
    expect((await lerTabela(p, Projetos)).porId(r.id)).toMatchObject({ tipo: 'captacao', porte: 'enxuto', serie_evento: 'Leilão anual', data_evento: '2027-06-12', meta_receita: 8000, fonte_receita_id: FONTE.id, fonte_receita_nome: FONTE.nome });
    expect(JSON.stringify(await auditoriaDe(p, r.id))).not.toContain('8000');
  });

  it('o evento exige data e meta; fonte fora da lista é recusada; sem Orçamento, só salva sem a fonte', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const funcionario = await como(p, FUNCIONARIO);
    await expect(cadastrarIdeia(p, funcionario, dados({ evento: { ...evento, metaReceita: null } }), { ...o, receitas: catalogo })).rejects.toThrow(/meta de receita/);
    await expect(cadastrarIdeia(p, funcionario, dados({ evento: { ...evento, fonteReceitaId: 'outra' } }), { ...o, receitas: catalogo })).rejects.toThrow(/da lista/);
    await expect(cadastrarIdeia(p, funcionario, dados(), o)).rejects.toThrow(/Salve sem a fonte/);
    await expect(cadastrarIdeia(p, funcionario, dados(), { ...o, receitas: orcamentoFalso({ semAcesso: true }).catalogo })).rejects.toThrow(/Salve sem a fonte/);
    const sem = await cadastrarIdeia(p, funcionario, dados({ evento: { ...evento, fonteReceitaId: null } }), o);
    expect((await lerTabela(p, Projetos)).porId(sem.id)!.fonte_receita_id).toBeNull();
  });

  it('mudar o tipo para outro limpa os campos do evento', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), dados(), { ...o, receitas: catalogo });
    await editarIdeia(p, await como(p, FUNCIONARIO), r.id, await versaoDe(p, r.id), dados({ tipo: 'interno', evento: undefined }), o);
    expect((await lerTabela(p, Projetos)).porId(r.id)).toMatchObject({ tipo: 'interno', serie_evento: null, data_evento: null, meta_receita: null, fonte_receita_id: null });
  });

  it('as sugestões de série só vêm dos projetos que a pessoa vê', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    await cadastrarIdeia(p, await como(p, FUNCIONARIO), dados(), { ...o, receitas: catalogo });
    expect(await seriesDeEventos(p, await como(p, FUNCIONARIO))).toEqual(['Leilão anual']);
    expect(await seriesDeEventos(p, await como(p, DIRETORIA))).toEqual(['Leilão anual']);
    // Rascunho de outra pessoa não aparece (a Coordenação não o vê).
    expect(await seriesDeEventos(p, await como(p, COORDENACAO))).toEqual([]);
  });
});

describe('L17: receita "A captar" na porta 2', () => {
  it('seguir lança a receita com a meta, a data e a fonte, e liga o projeto ao item', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo, itens } = orcamentoFalso();
    const r = await eventoNaFase2(p, catalogo);
    const res = await decidirPortaDois(p, r.id, catalogo);
    expect(res.receita).toEqual({ estado: 'criada', receitaId: 'receita-1' });
    expect(itens.get(r.id)!.pedido).toMatchObject({ valor: 8000, dataEvento: '2027-06-12', fonteId: FONTE.id, projetoCodigo: expect.stringMatching(/^PRJ-/) });
    const ligacoes = (await lerTabela(p, LigacoesProjeto)).ativos().filter((l) => l.projeto_id === r.id);
    expect(ligacoes).toMatchObject([{ app: 'fonte_receita', referencia_id: 'receita-1', nome: FONTE.nome }]);
    expect((await lerLigacaoEvento(p, await como(p, COORDENACAO), r.id, catalogo))).toMatchObject({ aplica: true, receita: 'lancada', metaReceita: 8000 });
  });

  it('projeto que não é evento não lança nada', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo, itens } = orcamentoFalso();
    const r = await eventoNaFase2(p, catalogo, { tipo: 'interno', evento: undefined });
    expect((await decidirPortaDois(p, r.id, catalogo)).receita).toEqual({ estado: 'nao_se_aplica' });
    expect(itens.size).toBe(0);
  });

  it('se o Orçamento falhar, a decisão vale, a ligação fica pendente e o botão refaz sem duplicar', async () => {
    const p = await planilhasDeProjetos();
    const falho = orcamentoFalso({ falha: 'O exercício 2027 não está aberto' });
    const r = await eventoNaFase2(p, falho.catalogo);
    const res = await decidirPortaDois(p, r.id, falho.catalogo);
    expect(res.receita).toMatchObject({ estado: 'pendente', motivo: expect.stringContaining('exercício 2027') });
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('fase_3');
    const coord = await como(p, COORDENACAO);
    expect(await lerLigacaoEvento(p, coord, r.id, falho.catalogo)).toMatchObject({ receita: 'pendente', podeLancar: true });
    const bom = orcamentoFalso();
    const feito = await lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, bom.catalogo, o);
    expect(feito.criada).toBe(true);
    expect((await lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, bom.catalogo, o)).criada).toBe(false);
    expect((await lerTabela(p, LigacoesProjeto)).ativos().filter((l) => l.projeto_id === r.id && l.app === 'fonte_receita')).toHaveLength(1);
  });

  it('sem fonte própria cadastrada a porta 2 abre mesmo assim; a fonte é escolhida depois e conferida', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso({ semFontes: true });
    const r = await eventoNaFase2(p, catalogo, { evento: { ...evento, fonteReceitaId: null } });
    const res = await decidirPortaDois(p, r.id, catalogo);
    expect(res.receita).toMatchObject({ estado: 'pendente', motivo: expect.stringContaining('fonte do evento') });
    expect(await lerLigacaoEvento(p, await como(p, COORDENACAO), r.id, catalogo)).toMatchObject({ receita: 'pendente', motivoPendente: expect.stringContaining('Financeiro') });
    await expect(lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, catalogo, { ...o, fonteId: FONTE.id })).rejects.toThrow(/da lista/);
    const bom = orcamentoFalso();
    await lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, bom.catalogo, { ...o, fonteId: FONTE.id });
    expect((await lerTabela(p, Projetos)).porId(r.id)).toMatchObject({ fonte_receita_id: FONTE.id, fonte_receita_nome: FONTE.nome });
    expect(bom.itens.get(r.id)!.pedido.fonteId).toBe(FONTE.id);
  });

  it('só quem decide a porta ou gerencia o projeto lança a receita; antes da porta 2 aprovada, ninguém', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const r = await eventoNaFase2(p, catalogo);
    await expect(lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, catalogo, o)).rejects.toThrow(/porta 2 aprova/);
    await decidirPortaDois(p, r.id, null);
    await expect(lancarReceitaDoEvento(p, await como(p, FUNCIONARIO), r.id, catalogo, o)).rejects.toThrow(ErroPermissao);
    await expect(lancarReceitaDoEvento(p, await como(p, LEITURA), r.id, catalogo, o)).rejects.toThrow();
    await expect(lancarReceitaDoEvento(p, await como(p, FINANCEIRO), r.id, catalogo, o)).rejects.toThrow();
    await expect(lancarReceitaDoEvento(p, await como(p, DIRETORIA), r.id, null, o)).rejects.toThrow(/Orçamento não está ativo/);
  });

  it('parar a ideia ou cancelar o projeto encerra o item e a ligação, sem apagar', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo, itens } = orcamentoFalso();
    const r = await eventoNaFase2(p, catalogo);
    await decidirPortaDois(p, r.id, catalogo);
    await cancelarProjeto(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id), 'Sem patrocínio.', { ...o, orcamento: catalogo });
    expect(itens.get(r.id)!.ativo).toBe(false);
    const todas = (await lerTabela(p, LigacoesProjeto)).todos().filter((l) => l.projeto_id === r.id && l.app === 'fonte_receita');
    expect(todas).toHaveLength(1);
    expect(todas[0].ativo).toBe(false);
  });

  it('cancelar com o Orçamento fora do ar mantém o cancelamento e avisa no histórico', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const r = await eventoNaFase2(p, catalogo);
    await decidirPortaDois(p, r.id, catalogo);
    await cancelarProjeto(p, await como(p, DIRETORIA), r.id, await versaoDe(p, r.id), 'Sem patrocínio.', { ...o, orcamento: null });
    expect((await lerTabela(p, Projetos)).porId(r.id)!.etapa).toBe('cancelado');
    const { HistoricoProjetos } = await import('../dados/tabelas');
    expect((await lerTabela(p, HistoricoProjetos)).todos().some((h) => h.projeto_id === r.id && h.acao.includes('continua no Orçamento'))).toBe(true);
  });

  it('quem não vê o projeto não lê a parte do evento', async () => {
    const p = await planilhasDeProjetos();
    const { catalogo } = orcamentoFalso();
    const r = await cadastrarIdeia(p, await como(p, FUNCIONARIO), dados(), { ...o, receitas: catalogo });
    expect(await lerLigacaoEvento(p, await como(p, COORDENACAO), r.id, catalogo)).toBeNull();
    expect(await lerLigacaoEvento(p, await como(p, FUNCIONARIO), r.id, catalogo)).toMatchObject({ aplica: true, receita: 'aguardando' });
  });
});
