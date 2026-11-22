/**
 * Projetos FICTÍCIOS da demonstração (todos inventados): uma configuração com banca designada e cinco ideias
 * em situações diferentes. Passam pelos casos de uso, então seguem as mesmas regras de quem usa o app.
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { salvarConfig } from '../aplicacao/configuracoes';
import { assumirIdeia, cadastrarIdeia } from '../aplicacao/ideias';
import { adicionarAtividade, adicionarLinhaOrcamento } from '../aplicacao/planejamento';
import { adicionarItemMarco, adicionarMembro, avancarFase, salvarDocumento } from '../aplicacao/fases';
import { definirFonteDoItem } from '../aplicacao/indicadores';
import { abrirPorta, darParecer, decidirPorta } from '../aplicacao/portas';
import { MarcoLogico, Projetos } from '../dados/tabelas';
import { CONFIG_PADRAO } from '../dominio/projeto';

const FUNCIONARIO = 'funcionario@exemplo.local';
const COORDENACAO = 'coord.educacao@exemplo.local';
const DIRETORIA = 'diretoria@exemplo.local';
const TECNICO = 'tecnico.cer@exemplo.local';
const FINANCEIRO = 'financeiro@exemplo.local';
const JURIDICO = 'dp@exemplo.local';
const ALCADA = 'admin@exemplo.local';

async function como(p: Planilhas, email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

const dia = (n: number) => new Date(`2026-10-${String(n).padStart(2, '0')}T12:00:00Z`);

export async function popularProjetosFicticios(p: Planilhas): Promise<void> {
  const diretoria = await como(p, DIRETORIA);
  await salvarConfig(
    p,
    diretoria,
    {
      ...CONFIG_PADRAO,
      limiteAlcada: 50000,
      designados: { tecnico: [TECNICO], financeiro: [FINANCEIRO], juridico: [JURIDICO], alcada: [ALCADA] },
    },
    { agora: dia(1) },
  );
  const func = await como(p, FUNCIONARIO);
  const coord = await como(p, COORDENACAO);
  const base = { tipo: 'interno' as const, porte: 'completo' as const, servico: null };

  // 1. Rascunho de quem propôs.
  await cadastrarIdeia(p, func, { ...base, titulo: 'Horta comunitária (exemplo)', resumo: 'Ideia fictícia: criar uma horta com as famílias atendidas.', valorEstimado: 8000 }, { agora: dia(2) });
  // 2. Esperando responsável.
  await cadastrarIdeia(p, func, { ...base, tipo: 'financiado', titulo: 'Proposta para edital de cultura (exemplo)', resumo: 'Ideia fictícia: oficinas de arte financiadas por edital.', valorEstimado: 30000 }, { agora: dia(3), enviar: true });
  // 3. Com responsável, ainda sem porta.
  const tres = await cadastrarIdeia(p, func, { ...base, porte: 'enxuto', titulo: 'Festa de encerramento do ano (exemplo)', resumo: 'Ideia fictícia: evento simples para as famílias.', valorEstimado: 3000 }, { agora: dia(4), enviar: true });
  await assumirIdeia(p, coord, tres.id, 1, { agora: dia(5) });
  // 4. Porta aberta com um parecer dado (faltam os outros).
  const quatro = await cadastrarIdeia(p, func, { ...base, titulo: 'Reforma da sala de atividades (exemplo)', resumo: 'Ideia fictícia: reformar uma sala para as oficinas.', valorEstimado: 20000, servico: null }, { agora: dia(6), enviar: true });
  await assumirIdeia(p, coord, quatro.id, 1, { agora: dia(7) });
  const abertaQuatro = await abrirPorta(p, coord, quatro.id, 2, { agora: dia(8) });
  await darParecer(p, await como(p, TECNICO), abertaQuatro.portaId, 'tecnico', 'satisfatorio', null, { agora: dia(9) });
  // 5. Valor acima do limite: a Diretoria seguiu e a decisão espera a Presidência ou o Conselho.
  const cinco = await cadastrarIdeia(p, func, { ...base, tipo: 'financiado', titulo: 'Novo serviço de atendimento (exemplo)', resumo: 'Ideia fictícia: implantar um serviço novo com financiamento externo.', valorEstimado: 120000 }, { agora: dia(10), enviar: true });
  await assumirIdeia(p, coord, cinco.id, 1, { agora: dia(11) });
  const abertaCinco = await abrirPorta(p, coord, cinco.id, 2, { agora: dia(12) });
  await darParecer(p, await como(p, TECNICO), abertaCinco.portaId, 'tecnico', 'satisfatorio', null, { agora: dia(13) });
  await darParecer(p, await como(p, FINANCEIRO), abertaCinco.portaId, 'financeiro', 'com_ressalvas', 'Texto fictício: conferir a contrapartida.', { agora: dia(13) });
  await darParecer(p, await como(p, JURIDICO), abertaCinco.portaId, 'juridico', 'satisfatorio', null, { agora: dia(14) });
  await decidirPorta(p, diretoria, abertaCinco.portaId, 1, 'seguir', 'Texto fictício: a ideia atende à necessidade; segue para a alçada.', { agora: dia(15) });
  // 6. Porte enxuto na fase 2: proposta pronta, Termo ainda por preencher (a pessoa responsável abre a tela "Fase atual").
  const seis = await cadastrarIdeia(p, func, { ...base, porte: 'enxuto', titulo: 'Oficina de leitura (exemplo)', resumo: 'Ideia fictícia: oficina semanal de leitura para as famílias.', valorEstimado: 6000 }, { agora: dia(17), enviar: true });
  await assumirIdeia(p, coord, seis.id, 1, { agora: dia(18) });
  const abertaSeis = await abrirPorta(p, coord, seis.id, 2, { agora: dia(19) });
  await darParecer(p, await como(p, TECNICO), abertaSeis.portaId, 'tecnico', 'satisfatorio', null, { agora: dia(20) });
  await decidirPorta(p, diretoria, abertaSeis.portaId, 1, 'seguir', 'Texto fictício: vale seguir.', { agora: dia(21) });
  await salvarDocumento(p, coord, seis.id, 'proposta', { descricao: 'Texto fictício: encontros semanais de leitura com as famílias.' }, true, null, { agora: dia(22) });
  const [apos] = await lerTabelas(p, [Projetos] as const);
  await avancarFase(p, coord, seis.id, apos.porId(seis.id)!.versao, { agora: dia(23) });
  await adicionarMembro(p, coord, seis.id, FUNCIONARIO, 'Apoio às oficinas', { agora: dia(24) });
  // 7. Porte enxuto na fase 3: Termo aprovado, com duas atividades (uma já atrasada) e um orçamento.
  const sete = await cadastrarIdeia(p, func, { ...base, porte: 'enxuto', titulo: 'Sarau com as famílias (exemplo)', resumo: 'Ideia fictícia: tarde de apresentações com as famílias.', valorEstimado: 4000 }, { agora: dia(25), enviar: true });
  await assumirIdeia(p, coord, sete.id, 1, { agora: dia(26) });
  const abertaSete = await abrirPorta(p, coord, sete.id, 2, { agora: dia(27) });
  await darParecer(p, await como(p, TECNICO), abertaSete.portaId, 'tecnico', 'satisfatorio', null, { agora: dia(27) });
  await decidirPorta(p, diretoria, abertaSete.portaId, 1, 'seguir', 'Texto fictício: vale seguir.', { agora: dia(28) });
  await salvarDocumento(p, coord, sete.id, 'proposta', { descricao: 'Texto fictício: apresentações e lanche coletivo.' }, true, null, { agora: dia(28) });
  await avancarFase(p, coord, sete.id, (await lerTabelas(p, [Projetos] as const))[0].porId(sete.id)!.versao, { agora: dia(28) });
  const termoSete = { objetivo: 'Realizar o sarau', escopo: 'Apresentações e lanche', valor_total: '4000', tolerancia_custo_linha: '10', tolerancia_custo_total: '5', tolerancia_prazo_fim: '10', tolerancia_prazo_marco: '5' };
  await salvarDocumento(p, coord, sete.id, 'termo_abertura', termoSete, true, null, { agora: dia(29) });
  const portaTermo = await abrirPorta(p, coord, sete.id, (await lerTabelas(p, [Projetos] as const))[0].porId(sete.id)!.versao, { agora: dia(29) });
  await darParecer(p, await como(p, TECNICO), portaTermo.portaId, 'tecnico', 'satisfatorio', null, { agora: dia(30) });
  await decidirPorta(p, diretoria, portaTermo.portaId, 1, 'seguir', 'Texto fictício: Termo autorizado.', { agora: dia(30) });
  await adicionarAtividade(p, coord, sete.id, { descricao: 'Convidar as famílias', responsavel: FUNCIONARIO, inicioPrevisto: '2026-10-28', fimPrevisto: '2026-11-05', peso: null }, { agora: dia(31) });
  await adicionarAtividade(p, coord, sete.id, { descricao: 'Montar o espaço', responsavel: COORDENACAO, inicioPrevisto: '2026-12-10', fimPrevisto: '2026-12-12', peso: null }, { agora: dia(31) });
  await adicionarLinhaOrcamento(p, coord, sete.id, { categoria: 'Alimentação', descricao: 'Lanche coletivo', valor: 1800, fonte: 'Recurso próprio' }, { agora: dia(31) });
  await adicionarLinhaOrcamento(p, coord, sete.id, { categoria: 'Material', descricao: 'Som e decoração', valor: 1200, fonte: null }, { agora: dia(31) });
  // Marco lógico do projeto 6, com um indicador cujo número vem do cadastro (ligações, onda 2, L4).
  await adicionarItemMarco(p, coord, seis.id, { nivel: 'impacto', descricao: 'Mais famílias com o hábito da leitura (exemplo)', indicador: 'Pessoas atendidas no serviço', fonteVerificacao: 'Cadastro do Elo', pressuposto: null, acima: null }, { agora: dia(25) });
  const [marco] = await lerTabelas(p, [MarcoLogico] as const);
  const impacto = marco.ativos().find((m) => m.projeto_id === seis.id)!;
  await definirFonteDoItem(p, coord, seis.id, impacto.id, impacto.versao, { fonte: 'vinculos_ativos', servico: 'escola', meta: 5 }, { agora: dia(26) });
  // Datas previstas (a agenda única mostra início e fim previstos). Nenhuma tela as preenche ainda: só a demonstração.
  const datas: [string, string, string][] = [
    [quatro.id, '2026-12-01', '2027-02-26'],
    [cinco.id, '2027-03-01', '2027-12-17'],
    [tres.id, '2026-12-18', '2026-12-18'],
  ];
  for (const [id, inicio, fim] of datas) {
    const [projetos] = await lerTabelas(p, [Projetos] as const);
    const atual = projetos.porId(id)!;
    await atualizar(p, Projetos, id, atual.versao, { inicio_previsto: inicio, fim_previsto: fim }, { email: DIRETORIA, agora: () => dia(16) });
  }
}
