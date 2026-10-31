/**
 * Requisições FICTÍCIAS da demonstração: tipos de materiais e alguns pedidos
 * em cada etapa (aguardando coordenação, aguardando Diretoria, na fila do
 * Almoxarifado e atendido em parte). Gravados pelos próprios casos de uso.
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  concluirRequisicao, decidirRequisicao, enviarRequisicao, receberRequisicao, type CatalogoOrcamento,
} from '../aplicacao/requisicoes';
import { Requisicoes, TiposRequisicao } from './tabelas';

const TIPOS = [
  { nome: 'Higiene e limpeza', descricao: 'Produtos de limpeza e de higiene pessoal.' },
  { nome: 'Material pedagógico', descricao: 'Papel, tintas, jogos e material escolar.' },
  { nome: 'Alimentação e cozinha', descricao: 'Gêneros alimentícios e itens de cozinha, inclusive para eventos.' },
  { nome: 'Material de escritório', descricao: 'Papelaria e suprimentos de escritório.' },
] as const;

export async function popularRequisicoesFicticias(p: Planilhas, catalogo: CatalogoOrcamento): Promise<void> {
  const [tiposLidos] = await lerTabelas(p, [TiposRequisicao] as const);
  const tipos = await inserirRegistros(
    p,
    tiposLidos,
    TIPOS.map((t) => ({ nome: t.nome, categoria: 'material' as const, formulario: 'materiais' as const, perfil_responsavel: 'almoxarifado', prazo_aprovacao: 8, prazo_atendimento: 16, descricao: t.descricao })),
    { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') },
  );
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  const como = (email: string) =>
    new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
  const grupos = await catalogo.gruposDeGasto();
  const grupo = (inicio: string) => (grupos.find((g) => g.nome.startsWith(inicio)) ?? grupos[0])?.id ?? '';
  if (!grupos.length) return;

  const dia = (d: string, h: number) => new Date(`${d}T${String(h + 3).padStart(2, '0')}:00:00Z`); // horário de Brasília
  const pedir = (email: string, nome: string, tipo: number, area: string, g: string, centros: { servico: string; percentual: number }[], itens: [number, string, string][], quando: Date, detalhes: object = {}) =>
    enviarRequisicao(
      p,
      como(email),
      catalogo,
      { nomeRequisitante: nome, tipoId: tipos[tipo].id, area, grupoId: grupo(g), centros, itens: itens.map(([quantidade, unidade, descricao]) => ({ quantidade, unidade, descricao })), detalhes },
      { agora: quando },
    );
  const versao = async (id: string) => (await lerTabelas(p, [Requisicoes] as const))[0].porId(id)!.versao;

  // 1. Pedido da Escola: aguarda a Coordenação da Educação.
  await pedir('financeiro@exemplo.local', 'Financeiro (fictício)', 1, 'educacao', 'Material de consumo', [{ servico: 'escola', percentual: 100 }], [
    [10, 'resma', 'Papel sulfite A4'],
    [24, 'un', 'Lápis de cor (caixa)'],
  ], dia('2026-10-26', 9));

  // 2. Pedido da própria coordenação: vai para a Diretoria.
  await pedir('coord.ur@exemplo.local', 'Coordenação UR (fictícia)', 0, 'assistencia_social', 'Material de consumo', [{ servico: 'ur', percentual: 100 }], [
    [6, 'L', 'Detergente neutro'],
    [4, 'pct', 'Papel toalha'],
  ], dia('2026-10-27', 14));

  // 3. Lanche de evento, dividido entre dois serviços: aprovado, na fila do Almoxarifado.
  const evento = await pedir(
    'dp@exemplo.local',
    'Departamento Pessoal (fictício)',
    2,
    'educacao',
    'Alimentação',
    [
      { servico: 'escola', percentual: 60 },
      { servico: 'transporte', percentual: 40 },
    ],
    [
      [3, 'kg', 'Farinha de trigo'],
      [2, 'L', 'Leite integral'],
      [1, 'kg', 'Açúcar refinado'],
    ],
    dia('2026-10-28', 10),
    { entrega: { modo: 'retirada', horario: '13:40', local: 'Cozinha', responsavel: 'Equipe da Escola' }, evento: { nome: 'Festa da família', data: '2026-11-06', horario: '14:00', local: 'Quadra', publico: 'Famílias da Escola', participantes: 80 } },
  );
  await decidirRequisicao(p, como('coord.educacao@exemplo.local'), evento.id, await versao(evento.id), 'aprovar', null, { agora: dia('2026-10-28', 15) });

  // 4. Atendido em parte pelo Almoxarifado.
  const limpeza = await pedir('tecnico.cer@exemplo.local', 'Técnico CER (fictício)', 0, 'saude', 'Material de consumo', [{ servico: 'cer_reabilitacao', percentual: 100 }], [
    [5, 'L', 'Álcool 70%'],
    [10, 'cx', 'Luvas descartáveis'],
  ], dia('2026-10-20', 8));
  await decidirRequisicao(p, como('diretoria@exemplo.local'), limpeza.id, await versao(limpeza.id), 'aprovar', null, { agora: dia('2026-10-20', 11) });
  await receberRequisicao(p, como('almoxarifado@exemplo.local'), limpeza.id, await versao(limpeza.id), { agora: dia('2026-10-21', 9) });
  const [itens] = await lerTabelas(p, [(await import('./tabelas')).RequisicaoItens] as const);
  const daLimpeza = itens.ativos().filter((i) => i.requisicao_id === limpeza.id);
  await concluirRequisicao(
    p,
    como('almoxarifado@exemplo.local'),
    limpeza.id,
    await versao(limpeza.id),
    Object.fromEntries(daLimpeza.map((i) => [i.id, i.descricao.startsWith('Luvas') ? 6 : i.quantidade])),
    'Luvas em falta no estoque: 4 caixas chegam na próxima compra.',
    { agora: dia('2026-10-21', 16) },
  );
}
