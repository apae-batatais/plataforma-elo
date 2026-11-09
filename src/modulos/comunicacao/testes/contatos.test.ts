/** Contatos e grupos da imprensa, com dados FICTÍCIOS: validação, grupos, destinatários e permissões. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import {
  destinatariosDe,
  listarContatos,
  mudarSituacaoContato,
  mudarSituacaoGrupo,
  salvarContato,
  salvarGrupo,
} from '../aplicacao/contatos';
import { ContatoGruposComunicacao, ContatosComunicacao } from '../dados/tabelas';
import { conferirContato } from '../dominio/contatos';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, DIRETORIA, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
beforeEach(async () => {
  p = await planilhasDeComunicacao();
});

const contato = (x: Partial<Parameters<typeof salvarContato>[2]> = {}) => ({
  nome: 'Redação fictícia',
  veiculo: 'Jornal Fictício',
  email: 'redacao@jornal.exemplo.local',
  grupos: [] as string[],
  ...x,
});

describe('regras do contato', () => {
  it('e-mail válido e sem repetir entre ativos, sem diferença de maiúsculas', () => {
    expect(conferirContato({ nome: 'A', email: 'sem-arroba' }, [])).toEqual(['Informe um e-mail válido.']);
    expect(conferirContato({ nome: 'A', email: 'a@b.com' }, [{ id: 'x', email: 'A@B.com' }])).toEqual(['Este e-mail já está cadastrado.']);
    expect(conferirContato({ nome: 'A', email: 'a@b.com' }, [{ id: 'x', email: 'A@B.com' }], 'x')).toEqual([]);
    expect(conferirContato({ nome: ' ', email: 'a@b.com' }, [])).toEqual(['Informe o nome do contato.']);
  });
});

describe('contatos e grupos', () => {
  it('Comunicação, coordenação e Diretoria gerenciam; funcionário não', async () => {
    await expect(salvarContato(p, await como(p, FUNCIONARIO), contato())).rejects.toThrow(ErroPermissao);
    await expect(listarContatos(p, await como(p, FUNCIONARIO))).rejects.toThrow(ErroPermissao);
    await expect(salvarGrupo(p, await como(p, FUNCIONARIO), { nome: 'X' })).rejects.toThrow(ErroPermissao);
    for (const [i, email] of [COMUNICACAO, COORDENACAO, DIRETORIA].entries())
      await expect(salvarContato(p, await como(p, email), contato({ email: `c${i}@exemplo.local` }))).resolves.toHaveProperty('id');
  });

  it('recusa e-mail repetido e inválido; guarda em minúsculas e audita só as colunas', async () => {
    const quem = await como(p, COMUNICACAO);
    const { id } = await salvarContato(p, quem, contato({ email: ' Redacao@Jornal.Exemplo.Local ' }));
    expect((await lerTabela(p, ContatosComunicacao)).porId(id)?.email).toBe('redacao@jornal.exemplo.local');
    await expect(salvarContato(p, quem, contato({ nome: 'Outro', email: 'REDACAO@jornal.exemplo.local' }))).rejects.toThrow('Este e-mail já está cadastrado.');
    await expect(salvarContato(p, quem, contato({ email: 'xx' }))).rejects.toThrow('Informe um e-mail válido.');
    const [a] = await auditoriaDe(p, id);
    expect(a).toMatchObject({ acao: 'inclusao' });
    expect(a.detalhes).not.toContain('redacao@');
  });

  it('trocar os grupos encerra as ligações antigas (nada é apagado)', async () => {
    const quem = await como(p, COMUNICACAO);
    const g1 = (await salvarGrupo(p, quem, { nome: 'Jornais' })).id;
    const g2 = (await salvarGrupo(p, quem, { nome: 'Rádios' })).id;
    const { id } = await salvarContato(p, quem, contato({ grupos: [g1] }));
    let c = (await listarContatos(p, quem)).contatos.find((x) => x.id === id)!;
    expect(c.grupos).toEqual([g1]);
    await salvarContato(p, quem, contato({ id, versao: c.versao, grupos: [g2] }));
    c = (await listarContatos(p, quem)).contatos.find((x) => x.id === id)!;
    expect(c.grupos).toEqual([g2]);
    const todas = (await lerTabela(p, ContatoGruposComunicacao)).todos().filter((l) => l.contato_id === id);
    expect(todas).toHaveLength(2);
    expect(todas.find((l) => l.grupo_id === g1)?.ativo).toBe(false);
    const { grupos } = await listarContatos(p, quem);
    expect(grupos.find((g) => g.id === g1)?.contatos).toBe(0);
    expect(grupos.find((g) => g.id === g2)?.contatos).toBe(1);
  });

  it('recusa grupo desativado e nome de grupo repetido', async () => {
    const quem = await como(p, COMUNICACAO);
    const g = await salvarGrupo(p, quem, { nome: 'Jornais' });
    await expect(salvarGrupo(p, quem, { nome: ' jornais ' })).rejects.toThrow('Já existe um grupo com este nome.');
    const v = (await listarContatos(p, quem)).grupos.find((x) => x.id === g.id)!.versao;
    await mudarSituacaoGrupo(p, quem, g.id, v, false);
    await expect(salvarContato(p, quem, contato({ grupos: [g.id] }))).rejects.toThrow('Escolha só grupos ativos.');
  });

  it('reativar um contato não pode repetir o e-mail de outro ativo', async () => {
    const quem = await como(p, COMUNICACAO);
    const a = await salvarContato(p, quem, contato());
    let ca = (await listarContatos(p, quem)).contatos.find((x) => x.id === a.id)!;
    await mudarSituacaoContato(p, quem, a.id, ca.versao, false);
    await salvarContato(p, quem, contato({ nome: 'Substituto' }));
    ca = (await listarContatos(p, quem)).contatos.find((x) => x.id === a.id)!;
    await expect(mudarSituacaoContato(p, quem, a.id, ca.versao, true)).rejects.toThrow('Este e-mail já está cadastrado.');
  });
});

describe('destinatariosDe', () => {
  it('contato em dois grupos aparece uma vez; inativos ficam de fora; em minúsculas e em ordem', async () => {
    const quem = await como(p, COMUNICACAO);
    const g1 = (await salvarGrupo(p, quem, { nome: 'Jornais' })).id;
    const g2 = (await salvarGrupo(p, quem, { nome: 'Rádios' })).id;
    const b = await salvarContato(p, quem, contato({ nome: 'B', email: 'b@x.local', grupos: [g1, g2] }));
    await salvarContato(p, quem, contato({ nome: 'A', email: 'a@x.local', grupos: [g2] }));
    const c = await salvarContato(p, quem, contato({ nome: 'C', email: 'c@x.local', grupos: [g1] }));
    expect(await destinatariosDe(p, { grupos: [g1, g2], contatos: [b.id] })).toEqual(['a@x.local', 'b@x.local', 'c@x.local']);
    const vc = (await listarContatos(p, quem)).contatos.find((x) => x.id === c.id)!.versao;
    await mudarSituacaoContato(p, quem, c.id, vc, false);
    expect(await destinatariosDe(p, { grupos: [g1], contatos: [c.id] })).toEqual(['b@x.local']);
    expect(await destinatariosDe(p, { grupos: [], contatos: [] })).toEqual([]);
  });

  it('grupo desativado não envia para ninguém', async () => {
    const quem = await como(p, COMUNICACAO);
    const g = (await salvarGrupo(p, quem, { nome: 'Jornais' })).id;
    await salvarContato(p, quem, contato({ grupos: [g] }));
    const v = (await listarContatos(p, quem)).grupos.find((x) => x.id === g)!.versao;
    await mudarSituacaoGrupo(p, quem, g, v, false);
    expect(await destinatariosDe(p, { grupos: [g], contatos: [] })).toEqual([]);
  });
});
