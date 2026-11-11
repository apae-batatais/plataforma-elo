/** Manifesto do módulo Parcerias (termos de parceria, fontes, aportes, metas e ocupação). */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const VER = ['parcerias.acessar', 'parcerias.termos.ver'];

export const manifesto = defineModulo({
  id: 'parcerias',
  nome: 'Parcerias',
  descricao: 'Termos de parceria: fontes de recurso, cronograma de desembolso, aportes, metas e ocupação das vagas.',
  icone: 'handshake',
  schema: 'parcerias',
  rota: '/parcerias',
  permissaoAcesso: 'parcerias.acessar',
  menu: [
    { rotulo: 'Termos', caminho: '/', permissao: 'parcerias.termos.ver' },
    { rotulo: 'Novo termo', caminho: '/novo', permissao: 'parcerias.termos.editar' },
  ],
  permissoes: {
    'parcerias.acessar': 'Entrar no módulo Parcerias',
    'parcerias.termos.ver': 'Ver os termos de parceria (coordenação: só os que atendem serviços do seu escopo)',
    'parcerias.termos.editar': 'Cadastrar e alterar termos, fontes, aportes, equipe e metas',
  },
  perfis: [],
  permissoesPorPerfil: {
    administrador_plataforma: ['parcerias.acessar'],
    diretoria: VER,
    financeiro: [...VER, 'parcerias.termos.editar'],
    coordenacao_servico: VER,
    leitura: VER,
  },
  eventos: { publica: [], consome: [] },
  indicadores: [],
});
