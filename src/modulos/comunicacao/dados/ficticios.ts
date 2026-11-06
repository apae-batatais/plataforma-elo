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
} from './tabelas';
import { conferirTransicao, NOME_TIPO_PECA, type Acao, type Situacao, type TipoPeca } from '../dominio/pedido';

const AUTOR = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
const EQUIPE = 'comunicacao@exemplo.local';
const COORDENACAO = 'coord.comunicacao@exemplo.local';

const CALENDARIO = [
  { tema: 'Dia Nacional de Luta da Pessoa com Deficiência', tipo_data: 'exata', inicio: '2026-09-21', fim: '2026-09-21', tipos: ['post_instagram', 'reel_instagram'] },
  { tema: 'Semana da Pessoa com Deficiência Intelectual e Múltipla', tipo_data: 'periodo', inicio: '2026-08-21', fim: '2026-08-28', tipos: ['post_instagram', 'release', 'artigo'] },
  { tema: 'Campanha de arrecadação de fim de ano', tipo_data: 'periodo', inicio: '2026-11-16', fim: '2026-12-18', tipos: ['post_instagram', 'reel_instagram', 'release'] },
  { tema: 'Dia Internacional da Pessoa com Deficiência', tipo_data: 'exata', inicio: '2026-12-03', fim: '2026-12-03', tipos: ['post_instagram', 'entrevista'] },
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
  urgente?: boolean;
  /** Ações a partir do envio, na ordem. */
  caminho: [Acao, string?][];
};

const PEDIDOS: Roteiro[] = [
  { titulo: 'Convite para a Festa da Família', tipo: 'post_instagram', area: 'educacao', email: 'coord.educacao@exemplo.local', nome: 'Coordenação da Educação (fictícia)', calendario: 4, desejada: '2026-11-16', caminho: [] },
  { titulo: 'Inscrições abertas para a oficina de artes', tipo: 'post_instagram', area: 'assistencia_social', email: 'coord.ur@exemplo.local', nome: 'Coordenação UR (fictícia)', desejada: '2026-11-18', urgente: true, caminho: [['iniciar_revisao']] },
  { titulo: 'Bastidores da horta da Apae Rural', tipo: 'reel_instagram', area: 'educacao', email: 'funcionario@exemplo.local', nome: 'Funcionário (fictício)', desejada: '2026-11-20', caminho: [['iniciar_revisao'], ['devolver', 'Faltou confirmar a autorização de imagem das pessoas que aparecem no vídeo.']] },
  { titulo: 'Balanço da campanha de agasalhos', tipo: 'release', area: 'assistencia_social', email: 'financeiro@exemplo.local', nome: 'Financeiro (fictício)', calendario: 2, desejada: '2026-11-25', caminho: [['iniciar_revisao'], ['enviar_aprovacao']] },
  { titulo: 'Nova turma do atletismo', tipo: 'post_instagram', area: 'educacao', email: 'coord.educacao@exemplo.local', nome: 'Coordenação da Educação (fictícia)', desejada: '2026-11-27', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar']] },
  { titulo: 'Artigo sobre inclusão no trabalho', tipo: 'artigo', area: 'saude', email: 'tecnico.cer@exemplo.local', nome: 'Técnico CER (fictício)', calendario: 3, desejada: '2026-12-03', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar']] },
  { titulo: 'Resultado da Olimpíada interna', tipo: 'post_instagram', area: 'educacao', email: 'dp@exemplo.local', nome: 'Departamento Pessoal (fictício)', desejada: '2026-10-30', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar'], ['publicar']] },
  { titulo: 'Entrevista sobre o Dia Internacional da Pessoa com Deficiência', tipo: 'entrevista', area: 'assistencia_social', email: 'diretoria@exemplo.local', nome: 'Diretoria (fictícia)', calendario: 3, desejada: '2026-10-29', caminho: [['iniciar_revisao'], ['enviar_aprovacao'], ['aprovar'], ['agendar'], ['publicar']] },
];

export async function popularComunicacaoFicticia(p: Planilhas): Promise<void> {
  const [cal, grupos, contatos, ligacoes, pedidos, historico] = await lerTabelas(p, [
    CalendarioComunicacao,
    GruposComunicacao,
    ContatosComunicacao,
    ContatoGruposComunicacao,
    PedidosComunicacao,
    HistoricoComunicacao,
  ] as const);

  const itens = await inserirRegistros(p, cal, CALENDARIO.map((i) => ({ ...i, tipos: i.tipos.join(','), observacao: null })), AUTOR);
  const gs = await inserirRegistros(p, grupos, [{ nome: 'Jornais e rádios da cidade' }, { nome: 'Blogs e portais da região' }], AUTOR);
  const cs = await inserirRegistros(
    p,
    contatos,
    [
      { nome: 'Redação (fictícia)', veiculo: 'Jornal Fictício', email: 'redacao@jornal-ficticio.com.br' },
      { nome: 'Pauta (fictícia)', veiculo: 'Rádio Exemplo FM', email: 'pauta@radio-exemplo.com.br' },
      { nome: 'Editoria (fictícia)', veiculo: 'Portal Região Exemplo', email: 'editoria@portal-exemplo.com.br' },
      { nome: 'Contato do blog (fictício)', veiculo: 'Blog Exemplo', email: 'contato@blog-exemplo.com.br' },
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
    const envio = `2026-10-${String(5 + i * 2).padStart(2, '0')}`;
    let situacao: Situacao = 'aguardando_revisao';
    const hist: { em: string; usuario: string; acao: string; de: Situacao | null; para: Situacao; comentario: string | null }[] = [
      { em: momento(envio, 0), usuario: r.email, acao: 'enviar', de: null, para: situacao, comentario: null },
    ];
    r.caminho.forEach(([acao, comentario], passo) => {
      const para = conferirTransicao(situacao, acao, r.tipo);
      hist.push({ em: momento(envio, passo + 1), usuario: acao === 'aprovar' ? COORDENACAO : EQUIPE, acao, de: situacao, para, comentario: comentario ?? null });
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
        urgente: r.urgente ?? false,
        imagem_confirmada_em: r.tipo === 'reel_instagram' ? null : hist[0].em,
        imagem_confirmada_por: r.tipo === 'reel_instagram' ? null : r.email,
        link_video: r.tipo === 'reel_instagram' ? 'https://exemplo.com.br/video-ficticio' : null,
        situacao,
        juntado_a: null,
        enviado_em: hist[0].em,
        agendado_para: agendado ? hist.find((h) => h.para === 'agendado')!.em : null,
        destinatarios: r.tipo === 'release' || r.tipo === 'entrevista' ? JSON.stringify({ grupos: [gs[0].id], contatos: [cs[2].id] }) : null,
        link_publicacao: passou('publicado', 'realizada') ? 'https://exemplo.com.br/publicacao-ficticia' : null,
        publicado_em: passou('publicado', 'realizada') ? hist[hist.length - 1].em : null,
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
}
