import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import {
  acompanharPublicacao,
  darCiencia,
  lerPublicacao,
  listarAcompanhamento,
  meusDocumentos,
  pendenciasDaPessoa,
  publicacaoParaEditar,
  salvarPublicacao,
} from '../aplicacao/publicacoes';
import { enviarTeste } from '../aplicacao/teste';
import { PerguntasConhecimento, TentativasTeste } from '../dados/tabelas';
import type { PerguntaEntrada } from '../dominio/publicacao';
import { AGORA, categoriaPronta, como, COZINHA, dados, DIRETORIA, EDITOR, FUNCIONARIO, planilhasDeConhecimento, publicada } from './apoio';

const PERGUNTAS: PerguntaEntrada[] = [
  { texto: 'Primeira?', opcoes: ['a', 'b', 'c'], correta: 1 },
  { texto: 'Segunda?', opcoes: ['sim', 'não'], correta: 0 },
];
const opc = { agora: AGORA };
let p: Planilhas;
beforeEach(async () => {
  p = await planilhasDeConhecimento();
});

const comTeste = (x: Parameters<typeof dados>[0] = {}) => publicada(p, { temTeste: true, perguntas: PERGUNTAS, ...x });

describe('cadastro do teste (regra 12)', () => {
  it('publicada com teste exige ao menos uma pergunta válida; rascunho aceita teste vazio', async () => {
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    await expect(salvarPublicacao(p, editor, null, dados({ temTeste: true, perguntas: [] }), opc)).rejects.toThrow(/ao menos uma pergunta/);
    await expect(salvarPublicacao(p, editor, null, dados({ temTeste: true, perguntas: [{ texto: 'x', opcoes: ['a', 'b'], correta: 5 }] }), opc)).rejects.toThrow(/opção certa/);
    await expect(salvarPublicacao(p, editor, null, dados({ publicar: false, titulo: 'R2', temTeste: true, perguntas: [] }), opc)).resolves.toBeTruthy();
  });

  it('grava as perguntas com gabarito e audita só as colunas', async () => {
    const { id } = await comTeste();
    const q = (await lerTabela(p, PerguntasConhecimento)).ativos().filter((x) => x.publicacao_id === id);
    expect(q.map((x) => [x.ordem, x.correta])).toEqual([[1, 1], [2, 0]]);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id && a.entidade === 'PerguntasConhecimento');
    expect(aud).toHaveLength(1);
    expect(JSON.stringify(aud)).not.toContain('Primeira?');
  });

  it('só quem publica vê o gabarito na edição; o público nunca o recebe', async () => {
    const { id } = await comTeste();
    const ed = await publicacaoParaEditar(p, await como(p, EDITOR), id);
    expect(ed.perguntas[0].correta).toBe(1);
    await expect(publicacaoParaEditar(p, await como(p, FUNCIONARIO), id)).rejects.toThrow(ErroPermissao);
    const d = await lerPublicacao(p, await como(p, FUNCIONARIO), id, opc);
    expect(d.perguntas).toHaveLength(2);
    expect(JSON.stringify(d)).not.toContain('correta');
  });
});

describe('fazer o teste (regras 11, 13 e 14)', () => {
  it('erra: mostra quais errou, grava a tentativa e não libera a ciência; pode tentar de novo', async () => {
    const { id } = await comTeste();
    const quem = await como(p, FUNCIONARIO);
    const r = await enviarTeste(p, quem, id, [0, 0], opc);
    expect(r).toEqual({ acertos: 1, total: 2, aprovada: false, erradas: [1] });
    await expect(darCiencia(p, quem, id, opc)).rejects.toThrow(/Acerte todas/);
    expect((await lerPublicacao(p, quem, id, opc)).podeDarCiencia).toBe(false);
    expect((await lerPublicacao(p, quem, id, opc)).cienciaEsperaTeste).toBe(true);
    const r2 = await enviarTeste(p, quem, id, [1, 0], opc);
    expect(r2.aprovada).toBe(true);
    const t = (await lerTabela(p, TentativasTeste)).todos();
    expect(t.map((x) => [x.acertos, x.aprovada, x.usuario])).toEqual([[1, false, FUNCIONARIO], [2, true, FUNCIONARIO]]);
  });

  it('depois de aprovar, a ciência é liberada e a pendência some', async () => {
    const { id } = await comTeste();
    const quem = await como(p, FUNCIONARIO);
    expect((await pendenciasDaPessoa(p, quem, opc)).total).toBe(1);
    await enviarTeste(p, quem, id, [1, 0], opc);
    expect((await pendenciasDaPessoa(p, quem, opc)).total).toBe(1);
    expect((await lerPublicacao(p, quem, id, opc)).podeDarCiencia).toBe(true);
    await darCiencia(p, quem, id, opc);
    expect((await pendenciasDaPessoa(p, quem, opc)).total).toBe(0);
    expect((await meusDocumentos(p, quem, opc))[0].minhaSituacao).toBe('em_dia');
  });

  it('teste sem ciência: aprovar basta para ficar em dia', async () => {
    const { id } = await comTeste({ exigeCiencia: false });
    const quem = await como(p, FUNCIONARIO);
    expect((await pendenciasDaPessoa(p, quem, opc)).total).toBe(1);
    await enviarTeste(p, quem, id, [1, 0], opc);
    expect((await pendenciasDaPessoa(p, quem, opc)).total).toBe(0);
    expect((await meusDocumentos(p, quem, opc))[0].minhaAprovacaoEm).toBe(AGORA.toISOString());
  });

  it('exige todas as respostas e valida o público, a situação e a existência do teste', async () => {
    const { id } = await comTeste({ publicoTipo: 'perfil', publicoValor: 'cozinha' });
    await expect(enviarTeste(p, await como(p, COZINHA), id, [1, null], opc)).rejects.toThrow(/Falta: 2/);
    await expect(enviarTeste(p, await como(p, FUNCIONARIO), id, [1, 0], opc)).rejects.toThrow(ErroPermissao);
    const sem = await salvarPublicacao(p, await como(p, EDITOR), null, dados({ titulo: 'Sem teste' }), opc);
    await expect(enviarTeste(p, await como(p, FUNCIONARIO), sem.id, [], opc)).rejects.toThrow(/não tem teste/);
    expect((await lerTabela(p, TentativasTeste)).todos()).toHaveLength(0);
  });

  it('tentativa registra auditoria sem o conteúdo das respostas', async () => {
    const { id } = await comTeste();
    await enviarTeste(p, await como(p, FUNCIONARIO), id, [0, 1], opc);
    const t = (await lerTabela(p, TentativasTeste)).todos()[0];
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === t.id);
    expect(aud).toHaveLength(1);
    expect(aud[0].acao).toBe('inclusao');
  });
});

describe('editar o teste (regra 7) e acompanhamento (regra 19)', () => {
  it('mudar o teste com tentativas pede a escolha; nova versão volta todos a pendentes', async () => {
    const { id } = await comTeste();
    const quem = await como(p, FUNCIONARIO);
    await enviarTeste(p, quem, id, [1, 0], opc);
    await darCiencia(p, quem, id, opc);
    const editor = await como(p, EDITOR);
    const novas = [{ texto: 'Nova?', opcoes: ['x', 'y'], correta: 0 }];
    const base = { id, versao: 1, ...dados({ temTeste: true, perguntas: novas }) };
    await expect(salvarPublicacao(p, editor, null, base, opc)).rejects.toThrow(/Escolha/);
    const r = await salvarPublicacao(p, editor, null, { ...base, tipoEdicao: 'nova' }, opc);
    expect(r.edicao).toBe(2);
    const d = await lerPublicacao(p, quem, id, opc);
    expect(d.minhaSituacao).toBe('precisa_renovar');
    expect(d.perguntas.map((x) => x.texto)).toEqual(['Nova?']);
    // As perguntas da edição anterior ficam guardadas.
    expect((await lerTabela(p, PerguntasConhecimento)).ativos().filter((x) => x.edicao === 1)).toHaveLength(2);
  });

  it('correção pequena troca as perguntas na mesma edição e mantém as aprovações', async () => {
    const { id } = await comTeste();
    const quem = await como(p, FUNCIONARIO);
    await enviarTeste(p, quem, id, [1, 0], opc);
    const editor = await como(p, EDITOR);
    const novas = [{ texto: 'Só uma?', opcoes: ['x', 'y'], correta: 1 }];
    await salvarPublicacao(p, editor, null, { id, versao: 1, ...dados({ temTeste: true, perguntas: novas, exigeCiencia: true }), tipoEdicao: 'pequena' }, opc);
    const d = await lerPublicacao(p, quem, id, opc);
    expect(d.edicao).toBe(1);
    expect(d.perguntas.map((x) => x.texto)).toEqual(['Só uma?']);
    expect(d.cienciaEsperaTeste).toBe(false);
  });

  it('só trocar o título não pede escolha nem mexe nas perguntas', async () => {
    const { id } = await comTeste();
    await enviarTeste(p, await como(p, FUNCIONARIO), id, [1, 0], opc);
    const editor = await como(p, EDITOR);
    await salvarPublicacao(p, editor, null, { id, versao: 1, ...dados({ titulo: 'Outro título', temTeste: true }) }, opc);
    expect((await lerTabela(p, PerguntasConhecimento)).ativos()).toHaveLength(2);
  });

  it('acompanhamento mostra a melhor tentativa só a quem acompanha, com auditoria de leitura', async () => {
    const { id } = await comTeste();
    await enviarTeste(p, await como(p, FUNCIONARIO), id, [0, 0], opc);
    await enviarTeste(p, await como(p, FUNCIONARIO), id, [1, 1], opc);
    await enviarTeste(p, await como(p, COZINHA), id, [1, 0], opc);
    const diretoria = await como(p, DIRETORIA);
    expect((await listarAcompanhamento(p, diretoria, opc)).map((l) => l.temTeste)).toEqual([true]);
    const a = await acompanharPublicacao(p, diretoria, id, opc);
    expect(a.pessoas.find((x) => x.email === FUNCIONARIO)?.melhorTentativa).toEqual({ acertos: 1, total: 2 });
    expect(a.pessoas.find((x) => x.email === COZINHA)?.melhorTentativa).toEqual({ acertos: 2, total: 2 });
    await expect(acompanharPublicacao(p, await como(p, FUNCIONARIO), id, opc)).rejects.toThrow(ErroPermissao);
    expect((await lerTabela(p, RegistrosAuditoria)).todos().some((x) => x.acao === 'leitura' && x.registro_id === id)).toBe(true);
  });
});
