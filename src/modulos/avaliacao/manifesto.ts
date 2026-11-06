/**
 * Manifesto do módulo Avaliação Diagnóstica — entrega 1: questionário
 * diagnóstico da Assistência Social (com salvamento) e painel por serviço atual.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const TUDO = ['avaliacao.acessar', 'avaliacao.avaliar', 'avaliacao.painel'];

export const manifesto = defineModulo({
  id: 'avaliacao',
  nome: 'Avaliação Diagnóstica',
  descricao: 'Questionário diagnóstico das pessoas atendidas e painel de indicadores por serviço.',
  icone: 'stethoscope',
  schema: 'avaliacao',
  rota: '/avaliacao',
  permissaoAcesso: 'avaliacao.acessar',
  menu: [
    { rotulo: 'Avaliações', caminho: '/', permissao: 'avaliacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Nova avaliação', caminho: '/nova', permissao: 'avaliacao.avaliar', secao: 'Avaliar' },
    { rotulo: 'Painel', caminho: '/painel', permissao: 'avaliacao.painel', secao: 'Acompanhar' },
  ],
  permissoes: {
    'avaliacao.acessar': 'Entrar no módulo Avaliação Diagnóstica',
    'avaliacao.avaliar': 'Aplicar, abrir e corrigir avaliações dos serviços do seu escopo (Diretoria: todos)',
    'avaliacao.painel': 'Ver o painel com os números agregados das avaliações dos serviços do seu escopo (sem identificar pessoas)',
  },
  permissoesPorPerfil: {
    diretoria: TUDO,
    coordenacao_servico: TUDO,
    tecnico_avaliador: TUDO,
    // Conselho e demais leitores: só os números agregados.
    leitura: ['avaliacao.acessar', 'avaliacao.painel'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['avaliacao_indice_medio_cuidado'],
});
