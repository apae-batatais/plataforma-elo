/**
 * Armazenamento em memória: usado na demonstração (dados fictícios) e nos testes.
 * Comporta-se como as planilhas: abas com linhas, sem regras.
 */
import { ErroArmazenamento, type Armazenamento, type Linha } from './armazenamento';

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
    if (!linhas) throw new ErroArmazenamento(`A planilha "${planilha}" não tem a aba "${aba}".`);
    return linhas;
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

  async garantirAba(planilha: string, aba: string, cabecalho: readonly string[]) {
    const p = this.planilha(planilha);
    const existente = p.get(aba);
    if (existente && existente.length > 0) return 'ja_existia' as const;
    p.set(aba, [[...cabecalho]]);
    return 'criada' as const;
  }
}
