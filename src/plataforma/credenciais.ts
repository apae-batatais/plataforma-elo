/**
 * Tarefa da rotina que mantém as credenciais em dia (ADR-028): renova o token do Instagram quando faltam menos
 * de 15 dias. Devolve só contagens. Somente servidor.
 */
import 'server-only';
import { renovarCredencial } from '@/nucleo/credenciais/credenciais';
import type { TarefaDaRotina } from './tarefa-da-rotina';
import { provedorDeInstagram } from './instagram';
import { configGeral } from './instituicao';

export const tarefaDeCredenciais: TarefaDaRotina = {
  id: 'credenciais.instagram',
  async executar(app) {
    const provedor = provedorDeInstagram(configGeral());
    if (!provedor) return { sem_ligacao: 1 };
    const r = await renovarCredencial(app.planilhas, app.instituicao.codigo, 'instagram', async (token) => {
      const novo = await provedor.renovar(token);
      return { valor: novo.token, venceEm: novo.venceEm };
    });
    return r === 'nenhuma' ? {} : { [r]: 1 };
  },
};
