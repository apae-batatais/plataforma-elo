/** Feriados do Núcleo: quem altera, validação, nacionais do ano, auditoria e migração da aba antiga. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, Feriados, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { conferirFeriado, feriadosNacionais } from '@/nucleo/feriados/calendario';
import { feriadosAtivos, incluirFeriado, incluirFeriadosNacionais, listarFeriados, tirarFeriado } from '@/nucleo/feriados/feriados';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
async function comPerfil(email: string, perfil: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  const u = [...usuarios.ativos(), { email, pessoa_id: null, ativo: true } as never];
  const a = [...atribuicoes.ativos(), { usuario_email: email, perfil, escopo_tipo: 'global', escopo: null, inicio: null, fim: null, ativo: true } as never];
  return new Autorizador(email, { usuarios: u, atribuicoes: a, perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('regras puras', () => {
  it('nacionais de 2026 e 2027 (Sexta-feira Santa móvel, 9 de julho) e data inválida recusada', () => {
    const f2026 = feriadosNacionais(2026);
    expect(f2026).toHaveLength(11);
    expect(f2026.find((f) => f.nome === 'Sexta-feira Santa')?.data).toBe('2026-04-03');
    expect(f2026.some((f) => f.data === '2026-07-09')).toBe(true);
    expect(feriadosNacionais(2027).find((f) => f.nome === 'Sexta-feira Santa')?.data).toBe('2027-03-26');
    expect(() => conferirFeriado({ data: '2026-02-30', nome: 'X' })).toThrow(/data/);
    expect(() => conferirFeriado({ data: '2026-02-20', nome: '  ' })).toThrow(/nome/);
  });
});

describe('cadastro de feriados', () => {
  it('só a Administração da plataforma inclui e tira; os demais perfis recebem erro de permissão', async () => {
    const adm = await comPerfil('adm.teste@exemplo.local', 'administrador_plataforma');
    expect(adm.temPermissao('core.feriados.gerenciar')).toBe(true);
    for (const perfil of ['diretoria', 'coordenacao_servico', 'leitura']) {
      const quem = await comPerfil(`${perfil}.teste@exemplo.local`, perfil);
      await expect(incluirFeriado(p, quem, { data: '2026-11-02', nome: 'Finados' })).rejects.toBeInstanceOf(ErroPermissao);
      await expect(incluirFeriadosNacionais(p, quem, 2026)).rejects.toBeInstanceOf(ErroPermissao);
      await expect(tirarFeriado(p, quem, 'x', 1)).rejects.toBeInstanceOf(ErroPermissao);
      await expect(listarFeriados(p, quem)).rejects.toBeInstanceOf(ErroPermissao);
    }
    await incluirFeriado(p, adm, { data: '2026-11-02', nome: 'Finados' });
    expect([...(await feriadosAtivos(p))]).toEqual(['2026-11-02']);
  });

  it('data repetida é recusada com a data e o nome já cadastrado; nacionais não duplicam', async () => {
    const adm = await comPerfil('adm.teste@exemplo.local', 'administrador_plataforma');
    expect(await incluirFeriadosNacionais(p, adm, 2026)).toBe(11);
    expect(await incluirFeriadosNacionais(p, adm, 2026)).toBe(0);
    await expect(incluirFeriado(p, adm, { data: '2026-11-02', nome: 'Outro' })).rejects.toThrow(/Já há feriado em 02\/11\/2026: Finados/);
    await expect(incluirFeriado(p, adm, { data: '', nome: 'X' })).rejects.toBeInstanceOf(ErroValidacao);
    await expect(incluirFeriadosNacionais(p, adm, 1800)).rejects.toBeInstanceOf(ErroValidacao);
  });

  it('tirar encerra o registro (nada é apagado) e audita só as colunas', async () => {
    const adm = await comPerfil('adm.teste@exemplo.local', 'administrador_plataforma');
    await incluirFeriado(p, adm, { data: '2026-11-02', nome: 'Finados' });
    const f = (await lerTabela(p, Feriados)).ativos()[0];
    await tirarFeriado(p, adm, f.id, f.versao);
    expect((await feriadosAtivos(p)).size).toBe(0);
    expect((await lerTabela(p, Feriados)).todos()).toHaveLength(1);
    // Pode incluir de novo a mesma data depois de tirada.
    await incluirFeriado(p, adm, { data: '2026-11-02', nome: 'Finados' });
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Feriados');
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'encerramento', 'inclusao']);
    expect(JSON.stringify(aud)).not.toContain('Finados');
  });
});

describe('migração em "Preparar estrutura"', () => {
  it('copia as datas da aba antiga sem repetir e sem duplicar ao rodar de novo', async () => {
    const antigos = async () => [
      { data: '2026-11-02', nome: 'Finados' },
      { data: '2026-11-02', nome: 'Finados (repetido)' },
      { data: '2026-12-24', nome: 'Ponto facultativo' },
    ];
    const adm = await comPerfil('adm.teste@exemplo.local', 'administrador_plataforma');
    await incluirFeriado(p, adm, { data: '2026-11-02', nome: 'Já cadastrado' });
    const r1 = await prepararEstrutura(p, { feriadosAntigos: antigos });
    expect(r1.ajustes).toEqual(['1 feriados copiados para o Núcleo']);
    const r2 = await prepararEstrutura(p, { feriadosAntigos: antigos });
    expect(r2.ajustes).toEqual([]);
    const ativos = (await lerTabela(p, Feriados)).ativos();
    expect(ativos.map((f) => f.data).sort()).toEqual(['2026-11-02', '2026-12-24']);
    expect(ativos.find((f) => f.data === '2026-11-02')?.nome).toBe('Já cadastrado');
  });
});

