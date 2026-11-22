/** Ligações do projeto com outros apps (regras 26 e 27). Só texto e identificadores; nenhum cadastro é repetido. */
export const APPS_LIGACAO = ['parcerias', 'orcamento', 'requisicoes', 'avaliacao', 'comunicacao', 'termo', 'fonte_receita', 'requisicao', 'pedido_comunicacao'] as const;
export type AppLigacao = (typeof APPS_LIGACAO)[number];

export const NOME_APP_LIGACAO: Record<AppLigacao, string> = {
  parcerias: 'Parcerias',
  orcamento: 'Orçamento',
  requisicoes: 'Requisições',
  avaliacao: 'Avaliação',
  comunicacao: 'Comunicação',
  termo: 'Termo de parceria',
  fonte_receita: 'Fonte de receita',
  requisicao: 'Requisição',
  pedido_comunicacao: 'Pedido de divulgação',
};

/** Módulo da plataforma que guarda o dado de cada tipo de ligação. */
export const MODULO_DA_LIGACAO: Record<AppLigacao, string> = {
  parcerias: 'parcerias',
  orcamento: 'orcamento',
  requisicoes: 'requisicoes',
  avaliacao: 'avaliacao',
  comunicacao: 'comunicacao',
  termo: 'parcerias',
  fonte_receita: 'orcamento',
  requisicao: 'requisicoes',
  pedido_comunicacao: 'comunicacao',
};
