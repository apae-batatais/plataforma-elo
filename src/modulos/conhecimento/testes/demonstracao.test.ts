import { describe, expect, it } from 'vitest';
import { listarAcompanhamento, listarBiblioteca, meusDocumentos, pendenciasDaPessoa } from '../aplicacao/publicacoes';
import { popularConhecimentoFicticio } from '../dados/ficticios';
import { como, COZINHA, DIRETORIA, EDITOR, FUNCIONARIO, planilhasDeConhecimento } from './apoio';

describe('demonstração fictícia', () => {
  it('cada perfil vê o que deve, e popular duas vezes não duplica', async () => {
    const p = await planilhasDeConhecimento();
    await popularConhecimentoFicticio(p);
    await popularConhecimentoFicticio(p);
    const func = await como(p, FUNCIONARIO);
    expect((await listarBiblioteca(p, func)).filter((x) => x.doPublico).map((x) => x.titulo).sort()).toEqual([
      'Código de conduta da instituição',
      'Guia de boas-vindas (sem exigência)',
      'Horário de funcionamento no recesso de fim de ano',
    ]);
    expect((await pendenciasDaPessoa(p, func)).total).toBe(1);
    expect((await pendenciasDaPessoa(p, await como(p, COZINHA))).itens.map((x) => x.titulo)).toContain('Horário de funcionamento no recesso de fim de ano');
    expect((await meusDocumentos(p, func)).map((x) => x.titulo)).toContain('Calendário de vacinação 2025 (arquivado)');
    expect((await meusDocumentos(p, await como(p, DIRETORIA))).map((x) => x.titulo)).not.toContain('Calendário de vacinação 2025 (arquivado)');
    expect((await listarAcompanhamento(p, await como(p, EDITOR))).length).toBe(5);
  });
});
