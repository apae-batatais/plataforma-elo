/**
 * Ajuste pedido pela Diretoria (27/10/2026): unidades passam a ser só
 * "Apae Batatais (Sede)" e "Apae Rural (Filial)". Em planilhas já preparadas,
 * "Preparar estrutura" renomeia e desativa o CER, sem apagar nada.
 */
import { describe, expect, it } from 'vitest';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, inserir, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Servicos, Unidades } from '@/nucleo/estrutura/tabelas';

async function planilhasAntigas(): Promise<Planilhas> {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria']), idDe: (c) => c };
  await prepararEstrutura(p);
  return p;
}

describe('ajuste das unidades', () => {
  it('renomeia as unidades antigas e desativa o CER sem serviço; roda uma vez só', async () => {
    const p = await planilhasAntigas();
    // Volta ao estado das planilhas preparadas antes do ajuste.
    const atuais = (await lerTabela(p, Unidades)).todos();
    await atualizar(p, Unidades, atuais.find((u) => u.codigo === 'sede')!.id, 1, { nome: 'Sede' }, { email: 'teste' });
    await atualizar(p, Unidades, atuais.find((u) => u.codigo === 'rural')!.id, 1, { nome: 'Apae Rural'.toUpperCase() } // grafia antiga, em maiúsculas, { email: 'teste' });
    await inserir(p, Unidades, { codigo: 'cer', nome: 'CER' }, { email: 'teste' });

    const r = await prepararEstrutura(p);
    expect(r.ajustes).toHaveLength(3);
    const unidades = await lerTabela(p, Unidades);
    expect(unidades.ativos().map((u) => u.nome).sort()).toEqual(['Apae Batatais (Sede)', 'Apae Rural (Filial)']);
    expect(unidades.todos()).toHaveLength(3); // o CER continua lá, desativado

    expect((await prepararEstrutura(p)).ajustes).toEqual([]);
  });

  it('não desativa o CER se algum serviço ainda usa essa unidade', async () => {
    const p = await planilhasAntigas();
    await inserir(p, Unidades, { codigo: 'cer', nome: 'CER' }, { email: 'teste' });
    await inserir(p, Servicos, { codigo: 'reab', nome: 'Reabilitação', unidade: 'cer', area: 'saude' }, { email: 'teste' });
    expect((await prepararEstrutura(p)).ajustes).toEqual([]);
    expect((await lerTabela(p, Unidades)).ativos().some((u) => u.codigo === 'cer')).toBe(true);
  });

  it('nome personalizado pela Diretoria não é sobrescrito', async () => {
    const p = await planilhasAntigas();
    const sede = (await lerTabela(p, Unidades)).todos().find((u) => u.codigo === 'sede')!;
    await atualizar(p, Unidades, sede.id, sede.versao, { nome: 'Sede Central' }, { email: 'teste' });
    expect((await prepararEstrutura(p)).ajustes).toEqual([]);
  });
});
