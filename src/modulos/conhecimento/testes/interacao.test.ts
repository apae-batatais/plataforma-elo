import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { alternarCurtida, comentar, lerInteracao, mudarVisibilidadeComentario } from '../aplicacao/interacao';
import { darCiencia, lerPublicacao, mudarArquivamento, salvarPublicacao } from '../aplicacao/publicacoes';
import { ComentariosConhecimento, CurtidasConhecimento } from '../dados/tabelas';
import { AGORA, auditoriaDe, como, COZINHA, dados, EDITOR, FUNCIONARIO, LEITURA, planilhasDeConhecimento, publicada } from './apoio';

const opc = { agora: AGORA };
let p: Planilhas;
beforeEach(async () => {
  p = await planilhasDeConhecimento();
});

describe('curtir (regras 15 e 17)', () => {
  it('alterna na mesma linha, uma por pessoa, e conta só as ativas', async () => {
    const { id } = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    expect(await alternarCurtida(p, func, id, opc)).toEqual({ curtida: true });
    expect(await alternarCurtida(p, await como(p, COZINHA), id, opc)).toEqual({ curtida: true });
    expect((await lerInteracao(p, func, id, opc)).curtidas).toBe(2);
    expect(await alternarCurtida(p, func, id, opc)).toEqual({ curtida: false });
    expect(await alternarCurtida(p, func, id, opc)).toEqual({ curtida: true });
    const linhas = (await lerTabela(p, CurtidasConhecimento)).todos().filter((c) => c.usuario === FUNCIONARIO);
    expect(linhas).toHaveLength(1);
    const lida = await lerInteracao(p, func, id, opc);
    expect(lida).toMatchObject({ curtidas: 2, euCurti: true, podeInteragir: true });
  });

  it('grava auditoria só com as colunas, sem ids de pessoa', async () => {
    const { id } = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    await alternarCurtida(p, func, id, opc);
    await alternarCurtida(p, func, id, opc);
    const linha = (await lerTabela(p, CurtidasConhecimento)).todos()[0];
    const aud = await auditoriaDe(p, linha.id);
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'encerramento']);
    expect(aud.map((a) => a.detalhes)).toEqual(['{"colunas":["publicacao_id","usuario"]}', '{"colunas":["ativo"]}']);
  });

  it('só quem vê a publicação curte; arquivada e rascunho não recebem', async () => {
    const { id } = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    await expect(alternarCurtida(p, await como(p, FUNCIONARIO), id, opc)).rejects.toThrow(ErroPermissao);
    await expect(alternarCurtida(p, await como(p, COZINHA), id, opc)).resolves.toEqual({ curtida: true });
    const editor = await como(p, EDITOR);
    await mudarArquivamento(p, editor, id, (await lerPublicacao(p, editor, id, opc)).versao, true, opc);
    expect((await lerInteracao(p, editor, id, opc)).podeInteragir).toBe(false);
    await expect(alternarCurtida(p, editor, id, opc)).rejects.toThrow(/não recebe/);
    const rasc = await salvarPublicacao(p, editor, null, dados({ titulo: 'Outro', publicar: false }), opc);
    await expect(alternarCurtida(p, editor, rasc.id, opc)).rejects.toThrow(/não recebe/);
  });
});

describe('comentar (regras 16 e 17)', () => {
  it('grava nome, texto e data; limpa espaços; rejeita vazio e acima de 1.000', async () => {
    const { id } = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    await comentar(p, func, id, '  Entendi.  ', opc);
    const [c] = (await lerInteracao(p, func, id, opc)).comentarios;
    expect(c).toMatchObject({ texto: 'Entendi.', escondido: false });
    expect(c.nome.length).toBeGreaterThan(0);
    expect(c.criadoEm).toBeTruthy();
    await expect(comentar(p, func, id, '   ', opc)).rejects.toThrow(/Escreva/);
    await expect(comentar(p, func, id, 'a'.repeat(1001), opc)).rejects.toThrow(/1\.000 caracteres/);
    await expect(comentar(p, func, id, 'a'.repeat(1000), opc)).resolves.toBeTruthy();
  });

  it('o autor vem da sessão e a auditoria não guarda o texto', async () => {
    const { id } = await publicada(p);
    const r = await comentar(p, await como(p, FUNCIONARIO), id, 'segredo do comentário', opc);
    const reg = (await lerTabela(p, ComentariosConhecimento)).porId(r.id)!;
    expect(reg.usuario).toBe(FUNCIONARIO);
    expect(JSON.stringify(await auditoriaDe(p, r.id))).not.toContain('segredo do comentário');
  });

  it('quem está fora do público não vê nem comenta', async () => {
    const { id } = await publicada(p, { publicoTipo: 'perfil', publicoValor: 'cozinha' });
    const func = await como(p, FUNCIONARIO);
    await expect(comentar(p, func, id, 'oi', opc)).rejects.toThrow(ErroPermissao);
    await expect(lerInteracao(p, func, id, opc)).rejects.toThrow(ErroPermissao);
  });

  it('publicação arquivada mantém os comentários, mas não recebe novos', async () => {
    const { id } = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    await comentar(p, func, id, 'antes', opc);
    await darCiencia(p, func, id, opc);
    const editor = await como(p, EDITOR);
    await mudarArquivamento(p, editor, id, (await lerPublicacao(p, editor, id, opc)).versao, true, opc);
    await expect(comentar(p, func, id, 'depois', opc)).rejects.toThrow(/não recebe/);
    await expect(alternarCurtida(p, func, id, opc)).rejects.toThrow(/não recebe/);
  });
});

describe('esconder e reativar (regra 16)', () => {
  it('só quem publica esconde; some para os outros e o editor vê para reativar', async () => {
    const { id } = await publicada(p);
    const func = await como(p, FUNCIONARIO);
    const { id: cid } = await comentar(p, func, id, 'ofensivo', opc);
    const editor = await como(p, EDITOR);
    await expect(mudarVisibilidadeComentario(p, func, cid, 1, true, opc)).rejects.toThrow(ErroPermissao);
    await expect(mudarVisibilidadeComentario(p, await como(p, LEITURA), cid, 1, true, opc)).rejects.toThrow(ErroPermissao);
    await mudarVisibilidadeComentario(p, editor, cid, 1, true, opc);
    expect((await lerInteracao(p, func, id, opc)).comentarios).toHaveLength(0);
    const doEditor = (await lerInteracao(p, editor, id, opc)).comentarios;
    expect(doEditor).toHaveLength(1);
    expect(doEditor[0].escondido).toBe(true);
    const reg = (await lerTabela(p, ComentariosConhecimento)).porId(cid)!;
    expect(reg).toMatchObject({ ativo: false, escondido_por: EDITOR, escondido_em: AGORA.toISOString() });
    await mudarVisibilidadeComentario(p, editor, cid, reg.versao, false, opc);
    expect((await lerInteracao(p, func, id, opc)).comentarios).toHaveLength(1);
    expect((await lerTabela(p, ComentariosConhecimento)).porId(cid)).toMatchObject({ ativo: true, escondido_por: null });
    expect((await auditoriaDe(p, cid)).map((a) => a.acao)).toEqual(['inclusao', 'encerramento', 'alteracao']);
  });

  it('não esconde duas vezes e confere a versão lida', async () => {
    const { id } = await publicada(p);
    const { id: cid } = await comentar(p, await como(p, FUNCIONARIO), id, 'x', opc);
    const editor = await como(p, EDITOR);
    await expect(mudarVisibilidadeComentario(p, editor, cid, 9, true, opc)).rejects.toThrow();
    await mudarVisibilidadeComentario(p, editor, cid, 1, true, opc);
    await expect(mudarVisibilidadeComentario(p, editor, cid, 2, true, opc)).rejects.toThrow(/já está escondido/);
  });
});
