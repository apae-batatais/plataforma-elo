/**
 * Manifesto do app Educação: avaliação de evolução dos atendidos do eixo, por período, com os três
 * instrumentos validados (Educação Infantil, Ensino Fundamental e Educação para o Trabalho).
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const AVALIAR = ['educacao.acessar', 'educacao.avaliar', 'educacao.painel'];

export const manifesto = defineModulo({
  id: 'educacao',
  nome: 'Educação',
  descricao: 'Avaliação de evolução dos atendidos de Educação, por período, com total e subtotais por dimensão.',
  icone: 'educacao',
  familia: 'avaliacoes',
  schema: 'educacao',
  rota: '/educacao',
  permissaoAcesso: 'educacao.acessar',
  menu: [
    { rotulo: 'Avaliações', caminho: '/', permissao: 'educacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Nova avaliação', caminho: '/nova', permissao: 'educacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Instrumentos', caminho: '/instrumentos', permissao: 'educacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Painel', caminho: '/painel', permissao: 'educacao.painel', secao: 'Acompanhar' },
    { rotulo: 'Sobre o instrumento', caminho: '/sobre', permissao: 'educacao.acessar', secao: 'Acompanhar' },
  ],
  permissoes: {
    'educacao.acessar': 'Entrar no app Educação',
    'educacao.avaliar': 'Aplicar, concluir, corrigir e abrir avaliações dos serviços de Educação do seu escopo (Diretoria: todos)',
    'educacao.painel': 'Ver os números agregados das avaliações de Educação do seu escopo (sem identificar pessoas)',
    'educacao.ciente': 'Dar o ciente da coordenação técnica numa avaliação concluída dos serviços do seu escopo',
  },
  permissoesPorPerfil: {
    diretoria: [...AVALIAR, 'educacao.ciente'],
    coordenacao_servico: [...AVALIAR, 'educacao.ciente'],
    // O técnico avaliador (educador) aplica e conclui, mas não dá o ciente.
    tecnico_avaliador: AVALIAR,
    // Conselho e demais leitores: só os números agregados e "Sobre o instrumento".
    leitura: ['educacao.acessar', 'educacao.painel'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['educacao_total_medio', 'educacao_pct_evoluindo'],
});
