/**
 * Ligações do projeto com outros apps (regras 26 e 27, entrega P7).
 * `LigacoesProjeto` guarda só identificador e cópia do nome. Os detalhes são lidos do app dono, que confere a
 * permissão; app ausente ou leitura que falha vira "indisponível" naquele item, nunca erro na tela.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { LigacaoLida } from '@/nucleo/ligacoes/ligacao';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { LigacoesProjeto, Projetos } from '../dados/tabelas';
import { APPS_LIGACAO, NOME_APP_LIGACAO, type AppLigacao } from '../dominio/ligacoes';
import { ErroProjetos } from '../dominio/projeto';
import { podeGerenciar } from './fases';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeVerProjeto, registrarHistorico, type Opcoes } from './comum';
import type { CatalogoLeitura, CompraLigada, ItemLigado } from './catalogo-leitura';

export type { CatalogoLeitura, CompraLigada, ItemLigado, LeitorLigacao } from './catalogo-leitura';

async function projetoParaLigar(p: Planilhas, quem: Autorizador, projetoId: string) {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[projetos], config, equipes] = await Promise.all([lerTabelas(p, [Projetos] as const), lerConfig(p), equipesAtivas(p)]);
  const r = projetos.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) throw new ErroProjetos('Projeto não encontrado.');
  if (!podeGerenciar(quem, r)) throw new ErroPermissao('Só quem gerencia o projeto altera as ligações.');
  if (r.etapa === 'cancelado') throw new ErroProjetos('Projeto cancelado não recebe novas ligações.');
  return r;
}

/** Regra 27: guarda identificador e cópia do nome. Idempotente: a mesma ligação não duplica. */
export async function registrarLigacao(
  p: Planilhas,
  quem: Autorizador,
  projetoId: string,
  dados: { app: AppLigacao; referenciaId: string; nome: string },
  opcoes: Opcoes = {},
): Promise<{ id: string; criada: boolean }> {
  const agora = opcoes.agora ?? new Date();
  if (!(APPS_LIGACAO as readonly string[]).includes(dados.app)) throw new ErroProjetos('Tipo de ligação desconhecido.');
  const referenciaId = dados.referenciaId.trim();
  const nome = dados.nome.trim();
  if (!referenciaId || !nome) throw new ErroProjetos('Informe o identificador e o nome do que está sendo ligado.');
  const r = await projetoParaLigar(p, quem, projetoId);
  const [ligacoes] = await lerTabelas(p, [LigacoesProjeto] as const);
  const existente = ligacoes.ativos().find((l) => l.projeto_id === r.id && l.app === dados.app && l.referencia_id === referenciaId);
  if (existente) return { id: existente.id, criada: false };
  const nova = await inserir(p, LigacoesProjeto, { projeto_id: r.id, app: dados.app, referencia_id: referenciaId, nome, ligado_em: agora.toISOString() }, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'LigacoesProjeto', nova.id, ['projeto_id', 'app', 'referencia_id', 'nome', 'ligado_em'], agora);
  await registrarHistorico(p, quem, r.id, `Ligação criada com ${NOME_APP_LIGACAO[dados.app]}`, null, agora);
  return { id: nova.id, criada: true };
}

/** Nada é apagado: a ligação fica inativa. */
export async function encerrarLigacao(p: Planilhas, quem: Autorizador, projetoId: string, ligacaoId: string, versao: number, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const r = await projetoParaLigar(p, quem, projetoId);
  const [ligacoes] = await lerTabelas(p, [LigacoesProjeto] as const);
  const l = ligacoes.ativos().find((x) => x.id === ligacaoId && x.projeto_id === r.id);
  if (!l) throw new ErroProjetos('Ligação não encontrada.');
  const { colunasAlteradas } = await atualizar(p, LigacoesProjeto, l.id, versao, { ativo: false }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'LigacoesProjeto', l.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, `Ligação encerrada com ${NOME_APP_LIGACAO[l.app]}`, null, agora);
}

export interface LigacaoDoProjeto {
  id: string;
  versao: number;
  app: AppLigacao;
  appNome: string;
  /** Cópia do nome guardada na ligação (aparece mesmo sem acesso ao app). */
  nome: string;
  ligadoEm: string;
  estado: 'ok' | 'sem_permissao' | 'indisponivel';
  /** Só com `estado = 'ok'`: situação atual lida do app dono. */
  situacao: string | null;
  /** Só com `estado = 'ok'`: nome atual no app (pode ter mudado desde a cópia). */
  nomeAtual: string | null;
}

export interface LigacoesDoProjeto {
  projetoId: string;
  podeAlterar: boolean;
  ligacoes: LigacaoDoProjeto[];
  compras: LigacaoLida<CompraLigada[]>;
}

/** Lê as ligações para a aba. Devolve `null` se a pessoa não vê o projeto. Um bloco que falha não derruba os outros. */
export async function lerLigacoesDoProjeto(p: Planilhas, quem: Autorizador, projetoId: string, catalogo: CatalogoLeitura | null | undefined, opcoes: Opcoes = {}): Promise<LigacoesDoProjeto | null> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[projetos, ligacoes], config, equipes] = await Promise.all([lerTabelas(p, [Projetos, LigacoesProjeto] as const), lerConfig(p), equipesAtivas(p)]);
  const r = projetos.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) return null;
  const lidas = await Promise.all(
    ligacoes
      .ativos()
      .filter((l) => l.projeto_id === r.id)
      .sort((a, b) => b.ligado_em.localeCompare(a.ligado_em))
      .map(async (l): Promise<LigacaoDoProjeto> => {
        const base = { id: l.id, versao: l.versao, app: l.app, appNome: NOME_APP_LIGACAO[l.app], nome: l.nome, ligadoEm: l.ligado_em, situacao: null, nomeAtual: null };
        const leitor = catalogo?.leitores[l.app];
        if (!leitor) return { ...base, estado: 'indisponivel' };
        let item: ItemLigado | null;
        try {
          item = await leitor(quem, l.referencia_id, agora);
        } catch {
          return { ...base, estado: 'indisponivel' };
        }
        return item ? { ...base, estado: 'ok', situacao: item.situacao, nomeAtual: item.nome } : { ...base, estado: 'sem_permissao' };
      }),
  );
  let compras: LigacaoLida<CompraLigada[]> = { estado: 'indisponivel' };
  if (catalogo) {
    try {
      compras = await catalogo.compras(quem, r.id);
    } catch {
      compras = { estado: 'erro' };
    }
  }
  return { projetoId: r.id, podeAlterar: podeGerenciar(quem, r) && r.etapa !== 'cancelado', ligacoes: lidas, compras };
}
