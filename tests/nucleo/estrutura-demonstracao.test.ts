import { describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabela, lerTabelas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { lerConfig } from '@/nucleo/config';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { USUARIOS_FICTICIOS } from '@/nucleo/estrutura/dados-ficticios';
import { Atribuicoes, PerfilPermissoes, Perfis, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { listarPessoasVisiveis } from '@/nucleo/pessoas/servico';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

describe('preparar estrutura', () => {
  it('cria as abas, grava perfis e permissões, e rodar de novo não muda nada', async () => {
    const p = await planilhasDeTeste();
    expect((await lerTabela(p, Perfis)).todos().map((x) => x.codigo)).toContain('diretoria');
    expect((await lerTabela(p, PerfilPermissoes)).todos().length).toBeGreaterThan(5);
    expect(await prepararEstrutura(p)).toEqual({ abasCriadas: [], registrosIniciais: 0, ajustes: [] });
  });
});

describe('demonstração', () => {
  it('cada perfil fictício vê o que deve', async () => {
    const p = await planilhasDeTeste({ comDadosFicticios: true });
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    const dados = { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() };
    const quantos = async (email: string) => (await listarPessoasVisiveis(p, new Autorizador(email, dados))).length;
    expect(await quantos('coord.ur@exemplo.local')).toBe(25);
    expect(await quantos('diretoria@exemplo.local')).toBe(88); // 74 atendidos e familiares + 14 usuários
    expect(await quantos('admin@exemplo.local')).toBe(1);
    expect(usuarios.ativos()).toHaveLength(USUARIOS_FICTICIOS.length);
  });
});

describe('auditoria', () => {
  it('registra ação e colunas, nunca valores', async () => {
    const p = await planilhasDeTeste();
    await registrarAuditoria(p, { usuario: 'ana@x', acao: 'alteracao', entidade: 'Pessoas', registroId: '1', detalhes: { colunas: ['telefone'] } });
    expect((await lerTabela(p, RegistrosAuditoria)).todos()).toEqual([
      expect.objectContaining({ usuario: 'ana@x', acao: 'alteracao', entidade: 'Pessoas', registro_id: '1', detalhes: '{"colunas":["telefone"]}' }),
    ]);
  });
});

describe('configuração', () => {
  it('sem credenciais do Google, fica em demonstração', () => {
    expect(lerConfig({}).modo).toBe('demonstracao');
  });

  it('MODO_DEMONSTRACAO=1 ignora credenciais reais: login fictício nunca toca dados reais', () => {
    expect(lerConfig({ MODO_DEMONSTRACAO: '1', GOOGLE_CONTA_SERVICO: '{"client_email":"a@b.c"}' }).modo).toBe('demonstracao');
  });

  it('produção incompleta é recusada, dizendo o que falta', () => {
    expect(() => lerConfig({ GOOGLE_CONTA_SERVICO: '{"client_email":"sa@proj.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----x"}' })).toThrow(
      /planilhas|googleClientId|segredoSessao/,
    );
  });

  it('ID do cliente: aceita com espaços e aspas coladas por engano; recusa valor errado explicando o formato', () => {
    const base = {
      GOOGLE_CONTA_SERVICO: '{"client_email":"sa@proj.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----x"}',
      PLANILHAS: '{"nucleo":"1AbCdEfGhIjK","auditoria":"1ZyXwVuTsRqP"}',
      SESSAO_SEGREDO: 'x'.repeat(40),
      DOMINIO: 'apaeexemplo.org.br',
    };
    const c = lerConfig({ ...base, GOOGLE_CLIENT_ID: ' "123456-abc123.apps.googleusercontent.com"\n' });
    expect(c.modo === 'producao' && c.googleClientId).toBe('123456-abc123.apps.googleusercontent.com');
    expect(() => lerConfig({ ...base, GOOGLE_CLIENT_ID: 'GOCSPX-segredo-colado-por-engano' })).toThrow(/ID do cliente.*apps\.googleusercontent\.com/);
    expect(() => lerConfig({ ...base, GOOGLE_CLIENT_ID: '123456789012' })).toThrow(/ID do cliente/);
  });

  it('produção completa', () => {
    const c = lerConfig({
      GOOGLE_CONTA_SERVICO: '{"client_email":"sa@proj.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----x"}',
      PLANILHAS: '{"nucleo":"1AbCdEfGhIjK","auditoria":"1ZyXwVuTsRqP"}',
      GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com',
      SESSAO_SEGREDO: 'x'.repeat(40),
      ADMINISTRADORES_INICIAIS: 'Diretoria@apaebatatais.org.br',
      DOMINIO: 'apaebatatais.org.br',
    });
    expect(c.modo).toBe('producao');
    if (c.modo === 'producao') expect(c.administradoresIniciais).toEqual(['diretoria@apaebatatais.org.br']);
  });
});
