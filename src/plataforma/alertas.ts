/**
 * Números que aparecem no menu ao lado de cada app (ex.: Requisições "3"):
 * o que espera por esta pessoa. Guardados por 1 minuto, por pessoa e
 * instituição, para não ler as planilhas a cada página.
 */
import 'server-only';
import { contadorDeAvisosDeCessao } from '@/modulos/orcamento/aplicacao/cedidos';
import { contadoresComunicacao } from '@/modulos/comunicacao/aplicacao/pedidos';
import { contadoresRequisicoes } from '@/modulos/requisicoes/aplicacao/requisicoes';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from './aplicacao';

const guardados = new Map<string, { em: number; valor: Promise<Record<string, string>> }>();

export async function alertasDoMenu(autorizador: Autorizador): Promise<Record<string, string>> {
  const app = await obterAplicacao();
  const chave = `${app.instituicao.codigo}|${autorizador.email}`;
  const atual = guardados.get(chave);
  if (atual && Date.now() - atual.em <= 60_000) return atual.valor;
  const valor = (async () => {
    const r: Record<string, string> = {};
    if (autorizador.temPermissaoAlgumEscopo('requisicoes.acessar')) {
      try {
        const c = await contadoresRequisicoes(app.planilhas, autorizador);
        const n = c.aprovar + c.atender + c.devolvidas;
        if (n > 0) r['/requisicoes'] = String(n);
      } catch {
        // Planilha das Requisições ainda não configurada: a página do app explica.
      }
    }
    if (autorizador.temPermissaoAlgumEscopo('comunicacao.acessar')) {
      try {
        const c = await contadoresComunicacao(app.planilhas, autorizador);
        const n = c.devolvidos + c.revisar + c.aprovar;
        if (n > 0) r['/comunicacao'] = String(n);
      } catch {
        // Planilha da Comunicação ainda não configurada: a página do app explica.
      }
    }
    if (autorizador.temPermissaoAlgumEscopo('orcamento.folha.ver')) {
      try {
        const n = await contadorDeAvisosDeCessao(app.planilhas, autorizador);
        if (n > 0) r['/orcamento'] = String(n);
      } catch {
        // Abas dos cedidos ainda não preparadas: a página do app explica.
      }
    }
    return r;
  })();
  guardados.set(chave, { em: Date.now(), valor });
  return valor;
}

/** Depois de uma ação que muda as filas, o número volta a ser calculado. */
export function esquecerAlertas() {
  guardados.clear();
}
