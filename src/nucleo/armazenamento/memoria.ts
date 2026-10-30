/**
 * Armazenamento em memória: usado na demonstração (dados fictícios) e nos testes.
 * Comporta-se como as planilhas: abas com linhas, sem regras.
 */
import { ErroArmazenamento, ErroEstruturaAusente, type Armazenamento, type Linha } from './armazenamento';

export class ArmazenamentoMemoria implements Armazenamento {
  private readonly planilhas = new Map<string, Map<string, Linha[]>>();

  constructor(planilhasConhecidas: readonly string[]) {
    for (const p of planilhasConhecidas) this.planilhas.set(p, new Map());
  }

  private planilha(id: string) {
    const p = this.planilhas.get(id);
    if (!p) throw new ErroArmazenamento(`Planilha "${id}" não encontrada ou sem acesso.`);
    return p;
  }

  private aba(planilha: string, aba: string) {
    const linhas = this.planilha(planilha).get(aba);
    if (!linhas) throw new ErroEstruturaAusente(`A planilha "${planilha}" não tem a aba "${aba}".`);
    return linhas;
  }

  async listarAbas(planilha: string) {
    return [...this.planilha(planilha).keys()];
  }

  async lerAbas(planilha: string, abas: readonly string[]) {
    const resultado: Record<string, Linha[]> = {};
    for (const a of abas) resultado[a] = this.aba(planilha, a).map((l) => [...l]);
    return resultado;
  }

  async acrescentar(planilha: string, aba: string, linhas: Linha[]) {
    this.aba(planilha, aba).push(...linhas.map((l) => [...l]));
  }

  async gravarLinha(planilha: string, aba: string, numero: number, valores: Linha) {
    const linhas = this.aba(planilha, aba);
    if (numero < 2 || numero > linhas.length) {
      throw new ErroArmazenamento(`Linha ${numero} não existe na aba "${aba}".`);
    }
    linhas[numero - 1] = [...valores];
  }

  async garantirAbas(planilha: string, abas: readonly { aba: string; cabecalho: readonly string[] }[]) {
    const p = this.planilha(planilha);
    const criadas: string[] = [];
    for (const { aba, cabecalho } of abas) {
      const existente = p.get(aba);
      if (existente && existente.length > 0) {
        const faltam = cabecalho.filter((c) => !existente[0].includes(c));
        if (faltam.length) {
          existente[0] = [...existente[0], ...faltam];
          criadas.push(`${aba} (colunas novas: ${faltam.join(', ')})`);
        }
        continue;
      }
      p.set(aba, [[...cabecalho]]);
      criadas.push(aba);
    }
    return criadas;
  }

  /** Atalho para uma aba só (usado nos testes). */
  async garantirAba(planilha: string, aba: string, cabecalho: readonly string[]) {
    return (await this.garantirAbas(planilha, [{ aba, cabecalho }])).length ? ('criada' as const) : ('ja_existia' as const);
  }
}
