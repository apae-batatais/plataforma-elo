/**
 * Rede R4 (ADR-018): pasta única por instituição. O Elo cria as próprias
 * planilhas, sem duplicar, sem apagar e sem sair da pasta da instituição.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idDaPasta, PastasMemoria } from '@/nucleo/armazenamento/pastas';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import {
  autorizadorDaRede,
  conferirInstituicao,
  garantirPlanilhasDaPasta,
  instituicoesCadastradas,
  painelDaRede,
  prepararEstruturaDaInstituicao,
  prepararRede,
  salvarInstituicao,
  type DadosInstituicao,
} from '@/nucleo/rede/rede';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';

const PASTA_A = 'pastaAAAAAAAAAAAAAAAAAAAA';
const PASTA_B = 'pastaBBBBBBBBBBBBBBBBBBBB';
const ID_ANTIGO = '1aaaaaaaaaaaaaaaaaaaaaaaaaaAbC';
const ID_ANTIGO2 = '1bbbbbbbbbbbbbbbbbbbbbbbbbbAbC';

let rede: Planilhas;
let planilhas: ArmazenamentoMemoria;
let pastas: PastasMemoria;
const operadora = () => autorizadorDaRede(rede, 'rede@operadora.org', ['rede@operadora.org']);

const dados = (codigo: string, extra: Partial<DadosInstituicao> = {}): DadosInstituicao => ({
  codigo,
  nome: `Apae ${codigo}`,
  dominio: `${codigo}.org.br`,
  enderecos: [`elo.${codigo}.org.br`],
  administradoresIniciais: [],
  unidades: [{ codigo: 'sede', nome: 'Sede' }],
  pasta: `https://drive.google.com/drive/folders/${PASTA_A}?usp=sharing`,
  ...extra,
});

async function cadastrar(codigo = 'franca', extra: Partial<DadosInstituicao> = {}) {
  const op = await operadora();
  await salvarInstituicao(rede, op, dados(codigo, extra));
  const linha = (await painelDaRede(rede, op)).instituicoes.find((i) => i.codigo === codigo)!;
  return { op, linha };
}

beforeEach(async () => {
  planilhas = new ArmazenamentoMemoria([]);
  rede = { armazenamento: new ArmazenamentoMemoria(['rede']), idDe: () => 'rede' };
  await prepararRede(rede);
  pastas = new PastasMemoria((id) => planilhas.adicionarPlanilha(id));
  pastas.adicionarPasta(PASTA_A);
  pastas.adicionarPasta(PASTA_B);
});

describe('link da pasta', () => {
  it('aceita o link do Drive ou o ID, e recusa o que não parece pasta', () => {
    expect(idDaPasta(`https://drive.google.com/drive/folders/${PASTA_A}?usp=sharing`)).toBe(PASTA_A);
    expect(idDaPasta(`https://drive.google.com/drive/u/1/folders/${PASTA_A}`)).toBe(PASTA_A);
    expect(idDaPasta(PASTA_A)).toBe(PASTA_A);
    expect(idDaPasta('isto não é link')).toBeNull();
  });

  it('o cadastro guarda só o ID, dispensa os IDs das planilhas e recusa pasta repetida ou inválida', async () => {
    const { op, linha } = await cadastrar('franca');
    expect(linha.pasta).toBe(PASTA_A);
    expect(linha.planilhas).toEqual({});
    await expect(salvarInstituicao(rede, op, dados('batatais', { dominio: 'bt.org.br', enderecos: [] }))).rejects.toThrow(/pasta já é de outra/);
    await expect(salvarInstituicao(rede, op, dados('outra', { pasta: 'lixo', dominio: 'o.org.br', enderecos: [] }))).rejects.toThrow(/link da pasta/);
    await expect(salvarInstituicao(rede, op, dados('sem', { pasta: '', dominio: 's.org.br', enderecos: [] }))).rejects.toThrow(/link da pasta/);
  });

  it('instituição antiga sem pasta continua válida com os IDs de Núcleo e Auditoria', async () => {
    const op = await operadora();
    await salvarInstituicao(rede, op, dados('antiga', { pasta: undefined, planilhas: { nucleo: ID_ANTIGO, auditoria: ID_ANTIGO2 } }));
    const [i] = await instituicoesCadastradas(rede);
    expect(i.pasta).toBeUndefined();
    expect(i.planilhas.nucleo).toBe(ID_ANTIGO);
  });

  it('alterar o cadastro sem mandar IDs mantém os IDs já gravados', async () => {
    const op = await operadora();
    const id = await salvarInstituicao(rede, op, dados('antiga', { pasta: undefined, planilhas: { nucleo: ID_ANTIGO, auditoria: ID_ANTIGO2 } }));
    const linha = (await painelDaRede(rede, op)).instituicoes[0];
    await salvarInstituicao(rede, op, dados('antiga', { planilhas: undefined }), { id, versao: linha.versao });
    const [i] = await instituicoesCadastradas(rede);
    expect([i.pasta, i.planilhas.nucleo, i.planilhas.auditoria]).toEqual([PASTA_A, ID_ANTIGO, ID_ANTIGO2]);
  });
});

describe('criar as planilhas na pasta', () => {
  it('cria Núcleo, Auditoria, as dos apps e a pasta de anexos, grava os IDs e audita sem valores', async () => {
    const { op, linha } = await cadastrar();
    const r = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    const chaves = r.criadas.map((x) => x.chave);
    expect(chaves).toEqual(expect.arrayContaining(['nucleo', 'auditoria', 'orcamento', 'requisicoes', 'comunicacao', 'anexos']));
    expect(r.jaExistiam).toEqual([]);
    expect(r.criadas.find((x) => x.chave === 'anexos')?.tipo).toBe('pasta');
    // Nome e lugar: tudo dentro da pasta da instituição.
    for (const [, item] of pastas.itens) expect(item.pasta).toBe(PASTA_A);
    expect([...pastas.itens.values()].some((i) => i.nome === 'Elo · Apae franca · Núcleo')).toBe(true);
    // IDs gravados no cadastro.
    const [i] = await instituicoesCadastradas(rede);
    expect(i.planilhas.nucleo).toBe(r.criadas.find((x) => x.chave === 'nucleo')!.id);
    expect(i.planilhas.anexos).toBeTruthy();
    // Auditoria: colunas e chaves, nunca IDs.
    const auditoria = (await lerTabela(rede, RegistrosAuditoria)).todos();
    const texto = JSON.stringify(auditoria);
    expect(auditoria.some((a) => a.acao === 'estrutura')).toBe(true);
    expect(texto).toContain('\\"colunas\\":[\\"planilhas\\"]');
    for (const x of r.criadas) expect(texto).not.toContain(x.id);
  });

  it('rodar duas vezes não cria planilha duplicada', async () => {
    const { op, linha } = await cadastrar();
    const r1 = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    const total = pastas.itens.size;
    const nova = (await painelDaRede(rede, op)).instituicoes[0];
    const r2 = await garantirPlanilhasDaPasta(rede, op, pastas, nova, nova, ESTRUTURA_DOS_MODULOS);
    expect(pastas.itens.size).toBe(total);
    expect(r2.criadas).toEqual([]);
    expect(r2.jaExistiam).toHaveLength(r1.criadas.length);
  });

  it('acha pela marca, mesmo renomeada, quando o cadastro perdeu o ID', async () => {
    const { op, linha } = await cadastrar();
    pastas.adicionarItem('renomeada-nucleo-xxxxxxxxx', { pasta: PASTA_A, nome: 'Planilha da equipe', marca: 'franca/nucleo' });
    const r = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    expect(r.jaExistiam.find((x) => x.chave === 'nucleo')?.id).toBe('renomeada-nucleo-xxxxxxxxx');
    expect(r.criadas.map((x) => x.chave)).not.toContain('nucleo');
  });

  it('nunca usa item marcado de outra instituição nem de outra pasta', async () => {
    const { op, linha } = await cadastrar();
    pastas.adicionarItem('de-outra-pasta-xxxxxxxxxx', { pasta: PASTA_B, marca: 'franca/nucleo' });
    pastas.adicionarItem('de-outra-inst-xxxxxxxxxxx', { pasta: PASTA_A, marca: 'batatais/auditoria' });
    const r = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    expect(r.criadas.map((x) => x.chave)).toEqual(expect.arrayContaining(['nucleo', 'auditoria']));
    expect(r.criadas.every((x) => x.id !== 'de-outra-pasta-xxxxxxxxxx' && x.id !== 'de-outra-inst-xxxxxxxxxxx')).toBe(true);
  });

  it('as planilhas atuais continuam valendo (mesmo fora da pasta) e ganham a marca', async () => {
    const op = await operadora();
    await salvarInstituicao(rede, op, dados('antiga', { planilhas: { nucleo: ID_ANTIGO, auditoria: ID_ANTIGO2 } }));
    pastas.adicionarItem(ID_ANTIGO);
    pastas.adicionarItem(ID_ANTIGO2);
    const linha = (await painelDaRede(rede, op)).instituicoes[0];
    const r = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    expect(r.jaExistiam.map((x) => x.id)).toEqual(expect.arrayContaining([ID_ANTIGO, ID_ANTIGO2]));
    expect(r.inst.planilhas.nucleo).toBe(ID_ANTIGO);
    expect(pastas.itens.get(ID_ANTIGO)?.marca).toBe('antiga/nucleo');
    // Nada foi movido.
    expect(pastas.itens.get(ID_ANTIGO)?.pasta).toBeNull();
  });

  it('planilha na lixeira não é substituída: o Elo avisa e não cria outra', async () => {
    const op = await operadora();
    await salvarInstituicao(rede, op, dados('antiga', { planilhas: { nucleo: ID_ANTIGO, auditoria: ID_ANTIGO2 } }));
    pastas.adicionarItem(ID_ANTIGO, { lixeira: true });
    pastas.adicionarItem(ID_ANTIGO2);
    const linha = (await painelDaRede(rede, op)).instituicoes[0];
    const antes = pastas.itens.size;
    await expect(garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS)).rejects.toThrow(/Núcleo está na lixeira/);
    const criadasNucleo = [...pastas.itens.values()].filter((i) => i.marca === 'antiga/nucleo' && i.pasta === PASTA_A);
    expect(criadasNucleo).toEqual([]);
    expect(pastas.itens.size).toBeGreaterThanOrEqual(antes);
  });

  it('pasta inexistente, fora de Drive compartilhado ou sem permissão: nada é criado e o motivo aparece', async () => {
    const { op, linha } = await cadastrar();
    pastas.adicionarPasta(PASTA_A, 'Pasta', 'A conta de serviço não pode criar arquivos na pasta: dê a ela o papel de Gerente de conteúdo.');
    await expect(garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS)).rejects.toThrow(/Gerente de conteúdo/);
    expect(pastas.itens.size).toBe(0);
    const sem = { ...linha, pasta: 'naoexisteeeeeeeeeeeeeeee' };
    await expect(garantirPlanilhasDaPasta(rede, op, pastas, sem, linha, ESTRUTURA_DOS_MODULOS)).rejects.toThrow(/não foi encontrada/);
    expect(pastas.itens.size).toBe(0);
  });

  it('só a Administração da rede cria planilhas', async () => {
    const { linha } = await cadastrar();
    const estranho = await autorizadorDaRede(rede, 'x@y.org', []);
    await expect(garantirPlanilhasDaPasta(rede, estranho, pastas, linha, linha, ESTRUTURA_DOS_MODULOS)).rejects.toBeInstanceOf(ErroPermissao);
    expect(pastas.itens.size).toBe(0);
  });
});

describe('conferir e preparar com pasta', () => {
  it('antes: planilhas "serão criadas"; depois de preparar: criadas e estrutura em dia; apagar na lixeira é apontado', async () => {
    const { op, linha } = await cadastrar();
    let c = await conferirInstituicao(op, planilhas, linha, ESTRUTURA_DOS_MODULOS, pastas);
    expect(c.pasta?.ok).toBe(true);
    expect(c.planilhas.find((x) => x.chave === 'nucleo')?.situacao).toBe('sera_criada');
    expect(c.estrutura).toBe('nao_preparada');

    const g = await garantirPlanilhasDaPasta(rede, op, pastas, linha, linha, ESTRUTURA_DOS_MODULOS);
    await prepararEstruturaDaInstituicao(rede, op, planilhas, g.inst, ESTRUTURA_DOS_MODULOS, linha.id);
    c = await conferirInstituicao(op, planilhas, g.inst, ESTRUTURA_DOS_MODULOS, pastas);
    expect(c.planilhas.every((x) => x.ok && x.situacao === 'criada')).toBe(true);
    expect(c.estrutura).toBe('em_dia');

    pastas.itens.get(g.inst.planilhas.requisicoes)!.lixeira = true;
    c = await conferirInstituicao(op, planilhas, g.inst, ESTRUTURA_DOS_MODULOS, pastas);
    expect(c.planilhas.find((x) => x.chave === 'requisicoes')).toMatchObject({ ok: false, situacao: 'lixeira' });
  });

  it('pasta sem permissão aparece na conferência, sem gravar nada', async () => {
    const { op, linha } = await cadastrar();
    pastas.adicionarPasta(PASTA_A, 'Pasta', 'A pasta precisa ficar num Drive compartilhado.');
    const c = await conferirInstituicao(op, planilhas, linha, ESTRUTURA_DOS_MODULOS, pastas);
    expect(c.pasta).toEqual({ ok: false, mensagem: 'A pasta precisa ficar num Drive compartilhado.' });
    expect(pastas.itens.size).toBe(0);
  });
});

describe('Google Drive (pastas)', () => {
  it('cria dentro da pasta com a marca, procura só nela e nunca apaga nem move', async () => {
    const { PastasGoogleDrive } = await import('@/nucleo/armazenamento/pastas');
    const chamadas: { url: string; metodo: string; corpo?: string }[] = [];
    const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
    const buscar = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, metodo: init?.method ?? 'GET', corpo: init?.body as string | undefined });
      if (url.includes('?q=') || url.includes('&q=') || url.includes('q=')) return resposta({ files: [] });
      return resposta({ id: 'novo-id-0123456789' });
    }) as unknown as typeof fetch;
    const drive = new PastasGoogleDrive(async () => 't', buscar);
    expect(await drive.procurar(PASTA_A, 'franca/nucleo')).toBeNull();
    const id = await drive.criar(PASTA_A, { nome: 'Elo · X · Núcleo', tipo: 'planilha', marca: 'franca/nucleo' });
    expect(id).toBe('novo-id-0123456789');
    const criar = chamadas.find((c) => c.metodo === 'POST')!;
    expect(JSON.parse(criar.corpo!)).toMatchObject({ parents: [PASTA_A], mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { elo_item: 'franca/nucleo' } });
    expect(decodeURIComponent(chamadas[0].url.replace(/\+/g, ' '))).toContain(`'${PASTA_A}' in parents and trashed = false`);
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
  });
});
