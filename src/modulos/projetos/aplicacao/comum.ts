/** Peças comuns dos casos de uso de Projetos: autoria, auditoria, histórico, configuração e quem vê o quê. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { ConfigProjetos, HistoricoProjetos, type RegConfig, type RegProjeto } from '../dados/tabelas';
import { CONFIG_PADRAO, PAPEIS_DESIGNADOS, PORTES, TIPOS_PARECER, type ConfigProjetos as Config, type PapelDesignado, type TipoParecer } from '../dominio/projeto';

export interface Opcoes {
  agora?: Date;
}

export const autoriaDe = (quem: Autorizador, agora: Date) => ({ email: quem.email, agora: () => agora });

export async function auditar(
  p: Planilhas,
  quem: Autorizador,
  acao: 'inclusao' | 'alteracao',
  entidade: string,
  registroId: string,
  colunas: string[],
  agora: Date,
): Promise<void> {
  await registrarAuditoria(p, { usuario: quem.email, acao, entidade, registroId, detalhes: { colunas } }, agora);
}

/** Uma linha no histórico do projeto. Nunca recebe o texto de um parecer. */
export async function registrarHistorico(p: Planilhas, quem: Autorizador, projetoId: string, acao: string, comentario: string | null, agora: Date): Promise<void> {
  await inserir(p, HistoricoProjetos, { projeto_id: projetoId, em: agora.toISOString(), usuario: quem.email, acao, comentario: comentario?.trim() || null }, autoriaDe(quem, agora));
}

const CHAVE_PAPEL = (papel: PapelDesignado) => `designados_${papel}`;
export const CHAVES_CONFIG = ['limite_alcada', 'pareceres_completo', 'pareceres_enxuto', 'proponente_decide', ...PAPEIS_DESIGNADOS.map(CHAVE_PAPEL)] as const;

const lista = (v: string | null | undefined) => (v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Converte as linhas da aba em configuração pronta. Valor ausente ou inválido vale o padrão. */
export function configDeLinhas(linhas: readonly Pick<RegConfig, 'chave' | 'valor'>[]): Config {
  const v = (k: string) => linhas.find((l) => l.chave === k)?.valor;
  const limite = Number(String(v('limite_alcada') ?? '').replace(',', '.'));
  const pareceres = (k: string, padrao: TipoParecer[]) => {
    const bruto = v(k);
    if (bruto === undefined) return padrao;
    return lista(bruto).filter((t): t is TipoParecer => (TIPOS_PARECER as readonly string[]).includes(t));
  };
  const designados = Object.fromEntries(PAPEIS_DESIGNADOS.map((papel) => [papel, lista(v(CHAVE_PAPEL(papel)))])) as Record<PapelDesignado, string[]>;
  return {
    limiteAlcada: v('limite_alcada') && Number.isFinite(limite) && limite >= 0 ? limite : CONFIG_PADRAO.limiteAlcada,
    pareceresPorta1: Object.fromEntries(PORTES.map((porte) => [porte, pareceres(`pareceres_${porte}`, CONFIG_PADRAO.pareceresPorta1[porte])])) as Config['pareceresPorta1'],
    designados,
    proponenteDecide: v('proponente_decide') === 'sim',
  };
}

export async function lerConfig(p: Planilhas): Promise<Config> {
  const [linhas] = await lerTabelas(p, [ConfigProjetos] as const);
  return configDeLinhas(linhas.ativos());
}

/** O e-mail está designado para o papel? */
export const designado = (config: Config, email: string, papel: PapelDesignado) => config.designados[papel].includes(email.toLowerCase());
export const designadoEmAlgum = (config: Config, email: string) => PAPEIS_DESIGNADOS.some((papel) => designado(config, email, papel));

const escopoServico = (r: Pick<RegProjeto, 'servico'>) => (r.servico ? ({ tipo: 'servico', codigo: r.servico } as const) : undefined);

/** Ver todos os projetos (Diretoria): vale só com atribuição global. */
export const veTodos = (quem: Autorizador) => quem.temPermissao('projetos.ver_todos');

/** Regra "quem vê o quê": proponente, responsável, ver_todos, gerenciar no escopo, quem pode assumir e designados. */
export function podeVerProjeto(quem: Autorizador, r: RegProjeto, config: Config): boolean {
  if (veTodos(quem)) return true;
  const eu = quem.email.toLowerCase();
  if (r.proponente.toLowerCase() === eu) return true;
  if (r.etapa === 'rascunho') return false;
  if (r.responsavel?.toLowerCase() === eu) return true;
  if (quem.temPermissao('projetos.gerenciar', escopoServico(r))) return true;
  if (r.etapa === 'aguardando_responsavel') return podeAssumir(quem, r);
  return designadoEmAlgum(config, quem.email);
}

/** Coordenação com `projetos.assumir`; se o projeto tem serviço, o escopo da pessoa precisa cobri-lo. */
export function podeAssumir(quem: Autorizador, r: Pick<RegProjeto, 'servico'>): boolean {
  return r.servico ? quem.temPermissao('projetos.assumir', escopoServico(r)) : quem.temPermissaoAlgumEscopo('projetos.assumir');
}

/** Quem pode ler o texto dos pareceres: responsável, designados e Diretoria (regra do app). */
export function podeVerPareceres(quem: Autorizador, r: Pick<RegProjeto, 'responsavel'>, config: Config): boolean {
  return veTodos(quem) || r.responsavel?.toLowerCase() === quem.email.toLowerCase() || designadoEmAlgum(config, quem.email);
}
