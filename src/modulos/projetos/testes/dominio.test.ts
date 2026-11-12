import { describe, expect, it } from 'vitest';
import { CONFIG_PADRAO, destinoDaDecisao, exigeAlcada, lerEmails, parecerExigeTexto, pareceresExigidos, pareceresFaltando, podeDecidirPorta, proximoCodigo } from '../dominio/projeto';

describe('domínio de Projetos', () => {
  it('código sequencial nunca reaproveita o maior já usado', () => {
    expect(proximoCodigo([])).toBe('PRJ-0001');
    expect(proximoCodigo(['PRJ-0001', 'PRJ-0007', 'outro'])).toBe('PRJ-0008');
  });

  it('alçada: só passa do limite se o valor for maior; sem limite nunca exige', () => {
    expect(exigeAlcada(100, 100)).toBe(false);
    expect(exigeAlcada(101, 100)).toBe(true);
    expect(exigeAlcada(1e9, null)).toBe(false);
  });

  it('pareceres exigidos por porte (padrão) e o que falta', () => {
    expect(pareceresExigidos(CONFIG_PADRAO, 'completo')).toEqual(['tecnico', 'financeiro', 'juridico']);
    expect(pareceresExigidos(CONFIG_PADRAO, 'enxuto')).toEqual(['tecnico']);
    expect(pareceresFaltando(['tecnico', 'financeiro'], ['tecnico'])).toEqual(['financeiro']);
  });

  it('ressalvas e insatisfatório exigem texto', () => {
    expect(parecerExigeTexto('satisfatorio')).toBe(false);
    expect(parecerExigeTexto('com_ressalvas')).toBe(true);
    expect(parecerExigeTexto('insatisfatorio')).toBe(true);
  });

  it('quem propôs não decide a própria porta, salvo configuração', () => {
    expect(podeDecidirPorta('a@x.org', 'A@x.org', CONFIG_PADRAO)).toBe(false);
    expect(podeDecidirPorta('a@x.org', 'b@x.org', CONFIG_PADRAO)).toBe(true);
    expect(podeDecidirPorta('a@x.org', 'a@x.org', { ...CONFIG_PADRAO, proponenteDecide: true })).toBe(true);
  });

  it('destino da decisão: alçada sobe só no seguir da Diretoria', () => {
    expect(destinoDaDecisao('diretoria', 'seguir', true)).toEqual({ situacaoPorta: 'aguardando_alcada', etapa: null });
    expect(destinoDaDecisao('diretoria', 'seguir', false)).toEqual({ situacaoPorta: 'decidida', etapa: 'fase_1' });
    expect(destinoDaDecisao('diretoria', 'ajustar', true)).toEqual({ situacaoPorta: 'decidida', etapa: 'ideia' });
    expect(destinoDaDecisao('diretoria', 'parar', true)).toEqual({ situacaoPorta: 'decidida', etapa: 'parado' });
    expect(destinoDaDecisao('alcada', 'seguir', true)).toEqual({ situacaoPorta: 'decidida', etapa: 'fase_1' });
  });

  it('lê e-mails separados por vírgula ou linha e recusa o inválido', () => {
    expect(lerEmails('A@x.org, b@x.org;\nA@x.org')).toEqual(['a@x.org', 'b@x.org']);
    expect(() => lerEmails('sem-arroba')).toThrow(/e-mail/);
  });
});
