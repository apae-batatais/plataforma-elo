/**
 * "Preparar estrutura": cria as abas que faltam, com o cabeçalho, e grava a
 * configuração inicial nas abas vazias. Pode rodar quantas vezes for preciso:
 * nunca apaga nem altera o que já existe.
 */
import type { z } from 'zod';
import { cabecalhoDe, inserir, lerTabela, type DefinicaoTabela, type Entrada, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { AREAS_INICIAIS, PERFIS_INICIAIS, PERMISSOES_INICIAIS, UNIDADES_INICIAIS } from './dados-iniciais';
import { Areas, PerfilPermissoes, Perfis, TABELAS_DO_NUCLEO, Unidades } from './tabelas';

export interface ResultadoPreparacao {
  abasCriadas: string[];
  registrosIniciais: number;
}

export async function prepararEstrutura(
  p: Planilhas,
  tabelasDosModulos: readonly DefinicaoTabela<z.ZodObject>[] = [],
  autor = 'sistema',
): Promise<ResultadoPreparacao> {
  const abasCriadas: string[] = [];
  for (const def of [...TABELAS_DO_NUCLEO, ...tabelasDosModulos] as DefinicaoTabela<z.ZodObject>[]) {
    const r = await p.armazenamento.garantirAba(p.idDe(def.planilha), def.aba, cabecalhoDe(def));
    if (r === 'criada') abasCriadas.push(`${def.planilha} › ${def.aba}`);
  }

  let registrosIniciais = 0;
  const semear = async <E extends z.ZodObject>(def: DefinicaoTabela<E>, linhas: Entrada<E>[]) => {
    if ((await lerTabela(p, def)).todos().length > 0) return;
    for (const l of linhas) {
      await inserir(p, def, l, { email: autor });
      registrosIniciais++;
    }
  };
  await semear(Unidades, UNIDADES_INICIAIS);
  await semear(Areas, AREAS_INICIAIS);
  await semear(Perfis, PERFIS_INICIAIS);
  await semear(PerfilPermissoes, PERMISSOES_INICIAIS);

  return { abasCriadas, registrosIniciais };
}
