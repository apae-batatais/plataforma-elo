/**
 * Cadastro Único: cadastrar, corrigir, vincular e encerrar (ADR-035).
 * Dados fictícios; os CPFs abaixo são válidos só no cálculo e não são de ninguém.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, Papeis, PerfilPermissoes, Pessoas, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { abrirPessoa, cadastrarPessoa, corrigirPessoa, encerrarVinculo, ErroDuplicidade, servicosParaVincular, vincularPessoa } from '@/nucleo/pessoas/gravacao';
import { contarAtendidos } from '@/nucleo/pessoas/contagem';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

let p: Planilhas;
const sistema = { email: 'sistema' };
const AGORA = new Date('2026-11-20T12:00:00Z');
const CPF_A = '529.982.247-25';
const CPF_B = '111.444.777-35';

async function usuario(email: string, perfil: string, escopo_tipo: 'global' | 'servico' = 'global', escopo: string | null = null) {
  const pessoa = await inserir(p, Pessoas, { nome: `Conta ${email}` }, sistema);
  await inserir(p, Usuarios, { email, pessoa_id: pessoa.id }, sistema);
  await inserir(p, Atribuicoes, { usuario_email: email, perfil, escopo_tipo, escopo, inicio: null, fim: null }, sistema);
}
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() }, { hoje: '2026-11-20' });
}
const pessoasPorNome = async (n: string) => (await lerTabela(p, Pessoas)).todos().filter((x) => x.nome === n);

beforeEach(async () => {
  p = await planilhasDeTeste();
  await inserir(p, Servicos, { codigo: 'ur', nome: 'Unidade Referenciada', unidade: 'sede', area: 'assistencia_social' }, sistema);
  await inserir(p, Servicos, { codigo: 'cer', nome: 'Reabilitação', unidade: 'sede', area: 'saude' }, sistema);
  await usuario('diretora@teste.org', 'diretoria');
  await usuario('coord.ur@teste.org', 'coordenacao_servico', 'servico', 'ur');
  await usuario('coord.cer@teste.org', 'coordenacao_servico', 'servico', 'cer');
  await usuario('tecnico@teste.org', 'tecnico_avaliador', 'servico', 'ur');
  await usuario('leitura@teste.org', 'leitura');
  await usuario('admin@teste.org', 'administrador_plataforma');
});

describe('cadastrar pessoa', () => {
  it('Diretoria e Coordenação cadastram; os demais perfis são recusados', async () => {
    for (const e of ['diretora@teste.org', 'coord.ur@teste.org']) {
      await expect(cadastrarPessoa(p, await como(e), { nome: `Pessoa de ${e}` }, AGORA)).resolves.toBeTruthy();
    }
    for (const e of ['tecnico@teste.org', 'leitura@teste.org', 'admin@teste.org']) {
      await expect(cadastrarPessoa(p, await como(e), { nome: 'Pessoa Negada' }, AGORA)).rejects.toThrow(ErroPermissao);
    }
    expect(await pessoasPorNome('Pessoa Negada')).toHaveLength(0);
  });

  it('com serviço grava pessoa, papel atendido e vínculo, audita só as colunas e devolve o evento', async () => {
    const r = await cadastrarPessoa(p, await como('coord.ur@teste.org'), { nome: '  Maria   da Silva ', cpf: CPF_A, dataNascimento: '2015-03-02', servico: 'ur' }, AGORA);
    expect(r.falhaNoVinculo).toBeNull();
    expect(r.evento).toEqual({ vinculoId: r.vinculo!.id, pessoaId: r.pessoa.id, servico: 'ur', entrada: '2026-11-20' });
    const [pessoa] = await pessoasPorNome('Maria da Silva');
    expect(pessoa.cpf).toBe('52998224725');
    const papeis = (await lerTabela(p, Papeis)).ativos().filter((x) => x.pessoa_id === pessoa.id);
    expect(papeis.map((x) => x.papel)).toEqual(['atendido']);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.acao === 'inclusao');
    expect(aud.map((x) => x.entidade).sort()).toEqual(['Papeis', 'Pessoas', 'VinculosServico']);
    const json = JSON.stringify(aud.map((x) => x.detalhes));
    expect(json).toContain('cpf');
    expect(json).not.toContain('52998224725');
    expect(json).not.toContain('Maria');
  });

  it('sem serviço grava só a pessoa com o papel escolhido', async () => {
    const r = await cadastrarPessoa(p, await como('diretora@teste.org'), { nome: 'Joana Voluntária', papel: 'voluntario' }, AGORA);
    expect(r.vinculo).toBeNull();
    expect((await lerTabela(p, Papeis)).ativos().filter((x) => x.pessoa_id === r.pessoa.id).map((x) => x.papel)).toEqual(['voluntario']);
    expect((await lerTabela(p, VinculosServico)).todos()).toHaveLength(0);
  });

  it('Coordenação não vincula a serviço fora do seu escopo', async () => {
    await expect(cadastrarPessoa(p, await como('coord.ur@teste.org'), { nome: 'Pedro Fora', servico: 'cer' }, AGORA)).rejects.toThrow(ErroPermissao);
    expect(await pessoasPorNome('Pedro Fora')).toHaveLength(0);
  });

  it('valida nome, CPF, NIS, e-mail e nascimento com mensagem do que fazer', async () => {
    const q = await como('diretora@teste.org');
    await expect(cadastrarPessoa(p, q, { nome: 'A' }, AGORA)).rejects.toThrow(/nome completo/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', cpf: '123.456.789-00' }, AGORA)).rejects.toThrow(/CPF inválido/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', nis: '123' }, AGORA)).rejects.toThrow(/NIS/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', email: 'ana' }, AGORA)).rejects.toThrow(/E-mail/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', dataNascimento: '2027-01-01' }, AGORA)).rejects.toThrow(/futuro/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', servico: 'ur', entrada: '2027-01-01' }, AGORA)).rejects.toThrow(/futuro/);
    await expect(cadastrarPessoa(p, q, { nome: 'Ana Souza', servico: 'nao_existe' }, AGORA)).rejects.toThrow(/Serviço/);
    expect(await pessoasPorNome('Ana Souza')).toHaveLength(0);
  });

  it('CPF igual bloqueia; para quem vê a pessoa oferece vincular, para quem não vê não revela nada', async () => {
    const dir = await como('diretora@teste.org');
    const primeira = await cadastrarPessoa(p, dir, { nome: 'Maria Souza', cpf: CPF_A, servico: 'cer' }, AGORA);
    const erro = await cadastrarPessoa(p, dir, { nome: 'Outro Nome', cpf: CPF_A }, AGORA).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDuplicidade);
    expect(erro.existenteId).toBe(primeira.pessoa.id);
    const coord = await como('coord.ur@teste.org');
    const oculto = await cadastrarPessoa(p, coord, { nome: 'Outro Nome', cpf: CPF_A, servico: 'ur' }, AGORA).catch((e) => e);
    expect(oculto).toBeInstanceOf(ErroDuplicidade);
    expect(oculto.existenteId).toBeNull();
    expect(oculto.message).toContain('Peça à Diretoria');
    expect(oculto.message).not.toContain('Maria');
    expect(oculto.message).not.toContain('Reabilitação');
    expect(await pessoasPorNome('Outro Nome')).toHaveLength(0);
  });

  it('nome e nascimento iguais só avisam; confirmar "é outra pessoa" grava', async () => {
    const q = await como('diretora@teste.org');
    await cadastrarPessoa(p, q, { nome: 'João Lima', dataNascimento: '2010-05-05' }, AGORA);
    const erro = await cadastrarPessoa(p, q, { nome: 'joao  LIMA', dataNascimento: '2010-05-05' }, AGORA).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDuplicidade);
    expect(erro.tipo).toBe('nome');
    await cadastrarPessoa(p, q, { nome: 'joao  LIMA', dataNascimento: '2010-05-05', confirmarOutraPessoa: true }, AGORA);
    expect(await pessoasPorNome('joao LIMA')).toHaveLength(1);
  });

  it('se o vínculo falha depois da pessoa gravada, a pessoa fica cadastrada e o resultado avisa', async () => {
    const q = await como('diretora@teste.org');
    const original = p.armazenamento.acrescentar.bind(p.armazenamento);
    p.armazenamento.acrescentar = async (planilha, aba, linhas) => {
      if (aba === 'VinculosServico') throw new Error('falha de rede');
      return original(planilha, aba, linhas);
    };
    const r = await cadastrarPessoa(p, q, { nome: 'Lúcia Falha', servico: 'ur' }, AGORA);
    expect(r.vinculo).toBeNull();
    expect(r.falhaNoVinculo).toBe('falha de rede');
    expect(await pessoasPorNome('Lúcia Falha')).toHaveLength(1);
  });
});

describe('corrigir dados', () => {
  it('altera e audita só as colunas; conflito de versão é recusado', async () => {
    const q = await como('coord.ur@teste.org');
    const r = await cadastrarPessoa(p, q, { nome: 'Carlos Dias', servico: 'ur' }, AGORA);
    const { colunasAlteradas } = await corrigirPessoa(p, q, r.pessoa.id, r.pessoa.versao, { nome: 'Carlos Dias', telefone: '(11) 99999-0000' }, AGORA);
    expect(colunasAlteradas).toEqual(['telefone']);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.acao === 'alteracao');
    expect(aud).toHaveLength(1);
    expect(JSON.stringify(aud[0].detalhes)).not.toContain('99999');
    await expect(corrigirPessoa(p, q, r.pessoa.id, r.pessoa.versao, { nome: 'Carlos D.' }, AGORA)).rejects.toThrow(ErroConflito);
  });

  it('recusa CPF de outra pessoa e quem não pode editar ou ver', async () => {
    const dir = await como('diretora@teste.org');
    await cadastrarPessoa(p, dir, { nome: 'Rita Alves', cpf: CPF_A }, AGORA);
    const b = await cadastrarPessoa(p, dir, { nome: 'Bia Alves', cpf: CPF_B, servico: 'cer' }, AGORA);
    await expect(corrigirPessoa(p, dir, b.pessoa.id, b.pessoa.versao, { nome: 'Bia Alves', cpf: CPF_A }, AGORA)).rejects.toThrow(/outra pessoa/);
    await expect(corrigirPessoa(p, await como('coord.ur@teste.org'), b.pessoa.id, b.pessoa.versao, { nome: 'Bia X' }, AGORA)).rejects.toThrow(ErroPermissao);
    await expect(corrigirPessoa(p, await como('tecnico@teste.org'), b.pessoa.id, b.pessoa.versao, { nome: 'Bia X' }, AGORA)).rejects.toThrow(ErroPermissao);
  });
});

describe('vincular a serviço', () => {
  it('vincula, devolve o evento e impede segundo vínculo ativo no mesmo serviço', async () => {
    const dir = await como('diretora@teste.org');
    const r = await cadastrarPessoa(p, dir, { nome: 'Teo Reis' }, AGORA);
    const ev = await vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'ur', entrada: '2026-01-10' }, AGORA);
    expect(ev).toMatchObject({ pessoaId: r.pessoa.id, servico: 'ur', entrada: '2026-01-10' });
    await expect(vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'ur' }, AGORA)).rejects.toThrow(/já está vinculada/);
    await expect(vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'cer', entrada: '2027-01-01' }, AGORA)).rejects.toThrow(/futuro/);
    await vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'cer' }, AGORA);
    expect((await lerTabela(p, VinculosServico)).ativos()).toHaveLength(2);
  });

  it('quem coordena só vincula no seu serviço e só pessoa que pode ver', async () => {
    const dir = await como('diretora@teste.org');
    const fora = await cadastrarPessoa(p, dir, { nome: 'Vera Fora', servico: 'cer' }, AGORA);
    const coord = await como('coord.ur@teste.org');
    await expect(vincularPessoa(p, coord, { pessoaId: fora.pessoa.id, servico: 'ur' }, AGORA)).rejects.toThrow(ErroPermissao);
    const minha = await cadastrarPessoa(p, coord, { nome: 'Lia Minha' }, AGORA);
    await expect(vincularPessoa(p, coord, { pessoaId: minha.pessoa.id, servico: 'cer' }, AGORA)).rejects.toThrow(ErroPermissao);
    await expect(vincularPessoa(p, coord, { pessoaId: minha.pessoa.id, servico: 'ur' }, AGORA)).resolves.toBeTruthy();
    await expect(vincularPessoa(p, await como('tecnico@teste.org'), { pessoaId: minha.pessoa.id, servico: 'ur' }, AGORA)).rejects.toThrow(ErroPermissao);
  });

  it('lista só os serviços em que o perfil pode vincular', async () => {
    expect((await servicosParaVincular(p, await como('coord.ur@teste.org'))).map((s) => s.codigo)).toEqual(['ur']);
    expect((await servicosParaVincular(p, await como('diretora@teste.org'))).map((s) => s.codigo).sort()).toEqual(['cer', 'ur']);
    expect(await servicosParaVincular(p, await como('tecnico@teste.org'))).toEqual([]);
  });
});

describe('encerrar vínculo', () => {
  async function comVinculo() {
    const dir = await como('diretora@teste.org');
    const r = await cadastrarPessoa(p, dir, { nome: 'Nina Prado', servico: 'ur', entrada: '2026-05-01' }, AGORA);
    await vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'cer', entrada: '2026-06-01' }, AGORA);
    const vinculos = (await lerTabela(p, VinculosServico)).todos();
    return { dir, r, ur: vinculos.find((v) => v.servico === 'ur')!, cer: vinculos.find((v) => v.servico === 'cer')! };
  }

  it('grava saída e motivo, mantém ativo, não mexe no outro serviço e devolve o evento', async () => {
    const { dir, r, ur, cer } = await comVinculo();
    const ev = await encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, saida: '2026-10-31', motivo: 'Mudou de cidade' }, AGORA);
    expect(ev).toEqual({ vinculoId: ur.id, pessoaId: r.pessoa.id, servico: 'ur', saida: '2026-10-31', motivo: 'Mudou de cidade' });
    const depois = (await lerTabela(p, VinculosServico)).todos();
    expect(depois.find((v) => v.id === ur.id)).toMatchObject({ ativo: true, saida: '2026-10-31', motivo_saida: 'Mudou de cidade' });
    expect(depois.find((v) => v.id === cer.id)!.saida).toBeNull();
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.acao === 'encerramento');
    expect(aud).toHaveLength(1);
    expect(JSON.stringify(aud[0].detalhes)).not.toContain('Mudou');
    // a contagem mensal ainda vê quem esteve no serviço em outubro
    expect((await contarAtendidos(p, ['ur'], ['2026-10', '2026-11'], '2026-11-20')).get('ur')).toEqual(new Map([['2026-10', 1], ['2026-11', 0]]));
  });

  it('exige motivo, data entre a entrada e hoje e não encerra duas vezes', async () => {
    const { dir, ur } = await comVinculo();
    await expect(encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, motivo: ' ' }, AGORA)).rejects.toThrow(/motivo/);
    await expect(encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, saida: '2026-04-30', motivo: 'x1' }, AGORA)).rejects.toThrow(/antes da entrada/);
    await expect(encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, saida: '2026-12-01', motivo: 'x1' }, AGORA)).rejects.toThrow(/futuro/);
    await encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, motivo: 'Concluiu' }, AGORA);
    const atual = (await lerTabela(p, VinculosServico)).porId(ur.id)!;
    expect(atual.saida).toBe('2026-11-20');
    await expect(encerrarVinculo(p, dir, { vinculoId: ur.id, versao: atual.versao, motivo: 'Outra vez' }, AGORA)).rejects.toThrow(/já foi encerrado/);
  });

  it('só quem tem a permissão no serviço do vínculo encerra', async () => {
    const { cer } = await comVinculo();
    for (const e of ['coord.ur@teste.org', 'tecnico@teste.org', 'leitura@teste.org']) {
      await expect(encerrarVinculo(p, await como(e), { vinculoId: cer.id, versao: cer.versao, motivo: 'Teste' }, AGORA)).rejects.toThrow(ErroPermissao);
    }
    await expect(encerrarVinculo(p, await como('coord.cer@teste.org'), { vinculoId: cer.id, versao: cer.versao, motivo: 'Teste' }, AGORA)).resolves.toBeTruthy();
  });

  it('voltar ao serviço é um vínculo novo', async () => {
    const { dir, r, ur } = await comVinculo();
    await encerrarVinculo(p, dir, { vinculoId: ur.id, versao: ur.versao, motivo: 'Pausa' }, AGORA);
    await vincularPessoa(p, dir, { pessoaId: r.pessoa.id, servico: 'ur' }, AGORA);
    const doServico = (await lerTabela(p, VinculosServico)).todos().filter((v) => v.servico === 'ur');
    expect(doServico).toHaveLength(2);
  });
});

describe('abrir pessoa', () => {
  it('mostra dados e vínculos a quem pode ver e grava leitura sem os valores', async () => {
    const dir = await como('diretora@teste.org');
    const r = await cadastrarPessoa(p, dir, { nome: 'Olga Reis', cpf: CPF_A, servico: 'cer' }, AGORA);
    const aberta = await abrirPessoa(p, await como('coord.cer@teste.org'), r.pessoa.id, AGORA);
    expect(aberta.dados.cpf).toBe('52998224725');
    expect(aberta.vinculos).toMatchObject([{ servico: 'cer', servicoNome: 'Reabilitação', podeEncerrar: true }]);
    expect(aberta.podeCorrigir).toBe(true);
    const leituras = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.acao === 'leitura');
    expect(leituras).toHaveLength(1);
    expect(leituras[0].registro_id).toBe(r.pessoa.id);
    expect(JSON.stringify(leituras[0])).not.toContain('52998224725');
  });

  it('recusa quem não vê a pessoa e não grava leitura', async () => {
    const dir = await como('diretora@teste.org');
    const r = await cadastrarPessoa(p, dir, { nome: 'Olga Reis', servico: 'cer' }, AGORA);
    await expect(abrirPessoa(p, await como('coord.ur@teste.org'), r.pessoa.id, AGORA)).rejects.toThrow(ErroPermissao);
    expect((await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.acao === 'leitura')).toHaveLength(0);
  });
});
