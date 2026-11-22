/**
 * Casos de uso dos veículos institucionais (proposta #229, entrega 1: cadastro e manutenção).
 *
 * Quem pode: só a Administração da plataforma (`requisicoes.veiculos.cadastrar`). Nada é apagado:
 * veículo desativado some da lista de pedido novo; manutenção encerrada ou feita fica guardada.
 * Toda gravação registra a auditoria só com as colunas alteradas.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { VeiculoManutencoes, Veiculos, type RegManutencao, type RegVeiculo } from '../dados/tabelas';
import { conferirVeiculo, dataValida, normalizarPlaca, type DadosVeiculo } from '../dominio/veiculo';
import { ErroRequisicao } from '../dominio/requisicao';

const PERMISSAO = 'requisicoes.veiculos.cadastrar';
const dia = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10); // Brasília

function exigirPermissao(quem: Autorizador) {
  if (!quem.temPermissao(PERMISSAO)) throw new ErroPermissao();
}

/** Marcar a manutenção como feita é da Administração e do Transporte (regra 8). */
function exigirPermissaoDeManutencao(quem: Autorizador) {
  if (!quem.temPermissao(PERMISSAO) && !quem.temPermissaoAlgumEscopo('requisicoes.veiculos.operar')) throw new ErroPermissao();
}

/** A manutenção pendente de cada veículo (linha ativa sem `feita_em`). */
function pendentes(manutencoes: RegManutencao[]) {
  return new Map(manutencoes.filter((m) => m.ativo && !m.feita_em).map((m) => [m.veiculo_id, m]));
}

export interface VeiculoListado extends RegVeiculo {
  manutencaoPrevista: string | null;
  manutencaoId: string | null;
  manutencaoVersao: number | null;
  /** Última manutenção feita (AAAA-MM-DD), para a pessoa saber quando foi. */
  ultimaManutencao: string | null;
}

export async function listarVeiculos(p: Planilhas, quem: Autorizador) {
  exigirPermissao(quem);
  const [veiculos, manutencoes] = await lerTabelas(p, [Veiculos, VeiculoManutencoes] as const);
  const pend = pendentes(manutencoes.todos());
  const feitas = new Map<string, string>();
  for (const m of manutencoes.todos())
    if (m.feita_em && (feitas.get(m.veiculo_id) ?? '') < m.feita_em) feitas.set(m.veiculo_id, m.feita_em);
  const ordem = (l: RegVeiculo[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const montar = (v: RegVeiculo): VeiculoListado => ({
    ...v,
    manutencaoPrevista: pend.get(v.id)?.data_prevista ?? null,
    manutencaoId: pend.get(v.id)?.id ?? null,
    manutencaoVersao: pend.get(v.id)?.versao ?? null,
    ultimaManutencao: feitas.get(v.id) ?? null,
  });
  return {
    ativos: ordem(veiculos.ativos()).map(montar),
    excluidos: ordem(veiculos.todos().filter((v) => !v.ativo)).map(montar),
  };
}

export async function salvarVeiculo(p: Planilhas, quem: Autorizador, dados: DadosVeiculo, existente?: { id: string; versao: number }) {
  exigirPermissao(quem);
  const erros = conferirVeiculo(dados);
  const [veiculos] = await lerTabelas(p, [Veiculos] as const);
  const placa = normalizarPlaca(dados.placa);
  const igual = veiculos.todos().find((v) => v.id !== existente?.id && normalizarPlaca(v.placa) === placa);
  if (igual) erros.push(igual.ativo ? `A placa ${placa} já está cadastrada em "${igual.nome}".` : `A placa ${placa} é de "${igual.nome}", que está entre os excluídos: reative em vez de cadastrar de novo.`);
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  const campos = { nome: dados.nome.trim().replace(/\s+/g, ' '), placa, capacidade: dados.capacidade };
  if (!existente) {
    const v = await inserir(p, Veiculos, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Veiculos', registroId: v.id });
    return v.id;
  }
  const { colunasAlteradas } = await atualizar(p, Veiculos, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length)
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Veiculos', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  return existente.id;
}

export async function mudarSituacaoVeiculo(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  exigirPermissao(quem);
  const [veiculos] = await lerTabelas(p, [Veiculos] as const);
  const v = veiculos.porId(id);
  if (!v || v.ativo === ativo) throw new ErroRequisicao('Veículo não encontrado.');
  await atualizar(p, Veiculos, id, versao, { ativo }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: ativo ? 'alteracao' : 'encerramento', entidade: 'Veiculos', registroId: id, detalhes: { colunas: ['ativo'] } });
}

/**
 * Define (ou muda) a data prevista da manutenção pendente do veículo. Data vazia encerra a pendente.
 * No máximo uma pendente por veículo: a existente é alterada, nunca duplicada.
 */
export async function definirManutencaoPrevista(p: Planilhas, quem: Autorizador, veiculoId: string, data: string | null) {
  exigirPermissao(quem);
  const [veiculos, manutencoes] = await lerTabelas(p, [Veiculos, VeiculoManutencoes] as const);
  if (!veiculos.porId(veiculoId)) throw new ErroRequisicao('Veículo não encontrado.');
  const atual = pendentes(manutencoes.todos()).get(veiculoId);
  if (data !== null && !dataValida(data)) throw new ErroRequisicao('Informe a data prevista da manutenção.');
  if (data === null) {
    if (!atual) return;
    await atualizar(p, VeiculoManutencoes, atual.id, atual.versao, { ativo: false }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'VeiculoManutencoes', registroId: atual.id, detalhes: { colunas: ['ativo'] } });
    return;
  }
  if (!atual) {
    const m = await inserir(p, VeiculoManutencoes, { veiculo_id: veiculoId, data_prevista: data, feita_em: null, feita_por: null }, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'VeiculoManutencoes', registroId: m.id });
    return;
  }
  const { colunasAlteradas } = await atualizar(p, VeiculoManutencoes, atual.id, atual.versao, { data_prevista: data }, { email: quem.email });
  if (colunasAlteradas.length)
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'VeiculoManutencoes', registroId: atual.id, detalhes: { colunas: colunasAlteradas } });
}

/** Marca a manutenção pendente como feita e, se informada, cria a próxima (nunca antes de hoje). */
export async function marcarManutencaoFeita(
  p: Planilhas,
  quem: Autorizador,
  veiculoId: string,
  proxima: string | null,
  opcoes: { agora?: Date } = {},
) {
  exigirPermissaoDeManutencao(quem);
  const agora = opcoes.agora ?? new Date();
  const hoje = dia(agora);
  const [veiculos, manutencoes] = await lerTabelas(p, [Veiculos, VeiculoManutencoes] as const);
  if (!veiculos.porId(veiculoId)) throw new ErroRequisicao('Veículo não encontrado.');
  const atual = pendentes(manutencoes.todos()).get(veiculoId);
  if (!atual) throw new ErroRequisicao('Este veículo não tem manutenção prevista para marcar como feita.');
  if (proxima !== null) {
    if (!dataValida(proxima)) throw new ErroRequisicao('Informe a próxima data no formato dia/mês/ano.');
    if (proxima < hoje) throw new ErroRequisicao('A próxima manutenção não pode ser antes de hoje.');
  }
  const { colunasAlteradas } = await atualizar(p, VeiculoManutencoes, atual.id, atual.versao, { feita_em: hoje, feita_por: quem.email }, { email: quem.email, agora: () => agora });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'VeiculoManutencoes', registroId: atual.id, detalhes: { colunas: colunasAlteradas } });
  if (proxima !== null) {
    const m = await inserir(p, VeiculoManutencoes, { veiculo_id: veiculoId, data_prevista: proxima, feita_em: null, feita_por: null }, { email: quem.email, agora: () => agora });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'VeiculoManutencoes', registroId: m.id });
  }
}
