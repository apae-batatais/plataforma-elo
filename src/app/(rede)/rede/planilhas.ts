import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';

const NOMES: Record<string, string> = {
  nucleo: 'Núcleo',
  auditoria: 'Auditoria',
  orcamento: 'Orçamento',
  orcamento_folha: 'Folha de pagamento',
  requisicoes: 'Requisições',
};

/** As planilhas que cada instituição cria no próprio Drive: as do Núcleo e as dos apps ativos. */
export const PLANILHAS_DA_INSTITUICAO = ['nucleo', 'auditoria', ...new Set((ESTRUTURA_DOS_MODULOS.tabelas ?? []).map((t) => t.planilha))].map((chave) => ({
  chave,
  nome: NOMES[chave] ?? chave,
  obrigatoria: chave === 'nucleo' || chave === 'auditoria',
}));
