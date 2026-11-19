import { describe, expect, it } from 'vitest';
import { ArquivosMemoria } from '@/nucleo/armazenamento/arquivos';
import { ErroFaixaInvalida, lerTrechoDeAnexo, TRECHO_MAXIMO } from '@/nucleo/armazenamento/leitura-de-anexo';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { planilhasDeTeste } from '../apoio/planilhas-teste';

async function cenario(tamanho = 1000) {
  const p = await planilhasDeTeste();
  const arquivos = new ArquivosMemoria();
  const { url } = await arquivos.iniciarEnvio({ nome: 'a.pdf', tipo: 'application/pdf', tamanho, origem: 'x' });
  const guardado = arquivos.receber(url.split('/').pop()!, new Uint8Array(tamanho));
  const anexo = { id: 'anx-1', arquivo_id: guardado.id, tamanho, mime: 'application/pdf' };
  const ler = (inicio: number, fim: number | null) => lerTrechoDeAnexo(p, arquivos, anexo, { inicio, fim }, { usuario: 'a@exemplo.local', entidade: 'X' });
  const leituras = async () => (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.acao === 'leitura');
  return { ler, leituras };
}

describe('leitura de anexo (ADR-033)', () => {
  it('grava leitura com a faixa, comece onde começar', async () => {
    const { ler, leituras } = await cenario();
    await ler(0, null);
    await ler(1, null);
    await ler(100, 199);
    const l = await leituras();
    expect(l.map((x) => x.detalhes)).toEqual([{ faixa: '0-999' }, { faixa: '1-999' }, { faixa: '100-199' }].map((d) => JSON.stringify(d)));
    expect(l.every((x) => x.usuario === 'a@exemplo.local' && x.registro_id === 'anx-1')).toBe(true);
  });

  it('faixa inválida: erro, sem ler e sem auditoria', async () => {
    const { ler, leituras } = await cenario();
    for (const [i, f] of [[1000, null], [5000, null], [10, 5], [-1, null]] as const) await expect(ler(i, f)).rejects.toBeInstanceOf(ErroFaixaInvalida);
    expect(await leituras()).toHaveLength(0);
  });

  it('limita o trecho e o fim ao tamanho do arquivo', async () => {
    const { ler } = await cenario(TRECHO_MAXIMO);
    expect((await ler(0, null)).dados.length).toBe(TRECHO_MAXIMO);
    expect((await ler(5, 999_999_999)).fim).toBe(TRECHO_MAXIMO - 1);
  });
});
