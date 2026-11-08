/**
 * Fotos e documentos do pedido (ADR-014), com arquivos FICTÍCIOS em memória:
 * tipos e tamanhos, limite de 5, confirmação de imagem, ajuste, revisão, leitura e auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArquivosMemoria, type ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { abrirAnexoComunicacao, iniciarEnvioAnexoComunicacao, lerAnexoComunicacao, TRECHO_MAXIMO } from '../aplicacao/anexos';
import { detalharPedido, editarNaRevisao, enviarPedido, reenviarPedido, revisarPedido, type DadosPedido } from '../aplicacao/pedidos';
import { AnexosComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { conferirArquivo, conferirQuantidade, LIMITES_ANEXOS, limparNomeArquivo, nomeDaFotoReduzida, tipoDoArquivo, type TipoAnexo } from '../dominio/anexos';
import { ErroComunicacao } from '../dominio/pedido';
import { COMUNICACAO, como, FUNCIONARIO, OUTRO_FUNCIONARIO, planilhasDeComunicacao } from './apoio';

const SEXTA = { agora: new Date('2026-11-06T15:00:00Z') };
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let p: Planilhas;
let arq: ArquivosMemoria;

beforeEach(async () => {
  p = await planilhasDeComunicacao();
  arq = new ArquivosMemoria();
});

/** Sobe um arquivo fictício pelo mesmo caminho do navegador e devolve a ligação ao pedido. */
async function subir(tipo: TipoAnexo = 'foto', mime = tipo === 'foto' ? 'image/jpeg' : 'application/pdf', bytes = 100, nome?: string) {
  const { url } = await iniciarEnvioAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, { tipo, mime, tamanho: bytes, origem: 'http://localhost' });
  const guardado = arq.receber(url.replace('/envio/', ''), new Uint8Array(bytes).fill(7));
  return { arquivoId: guardado.id, tipo, ...(nome === undefined ? {} : { nome }) };
}

function pedido(x: Partial<DadosPedido> = {}): DadosPedido & { nomeSolicitante: string } {
  return {
    area: 'educacao',
    calendarioId: null,
    tipoPeca: 'post_instagram',
    titulo: 'Convite para a festa',
    descricao: 'Texto fictício do pedido.',
    dataDesejada: '2026-11-25',
    linkVideo: null,
    imagemConfirmada: false,
    anexos: [],
    nomeSolicitante: 'Pessoa fictícia',
    ...x,
  };
}
const envia = async (x: Partial<DadosPedido> = {}, email = FUNCIONARIO) => enviarPedido(p, await como(p, email), pedido(x), { ...SEXTA, arquivos: arq });
const historicoDe = async (id: string) => (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id);
const linhas = async (id: string) => (await lerTabela(p, AnexosComunicacao)).todos().filter((a) => a.pedido_id === id);
const pedidoDe = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;

/** Pedido devolvido (para ajustar), com os anexos dados. */
async function devolvido(anexos: DadosPedido['anexos'] = [], extra: Partial<DadosPedido> = {}) {
  const r = await envia({ anexos, imagemConfirmada: true, ...extra });
  const com = await como(p, COMUNICACAO);
  await revisarPedido(p, com, r.id, (await pedidoDe(r.id)).versao, 'iniciar_revisao', null, SEXTA);
  await revisarPedido(p, com, r.id, (await pedidoDe(r.id)).versao, 'devolver', 'Ajuste o texto.', SEXTA);
  return r;
}

describe('regras do arquivo', () => {
  it('reconhece foto e documento pelo tipo', () => {
    expect(tipoDoArquivo('image/jpeg')).toBe('foto');
    expect(tipoDoArquivo('image/png')).toBe('foto');
    expect(tipoDoArquivo('image/webp; charset=x')).toBe('foto');
    expect(tipoDoArquivo('application/pdf')).toBe('documento');
    expect(tipoDoArquivo(DOCX)).toBe('documento');
    expect(tipoDoArquivo('video/mp4')).toBeNull();
    expect(tipoDoArquivo('image/gif')).toBeNull();
    expect(tipoDoArquivo('application/msword')).toBeNull();
  });

  it('recusa tipo errado, vazio e acima do limite, cada um com a sua mensagem', () => {
    expect(conferirArquivo({ tipo: 'foto', mime: 'image/jpeg', tamanho: 1000 })).toEqual([]);
    expect(conferirArquivo({ tipo: 'documento', mime: DOCX, tamanho: LIMITES_ANEXOS.documentoBytes })).toEqual([]);
    expect(conferirArquivo({ tipo: 'foto', mime: 'image/gif', tamanho: 1000 })).toEqual(['Envie a foto em JPG, PNG ou WebP.']);
    expect(conferirArquivo({ tipo: 'foto', mime: 'application/pdf', tamanho: 1000 })).toEqual(['Envie a foto em JPG, PNG ou WebP.']);
    expect(conferirArquivo({ tipo: 'documento', mime: 'video/mp4', tamanho: 1000 })).toEqual(['Envie o documento em PDF ou DOCX.']);
    expect(conferirArquivo({ tipo: 'documento', mime: 'image/jpeg', tamanho: 1000 })).toEqual(['Envie o documento em PDF ou DOCX.']);
    expect(conferirArquivo({ tipo: 'foto', mime: 'image/jpeg', tamanho: 0 })).toEqual(['O arquivo está vazio.']);
    expect(conferirArquivo({ tipo: 'foto', mime: 'image/jpeg', tamanho: LIMITES_ANEXOS.fotoBytes + 1 })).toEqual(['A foto passa de 1,4 MB.']);
    expect(conferirArquivo({ tipo: 'documento', mime: 'application/pdf', tamanho: LIMITES_ANEXOS.documentoBytes + 1 })).toEqual([
      'O documento tem 10 MB; o limite é 10 MB.',
    ]);
  });

  it('aceita até 5 arquivos', () => {
    expect(conferirQuantidade(new Array(5).fill({}))).toEqual([]);
    expect(conferirQuantidade(new Array(6).fill({}))).toEqual(['Cada pedido aceita até 5 arquivos.']);
  });
});

describe('nome original do arquivo', () => {
  it('limpa o nome: caminho, controle, espaços, 120 caracteres com a extensão, vazio usa o gerado', () => {
    const g = 'comunicacao-gerado.pdf';
    expect(limparNomeArquivo('C:\\fotos\\a.pdf', g)).toBe('a.pdf');
    expect(limparNomeArquivo('/home/x/../Cartaz  da   festa.docx', g)).toBe('Cartaz da festa.docx');
    expect(limparNomeArquivo('  a\u0000b\tc.pdf ', g)).toBe('a b c.pdf');
    const longo = limparNomeArquivo(`${'a'.repeat(200)}.pdf`, g);
    expect(longo).toHaveLength(120);
    expect(longo.endsWith('.pdf')).toBe(true);
    expect(limparNomeArquivo('', g)).toBe(g);
    expect(limparNomeArquivo('   ', g)).toBe(g);
    expect(limparNomeArquivo('C:\\fotos\\', g)).toBe(g);
    expect(limparNomeArquivo('..', g)).toBe(g);
    expect(limparNomeArquivo(undefined, g)).toBe(g);
  });

  it('foto reduzida para JPG mantém o nome-base com a extensão real', () => {
    expect(nomeDaFotoReduzida('festa.png')).toBe('festa.jpg');
    expect(nomeDaFotoReduzida('IMG 01.final.HEIC')).toBe('IMG 01.final.jpg');
    expect(nomeDaFotoReduzida('semextensao')).toBe('semextensao.jpg');
    expect(nomeDaFotoReduzida('')).toBe('foto.jpg');
  });

  it('guarda o nome original, devolve no detalhe só a quem vê o pedido e não o põe na auditoria', async () => {
    const r = await envia({
      anexos: [await subir('documento', 'application/pdf', 100, 'Cartaz da Maria Souza.pdf'), await subir('documento', DOCX, 100, '')],
    });
    const l = await linhas(r.id);
    expect(l.map((a) => a.nome).sort()).toEqual([expect.stringMatching(/^comunicacao-.*\.docx$/), 'Cartaz da Maria Souza.pdf'].sort());
    const d = await detalharPedido(p, await como(p, COMUNICACAO), r.id);
    expect(d.anexos.map((a) => a.nome)).toContain('Cartaz da Maria Souza.pdf');
    await expect(detalharPedido(p, await como(p, OUTRO_FUNCIONARIO), r.id)).rejects.toThrow(ErroPermissao);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(JSON.stringify(aud)).not.toContain('Maria');
    expect(JSON.stringify(aud)).not.toContain('Cartaz');
    expect(JSON.stringify(await historicoDe(r.id))).not.toContain('Maria');
  });

  it('no Drive o arquivo fica com o nome gerado, sem o original', async () => {
    const a = await subir('documento', 'application/pdf', 100, 'Maria Souza.pdf');
    expect((await arq.conferir(a.arquivoId))!.nome).toMatch(/^comunicacao-\d{4}-\d{2}-\d{2}-documento-.*\.pdf$/);
  });

  it('nome comprido é cortado em 120 ao guardar', async () => {
    const r = await envia({ anexos: [await subir('documento', 'application/pdf', 100, `${'b'.repeat(200)}.pdf`)] });
    const [a] = await linhas(r.id);
    expect(a.nome).toHaveLength(120);
    expect(a.nome.endsWith('.pdf')).toBe(true);
  });
});

describe('abrir o envio', () => {
  it('só abre para arquivo aceito e com a pasta de anexos ativa', async () => {
    const f = await como(p, FUNCIONARIO);
    const base = { tipo: 'foto' as const, mime: 'image/png', tamanho: 500, origem: 'http://localhost' };
    await expect(iniciarEnvioAnexoComunicacao(p, f, arq, base)).resolves.toHaveProperty('url');
    await expect(iniciarEnvioAnexoComunicacao(p, f, arq, { ...base, mime: 'image/gif' })).rejects.toThrow('Envie a foto em JPG, PNG ou WebP.');
    await expect(iniciarEnvioAnexoComunicacao(p, f, arq, { ...base, tipo: 'documento', mime: 'video/mp4' })).rejects.toThrow(ErroComunicacao);
    await expect(iniciarEnvioAnexoComunicacao(p, f, null, base)).rejects.toThrow('ainda não estão ativos');
  });
});

describe('enviar com anexos', () => {
  it('liga os arquivos ao pedido e registra a auditoria só com colunas', async () => {
    const r = await envia({ anexos: [await subir('documento'), await subir('documento', DOCX)] });
    const l = await linhas(r.id);
    expect(l).toHaveLength(2);
    expect(l.map((a) => a.mime).sort()).toEqual(['application/pdf', DOCX]);
    expect(l.every((a) => a.ativo && a.tipo === 'documento' && a.nome && !a.nome.includes('@'))).toBe(true);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'AnexosComunicacao');
    expect(aud).toHaveLength(1);
    expect(aud[0].acao).toBe('inclusao');
    expect(JSON.stringify(aud[0])).not.toContain(l[0].arquivo_id);
  });

  it('mostra os anexos no detalhe sem o código do arquivo', async () => {
    const r = await envia({ anexos: [await subir('documento')] });
    const d = await detalharPedido(p, await como(p, FUNCIONARIO), r.id);
    expect(d.anexos).toHaveLength(1);
    expect(d.anexos[0].arquivo_id).toBe('');
  });

  it('recusa mais de 5 arquivos e não grava o pedido', async () => {
    const seis = [];
    for (let i = 0; i < 6; i++) seis.push(await subir('documento'));
    await expect(envia({ anexos: seis })).rejects.toThrow('Cada pedido aceita até 5 arquivos.');
    expect((await lerTabela(p, PedidosComunicacao)).todos()).toHaveLength(0);
    const cinco = seis.slice(0, 5);
    await expect(envia({ anexos: cinco })).resolves.toBeTruthy();
  });

  it('recusa arquivo que não existe na pasta de anexos', async () => {
    await expect(envia({ anexos: [{ arquivoId: 'nao-existe', tipo: 'documento' }] })).rejects.toThrow('não chegou à pasta de anexos');
    expect((await lerTabela(p, PedidosComunicacao)).todos()).toHaveLength(0);
  });

  it('recusa quando o tipo informado não combina com o arquivo guardado', async () => {
    const a = await subir('documento');
    await expect(envia({ anexos: [{ ...a, tipo: 'foto' }], imagemConfirmada: true })).rejects.toThrow('Envie a foto em JPG, PNG ou WebP.');
  });

  it('recusa o mesmo arquivo repetido e o arquivo de outro pedido', async () => {
    const a = await subir('documento');
    await expect(envia({ anexos: [a, a] })).rejects.toThrow('repetido');
    await envia({ anexos: [a] });
    await expect(envia({ anexos: [a] })).rejects.toThrow('já pertence a outro pedido');
  });

  it('sem arquivos ativos na instituição, recusa o pedido com anexo', async () => {
    const a = await subir('documento');
    await expect(enviarPedido(p, await como(p, FUNCIONARIO), pedido({ anexos: [a] }), SEXTA)).rejects.toThrow('ainda não estão ativos');
  });

  it('foto exige a confirmação de uso de imagem; documento não', async () => {
    const foto = await subir('foto');
    await expect(envia({ anexos: [foto], imagemConfirmada: false })).rejects.toThrow('Confirme que as pessoas que aparecem têm autorização de uso de imagem.');
    expect((await lerTabela(p, PedidosComunicacao)).todos()).toHaveLength(0);
    await expect(envia({ anexos: [await subir('documento')], imagemConfirmada: false })).resolves.toBeTruthy();
    const r = await envia({ anexos: [foto], imagemConfirmada: true });
    expect(await pedidoDe(r.id)).toMatchObject({ imagem_confirmada_por: FUNCIONARIO, imagem_confirmada_em: SEXTA.agora.toISOString() });
  });
});

describe('ajustar (reenviar)', () => {
  it('anexos tirados ficam com ativo = FALSE e os novos entram', async () => {
    const a = await subir('documento');
    const b = await subir('documento');
    const r = await devolvido([a, b]);
    const c = await subir('documento', DOCX);
    await reenviarPedido(p, await como(p, FUNCIONARIO), r.id, (await pedidoDe(r.id)).versao, pedido({ anexos: [b, c], imagemConfirmada: true }), { ...SEXTA, arquivos: arq });
    const l = await linhas(r.id);
    expect(l).toHaveLength(3);
    expect(l.find((x) => x.arquivo_id === a.arquivoId)!.ativo).toBe(false);
    expect(l.find((x) => x.arquivo_id === b.arquivoId)!.ativo).toBe(true);
    expect(l.find((x) => x.arquivo_id === c.arquivoId)!.ativo).toBe(true);
    const d = await detalharPedido(p, await como(p, FUNCIONARIO), r.id);
    expect(d.anexos).toHaveLength(2);
  });

  it('um sexto arquivo é recusado depois de um ajuste', async () => {
    const cinco = [];
    for (let i = 0; i < 5; i++) cinco.push(await subir('documento'));
    const r = await devolvido(cinco);
    const sexto = await subir('documento');
    await expect(
      reenviarPedido(p, await como(p, FUNCIONARIO), r.id, (await pedidoDe(r.id)).versao, pedido({ anexos: [...cinco, sexto], imagemConfirmada: true }), { ...SEXTA, arquivos: arq }),
    ).rejects.toThrow('Cada pedido aceita até 5 arquivos.');
    expect((await linhas(r.id)).filter((x) => x.ativo)).toHaveLength(5);
  });

  it('foto nova no ajuste exige a confirmação de novo', async () => {
    const r = await devolvido([]);
    const foto = await subir('foto');
    await expect(
      reenviarPedido(p, await como(p, FUNCIONARIO), r.id, (await pedidoDe(r.id)).versao, pedido({ anexos: [foto], imagemConfirmada: false }), { ...SEXTA, arquivos: arq }),
    ).rejects.toThrow('autorização de uso de imagem');
  });

  it('mantém um anexo pelo id do anexo, sem o código do arquivo (que não sai do servidor)', async () => {
    const a = await subir('documento');
    const b = await subir('documento');
    const r = await devolvido([a, b]);
    const [la, lb] = await linhas(r.id);
    await reenviarPedido(
      p,
      await como(p, FUNCIONARIO),
      r.id,
      (await pedidoDe(r.id)).versao,
      pedido({ anexos: [{ arquivoId: lb.id, tipo: 'documento' }], imagemConfirmada: true }),
      { ...SEXTA, arquivos: arq },
    );
    const l = await linhas(r.id);
    expect(l).toHaveLength(2);
    expect(l.find((x) => x.id === la.id)!.ativo).toBe(false);
    expect(l.find((x) => x.id === lb.id)!.ativo).toBe(true);
  });

  it('sem informar anexos, os que já existem ficam como estão', async () => {
    const a = await subir('documento');
    const r = await devolvido([a]);
    const { anexos: _, ...semAnexos } = pedido({ imagemConfirmada: true });
    void _;
    await reenviarPedido(p, await como(p, FUNCIONARIO), r.id, (await pedidoDe(r.id)).versao, semAnexos, { ...SEXTA, arquivos: arq });
    expect((await linhas(r.id)).filter((x) => x.ativo)).toHaveLength(1);
  });
});

describe('editar na revisão', () => {
  async function aRevisar(anexos: DadosPedido['anexos'] = [], extra: Partial<DadosPedido> = {}) {
    const r = await envia({ anexos, ...extra });
    const com = await como(p, COMUNICACAO);
    await revisarPedido(p, com, r.id, (await pedidoDe(r.id)).versao, 'iniciar_revisao', null, SEXTA);
    return { id: r.id, com };
  }

  it('inclui e tira anexos, com "anexos" entre as colunas do histórico', async () => {
    const a = await subir('documento');
    const { id, com } = await aRevisar([a]);
    const b = await subir('documento', DOCX);
    await editarNaRevisao(p, com, id, (await pedidoDe(id)).versao, { anexos: [b] }, { ...SEXTA, arquivos: arq });
    const l = await linhas(id);
    expect(l.find((x) => x.arquivo_id === a.arquivoId)!.ativo).toBe(false);
    expect(l.find((x) => x.arquivo_id === b.arquivoId)!.ativo).toBe(true);
    const h = (await lerTabela(p, HistoricoComunicacao)).todos().filter((x) => x.pedido_id === id && x.acao === 'editar');
    expect(h).toHaveLength(1);
    expect(h[0].comentario).toContain('anexos');
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.registro_id === id && x.acao === 'alteracao');
    expect(JSON.stringify(aud)).toContain('anexos');
  });

  it('manter a mesma lista não é alteração', async () => {
    const a = await subir('documento');
    const { id, com } = await aRevisar([a]);
    await expect(editarNaRevisao(p, com, id, (await pedidoDe(id)).versao, { anexos: [a] }, { ...SEXTA, arquivos: arq })).rejects.toThrow('Nenhuma alteração para salvar.');
  });

  it('respeita o limite de 5 e o arquivo inexistente', async () => {
    const cinco = [];
    for (let i = 0; i < 5; i++) cinco.push(await subir('documento'));
    const { id, com } = await aRevisar(cinco);
    const v = (await pedidoDe(id)).versao;
    await expect(editarNaRevisao(p, com, id, v, { anexos: [...cinco, await subir('documento')] }, { ...SEXTA, arquivos: arq })).rejects.toThrow('até 5 arquivos');
    await expect(editarNaRevisao(p, com, id, v, { anexos: [{ arquivoId: 'nao-existe', tipo: 'documento' }] }, { ...SEXTA, arquivos: arq })).rejects.toThrow('não chegou');
  });

  it('foto nova só entra se quem pediu já confirmou o uso de imagem', async () => {
    const { id, com } = await aRevisar([]);
    const foto = await subir('foto');
    await expect(editarNaRevisao(p, com, id, (await pedidoDe(id)).versao, { anexos: [foto] }, { ...SEXTA, arquivos: arq })).rejects.toThrow('devolva');
    const conf = await aRevisar([], { imagemConfirmada: true, linkVideo: 'https://drive.exemplo.local/pasta' });
    await expect(editarNaRevisao(p, conf.com, conf.id, (await pedidoDe(conf.id)).versao, { anexos: [await subir('foto')] }, { ...SEXTA, arquivos: arq })).resolves.toBeUndefined();
  });

  it('quem só pede não edita anexos na revisão', async () => {
    const { id } = await aRevisar([]);
    await expect(
      editarNaRevisao(p, await como(p, FUNCIONARIO), id, (await pedidoDe(id)).versao, { anexos: [await subir('documento')] }, { ...SEXTA, arquivos: arq }),
    ).rejects.toThrow(ErroPermissao);
  });
});

describe('abrir o anexo (leitura)', () => {
  async function comAnexo() {
    const r = await envia({ anexos: [await subir('documento', 'application/pdf', 300)] });
    return { pedidoId: r.id, anexoId: (await linhas(r.id))[0].id };
  }
  const leituras = async (anexoId: string) =>
    (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.acao === 'leitura' && a.registro_id === anexoId);

  it('quem pediu e a Comunicação abrem; cada abertura vai para a auditoria', async () => {
    const { anexoId } = await comAnexo();
    const t = await lerAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, anexoId, { inicio: 0, fim: null });
    expect(t).toMatchObject({ total: 300, inicio: 0, fim: 299, tipo: 'application/pdf' });
    expect(t.dados).toHaveLength(300);
    expect(await leituras(anexoId)).toHaveLength(1);
    await lerAnexoComunicacao(p, await como(p, COMUNICACAO), arq, anexoId, { inicio: 0, fim: null });
    await lerAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, anexoId, { inicio: 0, fim: null });
    const l = await leituras(anexoId);
    expect(l).toHaveLength(3);
    expect(l.map((x) => x.usuario)).toEqual([FUNCIONARIO, COMUNICACAO, FUNCIONARIO]);
    expect(l.every((x) => x.entidade === 'AnexosComunicacao')).toBe(true);
  });

  it('um trecho do meio não repete a auditoria da abertura', async () => {
    const { anexoId } = await comAnexo();
    const t = await lerAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, anexoId, { inicio: 100, fim: 199 });
    expect(t.dados).toHaveLength(100);
    expect(await leituras(anexoId)).toHaveLength(0);
  });

  it('quem não vê o pedido recebe ErroPermissao, sem auditoria de leitura', async () => {
    const { anexoId } = await comAnexo();
    await expect(lerAnexoComunicacao(p, await como(p, OUTRO_FUNCIONARIO), arq, anexoId, { inicio: 0, fim: null })).rejects.toThrow(ErroPermissao);
    expect(await leituras(anexoId)).toHaveLength(0);
  });

  it('anexo tirado num ajuste não abre mais', async () => {
    const r = await devolvido([await subir('documento', 'application/pdf', 300)]);
    const [linha] = await linhas(r.id);
    const f = await como(p, FUNCIONARIO);
    await expect(lerAnexoComunicacao(p, f, arq, linha.id, { inicio: 0, fim: null })).resolves.toBeTruthy();
    await reenviarPedido(p, f, r.id, (await pedidoDe(r.id)).versao, pedido({ anexos: [], imagemConfirmada: true }), { ...SEXTA, arquivos: arq });
    expect((await linhas(r.id))[0].ativo).toBe(false);
    await expect(lerAnexoComunicacao(p, f, arq, linha.id, { inicio: 0, fim: null })).rejects.toThrow('Anexo não encontrado.');
    await expect(abrirAnexoComunicacao(p, f, arq, linha.id)).rejects.toThrow('Anexo não encontrado.');
  });

  it('anexo inexistente ou sem pasta de anexos não abre', async () => {
    const { anexoId } = await comAnexo();
    const f = await como(p, FUNCIONARIO);
    await expect(lerAnexoComunicacao(p, f, arq, 'nao-existe', { inicio: 0, fim: null })).rejects.toThrow('Anexo não encontrado.');
    await expect(lerAnexoComunicacao(p, f, null, anexoId, { inicio: 0, fim: null })).rejects.toThrow('não estão ativos');
    await expect(abrirAnexoComunicacao(p, f, null, anexoId)).rejects.toThrow('não estão ativos');
  });

  it('documento maior que um trecho: sem faixa, todos os bytes chegam inteiros e a auditoria é uma só', async () => {
    // A demonstração só aceita 4 MB por arquivo; a pasta de anexos de mentira entrega 9 MB, trecho a trecho.
    const total = 9 * 1024 * 1024;
    const byte = (i: number) => (i * 31 + 7) % 251;
    let leiturasDaPasta = 0;
    const pasta: ArmazenamentoArquivos = {
      iniciarEnvio: async () => ({ url: '/x' }),
      conferir: async (id) => ({ id, nome: 'grande.pdf', tipo: 'application/pdf', tamanho: total }),
      ler: async (_id, t) => {
        leiturasDaPasta++;
        const fim = Math.min(t.fim, total - 1);
        return { dados: Uint8Array.from({ length: fim - t.inicio + 1 }, (_, k) => byte(t.inicio + k)), total, inicio: t.inicio, fim, tipo: 'application/pdf' };
      },
      conferirPasta: async () => ({ ok: true as const, nome: 'x' }),
    };
    const r = await enviarPedido(p, await como(p, FUNCIONARIO), pedido({ anexos: [{ arquivoId: 'arquivo-grande-0001', tipo: 'documento' }] }), { ...SEXTA, arquivos: pasta });
    const anexoId = (await linhas(r.id))[0].id;
    const a = await abrirAnexoComunicacao(p, await como(p, FUNCIONARIO), pasta, anexoId);
    expect(a).toMatchObject({ tipo: 'application/pdf', total });
    expect(await leituras(anexoId)).toHaveLength(1);
    const lidos: Uint8Array[] = [];
    let pos = 0;
    while (pos < a.total) {
      const t = await a.lerTrecho(pos);
      expect(t.dados.length).toBeLessThanOrEqual(TRECHO_MAXIMO);
      lidos.push(t.dados);
      pos += t.dados.length;
    }
    expect(lidos.length).toBe(3);
    expect(pos).toBe(total);
    const tudo = new Uint8Array(total);
    let o = 0;
    for (const d of lidos) {
      tudo.set(d, o);
      o += d.length;
    }
    expect(tudo.every((v, i) => v === byte(i))).toBe(true);
    expect(leiturasDaPasta).toBe(3);
    expect(await leituras(anexoId)).toHaveLength(1);
  });
});
