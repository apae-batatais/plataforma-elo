import { describe, expect, it } from 'vitest';
import { appDoCaminho } from '@/ui/cor-do-app';

describe('cor do app pelo endereço', () => {
  it('usa o primeiro trecho do caminho', () => {
    expect(appDoCaminho('/orcamento')).toBe('orcamento');
    expect(appDoCaminho('/orcamento/previsao/geral')).toBe('orcamento');
    expect(appDoCaminho('/requisicoes?aba=minhas')).toBe('requisicoes');
  });

  it('fora dos apps não há app (destaque ardósia)', () => {
    expect(appDoCaminho('/')).toBeUndefined();
    expect(appDoCaminho('')).toBeUndefined();
  });
});
