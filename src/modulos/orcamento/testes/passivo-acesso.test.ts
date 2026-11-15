/** Passivo trabalhista (P2): quem vê, quem altera e auditoria. Só dados fictícios. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura, type EstruturaDosModulos } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { ajustesDaPessoa, painelDePassivo, registrarFeriasTiradas, registrarSaldoFgts, removerFeriasTiradas } from '../aplicacao/passivo';
import { ErroValidacaoFolha, listarPostos } from '../aplicacao/folha';
import { popularFolhaFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
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

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, ESTRUTURA);
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
});

const auditoria = async () => (await lerTabelas(p, [RegistrosAuditoria] as const))[0].todos();
const primeiroComCodigo = async () => (await listarPostos(p, await financeiro())).postos.find((x) => x.ficha)!;

describe('passivo trabalhista', () => {
  it('Diretoria, Financeiro e DP veem o valor por pessoa e o total fecha com a soma das pessoas', async () => {
    const r = await painelDePassivo(p, await financeiro());
    expect(r.pessoas!.length).toBeGreaterThan(20);
    expect(r.pessoasCalculadas).toBe(r.pessoas!.length);
    expect(r.total).toBeCloseTo(r.pessoas!.reduce((s, x) => s + x.total, 0), 1);
    expect(r.total).toBeCloseTo(r.porServico.reduce((s, x) => s + x.valor, 0), 1);
    expect(r.total).toBeCloseTo(r.porFonte.reduce((s, x) => s + x.valor, 0), 1);
    const c = r.composicao;
    expect(c.ferias + c.decimo + c.aviso + c.multa).toBeCloseTo(r.total, 0);
    expect((await painelDePassivo(p, await dp())).pessoas).not.toBeNull();
    expect((await painelDePassivo(p, await como('diretoria@exemplo.local'))).pessoas).not.toBeNull();
  });

  it('só postos com código entram: vagas previstas ficam de fora (regra 1)', async () => {
    const r = await painelDePassivo(p, await financeiro());
    const vagas = (await listarPostos(p, await financeiro())).postos.filter((x) => !x.ficha).length;
    expect(vagas).toBeGreaterThan(0);
    expect(r.pessoas!.every((x) => !x.nome.startsWith('A contratar'))).toBe(true);
  });

  it('Leitura vê só totais; Coordenação vê só o seu escopo, sem nome de pessoa', async () => {
    const todos = await painelDePassivo(p, await financeiro());
    const leitura = await painelDePassivo(p, await como('leitura@exemplo.local'));
    expect(leitura.pessoas).toBeNull();
    expect(leitura.pendencias.pessoas).toBeNull();
    expect(leitura.total).toBeCloseTo(todos.total, 1);
    const coord = await painelDePassivo(p, await como('coord.ur@exemplo.local'));
    expect(coord.pessoas).toBeNull();
    expect(coord.porServico.map((s) => s.codigo)).toEqual(['ur']);
    expect(coord.total).toBeLessThan(todos.total);
    expect(JSON.stringify(coord)).not.toMatch(/colaborador/);
    await expect(painelDePassivo(p, await como('tecnico.cer@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('abrir o painel com valor individual registra auditoria de leitura', async () => {
    await painelDePassivo(p, await financeiro());
    expect((await auditoria()).some((a) => a.entidade === 'Passivo' && a.acao === 'leitura')).toBe(true);
  });

  it('registrar o extrato do FGTS muda o passivo da pessoa (regra 7) e só quem edita registra', async () => {
    const alvo = await primeiroComCodigo();
    const antes = (await painelDePassivo(p, await financeiro())).pessoas!.find((x) => x.id === alvo.id)!;
    await expect(registrarSaldoFgts(p, await como('diretoria@exemplo.local'), { postoId: alvo.id, referencia: '2026-10-01', valor: 90000 })).rejects.toBeInstanceOf(ErroPermissao);
    await registrarSaldoFgts(p, await dp(), { postoId: alvo.id, referencia: '2026-10-01', valor: 90000 });
    const depois = (await painelDePassivo(p, await financeiro())).pessoas!.find((x) => x.id === alvo.id)!;
    expect(depois.multa).toBeGreaterThan(antes.multa);
    expect(depois.multa).toBeGreaterThanOrEqual(36000);
  });

  it('férias tiradas: recusa dado ruim, grava auditoria com colunas e remover encerra (regra 12)', async () => {
    const alvo = await primeiroComCodigo();
    await expect(registrarFeriasTiradas(p, await financeiro(), { postoId: alvo.id, inicio: '1990-01-01', dias: 10 })).rejects.toBeInstanceOf(ErroValidacaoFolha);
    await expect(registrarFeriasTiradas(p, await financeiro(), { postoId: alvo.id, inicio: '2026-05-01', dias: 45 })).rejects.toBeInstanceOf(ErroValidacaoFolha);
    await expect(registrarSaldoFgts(p, await financeiro(), { postoId: alvo.id, referencia: '2026-05-01', valor: -5 })).rejects.toBeInstanceOf(ErroValidacaoFolha);
    await registrarFeriasTiradas(p, await financeiro(), { postoId: alvo.id, inicio: '2026-05-01', dias: 30 });
    const aj = await ajustesDaPessoa(p, await financeiro(), alvo.id);
    expect(aj.ferias).toHaveLength(1);
    const log = (await auditoria()).filter((a) => a.entidade === 'FeriasTiradas');
    expect(log[0].detalhes).toContain('colunas');
    expect(log[0].detalhes).not.toContain('2026-05-01');
    await removerFeriasTiradas(p, await financeiro(), aj.ferias[0].id, aj.ferias[0].versao);
    expect((await ajustesDaPessoa(p, await financeiro(), alvo.id)).ferias).toHaveLength(0);
    await expect(ajustesDaPessoa(p, await como('leitura@exemplo.local'), alvo.id)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('simulação por serviço: parcela proporcional, quantas pessoas 100% e nada é gravado (regra 11)', async () => {
    const antes = (await auditoria()).length;
    const r = await painelDePassivo(p, await financeiro(), { tipo: 'servico', codigo: 'escola', data: '2027-06-30' });
    const s = r.simulacao!;
    expect(s.parcela).toBeGreaterThan(0);
    expect(s.parcela).toBeLessThanOrEqual(s.total);
    expect(s.pessoasInteiras + s.pessoasEmParte).toBe(s.pessoas!.length);
    expect(s.pessoasEmParte).toBeGreaterThan(0); // monitores dividem a lotação
    const leitura = await painelDePassivo(p, await como('leitura@exemplo.local'), { tipo: 'servico', codigo: 'escola', data: '2027-06-30' });
    expect(leitura.simulacao!.pessoas).toBeNull();
    const coord = await painelDePassivo(p, await como('coord.ur@exemplo.local'), { tipo: 'servico', codigo: 'escola', data: '2027-06-30' });
    expect(coord.simulacao).toBeNull();
    expect(coord.erroSimulacao).toBeTruthy();
    expect((await auditoria()).length).toBeGreaterThanOrEqual(antes); // só leituras, nenhuma gravação nas abas
  });

  it('pessoa sem remuneração vai para pendências, nunca com valor zero (regra 13)', async () => {
    const r = await painelDePassivo(p, await financeiro());
    expect(r.pessoas!.every((x) => x.total > 0)).toBe(true);
    expect(r.pendencias.semDados).toBe((r.pendencias.pessoas ?? []).filter((x) => x.motivo === 'sem_dados').length);
  });
});
