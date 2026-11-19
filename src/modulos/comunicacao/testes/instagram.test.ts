/**
 * Instagram da Comunicação, entrega 1 (ADR-028): conectar, reconectar, desconectar, quem pode, segredo que
 * nunca aparece, isolamento entre instituições e renovação do token pela rotina.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { cifrar, decifrar, ErroCifra } from '@/nucleo/credenciais/cifra';
import { renovarCredencial, segredoDaCredencial } from '@/nucleo/credenciais/credenciais';
import {
  assinarEstadoDaConexao,
  conferirEstadoDaConexao,
  ProvedorInstagramMemoria,
  ProvedorMeta,
} from '@/nucleo/credenciais/instagram';
import { Credenciais, RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { concluirConexaoInstagram, desconectarInstagram, iniciarConexaoInstagram, situacaoDoInstagram } from '../aplicacao/instagram';
import { ErroComunicacao } from '../dominio/pedido';
import { COMUNICACAO, COORDENACAO, DIRETORIA, FUNCIONARIO, como, planilhasDeComunicacao } from './apoio';

const SEGREDO = 'chave-mestra-de-teste-com-mais-de-32-caracteres';
const SESSAO = 'segredo-da-sessao-de-teste-com-32-caracteres!!';
const RETORNO = 'https://exemplo.local/comunicacao/instagram/retorno';
const AGORA = new Date('2026-11-17T12:00:00Z');
const DIA = 86400000;
let p: Planilhas;

beforeEach(async () => {
  process.env.ELO_CHAVE_CREDENCIAIS = SEGREDO;
  p = await planilhasDeComunicacao();
});

async function conectar(email = COORDENACAO, inst = 'exemplo', provedor = new ProvedorInstagramMemoria('conta_a', 60, () => AGORA)) {
  const quem = await como(p, email);
  const url = await iniciarConexaoInstagram(provedor, SESSAO, quem, inst, RETORNO);
  const estado = new URL(url).searchParams.get('state');
  await concluirConexaoInstagram(p, quem, provedor, SESSAO, inst, RETORNO, { codigo: 'demo', estado, erro: null }, AGORA);
}

describe('cifra', () => {
  it('cifra e decifra; o texto cifrado não mostra o valor', () => {
    const c = cifrar('token-secreto', 'a|instagram');
    expect(c).not.toContain('token-secreto');
    expect(decifrar(c, 'a|instagram')).toBe('token-secreto');
  });
  it('outro contexto (outra instituição) ou outra chave não decifra', () => {
    const c = cifrar('token-secreto', 'a|instagram');
    expect(() => decifrar(c, 'b|instagram')).toThrow(ErroCifra);
    expect(() => decifrar(c, 'a|instagram', 'outra-chave-mestra-com-mais-de-32-caracteres')).toThrow(ErroCifra);
  });
  it('sem chave mestra, recusa sem citar valor', () => {
    expect(() => cifrar('x', 'a|instagram', '')).toThrow(/ELO_CHAVE_CREDENCIAIS/);
  });
});

describe('conectar', () => {
  it('a coordenação conecta; a planilha guarda só o texto cifrado e a tela vê só conta e validade', async () => {
    await conectar();
    const [linha] = (await lerTabela(p, Credenciais)).todos();
    expect(linha.valor_cifrado).toMatch(/^v1\./);
    expect(linha.valor_cifrado).not.toContain('fictício');
    const s = await situacaoDoInstagram(p, await como(p, COORDENACAO), 'exemplo', AGORA);
    expect(s).toMatchObject({ situacao: 'conectada', conta: 'conta_a' });
    expect(JSON.stringify(s)).not.toMatch(/fictício|v1\./);
    expect((await segredoDaCredencial(p, 'exemplo', 'instagram', { agora: AGORA }))?.valor).toMatch(/^fictício/);
  });

  it('a Diretoria também conecta; Comunicação e funcionário não', async () => {
    await conectar(DIRETORIA);
    for (const quem of [COMUNICACAO, FUNCIONARIO]) {
      const q = await como(p, quem);
      await expect(situacaoDoInstagram(p, q, 'exemplo')).rejects.toBeInstanceOf(ErroPermissao);
      await expect(iniciarConexaoInstagram(new ProvedorInstagramMemoria(), SESSAO, q, 'exemplo', RETORNO)).rejects.toBeInstanceOf(ErroPermissao);
      await expect(desconectarInstagram(p, q, 'exemplo')).rejects.toBeInstanceOf(ErroPermissao);
    }
  });

  it('estado de outra pessoa, de outra instituição ou inventado é recusado', async () => {
    const coord = await como(p, COORDENACAO);
    const dir = await como(p, DIRETORIA);
    const prov = new ProvedorInstagramMemoria();
    const estado = new URL(await iniciarConexaoInstagram(prov, SESSAO, coord, 'exemplo', RETORNO)).searchParams.get('state');
    for (const [quem, inst, e] of [[dir, 'exemplo', estado], [coord, 'modelo', estado], [coord, 'exemplo', 'invento'], [coord, 'exemplo', null]] as const) {
      await expect(concluirConexaoInstagram(p, quem, prov, SESSAO, inst, RETORNO, { codigo: 'demo', estado: e, erro: null })).rejects.toBeInstanceOf(ErroComunicacao);
    }
    expect((await lerTabela(p, Credenciais)).todos()).toHaveLength(0);
  });

  it('estado vence em 10 minutos e não vale com outro segredo', async () => {
    const e = await assinarEstadoDaConexao(SESSAO, COORDENACAO, 'exemplo');
    expect(await conferirEstadoDaConexao(SESSAO, e, COORDENACAO, 'exemplo')).toBe(true);
    expect(await conferirEstadoDaConexao('outro-segredo-com-mais-de-32-caracteres!!!', e, COORDENACAO, 'exemplo')).toBe(false);
  });

  it('conta não profissional, cancelamento e erro da Meta viram mensagem em português, sem gravar', async () => {
    const quem = await como(p, COORDENACAO);
    const prov = new ProvedorInstagramMemoria();
    const estado = new URL(await iniciarConexaoInstagram(prov, SESSAO, quem, 'exemplo', RETORNO)).searchParams.get('state');
    await expect(concluirConexaoInstagram(p, quem, prov, SESSAO, 'exemplo', RETORNO, { codigo: 'nao_profissional', estado, erro: null })).rejects.toThrow(/não é profissional/);
    await expect(concluirConexaoInstagram(p, quem, prov, SESSAO, 'exemplo', RETORNO, { codigo: null, estado, erro: 'access_denied' })).rejects.toThrow(/liberado pela Diretoria do Elo/);
    await expect(concluirConexaoInstagram(p, quem, prov, SESSAO, 'exemplo', RETORNO, { codigo: 'x', estado, erro: null })).rejects.toThrow(/Não foi possível conectar/);
    expect((await lerTabela(p, Credenciais)).todos()).toHaveLength(0);
  });

  it('só uma conta ativa: reconectar a mesma atualiza a linha; outra conta exige desconectar', async () => {
    await conectar();
    await conectar(); // mesma conta: reconectar
    expect((await lerTabela(p, Credenciais)).todos()).toHaveLength(1);
    await expect(conectar(COORDENACAO, 'exemplo', new ProvedorInstagramMemoria('conta_b', 60, () => AGORA))).rejects.toThrow(/outra conta conectada/);
    await desconectarInstagram(p, await como(p, COORDENACAO), 'exemplo', AGORA);
    await conectar(COORDENACAO, 'exemplo', new ProvedorInstagramMemoria('conta_b', 60, () => AGORA));
    const todas = (await lerTabela(p, Credenciais)).todos();
    expect(todas).toHaveLength(2);
    expect(todas.filter((c) => c.ativo)).toHaveLength(1);
  });
});

describe('desconectar', () => {
  it('zera o valor, encerra a linha (nada é apagado) e o segredo deixa de existir', async () => {
    await conectar();
    await desconectarInstagram(p, await como(p, COORDENACAO), 'exemplo', AGORA);
    const [linha] = (await lerTabela(p, Credenciais)).todos();
    expect(linha).toMatchObject({ ativo: false, situacao: 'desconectada', valor_cifrado: null, conta: 'conta_a' });
    expect(await segredoDaCredencial(p, 'exemplo', 'instagram', { agora: AGORA })).toBeNull();
    expect((await situacaoDoInstagram(p, await como(p, COORDENACAO), 'exemplo')).situacao).toBe('nenhuma');
    await expect(desconectarInstagram(p, await como(p, COORDENACAO), 'exemplo')).rejects.toBeInstanceOf(ErroComunicacao);
  });
});

describe('auditoria e isolamento', () => {
  it('a auditoria registra só colunas, nunca o valor', async () => {
    await conectar();
    await desconectarInstagram(p, await como(p, COORDENACAO), 'exemplo', AGORA);
    const registros = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Credenciais');
    expect(registros.map((r) => r.acao)).toEqual(['inclusao', 'encerramento']);
    for (const r of registros) expect(r.detalhes).not.toMatch(/fictício|v1\.|conta_a/);
  });

  it('a conta de uma instituição nunca aparece nem é lida pela outra', async () => {
    await conectar(COORDENACAO, 'exemplo');
    expect(await segredoDaCredencial(p, 'modelo', 'instagram', { agora: AGORA })).toBeNull();
    expect((await situacaoDoInstagram(p, await como(p, COORDENACAO), 'modelo')).situacao).toBe('nenhuma');
    // Linha copiada para outra instituição não decifra (a instituição entra na cifra).
    const [linha] = (await lerTabela(p, Credenciais)).todos();
    expect(() => decifrar(linha.valor_cifrado!, 'modelo|instagram', SEGREDO)).toThrow(ErroCifra);
  });
});

describe('renovação pela rotina', () => {
  const renovador = (prov: ProvedorInstagramMemoria) => async (t: string) => {
    const n = await prov.renovar();
    expect(t).toMatch(/^fictício/);
    return { valor: n.token, venceEm: n.venceEm };
  };

  it('sem conta, nada a fazer; longe do vencimento, não renova', async () => {
    const prov = new ProvedorInstagramMemoria('conta_a', 60, () => AGORA);
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: AGORA })).toBe('nenhuma');
    await conectar();
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: new Date(AGORA.getTime() + 30 * DIA) })).toBe('em_dia');
    expect(prov.renovacoes).toBe(0);
  });

  it('com menos de 15 dias, renova e estende a validade', async () => {
    await conectar();
    const depois = new Date(AGORA.getTime() + 50 * DIA);
    const prov = new ProvedorInstagramMemoria('conta_a', 60, () => depois);
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: depois })).toBe('renovada');
    const s = await situacaoDoInstagram(p, await como(p, COORDENACAO), 'exemplo', depois);
    expect(s.situacao).toBe('conectada');
    expect(new Date(s.venceEm!).getTime()).toBeGreaterThan(depois.getTime() + 55 * DIA);
    expect((await segredoDaCredencial(p, 'exemplo', 'instagram', { agora: depois }))?.valor).toBe('fictício-renovado-1');
  });

  it('renovação que falha deixa "expirando" (uma gravação só, sem repetir); vencido vira "expirada"', async () => {
    await conectar();
    const depois = new Date(AGORA.getTime() + 50 * DIA);
    const prov = new ProvedorInstagramMemoria('conta_a', 60, () => depois);
    prov.falharRenovacao = true;
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: depois })).toBe('expirando');
    const antes = (await lerTabela(p, RegistrosAuditoria)).todos().length;
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: depois })).toBe('expirando');
    expect((await lerTabela(p, RegistrosAuditoria)).todos()).toHaveLength(antes);
    expect((await situacaoDoInstagram(p, await como(p, COORDENACAO), 'exemplo', depois)).situacao).toBe('expirando');

    const vencido = new Date(AGORA.getTime() + 61 * DIA);
    expect((await situacaoDoInstagram(p, await como(p, COORDENACAO), 'exemplo', vencido)).situacao).toBe('expirada');
    expect(await renovarCredencial(p, 'exemplo', 'instagram', renovador(prov), { agora: vencido })).toBe('expirada');
    expect(await segredoDaCredencial(p, 'exemplo', 'instagram', { agora: vencido })).toBeNull();
    // Reconectar a mesma conta volta ao normal.
    await conectar(COORDENACAO, 'exemplo', new ProvedorInstagramMemoria('conta_a', 60, () => vencido));
  });
});

describe('Meta (com respostas simuladas)', () => {
  const resposta = (corpo: object, ok = true, status = 200) => ({ ok, status, json: async () => corpo }) as Response;
  const meta = (respostas: Response[]) => {
    const chamadas: string[] = [];
    const f = (async (url: string) => {
      chamadas.push(String(url));
      return respostas.shift()!;
    }) as unknown as typeof fetch;
    return { provedor: new ProvedorMeta('id-app', 'segredo-app', f), chamadas };
  };

  it('endereço de autorização leva o app, o retorno, os escopos e o estado', () => {
    const u = new URL(meta([]).provedor.urlDeAutorizacao('estado-x', RETORNO));
    expect(u.searchParams.get('client_id')).toBe('id-app');
    expect(u.searchParams.get('redirect_uri')).toBe(RETORNO);
    expect(u.searchParams.get('scope')).toContain('instagram_business_content_publish');
    expect(u.searchParams.get('state')).toBe('estado-x');
  });

  it('conecta: código curto, token longo, conta profissional', async () => {
    const { provedor, chamadas } = meta([resposta({ access_token: 'curto' }), resposta({ access_token: 'longo', expires_in: 5184000 }), resposta({ username: 'conta_a', account_type: 'BUSINESS' })]);
    const c = await provedor.conectar('codigo', RETORNO);
    expect(c).toMatchObject({ token: 'longo', usuario: 'conta_a' });
    expect(chamadas[1]).toContain('ig_exchange_token');
  });

  it('conta pessoal é recusada com explicação; erro da Meta nunca vaza detalhe técnico', async () => {
    const pessoal = meta([resposta({ access_token: 'c' }), resposta({ access_token: 'l' }), resposta({ username: 'x', account_type: 'PERSONAL' })]);
    await expect(pessoal.provedor.conectar('c', RETORNO)).rejects.toThrow(/não é profissional/);
    const recusa = meta([resposta({ error_message: 'detalhe interno secreto' }, false, 400)]);
    await expect(recusa.provedor.conectar('c', RETORNO)).rejects.toThrow(/liberado pela Diretoria/);
    const falha = meta([resposta({}, false, 500)]);
    await expect(falha.provedor.conectar('c', RETORNO)).rejects.not.toThrow(/secreto|segredo-app/);
  });

  it('renova pelo endereço de renovação da Meta', async () => {
    const { provedor, chamadas } = meta([resposta({ access_token: 'novo', expires_in: 5184000 })]);
    expect((await provedor.renovar('antigo')).token).toBe('novo');
    expect(chamadas[0]).toContain('ig_refresh_token');
  });
});
