import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';

const NOMES: Record<string, string> = {
  nucleo: 'Núcleo',
  auditoria: 'Auditoria',
  orcamento: 'Orçamento',
  orcamento_folha: 'Folha de pagamento',
  orcamento_execucao: 'Orçamento — execução e tesouraria',
  parcerias: 'Parcerias',
  requisicoes: 'Requisições',
  avaliacao_assistencia: 'Assistência Social',
  avaliacao_saude: 'Avaliação de Saúde',
  avaliacao_educacao: 'Educação (avaliações)',
  comunicacao: 'Comunicação',
  conhecimento: 'Base de Conhecimento',
  projetos: 'Projetos',
  anexos: 'Pasta de anexos (fotos e vídeos)',
};

/** As planilhas que cada instituição cria no próprio Drive: as do Núcleo e as dos apps ativos. */
export const PLANILHAS_DA_INSTITUICAO = ['nucleo', 'auditoria', ...new Set((ESTRUTURA_DOS_MODULOS.tabelas ?? []).map((t) => t.planilha)), 'anexos'].map((chave) => ({
  chave,
  nome: NOMES[chave] ?? chave,
  obrigatoria: chave === 'nucleo' || chave === 'auditoria',
}));
