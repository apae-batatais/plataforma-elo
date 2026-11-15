/** Cedidos (C1): quem vê, quem altera, aviso, auditoria e folha intacta. Só dados fictícios. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura, type EstruturaDosModulos } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  alterarValorDoCedido, avisosDeCessao, encerrarCedente, encerrarCessao, ErroValidacaoCedidos, fichaDoCedido, listarCedentes, listarCedidos,
  prorrogarCessao, salvarCedente, salvarCedido,
} from '../aplicacao/cedidos';
import { resumoFolha, salvarParametros, parametrosDaFolha } from '../aplicacao/folha';
import { popularFolhaFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
import { parametrosCom } from '../dominio/folha';
import { manifesto } from '../manifesto';

const ESTRUTURA: EstruturaDosModulos = {
  tabelas: [...TABELAS_ORCAMENTO] as never,
  perfis: manifesto.perfis,
  permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
};
let p: Planilhas;
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const financeiro = () => como('financeiro@exemplo.local');
const dp = () => como('dp@exemplo.local');
const diretoria = () => como('diretoria@exemplo.local');
const leitura = () => como('leitura@exemplo.local');
const coordUr = () => como('coord.ur@exemplo.local');

const HOJE = new Date('2027-03-10T15:00:00Z');

async function cedente(nome = 'Órgão público (fictício)', tipo = 'poder_publico') {
  return salvarCedente(p, await dp(), { nome, tipo, observacao: null });
}
async function cedido(cedenteId: string, extra: Partial<Parameters<typeof salvarCedido>[2]> = {}) {
  return salvarCedido(p, await dp(), {
    colaborador: 'Pessoa cedida (fictícia)', funcao: 'Auxiliar administrativo', cargaHoraria: 160, cedenteId, inicio: '2027-01-01', fimPrevisto: '2027-04-20',
    observacao: null, lotacao: [{ centro: 'ur', percentual: 100 }], valorMensal: 3000, tipoValor: 'informado', ...extra,
  });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, ESTRUTURA);
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
});

describe('quem cede', () => {
  it('Departamento Pessoal cria; nome repetido é recusado; Leitura e Coordenação não veem nem alteram', async () => {
    await cedente();
    await expect(cedente('  órgão PÚBLICO (fictício) ')).rejects.toThrow(ErroValidacaoCedidos);
    expect((await listarCedentes(p, await financeiro())).cedentes).toHaveLength(1);
    expect((await listarCedentes(p, await diretoria())).podeEditar).toBe(false);
    for (const q of [await leitura(), await coordUr()]) {
      await expect(listarCedentes(p, q)).rejects.toThrow(ErroPermissao);
      await expect(salvarCedente(p, q, { nome: 'X outro', tipo: 'outro', observacao: null })).rejects.toThrow(ErroPermissao);
    }
    await expect(salvarCedente(p, await diretoria(), { nome: 'Outra', tipo: 'outro', observacao: null })).rejects.toThrow(ErroPermissao);
  });

  it('não encerra com cedido ativo; encerra (ativo = FALSE) sem cedidos', async () => {
    const id = await cedente();
    const cedidoId = await cedido(id);
    const v = (await listarCedentes(p, await dp())).cedentes[0].versao;
    await expect(encerrarCedente(p, await dp(), id, v, HOJE)).rejects.toThrow(/1 profissional cedido/);
    const f = await fichaDoCedido(p, await dp(), cedidoId, HOJE);
    await encerrarCessao(p, await dp(), cedidoId, f.cedido!.versao, '2027-03-01');
    await encerrarCedente(p, await dp(), id, v, HOJE);
    expect((await listarCedentes(p, await dp())).cedentes).toHaveLength(0);
    expect((await lerTabela(p, (await import('../dados/tabelas')).Cedentes)).todos()[0].ativo).toBe(false);
  });
});

describe('cedido', () => {
  it('cria com valor e lotação; lista com auditoria de leitura; Leitura e Coordenação não veem', async () => {
    const id = await cedente();
    const cid = await cedido(id);
    const l = await listarCedidos(p, await dp(), HOJE);
    expect(l.cedidos[0]).toMatchObject({ funcao: 'Auxiliar administrativo', valorMensal: 3000, tipoValor: 'informado', pendencias: [], cedente: 'Órgão público (fictício)' });
    await fichaDoCedido(p, await financeiro(), cid, HOJE);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Cedidos');
    expect(aud.map((x) => x.acao)).toEqual(expect.arrayContaining(['inclusao', 'leitura']));
    for (const q of [await leitura(), await coordUr()]) {
      await expect(listarCedidos(p, q)).rejects.toThrow(ErroPermissao);
      await expect(fichaDoCedido(p, q, cid)).rejects.toThrow(ErroPermissao);
    }
  });

  it('valida lotação, fim antes do início, valor e cedente inexistente; nada é gravado', async () => {
    const id = await cedente();
    await expect(cedido(id, { lotacao: [{ centro: 'ur', percentual: 90 }] })).rejects.toThrow(/soma 90%/);
    await expect(cedido(id, { fimPrevisto: '2026-12-01' })).rejects.toThrow(/não pode ser antes/);
    await expect(cedido(id, { valorMensal: 0 })).rejects.toThrow(/maior que zero/);
    await expect(cedido('inexistente')).rejects.toThrow(/Escolha quem cede/);
    await expect(cedido(id, { lotacao: [{ centro: 'nao_existe', percentual: 100 }] })).rejects.toThrow(/serviço/);
    expect((await listarCedidos(p, await dp(), HOJE)).cedidos).toHaveLength(0);
  });

  it('mudar o valor grava nova linha com vigência e o histórico fica; auditoria sem valores', async () => {
    const cid = await cedido(await cedente());
    await alterarValorDoCedido(p, await dp(), cid, { valorMensal: 3500, tipoValor: 'equivalente', vigencia: '2027-03-15' });
    const f = await fichaDoCedido(p, await dp(), cid, HOJE);
    expect(f.valor).toEqual({ valorMensal: 3500, tipoValor: 'equivalente', vigencia: '2027-03-01' });
    expect(f.historicoDeValores.map((x) => x.valorMensal)).toEqual([3500, 3000]);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'ValoresCedidos');
    expect(JSON.stringify(aud)).not.toContain('3500');
    await expect(alterarValorDoCedido(p, await leitura(), cid, { valorMensal: 1, tipoValor: 'informado', vigencia: '2027-03-01' })).rejects.toThrow(ErroPermissao);
  });

  it('mudar a lotação grava novo lote; o histórico fica', async () => {
    const cid = await cedido(await cedente());
    const f = await fichaDoCedido(p, await dp(), cid, HOJE);
    await salvarCedido(p, await dp(), {
      id: cid, versao: f.cedido!.versao, colaborador: 'Pessoa cedida (fictícia)', funcao: 'Auxiliar administrativo', cargaHoraria: 160, cedenteId: f.cedido!.cedenteId,
      inicio: '2027-01-01', fimPrevisto: '2027-04-20', observacao: null, lotacao: [{ centro: 'ur', percentual: 50 }, { centro: 'escola', percentual: 50 }],
    }, HOJE);
    expect((await fichaDoCedido(p, await dp(), cid, HOJE)).lotacao).toHaveLength(2);
    expect((await lerTabela(p, (await import('../dados/tabelas')).LotacaoCedidos)).todos()).toHaveLength(3);
  });

  it('versão desatualizada é recusada', async () => {
    const cid = await cedido(await cedente());
    const f = await fichaDoCedido(p, await dp(), cid, HOJE);
    const dados = { id: cid, colaborador: null, funcao: 'Outra função', cargaHoraria: null, cedenteId: f.cedido!.cedenteId, inicio: '2027-01-01', fimPrevisto: null, observacao: null, lotacao: [{ centro: 'ur', percentual: 100 }] };
    await salvarCedido(p, await dp(), { ...dados, versao: f.cedido!.versao });
    await expect(salvarCedido(p, await dp(), { ...dados, funcao: 'Terceira', versao: f.cedido!.versao })).rejects.toThrow();
  });
});

describe('aviso de fim de cessão', () => {
  it('Departamento Pessoal, Financeiro e Diretoria veem com nome; vencida vem primeiro', async () => {
    const id = await cedente();
    await cedido(id, { fimPrevisto: '2027-04-20' }); // 41 dias
    await cedido(id, { colaborador: 'Outra pessoa (fictícia)', fimPrevisto: '2027-03-01' }); // vencida
    await cedido(id, { colaborador: 'Terceira (fictícia)', fimPrevisto: '2027-09-01' }); // fora do prazo
    for (const q of [await dp(), await financeiro(), await diretoria()]) {
      const a = await avisosDeCessao(p, q, HOJE);
      expect(a.itens.map((x) => [x.colaborador, x.vencida])).toEqual([['Outra pessoa (fictícia)', true], ['Pessoa cedida (fictícia)', false]]);
    }
    expect((await avisosDeCessao(p, await dp(), HOJE)).podeEditar).toBe(true);
    expect((await avisosDeCessao(p, await diretoria(), HOJE)).podeEditar).toBe(false);
  });

  it('coordenação recebe só o seu serviço e sem nome; Leitura não recebe', async () => {
    const id = await cedente();
    await cedido(id); // lotado em "ur"
    await cedido(id, { lotacao: [{ centro: 'escola', percentual: 100 }], colaborador: 'Pessoa da escola (fictícia)' });
    const a = await avisosDeCessao(p, await coordUr(), HOJE);
    expect(a.itens).toHaveLength(1);
    expect(a.itens[0].colaborador).toBeNull();
    expect(a.itens[0].funcao).toBe('Auxiliar administrativo');
    expect(JSON.stringify(a)).not.toContain('fictícia)');
    expect((await avisosDeCessao(p, await leitura(), HOJE)).itens).toEqual([]);
  });

  it('o aviso sai ao prorrogar além do prazo ou ao encerrar; prazo é parâmetro', async () => {
    const id = await cedente();
    const a = await cedido(id);
    let f = await fichaDoCedido(p, await dp(), a, HOJE);
    await prorrogarCessao(p, await dp(), a, f.cedido!.versao, '2027-12-31');
    expect((await avisosDeCessao(p, await dp(), HOJE)).itens).toHaveLength(0);
    // prazo maior traz o aviso de volta
    const params = (await parametrosDaFolha(p, await financeiro())).parametros;
    await salvarParametros(p, await financeiro(), { ...params, cessao_aviso_dias: 365 });
    expect((await avisosDeCessao(p, await dp(), HOJE)).itens).toHaveLength(1);
    expect((await avisosDeCessao(p, await dp(), HOJE)).avisoDias).toBe(365);
    f = await fichaDoCedido(p, await dp(), a, HOJE);
    await encerrarCessao(p, await dp(), a, f.cedido!.versao, '2027-03-10');
    expect((await avisosDeCessao(p, await dp(), HOJE)).itens).toHaveLength(0);
    await expect(prorrogarCessao(p, await dp(), a, f.cedido!.versao + 1, '2028-01-01')).rejects.toThrow(/já foi encerrada/);
    await expect(salvarParametros(p, await dp(), { ...params, cessao_aviso_dias: 30 })).rejects.toThrow(ErroPermissao);
    await expect(prorrogarCessao(p, await coordUr(), a, 1, '2028-01-01')).rejects.toThrow(ErroPermissao);
  });
});

describe('folha intacta (regra 7)', () => {
  it('cadastrar cedidos não muda os números da folha', async () => {
    const antes = await resumoFolha(p, await financeiro());
    const id = await cedente();
    await cedido(id);
    const depois = await resumoFolha(p, await financeiro());
    expect(depois.total).toEqual(antes.total);
    expect(depois.caixa).toEqual(antes.caixa);
    expect(depois.centros).toEqual(antes.centros);
    expect(parametrosCom({}).cessao_aviso_dias).toBe(60);
  });
});
