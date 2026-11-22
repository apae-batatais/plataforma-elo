/**
 * Base de Conhecimento FICTÍCIA da demonstração: categorias, publicações em situações variadas
 * (rascunho, para todos, para um perfil, para uma área, arquivada) e algumas ciências.
 * Tudo inventado; nenhum nome de instituição.
 */
import { inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { CategoriasConhecimento, CienciasConhecimento, PerguntasConhecimento, PublicacoesConhecimento, TentativasTeste } from './tabelas';

const EDITOR = { email: 'editor.conhecimento@exemplo.local', nome: 'Editor da Base de Conhecimento (fictício)' };
const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const CATEGORIAS = [
  { codigo: 'normas', nome: 'Normas e regimentos' },
  { codigo: 'comunicados', nome: 'Comunicados' },
  { codigo: 'seguranca', nome: 'Segurança e saúde no trabalho' },
];

const PUBLICACOES = [
  {
    chave: 'conduta',
    titulo: 'Código de conduta da instituição',
    categoria: 'normas',
    resumo: 'Como esperamos que todos se tratem no trabalho e com quem atendemos.',
    corpo: 'Este código vale para toda a equipe, voluntários e prestadores.\n\n1. Tratamos todas as pessoas com respeito.\n2. Guardamos sigilo sobre quem atendemos.\n3. Em caso de dúvida, falamos com a coordenação.',
    publico: ['todos', null],
    exige: true,
    situacao: 'publicada',
    publicadaHa: 30,
  },
  {
    chave: 'recesso',
    titulo: 'Horário de funcionamento no recesso de fim de ano',
    categoria: 'comunicados',
    resumo: 'Datas e horários dos setores entre o Natal e o Ano-Novo.',
    corpo: 'Entre 24/12 e 02/01 a sede funciona em horário reduzido. Os serviços de atendimento seguem a escala combinada com cada coordenação.',
    publico: ['todos', null],
    exige: true,
    situacao: 'publicada',
    publicadaHa: 3,
  },
  {
    chave: 'epi',
    titulo: 'Uso de equipamentos de proteção na cozinha',
    categoria: 'seguranca',
    resumo: 'Regras de uso de luvas, toucas e calçados na cozinha.',
    corpo: 'Todo o setor da cozinha usa touca, luvas e calçado fechado durante o preparo. Troque as luvas ao mudar de tarefa.',
    publico: ['perfil', 'cozinha'],
    exige: true,
    situacao: 'publicada',
    publicadaHa: 8,
  },
  {
    chave: 'educacao',
    titulo: 'Rotina de entrada e saída dos estudantes',
    categoria: 'normas',
    resumo: 'Como receber e entregar os estudantes às famílias.',
    corpo: 'A entrega é feita só a quem está na lista de autorizados da ficha do estudante. Confira sempre o documento.',
    publico: ['area', 'educacao'],
    exige: true,
    situacao: 'publicada',
    publicadaHa: 12,
  },
  {
    chave: 'manual',
    titulo: 'Guia de boas-vindas (sem exigência)',
    categoria: 'comunicados',
    resumo: 'Material de consulta para quem chega à instituição.',
    corpo: 'Seja bem-vindo! Aqui você encontra o essencial sobre a rotina da instituição.',
    publico: ['todos', null],
    exige: false,
    situacao: 'publicada',
    publicadaHa: 40,
  },
  {
    chave: 'higiene',
    titulo: 'Higiene das mãos e prevenção de contágio',
    categoria: 'seguranca',
    resumo: 'Quando e como lavar as mãos. Tem um teste curto de compreensão.',
    corpo: 'Lave as mãos com água e sabão ao chegar, antes de comer, depois de usar o banheiro e ao trocar de atividade. A higienização leva pelo menos 20 segundos.\n\nO álcool em gel complementa a lavagem, mas não a substitui quando há sujeira visível.',
    publico: ['todos', null],
    exige: true,
    temTeste: true,
    situacao: 'publicada',
    publicadaHa: 5,
  },
  {
    chave: 'rascunho',
    titulo: 'Nova política de uso de celulares (rascunho)',
    categoria: 'normas',
    resumo: null,
    corpo: 'Texto ainda em preparação.',
    publico: ['todos', null],
    exige: true,
    situacao: 'rascunho',
    publicadaHa: null,
  },
  {
    chave: 'antigo',
    titulo: 'Calendário de vacinação 2025 (arquivado)',
    categoria: 'comunicados',
    resumo: 'Substituído pelo calendário deste ano.',
    corpo: 'Documento arquivado, mantido só para consulta de quem já deu ciência.',
    publico: ['todos', null],
    exige: true,
    situacao: 'arquivada',
    publicadaHa: 300,
  },
] as const;

const PERGUNTAS_HIGIENE = [
  { texto: 'Por quanto tempo, no mínimo, se deve esfregar as mãos com água e sabão?', opcoes: ['5 segundos', '10 segundos', '20 segundos'], correta: 2 },
  { texto: 'O álcool em gel substitui a lavagem quando há sujeira visível?', opcoes: ['Sim, sempre', 'Não, é preciso lavar com água e sabão'], correta: 1 },
];

/** Quem já deu ciência em cada publicação (e há quantos dias). */
const CIENCIAS: Record<string, { email: string; ha: number }[]> = {
  conduta: [
    { email: 'diretoria@exemplo.local', ha: 28 },
    { email: 'funcionario@exemplo.local', ha: 20 },
    { email: 'financeiro@exemplo.local', ha: 25 },
    { email: 'editor.conhecimento@exemplo.local', ha: 29 },
  ],
  recesso: [{ email: 'diretoria@exemplo.local', ha: 2 }],
  epi: [{ email: 'cozinha@exemplo.local', ha: 6 }],
  higiene: [
    { email: 'diretoria@exemplo.local', ha: 4 },
    { email: 'funcionario@exemplo.local', ha: 4 },
  ],
  antigo: [{ email: 'funcionario@exemplo.local', ha: 250 }],
};

export async function popularConhecimentoFicticio(p: Planilhas): Promise<void> {
  const autor = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
  const [categorias] = await lerTabelas(p, [CategoriasConhecimento] as const);
  if (categorias.todos().length > 0) return;
  for (const c of CATEGORIAS) await inserir(p, CategoriasConhecimento, c, autor);
  for (const x of PUBLICACOES) {
    const quando = x.publicadaHa === null ? null : dias(x.publicadaHa);
    const pub = await inserir(
      p,
      PublicacoesConhecimento,
      {
        titulo: x.titulo,
        categoria: x.categoria,
        resumo: x.resumo,
        corpo: x.corpo,
        publico_tipo: x.publico[0],
        publico_valor: x.publico[1],
        exige_ciencia: x.exige,
        tem_teste: 'temTeste' in x && x.temTeste === true,
        edicao: 1,
        edicao_em: quando ?? dias(1),
        situacao: x.situacao,
        autor: EDITOR.email,
        autor_nome: EDITOR.nome,
        publicada_em: quando,
      },
      autor,
    );
    if (x.chave === 'higiene') {
      for (const [i, q] of PERGUNTAS_HIGIENE.entries())
        await inserir(p, PerguntasConhecimento, { publicacao_id: pub.id, edicao: 1, ordem: i + 1, texto: q.texto, opcoes: JSON.stringify(q.opcoes), correta: q.correta }, autor);
      // Quem já passou no teste e deu ciência, e uma pessoa que errou e ainda não passou.
      for (const email of ['diretoria@exemplo.local', 'funcionario@exemplo.local'])
        await inserir(p, TentativasTeste, { publicacao_id: pub.id, edicao: 1, usuario: email, feita_em: dias(4), acertos: 2, total: 2, aprovada: true }, autor);
      await inserir(p, TentativasTeste, { publicacao_id: pub.id, edicao: 1, usuario: 'cozinha@exemplo.local', feita_em: dias(3), acertos: 1, total: 2, aprovada: false }, autor);
    }
    for (const c of CIENCIAS[x.chave] ?? []) {
      await inserir(p, CienciasConhecimento, { publicacao_id: pub.id, edicao: 1, usuario: c.email, registrada_em: dias(c.ha) }, autor);
    }
  }
}
