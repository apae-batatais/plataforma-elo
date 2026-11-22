/** Entrega P7 (regras 26 e 27): ligações do projeto e catálogo de leitura. */
import { describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { encerrarLigacao, lerLigacoesDoProjeto, registrarLigacao, type CatalogoLeitura } from '../aplicacao/ligacoes';
import { LigacoesProjeto } from '../dados/tabelas';
import { AGORA, COORDENACAO, FUNCIONARIO, LEITURA, OUTRO_FUNCIONARIO, comResponsavel, como, planilhasDeProjetos } from './apoio';

const o = { agora: AGORA };
const dados = { app: 'avaliacao' as const, referenciaId: 'srv-1', nome: 'Serviço de exemplo' };

function catalogo(extra: Partial<CatalogoLeitura['leitores']> = {}, compras: CatalogoLeitura['compras'] = async () => ({ estado: 'ok', dados: [] })): CatalogoLeitura {
  return { leitores: extra, compras };
}

describe('LigacoesProjeto', () => {
  it('quem gerencia liga, e ligar de novo não duplica', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const coord = await como(p, COORDENACAO);
    const a = await registrarLigacao(p, coord, r.id, dados, o);
    const b = await registrarLigacao(p, coord, r.id, dados, o);
    expect(a.criada).toBe(true);
    expect(b).toEqual({ id: a.id, criada: false });
    expect((await lerTabela(p, LigacoesProjeto)).ativos()).toHaveLength(1);
  });

  it('quem só lê não altera; a auditoria guarda colunas, nunca valores', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    await expect(registrarLigacao(p, await como(p, LEITURA), r.id, dados, o)).rejects.toThrow();
    await registrarLigacao(p, await como(p, COORDENACAO), r.id, dados, o);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'LigacoesProjeto');
    expect(auditoria).toHaveLength(1);
    expect(JSON.stringify(auditoria)).not.toContain('Serviço de exemplo');
  });

  it('exige identificador e nome', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    await expect(registrarLigacao(p, await como(p, COORDENACAO), r.id, { ...dados, nome: ' ' }, o)).rejects.toThrow('Informe');
  });

  it('encerrar não apaga: a ligação fica inativa e some da aba', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const coord = await como(p, COORDENACAO);
    const { id } = await registrarLigacao(p, coord, r.id, dados, o);
    const versao = (await lerTabela(p, LigacoesProjeto)).porId(id)!.versao;
    await encerrarLigacao(p, coord, r.id, id, versao, o);
    expect((await lerTabela(p, LigacoesProjeto)).todos()).toHaveLength(1);
    expect((await lerLigacoesDoProjeto(p, coord, r.id, catalogo(), o))!.ligacoes).toHaveLength(0);
  });

  it('sem leitor (app desligado) mostra "indisponível", com a cópia do nome', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const coord = await como(p, COORDENACAO);
    await registrarLigacao(p, coord, r.id, dados, o);
    const l = await lerLigacoesDoProjeto(p, coord, r.id, catalogo(), o);
    expect(l!.ligacoes[0]).toMatchObject({ estado: 'indisponivel', nome: 'Serviço de exemplo' });
    const semCatalogo = await lerLigacoesDoProjeto(p, coord, r.id, null, o);
    expect(semCatalogo!.ligacoes[0].estado).toBe('indisponivel');
    expect(semCatalogo!.compras.estado).toBe('indisponivel');
  });

  it('leitura que falha vira indisponível e não derruba os outros blocos', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const coord = await como(p, COORDENACAO);
    await registrarLigacao(p, coord, r.id, dados, o);
    await registrarLigacao(p, coord, r.id, { app: 'orcamento', referenciaId: 'x', nome: 'Orçamento de exemplo' }, o);
    const l = await lerLigacoesDoProjeto(
      p,
      coord,
      r.id,
      catalogo(
        { avaliacao: async () => { throw new Error('falhou'); }, orcamento: async () => ({ nome: 'Orçamento atual', situacao: 'Aberto' }) },
        async () => { throw new Error('falhou'); },
      ),
      o,
    );
    expect(l!.ligacoes.find((x) => x.app === 'avaliacao')!.estado).toBe('indisponivel');
    expect(l!.ligacoes.find((x) => x.app === 'orcamento')).toMatchObject({ estado: 'ok', nomeAtual: 'Orçamento atual', situacao: 'Aberto' });
    expect(l!.compras.estado).toBe('erro');
  });

  it('sem permissão no app dono: só a cópia do nome, sem situação', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    const coord = await como(p, COORDENACAO);
    await registrarLigacao(p, coord, r.id, dados, o);
    const l = await lerLigacoesDoProjeto(p, coord, r.id, catalogo({ avaliacao: async () => null }), o);
    expect(l!.ligacoes[0]).toMatchObject({ estado: 'sem_permissao', situacao: null, nomeAtual: null });
  });

  it('quem não vê o projeto não lê as ligações; quem vê e não gerencia não altera', async () => {
    const p = await planilhasDeProjetos();
    const r = await comResponsavel(p);
    await registrarLigacao(p, await como(p, COORDENACAO), r.id, dados, o);
    expect(await lerLigacoesDoProjeto(p, await como(p, OUTRO_FUNCIONARIO), r.id, catalogo(), o)).toBeNull();
    const proponente = await lerLigacoesDoProjeto(p, await como(p, FUNCIONARIO), r.id, catalogo(), o);
    expect(proponente!.podeAlterar).toBe(false);
    const leitura = await lerLigacoesDoProjeto(p, await como(p, LEITURA), r.id, catalogo(), o);
    if (leitura) expect(leitura.podeAlterar).toBe(false);
    await expect(registrarLigacao(p, await como(p, FUNCIONARIO), r.id, dados, o)).rejects.toThrow(ErroPermissao);
  });
});
