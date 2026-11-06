/** Apoio dos testes da Comunicação: planilhas em memória, demonstração fictícia e quem está logado. */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { enviarPedido, revisarPedido } from '../aplicacao/pedidos';
import { PedidosComunicacao, TABELAS_COMUNICACAO } from '../dados/tabelas';
import type { TipoPeca } from '../dominio/pedido';
import type { TipoData } from '../dominio/calendario';
import { manifesto } from '../manifesto';

export const FUNCIONARIO = 'funcionario@exemplo.local';
export const COMUNICACAO = 'comunicacao@exemplo.local';
export const COORDENACAO = 'coord.comunicacao@exemplo.local';
export const OUTRO_FUNCIONARIO = 'dp@exemplo.local';
export const DIRETORIA = 'diretoria@exemplo.local';

/** Planilhas novas, com a estrutura da Comunicação e os usuários fictícios do Núcleo. */
export async function planilhasDeComunicacao(): Promise<Planilhas> {
  const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'comunicacao']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_COMUNICACAO] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  return p;
}

export async function como(p: Planilhas, email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
}

export function item(x: Partial<{ tema: string; tipoData: TipoData; inicio: string; fim: string; tipos: TipoPeca[]; observacao: string | null }> = {}) {
  return {
    tema: 'Dia de teste da Comunicação',
    tipoData: 'exata' as TipoData,
    inicio: '2026-12-10',
    fim: '2026-12-10',
    tipos: ['post_instagram'] as TipoPeca[],
    observacao: null as string | null,
    ...x,
  };
}

/** Registros de auditoria de um registro, do mais antigo ao mais novo. */
export async function auditoriaDe(p: Planilhas, id: string) {
  return (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === id);
}

const SEXTA = { agora: new Date('2026-11-06T15:00:00Z') };

/** Pedido novo (sem tema), enviado por `por` (padrão: funcionário). Devolve id, número e versão lida. */
async function pedidoEnviado(p: Planilhas, por: string) {
  const r = await enviarPedido(
    p,
    await como(p, por),
    {
      area: 'educacao',
      calendarioId: null,
      tipoPeca: 'post_instagram',
      titulo: 'Convite para a festa',
      descricao: 'Texto fictício do pedido.',
      dataDesejada: '2026-11-25',
      linkVideo: null,
      imagemConfirmada: false,
      nomeSolicitante: 'Pessoa fictícia',
    },
    SEXTA,
  );
  return r;
}

async function versaoDe(p: Planilhas, id: string) {
  return (await lerTabela(p, PedidosComunicacao)).porId(id)!.versao;
}

/** Pedido já em "Em revisão". */
export async function emRevisao(p: Planilhas, opts: { por?: string } = {}) {
  const r = await pedidoEnviado(p, opts.por ?? FUNCIONARIO);
  await revisarPedido(p, await como(p, COMUNICACAO), r.id, await versaoDe(p, r.id), 'iniciar_revisao', null, SEXTA);
  return { id: r.id, numero: r.numero, versao: await versaoDe(p, r.id) };
}

/** Pedido já em "Aguardando aprovação". */
export async function emAprovacao(p: Planilhas, opts: { por?: string } = {}) {
  const r = await emRevisao(p, opts);
  await revisarPedido(p, await como(p, COMUNICACAO), r.id, r.versao, 'enviar_aprovacao', null, SEXTA);
  return { id: r.id, numero: r.numero, versao: await versaoDe(p, r.id) };
}
