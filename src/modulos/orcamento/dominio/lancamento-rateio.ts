/**
 * Lançamento de despesa por rateio (#225, ADR-038): divide cada mês do lançamento entre os serviços
 * participantes da Regra de rateio. Regras puras: nada aqui lê ou grava dados.
 */
import { arred } from './previsao';

/**
 * `dividirMes` recebe o valor de um mês e devolve quanto cai em cada serviço (a regra do R1).
 * Os pesos são os mesmos em todos os meses (as bases não variam por mês) e cada mês fecha em centavos.
 * Serviço cujo total no ano é zero não recebe despesa.
 */
export function ratearMeses(meses: number[], dividirMes: (valor: number) => Map<string, number>): Map<string, number[]> {
  const saida = new Map<string, number[]>();
  meses.forEach((valor, i) => {
    if (!(valor > 0)) return;
    for (const [servico, parte] of dividirMes(valor)) {
      const lista = saida.get(servico) ?? (Array(12).fill(0) as number[]);
      lista[i] = arred(lista[i] + parte);
      saida.set(servico, lista);
    }
  });
  for (const [servico, lista] of [...saida]) if (!(lista.reduce((s, v) => s + v, 0) > 0)) saida.delete(servico);
  return saida;
}

/** Total de uma lista de meses, em centavos exatos. */
export const totalDosMeses = (meses: number[]) => arred(meses.reduce((s, v) => s + v, 0));
