/**
 * Casos de uso da Avaliação de Serviços Sociais (camada de aplicação).
 *
 * Quem vê o quê:
 * - "avaliacao.avaliar" no serviço (escopo global, da unidade, da área ou do
 *   próprio serviço): aplica, lê e corrige as avaliações daquele serviço.
 * - "avaliacao.painel" no serviço: vê só os números agregados do painel.
 * Abrir uma avaliação ou o comparativo da pessoa registra leitura na auditoria; incluir, alterar e
 * retirar registram as colunas alteradas (nunca os valores).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas, type Registro } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { ligacaoOk, ligacaoSemPermissao, type Ligacao } from '@/nucleo/ligacoes/ligacao';
import {
  barreirasDoTexto,
  barreirasParaTexto,
  chavePessoa,
  conferirAvaliacao,
  ErroAvaliacao,
  idadeEm,
  indiceDeCuidado,
  ROTULOS,
  situacaoReavaliacao,
  temViolacao,
  type DadosAvaliacao,
  type SituacaoReavaliacao,
} from '../dominio/avaliacao';
import { compararAvaliacoes, type Comparativo } from '../dominio/comparativo';
import { montarPainel, type PainelAvaliacao } from '../dominio/painel';
import { Avaliacoes } from '../dados/tabelas';

export const PERM = {
  acessar: 'avaliacao.acessar',
  avaliar: 'avaliacao.avaliar',
  painel: 'avaliacao.painel',
} as const;

const ENTIDADE = 'avaliacao.Avaliacoes';
type RegAvaliacao = Registro<typeof Avaliacoes.esquema>;

const hojeEm = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília

const podeAvaliar = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.avaliar, { tipo: 'servico', codigo: servico });
const podeVerPainel = (quem: Autorizador, servico: string) => quem.temPermissao(PERM.painel, { tipo: 'servico', codigo: servico });

export interface ServicoParaAvaliar {
  codigo: string;
  nome: string;
  areaNome: string;
}

/** Serviços ativos em que a pessoa pode aplicar avaliações (a lista do campo "Serviço atual"). */
export async function servicosParaAvaliar(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<ServicoParaAvaliar[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const [servicos, areas] = await lerTabelas(p, [Servicos, Areas] as const);
  const nomeArea = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  return servicos
    .ativos()
    .filter((s) => (!s.fim || s.fim >= hoje) && podeAvaliar(quem, s.codigo))
    .map((s) => ({ codigo: s.codigo, nome: s.nome, areaNome: (s.area && nomeArea.get(s.area)) || 'Sem área' }))
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

const paraDados = (r: RegAvaliacao): DadosAvaliacao => ({
  tipo: r.tipo,
  iniciais: r.iniciais,
  nascimento: r.nascimento,
  sexo: r.sexo,
  prontuario: r.prontuario ?? '',
  servico: r.servico,
  data_avaliacao: r.data_avaliacao,
  evolucao_usuario: r.evolucao_usuario,
  evolucao_familia: r.evolucao_familia,
  cuidador: r.cuidador,
  bpc: r.bpc,
  mae_solo: r.mae_solo,
  rede_apoio: r.rede_apoio,
  cuidador_idoso: r.cuidador_idoso,
  nucleo_mais_pcd: r.nucleo_mais_pcd,
  adultos_30: r.adultos_30,
  isolamento: r.isolamento,
  enfermagem: r.enfermagem,
  grau_deficiencia: r.grau_deficiencia,
  grau_dependencia: r.grau_dependencia,
  ostomia: r.ostomia,
  ostomia_tipo: r.ostomia_tipo ?? '',
  transporte: r.transporte,
  barreiras: barreirasDoTexto(r.barreiras),
  observacoes: r.observacoes ?? '',
  profissional: r.profissional ?? '',
  registro_profissional: r.registro_profissional ?? '',
});

export interface LinhaAvaliacao {
  id: string;
  tipo: string;
  iniciais: string;
  nascimento: string;
  sexo: string;
  idade: number | null;
  servico: string;
  servicoNome: string;
  dataAvaliacao: string;
  grauDependencia: string;
  indice: number;
  violacao: boolean;
  /** Quantas avaliações da mesma pessoa você vê (para o comparativo). */
  avaliacoesDaPessoa: number;
  /** Reavaliação anual: só na avaliação mais recente da pessoa. */
  reavaliacao: { vence: string; situacao: SituacaoReavaliacao } | null;
}

/** Avaliações ativas dos serviços em que a pessoa avalia, da mais recente para a mais antiga. */
export async function listarAvaliacoes(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<LinhaAvaliacao[]> {
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const [avaliacoes] = await lerTabelas(p, [Avaliacoes] as const);
  const visiveis = avaliacoes
    .ativos()
    .filter((r) => podeAvaliar(quem, r.servico))
    .sort((a, b) => b.data_avaliacao.localeCompare(a.data_avaliacao) || b.atualizado_em.localeCompare(a.atualizado_em));
  const porPessoa = new Map<string, string[]>();
  for (const r of visiveis) porPessoa.set(chavePessoa(r), [...(porPessoa.get(chavePessoa(r)) ?? []), r.id]);
  return visiveis.map((r) => {
    const d = paraDados(r);
    const daPessoa = porPessoa.get(chavePessoa(r))!;
    return {
      id: r.id,
      tipo: r.tipo,
      iniciais: r.iniciais,
      nascimento: r.nascimento,
      sexo: r.sexo,
      idade: idadeEm(r.nascimento, r.data_avaliacao),
      servico: r.servico,
      servicoNome: r.servico_nome,
      dataAvaliacao: r.data_avaliacao,
      grauDependencia: r.grau_dependencia,
      indice: indiceDeCuidado(d),
      violacao: temViolacao(d.barreiras),
      avaliacoesDaPessoa: daPessoa.length,
      reavaliacao: daPessoa[0] === r.id ? situacaoReavaliacao(r.data_avaliacao, hoje) : null,
    };
  });
}

export interface HistoricoPessoa {
  iniciais: string;
  nascimento: string;
  sexo: string;
  avaliacoes: { id: string; tipo: string; data: string; servicoNome: string; indice: number; dados: DadosAvaliacao }[];
  comparativo: Comparativo;
  reavaliacao: { vence: string; situacao: SituacaoReavaliacao; dias: number };
}

/**
 * Todas as avaliações da mesma pessoa (iniciais + nascimento + sexo) nos serviços
 * em que você avalia, da mais antiga para a mais recente, com o comparativo.
 * Registra uma leitura na auditoria.
 */
export async function historicoDaPessoa(p: Planilhas, quem: Autorizador, id: string, opcoes: { agora?: Date } = {}): Promise<HistoricoPessoa> {
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const [avaliacoes] = await lerTabelas(p, [Avaliacoes] as const);
  const base = avaliacoes.porId(id);
  if (!base || !base.ativo) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, base.servico)) throw new ErroPermissao();
  const chave = chavePessoa(base);
  const lista = avaliacoes
    .ativos()
    .filter((r) => chavePessoa(r) === chave && podeAvaliar(quem, r.servico))
    .sort((a, b) => a.data_avaliacao.localeCompare(b.data_avaliacao) || a.criado_em.localeCompare(b.criado_em))
    .map((r) => {
      const dados = paraDados(r);
      return { id: r.id, tipo: r.tipo, data: r.data_avaliacao, servicoNome: r.servico_nome, indice: indiceDeCuidado(dados), dados };
    });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: ENTIDADE, registroId: id, detalhes: { comparativo: lista.length } });
  return {
    iniciais: base.iniciais,
    nascimento: base.nascimento,
    sexo: base.sexo,
    avaliacoes: lista,
    comparativo: compararAvaliacoes(lista),
    reavaliacao: situacaoReavaliacao(lista[lista.length - 1].data, hoje),
  };
}

export interface AvaliacaoDetalhada {
  id: string;
  versao: number;
  dados: DadosAvaliacao;
  servicoNome: string;
  criadoPor: string;
  atualizadoEm: string;
}

/** Abre uma avaliação para corrigir. Registra a leitura na auditoria. */
export async function detalharAvaliacao(p: Planilhas, quem: Autorizador, id: string): Promise<AvaliacaoDetalhada> {
  return abrir(p, quem, id, 'leitura');
}

/**
 * Ficha para imprimir ou salvar em PDF: o mesmo acesso de abrir, registrado na
 * auditoria como exportação (o papel sai do Elo).
 */
export async function fichaDaAvaliacao(p: Planilhas, quem: Autorizador, id: string): Promise<AvaliacaoDetalhada> {
  return abrir(p, quem, id, 'exportacao');
}

async function abrir(p: Planilhas, quem: Autorizador, id: string, acao: 'leitura' | 'exportacao'): Promise<AvaliacaoDetalhada> {
  const [avaliacoes] = await lerTabelas(p, [Avaliacoes] as const);
  const r = avaliacoes.porId(id);
  if (!r || !r.ativo) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, r.servico)) throw new ErroPermissao();
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao,
    entidade: ENTIDADE,
    registroId: id,
    ...(acao === 'exportacao' ? { detalhes: { formato: 'ficha impressa' } } : {}),
  });
  return { id: r.id, versao: r.versao, dados: paraDados(r), servicoNome: r.servico_nome, criadoPor: r.criado_por, atualizadoEm: r.atualizado_em };
}

function mensagemFaltando(faltando: (keyof DadosAvaliacao)[]): string {
  const nomes = faltando.map((k) => ROTULOS[k]);
  return nomes.length === 1 ? `Falta responder: ${nomes[0]}.` : `Faltam ${nomes.length} respostas: ${nomes.join(', ')}.`;
}

export class ErroRespostas extends ErroAvaliacao {
  constructor(readonly faltando: (keyof DadosAvaliacao)[]) {
    super(mensagemFaltando(faltando));
  }
}

const paraRegistro = (d: DadosAvaliacao, servicoNome: string) => ({
  tipo: d.tipo as RegAvaliacao['tipo'],
  iniciais: d.iniciais,
  nascimento: d.nascimento,
  sexo: d.sexo as 'F' | 'M',
  prontuario: d.prontuario || null,
  servico: d.servico,
  servico_nome: servicoNome,
  data_avaliacao: d.data_avaliacao,
  evolucao_usuario: d.evolucao_usuario as RegAvaliacao['evolucao_usuario'],
  evolucao_familia: d.evolucao_familia as RegAvaliacao['evolucao_familia'],
  cuidador: d.cuidador,
  bpc: d.bpc as RegAvaliacao['bpc'],
  mae_solo: d.mae_solo as RegAvaliacao['mae_solo'],
  rede_apoio: d.rede_apoio as RegAvaliacao['rede_apoio'],
  cuidador_idoso: d.cuidador_idoso as RegAvaliacao['cuidador_idoso'],
  nucleo_mais_pcd: d.nucleo_mais_pcd as RegAvaliacao['nucleo_mais_pcd'],
  adultos_30: d.adultos_30 as RegAvaliacao['adultos_30'],
  isolamento: d.isolamento as RegAvaliacao['isolamento'],
  enfermagem: d.enfermagem as RegAvaliacao['enfermagem'],
  grau_deficiencia: d.grau_deficiencia as RegAvaliacao['grau_deficiencia'],
  grau_dependencia: d.grau_dependencia as RegAvaliacao['grau_dependencia'],
  ostomia: d.ostomia as RegAvaliacao['ostomia'],
  ostomia_tipo: d.ostomia_tipo || null,
  transporte: d.transporte as RegAvaliacao['transporte'],
  barreiras: barreirasParaTexto(d.barreiras),
  observacoes: d.observacoes || null,
  profissional: d.profissional || null,
  registro_profissional: d.registro_profissional || null,
});

/**
 * Grava uma avaliação nova ou corrige uma existente (com a versão lida).
 * A pessoa precisa avaliar no serviço escolhido e, na correção, também no serviço anterior.
 */
export async function salvarAvaliacao(
  p: Planilhas,
  quem: Autorizador,
  bruto: Partial<DadosAvaliacao>,
  opcoes: { id?: string; versao?: number; agora?: Date } = {},
): Promise<{ id: string; indice: number }> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo(PERM.avaliar)) throw new ErroPermissao();
  const { faltando, dados } = conferirAvaliacao(bruto, hojeEm(agora));
  if (faltando.length) throw new ErroRespostas(faltando);

  const [servicos, avaliacoes] = await lerTabelas(p, [Servicos, Avaliacoes] as const);
  const servico = servicos.ativos().find((s) => s.codigo === dados.servico);
  if (!servico) throw new ErroAvaliacao('Escolha um serviço da lista.');
  if (!podeAvaliar(quem, servico.codigo)) throw new ErroPermissao('Você não aplica avaliações neste serviço.');
  const registro = paraRegistro(dados, servico.nome);
  const autoria = { email: quem.email, agora: () => agora };

  if (!opcoes.id) {
    const novo = await inserir(p, Avaliacoes, registro, autoria);
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: ENTIDADE, registroId: novo.id }, agora);
    return { id: novo.id, indice: indiceDeCuidado(dados) };
  }

  const atual = avaliacoes.porId(opcoes.id);
  if (!atual || !atual.ativo) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, atual.servico)) throw new ErroPermissao();
  const { colunasAlteradas } = await atualizar(p, Avaliacoes, atual.id, opcoes.versao ?? -1, registro, autoria);
  if (colunasAlteradas.length) {
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'alteracao', entidade: ENTIDADE, registroId: atual.id, detalhes: { colunas: colunasAlteradas } },
      agora,
    );
  }
  return { id: atual.id, indice: indiceDeCuidado(dados) };
}

/** Retira uma avaliação lançada por engano (ativo = FALSE, com o motivo). Nada é apagado. */
export async function retirarAvaliacao(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  motivo: string,
  opcoes: { agora?: Date } = {},
): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  const m = motivo.trim();
  if (m.length < 3) throw new ErroAvaliacao('Escreva o motivo da retirada.');
  const [avaliacoes] = await lerTabelas(p, [Avaliacoes] as const);
  const atual = avaliacoes.porId(id);
  if (!atual || !atual.ativo) throw new ErroAvaliacao('Avaliação não encontrada.');
  if (!podeAvaliar(quem, atual.servico)) throw new ErroPermissao();
  await atualizar(p, Avaliacoes, id, versao, { ativo: false, motivo_retirada: m }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(
    p,
    { usuario: quem.email, acao: 'encerramento', entidade: ENTIDADE, registroId: id, detalhes: { colunas: ['ativo', 'motivo_retirada'] } },
    agora,
  );
}

export interface FiltroPainel {
  /** Mês inicial e final (AAAA-MM) da data da avaliação; vazio = tudo. */
  de?: string;
  ate?: string;
  /** Só um serviço (código); vazio = todos os que a pessoa acompanha. */
  servico?: string;
}

/**
 * Números agregados das avaliações ativas dos serviços que a pessoa acompanha no painel.
 * Cada pessoa conta uma vez no retrato atual (pela avaliação mais recente do período).
 */
export async function painelDaAvaliacao(
  p: Planilhas,
  quem: Autorizador,
  filtro: FiltroPainel = {},
  opcoes: { agora?: Date } = {},
): Promise<PainelAvaliacao & { todos: boolean; servicosDisponiveis: { codigo: string; nome: string }[] }> {
  if (!quem.temPermissaoAlgumEscopo(PERM.painel)) throw new ErroPermissao();
  const hoje = hojeEm(opcoes.agora ?? new Date());
  const [avaliacoes] = await lerTabelas(p, [Avaliacoes] as const);
  const mes = (d: string) => d.slice(0, 7);
  const doEscopo = avaliacoes.ativos().filter((r) => podeVerPainel(quem, r.servico));
  const servicosDisponiveis = [...new Map(doEscopo.map((r) => [r.servico, r.servico_nome])).entries()]
    .map(([codigo, nome]) => ({ codigo, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const lista = doEscopo
    .filter((r) => !filtro.servico || r.servico === filtro.servico)
    .filter((r) => (!filtro.de || mes(r.data_avaliacao) >= filtro.de) && (!filtro.ate || mes(r.data_avaliacao) <= filtro.ate))
    .map((r) => {
      const d = paraDados(r);
      return { ...d, servicoNome: r.servico_nome, indice: indiceDeCuidado(d), idade: idadeEm(r.nascimento, r.data_avaliacao), chave: chavePessoa(r) };
    });
  return { ...montarPainel(lista, hoje), todos: quem.temPermissao(PERM.painel), servicosDisponiveis };
}

// ---------------------------------------------------------------------------
// Visão de ligação (ADR-022): números agregados do serviço para a Ficha do serviço
// ---------------------------------------------------------------------------

export interface AvaliacaoDoServico {
  ano: number;
  /** Avaliações aplicadas no ano (inclusive reavaliações). */
  avaliacoesNoAno: number;
  /** Pessoas avaliadas no ano; só a quantidade, nunca quem. */
  pessoas: number;
  indiceMedioDeCuidado: number | null;
  reavaliacoesAtrasadas: number;
}

/** Só agregados, para quem acompanha o painel do serviço (`avaliacao.painel`). Nenhum dado de pessoa. */
export async function avaliacaoDoServico(
  p: Planilhas,
  quem: Autorizador,
  servico: string,
  opcoes: { agora?: Date } = {},
): Promise<Ligacao<AvaliacaoDoServico>> {
  if (!podeVerPainel(quem, servico)) return ligacaoSemPermissao();
  const agora = opcoes.agora ?? new Date();
  const ano = Number(hojeEm(agora).slice(0, 4));
  const painel = await painelDaAvaliacao(p, quem, { servico, de: `${ano}-01`, ate: `${ano}-12` }, { agora });
  return ligacaoOk({
    ano,
    avaliacoesNoAno: painel.avaliacoes,
    pessoas: painel.total,
    indiceMedioDeCuidado: painel.mediaIndice,
    reavaliacoesAtrasadas: painel.reavaliacao.atrasadas,
  });
}
