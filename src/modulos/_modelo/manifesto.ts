/**
 * MODELO de manifesto. Para criar um módulo:
 * 1. Copie a pasta `src/modulos/_modelo` para `src/modulos/<id-do-modulo>`.
 * 2. Ajuste este manifesto (id, schema, rota, permissões, eventos).
 * 3. Preencha `especificacao.md` e `CLAUDE.md` e peça aprovação da Diretoria.
 * 4. Registre o manifesto em `src/plataforma/registro-modulos.ts`.
 *
 * Este modelo não está registrado e não aparece no portal.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

export const manifesto = defineModulo({
  id: 'modelo',
  nome: 'Modelo de módulo',
  descricao: 'Copie esta pasta para começar um app novo.',
  icone: 'box',
  schema: 'modelo',
  rota: '/modelo',
  permissaoAcesso: 'modelo.painel.ver',
  menu: [{ rotulo: 'Início', caminho: '/', permissao: 'modelo.painel.ver' }],
  permissoes: {
    'modelo.painel.ver': 'Ver o painel do módulo',
  },
  eventos: { publica: [], consome: [] },
  indicadores: [],
});
