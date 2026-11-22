/**
 * Manifesto do módulo Saúde: avaliação de evolução das pessoas atendidas no CER,
 * por período, com o instrumento validado e o motor de avaliação compartilhado.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const AVALIAR = ['saude.acessar', 'saude.avaliar', 'saude.painel'];

export const manifesto = defineModulo({
  id: 'saude',
  nome: 'Saúde',
  descricao: 'Avaliação de evolução das pessoas atendidas no CER, período a período.',
  icone: 'stethoscope',
  familia: 'avaliacoes',
  schema: 'saude',
  rota: '/saude',
  permissaoAcesso: 'saude.acessar',
  menu: [
    { rotulo: 'Avaliações', caminho: '/', permissao: 'saude.avaliar', secao: 'Avaliar' },
    { rotulo: 'Nova avaliação', caminho: '/nova', permissao: 'saude.avaliar', secao: 'Avaliar' },
    { rotulo: 'Painel', caminho: '/painel', permissao: 'saude.painel', secao: 'Acompanhar' },
    { rotulo: 'Sobre o instrumento', caminho: '/sobre', permissao: 'saude.acessar', secao: 'Acompanhar' },
  ],
  permissoes: {
    'saude.acessar': 'Entrar no módulo Saúde',
    'saude.avaliar': 'Aplicar, fechar, corrigir e abrir avaliações dos serviços de Saúde do seu escopo (Diretoria: todos)',
    'saude.painel': 'Ver os números agregados das avaliações de Saúde do seu escopo (sem identificar pessoas)',
    'saude.ciente': 'Dar o "ciente" da coordenação técnica numa avaliação concluída',
  },
  permissoesPorPerfil: {
    diretoria: [...AVALIAR, 'saude.ciente'],
    coordenacao_servico: [...AVALIAR, 'saude.ciente'],
    tecnico_avaliador: AVALIAR,
    // Conselho e demais leitores: só os números agregados.
    leitura: ['saude.acessar', 'saude.painel'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['saude_total_medio', 'saude_pct_evoluindo'],
});
