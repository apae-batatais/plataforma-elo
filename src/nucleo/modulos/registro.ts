/**
 * Validação do conjunto de módulos e montagem do menu do portal.
 */
import { EVENTOS_DO_NUCLEO } from '@/nucleo/eventos/catalogo';
import type { Manifesto } from './manifesto';

/** Confere regras que só fazem sentido olhando todos os módulos juntos. */
export function validarRegistro(manifestos: readonly Manifesto[]): void {
  const erros: string[] = [];
  const unicos = (campo: 'id' | 'schema' | 'rota') => {
    const vistos = new Set<string>();
    for (const m of manifestos) {
      if (vistos.has(m[campo])) erros.push(`Dois módulos usam o mesmo ${campo}: "${m[campo]}"`);
      vistos.add(m[campo]);
    }
  };
  unicos('id');
  unicos('schema');
  unicos('rota');

  const donoDoEvento = new Map<string, string>(EVENTOS_DO_NUCLEO.map((e) => [e, 'nucleo']));
  for (const m of manifestos) {
    for (const evento of m.eventos.publica) {
      const dono = donoDoEvento.get(evento);
      if (dono) erros.push(`Evento "${evento}" publicado por "${m.id}" e por "${dono}"`);
      donoDoEvento.set(evento, m.id);
    }
  }
  for (const m of manifestos) {
    for (const evento of m.eventos.consome) {
      if (!donoDoEvento.has(evento)) erros.push(`"${m.id}" consome "${evento}", que ninguém publica`);
    }
  }

  if (erros.length > 0) {
    throw new Error(`Registro de módulos inválido:\n- ${erros.join('\n- ')}`);
  }
}

export interface AppNoMenu {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  rota: string;
  itens: { rotulo: string; href: string }[];
}

/** Apps e itens de menu que um usuário com estas permissões pode ver. */
export function menuDoUsuario(manifestos: readonly Manifesto[], permissoes: ReadonlySet<string>): AppNoMenu[] {
  return manifestos
    .filter((m) => permissoes.has(m.permissaoAcesso))
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      icone: m.icone,
      rota: m.rota,
      itens: m.menu
        .filter((i) => permissoes.has(i.permissao))
        .map((i) => ({ rotulo: i.rotulo, href: i.caminho === '/' ? m.rota : `${m.rota}${i.caminho}` })),
    }));
}
