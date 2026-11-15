/**
 * Encarregado de dados (DPO, LGPD). Um só atual por instituição; trocar encerra o
 * anterior (fim, ativo = FALSE) e cria outro. Só a Diretoria altera
 * (`core.dpo.gerenciar`); qualquer pessoa logada vê nome e e-mail, nunca o documento.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { atualizar, inserir, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Encarregados, type RegEncarregado } from '@/nucleo/estrutura/tabelas';
import { cnpjValido, cpfValido, soDigitos } from './documento';

export type TipoEncarregado = 'fisica' | 'juridica';

export interface DadosEncarregado {
  tipo: string;
  nome: string;
  documento: string;
  email: string;
}

const PERMISSAO = 'core.dpo.gerenciar';
const hoje = () => new Date().toISOString().slice(0, 10);

function exigir(quem: Autorizador) {
  if (!quem.temPermissao(PERMISSAO)) throw new ErroPermissao();
}

function conferir(d: DadosEncarregado) {
  const nome = d.nome.trim().replace(/\s+/g, ' ');
  if (d.tipo !== 'fisica' && d.tipo !== 'juridica') throw new ErroValidacao('Escolha se o encarregado é pessoa física ou jurídica.');
  if (!nome) throw new ErroValidacao(d.tipo === 'fisica' ? 'Informe o nome da pessoa.' : 'Informe a razão social.');
  const documento = soDigitos(d.documento);
  if (d.tipo === 'fisica' && !cpfValido(documento)) throw new ErroValidacao('CPF inválido. Confira os 11 números.');
  if (d.tipo === 'juridica' && !cnpjValido(documento)) throw new ErroValidacao('CNPJ inválido. Confira os 14 números.');
  const email = d.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroValidacao('Informe um e-mail válido.');
  return { tipo: d.tipo as TipoEncarregado, nome, documento, email };
}

const atual = (regs: RegEncarregado[]) => regs.find((r) => r.ativo !== false && !r.fim);

export interface PainelEncarregado {
  atual: RegEncarregado | null;
  historico: RegEncarregado[];
}

/** Tela de administração: mostra o documento, então registra leitura. */
export async function lerEncarregadoAdmin(p: Planilhas, quem: Autorizador): Promise<PainelEncarregado> {
  exigir(quem);
  const regs = (await lerTabela(p, Encarregados)).todos();
  const a = atual(regs) ?? null;
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Encarregados', registroId: a?.id ?? null });
  return { atual: a, historico: regs.filter((r) => r !== a).sort((x, y) => (y.inicio ?? '').localeCompare(x.inicio ?? '')) };
}

/** Página Ajuda: só nome e e-mail, para qualquer pessoa logada. */
export async function lerEncarregadoPublico(p: Planilhas, quem: Autorizador): Promise<{ nome: string; email: string } | null> {
  if (!quem.autorizado) throw new ErroPermissao();
  const a = atual((await lerTabela(p, Encarregados)).todos());
  return a ? { nome: a.nome, email: a.email } : null;
}

export async function cadastrarEncarregado(p: Planilhas, quem: Autorizador, dados: DadosEncarregado, desde = hoje()): Promise<void> {
  exigir(quem);
  const v = conferir(dados);
  const regs = (await lerTabela(p, Encarregados)).todos();
  if (atual(regs)) throw new ErroValidacao('Já existe um encarregado. Use Trocar encarregado.');
  const r = await inserir(p, Encarregados, { ...v, inicio: desde, fim: null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Encarregados', registroId: r.id });
}

export async function corrigirEncarregado(p: Planilhas, quem: Autorizador, id: string, versao: number, dados: DadosEncarregado): Promise<void> {
  exigir(quem);
  const v = conferir(dados);
  const alvo = atual((await lerTabela(p, Encarregados)).todos());
  if (!alvo || alvo.id !== id) throw new ErroValidacao('Encarregado não encontrado. Reabra a tela.');
  const { colunasAlteradas } = await atualizar(p, Encarregados, id, versao, v, { email: quem.email });
  if (colunasAlteradas.length === 0) return;
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Encarregados', registroId: id, detalhes: { colunas: colunasAlteradas } });
}

export async function trocarEncarregado(
  p: Planilhas,
  quem: Autorizador,
  id: string,
  versao: number,
  dados: DadosEncarregado,
  dataTroca = hoje(),
): Promise<void> {
  exigir(quem);
  const v = conferir(dados);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTroca)) throw new ErroValidacao('Informe a data da troca.');
  const alvo = atual((await lerTabela(p, Encarregados)).todos());
  if (!alvo || alvo.id !== id) throw new ErroValidacao('Encarregado não encontrado. Reabra a tela.');
  if (alvo.inicio && dataTroca < alvo.inicio) throw new ErroValidacao('A data da troca não pode ser anterior ao início do encarregado atual.');
  const { colunasAlteradas } = await atualizar(p, Encarregados, id, versao, { fim: dataTroca, ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Encarregados', registroId: id, detalhes: { colunas: colunasAlteradas } });
  const novo = await inserir(p, Encarregados, { ...v, inicio: dataTroca, fim: null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Encarregados', registroId: novo.id });
}
