import { definirInstrumento } from '../instrumento';

/** Instrumento fictício (escala 0 a 3) só para teste; não é um instrumento real. */
export function instrumentoFicticio(versao = 1) {
  return definirInstrumento({
    codigo: 'ficticio',
    versao,
    eixo: 'assistencia',
    nome: 'Instrumento fictício',
    dominios: [
      { codigo: 'A', nome: 'Domínio A' },
      { codigo: 'B', nome: 'Domínio B' },
    ],
    itens: [
      { numero: 1, texto: 'Item 1', dominio: 'A', etiqueta: 'd1' },
      { numero: 2, texto: 'Item 2', dominio: 'A' },
      { numero: 3, texto: 'Item 3', dominio: 'B', permiteNaoSeAplica: true },
      { numero: 4, texto: 'Item 4', dominio: 'B' },
    ],
    faixas: [
      { nome: 'Baixa', de: 0, ate: 4 },
      { nome: 'Média', de: 5, ate: 8 },
      { nome: 'Alta', de: 9, ate: 12 },
    ],
  });
}
