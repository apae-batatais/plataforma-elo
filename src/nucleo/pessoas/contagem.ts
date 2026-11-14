/**
 * Contagem de atendidos por serviço e mês, a partir dos vínculos de serviço do Cadastro Único.
 * Devolve só números (sem nomes nem ids de pessoa); por isso não exige permissão de ver pessoas
 * (ADR-020). Quem chama é responsável por mostrar a contagem só a quem pode ver o serviço.
 */
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { VinculosServico } from '@/nucleo/estrutura/tabelas';
import { numeroAgregado, type NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';

const fimDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/**
 * Pessoas com vínculo ativo no serviço em algum dia do mês. O mês corrente conta até o dia da consulta.
 * @returns mapa serviço → mês → quantidade (todo serviço e mês pedidos aparecem, com 0 se não houver).
 */
export async function contarAtendidos(
  p: Planilhas,
  servicos: readonly string[],
  meses: readonly string[],
  hoje: string,
): Promise<Map<string, Map<string, number>>> {
  const vinculos = (await lerTabela(p, VinculosServico)).ativos();
  const r = new Map<string, Map<string, number>>();
  for (const s of servicos) {
    const doServico = vinculos.filter((v) => v.servico === s);
    const porMes = new Map<string, number>();
    for (const mes of meses) {
      const ini = `${mes}-01`;
      const fim = hoje.slice(0, 7) === mes ? hoje : fimDoMes(mes);
      const pessoas = new Set(doServico.filter((v) => (!v.entrada || v.entrada <= fim) && (!v.saida || v.saida >= ini)).map((v) => v.pessoa_id));
      porMes.set(mes, pessoas.size);
    }
    r.set(s, porMes);
  }
  return r;
}

/**
 * Pessoas com vínculo ativo hoje no serviço, já protegidas pelo mínimo de 5 pessoas (ADR-023).
 * Devolve só `valor`, `base` e `motivo`; a mesma contagem que Parcerias usa para a ocupação.
 */
export async function vinculosAtivosProtegido(p: Planilhas, servico: string, hoje: string): Promise<NumeroAgregado> {
  const n = (await contarAtendidos(p, [servico], [hoje.slice(0, 7)], hoje)).get(servico)?.get(hoje.slice(0, 7)) ?? 0;
  return numeroAgregado({ valor: n, base: n, tipo: 'contagem' });
}
