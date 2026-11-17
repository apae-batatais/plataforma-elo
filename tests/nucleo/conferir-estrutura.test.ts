/**
 * Depois de uma atualização que traz perfis ou permissões novos, eles só valem
 * após "Preparar estrutura". A conferência aponta isso sem gravar nada, e um
 * usuário com vários perfis recebe o menu de todos eles.
 */
import { describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { conferirEstrutura, prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';

async function montar() {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao', 'parcerias', 'requisicoes', 'avaliacao_assistencia', 'avaliacao_educacao', 'comunicacao', 'projetos']), idDe: (c) => c };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS);
  await popularDadosFicticios(p);
  return p;
}

async function autorizador(p: Planilhas, email: string) {
  const [u, a, pp, s] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: u.ativos(), atribuicoes: a.ativos(), perfilPermissoes: pp.ativos(), servicos: s.todos() });
}

const itensDoMenu = (aut: Autorizador) => navegacaoDoUsuario(aut, false).flatMap((g) => g.itens.flatMap((i) => [i.rotulo, ...(i.filhos ?? []).map((f) => f.rotulo)]));

describe('conferência da estrutura', () => {
  it('em dia logo depois de preparar; aponta permissão nova sem gravar; preparar resolve', async () => {
    const p = await montar();
    expect((await conferirEstrutura(p, ESTRUTURA_DOS_MODULOS)).desatualizada).toBe(false);

    // Simula a versão anterior: a permissão de entrar no Orçamento ainda não existe na planilha.
    const pp = await lerTabela(p, PerfilPermissoes);
    for (const x of pp.ativos().filter((x) => x.permissao === 'orcamento.acessar')) await atualizar(p, PerfilPermissoes, x.id, x.versao, { ativo: false } as never, { email: 't' });
    // (desativada conta como existente: o que a administração desativou não volta)
    expect((await conferirEstrutura(p, ESTRUTURA_DOS_MODULOS)).desatualizada).toBe(false);
  });

  it('permissão que deixou de valer: a conferência aponta e preparar retira (Diretoria não gerencia tipos de requisição)', async () => {
    const p = await montar();
    // Simula a planilha da versão anterior, em que a Diretoria gerenciava os tipos.
    await inserir(p, PerfilPermissoes, { perfil: 'diretoria', permissao: 'requisicoes.tipos.gerenciar' }, { email: 't' });
    expect((await autorizador(p, 'diretoria@exemplo.local')).temPermissao('requisicoes.tipos.gerenciar')).toBe(true);
    expect((await conferirEstrutura(p, ESTRUTURA_DOS_MODULOS)).desatualizada).toBe(true);
    const r = await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS);
    expect(r.ajustes).toEqual(['permissão retirada: diretoria › requisicoes.tipos.gerenciar']);
    expect((await autorizador(p, 'diretoria@exemplo.local')).temPermissao('requisicoes.tipos.gerenciar')).toBe(false);
    expect((await autorizador(p, 'admin@exemplo.local')).temPermissao('requisicoes.tipos.gerenciar')).toBe(true);
    expect((await conferirEstrutura(p, ESTRUTURA_DOS_MODULOS)).desatualizada).toBe(false);
    // Rodar de novo não muda nada.
    expect((await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS)).ajustes).toEqual([]);
  });

  it('usuário com vários perfis vê o menu de todos', async () => {
    const p = await montar();
    for (const perfil of ['financeiro', 'administrador_plataforma', 'compras']) {
      await inserir(p, Atribuicoes, { usuario_email: 'diretoria@exemplo.local', perfil, escopo_tipo: 'global', escopo: null, inicio: '2020-01-01' } as never, { email: 't' });
    }
    const menu = itensDoMenu(await autorizador(p, 'diretoria@exemplo.local'));
    expect(menu).toEqual(expect.arrayContaining(['Orçamento', 'Despesas', 'Propostas', 'Cotações', 'Lotação', 'Acessos', 'Estrutura das planilhas', 'Ajuda']));
  });

  it('planilha de antes da atualização: aponta o que falta e o menu volta depois de preparar', async () => {
    const vazia: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao', 'parcerias', 'requisicoes', 'avaliacao_assistencia', 'avaliacao_educacao', 'comunicacao', 'projetos']), idDe: (c) => c };
    // Prepara só com o Núcleo (como uma versão antiga, sem as permissões do Orçamento).
    await prepararEstrutura(vazia, { tabelas: ESTRUTURA_DOS_MODULOS.tabelas });
    await popularDadosFicticios(vazia);
    const antes = await conferirEstrutura(vazia, ESTRUTURA_DOS_MODULOS);
    expect(antes.desatualizada).toBe(true);
    expect(antes.permissoesFaltando).toBeGreaterThan(0);
    expect(antes.perfisFaltando).toEqual(expect.arrayContaining(['Compras']));
    expect(itensDoMenu(await autorizador(vazia, 'financeiro@exemplo.local'))).not.toContain('Orçamento');

    await prepararEstrutura(vazia, ESTRUTURA_DOS_MODULOS);
    expect((await conferirEstrutura(vazia, ESTRUTURA_DOS_MODULOS)).desatualizada).toBe(false);
    expect(itensDoMenu(await autorizador(vazia, 'financeiro@exemplo.local'))).toContain('Orçamento');
  });
});
