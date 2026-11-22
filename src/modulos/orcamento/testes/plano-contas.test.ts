/**
 * Plano de contas estruturado (entrega 1 da #221), com dados FICTÍCIOS: cadastros, plano em lote por exercício,
 * vigência, copiar do ano anterior e quem vê e quem altera.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { baixarPlanoCsv } from '../aplicacao/baixar-planilha';
import {
  excluirAreaPlano, excluirItemContabil, lerPlano, listarCadastrosDoPlano, reativarAreaPlano, reativarItemContabil,
  salvarAreaPlano, salvarItemContabil, salvarPlano,
} from '../aplicacao/plano-contas';
import { listarCadastros, salvarGrupo } from '../aplicacao/previsao';
import { popularPlanoContasFicticio, popularPrevisaoFicticia } from '../dados/ficticios';
import { PlanoContas, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { linhasDoMarcado, planosIguais, validarPlano, versaoDoFimDoAno, versaoVigente, vigenciaDentroDoAno, vigenciaPadrao, type LinhaGravada } from '../dominio/plano-contas';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularPrevisaoFicticia(p);
});

const L = (area_id: string, grupo_id: string, item_id: string | null = null) => ({ area_id, grupo_id, item_id });

async function basico() {
  const q = await fin();
  await salvarAreaPlano(p, q, { nome: 'Área A', codigo: 'A1' });
  await salvarAreaPlano(p, q, { nome: 'Área B' });
  const { grupos } = await listarCadastros(p, q);
  const g = grupos.ativos[0].id;
  const g2 = grupos.ativos[1].id;
  await salvarItemContabil(p, q, { grupo_id: g, nome: 'Item 1', codigo: 'I-1' });
  await salvarItemContabil(p, q, { grupo_id: g, nome: 'Item 2' });
  await salvarItemContabil(p, q, { grupo_id: g2, nome: 'Item 3' });
  const c = await listarCadastrosDoPlano(p, q);
  return { q, a: c.areas.ativos, i: c.itens.ativos, g, g2 };
}

describe('regras puras', () => {
  const gravada = (exercicio: number, lote: string, vigencia: string, item: string | null = null): LinhaGravada => ({ exercicio, lote, vigencia, area_id: 'a', grupo_id: 'g', item_id: item });

  it('vale o lote mais recente cuja vigência já começou; o de um ano não mexe no do outro', () => {
    const g = [gravada(2026, 'l1', '2026-01-01'), gravada(2026, 'l2', '2026-06-01', 'i'), gravada(2027, 'l3', '2027-01-01')];
    expect(versaoVigente(g, 2026, '2026-03-01')?.lote).toBe('l1');
    expect(versaoVigente(g, 2026, '2026-06-01')?.lote).toBe('l2');
    expect(versaoVigente(g, 2026, '2025-12-31')).toBeUndefined();
    expect(versaoDoFimDoAno(g, 2026)?.lote).toBe('l2');
    expect(versaoDoFimDoAno(g, 2027)?.lote).toBe('l3');
    expect(versaoDoFimDoAno(g, 2028)).toBeUndefined();
  });

  it('vigência: dentro do ano; padrão é 1º de janeiro ou hoje', () => {
    expect(vigenciaDentroDoAno(2027, '2027-05-10')).toBe(true);
    expect(vigenciaDentroDoAno(2027, '2026-12-31')).toBe(false);
    expect(vigenciaDentroDoAno(2027, '2027-02-30')).toBe(false);
    expect(vigenciaDentroDoAno(2027, '10/05/2027')).toBe(false);
    expect(vigenciaPadrao(2027, '2026-11-20')).toBe('2027-01-01');
    expect(vigenciaPadrao(2026, '2026-11-20')).toBe('2026-11-20');
    expect(vigenciaPadrao(2025, '2026-11-20')).toBe('2025-01-01');
  });

  it('marcar um item inclui o grupo; grupo sem itens vira linha sem item', () => {
    const l = linhasDoMarcado([{ area_id: 'a', grupo_id: 'g2' }], [{ area_id: 'a', grupo_id: 'g', item_id: 'i1' }, { area_id: 'a', grupo_id: 'g', item_id: 'i1' }]);
    expect(l).toHaveLength(2);
    expect(l).toContainEqual({ area_id: 'a', grupo_id: 'g2', item_id: null });
    expect(l).toContainEqual({ area_id: 'a', grupo_id: 'g', item_id: 'i1' });
  });

  it('consistência: item de outro grupo, repetições e itens encerrados são recusados', () => {
    const ctx = { areasAtivas: new Set(['a']), gruposAtivos: new Set(['g', 'h']), itensAtivos: new Set(['i']), grupoDoItem: new Map([['i', 'g']]) };
    expect(validarPlano([L('a', 'g', 'i')], ctx)).toEqual([]);
    expect(validarPlano([], ctx)[0]).toMatch(/vazio/);
    expect(validarPlano([L('a', 'h', 'i')], ctx).join()).toMatch(/grupo errado/);
    expect(validarPlano([L('a', 'g'), L('a', 'g')], ctx).join()).toMatch(/repetido/);
    expect(validarPlano([L('a', 'g'), L('a', 'g', 'i')], ctx).join()).toMatch(/com e sem itens/);
    expect(validarPlano([L('z', 'g')], ctx).join()).toMatch(/área/);
    expect(validarPlano([L('a', 'g', 'x')], ctx).join()).toMatch(/item/);
    expect(planosIguais([L('a', 'g', 'i'), L('a', 'h')], [L('a', 'h'), L('a', 'g', 'i')])).toBe(true);
  });
});

describe('cadastros: Áreas e Itens', () => {
  it('nome obrigatório e único (sem diferença de maiúscula), código único entre ativos', async () => {
    const q = await fin();
    await salvarAreaPlano(p, q, { nome: 'Educação', codigo: ' 12.3 ' });
    await expect(salvarAreaPlano(p, q, { nome: '  educação ' })).rejects.toThrow(/já existe/i);
    await expect(salvarAreaPlano(p, q, { nome: '' })).rejects.toThrow(/Informe o nome/);
    await expect(salvarAreaPlano(p, q, { nome: 'Saúde', codigo: '12.3' })).rejects.toThrow(/código 12.3 já é/);
    await expect(salvarAreaPlano(p, q, { nome: 'Saúde', codigo: 'a b' })).rejects.toThrow(/letras, números/);
    const { areas } = await listarCadastrosDoPlano(p, q);
    expect(areas.ativos[0].codigo).toBe('12.3');
  });

  it('item pertence a um só grupo, e o nome/código só se repetem em grupos diferentes', async () => {
    const { q, g, g2 } = await basico();
    await expect(salvarItemContabil(p, q, { grupo_id: g, nome: 'item 1' })).rejects.toThrow(/já existe/i);
    await expect(salvarItemContabil(p, q, { grupo_id: g, nome: 'Outro', codigo: 'i-1' })).rejects.toThrow(/código/);
    await salvarItemContabil(p, q, { grupo_id: g2, nome: 'Item 1', codigo: 'I-1' });
    await expect(salvarItemContabil(p, q, { grupo_id: 'nao-existe', nome: 'X' })).rejects.toThrow(/Grupo de contas não encontrado/);
    const { itens } = await listarCadastrosDoPlano(p, q);
    const i3 = itens.ativos.find((i) => i.nome === 'Item 3')!;
    await expect(salvarItemContabil(p, q, { id: i3.id, versao: i3.versao, grupo_id: g, nome: 'Item 3' })).rejects.toThrow(/só grupo/);
  });

  it('excluir encerra (nada se apaga) e reativar recusa nome ou código tomados', async () => {
    const q = await fin();
    await salvarAreaPlano(p, q, { nome: 'Área X', codigo: 'X1' });
    let c = await listarCadastrosDoPlano(p, q);
    const x = c.areas.ativos[0];
    await excluirAreaPlano(p, q, x.id, x.versao);
    c = await listarCadastrosDoPlano(p, q);
    expect(c.areas.ativos).toHaveLength(0);
    expect(c.areas.excluidos).toHaveLength(1);
    await salvarAreaPlano(p, q, { nome: 'Outra', codigo: 'X1' });
    await expect(reativarAreaPlano(p, q, x.id, c.areas.excluidos[0].versao)).rejects.toThrow(/código X1 agora é/);
    await expect(salvarAreaPlano(p, q, { nome: 'Área X' })).rejects.toThrow(/excluídos/);
  });

  it('excluir item com grupo encerrado: reativar pede o grupo antes', async () => {
    const { q, i } = await basico();
    const it = i[0];
    await excluirItemContabil(p, q, it.id, it.versao);
    const c = await listarCadastrosDoPlano(p, q);
    await reativarItemContabil(p, q, it.id, c.itens.excluidos[0].versao);
    expect((await listarCadastrosDoPlano(p, q)).itens.ativos).toHaveLength(3);
  });

  it('Grupo de Contas é o mesmo GruposGasto: o código antigo continua e vale como código do grupo', async () => {
    const q = await fin();
    const { grupos } = await listarCadastros(p, q);
    const g = grupos.ativos[0];
    await salvarGrupo(p, q, { id: g.id, versao: g.versao, nome: g.nome, rh: g.rh, codigo_conta: '3.1.02.001' });
    const c = await listarCadastrosDoPlano(p, q);
    expect(c.grupos.find((x) => x.id === g.id)?.codigo_conta).toBe('3.1.02.001');
  });

  it('audita só as colunas, nunca os valores', async () => {
    const q = await fin();
    await salvarAreaPlano(p, q, { nome: 'Sigilosa 9876' });
    const c = await listarCadastrosDoPlano(p, q);
    await salvarAreaPlano(p, q, { id: c.areas.ativos[0].id, versao: c.areas.ativos[0].versao, nome: 'Outro nome 5555' });
    const [auditoria] = await lerTabelas(p, [RegistrosAuditoria] as const);
    const texto = JSON.stringify(auditoria.todos().filter((a) => a.entidade === 'AreasPlano'));
    expect(texto).toContain('alteracao');
    expect(texto).toContain('nome');
    expect(texto).not.toMatch(/9876|5555/);
  });
});

describe('plano por exercício', () => {
  it('grava um lote completo; o seguinte nunca altera nem apaga o anterior', async () => {
    const { q, a, i, g } = await basico();
    const l1 = [L(a[0].id, g, i[0].id), L(a[0].id, g, i[1].id), L(a[1].id, g)];
    const { lote } = await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: l1, loteLido: null });
    let plano = await lerPlano(p, q, 2028, new Date('2028-11-20T12:00:00Z'));
    expect(plano.atual?.lote).toBe(lote);
    expect(plano.resumo).toEqual({ areas: 2, grupos: 1, itens: 2 });
    expect(plano.atualJaVale).toBe(true);

    await salvarPlano(p, q, { ano: 2028, vigencia: '2028-07-01', linhas: [L(a[0].id, g)], loteLido: lote });
    plano = await lerPlano(p, q, 2028);
    expect(plano.versoes).toHaveLength(2);
    expect(plano.versoes[1].linhas).toHaveLength(3);
    const [t] = await lerTabelas(p, [PlanoContas] as const);
    expect(t.todos()).toHaveLength(4);
  });

  it('versão lida: quem salva sobre um plano que já mudou é recusado, sem gravar nada', async () => {
    const { q, a, g } = await basico();
    const { lote } = await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: [L(a[0].id, g)], loteLido: null });
    await salvarPlano(p, q, { ano: 2028, vigencia: '2028-03-01', linhas: [L(a[1].id, g)], loteLido: lote });
    await expect(salvarPlano(p, q, { ano: 2028, vigencia: '2028-04-01', linhas: [L(a[0].id, g), L(a[1].id, g)], loteLido: lote })).rejects.toThrow(/outra pessoa/);
    await expect(salvarPlano(p, q, { ano: 2028, vigencia: '2028-04-01', linhas: [L(a[0].id, g)], loteLido: null })).rejects.toThrow(/outra pessoa/);
    expect((await lerPlano(p, q, 2028)).versoes).toHaveLength(2);
  });

  it('tudo ou nada: plano vazio, vigência fora do ano, item de outro grupo, sem mudança', async () => {
    const { q, a, i, g, g2 } = await basico();
    await expect(salvarPlano(p, q, { ano: 2029, vigencia: '2029-01-01', linhas: [], loteLido: null })).rejects.toThrow(/vazio/);
    await expect(salvarPlano(p, q, { ano: 2029, vigencia: '2028-12-31', linhas: [L(a[0].id, g)], loteLido: null })).rejects.toThrow(/dentro do ano de 2029/);
    await expect(salvarPlano(p, q, { ano: 2029, vigencia: '2029-01-01', linhas: [L(a[0].id, g2, i[0].id)], loteLido: null })).rejects.toThrow(/grupo errado/);
    await expect(salvarPlano(p, q, { ano: 1999, vigencia: '1999-01-01', linhas: [L(a[0].id, g)], loteLido: null })).rejects.toThrow(/Ano inválido/);
    const [t] = await lerTabelas(p, [PlanoContas] as const);
    expect(t.todos()).toHaveLength(0);
    const { lote } = await salvarPlano(p, q, { ano: 2029, vigencia: '2029-01-01', linhas: [L(a[0].id, g)], loteLido: null });
    await expect(salvarPlano(p, q, { ano: 2029, vigencia: '2029-01-01', linhas: [L(a[0].id, g)], loteLido: lote })).rejects.toThrow(/Nada mudou/);
  });

  it('só entra o que está ativo; o que já estava em plano antigo continua lido', async () => {
    const { q, a, i, g } = await basico();
    const { lote } = await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: [L(a[0].id, g, i[0].id)], loteLido: null });
    await excluirItemContabil(p, q, i[0].id, i[0].versao);
    await excluirAreaPlano(p, q, a[1].id, a[1].versao);
    await expect(salvarPlano(p, q, { ano: 2028, vigencia: '2028-02-01', linhas: [L(a[0].id, g, i[0].id)], loteLido: lote })).rejects.toThrow(/item encerrado/);
    await expect(salvarPlano(p, q, { ano: 2028, vigencia: '2028-02-01', linhas: [L(a[1].id, g)], loteLido: lote })).rejects.toThrow(/área encerrada/);
    const plano = await lerPlano(p, q, 2028);
    expect(plano.atual?.linhas).toEqual([L(a[0].id, g, i[0].id)]);
    expect(plano.cadastros.itens.excluidos.map((x) => x.id)).toContain(i[0].id);
    expect(plano.cadastros.itens.uso[i[0].id]).toBe(1);
  });

  it('exercício encerrado não aceita lote novo', async () => {
    const { q, a, g } = await basico();
    // Na demonstração, 2026 já é um exercício encerrado.
    await expect(salvarPlano(p, q, { ano: 2026, vigencia: '2026-05-01', linhas: [L(a[0].id, g)], loteLido: null })).rejects.toThrow(/encerrado/);
    expect((await lerPlano(p, q, 2026)).situacao).toBe('encerrado');
  });

  it('copiar do ano anterior: o plano do fim do outro exercício vem pronto, sem gravar nada', async () => {
    const { q, a, g } = await basico();
    expect((await lerPlano(p, q, 2029)).anterior).toBeNull();
    const { lote } = await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: [L(a[0].id, g)], loteLido: null });
    await salvarPlano(p, q, { ano: 2028, vigencia: '2028-09-01', linhas: [L(a[0].id, g), L(a[1].id, g)], loteLido: lote });
    const plano = await lerPlano(p, q, 2029);
    expect(plano.anterior?.ano).toBe(2028);
    expect(plano.anterior?.linhas).toHaveLength(2);
    expect(plano.atual).toBeNull();
    expect(plano.vigenciaPadrao).toBe('2029-01-01');
    const [t] = await lerTabelas(p, [PlanoContas] as const);
    expect(t.todos().filter((x) => x.exercicio === 2029)).toHaveLength(0);
  });

  it('a demonstração traz áreas, itens e dois exercícios', async () => {
    await popularPlanoContasFicticio(p);
    const q = await fin();
    const p26 = await lerPlano(p, q, 2026);
    const p27 = await lerPlano(p, q, 2027);
    expect(p26.resumo.areas).toBe(4);
    expect(p27.atual).not.toBeNull();
    expect(p27.anterior?.ano).toBe(2026);
    expect(p27.anos).toContain(2026);
    await popularPlanoContasFicticio(p);
    expect((await lerPlano(p, q, 2026)).resumo.areas).toBe(4);
  });
});

describe('quem vê e quem altera', () => {
  it('Financeiro altera; Diretoria, Leitura e coordenação só leem ou nem entram; sem permissão, nada', async () => {
    const { q, a, g } = await basico();
    await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: [L(a[0].id, g)], loteLido: null });
    for (const email of ['diretoria@exemplo.local', 'leitura@exemplo.local']) {
      const u = await como(email);
      expect((await lerPlano(p, u, 2028)).resumo.areas).toBe(1);
      await expect(salvarPlano(p, u, { ano: 2028, vigencia: '2028-02-01', linhas: [L(a[1].id, g)], loteLido: null })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(salvarAreaPlano(p, u, { nome: 'Nova' })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(salvarItemContabil(p, u, { grupo_id: g, nome: 'Novo' })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(excluirAreaPlano(p, u, a[0].id, 1)).rejects.toBeInstanceOf(ErroPermissao);
    }
    const semAcesso = await como('cozinha@exemplo.local');
    await expect(lerPlano(p, semAcesso, 2028)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(listarCadastrosDoPlano(p, semAcesso)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('baixar o plano (CSV)', () => {
  it('um arquivo por exercício, com acentos, área, grupo, item e códigos; vazio recusa', async () => {
    const { q, a, i, g } = await basico();
    await expect(baixarPlanoCsv(p, q, 2028)).rejects.toThrow(/Nada para baixar/);
    await salvarPlano(p, q, { ano: 2028, vigencia: '2028-01-01', linhas: [L(a[0].id, g, i[0].id), L(a[1].id, g)], loteLido: null });
    const csv = await baixarPlanoCsv(p, q, 2028);
    expect(csv.nome).toBe('plano-de-contas-2028.csv');
    const linhas = csv.conteudo.trim().split('\r\n');
    expect(linhas[0]).toContain('Área;Código da área;Grupo de contas;Código do grupo;Item contábil;Código do item;Vale desde');
    expect(linhas).toHaveLength(3);
    expect(csv.conteudo).toContain('Item 1;I-1;2028-01-01');
    await expect(baixarPlanoCsv(p, await como('cozinha@exemplo.local'), 2028)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
