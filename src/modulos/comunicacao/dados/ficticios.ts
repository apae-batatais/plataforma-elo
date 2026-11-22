/**
 * Comunicação FICTÍCIA da demonstração: itens de calendário, grupos e contatos
 * da imprensa (todos inventados) e 8 pedidos em situações variadas, cada um com
 * o histórico que o caminho do pedido (dominio/pedido.ts) permite.
 */
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import {
  CalendarioComunicacao,
  ContatoGruposComunicacao,
  ContatosComunicacao,
  GruposComunicacao,
  HistoricoComunicacao,
  PedidosComunicacao,
  PublicacoesComunicacao,
} from './tabelas';
import { ANTECEDENCIA_PADRAO } from '../aplicacao/configuracoes';
import { feriadosAtivos } from '@/nucleo/feriados/feriados';
import { diaEmBrasilia, ehUrgente } from '../dominio/prazos';
import { conferirTransicao, NOME_TIPO_PECA, type Acao, type Situacao, type TipoPeca } from '../dominio/pedido';

const AUTOR = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
const EQUIPE = 'comunicacao@exemplo.local';
const COORDENACAO = 'coord.comunicacao@exemplo.local';

const CALENDARIO = [
  { tema: 'Dia Nacional de Luta da Pessoa com Deficiência', tipo_data: 'exata', inicio: '2026-09-21', fim: '2026-09-21', tipos: ['post_instagram', 'reel_instagram'] },
  { tema: 'Semana da Pessoa com Deficiência Intelectual e Múltipla', tipo_data: 'periodo', inicio: '2026-08-21', fim: '2026-08-28', tipos: ['post_instagram', 'release', 'artigo'] },
  { tema: 'Campanha de arrecadação de fim de ano', tipo_data: 'periodo', inicio: '2026-11-16', fim: '2026-12-18', tipos: ['post_instagram', 'reel_instagram', 'release'] },
  { tema: 'Dia Internacional da Pessoa com Deficiência', tipo_data: 'exata', inicio: '2026-12-03', fim: '2026-12-03', tipos: ['post_instagram', 'entrevista', 'artigo'] },
  { tema: 'Festa da Família', tipo_data: 'exata', inicio: '2026-11-21', fim: '2026-11-21', tipos: ['post_instagram', 'release'] },
  { tema: 'Mês da Consciência Negra', tipo_data: 'periodo', inicio: '2026-11-01', fim: '2026-11-30', tipos: ['post_instagram', 'artigo'] },
] as const;

type Roteiro = {
  titulo: string;
  tipo: TipoPeca;
  area: string;
  email: string;
  nome: string;
  calendario?: number;
  desejada: string;
  /** Dia do envio; se faltar, cada pedido é enviado em um dia diferente de outubro. */
  envio?: string;
  /** Ações a partir do envio, na ordem. */
  caminho: [Acao, string?][];
};

const PEDIDOS: Roteiro[] = [
  { titulo: 'Convite para a Festa da Família', tipo: 'post_instagram', area: 'educacao', email: 'coord.educacao@exemplo.local', nome: 'Coordenação da Educação (fictícia)', calendario: 4, desejada: '2026-11-16', caminho: [] },
  { titulo: 'Inscrições abertas para a oficina de artes', tipo: 'post_instagram', area: 'assistencia_social', email: 'coord.ur@exemplo.local', nome: 'Coordenação UR (fictícia)', desejada: '2026-11-06', envio: '2026-11-03', caminho: [['iniciar_revisao']] },
  { titulo: 'Bastidores da horta da instituição', tipo: 'reel_instagram', area: 'educacao', email: 'funcionario@exemplo.local', nome: 'Funcionário (fictício)', desejada: '2026-11-20', caminho: [['iniciar_revisao'], ['devolver', 'Faltou confirmar a autorização de imagem das pessoas que aparecem no vídeo.']] },
  { titulo: 'Balanço da campanha de agasalhos', tipo: 'release', area: 'assistencia_social', email: 'financeiro@exemplo.local', nome: 'Financeiro (fictício)', calendario: 2, desejada: '2026-11-25', caminho: [['iniciar_revisao'], ['enviar_aprovacao']] },
  { titulo: 'Nova turma do atletismo', tipo: 'post_instagram', area: 'educacao', email: 'coord.educacao@exemplo.local', nome: 'Coordenação da Educação (fictícia)', desejada: '2026-11-27', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar']] },
  { titulo: 'Artigo sobre inclusão no trabalho', tipo: 'artigo', area: 'saude', email: 'tecnico.cer@exemplo.local', nome: 'Técnico CER (fictício)', calendario: 3, desejada: '2026-12-03', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar']] },
  { titulo: 'Resultado da Olimpíada interna', tipo: 'post_instagram', area: 'educacao', email: 'dp@exemplo.local', nome: 'Departamento Pessoal (fictício)', desejada: '2026-10-30', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar'], ['publicar']] },
  { titulo: 'Entrevista sobre o Dia Internacional da Pessoa com Deficiência', tipo: 'entrevista', area: 'assistencia_social', email: 'diretoria@exemplo.local', nome: 'Diretoria (fictícia)', calendario: 3, desejada: '2026-10-29', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar'], ['publicar']] },
];

export async function popularComunicacaoFicticia(p: Planilhas): Promise<void> {
  const feriados = await feriadosAtivos(p);
  const [cal, grupos, contatos, ligacoes, pedidos, historico, publicacoes] = await lerTabelas(p, [
    CalendarioComunicacao,
    GruposComunicacao,
    ContatosComunicacao,
    ContatoGruposComunicacao,
    PedidosComunicacao,
    HistoricoComunicacao,
    PublicacoesComunicacao,
  ] as const);

  const itens = await inserirRegistros(p, cal, CALENDARIO.map((i) => ({ ...i, tipos: i.tipos.join(','), observacao: null })), AUTOR);
  const gs = await inserirRegistros(p, grupos, [{ nome: 'Jornais e rádios da cidade' }, { nome: 'Blogs e portais da região' }], AUTOR);
  const cs = await inserirRegistros(
    p,
    contatos,
    [
      { nome: 'Redação (fictícia)', veiculo: 'Jornal Fictício', email: 'redacao@jornal.exemplo.local' },
      { nome: 'Pauta (fictícia)', veiculo: 'Rádio Exemplo FM', email: 'pauta@radio.exemplo.local' },
      { nome: 'Editoria (fictícia)', veiculo: 'Portal Região Exemplo', email: 'editoria@portal.exemplo.local' },
      { nome: 'Contato do blog (fictício)', veiculo: 'Blog Exemplo', email: 'contato@blog.exemplo.local' },
    ],
    AUTOR,
  );
  await inserirRegistros(
    p,
    ligacoes,
    [
      { contato_id: cs[0].id, grupo_id: gs[0].id },
      { contato_id: cs[1].id, grupo_id: gs[0].id },
      { contato_id: cs[2].id, grupo_id: gs[1].id },
      { contato_id: cs[3].id, grupo_id: gs[1].id },
      { contato_id: cs[0].id, grupo_id: gs[1].id },
    ],
    AUTOR,
  );

  // Cada pedido é enviado em um dia e anda um dia por ação, no horário de Brasília (meio-dia).
  const momento = (inicio: string, passos: number) => new Date(new Date(`${inicio}T15:00:00Z`).getTime() + passos * 24 * 60 * 60 * 1000).toISOString();
  const linhas: { numero: number; r: Roteiro; situacao: Situacao; hist: { em: string; usuario: string; acao: string; de: Situacao | null; para: Situacao; comentario: string | null }[] }[] = [];
  PEDIDOS.forEach((r, i) => {
    const envio = r.envio ?? `2026-10-${String(5 + i * 2).padStart(2, '0')}`;
    let situacao: Situacao = 'aguardando_revisao';
    const hist: { em: string; usuario: string; acao: string; de: Situacao | null; para: Situacao; comentario: string | null }[] = [
      { em: momento(envio, 0), usuario: r.email, acao: 'enviar', de: null, para: situacao, comentario: null },
    ];
    r.caminho.forEach(([acao, comentario], passo) => {
      const para = conferirTransicao(situacao, acao, r.tipo);
      // A publicação acontece na data e hora planejadas (a mesma do agendamento), nunca antes delas.
      const em = acao === 'publicar' ? `${r.desejada}T13:00:00.000Z` : momento(envio, passo + 1);
      hist.push({ em, usuario: acao === 'aprovar' ? COORDENACAO : EQUIPE, acao, de: situacao, para, comentario: comentario ?? null });
      situacao = para;
    });
    linhas.push({ numero: i + 1, r, situacao, hist });
  });

  const regs = await inserirRegistros(
    p,
    pedidos,
    linhas.map(({ numero, r, situacao, hist }) => {
      const passou = (...s: Situacao[]) => hist.some((h) => s.includes(h.para));
      const agendado = passou('agendado');
      return {
        numero: `COM-2026-${String(numero).padStart(4, '0')}`,
        solicitante: r.email,
        solicitante_nome: r.nome,
        area: r.area,
        calendario_id: r.calendario === undefined ? null : itens[r.calendario].id,
        calendario_tema: r.calendario === undefined ? null : itens[r.calendario].tema,
        tipo_peca: r.tipo,
        titulo: r.titulo,
        descricao: `${NOME_TIPO_PECA[r.tipo]} de demonstração: texto fictício para conferir as telas.`,
        data_desejada: r.desejada,
        // Regra 7: urgente quando a data desejada fica antes do dia do envio + antecedência mínima padrão.
        urgente: ehUrgente(r.desejada, diaEmBrasilia(new Date(hist[0].em)), ANTECEDENCIA_PADRAO, feriados),
        imagem_confirmada_em: r.tipo === 'reel_instagram' ? null : hist[0].em,
        imagem_confirmada_por: r.tipo === 'reel_instagram' ? null : r.email,
        link_video: r.tipo === 'reel_instagram' ? 'https://exemplo.local/video-ficticio' : null,
        situacao,
        juntado_a: null,
        enviado_em: hist[0].em,
        // Data e hora planejadas da publicação (data desejada, às 10h de Brasília), não o momento do agendamento.
        agendado_para: agendado ? `${r.desejada}T13:00:00.000Z` : null,
        destinatarios: r.tipo === 'release' || r.tipo === 'artigo' || r.tipo === 'entrevista' ? JSON.stringify({ grupos: [gs[0].id], contatos: [cs[2].id] }) : null,
        link_publicacao: passou('publicado', 'realizada') ? 'https://exemplo.local/publicacao-ficticia' : null,
        publicado_em: passou('publicado', 'realizada') ? hist[hist.length - 1].em : null,
        envio_automatico: false,
        // Alguns pedidos ligados a um serviço, para a Ficha do serviço mostrar publicações na demonstração.
        servico: r.area === 'educacao' ? 'escola' : r.area === 'assistencia_social' ? 'centro_dia_intergeracional' : null,
      };
    }),
    AUTOR,
  );

  await inserirRegistros(
    p,
    historico,
    linhas.flatMap(({ hist }, i) => hist.map((h) => ({ pedido_id: regs[i].id, ...h }))),
    AUTOR,
  );

  // Postagens de Instagram já publicadas ganham a publicação e um resultado fictício, para a demonstração
  // mostrar os números no pedido e nos Indicadores (nada é buscado de verdade).
  const publicadas = linhas.flatMap((l, i) => (l.situacao === 'publicado' && (l.r.tipo === 'post_instagram' || l.r.tipo === 'reel_instagram') ? [{ l, reg: regs[i] }] : []));
  await inserirRegistros(
    p,
    publicacoes,
    publicadas.map(({ l, reg }, n) => {
      const em = l.hist[l.hist.length - 1].em;
      return {
        pedido_id: reg.id,
        tipo: l.r.tipo === 'reel_instagram' ? ('reel' as const) : ('post' as const),
        prevista_para: em,
        situacao: 'publicada' as const,
        tentativas: 1,
        proxima_tentativa: null,
        container_id: null,
        post_id: `post-ficticio-${n + 1}`,
        link: 'https://exemplo.local/publicacao-ficticia',
        erro: null,
        publicada_em: em,
        codigo_midia: null,
        midia_vence_em: null,
        alcance: 900 + n * 340,
        curtidas: 60 + n * 18,
        comentarios: 4 + n,
        salvamentos: 9 + n * 3,
        metricas_em: em,
        metricas_aviso: null,
      };
    }),
    AUTOR,
  );
}
