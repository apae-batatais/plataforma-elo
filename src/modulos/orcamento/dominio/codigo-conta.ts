/**
 * Código da conta contábil dos cadastros (grupos de gasto e fontes de recurso).
 * Texto livre vindo do sistema da contabilidade; o Elo não interpreta o formato.
 */
export const TAMANHO_MAXIMO_CODIGO = 30;

const PERMITIDO = /^[\p{L}\p{N}.\-/]+$/u;

export class ErroCodigoConta extends Error {}

/** Limpa espaços e valida. Vazio vira `null` (o código é opcional). */
export function limparCodigoConta(bruto: string | null | undefined): string | null {
  const t = (bruto ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.length > TAMANHO_MAXIMO_CODIGO) {
    throw new ErroCodigoConta(`O código da conta pode ter no máximo ${TAMANHO_MAXIMO_CODIGO} caracteres.`);
  }
  if (!PERMITIDO.test(t)) {
    throw new ErroCodigoConta('O código da conta aceita só letras, números, ponto, hífen e barra, sem espaços no meio.');
  }
  return t;
}

/** Chave para comparar códigos sem diferença de maiúscula ou espaço. */
export const chaveCodigoConta = (codigo: string | null | undefined): string => (codigo ?? '').replace(/\s+/g, '').toLowerCase();

/** Acha outro registro ativo que já usa o código. */
export function acharCodigoRepetido<T extends { id: string; nome: string; ativo: boolean; codigo_conta: string | null }>(
  lista: T[],
  codigo: string | null,
  ignorarId?: string,
): T | undefined {
  if (!codigo) return undefined;
  const k = chaveCodigoConta(codigo);
  return lista.find((x) => x.ativo && x.id !== ignorarId && chaveCodigoConta(x.codigo_conta) === k);
}

/** Protege contra fórmula executada ao abrir o CSV em planilha. */
export function celulaSegura(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

/** Monta um CSV (separador ponto e vírgula, BOM para acentos no Excel). Números entram puros. */
export function montarCsv(cabecalho: string[], linhas: (string | number | null)[][]): string {
  const celula = (v: string | number | null) => {
    if (v === null || v === '') return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const s = celulaSegura(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  return `﻿${corpo}\r\n`;
}
