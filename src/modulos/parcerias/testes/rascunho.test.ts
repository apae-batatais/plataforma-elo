/** Rascunho de termo vindo de um projeto (ADR-023, regras 22 a 26): criação única, fora de tudo, quem vê. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { buscar, criarRascunhoDeTermo, itensDaAgenda, listarRascunhos, listarTermos, termoParaProjeto, termosParaOrcamento, termosComAlertaDeOciosas, detalharTermo, type PedidoRascunho } from '../aplicacao/parcerias';
import { TABELAS_PARCERIAS, TermoFontes, TermoServicos, Termos } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const AGORA = new Date('2026-11-15T12:00:00Z');
const pedido = (x: Partial<PedidoRascunho> = {}): PedidoRascunho => ({
  projetoId: 'prj-1',
  projetoCodigo: 'PRJ-0001',
  financiador: 'Financiador (exemplo)',
  objeto: 'Oficinas de arte (exemplo)',
  servico: null,
  inicioPrevisto: '2027-01-01',
  fimPrevisto: '2027-12-31',
  valorAprovado: 30000,
  ...x,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'parcerias']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_PARCERIAS] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
});

describe('regra 22: criar o rascunho', () => {
  it('cria termo rascunho com parceiro, objeto, vigência prevista, serviço e uma fonte global com o valor aprovado', async () => {
    const r = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido({ servico: 'escola' }), AGORA);
    expect(r.criado).toBe(true);
    const t = (await lerTabela(p, Termos)).porId(r.termoId)!;
    expect(t).toMatchObject({ situacao: 'rascunho', parceiro: 'Financiador (exemplo)', objeto: 'Oficinas de arte (exemplo)', numero: null, tipo: null, inicio: '2027-01-01', fim: '2027-12-31', projeto_origem_id: 'prj-1', projeto_origem_codigo: 'PRJ-0001' });
    const fontes = (await lerTabela(p, TermoFontes)).ativos().filter((f) => f.termo_id === r.termoId);
    expect(fontes).toHaveLength(1);
    expect(fontes[0]).toMatchObject({ forma: 'global', valor_inicial: 30000 });
    expect((await lerTabela(p, TermoServicos)).ativos().filter((s) => s.termo_id === r.termoId).map((s) => s.servico)).toEqual(['escola']);
  });

  it('é idempotente por projeto, mesmo se o rascunho for encerrado depois', async () => {
    const a = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido(), AGORA);
    const b = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido(), AGORA);
    expect(b).toEqual({ termoId: a.termoId, criado: false });
    expect((await lerTabela(p, Termos)).todos().filter((t) => t.projeto_origem_id === 'prj-1')).toHaveLength(1);
    const outro = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido({ projetoId: 'prj-2', projetoCodigo: 'PRJ-0002' }), AGORA);
    expect(outro.criado).toBe(true);
  });

  it('não exige permissão de Parcerias (quem decide a porta não é do Financeiro) e audita colunas e origem, sem valores', async () => {
    await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido(), AGORA);
    const a = (await lerTabela(p, RegistrosAuditoria)).todos().find((x) => x.entidade === 'Termos' && x.acao === 'inclusao')!;
    expect(a.usuario).toBe('diretoria@exemplo.local');
    expect(a.detalhes).toContain('PRJ-0001');
    expect(a.detalhes).not.toContain('30000');
    expect(a.detalhes).not.toContain('Financiador (exemplo)');
  });

  it('recusa financiador vazio, serviço desconhecido e vigência invertida', async () => {
    await expect(criarRascunhoDeTermo(p, { email: 'x@exemplo.local' }, pedido({ financiador: ' ' }), AGORA)).rejects.toThrow(/financiador/);
    await expect(criarRascunhoDeTermo(p, { email: 'x@exemplo.local' }, pedido({ servico: 'nao-existe' }), AGORA)).rejects.toThrow(/Serviço desconhecido/);
    await expect(criarRascunhoDeTermo(p, { email: 'x@exemplo.local' }, pedido({ inicioPrevisto: '2027-05-01', fimPrevisto: '2027-01-01' }), AGORA)).rejects.toThrow(/vigência/);
  });
});

describe('regra 24 e L14: rascunho fica fora de tudo', () => {
  beforeEach(async () => {
    await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido({ servico: 'escola' }), AGORA);
  });

  it('com só um rascunho, o catálogo do Orçamento, a lista, os alertas, a busca e a agenda vêm vazios', async () => {
    const fin = await como('financeiro@exemplo.local');
    expect(await termosParaOrcamento(p, AGORA)).toEqual([]);
    expect(await listarTermos(p, fin, AGORA)).toEqual([]);
    expect((await termosComAlertaDeOciosas(p, fin, AGORA)).size).toBe(0);
    expect(await buscar(p, fin, 'Financiador')).toEqual([]);
    expect(await itensDaAgenda(p, fin)).toEqual([]);
  });

  it('a ficha de termo não abre o rascunho como se fosse termo', async () => {
    const fin = await como('financeiro@exemplo.local');
    const id = (await lerTabela(p, Termos)).todos()[0].id;
    await expect(detalharTermo(p, fin, id, AGORA)).rejects.toThrow(/não encontrado/);
  });
});

describe('listar rascunhos e ler o termo para o projeto', () => {
  it('o Financeiro vê o rascunho com o que falta e o aviso de projeto de origem cancelado; quem não é de Parcerias não vê', async () => {
    const { termoId } = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido(), AGORA);
    const fin = await como('financeiro@exemplo.local');
    const lista = await listarRascunhos(p, fin, new Set(['prj-1']));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: termoId, valor: 30000, projetoCodigo: 'PRJ-0001', origemParadaOuCancelada: true });
    expect(lista[0].falta).toEqual(expect.arrayContaining(['número do termo', 'tipo de instrumento', 'cronograma de desembolso']));
    expect((await listarRascunhos(p, fin))[0].origemParadaOuCancelada).toBe(false);
    await expect(listarRascunhos(p, await como('funcionario@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('termoParaProjeto devolve situação e valor a quem vê o termo e null a quem não vê (nunca os valores)', async () => {
    const { termoId } = await criarRascunhoDeTermo(p, { email: 'diretoria@exemplo.local' }, pedido(), AGORA);
    expect(await termoParaProjeto(p, await como('financeiro@exemplo.local'), termoId, AGORA)).toMatchObject({ termoId, parceiro: 'Financiador (exemplo)', situacao: 'rascunho', valor: 30000, inicio: '2027-01-01', fim: '2027-12-31' });
    expect(await termoParaProjeto(p, await como('funcionario@exemplo.local'), termoId, AGORA)).toBeNull();
    expect(await termoParaProjeto(p, await como('financeiro@exemplo.local'), 'nao-existe', AGORA)).toBeNull();
  });
});
