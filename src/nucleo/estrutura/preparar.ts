/**
 * "Preparar estrutura": cria as abas que faltam, com o cabeçalho, e grava a
 * configuração inicial nas abas vazias. Pode rodar quantas vezes for preciso:
 * nunca apaga nem altera o que já existe.
 *
 * Feito com poucas chamadas ao Google (cerca de 4 por planilha + 5), para
 * caber no limite de tempo das funções da hospedagem.
 */
import type { z } from 'zod';
import { atualizarVarios, cabecalhoDe, inserirVarios, lerTabelas, type DefinicaoTabela, type Entrada, type Planilhas, type TabelaLida } from '@/nucleo/armazenamento/tabela';
import { AREAS_INICIAIS, PERFIS_INICIAIS, PERMISSOES_INICIAIS, UNIDADES_PADRAO } from './dados-iniciais';
import { Areas, PerfilPermissoes, Perfis, TABELAS_DO_NUCLEO, Unidades } from './tabelas';

export interface ResultadoPreparacao {
  abasCriadas: string[];
  registrosIniciais: number;
  /** Ajustes de configuração aplicados em planilhas já preparadas antes. */
  ajustes: string[];
}


/** O que os módulos ativos acrescentam à estrutura. */
export interface EstruturaDosModulos {
  tabelas?: readonly DefinicaoTabela<z.ZodObject>[];
  perfis?: readonly { codigo: string; nome: string; descricao: string }[];
  permissoes?: readonly { perfil: string; permissao: string }[];
  /** Permissões que uma versão anterior deu e que deixaram de valer: "Preparar estrutura" desativa. */
  permissoesRetiradas?: readonly { perfil: string; permissao: string }[];
}

export async function prepararEstrutura(
  p: Planilhas,
  modulos: EstruturaDosModulos = {},
  autor = 'sistema',
  /** Unidades da instituição (do cadastro dela); gravadas só se a aba estiver vazia. */
  unidadesIniciais: readonly { codigo: string; nome: string }[] = UNIDADES_PADRAO,
): Promise<ResultadoPreparacao> {
  const tabelasDosModulos = modulos.tabelas ?? [];
  const porPlanilha = new Map<string, { aba: string; cabecalho: string[] }[]>();
  for (const def of [...TABELAS_DO_NUCLEO, ...tabelasDosModulos] as DefinicaoTabela<z.ZodObject>[]) {
    porPlanilha.set(def.planilha, [...(porPlanilha.get(def.planilha) ?? []), { aba: def.aba, cabecalho: cabecalhoDe(def) }]);
  }
  const abasCriadas: string[] = [];
  for (const [chave, abas] of porPlanilha) {
    const criadas = await p.armazenamento.garantirAbas(p.idDe(chave), abas);
    abasCriadas.push(...criadas.map((a) => `${chave} › ${a}`));
  }

  const [unidades, areas, perfis, permissoes] = await lerTabelas(p, [Unidades, Areas, Perfis, PerfilPermissoes] as const);
  const semear = async <E extends z.ZodObject>(tabela: TabelaLida<E>, linhas: Entrada<E>[]) =>
    tabela.todos().length > 0 ? 0 : inserirVarios(p, tabela, linhas, { email: autor });
  // Perfis e permissões: inclui os que nunca existiram (inclusive os trazidos
  // pelos módulos). Um que a administração desativou não volta.
  const faltando = <T,>(existentes: T[], desejados: readonly T[], chave: (x: T) => string) => {
    const ja = new Set(existentes.map(chave));
    return desejados.filter((x) => !ja.has(chave(x)) && (ja.add(chave(x)), true));
  };
  const novosPerfis = faltando(perfis.todos() as { codigo: string; nome: string; descricao: string | null }[], [...PERFIS_INICIAIS, ...(modulos.perfis ?? [])], (x) => x.codigo);
  const novasPermissoes = faltando(permissoes.todos() as { perfil: string; permissao: string }[], [...PERMISSOES_INICIAIS, ...(modulos.permissoes ?? [])], (x) => `${x.perfil}|${x.permissao}`);
  const registrosIniciais =
    (await semear(unidades, [...unidadesIniciais])) +
    (await semear(areas, AREAS_INICIAIS)) +
    (await inserirVarios(p, perfis, novosPerfis as Entrada<typeof Perfis.esquema>[], { email: autor })) +
    (await inserirVarios(p, permissoes, novasPermissoes as Entrada<typeof PerfilPermissoes.esquema>[], { email: autor }));

  // Ajustes de versões antigas (renomear unidades da Apae Batatais, desativar o CER) já
  // foram aplicados em 30/10/2026 e saíram daqui: o Elo não guarda regra de uma instituição só.
  const ajustes: string[] = [];
  const retirar = new Set((modulos.permissoesRetiradas ?? []).map((x) => `${x.perfil}|${x.permissao}`));
  const aRetirar = (permissoes.ativos() as { id: string; versao: number; perfil: string; permissao: string }[]).filter((x) => retirar.has(`${x.perfil}|${x.permissao}`));
  if (aRetirar.length) {
    await atualizarVarios(p, PerfilPermissoes, aRetirar.map((x) => ({ id: x.id, versao: x.versao, mudancas: { ativo: false } })), { email: autor });
    ajustes.push(...aRetirar.map((x) => `permissão retirada: ${x.perfil} › ${x.permissao}`));
  }

  return { abasCriadas, registrosIniciais, ajustes };
}

export interface ConferenciaEstrutura {
  /** Perfis que os módulos usam e ainda não estão na aba Perfis. */
  perfisFaltando: string[];
  /** Permissões ligadas a perfis que ainda não estão na aba PerfilPermissoes. */
  permissoesFaltando: number;
  /** Há algo que só "Preparar estrutura" resolve. */
  desatualizada: boolean;
}

/**
 * Confere, sem gravar nada, se a configuração de perfis e permissões está em dia
 * com a versão publicada (uma leitura da planilha do Núcleo). Depois de uma
 * atualização que traz permissões novas, elas só valem após "Preparar estrutura":
 * até lá, itens de menu somem para os perfis afetados.
 */
export async function conferirEstrutura(p: Planilhas, modulos: EstruturaDosModulos = {}): Promise<ConferenciaEstrutura> {
  const [perfis, permissoes] = await lerTabelas(p, [Perfis, PerfilPermissoes] as const);
  const temPerfil = new Set(perfis.todos().map((x) => x.codigo));
  const temPermissao = new Set(permissoes.todos().map((x) => `${x.perfil}|${x.permissao}`));
  const perfisFaltando = [...PERFIS_INICIAIS, ...(modulos.perfis ?? [])].filter((x) => !temPerfil.has(x.codigo)).map((x) => x.nome);
  const permissoesFaltando = new Set(
    [...PERMISSOES_INICIAIS, ...(modulos.permissoes ?? [])].map((x) => `${x.perfil}|${x.permissao}`).filter((k) => !temPermissao.has(k)),
  ).size;
  const retirar = new Set((modulos.permissoesRetiradas ?? []).map((x) => `${x.perfil}|${x.permissao}`));
  const aRetirar = permissoes.ativos().filter((x) => retirar.has(`${x.perfil}|${x.permissao}`)).length;
  return { perfisFaltando, permissoesFaltando, desatualizada: perfisFaltando.length > 0 || permissoesFaltando > 0 || aRetirar > 0 };
}
