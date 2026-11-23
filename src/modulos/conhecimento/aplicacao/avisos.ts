/**
 * Aviso por e-mail da Base de Conhecimento (regras 21 e 22, ADR-027).
 *
 * Ao publicar algo que exige ciência ou teste (e a cada nova versão), nasce um envio `pendente` na aba `Envios`,
 * um por publicação e edição. A rotina (tarefa `conhecimento.avisos`) monta o texto fixo e genérico, sem título nem
 * conteúdo, e envia ao público em cópia oculta, com 3 tentativas. Sem e-mail de envio, nada sai e o editor é avisado.
 * A auditoria guarda só nomes de colunas; o corpo da mensagem nunca é gravado.
 */
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { emailValido, ErroEmail, type EnviadorDeEmail } from '@/nucleo/email/email';
import { EnviosConhecimento, PublicacoesConhecimento, type RegEnvio, type RegPublicacao } from '../dados/tabelas';
import { ASSUNTO_DO_AVISO, esperaAposTentativa, MAX_ENVIOS_POR_RODADA, MAX_TENTATIVAS, textoDoAviso } from '../dominio/aviso';
import { carregarPublico } from './base';

const SISTEMA = 'rotina@elo';
const minutos = (agora: Date, n: number) => new Date(agora.getTime() + n * 60_000).toISOString();
const auditar = (p: Planilhas, usuario: string, acao: 'inclusao' | 'alteracao', id: string, colunas: string[], agora: Date) =>
  registrarAuditoria(p, { usuario, acao, entidade: 'EnviosConhecimento', registroId: id, detalhes: { colunas } }, agora);

export type ResultadoDoAviso = 'agendado' | 'sem_remetente' | 'nao_se_aplica';

/** Regra 21: agenda o aviso da edição (idempotente: regra 22). Nunca lança por falha de agendamento. */
export async function agendarAviso(p: Planilhas, usuario: string, publicacao: Pick<RegPublicacao, 'id' | 'exige_ciencia' | 'tem_teste'>, edicao: number, emailDisponivel: boolean | undefined, agora: Date): Promise<ResultadoDoAviso> {
  if (!publicacao.exige_ciencia && !publicacao.tem_teste) return 'nao_se_aplica';
  if (!emailDisponivel) return 'sem_remetente';
  const [envios] = await lerTabelas(p, [EnviosConhecimento] as const);
  if (envios.ativos().some((e) => e.publicacao_id === publicacao.id && e.edicao === edicao)) return 'agendado';
  const campos = {
    publicacao_id: publicacao.id,
    edicao,
    assunto: ASSUNTO_DO_AVISO,
    destinatarios: null,
    proxima_tentativa: agora.toISOString(),
    situacao: 'pendente' as const,
    tentativas: 0,
    enviado_em: null,
    erro: null,
  };
  const novo = await inserir(p, EnviosConhecimento, campos, { email: usuario, agora: () => agora });
  await auditar(p, usuario, 'inclusao', novo.id, Object.keys(campos), agora);
  return 'agendado';
}

export interface MeiosDeAviso {
  email: EnviadorDeEmail | null;
  /** Endereço público do Elo, para o link do e-mail. */
  urlBase: string | null;
}

const motivoResumido = (erro: unknown) =>
  erro instanceof ErroEmail ? erro.message.slice(0, 300) : 'Erro inesperado ao enviar. A rotina tenta de novo; se repetir, avise a Operadora do Elo.';

async function cancelar(p: Planilhas, e: RegEnvio, motivo: string, agora: Date) {
  const { colunasAlteradas } = await atualizar(p, EnviosConhecimento, e.id, e.versao, { situacao: 'cancelado', erro: motivo }, { email: SISTEMA, agora: () => agora });
  await auditar(p, SISTEMA, 'alteracao', e.id, colunasAlteradas, agora);
}

/** Envia os avisos pendentes. Devolve só contagens. */
export async function rodarAvisos(p: Planilhas, meios: MeiosDeAviso, agora: Date = new Date()): Promise<Record<string, number>> {
  const r = { enviados: 0, falhas: 0, esgotados: 0, cancelados: 0, adiados: 0 };
  const [envios, publicacoes] = await lerTabelas(p, [EnviosConhecimento, PublicacoesConhecimento] as const);
  const pendentes = envios.ativos().filter((e) => e.situacao === 'pendente');
  if (!meios.email) {
    for (const e of pendentes) {
      await cancelar(p, e, 'Falta informar o e-mail de envio na administração da instituição.', agora);
      r.cancelados++;
    }
    return r;
  }
  if (!meios.urlBase) return { ...r, sem_endereco_publico: 1 };

  const devidos = pendentes.filter((e) => new Date(e.proxima_tentativa).getTime() <= agora.getTime()).sort((a, b) => a.proxima_tentativa.localeCompare(b.proxima_tentativa)).slice(0, MAX_ENVIOS_POR_RODADA);
  const publico = devidos.length ? await carregarPublico(p, agora) : null;
  for (const e of devidos) {
    const x = publicacoes.porId(e.publicacao_id);
    if (!x || !x.ativo || x.situacao !== 'publicada' || x.edicao !== e.edicao || !(x.exige_ciencia || x.tem_teste)) {
      await cancelar(p, e, 'A publicação mudou e o aviso não vale mais.', agora);
      r.cancelados++;
      continue;
    }
    // Reserva a tentativa antes de enviar: se outra rodada já pegou este aviso, a versão não confere.
    const tentativa = e.tentativas + 1;
    let reservado: RegEnvio;
    try {
      const res = await atualizar(p, EnviosConhecimento, e.id, e.versao, { tentativas: tentativa, proxima_tentativa: minutos(agora, esperaAposTentativa(tentativa)) }, { email: SISTEMA, agora: () => agora });
      reservado = res.registro;
      await auditar(p, SISTEMA, 'alteracao', e.id, res.colunasAlteradas, agora);
    } catch (erro) {
      if (erro instanceof ErroConflito) {
        r.adiados++;
        continue;
      }
      throw erro;
    }
    let destinos: string[] = [];
    try {
      destinos = [...new Set(publico!.membros(x).filter(emailValido))].sort();
      if (destinos.length === 0) {
        await cancelar(p, reservado, 'Ninguém com e-mail cadastrado para receber este aviso.', agora);
        r.cancelados++;
        continue;
      }
      await meios.email.enviar({ cco: destinos, assunto: ASSUNTO_DO_AVISO, texto: textoDoAviso(meios.urlBase) });
    } catch (erro) {
      const esgotou = tentativa >= MAX_TENTATIVAS;
      const { colunasAlteradas } = await atualizar(p, EnviosConhecimento, reservado.id, reservado.versao, { erro: motivoResumido(erro), ...(esgotou ? { situacao: 'falhou' as const } : {}) }, { email: SISTEMA, agora: () => agora });
      await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
      if (esgotou) r.esgotados++;
      else r.falhas++;
      continue;
    }
    const { colunasAlteradas } = await atualizar(p, EnviosConhecimento, reservado.id, reservado.versao, { situacao: 'enviado', enviado_em: agora.toISOString(), destinatarios: destinos.join(','), erro: null }, { email: SISTEMA, agora: () => agora });
    await auditar(p, SISTEMA, 'alteracao', reservado.id, colunasAlteradas, agora);
    r.enviados++;
  }
  return r;
}
