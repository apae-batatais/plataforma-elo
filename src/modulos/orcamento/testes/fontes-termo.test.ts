/**
 * Fontes dos termos (R3a, #140): ligação com a Fonte do cadastro e a conta vinculada, e origens das categorias
 * do plano. Só dados FICTÍCIOS, no formato dos termos reais (3 fontes; federal com custeio e piso).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { listarCadastros, salvarFonte, salvarGrupo } from '../aplicacao/previsao';
import { listarContas, salvarConta } from '../aplicacao/tesouraria';
import { SEM_CATALOGO, type CatalogoParcerias, type FonteDoCatalogo, type TermoDoCatalogo } from '../aplicacao/catalogo-parcerias';
import { ErroFonteTermo, listarFontesDosTermos, salvarLigacao, salvarOrigensDoPlano } from '../aplicacao/fontes-termo';
import { CategoriasPlanoOrigens, FontesTermo, PLANILHA_EXECUCAO, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { contasRepetidas, diferencaDeOrigens, origensValidas, situacaoDaLigacao } from '../dominio/fontes-termo';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

const fonteTermo = (id: string, nome: string, categorias: FonteDoCatalogo['categorias'] = []): FonteDoCatalogo => ({
  id, nome, valorAtual: 120000, parcelas: [], aportesParcelas: [], recursosProprios: null, permiteRemanejar: false, categorias,
});
const termo = (id: string, numero: string, fontes: FonteDoCatalogo[]): TermoDoCatalogo => ({
  id, parceiro: 'Parceiro fictício', numero, tipo: 'termo_de_fomento', inicio: '2026-01-01', fim: '2026-12-31', unidadeMeta: 'pessoas',
  servicos: [], recursosProprios: null, equipe: [], fontes,
});
const CATALOGO: CatalogoParcerias = async () => [
  termo('t1', '001/2026', [
    fonteTermo('f-mun', 'Municipal', [{ categoria: 'Pessoal', valor: 80000 }, { categoria: 'Material', valor: 40000 }]),
    fonteTermo('f-est', 'Estadual'),
    fonteTermo('f-fed', 'Federal – custeio'),
    fonteTermo('f-piso', 'Federal – piso da enfermagem'),
  ]),
];

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

async function cadastros() {
  const f = await fin();
  await salvarFonte(p, f, { nome: 'Fundo A', natureza: 'publica', uso: 'restrita' });
  await salvarFonte(p, f, { nome: 'Fundo B', natureza: 'publica', uso: 'restrita' });
  await salvarGrupo(p, f, { nome: 'Material de consumo', rh: false });
  const cad = await listarCadastros(p, f);
  const fa = cad.fontes.ativos.find((x) => x.nome === 'Fundo A')!;
  const fb = cad.fontes.ativos.find((x) => x.nome === 'Fundo B')!;
  await salvarConta(p, f, { banco: 'Banco Fictício V1', agencia: '1', conta: '1-1', tipo: 'movimento', classe: 'vinculada', fonteId: fa.id, unidade: null });
  await salvarConta(p, f, { banco: 'Banco Fictício V2', agencia: '2', conta: '2-2', tipo: 'movimento', classe: 'vinculada', fonteId: fb.id, unidade: null });
  await salvarConta(p, f, { banco: 'Banco Fictício L', agencia: '3', conta: '3-3', tipo: 'movimento', classe: 'livre_disponivel', fonteId: null, unidade: null });
  const lista = await listarFontesDosTermos(p, f, CATALOGO);
  const conta = (parte: string) => lista.opcoes.contas.find((c) => c.rotulo.includes(parte))!.id;
  return { fa, fb, v1: conta('V1'), v2: conta('V2'), livre: (await listarContas(p, f)).ativas.find((c) => c.banco === 'Banco Fictício L')!.id, grupo: lista.opcoes.grupos[0]!.id, lista };
}

describe('regras puras', () => {
  const contas = new Map([['c1', { id: 'c1', classe: 'vinculada', fonteId: 'A' }]]);
  it('situação da ligação: sem ligação, ligada e conta que não combina', () => {
    expect(situacaoDaLigacao(undefined, contas)).toBe('sem_ligacao');
    expect(situacaoDaLigacao({ fonteTermoId: 'x', fonteId: 'A', contaId: null }, contas)).toBe('ligada');
    expect(situacaoDaLigacao({ fonteTermoId: 'x', fonteId: 'A', contaId: 'c1' }, contas)).toBe('ligada');
    expect(situacaoDaLigacao({ fonteTermoId: 'x', fonteId: 'B', contaId: 'c1' }, contas)).toBe('nao_combina');
  });
  it('conta usada por duas fontes aparece como repetida', () => {
    const r = contasRepetidas([{ fonteTermoId: 'a', fonteId: 'A', contaId: 'c' }, { fonteTermoId: 'b', fonteId: 'A', contaId: 'c' }, { fonteTermoId: 'z', fonteId: 'A', contaId: null }]);
    expect([...r.keys()]).toEqual(['c']);
  });
  it('origens: descarta grupo desconhecido e repetição; diferença só inclui e encerra o que mudou', () => {
    expect(origensValidas(['folha', 'folha', 'grupo:g1', 'grupo:x', 'qualquer'], new Set(['g1']))).toEqual(['folha', 'grupo:g1']);
    expect(diferencaDeOrigens(['folha', 'grupo:a'], ['grupo:a', 'grupo:b'])).toEqual({ incluir: ['grupo:b'], encerrar: ['folha'] });
  });
});

describe('ligar fontes dos termos', () => {
  it('sem Parcerias o catálogo é vazio e a tela não tem linhas', async () => {
    const l = await listarFontesDosTermos(p, await fin(), SEM_CATALOGO);
    expect(l.linhas).toEqual([]);
    expect(l.semLigacao).toBe(0);
  });

  it('lista as 4 fontes sem ligação e conta as pendentes', async () => {
    const { lista } = await cadastros();
    expect(lista.linhas.map((x) => x.fonte)).toEqual(['Municipal', 'Estadual', 'Federal – custeio', 'Federal – piso da enfermagem']);
    expect(lista.semLigacao).toBe(4);
    expect(lista.opcoes.contas).toHaveLength(2); // só vinculadas
  });

  it('liga fonte e conta; a situação vira "ligada" e a auditoria guarda só nomes de colunas', async () => {
    const { fa, v1 } = await cadastros();
    const f = await fin();
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: v1, versao: 0 });
    const l = await listarFontesDosTermos(p, f, CATALOGO);
    const linha = l.linhas.find((x) => x.fonteTermoId === 'f-mun')!;
    expect(linha).toMatchObject({ fonteId: fa.id, contaId: v1, situacao: 'ligada' });
    expect(l.semLigacao).toBe(3);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'FontesTermo');
    expect(aud.map((a) => a.acao)).toEqual(['inclusao']);
  });

  it('conta de outra Fonte avisa "conta e fonte não combinam", sem bloquear', async () => {
    const { fa, v2 } = await cadastros();
    const f = await fin();
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: v2, versao: 0 });
    const l = await listarFontesDosTermos(p, f, CATALOGO);
    expect(l.linhas[0]!.situacao).toBe('nao_combina');
  });

  it('só conta vinculada é aceita; fonte do cadastro é obrigatória', async () => {
    const { fa, livre } = await cadastros();
    const f = await fin();
    await expect(salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: livre, versao: 0 })).rejects.toThrow(/conta vinculada/);
    await expect(salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: 'inexistente', contaId: null, versao: 0 })).rejects.toThrow(ErroFonteTermo);
    await expect(salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'nao-existe', fonteId: fa.id, contaId: null, versao: 0 })).rejects.toThrow(/não está em nenhum termo/);
  });

  it('a mesma conta em duas fontes ativas é aviso nas duas linhas, não erro (federal com 2 contas)', async () => {
    const { fa, v1 } = await cadastros();
    const f = await fin();
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-fed', fonteId: fa.id, contaId: v1, versao: 0 });
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-piso', fonteId: fa.id, contaId: v1, versao: 0 });
    const l = await listarFontesDosTermos(p, f, CATALOGO);
    expect(l.linhas.find((x) => x.fonteTermoId === 'f-fed')!.contaRepetidaCom).toEqual(['001/2026 · Federal – piso da enfermagem']);
    expect(l.linhas.find((x) => x.fonteTermoId === 'f-mun')!.contaRepetidaCom).toEqual([]);
  });

  it('trocar a ligação usa a versão lida; versão velha dá conflito e nada muda', async () => {
    const { fa, fb } = await cadastros();
    const f = await fin();
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: null, versao: 0 });
    const versao = (await listarFontesDosTermos(p, f, CATALOGO)).linhas[0]!.versao;
    await salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fb.id, contaId: null, versao });
    await expect(salvarLigacao(p, f, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: null, versao })).rejects.toThrow(ErroConflito);
    expect((await listarFontesDosTermos(p, f, CATALOGO)).linhas[0]!.fonteId).toBe(fb.id);
    expect((await lerTabela(p, FontesTermo)).ativos()).toHaveLength(1);
  });
});

describe('origens das categorias do plano', () => {
  it('grava, troca e tira origens; tirar encerra a linha (nada é apagado)', async () => {
    const { grupo } = await cadastros();
    const f = await fin();
    await salvarOrigensDoPlano(p, f, CATALOGO, 'f-mun', [
      { categoria: 'Pessoal', origens: ['folha'] },
      { categoria: 'Material', origens: [`grupo:${grupo}`, 'grupo:inexistente'] },
      { categoria: 'Fora do plano', origens: ['folha'] },
    ]);
    let l = await listarFontesDosTermos(p, f, CATALOGO);
    expect(l.linhas[0]!.categorias).toEqual([
      { categoria: 'Pessoal', valor: 80000, origens: ['folha'] },
      { categoria: 'Material', valor: 40000, origens: [`grupo:${grupo}`] },
    ]);
    await salvarOrigensDoPlano(p, f, CATALOGO, 'f-mun', [{ categoria: 'Pessoal', origens: [] }]);
    l = await listarFontesDosTermos(p, f, CATALOGO);
    expect(l.linhas[0]!.categorias[0]!.origens).toEqual([]);
    const todas = (await lerTabela(p, CategoriasPlanoOrigens)).todos();
    expect(todas).toHaveLength(2);
    expect(todas.filter((o) => !o.ativo)).toHaveLength(1);
    const aud = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'CategoriasPlanoOrigens'));
    expect(aud).not.toContain('Pessoal');
  });

  it('gravar de novo o mesmo não cria linha nova', async () => {
    await cadastros();
    const f = await fin();
    const dados = [{ categoria: 'Pessoal', origens: ['folha'] }];
    await salvarOrigensDoPlano(p, f, CATALOGO, 'f-mun', dados);
    await salvarOrigensDoPlano(p, f, CATALOGO, 'f-mun', dados);
    expect((await lerTabela(p, CategoriasPlanoOrigens)).todos()).toHaveLength(1);
  });
});

describe('quem vê e quem altera', () => {
  it('Financeiro, Diretoria e leitura veem; só o Financeiro liga', async () => {
    const { fa } = await cadastros();
    for (const email of ['diretoria@exemplo.local', 'leitura@exemplo.local']) {
      const q = await como(email);
      expect((await listarFontesDosTermos(p, q, CATALOGO)).linhas).toHaveLength(4);
      await expect(salvarLigacao(p, q, CATALOGO, { fonteTermoId: 'f-mun', fonteId: fa.id, contaId: null, versao: 0 })).rejects.toThrow(ErroPermissao);
      await expect(salvarOrigensDoPlano(p, q, CATALOGO, 'f-mun', [])).rejects.toThrow(ErroPermissao);
    }
  });

  it('quem não vê o painel (coordenação, compras) não lê a lista com os valores do termo', async () => {
    await cadastros();
    for (const email of ['coord.ur@exemplo.local', 'compras@exemplo.local']) {
      const q = await como(email);
      await expect(listarFontesDosTermos(p, q, CATALOGO)).rejects.toThrow(ErroPermissao);
    }
  });
});
