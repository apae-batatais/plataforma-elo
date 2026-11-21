import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { criarCategoria, listarCategorias, mudarSituacaoCategoria } from '../aplicacao/categorias';
import {
  acompanharPublicacao,
  darCiencia,
  lerPublicacao,
  listarAcompanhamento,
  listarBiblioteca,
  listarPublicacoes,
  meusDocumentos,
  mudarArquivamento,
  pendenciasDaPessoa,
  salvarPublicacao,
} from '../aplicacao/publicacoes';
import { CienciasConhecimento, PublicacoesConhecimento } from '../dados/tabelas';
import { ErroConhecimento } from '../dominio/publicacao';
import { ADMIN, AGORA, categoriaPronta, como, COORD_EDUCACAO, COZINHA, dados, DIRETORIA, EDITOR, FUNCIONARIO, LEITURA, planilhasDeConhecimento, publicada } from './apoio';

let p: Planilhas;
beforeEach(async () => {
  p = await planilhasDeConhecimento();
});
const opc = { agora: AGORA };

describe('quem publica (regras 1 e 2)', () => {
  it('só quem tem conhecimento.publicar grava', async () => {
    await categoriaPronta(p);
    for (const email of [FUNCIONARIO, ADMIN, LEITURA]) {
      await expect(salvarPublicacao(p, await como(p, email), null, dados(), opc)).rejects.toThrow(ErroPermissao);
    }
    expect((await lerTabela(p, PublicacoesConhecimento)).todos()).toHaveLength(0);
    for (const email of [EDITOR, DIRETORIA]) {
      await expect(salvarPublicacao(p, await como(p, email), null, dados({ titulo: `De ${email}` }), opc)).resolves.toBeTruthy();
    }
  });

  it('exige título, categoria ativa, público e texto ou anexo', async () => {
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    const tenta = (x: Parameters<typeof dados>[0]) => salvarPublicacao(p, editor, null, dados(x), opc);
    await expect(tenta({ titulo: ' ' })).rejects.toThrow(/título/);
    await expect(tenta({ categoria: 'inexistente' })).rejects.toThrow(/categoria/);
    await expect(tenta({ publicoTipo: 'perfil', publicoValor: null })).rejects.toThrow(/perfil/);
    await expect(tenta({ publicoTipo: 'area', publicoValor: '' })).rejects.toThrow(/área/);
    await expect(tenta({ corpo: '  ' })).rejects.toThrow(/texto ou envie um anexo/);
  });

  it('anexo exige armazenamento de arquivos ativo', async () => {
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    await expect(salvarPublicacao(p, editor, null, dados({ anexo: { arquivoId: 'x'.repeat(12) } }), opc)).rejects.toThrow(/Anexos ainda não/);
  });

  it('rascunho não aparece para o público nem gera pendência; publicar libera (regra 5)', async () => {
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    const r = await salvarPublicacao(p, editor, null, dados({ publicar: false }), opc);
    const func = await como(p, FUNCIONARIO);
    expect(await listarBiblioteca(p, func, opc)).toHaveLength(0);
    expect((await pendenciasDaPessoa(p, func, opc)).total).toBe(0);
    await expect(lerPublicacao(p, func, r.id, opc)).rejects.toThrow(ErroPermissao);
    await expect(darCiencia(p, func, r.id, opc)).rejects.toThrow(ErroConhecimento);
    const [pub] = (await lerTabela(p, PublicacoesConhecimento)).todos();
    expect(pub.situacao).toBe('rascunho');
    expect(pub.publicada_em).toBeNull();
    await salvarPublicacao(p, editor, null, dados({ id: r.id, versao: pub.versao, publicar: true }), opc);
    const [depois] = (await lerTabela(p, PublicacoesConhecimento)).todos();
    expect(depois.situacao).toBe('publicada');
    expect(depois.publicada_em).toBe(AGORA.toISOString());
    expect(await listarBiblioteca(p, func, opc)).toHaveLength(1);
  });

  it('auditoria grava só nomes de colunas, nunca valores', async () => {
    const r = await publicada(p, { titulo: 'Titulo secreto único' });
    const logs = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === r.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].acao).toBe('inclusao');
    expect(logs[0].detalhes).not.toContain('Titulo secreto');
    expect(logs[0].detalhes).toContain('titulo');
  });
});

describe('público-alvo (regra 4)', () => {
  it('"todos": quem tem acesso ao app vê; perfil: só o perfil; área: só quem tem escopo na área', async () => {
    const todos = await publicada(p, { titulo: 'Para todos' });
    const perfil = (await salvarPublicacao(p, await como(p, EDITOR), null, dados({ titulo: 'Para cozinha', publicoTipo: 'perfil', publicoValor: 'cozinha' }), opc)).id;
    const area = (await salvarPublicacao(p, await como(p, EDITOR), null, dados({ titulo: 'Para educação', publicoTipo: 'area', publicoValor: 'educacao' }), opc)).id;
    const ids = async (email: string) => (await listarBiblioteca(p, await como(p, email), opc)).filter((x) => x.doPublico).map((x) => x.id).sort();
    expect(await ids(FUNCIONARIO)).toEqual([todos.id]);
    expect(await ids(COZINHA)).toEqual([todos.id, perfil].sort());
    expect(await ids(COORD_EDUCACAO)).toEqual([todos.id, area].sort());
    // Fora do público: não abre a publicação, nem o anexo, nem dá ciência.
    const func = await como(p, FUNCIONARIO);
    await expect(lerPublicacao(p, func, perfil, opc)).rejects.toThrow(ErroPermissao);
    await expect(darCiencia(p, func, area, opc)).rejects.toThrow(ErroPermissao);
  });

  it('quem entra no público depois passa a ver a pendência', async () => {
    const r = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    const antes = await pendenciasDaPessoa(p, await como(p, FUNCIONARIO), opc);
    expect(antes.total).toBe(0);
    const { Atribuicoes } = await import('@/nucleo/estrutura/tabelas');
    const { inserir } = await import('@/nucleo/armazenamento/tabela');
    await inserir(p, Atribuicoes, { usuario_email: FUNCIONARIO, perfil: 'cozinha', escopo_tipo: 'global', escopo: null }, { email: 'teste', agora: () => AGORA });
    const depois = await pendenciasDaPessoa(p, await como(p, FUNCIONARIO), opc);
    expect(depois.itens.map((i) => i.id)).toEqual([r.id]);
  });

  it('editor vê qualquer publicação, mas não tem pendência fora do público', async () => {
    const r = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    const editor = await como(p, EDITOR);
    expect((await lerPublicacao(p, editor, r.id, opc)).podeDarCiencia).toBe(false);
    expect((await pendenciasDaPessoa(p, editor, opc)).total).toBe(0);
  });
});

describe('ciência (regras 9 e 10)', () => {
  it('grava usuário da sessão, edição e hora do servidor; repetir não duplica', async () => {
    const r = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    expect((await darCiencia(p, func, r.id, opc)).jaRegistrada).toBe(false);
    expect((await darCiencia(p, func, r.id, { agora: new Date('2026-11-22T10:00:00Z') })).jaRegistrada).toBe(true);
    const linhas = (await lerTabela(p, CienciasConhecimento)).todos();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ publicacao_id: r.id, edicao: 1, usuario: FUNCIONARIO, registrada_em: AGORA.toISOString() });
    const det = await lerPublicacao(p, func, r.id, opc);
    expect(det.minhaSituacao).toBe('em_dia');
    expect(det.podeDarCiencia).toBe(false);
  });

  it('publicação sem exigência não aceita ciência', async () => {
    const r = await publicada(p, { exigeCiencia: false });
    await expect(darCiencia(p, await como(p, FUNCIONARIO), r.id, opc)).rejects.toThrow(/não pede ciência/);
    expect(await meusDocumentos(p, await como(p, FUNCIONARIO), opc)).toHaveLength(0);
  });

  it('arquivada não aceita ciência', async () => {
    const r = await publicada(p);
    await mudarArquivamento(p, await como(p, EDITOR), r.id, 1, true, opc);
    await expect(darCiencia(p, await como(p, FUNCIONARIO), r.id, opc)).rejects.toThrow(ErroConhecimento);
  });
});

describe('edição e versão (regras 7 e 8)', () => {
  async function comCiencia() {
    const r = await publicada(p);
    await darCiencia(p, await como(p, FUNCIONARIO), r.id, opc);
    const [pub] = (await lerTabela(p, PublicacoesConhecimento)).todos();
    return { id: r.id, versao: pub.versao };
  }

  it('mudar título, resumo, categoria ou público não pede escolha nem muda a edição', async () => {
    const { id, versao } = await comCiencia();
    const r = await salvarPublicacao(p, await como(p, EDITOR), null, dados({ id, versao, titulo: 'Novo título', resumo: 'Outro' }), opc);
    expect(r.edicao).toBe(1);
  });

  it('mudar o corpo com ciências exige escolher correção pequena ou nova versão', async () => {
    const { id, versao } = await comCiencia();
    await expect(salvarPublicacao(p, await como(p, EDITOR), null, dados({ id, versao, corpo: 'Texto novo' }), opc)).rejects.toThrow(/correção pequena/);
  });

  it('correção pequena mantém as ciências valendo', async () => {
    const { id, versao } = await comCiencia();
    const r = await salvarPublicacao(p, await como(p, EDITOR), null, dados({ id, versao, corpo: 'Texto corrigido', tipoEdicao: 'pequena' }), opc);
    expect(r.edicao).toBe(1);
    expect((await lerPublicacao(p, await como(p, FUNCIONARIO), id, opc)).minhaSituacao).toBe('em_dia');
  });

  it('nova versão soma 1 e volta todos a pendentes; a ciência antiga fica no histórico', async () => {
    const { id, versao } = await comCiencia();
    const depois = new Date('2026-11-25T12:00:00Z');
    const r = await salvarPublicacao(p, await como(p, EDITOR), null, dados({ id, versao, corpo: 'Texto novo', tipoEdicao: 'nova' }), { agora: depois });
    expect(r.edicao).toBe(2);
    const func = await como(p, FUNCIONARIO);
    const det = await lerPublicacao(p, func, id, { agora: depois });
    expect(det.minhaSituacao).toBe('precisa_renovar');
    expect(det.podeDarCiencia).toBe(true);
    expect((await pendenciasDaPessoa(p, func, { agora: depois })).total).toBe(1);
    await darCiencia(p, func, id, { agora: depois });
    expect((await lerTabela(p, CienciasConhecimento)).todos().map((c) => c.edicao).sort()).toEqual([1, 2]);
    expect((await lerPublicacao(p, func, id, { agora: depois })).minhaSituacao).toBe('em_dia');
  });

  it('sem ciência ainda, mudar o corpo não pede escolha', async () => {
    const r = await publicada(p);
    await expect(salvarPublicacao(p, await como(p, EDITOR), null, dados({ id: r.id, versao: 1, corpo: 'Outro' }), opc)).resolves.toBeTruthy();
  });

  it('versão lida desatualizada não sobrescreve', async () => {
    const r = await publicada(p);
    const editor = await como(p, EDITOR);
    await salvarPublicacao(p, editor, null, dados({ id: r.id, versao: 1, titulo: 'A' }), opc);
    await expect(salvarPublicacao(p, editor, null, dados({ id: r.id, versao: 1, titulo: 'B' }), opc)).rejects.toThrow(/alterado por outra pessoa/);
  });
});

describe('arquivar (regra 6)', () => {
  it('arquivada some da biblioteca e das pendências, mas fica em Meus documentos de quem deu ciência', async () => {
    const r = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    const outro = await como(p, COZINHA);
    await darCiencia(p, func, r.id, opc);
    await mudarArquivamento(p, await como(p, EDITOR), r.id, 1, true, opc);
    expect(await listarBiblioteca(p, func, opc)).toHaveLength(0);
    expect((await pendenciasDaPessoa(p, outro, opc)).total).toBe(0);
    expect((await meusDocumentos(p, func, opc)).map((d) => d.id)).toEqual([r.id]);
    expect(await meusDocumentos(p, outro, opc)).toHaveLength(0);
    expect((await lerPublicacao(p, func, r.id, opc)).situacao).toBe('arquivada');
    await expect(lerPublicacao(p, outro, r.id, opc)).rejects.toThrow(ErroPermissao);
    // Continua no acompanhamento.
    expect((await listarAcompanhamento(p, await como(p, EDITOR), opc)).map((l) => l.id)).toEqual([r.id]);
  });

  it('reativar volta para publicada; só quem publica arquiva', async () => {
    const r = await publicada(p);
    await expect(mudarArquivamento(p, await como(p, FUNCIONARIO), r.id, 1, true, opc)).rejects.toThrow(ErroPermissao);
    await mudarArquivamento(p, await como(p, EDITOR), r.id, 1, true, opc);
    await mudarArquivamento(p, await como(p, EDITOR), r.id, 2, false, opc);
    expect((await listarBiblioteca(p, await como(p, FUNCIONARIO), opc)).map((x) => x.id)).toEqual([r.id]);
  });
});

describe('Meus documentos e pendências (regras 18 e 20)', () => {
  it('pendentes primeiro, depois em dia; vencida passa de 15 dias', async () => {
    const velha = await publicada(p, { titulo: 'Velha' });
    const func = await como(p, FUNCIONARIO);
    const depois = new Date(AGORA.getTime() + 16 * 86_400_000);
    const nova = (await salvarPublicacao(p, await como(p, EDITOR), null, dados({ titulo: 'Nova' }), { agora: depois })).id;
    await darCiencia(p, func, nova, { agora: depois });
    const docs = await meusDocumentos(p, func, { agora: depois });
    expect(docs.map((d) => d.titulo)).toEqual(['Velha', 'Nova']);
    expect(docs[0]).toMatchObject({ minhaSituacao: 'pendente', vencida: true });
    expect(docs[1]).toMatchObject({ minhaSituacao: 'em_dia', vencida: false });
    const pend = await pendenciasDaPessoa(p, func, { agora: depois });
    expect(pend).toMatchObject({ total: 1, vencidas: 1 });
    // Dentro de 15 dias, não está vencida.
    expect((await pendenciasDaPessoa(p, func, opc)).vencidas).toBe(0);
    expect(velha.id).toBeTruthy();
  });
});

describe('acompanhamento (regra 19)', () => {
  it('só quem tem conhecimento.acompanhar vê; mostra X de Y e quem falta; a consulta é auditada', async () => {
    const r = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    const { Atribuicoes } = await import('@/nucleo/estrutura/tabelas');
    const { inserir } = await import('@/nucleo/armazenamento/tabela');
    await inserir(p, Atribuicoes, { usuario_email: FUNCIONARIO, perfil: 'cozinha', escopo_tipo: 'global', escopo: null }, { email: 'teste', agora: () => AGORA });
    await darCiencia(p, await como(p, COZINHA), r.id, opc);
    for (const email of [FUNCIONARIO, ADMIN, LEITURA]) {
      await expect(acompanharPublicacao(p, await como(p, email), r.id, opc)).rejects.toThrow(ErroPermissao);
      await expect(listarAcompanhamento(p, await como(p, email), opc)).rejects.toThrow(ErroPermissao);
    }
    const linhas = await listarAcompanhamento(p, await como(p, DIRETORIA), opc);
    expect(linhas[0]).toMatchObject({ emDia: 1, total: 2 });
    const a = await acompanharPublicacao(p, await como(p, EDITOR), r.id, opc);
    expect(a).toMatchObject({ emDia: 1, total: 2 });
    expect(a.pessoas.map((x) => [x.email, x.situacao])).toEqual([
      [FUNCIONARIO, 'pendente'],
      [COZINHA, 'em_dia'],
    ]);
    const leituras = (await lerTabela(p, RegistrosAuditoria)).todos().filter((l) => l.acao === 'leitura' && l.registro_id === r.id);
    expect(leituras).toHaveLength(1);
    expect(leituras[0].detalhes).not.toContain('@');
  });

  it('quem saiu do público continua na lista com a ciência dada', async () => {
    const r = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    await darCiencia(p, await como(p, COZINHA), r.id, opc);
    await salvarPublicacao(p, await como(p, EDITOR), null, dados({ id: r.id, versao: 1, publicoTipo: 'perfil', publicoValor: 'patrimonio' }), opc);
    const a = await acompanharPublicacao(p, await como(p, EDITOR), r.id, opc);
    expect(a.pessoas.find((x) => x.email === COZINHA)?.situacao).toBe('em_dia');
  });

  it('rascunho e publicação sem exigência não entram no acompanhamento', async () => {
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    await salvarPublicacao(p, editor, null, dados({ publicar: false }), opc);
    await salvarPublicacao(p, editor, null, dados({ titulo: 'Sem exigência', exigeCiencia: false }), opc);
    expect(await listarAcompanhamento(p, editor, opc)).toHaveLength(0);
    expect((await listarPublicacoes(p, editor, opc)).map((l) => l.situacao).sort()).toEqual(['publicada', 'rascunho']);
  });
});

describe('categorias', () => {
  it('só quem gerencia categorias cria; qualquer pessoa com acesso lê a lista', async () => {
    await expect(criarCategoria(p, await como(p, FUNCIONARIO), 'Qualquer', opc)).rejects.toThrow(ErroPermissao);
    await expect(criarCategoria(p, await como(p, DIRETORIA), 'Qualquer', opc)).rejects.toThrow(ErroPermissao);
    await criarCategoria(p, await como(p, ADMIN), 'Comunicados gerais', opc);
    await criarCategoria(p, await como(p, EDITOR), 'Normas', opc);
    await expect(criarCategoria(p, await como(p, EDITOR), 'normas', opc)).rejects.toThrow(/Já existe/);
    expect((await listarCategorias(p, await como(p, FUNCIONARIO))).map((c) => c.codigo).sort()).toEqual(['comunicados_gerais', 'normas']);
  });

  it('com publicação não arquivada, não desativa; arquivando, desativa', async () => {
    const r = await publicada(p);
    const editor = await como(p, EDITOR);
    const [cat] = await listarCategorias(p, editor);
    await expect(mudarSituacaoCategoria(p, editor, cat.id, cat.versao, false, opc)).rejects.toThrow(/Mova ou arquive/);
    await mudarArquivamento(p, editor, r.id, 1, true, opc);
    await mudarSituacaoCategoria(p, editor, cat.id, cat.versao, false, opc);
    await expect(salvarPublicacao(p, editor, null, dados({ publicar: false }), opc)).rejects.toThrow(/categoria ativa/);
  });
});
