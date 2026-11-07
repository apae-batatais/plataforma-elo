/**
 * Casos de uso do calendário da Comunicação.
 *
 * Quem pode:
 * - comunicacao.calendario.gerenciar: ver, cadastrar, alterar e desativar itens;
 * - comunicacao.solicitar: ver os itens ativos e ainda não encerrados, para escolher no pedido.
 *
 * Nada é apagado (desativar = ativo FALSE). A auditoria guarda só os nomes das colunas.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { CalendarioComunicacao, PedidosComunicacao, type RegCalendario } from '../dados/tabelas';
import { conferirItemCalendario, itensParaEscolha, type TipoData } from '../dominio/calendario';
import { ErroComunicacao, TIPOS_PECA, type TipoPeca } from '../dominio/pedido';
import { diaEmBrasilia } from '../dominio/prazos';

const PERM = { gerenciar: 'comunicacao.calendario.gerenciar', solicitar: 'comunicacao.solicitar' } as const;

export interface DadosItemCalendario {
  id?: string;
  versao?: number;
  tema: string;
  tipoData: TipoData;
  inicio: string;
  fim: string;
  tipos: TipoPeca[];
  observacao: string | null;
}

interface Opcoes {
  agora?: Date;
}

/** Dia que existe de verdade, no formato AAAA-MM-DD (o que o campo de data do navegador envia). */
function dataValida(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [a, m, dia] = d.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, dia));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === dia;
}

/** Códigos dos tipos de peça guardados na planilha (separados por vírgula), só os conhecidos. */
export function tiposDoItem(tipos: string): TipoPeca[] {
  const lista = tipos.split(',').map((t) => t.trim());
  return TIPOS_PECA.filter((t) => lista.includes(t));
}

export async function salvarItemCalendario(p: Planilhas, quem: Autorizador, d: DadosItemCalendario, opcoes: Opcoes = {}): Promise<{ id: string }> {
  if (!quem.temPermissao(PERM.gerenciar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  if (d.tipoData === 'periodo' && !d.fim.trim()) throw new ErroComunicacao('Informe o fim do período.');
  if (!dataValida(d.inicio) || !dataValida(d.fim)) throw new ErroComunicacao('Informe as datas no formato dia/mês/ano.');
  const tema = d.tema.trim().replace(/\s+/g, ' ');
  const tipos = TIPOS_PECA.filter((t) => d.tipos.includes(t));
  const erros = conferirItemCalendario({ tema, tipoData: d.tipoData, inicio: d.inicio, fim: d.fim, tipos });
  if (erros.length) throw new ErroComunicacao(erros.join(' '));
  const campos = {
    tema,
    tipo_data: d.tipoData,
    inicio: d.inicio,
    fim: d.fim,
    tipos: tipos.join(','),
    observacao: d.observacao?.trim() || null,
  };
  const autoria = { email: quem.email, agora: () => agora };
  if (!d.id) {
    const novo = await inserir(p, CalendarioComunicacao, campos, autoria);
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'inclusao', entidade: 'CalendarioComunicacao', registroId: novo.id, detalhes: { colunas: Object.keys(campos) } },
      agora,
    );
    return { id: novo.id };
  }
  if (d.versao === undefined) throw new ErroComunicacao('Abra o item de novo para alterar.');
  const { colunasAlteradas } = await atualizar(p, CalendarioComunicacao, d.id, d.versao, campos, autoria);
  if (colunasAlteradas.length)
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'alteracao', entidade: 'CalendarioComunicacao', registroId: d.id, detalhes: { colunas: colunasAlteradas } },
      agora,
    );
  return { id: d.id };
}

export async function mudarSituacaoItemCalendario(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean, opcoes: Opcoes = {}): Promise<void> {
  if (!quem.temPermissao(PERM.gerenciar)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [calendario] = await lerTabelas(p, [CalendarioComunicacao] as const);
  const atual = calendario.porId(id);
  if (!atual) throw new ErroComunicacao('Item do calendário não encontrado.');
  if (atual.ativo === ativo) throw new ErroComunicacao(ativo ? 'Este item já está ativo.' : 'Este item já está desativado.');
  await atualizar(p, CalendarioComunicacao, id, versao, { ativo }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'CalendarioComunicacao', registroId: id, detalhes: { colunas: ['ativo'] } },
    agora,
  );
}

/** Um item do calendário pelo código (com os totais de pedidos), em qualquer mês; null se não existir. */
export async function itemDoCalendario(p: Planilhas, quem: Autorizador, id: string): Promise<(RegCalendario & { pedidos: number; publicados: number }) | null> {
  if (!quem.temPermissao(PERM.gerenciar)) throw new ErroPermissao();
  const [calendario, pedidos] = await lerTabelas(p, [CalendarioComunicacao, PedidosComunicacao] as const);
  const item = calendario.porId(id);
  if (!item) return null;
  const doItem = pedidos.ativos().filter((x) => x.calendario_id === id);
  return { ...item, pedidos: doItem.length, publicados: doItem.filter((x) => x.situacao === 'publicado' || x.situacao === 'realizada').length };
}

/** Itens do calendário que tocam o período, com o total de pedidos e quantos já foram publicados. Inclui os desativados. */
export async function listarCalendario(
  p: Planilhas,
  quem: Autorizador,
  periodo: { inicio: string; fim: string },
): Promise<Array<RegCalendario & { pedidos: number; publicados: number }>> {
  if (!quem.temPermissao(PERM.gerenciar)) throw new ErroPermissao();
  if (!dataValida(periodo.inicio) || !dataValida(periodo.fim)) throw new ErroComunicacao('Informe as datas no formato dia/mês/ano.');
  const [calendario, pedidos] = await lerTabelas(p, [CalendarioComunicacao, PedidosComunicacao] as const);
  const porItem = new Map<string, { pedidos: number; publicados: number }>();
  for (const x of pedidos.ativos()) {
    if (!x.calendario_id) continue;
    const c = porItem.get(x.calendario_id) ?? { pedidos: 0, publicados: 0 };
    c.pedidos++;
    if (x.situacao === 'publicado' || x.situacao === 'realizada') c.publicados++;
    porItem.set(x.calendario_id, c);
  }
  return calendario
    .todos()
    .filter((i) => i.inicio <= periodo.fim && i.fim >= periodo.inicio)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.tema.localeCompare(b.tema, 'pt-BR'))
    .map((i) => ({ ...i, ...(porItem.get(i.id) ?? { pedidos: 0, publicados: 0 }) }));
}

/** Itens que a pessoa pode escolher ao pedir: ativos e ainda não encerrados. */
export async function itensParaPedido(
  p: Planilhas,
  quem: Autorizador,
  opcoes: Opcoes = {},
): Promise<Array<{ id: string; tema: string; inicio: string; fim: string; tipos: TipoPeca[] }>> {
  if (!quem.temPermissaoAlgumEscopo(PERM.solicitar)) throw new ErroPermissao();
  const [calendario] = await lerTabelas(p, [CalendarioComunicacao] as const);
  const hoje = diaEmBrasilia(opcoes.agora ?? new Date());
  return itensParaEscolha(calendario.todos(), hoje).map((i) => ({ id: i.id, tema: i.tema, inicio: i.inicio, fim: i.fim, tipos: tiposDoItem(i.tipos) }));
}
