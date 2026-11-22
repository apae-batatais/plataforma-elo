/**
 * Assistência Social, com dados FICTÍCIOS: conferência das respostas,
 * índice de necessidade de cuidado, painel, quem avalia e quem vê, auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Pessoas, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  detalharAvaliacao,
  fichaDaAvaliacao,
  historicoDaPessoa,
  indicadoresDoServico,
  ErroRespostas,
  listarAvaliacoes,
  painelDaAvaliacao,
  retirarAvaliacao,
  salvarAvaliacao,
  servicosParaAvaliar,
} from '../aplicacao/avaliacoes';
import { popularAvaliacoesFicticias } from '../dados/ficticios';
import { Avaliacoes, TABELAS_AVALIACAO } from '../dados/tabelas';
import {
  chavePessoa,
  conferirAvaliacao,
  idadeEm,
  indiceDeCuidado,
  normalizarIniciais,
  proximaAvaliacao,
  situacaoReavaliacao,
  type DadosAvaliacao,
} from '../dominio/avaliacao';
import { compararAvaliacoes } from '../dominio/comparativo';
import { mediana, montarPainel } from '../dominio/painel';
import { manifesto } from '../manifesto';

const HOJE = '2026-11-06';
const AGORA = new Date('2026-11-06T15:00:00Z');

const completa = (x: Partial<DadosAvaliacao> = {}): DadosAvaliacao => ({
  tipo: 'Inicial',
  iniciais: 'mas',
  nascimento: '1958-03-02',
  sexo: 'F',
  prontuario: '',
  servico: 'ur',
  data_avaliacao: '2026-11-03',
  evolucao_usuario: 'Manteve',
  evolucao_familia: 'Manteve',
  cuidador: 'Filha',
  bpc: 'Sim',
  mae_solo: 'Não',
  rede_apoio: 'Sim',
  cuidador_idoso: 'Não',
  nucleo_mais_pcd: 'Não',
  adultos_30: 'Sim',
  isolamento: 'Não',
  enfermagem: 'Não',
  grau_deficiencia: 'Moderada',
  grau_dependencia: 'II',
  ostomia: 'Não',
  ostomia_tipo: '',
  transporte: 'Comum',
  barreiras: ['nenhuma'],
  observacoes: '',
  profissional: '',
  registro_profissional: '',
  ...x,
});

describe('conferência das respostas', () => {
  it('aceita um questionário completo e arruma as iniciais', () => {
    const r = conferirAvaliacao(completa(), HOJE);
    expect(r.faltando).toEqual([]);
    expect(r.dados.iniciais).toBe('MAS');
  });

  it('aponta cada pergunta sem resposta', () => {
    const r = conferirAvaliacao({ iniciais: 'A' }, HOJE);
    expect(r.faltando).toEqual(expect.arrayContaining(['iniciais', 'nascimento', 'sexo', 'servico', 'grau_dependencia', 'barreiras']));
  });

  it('pede o tipo quando há ostomia e descarta o tipo quando não há', () => {
    expect(conferirAvaliacao(completa({ ostomia: 'Sim' }), HOJE).faltando).toEqual(['ostomia_tipo']);
    expect(conferirAvaliacao(completa({ ostomia: 'Não', ostomia_tipo: 'Sonda' }), HOJE).dados.ostomia_tipo).toBe('');
  });

  it('"nenhuma" barreira exclui as demais e códigos desconhecidos são ignorados', () => {
    expect(conferirAvaliacao(completa({ barreiras: ['sobrecarga', 'nenhuma'] }), HOJE).dados.barreiras).toEqual(['nenhuma']);
    expect(conferirAvaliacao(completa({ barreiras: ['inventada'] }), HOJE).faltando).toEqual(['barreiras']);
  });

  it('não aceita avaliação no futuro nem nascimento depois da avaliação', () => {
    expect(conferirAvaliacao(completa({ data_avaliacao: '2026-12-01' }), HOJE).faltando).toContain('data_avaliacao');
    expect(conferirAvaliacao(completa({ nascimento: '2026-11-05' }), HOJE).faltando).toContain('nascimento');
  });

  it('valores fora da lista não passam', () => {
    expect(conferirAvaliacao(completa({ grau_dependencia: 'IV' as never }), HOJE).faltando).toEqual(['grau_dependencia']);
  });

  it('idade em anos completos e iniciais só com letras', () => {
    expect(idadeEm('1958-11-07', '2026-11-06')).toBe(67);
    expect(idadeEm('1958-11-06', '2026-11-06')).toBe(68);
    expect(idadeEm('data', '2026-11-06')).toBeNull();
    expect(normalizarIniciais('m. a. s')).toBe('MAS');
  });
});

describe('índice de necessidade de cuidado', () => {
  it('é 0 sem nenhum indicador e chega a 12 com todos', () => {
    expect(indiceDeCuidado(completa({ grau_dependencia: 'I' }))).toBe(0);
    const tudo = completa({
      grau_dependencia: 'III',
      isolamento: 'Sim',
      barreiras: ['sobrecarga', 'sem_apoio', 'violencia_fisica'],
      rede_apoio: 'Não',
      cuidador_idoso: 'Sim',
      mae_solo: 'Sim',
      evolucao_usuario: 'Regrediu',
      evolucao_familia: 'Regrediu',
      enfermagem: 'Sim',
    });
    expect(indiceDeCuidado(tudo)).toBe(12);
  });

  it('grau II vale 1 e ostomia conta como cuidado de saúde', () => {
    expect(indiceDeCuidado(completa())).toBe(1);
    expect(indiceDeCuidado(completa({ ostomia: 'Sim', ostomia_tipo: 'Sonda' }))).toBe(2);
  });
});

describe('painel (regras puras)', () => {
  const a = (servico: string, indice: number, x: Partial<DadosAvaliacao> & { chave?: string } = {}) => {
    const d = completa(x);
    return {
      ...d,
      servico,
      servicoNome: servico.toUpperCase(),
      indice,
      idade: idadeEm(d.nascimento, d.data_avaliacao),
      chave: x.chave ?? `${servico}-${indice}-${d.data_avaliacao}`,
    };
  };

  it('agrupa por serviço, ordena pelo maior e calcula mediana e percentuais', () => {
    const p = montarPainel(
      [a('ur', 2), a('ur', 6, { grau_dependencia: 'III', evolucao_usuario: 'Regrediu' }), a('ur', 4), a('cdi', 5, { barreiras: ['abandono'], sexo: 'M' })],
      HOJE,
    );
    expect(p.total).toBe(4);
    expect(p.servicos.map((s) => s.servico)).toEqual(['ur', 'cdi']);
    expect(p.servicos[0].mediana).toBe(4);
    expect(p.servicos[0].dependencia).toEqual({ I: 0, II: 2, III: 1 });
    expect(p.grauIII).toBe(1);
    expect(p.regrediram).toBe(1);
    expect(p.violacao).toBe(1);
    expect(p.geral?.pessoas).toBe(4);
    expect(p.sexo).toEqual({ f: 3, m: 1 });
    expect(p.piramide.find((g) => g.geracao === 'Pessoa idosa')).toMatchObject({ f: 3, m: 1 });
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(montarPainel([], HOJE).mediaIndice).toBeNull();
  });

  it('cada pessoa conta uma vez (pela mais recente) e a evolução compara a primeira com a última', () => {
    const p = montarPainel(
      [
        a('ur', 8, { chave: 'A', data_avaliacao: '2025-10-01', grau_dependencia: 'III' }),
        a('ur', 5, { chave: 'A', data_avaliacao: '2026-10-01', tipo: 'Acompanhamento anual' }),
        a('ur', 3, { chave: 'B', data_avaliacao: '2025-10-01' }),
        a('ur', 6, { chave: 'B', data_avaliacao: '2026-10-02', tipo: 'Acompanhamento anual' }),
        a('ur', 4, { chave: 'C', data_avaliacao: '2025-09-01' }),
      ],
      HOJE,
    );
    expect(p.total).toBe(3);
    expect(p.avaliacoes).toBe(5);
    expect(p.grauIII).toBe(0);
    expect(p.comparadas).toBe(2);
    expect(p.servicos[0].entreAvaliacoes).toEqual({ melhorou: 1, manteve: 0, piorou: 1 });
    expect(p.servicos[0].mediaPrimeira).toBe(5.5);
    expect(p.reavaliacao).toEqual({ atrasadas: 1, venceEmBreve: 0 });
  });
});

describe('periodicidade e comparativo (regras puras)', () => {
  it('a próxima avaliação vence 12 meses depois e avisa 30 dias antes', () => {
    expect(proximaAvaliacao('2025-11-06')).toBe('2026-11-06');
    expect(proximaAvaliacao('2024-02-29')).toBe('2025-02-28');
    expect(situacaoReavaliacao('2025-11-05', HOJE).situacao).toBe('atrasada');
    expect(situacaoReavaliacao('2025-11-20', HOJE).situacao).toBe('vence_em_breve');
    expect(situacaoReavaliacao('2026-10-01', HOJE).situacao).toBe('em_dia');
  });

  it('a mesma pessoa é reconhecida por iniciais, nascimento e sexo', () => {
    expect(chavePessoa({ iniciais: 'm.a.s', nascimento: '1958-03-02', sexo: 'F' })).toBe(chavePessoa({ iniciais: 'MAS', nascimento: '1958-03-02', sexo: 'F' }));
    expect(chavePessoa({ iniciais: 'MAS', nascimento: '1958-03-02', sexo: 'M' })).not.toBe(
      chavePessoa({ iniciais: 'MAS', nascimento: '1958-03-02', sexo: 'F' }),
    );
  });

  it('o comparativo aponta melhora quando o índice cai e mostra item por item', () => {
    const c = compararAvaliacoes([
      { dados: completa({ grau_dependencia: 'III', isolamento: 'Sim', rede_apoio: 'Não', barreiras: ['sobrecarga'] }), servicoNome: 'UR' },
      {
        dados: completa({ grau_dependencia: 'II', isolamento: 'Não', rede_apoio: 'Sim', barreiras: ['nenhuma'], tipo: 'Acompanhamento anual' }),
        servicoNome: 'UR',
      },
    ]);
    expect(c.indices).toEqual([5, 1]);
    expect(c.variacao).toBe(-4);
    expect(c.tendencia).toBe('melhorou');
    expect(c.linhas.find((l) => l.rotulo === 'Isolamento social')?.tendencia).toBe('melhorou');
    expect(c.linhas.find((l) => l.rotulo === 'Recebe BPC')?.tendencia).toBeNull();
    expect(c.itensPioraram).toBe(0);
    expect(c.itensMelhoraram).toBe(4);
  });
});

describe('casos de uso', () => {
  let p: Planilhas;

  async function como(email: string) {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    });
  }

  async function novoUsuario(email: string, perfil: string, escopo: { tipo: 'global' | 'area' | 'servico'; codigo: string | null }) {
    const autor = { email: 'teste' };
    const pessoa = await inserir(p, Pessoas, { nome: `Pessoa ${email} (fictícia)`, email }, autor);
    await inserir(p, Usuarios, { email, pessoa_id: pessoa.id }, autor);
    await inserir(p, Atribuicoes, { usuario_email: email, perfil, escopo_tipo: escopo.tipo, escopo: escopo.codigo }, autor);
  }

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_assistencia']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_AVALIACAO] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
  });

  it('a coordenação da UR avalia só na UR; a Diretoria em todos os serviços', async () => {
    const coord = await como('coord.ur@exemplo.local');
    expect((await servicosParaAvaliar(p, coord)).map((s) => s.codigo)).toEqual(['ur']);
    const dir = await como('diretoria@exemplo.local');
    expect((await servicosParaAvaliar(p, dir)).length).toBeGreaterThan(3);
    await expect(salvarAvaliacao(p, coord, completa({ servico: 'centro_dia_intergeracional' }), { agora: AGORA })).rejects.toThrow(ErroPermissao);
  });

  it('salva, guarda o nome do serviço, calcula o índice e registra a inclusão na auditoria', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const r = await salvarAvaliacao(p, coord, completa({ isolamento: 'Sim' }), { agora: AGORA });
    expect(r.indice).toBe(2);
    const reg = (await lerTabela(p, Avaliacoes)).porId(r.id)!;
    expect(reg.servico_nome).toMatch(/Unidade Referenciada/);
    expect(reg.iniciais).toBe('MAS');
    expect(reg.barreiras).toBe('nenhuma');
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === r.id);
    expect(aud.map((a) => a.acao)).toEqual(['inclusao']);
  });

  it('respostas incompletas não gravam nada e dizem o que falta', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await expect(salvarAvaliacao(p, coord, { ...completa(), sexo: '' }, { agora: AGORA })).rejects.toThrow(ErroRespostas);
    expect((await lerTabela(p, Avaliacoes)).todos()).toHaveLength(0);
  });

  it('quem não avalia não lista nem abre; o técnico de outro serviço não vê a UR', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const { id } = await salvarAvaliacao(p, coord, completa(), { agora: AGORA });
    const leitura = await como('leitura@exemplo.local');
    await expect(listarAvaliacoes(p, leitura)).rejects.toThrow(ErroPermissao);
    await expect(detalharAvaliacao(p, leitura, id)).rejects.toThrow(ErroPermissao);
    const tecnicoCer = await como('tecnico.cer@exemplo.local');
    expect(await listarAvaliacoes(p, tecnicoCer)).toEqual([]);
    await expect(detalharAvaliacao(p, tecnicoCer, id)).rejects.toThrow(ErroPermissao);
    const financeiro = await como('financeiro@exemplo.local');
    await expect(painelDaAvaliacao(p, financeiro)).rejects.toThrow(ErroPermissao);
  });

  it('abrir uma avaliação registra leitura; corrigir registra só as colunas e confere a versão', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const { id } = await salvarAvaliacao(p, coord, completa(), { agora: AGORA });
    const av = await detalharAvaliacao(p, coord, id);
    await salvarAvaliacao(p, coord, { ...av.dados, grau_dependencia: 'III' }, { id, versao: av.versao, agora: AGORA });
    await expect(salvarAvaliacao(p, coord, av.dados, { id, versao: av.versao, agora: AGORA })).rejects.toThrow(ErroConflito);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'leitura', 'alteracao']);
    expect(JSON.parse(aud[2].detalhes!)).toEqual({ colunas: ['grau_dependencia'] });
    expect(aud[2].detalhes).not.toContain('III');
  });

  it('a ficha para imprimir segue o acesso de abrir e registra exportação na auditoria', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const { id } = await salvarAvaliacao(p, coord, completa(), { agora: AGORA });
    const ficha = await fichaDaAvaliacao(p, coord, id);
    expect(ficha.dados.iniciais).toBe('MAS');
    await expect(fichaDaAvaliacao(p, await como('leitura@exemplo.local'), id)).rejects.toThrow(ErroPermissao);
    await expect(fichaDaAvaliacao(p, await como('tecnico.cer@exemplo.local'), id)).rejects.toThrow(ErroPermissao);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'exportacao']);
  });

  it('retirar pede motivo, não apaga a linha e tira a avaliação da lista e do painel', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const { id } = await salvarAvaliacao(p, coord, completa(), { agora: AGORA });
    const versao = (await lerTabela(p, Avaliacoes)).porId(id)!.versao;
    await expect(retirarAvaliacao(p, coord, id, versao, '')).rejects.toThrow(/motivo/);
    await retirarAvaliacao(p, coord, id, versao, 'Lançada em duplicidade', { agora: AGORA });
    const reg = (await lerTabela(p, Avaliacoes)).porId(id)!;
    expect(reg.ativo).toBe(false);
    expect(reg.motivo_retirada).toBe('Lançada em duplicidade');
    expect(await listarAvaliacoes(p, coord)).toEqual([]);
    expect((await painelDaAvaliacao(p, coord)).total).toBe(0);
  });

  it('o painel mostra só os serviços do escopo, sem identificar pessoas, e filtra por mês', async () => {
    await novoUsuario('tecnico.cdi@exemplo.local', 'tecnico_avaliador', { tipo: 'servico', codigo: 'centro_dia_intergeracional' });
    await popularAvaliacoesFicticias(p);
    const dir = await como('diretoria@exemplo.local');
    const todos = await painelDaAvaliacao(p, dir);
    expect(todos.todos).toBe(true);
    expect(todos.servicos.map((s) => s.servico).sort()).toEqual(['centro_dia_intergeracional', 'servico_domicilio', 'ur']);
    expect(JSON.stringify(todos)).not.toMatch(/iniciais|nascimento|prontuario/);

    const tecnico = await como('tecnico.cdi@exemplo.local');
    const dele = await painelDaAvaliacao(p, tecnico);
    expect(dele.todos).toBe(false);
    expect(dele.servicos.map((s) => s.servico)).toEqual(['centro_dia_intergeracional']);
    expect(dele.total).toBe(10);

    const leitura = await painelDaAvaliacao(p, await como('leitura@exemplo.local'));
    expect(leitura.total).toBe(todos.total);
    expect((await painelDaAvaliacao(p, dir, { de: '2026-11', ate: '2026-11' })).total).toBe(0);
  });

  it('o comparativo junta as avaliações da mesma pessoa só nos serviços em que você avalia e registra leitura', async () => {
    const dir = await como('diretoria@exemplo.local');
    const inicial = await salvarAvaliacao(p, dir, completa({ data_avaliacao: '2025-10-10', isolamento: 'Sim' }), { agora: AGORA });
    await salvarAvaliacao(p, dir, completa({ data_avaliacao: '2026-10-10', tipo: 'Acompanhamento anual', servico: 'centro_dia_intergeracional' }), {
      agora: AGORA,
    });
    await salvarAvaliacao(p, dir, completa({ iniciais: 'OUTRA', data_avaliacao: '2026-10-11' }), { agora: AGORA });
    const h = await historicoDaPessoa(p, dir, inicial.id, { agora: AGORA });
    expect(h.avaliacoes.map((a) => a.data)).toEqual(['2025-10-10', '2026-10-10']);
    expect(h.comparativo.tendencia).toBe('melhorou');
    expect(h.reavaliacao.vence).toBe('2027-10-10');
    const coord = await como('coord.ur@exemplo.local');
    expect((await historicoDaPessoa(p, coord, inicial.id, { agora: AGORA })).avaliacoes).toHaveLength(1);
    await expect(historicoDaPessoa(p, await como('leitura@exemplo.local'), inicial.id)).rejects.toThrow(ErroPermissao);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.registro_id === inicial.id && x.acao === 'leitura');
    expect(aud).toHaveLength(2);
  });

  it('a lista marca a reavaliação só na avaliação mais recente da pessoa', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await salvarAvaliacao(p, coord, completa({ data_avaliacao: '2025-10-01' }), { agora: AGORA });
    await salvarAvaliacao(p, coord, completa({ iniciais: 'JPS', data_avaliacao: '2025-09-01' }), { agora: AGORA });
    await salvarAvaliacao(p, coord, completa({ data_avaliacao: '2026-10-01', tipo: 'Acompanhamento anual' }), { agora: AGORA });
    const lista = await listarAvaliacoes(p, coord, { agora: AGORA });
    const mas = lista.filter((l) => l.iniciais === 'MAS');
    expect(mas.map((l) => l.avaliacoesDaPessoa)).toEqual([2, 2]);
    expect(mas[0].reavaliacao?.situacao).toBe('em_dia');
    expect(mas[1].reavaliacao).toBeNull();
    expect(lista.find((l) => l.iniciais === 'JPS')?.reavaliacao?.situacao).toBe('atrasada');
  });

  it('o tipo de avaliação é obrigatório', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await expect(salvarAvaliacao(p, coord, { ...completa(), tipo: '' }, { agora: AGORA })).rejects.toThrow(/Tipo de avaliação/);
  });

  it('a lista vem da mais recente para a mais antiga, com índice e marca de violação', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await salvarAvaliacao(p, coord, completa({ data_avaliacao: '2026-10-01' }), { agora: AGORA });
    await salvarAvaliacao(p, coord, completa({ iniciais: 'JPS', data_avaliacao: '2026-11-02', barreiras: ['violencia_psicologica'] }), { agora: AGORA });
    const lista = await listarAvaliacoes(p, coord);
    expect(lista.map((l) => l.iniciais)).toEqual(['JPS', 'MAS']);
    expect(lista[0].violacao).toBe(true);
    expect(lista[0].indice).toBe(2);
    expect(lista[1].idade).toBe(68);
  });
  describe('números do serviço para outros apps (ADR-023)', () => {
    const pessoa = (i: number, x: Partial<DadosAvaliacao> = {}) => completa({ iniciais: `a${'bcdefghij'[i]}`, nascimento: `195${i}-03-02`, ...x });

    it('serviço sem avaliação: "sem dados"', async () => {
      const r = await indicadoresDoServico(p, 'ur', { agora: AGORA });
      expect(r.indiceMedio).toEqual({ valor: null, base: 0, motivo: 'sem_dados' });
      expect(r.reavaliacaoEmDia.motivo).toBe('sem_dados');
    });

    it('com 4 pessoas não revela valor; com 5 revela', async () => {
      const coord = await como('coord.ur@exemplo.local');
      for (let i = 0; i < 4; i++) await salvarAvaliacao(p, coord, pessoa(i), { agora: AGORA });
      const quatro = await indicadoresDoServico(p, 'ur', { agora: AGORA });
      expect(quatro.indiceMedio).toEqual({ valor: null, base: 4, motivo: 'poucos_casos' });
      expect(quatro.reavaliacaoEmDia).toEqual({ valor: null, base: 4, motivo: 'poucos_casos' });
      await salvarAvaliacao(p, coord, pessoa(4, { isolamento: 'Sim' }), { agora: AGORA });
      const cinco = await indicadoresDoServico(p, 'ur', { agora: AGORA });
      expect(cinco.indiceMedio).toEqual({ valor: 1.2, base: 5, motivo: null });
      expect(cinco.reavaliacaoEmDia).toEqual({ valor: 100, base: 5, motivo: null });
    });

    it('pessoa com duas avaliações conta uma vez, pela mais recente; vencida sai do "em dia"', async () => {
      const coord = await como('coord.ur@exemplo.local');
      for (let i = 0; i < 5; i++) await salvarAvaliacao(p, coord, pessoa(i, { data_avaliacao: '2025-01-10' }), { agora: new Date('2025-01-10T15:00:00Z') });
      await salvarAvaliacao(p, coord, pessoa(0, { tipo: 'Acompanhamento anual', data_avaliacao: '2026-11-03' }), { agora: AGORA });
      const r = await indicadoresDoServico(p, 'ur', { agora: AGORA });
      expect(r.indiceMedio.base).toBe(5);
      // 4 pessoas com avaliação de janeiro de 2025 estão vencidas; 1 foi reavaliada
      expect(r.reavaliacaoEmDia).toEqual({ valor: 20, base: 5, motivo: null });
    });

    it('a resposta não tem nenhum campo além de valor, base e motivo', async () => {
      const r = await indicadoresDoServico(p, 'ur', { agora: AGORA });
      for (const n of [r.indiceMedio, r.reavaliacaoEmDia]) expect(Object.keys(n).sort()).toEqual(['base', 'motivo', 'valor']);
      expect(Object.keys(r).sort()).toEqual(['indiceMedio', 'reavaliacaoEmDia']);
    });
  });

});
