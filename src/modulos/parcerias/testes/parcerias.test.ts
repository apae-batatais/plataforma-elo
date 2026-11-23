/** Parcerias, com termos FICTÍCIOS: cálculos, cadastro, quem vê e quem altera, catálogo para o Orçamento. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import {
  adicionarFonte,
  cancelarAporte,
  criarTermo,
  definirFonteDaMeta,
  definirLimiteOcupacao,
  detalharTermo,
  encerrarTermo,
  listarTermos,
  registrarAporte,
  termoParaProjeto,
  termosParaOrcamento,
  ErroTermo,
  type DadosTermo,
} from '../aplicacao/parcerias';
import { Aportes, Metas, TABELAS_PARCERIAS, Termos } from '../dados/tabelas';
import type { NumerosDePessoas } from '../aplicacao/parcerias';
import { popularParceriasFicticias } from '../dados/ficticios';
import { manifesto } from '../manifesto';
import { acumulado, alertaDeOciosas, avisoDeSoma, dividirEmPartesIguais, mesesDeCobertura, previstoPorMes, quadroDoServico, textoDaConta, valorInicialDaFonte } from '../dominio/termos';

let p: Planilhas;
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const AGORA = new Date('2026-10-15T12:00:00Z');
const termoBase = (x: Partial<DadosTermo> = {}): DadosTermo => ({
  parceiro: 'Parceiro (exemplo)',
  numero: '9/2026',
  tipo: 'fomento',
  inicio: '2026-01-01',
  fim: '2026-12-31',
  unidadeMeta: 'alunos',
  servicos: [{ servico: 'escola', vagasOferecidas: 60, vagasCusteadas: 50 }],
  fontes: [{ nome: 'Fonte A', forma: 'global', valorInicial: 1000, cronograma: 'iguais', meses: ['2026-03', '2026-09'] }],
  ...x,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'parcerias']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_PARCERIAS] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
});

describe('cálculos puros', () => {
  it('per capita anual pago em 4 parcelas dá o mesmo valor que em 12 (nunca 1/3)', () => {
    const f = { forma: 'per_capita' as const, valorInicial: null, perCapita: 1000, periodicidade: 'anual' as const };
    expect(valorInicialDaFonte(f, 100, mesesDeCobertura('2026-01-01', '2026-12-31'))).toBe(100000);
    expect(textoDaConta(f, 100, 12, 'alunos')).toBe('R$ 1.000,00 por ano × 100 alunos × 12 ÷ 12 meses = R$ 100.000,00'.replace(/R\$ /g, 'R$ '));
  });
  it('per capita mensal multiplica pelos meses de cobertura; vigência menor reduz o fator anual', () => {
    expect(valorInicialDaFonte({ forma: 'per_capita', valorInicial: null, perCapita: 100, periodicidade: 'mensal' }, 10, 12)).toBe(12000);
    expect(valorInicialDaFonte({ forma: 'per_capita', valorInicial: null, perCapita: 1200, periodicidade: 'anual' }, 10, 6)).toBe(6000);
  });
  it('partes iguais põem os centavos na última parcela', () => {
    const ps = dividirEmPartesIguais(100, ['2026-03', '2026-01', '2026-02']);
    expect(ps.map((x) => x.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(ps[0].mes).toBe('2026-01');
  });
  it('conferência da soma avisa a diferença e não avisa quando bate', () => {
    expect(avisoDeSoma('da fonte', [{ mes: '2026-01', valor: 90 }], 100)).toMatch(/diferença/);
    expect(avisoDeSoma('da fonte', [{ mes: '2026-01', valor: 100 }], 100)).toBeNull();
  });
  it('previsto por mês soma fonte e aporte (primeira parcela maior)', () => {
    const r = previstoPorMes([{ mes: '2026-07', valor: 100 }], [{ mes: '2026-07', valor: 2000 }, { mes: '2026-08', valor: 800 }]);
    expect(r).toEqual([{ mes: '2026-07', valor: 2100 }, { mes: '2026-08', valor: 800 }]);
  });
  it('ocupação e alerta: abaixo do limite por 2 meses; sem vagas não calcula; sem contagem não alerta', () => {
    const prev = [{ mes: '2026-01', valor: 1000 }, { mes: '2026-02', valor: 1000 }];
    const serv = { servico: 's', vagasOferecidas: 12, vagasCusteadas: 10 };
    const q = quadroDoServico(serv, 10, prev, new Map([['2026-01', 8], ['2026-02', 7]]), ['2026-01', '2026-02']);
    expect(q[1].ocupacao).toBe(70);
    expect(q[1].perCapitaMeta).toBe(100);
    expect(q[1].perCapitaAtendidos).toBeCloseTo(142.86, 2);
    expect(alertaDeOciosas(q, 85, 100)).toMatchObject({ vagasOciosas: 3, valorMensal: 300 });
    expect(acumulado(q).perCapitaMeta).toBe(200);
    const ok = quadroDoServico(serv, 10, prev, new Map([['2026-01', 8], ['2026-02', 9]]), ['2026-01', '2026-02']);
    expect(alertaDeOciosas(ok, 85, 100)).toBeNull();
    const sem = quadroDoServico({ ...serv, vagasCusteadas: null }, 0, prev, new Map(), ['2026-01', '2026-02']);
    expect(sem[0].ocupacao).toBeNull();
    expect(alertaDeOciosas(sem, 85, null)).toBeNull();
    expect(quadroDoServico(serv, 10, prev, null, ['2026-01'])[0].atendidos).toBeNull();
  });
});

describe('termos fictícios nos formatos reais', () => {
  beforeEach(async () => popularParceriasFicticias(p));

  it('regra 28: termoParaProjeto devolve fontes, cronograma (com aportes), plano, vigência e recursos próprios a quem vê o termo; a quem não vê, null', async () => {
    const q = await como('financeiro@exemplo.local');
    const id = (await listarTermos(p, q, AGORA)).find((t) => t.numero === '001/2026')!.id;
    const d = await detalharTermo(p, q, id, AGORA);
    const lido = (await termoParaProjeto(p, q, id, AGORA))!;
    expect(lido).toMatchObject({ termoId: id, situacao: 'em_vigor', valor: d.valorGlobal, inicio: d.inicio, fim: d.fim, recursosProprios: d.recursosProprios });
    expect(lido.fontes.map((f) => f.nome).sort()).toEqual(d.fontes.map((f) => f.nome).sort());
    const estadual = lido.fontes.find((f) => f.nome === 'Cofinanciamento estadual')!;
    expect(estadual.valorAtual).toBe(36000);
    // o aporte de 6 parcelas entra no cronograma da fonte: a soma bate com o valor atual
    expect(estadual.cronograma.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(estadual.valorAtual, 2);
    expect([...estadual.cronograma].sort((a, b) => a.mes.localeCompare(b.mes))).toEqual(estadual.cronograma);
    expect(lido.fontes.find((f) => f.nome === 'Fundo municipal')!.plano).toEqual(d.fontes.find((f) => f.nome === 'Fundo municipal')!.categorias);
    expect(await termoParaProjeto(p, await como('funcionario@exemplo.local'), id, AGORA)).toBeNull();
    expect(JSON.stringify(lido)).not.toMatch(/@/);
  });

  it('termo com 3 fontes: per capita anual em 4 parcelas, cronograma digitado e aporte de 6 parcelas', async () => {
    const q = await como('financeiro@exemplo.local');
    const lista = await listarTermos(p, q, AGORA);
    expect(lista).toHaveLength(2);
    const edu = await detalharTermo(p, q, lista.find((t) => t.numero === '001/2026')!.id, AGORA);
    expect(edu.fontes).toHaveLength(3);
    const municipal = edu.fontes.find((f) => f.nome === 'Fundo municipal')!;
    expect(municipal.valorInicial).toBe(100000);
    expect(municipal.parcelas).toHaveLength(4);
    expect(municipal.parcelas.reduce((s, x) => s + x.valor, 0)).toBe(100000);
    const estadual = edu.fontes.find((f) => f.nome === 'Cofinanciamento estadual')!;
    expect(estadual.valorInicial).toBe(30000);
    expect(estadual.valorAtual).toBe(36000);
    expect(edu.aportes[0].parcelas).toHaveLength(6);
    expect(edu.aportes[0].parcelas[0].valor).toBe(2000);
    expect(edu.valorGlobal).toBe(100000 + 36000 + 12000);
    expect(edu.pontosDeAtencao).toEqual([]);
    expect(edu.previstoPorMes.find((m) => m.mes === '2026-07')!.valor).toBe(2000);
  });

  it('termo federal com 2 fontes e meta em procedimentos: sem contagem automática', async () => {
    const q = await como('diretoria@exemplo.local');
    const t = (await listarTermos(p, q, AGORA)).find((x) => x.numero === '014/2026')!;
    const d = await detalharTermo(p, q, t.id, AGORA);
    expect(d.fontes.map((f) => f.nome)).toEqual(['Custeio', 'Piso da enfermagem']);
    expect(d.quadro[0].semContagem).toBe(true);
    expect(d.quadro[0].alerta).toBeNull();
    expect(d.quadro[0].linhas[0].atendidos).toBeNull();
    expect(d.quadro[0].linhas[0].perCapitaMeta).not.toBeNull();
  });

  it('ocupação por alunos usa os vínculos do Núcleo e dispara o alerta de vagas ociosas', async () => {
    const q = await como('financeiro@exemplo.local');
    const t = (await listarTermos(p, q, AGORA)).find((x) => x.numero === '001/2026')!;
    const d = await detalharTermo(p, q, t.id, AGORA);
    const linhas = d.quadro[0].linhas;
    expect(linhas.at(-1)!.mes).toBe('2026-10');
    expect(linhas.at(-1)!.vagasCusteadas).toBe(100);
    expect(linhas.at(-1)!.atendidos).toBe((await lerTabela(p, VinculosServico)).ativos().filter((v) => v.servico === 'escola' && !v.saida).length);
    expect(d.quadro[0].alerta).not.toBeNull();
  });

  it('quem vê: Diretoria e Leitura veem tudo; coordenação só o do seu escopo; Funcionário nada', async () => {
    expect(await listarTermos(p, await como('leitura@exemplo.local'), AGORA)).toHaveLength(2);
    const coord = await como('coord.educacao@exemplo.local');
    const dela = await listarTermos(p, coord, AGORA);
    expect(dela.map((t) => t.numero)).toEqual(['001/2026']);
    const saude = (await listarTermos(p, await como('diretoria@exemplo.local'), AGORA)).find((t) => t.numero === '014/2026')!;
    await expect(detalharTermo(p, coord, saude.id, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(listarTermos(p, await como('funcionario@exemplo.local'), AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('quem altera: só o Financeiro', async () => {
    for (const email of ['diretoria@exemplo.local', 'leitura@exemplo.local', 'coord.educacao@exemplo.local']) {
      await expect(criarTermo(p, await como(email), termoBase(), AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    }
    const dir = await como('diretoria@exemplo.local');
    const t = (await listarTermos(p, dir, AGORA))[0];
    const [termos] = await lerTabelas(p, [Termos] as const);
    await expect(encerrarTermo(p, dir, t.id, termos.porId(t.id)!.versao, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(definirLimiteOcupacao(p, dir, t.id, 1, 80, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('catálogo para o Orçamento: sem permissão própria, sem dados pessoais, com cronograma, plano, equipe e recursos próprios', async () => {
    const c = await termosParaOrcamento(p, AGORA);
    expect(c).toHaveLength(2);
    const edu = c.find((t) => t.numero === '001/2026')!;
    expect(edu.recursosProprios).toBe(20000);
    expect(edu.equipe).toEqual([
      { funcao: 'Professor', pessoas: 4, horasSemanais: 20 },
      { funcao: 'Administrativo', pessoas: 1, horasSemanais: 10 },
    ]);
    const mun = edu.fontes.find((f) => f.nome === 'Fundo municipal')!;
    expect(mun.categorias).toHaveLength(2);
    expect(mun.permiteRemanejar).toBe(false);
    expect(edu.fontes.find((f) => f.nome === 'Cofinanciamento estadual')!.aportesParcelas).toHaveLength(6);
    // Vagas por serviço e unidade de pessoa, para o painel de sustentabilidade (#131).
    expect(edu.vagasPorServico).toEqual([{ servico: 'escola', vagasCusteadas: 100, vagasOferecidas: 120 }]);
    expect(edu.unidadePessoa).toBe(true);
    expect(c.find((t) => t.numero === '014/2026')!.unidadePessoa).toBe(false);
    const json = JSON.stringify(c);
    expect(json).not.toMatch(/@|cpf|pessoa_id|criado_por/i);
    // Termo encerrado sai do catálogo.
    const fin = await como('financeiro@exemplo.local');
    const [termos] = await lerTabelas(p, [Termos] as const);
    await encerrarTermo(p, fin, edu.id, termos.porId(edu.id)!.versao, AGORA);
    expect((await termosParaOrcamento(p, AGORA)).map((t) => t.numero)).toEqual(['014/2026']);
  });
});

describe('cadastro e regras de negócio', () => {
  it('cria termo, audita sem valores e recusa número repetido (sem acento ou maiúscula)', async () => {
    const fin = await como('financeiro@exemplo.local');
    const id = await criarTermo(p, fin, termoBase({ parceiro: 'Parceiro Ação' }), AGORA);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Termos');
    expect(aud).toHaveLength(1);
    expect(aud[0].registro_id).toBe(id);
    expect(aud[0].detalhes).not.toMatch(/1000/);
    await expect(criarTermo(p, fin, termoBase({ parceiro: 'parceiro acao' }), AGORA)).rejects.toThrow(/Já existe o termo/);
  });
  it('valida vigência, serviço, fonte, tipo "outro" e cronograma dentro da vigência', async () => {
    const fin = await como('financeiro@exemplo.local');
    await expect(criarTermo(p, fin, termoBase({ fim: '2025-12-31' }), AGORA)).rejects.toThrow(/depois de começar/);
    await expect(criarTermo(p, fin, termoBase({ servicos: [] }), AGORA)).rejects.toThrow(/ao menos um serviço/);
    await expect(criarTermo(p, fin, termoBase({ fontes: [] }), AGORA)).rejects.toThrow(/ao menos uma fonte/);
    await expect(criarTermo(p, fin, termoBase({ tipo: 'outro' }), AGORA)).rejects.toThrow(/Descreva/);
    await expect(
      criarTermo(p, fin, termoBase({ fontes: [{ nome: 'A', forma: 'global', valorInicial: 10, cronograma: 'iguais', meses: ['2027-01'] }] }), AGORA),
    ).rejects.toThrow(/fora da vigência/);
    await expect(
      criarTermo(p, fin, termoBase({ fontes: [{ nome: 'A', forma: 'global', valorInicial: 10, cronograma: 'iguais', meses: [] }] }), AGORA),
    ).rejects.toThrow(/ao menos uma parcela/);
    await expect(
      criarTermo(p, fin, termoBase({ fontes: [
        { nome: 'A', forma: 'global', valorInicial: 10, cronograma: 'iguais', meses: ['2026-02'] },
        { nome: 'a', forma: 'global', valorInicial: 10, cronograma: 'iguais', meses: ['2026-02'] },
      ] }), AGORA),
    ).rejects.toThrow(/Já existe a fonte/);
  });
  it('cronograma digitado que não soma o valor vira ponto de atenção, sem bloquear; vagas custeadas acima das oferecidas também', async () => {
    const fin = await como('financeiro@exemplo.local');
    const id = await criarTermo(
      p,
      fin,
      termoBase({
        servicos: [{ servico: 'escola', vagasOferecidas: 10, vagasCusteadas: 20 }],
        fontes: [{ nome: 'A', forma: 'global', valorInicial: 1000, cronograma: 'digitado', parcelas: [{ mes: '2026-02', valor: 900 }] }],
      }),
      AGORA,
    );
    const d = await detalharTermo(p, fin, id, AGORA);
    expect(d.pontosDeAtencao.join(' ')).toMatch(/soma R\$.*900,00.*diferença/);
    expect(d.pontosDeAtencao.join(' ')).toMatch(/mais vagas custeadas/);
  });
  it('aporte: vigência dentro do termo, não futuro, nunca deixa a fonte negativa, cancelado fica guardado', async () => {
    const fin = await como('financeiro@exemplo.local');
    const id = await criarTermo(p, fin, termoBase(), AGORA);
    const d0 = await detalharTermo(p, fin, id, AGORA);
    const fonteId = d0.fontes[0].id;
    const base = { fonteId, tipo: 'aditivo' as const, registradoEm: '2026-07-01', inicio: '2026-07-01', fim: '2026-12-31', valor: 500, cronograma: 'iguais' as const, meses: ['2026-07', '2026-10'] };
    await expect(registrarAporte(p, fin, id, { ...base, fim: '2027-03-31' }, AGORA)).rejects.toThrow(/dentro da vigência/);
    await expect(registrarAporte(p, fin, id, { ...base, registradoEm: '2026-12-01' }, AGORA)).rejects.toThrow(/futura/);
    await expect(registrarAporte(p, fin, id, { ...base, valor: -2000 }, AGORA)).rejects.toThrow(/negativo/);
    const ap = await registrarAporte(p, fin, id, base, AGORA);
    expect((await detalharTermo(p, fin, id, AGORA)).fontes[0].valorAtual).toBe(1500);
    await registrarAporte(p, fin, id, { ...base, valor: -300, meses: ['2026-08'] }, AGORA);
    expect((await detalharTermo(p, fin, id, AGORA)).fontes[0].valorAtual).toBe(1200);
    const [aportes] = await lerTabelas(p, [Aportes] as const);
    await cancelarAporte(p, fin, ap, aportes.porId(ap)!.versao, AGORA);
    expect((await detalharTermo(p, fin, id, AGORA)).fontes[0].valorAtual).toBe(700);
    expect((await lerTabela(p, Aportes)).porId(ap)!.ativo).toBe(false);
  });
  it('adicionar fonte recusa nome repetido e termo encerrado; vagas custeadas mudam o valor per capita sozinhas', async () => {
    const fin = await como('financeiro@exemplo.local');
    const id = await criarTermo(
      p,
      fin,
      termoBase({ fontes: [{ nome: 'PC', forma: 'per_capita', perCapita: 10, periodicidade: 'mensal', cronograma: 'iguais', meses: ['2026-06'] }] }),
      AGORA,
    );
    expect((await detalharTermo(p, fin, id, AGORA)).fontes[0].valorInicial).toBe(10 * 50 * 12);
    await expect(adicionarFonte(p, fin, id, { nome: 'pc', forma: 'global', valorInicial: 1, cronograma: 'iguais', meses: ['2026-01'] }, AGORA)).rejects.toBeInstanceOf(ErroTermo);
    await adicionarFonte(p, fin, id, { nome: 'Nova', forma: 'global', valorInicial: 100, cronograma: 'iguais', meses: ['2026-01'] }, AGORA);
    const [termos] = await lerTabelas(p, [Termos] as const);
    await encerrarTermo(p, fin, id, termos.porId(id)!.versao, AGORA);
    await expect(adicionarFonte(p, fin, id, { nome: 'Outra', forma: 'global', valorInicial: 1, cronograma: 'iguais', meses: ['2026-01'] }, AGORA)).rejects.toThrow(/encerrado/);
  });
  it('permissões do manifesto existem e a Diretoria não edita', () => {
    expect(manifesto.permissoesPorPerfil.diretoria).not.toContain('parcerias.termos.editar');
    expect(manifesto.permissoesPorPerfil.financeiro).toContain('parcerias.termos.editar');
  });
});
void inserir;

describe('meta com número do cadastro (onda 2, regra 27)', () => {
  const numeros = (indiceMedio: number | null, base: number, reav: number | null = 80): NumerosDePessoas => ({
    async indicadoresDoServico() {
      const m = (valor: number | null) => (base >= 5 ? { valor, base, motivo: null } : { valor: null, base, motivo: 'poucos_casos' as const });
      return { indiceMedio: m(indiceMedio), reavaliacaoEmDia: m(reav) };
    },
  });
  const comMeta = async (m: Partial<NonNullable<DadosTermo['metas']>[number]> = {}, numero = '9/2026') => {
    const id = await criarTermo(p, await como('financeiro@exemplo.local'), termoBase({ numero, metas: [{ servico: 'escola', descricao: 'Alunos', unidade: 'alunos', quantidade: 3, ...m }] }), AGORA);
    const metaId = (await lerTabela(p, Metas)).ativos().find((x) => x.termo_id === id)!;
    return { id, meta: metaId };
  };

  it('meta nova nasce manual e nunca calcula sozinha', async () => {
    const { id, meta } = await comMeta();
    expect(meta.fonte_numero).toBe('manual');
    const d = await detalharTermo(p, await como('financeiro@exemplo.local'), id, AGORA, numeros(2, 9));
    expect(d.hojeDasMetas).toEqual({});
  });

  it('só o Financeiro escolhe a fonte; a Diretoria só lê; a mudança vai para a auditoria com as colunas', async () => {
    const { meta } = await comMeta();
    await expect(definirFonteDaMeta(p, await como('diretoria@exemplo.local'), meta.id, meta.versao, { fonte: 'indice_cuidado' }, AGORA)).rejects.toThrow(ErroPermissao);
    await definirFonteDaMeta(p, await como('financeiro@exemplo.local'), meta.id, meta.versao, { fonte: 'indice_cuidado' }, AGORA);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Metas');
    expect(aud).toHaveLength(1);
    expect(JSON.stringify(aud[0])).toContain('fonte_numero');
    expect(JSON.stringify(aud[0])).not.toContain('indice_cuidado');
  });

  it('com 5 pessoas ou mais mostra o número e a situação contra a meta; com menos, "poucos casos"', async () => {
    const fin = await como('financeiro@exemplo.local');
    const { id, meta } = await comMeta({ quantidade: 2 });
    await definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'indice_cuidado' }, AGORA);
    const ok = (await detalharTermo(p, fin, id, AGORA, numeros(2.5, 9))).hojeDasMetas[meta.id];
    expect(ok).toMatchObject({ estado: 'ok', numero: { valor: 2.5, base: 9 }, situacao: 'dentro' });
    const abaixo = (await detalharTermo(p, fin, id, AGORA, numeros(1.5, 9))).hojeDasMetas[meta.id];
    expect(abaixo).toMatchObject({ situacao: 'abaixo' });
    const pouco = (await detalharTermo(p, fin, id, AGORA, numeros(2.5, 4))).hojeDasMetas[meta.id];
    expect(pouco).toEqual({ estado: 'ok', numero: { valor: null, base: 4, motivo: 'poucos_casos' }, situacao: null });
  });

  it('Avaliação desligada: "indisponível"; sem leitor também', async () => {
    const fin = await como('financeiro@exemplo.local');
    const { id, meta } = await comMeta();
    await definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'reavaliacao_em_dia' }, AGORA);
    const nulo: NumerosDePessoas = { indicadoresDoServico: async () => null };
    expect((await detalharTermo(p, fin, id, AGORA, nulo)).hojeDasMetas[meta.id]).toEqual({ estado: 'indisponivel' });
    expect((await detalharTermo(p, fin, id, AGORA)).hojeDasMetas[meta.id]).toEqual({ estado: 'indisponivel' });
  });

  it('exige serviço do termo e unidade de pessoas', async () => {
    const fin = await como('financeiro@exemplo.local');
    const { meta } = await comMeta({ servico: null });
    await expect(definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'vinculos_ativos' }, AGORA)).rejects.toThrow(/serviço/);
    await expect(definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'vinculos_ativos', servico: 'ur' }, AGORA)).rejects.toThrow(/deste termo/);
    const outra = await comMeta({ unidade: 'procedimentos' }, '10/2026');
    await expect(definirFonteDaMeta(p, fin, outra.meta.id, outra.meta.versao, { fonte: 'vinculos_ativos' }, AGORA)).rejects.toThrow(/pessoas/);
    await definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'vinculos_ativos', servico: 'escola' }, AGORA);
  });

  it('vínculos ativos vêm do Núcleo, protegidos (a demonstração tem poucos vínculos na escola ou mais de 5)', async () => {
    const fin = await como('financeiro@exemplo.local');
    const { id, meta } = await comMeta();
    await definirFonteDaMeta(p, fin, meta.id, meta.versao, { fonte: 'vinculos_ativos' }, AGORA);
    const h = (await detalharTermo(p, fin, id, AGORA)).hojeDasMetas[meta.id];
    expect(h.estado).toBe('ok');
    if (h.estado === 'ok') expect(Object.keys(h.numero).sort()).toEqual(['base', 'motivo', 'valor']);
  });
});
