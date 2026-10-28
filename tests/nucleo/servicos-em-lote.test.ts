/**
 * Cadastro de serviços em lote: a Diretoria cola linhas copiadas de uma
 * planilha, confere a prévia e confirma. Dados fictícios.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { analisarServicosEmLote, cadastrarServico, cadastrarServicosEmLote } from '@/nucleo/acesso/gestao';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const admin = async () => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador('diretoria@apaebatatais.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, { administradorInicial: true });
};

const LISTA = [
  'Nome\tÁrea\tUnidade\tVagas',
  'Centro Dia Intergeracional\tAssistência Social\tSede\t80',
  'Serviço no Domicílio\tassistencia social\t\t40',
  'Viveiro de Mudas\tRural\tFilial',
  'Reabilitação Física\tSaúde',
  'Oficina de Costura\tOficinas',
  'Viveiro de mudas\tRural\tRural',
  '',
].join('\n');

beforeEach(async () => {
  p = await planilhasDeTeste();
});

describe('serviços em lote', () => {
  it('lê a lista colada: reconhece área e unidade sem acento nem maiúsculas, gera códigos e aponta problemas', async () => {
    const r = await analisarServicosEmLote(p, await admin(), LISTA);
    expect(r.map((l) => [l.nome, l.codigo, l.area, l.unidade, l.vagas, l.situacao])).toEqual([
      ['Centro Dia Intergeracional', 'centro_dia_intergeracional', 'assistencia_social', 'sede', 80, 'ok'],
      ['Serviço no Domicílio', 'servico_no_domicilio', 'assistencia_social', 'sede', 40, 'ok'],
      ['Viveiro de Mudas', 'viveiro_de_mudas', 'rural', 'rural', null, 'ok'],
      ['Reabilitação Física', 'reabilitacao_fisica', 'saude', 'sede', null, 'ok'],
      ['Oficina de Costura', '', null, 'sede', null, 'erro'],
      ['Viveiro de mudas', '', 'rural', 'rural', null, 'ja_existe'],
    ]);
    expect(r[4].problema).toMatch(/Área "Oficinas" não encontrada/);
  });

  it('aceita ponto e vírgula e ignora o que já está cadastrado', async () => {
    const adm = await admin();
    await cadastrarServico(p, adm, { codigo: 'ur', nome: 'Unidade Referenciada', unidade: 'sede', area: 'assistencia_social', vagas: null });
    const r = await analisarServicosEmLote(p, adm, 'Unidade Referenciada;Assistência Social\nEscola;Educação');
    expect(r.map((l) => l.situacao)).toEqual(['ja_existe', 'ok']);
  });

  it('cadastra numa gravação só, com uma auditoria; repetir a confirmação é recusado', async () => {
    const adm = await admin();
    const ok = (await analisarServicosEmLote(p, adm, LISTA)).filter((l) => l.situacao === 'ok');
    const linhas = ok.map((l) => ({ codigo: l.codigo, nome: l.nome, area: l.area!, unidade: l.unidade!, vagas: l.vagas }));
    expect(await cadastrarServicosEmLote(p, adm, linhas)).toBe(4);
    expect((await lerTabela(p, Servicos)).ativos()).toHaveLength(4);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Servicos');
    expect(auditoria).toHaveLength(1);
    await expect(cadastrarServicosEmLote(p, adm, linhas)).rejects.toThrow(/já foi cadastrada/);
  });

  it('só quem gerencia a organização usa o cadastro em lote', async () => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    const outro = new Autorizador('alguem@apaebatatais.org.br', { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
    await expect(analisarServicosEmLote(p, outro, LISTA)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(cadastrarServicosEmLote(p, outro, [])).rejects.toBeInstanceOf(ErroPermissao);
  });
});
