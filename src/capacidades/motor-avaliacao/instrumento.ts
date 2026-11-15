/**
 * Instrumento de avaliação: domínios, itens, escala e faixas de enquadramento.
 * Código puro (sem planilha, tela ou permissão). Serve aos três eixos
 * (Assistência Social, Educação e Saúde/CER); ADR-006, ADR-007 e ADR-026.
 */
import { z } from 'zod';

/** Escala única de 0 a 3 (decisão da Diretoria, issue #62). */
export const VALOR_MINIMO = 0;
export const VALOR_MAXIMO = 3;

export const esquemaItem = z.object({
  /** Número do item dentro do instrumento (1, 2, 3...). */
  numero: z.number().int().positive(),
  texto: z.string().trim().min(1),
  /** Código do domínio (ou dimensão) ao qual o item pertence. */
  dominio: z.string().trim().min(1),
  /** Etiqueta opcional do item, por exemplo o código da CIF. Não entra no cálculo. */
  etiqueta: z.string().trim().min(1).optional(),
  /** Se verdadeiro, o item aceita "não se aplica" e sai do cálculo. */
  permiteNaoSeAplica: z.boolean().default(false),
});

export const esquemaDominio = z.object({
  codigo: z.string().trim().min(1),
  nome: z.string().trim().min(1),
});

export const esquemaFaixa = z.object({
  /** Nome da classificação resultante (o "enquadramento"). */
  nome: z.string().trim().min(1),
  /** Limites incluídos. */
  de: z.number().int().min(0),
  ate: z.number().int().min(0),
});

export const esquemaInstrumento = z
  .object({
    codigo: z.string().trim().min(1),
    versao: z.number().int().positive(),
    /** Eixo que usa o instrumento: assistencia, educacao ou saude. */
    eixo: z.enum(['assistencia', 'educacao', 'saude']),
    nome: z.string().trim().min(1),
    dominios: z.array(esquemaDominio).min(1),
    itens: z.array(esquemaItem).min(1),
    faixas: z.array(esquemaFaixa).min(1),
  })
  .superRefine((inst, ctx) => {
    const problema = (message: string) => ctx.addIssue({ code: 'custom', message });
    const codigos = new Set(inst.dominios.map((d) => d.codigo));
    if (codigos.size !== inst.dominios.length) problema('Há domínios com o mesmo código.');
    const numeros = new Set(inst.itens.map((i) => i.numero));
    if (numeros.size !== inst.itens.length) problema('Há itens com o mesmo número.');
    for (const item of inst.itens) {
      if (!codigos.has(item.dominio)) problema(`O item ${item.numero} usa um domínio que não existe.`);
    }
    for (const dominio of inst.dominios) {
      if (!inst.itens.some((i) => i.dominio === dominio.codigo)) problema(`O domínio ${dominio.codigo} não tem itens.`);
    }
    const maximo = inst.itens.length * VALOR_MAXIMO;
    const ordenadas = [...inst.faixas].sort((a, b) => a.de - b.de);
    ordenadas.forEach((f, i) => {
      if (f.ate < f.de) problema(`A faixa "${f.nome}" termina antes de começar.`);
      if (i === 0 && f.de !== 0) problema('As faixas precisam começar em 0.');
      if (i > 0 && f.de !== ordenadas[i - 1]!.ate + 1) problema('As faixas não podem ter vazio nem sobreposição.');
    });
    if (ordenadas[ordenadas.length - 1]!.ate !== maximo) problema(`As faixas precisam terminar em ${maximo}, o total máximo.`);
  });

export type Item = z.infer<typeof esquemaItem>;
export type Dominio = z.infer<typeof esquemaDominio>;
export type Faixa = z.infer<typeof esquemaFaixa>;
export type Instrumento = z.infer<typeof esquemaInstrumento>;
export type EntradaInstrumento = z.input<typeof esquemaInstrumento>;

/** Valida e normaliza um instrumento; lança erro em português se a definição for inconsistente. */
export function definirInstrumento(entrada: EntradaInstrumento): Instrumento {
  const r = esquemaInstrumento.safeParse(entrada);
  if (!r.success) throw new Error(`Instrumento inválido: ${r.error.issues.map((i) => i.message).join(' ')}`);
  return r.data;
}

/**
 * Regra 1 da especificação: depois da primeira aplicação o instrumento não muda;
 * qualquer alteração cria nova versão. Devolve o motivo da recusa ou null se pode salvar.
 */
export function recusaDeAlteracao(atual: Instrumento, proposto: Instrumento, jaFoiUsado: boolean): string | null {
  if (atual.codigo !== proposto.codigo) return 'O código do instrumento não pode mudar.';
  if (proposto.versao < atual.versao) return 'A versão não pode diminuir.';
  if (proposto.versao === atual.versao) {
    if (jaFoiUsado && JSON.stringify(atual) !== JSON.stringify(proposto)) {
      return 'Este instrumento já foi usado; para alterar, crie uma nova versão.';
    }
    return null;
  }
  if (proposto.versao !== atual.versao + 1) return 'A nova versão deve ser a seguinte à atual.';
  return null;
}
