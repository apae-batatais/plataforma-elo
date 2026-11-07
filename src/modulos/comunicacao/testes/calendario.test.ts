/**
 * Calendário e antecedência mínima da Comunicação, com dados FICTÍCIOS:
 * quem pode, o que fica gravado, o que aparece para escolha e a auditoria sem valores.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { itemDoCalendario, itensParaPedido, listarCalendario, mudarSituacaoItemCalendario, salvarItemCalendario } from '../aplicacao/calendario';
import { lerAntecedencia, lerAntecedenciaComVersao, salvarAntecedencia } from '../aplicacao/configuracoes';
import { CalendarioComunicacao, ParametrosComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { popularComunicacaoFicticia } from '../dados/ficticios';
import { ErroComunicacao } from '../dominio/pedido';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, FUNCIONARIO, item, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
const HOJE = { agora: new Date('2026-11-06T15:00:00Z') };

beforeEach(async () => {
  p = await planilhasDeComunicacao();
});

describe('itens do calendário', () => {
  it('só Comunicação, coordenação e Diretoria cuidam do calendário', async () => {
    await expect(salvarItemCalendario(p, await como(p, FUNCIONARIO), item())).rejects.toThrow(ErroPermissao);
    const { id } = await salvarItemCalendario(p, await como(p, COMUNICACAO), item());
    expect((await lerTabela(p, CalendarioComunicacao)).porId(id)?.tema).toBe(item().tema);
    expect(await auditoriaDe(p, id)).toEqual([expect.objectContaining({ acao: 'inclusao', detalhes: expect.not.stringContaining(item().tema) })]);
  });

  it('a Diretoria e a coordenação também cuidam do calendário', async () => {
    for (const email of [COORDENACAO, 'diretoria@exemplo.local']) {
      await expect(salvarItemCalendario(p, await como(p, email), item({ tema: `Tema de ${email}` }))).resolves.toHaveProperty('id');
    }
  });

  it('recusa item inválido com a mensagem do domínio', async () => {
    const quem = await como(p, COMUNICACAO);
    await expect(salvarItemCalendario(p, quem, item({ tema: ' ' }))).rejects.toThrow('Informe o tema.');
    await expect(salvarItemCalendario(p, quem, item({ tipos: [] }))).rejects.toThrow('Escolha pelo menos um tipo de peça sugerido.');
    await expect(salvarItemCalendario(p, quem, item({ tipoData: 'periodo', inicio: '2026-12-10', fim: '2026-12-01' }))).rejects.toThrow(
      'O fim do período não pode ser antes do início.',
    );
  });

  it('data em formato errado vira mensagem clara, não erro técnico', async () => {
    const quem = await como(p, COMUNICACAO);
    for (const inicio of ['', '10/12/2026', '2026-13-40', '2026-02-30']) {
      await expect(salvarItemCalendario(p, quem, item({ inicio, fim: inicio }))).rejects.toThrow(new ErroComunicacao('Informe as datas no formato dia/mês/ano.'));
    }
  });

  it('período sem fim pede o fim; data malformada continua pedindo o formato', async () => {
    const quem = await como(p, COMUNICACAO);
    await expect(salvarItemCalendario(p, quem, item({ tipoData: 'periodo', inicio: '2026-12-01', fim: '' }))).rejects.toThrow('Informe o fim do período.');
    await expect(salvarItemCalendario(p, quem, item({ tipoData: 'periodo', inicio: '2026-12-01', fim: '01/12/2026' }))).rejects.toThrow('Informe as datas no formato dia/mês/ano.');
  });

  it('busca um item pelo código em qualquer mês, só para quem cuida do calendário', async () => {
    await popularComunicacaoFicticia(p);
    const quem = await como(p, COMUNICACAO);
    const longe = (await listarCalendario(p, quem, { inicio: '2026-08-01', fim: '2026-08-31' })).find((i) => i.tema.startsWith('Semana'))!;
    const achado = await itemDoCalendario(p, quem, longe.id);
    expect(achado?.tema).toBe(longe.tema);
    expect(achado?.pedidos).toBe(longe.pedidos);
    expect(await itemDoCalendario(p, quem, 'nao-existe')).toBeNull();
    await expect(itemDoCalendario(p, await como(p, FUNCIONARIO), longe.id)).rejects.toThrow(ErroPermissao);
  });

  it('altera um item com a versão lida e audita só as colunas', async () => {
    const quem = await como(p, COMUNICACAO);
    const { id } = await salvarItemCalendario(p, quem, item());
    await salvarItemCalendario(p, quem, { ...item({ tema: 'Outro tema' }), id, versao: 1 });
    const r = (await lerTabela(p, CalendarioComunicacao)).porId(id)!;
    expect(r.tema).toBe('Outro tema');
    expect(r.versao).toBe(2);
    const a = await auditoriaDe(p, id);
    expect(a.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(a[1].detalhes).toBe('{"colunas":["tema"]}');
    // Versão velha: conflito, nada se perde.
    await expect(salvarItemCalendario(p, quem, { ...item({ tema: 'Velho' }), id, versao: 1 })).rejects.toThrow(ErroConflito);
  });

  it('item desativado some da escolha, mas não é apagado', async () => {
    const { id } = await salvarItemCalendario(p, await como(p, COMUNICACAO), item());
    expect((await itensParaPedido(p, await como(p, FUNCIONARIO), HOJE)).map((i) => i.id)).toContain(id);
    await expect(mudarSituacaoItemCalendario(p, await como(p, FUNCIONARIO), id, 1, false)).rejects.toThrow(ErroPermissao);
    await mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), id, 1, false, HOJE);
    expect((await itensParaPedido(p, await como(p, FUNCIONARIO), HOJE)).map((i) => i.id)).not.toContain(id);
    expect((await lerTabela(p, CalendarioComunicacao)).porId(id)?.ativo).toBe(false);
    expect((await auditoriaDe(p, id)).map((x) => x.acao)).toEqual(['inclusao', 'encerramento']);
    // Repetir o mesmo estado dá uma resposta clara, não "não encontrado".
    await expect(mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), id, 2, false)).rejects.toThrow('Este item já está desativado.');
    // Reativar volta a aparecer.
    await mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), id, 2, true, HOJE);
    expect((await itensParaPedido(p, await como(p, FUNCIONARIO), HOJE)).map((i) => i.id)).toContain(id);
    await expect(mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), id, 3, true)).rejects.toThrow('Este item já está ativo.');
    await expect(mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), 'nao-existe', 1, true)).rejects.toThrow('Item do calendário não encontrado.');
  });

  it('itens já encerrados não aparecem para escolha, e os dos tipos vêm como lista', async () => {
    const quem = await como(p, COMUNICACAO);
    const passado = await salvarItemCalendario(p, quem, item({ tema: 'Já passou', inicio: '2026-10-01', fim: '2026-10-01' }));
    const futuro = await salvarItemCalendario(p, quem, item({ tipos: ['release', 'artigo'] }));
    const lista = await itensParaPedido(p, await como(p, FUNCIONARIO), HOJE);
    expect(lista.map((i) => i.id)).not.toContain(passado.id);
    expect(lista.find((i) => i.id === futuro.id)?.tipos).toEqual(['release', 'artigo']);
    await expect(itensParaPedido(p, await como(p, 'leitura@exemplo.local'), HOJE)).resolves.toBeDefined();
  });
});

describe('listar o calendário', () => {
  it('só quem cuida do calendário lista', async () => {
    await expect(listarCalendario(p, await como(p, FUNCIONARIO), { inicio: '2026-11-01', fim: '2026-11-30' })).rejects.toThrow(ErroPermissao);
  });

  it('traz os itens que tocam o período, com pedidos e publicados', async () => {
    await popularComunicacaoFicticia(p);
    const lista = await listarCalendario(p, await como(p, COMUNICACAO), { inicio: '2026-11-01', fim: '2026-11-30' });
    expect(lista.map((i) => i.tema).sort()).toEqual(['Campanha de arrecadação de fim de ano', 'Festa da Família', 'Mês da Consciência Negra']);
    const campanha = lista.find((i) => i.tema.startsWith('Campanha'))!;
    expect(campanha.pedidos).toBeGreaterThan(0);
    const dia = await listarCalendario(p, await como(p, COMUNICACAO), { inicio: '2026-12-03', fim: '2026-12-03' });
    const internacional = dia.find((i) => i.tema.startsWith('Dia Internacional'))!;
    // Dia Internacional: 1 entrevista realizada e 1 artigo agendado, na demonstração.
    expect(internacional.pedidos).toBe(2);
    expect(internacional.publicados).toBe(1);
    expect((await lerTabela(p, PedidosComunicacao)).ativos().length).toBe(8);
  });

  it('inclui os desativados, marcados, para poder reativar', async () => {
    const quem = await como(p, COMUNICACAO);
    const { id } = await salvarItemCalendario(p, quem, item());
    await mudarSituacaoItemCalendario(p, quem, id, 1, false);
    const lista = await listarCalendario(p, quem, { inicio: '2026-12-01', fim: '2026-12-31' });
    expect(lista.find((i) => i.id === id)?.ativo).toBe(false);
  });
});

describe('antecedência mínima', () => {
  it('antecedência mínima: só a coordenação, de 0 a 30', async () => {
    expect(await lerAntecedencia(p)).toBe(5);
    await expect(salvarAntecedencia(p, await como(p, COMUNICACAO), 3)).rejects.toThrow(ErroPermissao);
    await expect(salvarAntecedencia(p, await como(p, COORDENACAO), 31)).rejects.toThrow('A antecedência mínima vai de 0 a 30 dias úteis.');
    await expect(salvarAntecedencia(p, await como(p, COORDENACAO), -1)).rejects.toThrow('A antecedência mínima vai de 0 a 30 dias úteis.');
    await expect(salvarAntecedencia(p, await como(p, COORDENACAO), 2.5)).rejects.toThrow('A antecedência mínima vai de 0 a 30 dias úteis.');
    await expect(salvarAntecedencia(p, await como(p, COORDENACAO), Number.NaN)).rejects.toThrow('A antecedência mínima vai de 0 a 30 dias úteis.');
    await salvarAntecedencia(p, await como(p, COORDENACAO), 3);
    expect(await lerAntecedencia(p)).toBe(3);
  });

  it('com a linha já salva, exige a versão vista e recusa gravação em cima de outra', async () => {
    const quem = await como(p, COORDENACAO);
    await salvarAntecedencia(p, quem, 3);
    const vista = await lerAntecedenciaComVersao(p);
    expect(vista).toEqual({ dias: 3, versao: 1 });
    await expect(salvarAntecedencia(p, quem, 4)).rejects.toThrow(ErroComunicacao);
    await salvarAntecedencia(p, quem, 4, { versao: vista.versao });
    // Outra pessoa salvou antes: quem ainda tem a versão velha leva conflito e nada é perdido.
    await expect(salvarAntecedencia(p, quem, 9, { versao: vista.versao })).rejects.toThrow(ErroConflito);
    await expect(salvarAntecedencia(p, quem, 4, { versao: vista.versao })).rejects.toThrow(ErroConflito);
    expect(await lerAntecedencia(p)).toBe(4);
  });

  it('valor gravado fora de 0 a 30 é ignorado e vale o padrão', async () => {
    const { inserir } = await import('@/nucleo/armazenamento/tabela');
    await inserir(p, ParametrosComunicacao, { chave: 'antecedencia_minima', valor: 99 }, { email: 'x@exemplo.local', agora: () => new Date() });
    expect(await lerAntecedencia(p)).toBe(5);
  });

  it('guarda uma linha só, aceita 0 e audita só a coluna', async () => {
    const quem = await como(p, COORDENACAO);
    await salvarAntecedencia(p, quem, 3);
    await salvarAntecedencia(p, quem, 0, { versao: 1 });
    const linhas = (await lerTabela(p, ParametrosComunicacao)).ativos().filter((x) => x.chave === 'antecedencia_minima');
    expect(linhas).toHaveLength(1);
    expect(await lerAntecedencia(p)).toBe(0);
    const a = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'ParametrosComunicacao');
    expect(a.map((x) => x.acao)).toEqual(['inclusao', 'alteracao']);
    expect(a.every((x) => x.detalhes === '{"colunas":["valor"]}')).toBe(true);
  });

  it('a Diretoria também define a antecedência', async () => {
    await salvarAntecedencia(p, await como(p, 'diretoria@exemplo.local'), 7);
    expect(await lerAntecedencia(p)).toBe(7);
  });
});
