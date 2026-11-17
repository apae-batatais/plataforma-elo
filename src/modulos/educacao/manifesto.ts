/**
 * Manifesto do app Educação: avaliação de evolução dos atendidos do eixo, por período, com os três
 * instrumentos validados (Educação Infantil, Ensino Fundamental e Educação para o Trabalho).
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const TUDO = ['educacao.acessar', 'educacao.avaliar', 'educacao.ciente'];

export const manifesto = defineModulo({
  id: 'educacao',
  nome: 'Educação',
  descricao: 'Avaliação de evolução dos atendidos de Educação, por período, com total e subtotais por dimensão.',
  icone: 'educacao',
  schema: 'educacao',
  rota: '/educacao',
  permissaoAcesso: 'educacao.acessar',
  menu: [
    { rotulo: 'Avaliações', caminho: '/', permissao: 'educacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Nova avaliação', caminho: '/nova', permissao: 'educacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Sobre o instrumento', caminho: '/sobre', permissao: 'educacao.acessar', secao: 'Acompanhar' },
  ],
  permissoes: {
    'educacao.acessar': 'Entrar no app Educação',
    'educacao.avaliar': 'Aplicar, concluir, corrigir e abrir avaliações dos serviços de Educação do seu escopo (Diretoria: todos)',
    'educacao.ciente': 'Dar o ciente da coordenação técnica numa avaliação concluída dos serviços do seu escopo',
  },
  permissoesPorPerfil: {
    diretoria: TUDO,
    coordenacao_servico: TUDO,
    // O técnico avaliador (educador) aplica e conclui, mas não dá o ciente.
    tecnico_avaliador: ['educacao.acessar', 'educacao.avaliar'],
    // Conselho e demais leitores: só "Sobre o instrumento" nesta entrega (o painel vem na entrega 3).
    leitura: ['educacao.acessar'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: [],
});
