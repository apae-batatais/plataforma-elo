import { describe, expect, it } from 'vitest';
import { cumprimento } from '@/ui/saudacao';

describe('cumprimento da tela inicial', () => {
  it('usa o primeiro nome quando o usuário é uma pessoa', () => {
    expect(cumprimento('Bom dia', 'Maria Aparecida Souza')).toBe('Bom dia, Maria');
    expect(cumprimento('Boa tarde', 'João (fictício)')).toBe('Boa tarde, João');
  });
  it('não trata setor ou órgão como pessoa', () => {
    for (const nome of ['Diretoria (fictícia)', 'Setor de Compras (fictício)', 'Financeiro (fictício)', 'Coordenação UR (fictícia)',
      'Departamento Pessoal', 'Conselho, somente leitura (fictício)', 'Administração da Plataforma', 'Técnico CER']) {
      expect(cumprimento('Bom dia', nome)).toBe('Bom dia');
    }
  });
  it('sem nome ou com e-mail no lugar do nome, só o cumprimento', () => {
    expect(cumprimento('Boa noite', '')).toBe('Boa noite');
    expect(cumprimento('Boa noite', 'alguem@exemplo.local')).toBe('Boa noite');
  });
});
