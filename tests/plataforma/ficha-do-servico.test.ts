import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { atualizar, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { ligacaoOk } from '@/nucleo/ligacoes/ligacao';
import { fichaDoServico, lerLigacao, servicosVisiveis } from '@/plataforma/ligacoes';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

const AGORA = new Date('2026-11-14T15:00:00Z');
let p: Planilhas;

async function como(email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

describe('Ficha do serviço: quem abre', () => {
  it('a Diretoria abre a Ficha de qualquer serviço e vê os sete blocos', async () => {
    const f = await fichaDoServico(p, await como('diretoria@exemplo.local'), 'centro_dia_intergeracional', { agora: AGORA });
    expect(f).not.toBeNull();
    expect(f!.servico.nome).toContain('Centro Dia');
    expect(f!.vagas.vagas).toBe(80);
    expect(f!.vagas.ocupadas).toBeGreaterThan(0);
    for (const bloco of [f!.custo, f!.projetos, f!.requisicoes, f!.publicacoes, f!.avaliacao]) expect(bloco.estado).toBe('ok');
  });

  it('serviço fora do escopo responde como não encontrado', async () => {
    const quem = await como('coord.ur@exemplo.local');
    expect(await fichaDoServico(p, quem, 'escola', { agora: AGORA })).toBeNull();
    expect(await fichaDoServico(p, quem, 'nao_existe', { agora: AGORA })).toBeNull();
    expect((await fichaDoServico(p, quem, 'ur', { agora: AGORA }))?.servico.codigo).toBe('ur');
  });

  it('quem não tem a permissão (Funcionário) não abre nenhuma Ficha', async () => {
    const quem = await como('funcionario@exemplo.local');
    expect(await fichaDoServico(p, quem, 'ur', { agora: AGORA })).toBeNull();
    const servicos = (await lerTabelas(p, [Servicos] as const))[0].todos();
    expect(servicosVisiveis(servicos, quem)).toEqual([]);
  });

  it('a lista traz só os serviços do escopo da pessoa', async () => {
    const servicos = (await lerTabelas(p, [Servicos] as const))[0].todos();
    const todos = servicosVisiveis(servicos, await como('diretoria@exemplo.local'));
    expect(todos.length).toBe(servicos.filter((s) => s.ativo).length);
    expect(servicosVisiveis(servicos, await como('coord.ur@exemplo.local')).map((s) => s.codigo)).toEqual(['ur']);
    // Coordenação por área vê os serviços da área.
    const educacao = servicosVisiveis(servicos, await como('coord.educacao@exemplo.local')).map((s) => s.codigo);
    expect(educacao).toContain('escola');
    expect(educacao).not.toContain('ur');
  });
});

describe('Ficha do serviço: permissão de cada app (G3)', () => {
  it('sem permissão do Orçamento, o bloco de custo não traz nenhum valor', async () => {
    const f = await fichaDoServico(p, await como('tecnico.cer@exemplo.local'), 'cer_reabilitacao', { agora: AGORA });
    expect(f!.custo).toEqual({ estado: 'sem_permissao' });
    expect(JSON.stringify(f!.custo)).not.toMatch(/\d/);
    // Quem coordena o serviço vê o custo do próprio escopo.
    const coord = await fichaDoServico(p, await como('coord.ur@exemplo.local'), 'ur', { agora: AGORA });
    expect(coord!.custo.estado).toBe('ok');
  });

  it('a Leitura vê custo e avaliação agregados, mas só as requisições e pedidos que já veria', async () => {
    const f = await fichaDoServico(p, await como('leitura@exemplo.local'), 'centro_dia_intergeracional', { agora: AGORA });
    expect(f!.avaliacao.estado).toBe('ok');
    expect(f!.projetos.estado).toBe('ok');
    if (f!.projetos.estado === 'ok') expect(f!.projetos.dados.projetos).toEqual([]);
  });

  it('o custo bate: saldo = previsto − realizado e a soma das fontes fecha o total', async () => {
    const f = await fichaDoServico(p, await como('financeiro@exemplo.local'), 'centro_dia_intergeracional', { agora: AGORA });
    expect(f!.custo.estado).toBe('ok');
    if (f!.custo.estado !== 'ok') return;
    const c = f!.custo.dados;
    expect(c.ano).toBe(2026);
    expect(Math.round((c.previsto - c.realizado) * 100)).toBe(Math.round(c.saldo * 100));
    expect(Math.round(c.porFonte.reduce((s, l) => s + l.previsto, 0) * 100)).toBe(Math.round(c.previsto * 100));
    expect(Math.round(c.porFonte.reduce((s, l) => s + l.realizado, 0) * 100)).toBe(Math.round(c.realizado * 100));
  });
});

describe('Ficha do serviço: app desligado, erro e dado pessoal', () => {
  it('app desligado vira "indisponível" e os outros blocos continuam', async () => {
    const f = await fichaDoServico(p, await como('diretoria@exemplo.local'), 'centro_dia_intergeracional', {
      agora: AGORA,
      desligados: new Set(['orcamento', 'comunicacao']),
    });
    expect(f!.custo).toEqual({ estado: 'indisponivel' });
    expect(f!.publicacoes).toEqual({ estado: 'indisponivel' });
    expect(f!.requisicoes.estado).toBe('ok');
  });

  it('leitura que falha vira "erro" só naquele bloco; app desconhecido é indisponível', async () => {
    expect(await lerLigacao('orcamento', async () => Promise.reject(new Error('falhou')))).toEqual({ estado: 'erro' });
    expect(await lerLigacao('orcamento', async () => ligacaoOk(1))).toEqual({ estado: 'ok', dados: 1 });
    expect(await lerLigacao('inexistente', async () => ligacaoOk(1))).toEqual({ estado: 'indisponivel' });
  });

  it('nenhum bloco traz nome ou e-mail de pessoa (G4)', async () => {
    for (const email of ['diretoria@exemplo.local', 'financeiro@exemplo.local']) {
      const f = await fichaDoServico(p, await como(email), 'centro_dia_intergeracional', { agora: AGORA });
      const texto = JSON.stringify(f);
      expect(texto).not.toMatch(/@exemplo\.local/);
      expect(texto).not.toMatch(/fictíci[oa]\)/);
    }
  });

  it('serviço encerrado abre a Ficha com a data de encerramento', async () => {
    const servico = (await lerTabelas(p, [Servicos] as const))[0].todos().find((s) => s.codigo === 'transporte')!;
    await atualizar(p, Servicos, servico.id, servico.versao, { fim: '2026-03-31' }, { email: 'teste' });
    const f = await fichaDoServico(p, await como('diretoria@exemplo.local'), 'transporte', { agora: AGORA });
    expect(f!.encerradoEm).toBe('2026-03-31');
    const ativo = await fichaDoServico(p, await como('diretoria@exemplo.local'), 'escola', { agora: AGORA });
    expect(ativo!.encerradoEm).toBeNull();
  });
});
