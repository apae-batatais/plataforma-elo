/**
 * Primeiro uso em produção: planilhas recém-criadas, em branco (sem abas).
 * Reproduz o defeito em que a administradora inicial não conseguia passar da
 * tela de login, porque a plataforma tentava ler abas que ainda não existiam.
 */
import { describe, expect, it } from 'vitest';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Usuarios } from '@/nucleo/estrutura/tabelas';
import { carregarUsuario, podeEntrar } from '@/nucleo/sessao/carregar';

const ADMIN = { email: 'diretoria@inst-a-exemplo.org.br', nome: 'Diretoria' };

function planilhasEmBranco(): Planilhas {
  return { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria']), idDe: (c) => c };
}

describe('primeiro uso com planilhas em branco', () => {
  it('a administradora inicial entra e cai em "estrutura pendente", com permissão para prepará-la', async () => {
    const p = planilhasEmBranco();
    expect(await podeEntrar(p, ADMIN.email, true)).toBe(true);
    const u = await carregarUsuario(p, ADMIN, { administradorInicial: true });
    expect(u?.estruturaPendente).toBe(true);
    expect(u?.autorizador.temPermissao('core.organizacao.gerenciar')).toBe(true);
    expect(u?.autorizador.temPermissao('core.pessoas.ver')).toBe(false);
  });

  it('qualquer outra pessoa não entra', async () => {
    const p = planilhasEmBranco();
    expect(await podeEntrar(p, 'outra@inst-a-exemplo.org.br', false)).toBe(false);
    expect(await carregarUsuario(p, { email: 'outra@inst-a-exemplo.org.br', nome: 'Outra' }, { administradorInicial: false })).toBeNull();
  });

  it('planilha sem acesso: o login mostra o motivo, mesmo para a administradora inicial', async () => {
    const semAcesso: Planilhas = {
      armazenamento: { ...new ArmazenamentoMemoria([]), lerAbas: async () => { throw new ErroArmazenamento('A conta de serviço da plataforma não tem acesso à planilha nucleo.'); } } as never,
      idDe: (c) => c,
    };
    await expect(podeEntrar(semAcesso, ADMIN.email, true)).rejects.toThrow(/não tem acesso/);
    await expect(carregarUsuario(semAcesso, ADMIN, { administradorInicial: true })).rejects.toThrow(/não tem acesso/);
  });

  it('depois de "Preparar estrutura", a administradora entra normalmente', async () => {
    const p = planilhasEmBranco();
    await prepararEstrutura(p);
    const u = await carregarUsuario(p, ADMIN, { administradorInicial: true });
    expect(u?.estruturaPendente).toBe(false);
    expect(u?.autorizador.temPermissao('core.acessos.gerenciar')).toBe(true);
  });

  it('"Preparar estrutura" usa poucas operações (cabe no limite de tempo da hospedagem)', async () => {
    const p = planilhasEmBranco();
    let operacoes = 0;
    const a = p.armazenamento as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const m of ['lerAbas', 'acrescentar', 'gravarLinha', 'garantirAbas']) {
      const original = a[m].bind(p.armazenamento);
      a[m] = (...args: unknown[]) => {
        operacoes++;
        return original(...args);
      };
    }
    const r = await prepararEstrutura(p);
    expect(r.abasCriadas).toHaveLength(14);
    expect(r.registrosIniciais).toBe(31); // 1 unidade (padrão) + 7 áreas + 7 perfis + 16 permissões
    // 2 (abas, uma por planilha) + 1 (leitura) + 4 (gravações) = 7
    expect(operacoes).toBeLessThanOrEqual(7);
  });

  it('o Google Planilhas avisa "aba inexistente" com o erro de estrutura ausente', async () => {
    const fetchFalso = (async () =>
      ({ ok: false, status: 400, json: async () => ({}), text: async () => "Unable to parse range: 'Usuarios'" }) as Response) as typeof fetch;
    const p: Planilhas = { armazenamento: new ArmazenamentoGooglePlanilhas(async () => 't', fetchFalso), idDe: (c) => c };
    await expect(lerTabela(p, Usuarios)).rejects.toBeInstanceOf(ErroEstruturaAusente);
  });
});
