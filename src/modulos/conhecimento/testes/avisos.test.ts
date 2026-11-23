import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { EnviadorMemoria } from '@/nucleo/email/email';
import { rodarAvisos } from '../aplicacao/avisos';
import { salvarPublicacao } from '../aplicacao/publicacoes';
import { EnviosConhecimento } from '../dados/tabelas';
import { AGORA, auditoriaDe, como, dados, EDITOR, FUNCIONARIO, planilhasDeConhecimento, publicada } from './apoio';

const COM_EMAIL = { agora: AGORA, emailDisponivel: true };
const URL = 'https://elo.exemplo.local';
let p: Planilhas;
let email: EnviadorMemoria;
beforeEach(async () => {
  p = await planilhasDeConhecimento();
  email = new EnviadorMemoria('nao-responda@exemplo.local');
});
const envios = async () => (await lerTabela(p, EnviosConhecimento)).ativos();
const rodar = (agora = AGORA, meios = { email, urlBase: URL as string | null }) => rodarAvisos(p, meios, agora);
const publicarComEmail = async (x = {}) => {
  const { categoriaPronta } = await import('./apoio');
  await categoriaPronta(p);
  return salvarPublicacao(p, await como(p, EDITOR), null, dados(x), COM_EMAIL);
};

describe('aviso por e-mail (regras 21 e 22)', () => {
  it('ao publicar algo que exige ciência, agenda um aviso e envia texto genérico em cópia oculta', async () => {
    const r = await publicarComEmail({ titulo: 'Título secreto', corpo: 'Conteúdo secreto' });
    expect(r.aviso).toBe('agendado');
    expect(await envios()).toHaveLength(1);
    expect(await rodar()).toMatchObject({ enviados: 1 });
    expect(email.enviadas).toHaveLength(1);
    const m = email.enviadas[0];
    expect(m.para).toBeUndefined();
    expect(m.cco).toContain(FUNCIONARIO);
    expect(m.assunto + m.texto).not.toMatch(/secreto/i);
    expect(m.texto).toContain(`${URL}/conhecimento`);
    expect((await envios())[0]).toMatchObject({ situacao: 'enviado', tentativas: 1 });
  });

  it('envia uma única vez por publicação e edição; nova versão avisa de novo', async () => {
    const r = await publicarComEmail();
    await rodar();
    await rodar(new Date(AGORA.getTime() + 3_600_000));
    expect(email.enviadas).toHaveLength(1);
    const editor = await como(p, EDITOR);
    await salvarPublicacao(p, editor, null, dados({ id: r.id, versao: 1, corpo: 'Texto novo.', tipoEdicao: 'pequena' }), COM_EMAIL);
    expect(await envios()).toHaveLength(1);
  });

  it('nova versão gera um novo aviso', async () => {
    const r = await publicarComEmail();
    const func = await como(p, FUNCIONARIO);
    const { darCiencia, publicacaoParaEditar } = await import('../aplicacao/publicacoes');
    await darCiencia(p, func, r.id, { agora: AGORA });
    await rodar();
    const editor = await como(p, EDITOR);
    const atual = await publicacaoParaEditar(p, editor, r.id);
    const nova = await salvarPublicacao(p, editor, null, dados({ id: r.id, versao: atual.versao, corpo: 'Texto novo.', tipoEdicao: 'nova' }), COM_EMAIL);
    expect(nova.aviso).toBe('agendado');
    await rodar();
    expect(email.enviadas).toHaveLength(2);
  });

  it('não avisa rascunho nem publicação sem exigência', async () => {
    const { categoriaPronta } = await import('./apoio');
    await categoriaPronta(p);
    const editor = await como(p, EDITOR);
    expect((await salvarPublicacao(p, editor, null, dados({ publicar: false }), COM_EMAIL)).aviso).toBe('nao_se_aplica');
    expect((await salvarPublicacao(p, editor, null, dados({ titulo: 'Livre', exigeCiencia: false }), COM_EMAIL)).aviso).toBe('nao_se_aplica');
    expect(await envios()).toHaveLength(0);
  });

  it('sem e-mail de envio, nada é agendado e o editor é avisado; a pendência continua', async () => {
    const r = await publicada(p);
    const { categoriaPronta } = await import('./apoio');
    await categoriaPronta(p, 'Outras');
    const outra = await salvarPublicacao(p, await como(p, EDITOR), null, dados({ titulo: 'Outra' }), { agora: AGORA });
    expect(outra.aviso).toBe('sem_remetente');
    expect(r.id).toBeTruthy();
    expect(await envios()).toHaveLength(0);
  });

  it('sem enviador na rotina, cancela o pendente', async () => {
    await publicarComEmail();
    await rodar(AGORA, { email: null as never, urlBase: URL });
    expect((await envios())[0].situacao).toBe('cancelado');
    expect(email.enviadas).toHaveLength(0);
  });

  it('falha: tenta até 3 vezes e depois marca falhou, com erro resumido', async () => {
    await publicarComEmail();
    email.falhar = 'O Google recusou.';
    expect(await rodar(AGORA)).toMatchObject({ falhas: 1 });
    expect(await rodar(new Date(AGORA.getTime() + 20 * 60_000))).toMatchObject({ falhas: 1 });
    expect(await rodar(new Date(AGORA.getTime() + 90 * 60_000))).toMatchObject({ esgotados: 1 });
    expect((await envios())[0]).toMatchObject({ situacao: 'falhou', tentativas: 3, erro: 'O Google recusou.' });
    expect(email.enviadas).toHaveLength(0);
  });

  it('cancela se a publicação foi arquivada antes do envio', async () => {
    const r = await publicarComEmail();
    const { mudarArquivamento, publicacaoParaEditar } = await import('../aplicacao/publicacoes');
    const editor = await como(p, EDITOR);
    await mudarArquivamento(p, editor, r.id, (await publicacaoParaEditar(p, editor, r.id)).versao, true, { agora: AGORA });
    expect(await rodar()).toMatchObject({ cancelados: 1, enviados: 0 });
  });

  it('só quem publica agenda; auditoria guarda colunas, sem endereços', async () => {
    await expect(salvarPublicacao(p, await como(p, FUNCIONARIO), null, dados(), COM_EMAIL)).rejects.toThrow(ErroPermissao);
    await publicarComEmail();
    await rodar();
    const id = (await envios())[0].id;
    const log = JSON.stringify(await auditoriaDe(p, id));
    expect(log).not.toContain('@exemplo.local,');
    expect(log).toContain('destinatarios');
    expect(log).not.toContain(FUNCIONARIO);
  });
});
