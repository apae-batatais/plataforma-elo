/** Cedidos (C2): custo real nas duas visões, receita = despesa, indicadores e acesso. Só dados fictícios. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { cedidosDoAno } from '../aplicacao/cedidos-custo';
import { salvarCedente, salvarCedido } from '../aplicacao/cedidos';
import { painelPorArea } from '../aplicacao/analise-area';
import { painelGeral } from '../aplicacao/painel-geral';
import { lerPrevisao } from '../aplicacao/previsao';
import { resumoFolha } from '../aplicacao/folha';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
import { custoDosCedidos, dividirEmCentavos } from '../dominio/cedidos-custo';
import { manifesto } from '../manifesto';

let p: Planilhas;
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const dp = () => como('dp@exemplo.local');
const financeiro = () => como('financeiro@exemplo.local');
const leitura = () => como('leitura@exemplo.local');
const coordUr = () => como('coord.ur@exemplo.local');
const ANO = 2027;

async function cadastrar() {
  const quem = await dp();
  const publico = await salvarCedente(p, quem, { nome: 'Órgão público (fictício)', tipo: 'poder_publico', observacao: null });
  const empresa = await salvarCedente(p, quem, { nome: 'Empresa (fictícia)', tipo: 'empresa_aprendiz', observacao: null });
  const base = { colaborador: 'Pessoa cedida (fictícia)', funcao: 'Auxiliar', cargaHoraria: null, inicio: '2027-01-01', fimPrevisto: null, observacao: null };
  await salvarCedido(p, quem, { ...base, cedenteId: publico, lotacao: [{ centro: 'ur', percentual: 100 }], valorMensal: 3000, tipoValor: 'informado' });
  // Valor que não divide certinho: 1000,01 em 3 partes.
  await salvarCedido(p, quem, { ...base, cedenteId: empresa, funcao: 'Aprendiz', lotacao: [{ centro: 'ur', percentual: 33.33 }, { centro: 'administracao', percentual: 66.67 }], valorMensal: 1000.01, tipoValor: 'equivalente' });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
  await popularPrevisaoFicticia(p);
});

describe('regra pura', () => {
  it('divide em centavos sem perder nem criar nada', () => {
    const partes = dividirEmCentavos(100001, [{ centro: 'a', percentual: 33.33 }, { centro: 'b', percentual: 66.67 }]);
    expect(partes.reduce((s, v) => s + v, 0)).toBe(100001);
  });
  it('cedido sem valor ou sem lotação de 100% fica fora e é contado', () => {
    const cessao = { inicio: '2027-01-01', fim_previsto: null, encerramento: null };
    const r = custoDosCedidos(ANO, [
      { id: '1', cedenteId: 'c', tipoCedente: 'outro', cessao, valorNoMes: () => null, lotacaoNoMes: () => [{ centro: 'ur', percentual: 100 }] },
      { id: '2', cedenteId: 'c', tipoCedente: 'outro', cessao, valorNoMes: () => 100, lotacaoNoMes: () => [{ centro: 'ur', percentual: 90 }] },
    ]);
    expect(r.porServico.size).toBe(0);
    expect(r.semNumero).toBe(2);
  });
  it('mês cheio: começa em março e conta de março a dezembro', () => {
    const r = custoDosCedidos(ANO, [{ id: '1', cedenteId: 'c', tipoCedente: 'outro', cessao: { inicio: '2027-03-15', fim_previsto: '2027-06-10', encerramento: null }, valorNoMes: () => 100, lotacaoNoMes: () => [{ centro: 'ur', percentual: 100 }] }]);
    expect(r.porServico.get('ur')).toEqual([0, 0, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0]);
  });
});

describe('regressão: sem cedidos nada muda', () => {
  it('sem cedidos cadastrados, as duas visões são iguais e não há seletor', async () => {
    const q = await leitura();
    const com = await lerPrevisao(p, q, ANO);
    const sem = await lerPrevisao(p, q, ANO, { incluirCedidos: false });
    expect(com.cedidos.temCedidos).toBe(false);
    expect(com.totais).toEqual(sem.totais);
    expect(com.indicadores).toEqual(sem.indicadores);
  });

  it('com cedidos cadastrados, a visão "sem" é igual à de antes, centavo a centavo', async () => {
    const q = await financeiro();
    const antes = await lerPrevisao(p, q, ANO);
    const folhaAntes = await resumoFolha(p, q);
    await cadastrar();
    const sem = await lerPrevisao(p, q, ANO, { incluirCedidos: false });
    expect(sem.totais).toEqual(antes.totais);
    expect(sem.indicadores).toEqual(antes.indicadores);
    expect(await resumoFolha(p, q)).toEqual(folhaAntes);
    const com = await lerPrevisao(p, q, ANO);
    expect(com.indicadoresSemCedidos).toEqual(antes.indicadores);
  });
});

describe('visão com cedidos', () => {
  it('receita é igual à despesa em todo mês e o resultado é igual nas duas visões', async () => {
    await cadastrar();
    const q = await financeiro();
    const c = await cedidosDoAno(p, q, ANO);
    expect(c.temCedidos).toBe(true);
    const receita = c.porCedente.reduce((acc, x) => acc.map((v, i) => v + x.mensal[i]), Array(12).fill(0) as number[]).map((v) => Math.round(v * 100) / 100);
    expect(receita).toEqual(c.mensal);
    expect(c.mensal[0]).toBe(4000.01);
    const com = await lerPrevisao(p, q, ANO);
    const sem = await lerPrevisao(p, q, ANO, { incluirCedidos: false });
    expect(com.incluiCedidos).toBe(true);
    expect(Math.round((com.totais.despesa.anual - sem.totais.despesa.anual) * 100)).toBe(Math.round(c.anual * 100));
    expect(Math.round((com.totais.receita.anual - sem.totais.receita.anual) * 100)).toBe(Math.round(c.anual * 100));
    expect(com.indicadores.resultado).toBe(sem.indicadores.resultado);
    for (let m = 0; m < 12; m++) expect(Math.round((com.totais.receita.mensal[m] - sem.totais.receita.mensal[m]) * 100)).toBe(Math.round((com.totais.despesa.mensal[m] - sem.totais.despesa.mensal[m]) * 100));
    expect(com.receitasCedidos.map((r) => r.descricao).sort()).toEqual(['Cedidos — Empresa (fictícia)', 'Cedidos — Órgão público (fictício)']);
  });

  it('indicadores: poder público conta como público, empresa não; cedido nunca é recurso livre', async () => {
    await cadastrar();
    const q = await financeiro();
    const com = await lerPrevisao(p, q, ANO);
    const sem = await lerPrevisao(p, q, ANO, { incluirCedidos: false });
    const c = await cedidosDoAno(p, q, ANO);
    const publico = c.porCedente.find((x) => x.tipo === 'poder_publico')!.anual;
    const rec = sem.totais.receita.anual;
    const pubSem = sem.indicadores.dependenciaPublica! * rec / 100;
    expect(com.indicadores.dependenciaPublica).toBeCloseTo(((pubSem + publico) / (rec + c.anual)) * 100, 1);
    const livreSem = sem.indicadores.recursosLivres! * rec / 100;
    expect(com.indicadores.recursosLivres).toBeCloseTo((livreSem / (rec + c.anual)) * 100, 1);
    const rhSem = sem.indicadores.folhaSobreReceita! * rec / 100;
    expect(com.indicadores.folhaSobreReceita).toBeCloseTo(((rhSem + c.anual) / (rec + c.anual)) * 100, 1);
    expect(com.indicadoresSemCedidos).toEqual(sem.indicadores);
  });

  it('painel geral: seletor liga e desliga; o total desligado é o de hoje', async () => {
    const q = await financeiro();
    const antes = await painelGeral(p, q);
    await cadastrar();
    const desligado = await painelGeral(p, q, { incluirCedidos: false });
    expect(desligado.anos.map((a) => a.despesa)).toEqual(antes.anos.map((a) => a.despesa));
    const ligado = await painelGeral(p, q);
    const a27 = ligado.anos.find((a) => a.ano === ANO)!;
    expect(a27.temCedidos).toBe(true);
    expect(a27.despesa).toBeGreaterThan(desligado.anos.find((a) => a.ano === ANO)!.despesa);
    expect(a27.resultado).toBe(desligado.anos.find((a) => a.ano === ANO)!.resultado);
    expect(a27.porGrupo['Recursos Humanos']).toBeCloseTo(a27.rh, 1);
  });

  it('análise por área: cedido entra no custo do serviço e no número de profissionais; o total do orçamento só cresce pelo cedido', async () => {
    const q = await financeiro();
    const semCad = await painelPorArea(p, q, { ano: ANO });
    await cadastrar();
    const com = await painelPorArea(p, q, { ano: ANO });
    expect(com.incluiCedidos).toBe(true);
    expect(com.analiseSemCedidos).not.toBeNull();
    expect(com.analiseSemCedidos!.totais.orcamento).toBe(semCad.analise!.totais.orcamento);
    const c = await cedidosDoAno(p, q, ANO);
    expect(Math.round((com.analise!.totais.orcamento - com.analiseSemCedidos!.totais.orcamento) * 100)).toBe(Math.round(c.anual * 100));
    const desligado = await painelPorArea(p, q, { ano: ANO, incluirCedidos: false });
    expect(desligado.analise).toEqual(semCad.analise);
    expect(desligado.analiseSemCedidos).toBeNull();
  });
});

describe('acesso', () => {
  it('quem não vê a folha não vê cedidos; leitura vê só totais, sem nome', async () => {
    await cadastrar();
    const c = await cedidosDoAno(p, await leitura(), ANO);
    expect(JSON.stringify(c)).not.toContain('Pessoa cedida');
    // Coordenação (folha.ver só no escopo) não tem a visão global: fica sem a parcela.
    expect((await cedidosDoAno(p, await coordUr(), ANO)).temCedidos).toBe(false);
  });
});
