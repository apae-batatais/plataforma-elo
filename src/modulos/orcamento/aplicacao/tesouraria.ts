/**
 * Casos de uso da tesouraria (Entrega 1D.1): cadastro de contas e, na
 * sequência, saldos de fim de mês.
 *
 * Quem pode:
 * - orcamento.tesouraria.ver: Diretoria e Financeiro.
 * - orcamento.tesouraria.editar: só o Financeiro.
 *
 * Nada é apagado: conta excluída fica com ativo = FALSE e os saldos já
 * gravados continuam valendo.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Unidades } from '@/nucleo/estrutura/tabelas';
import { Fontes, Contas, type RegConta, type RegFonte } from '../dados/tabelas';
import { conferirConta, type DadosConta } from '../dominio/tesouraria';
import { nomeComparavel } from '../dominio/previsao';
import { ErroValidacaoFolha } from './folha';

/** Mesmo tipo de erro da folha: as telas já sabem mostrá-lo. */
export const ErroTesouraria = ErroValidacaoFolha;

const PERM = { ver: 'orcamento.tesouraria.ver', editar: 'orcamento.tesouraria.editar' } as const;

function exigir(quem: Autorizador, permissao: string) {
  if (!quem.temPermissao(permissao)) throw new ErroPermissao();
}

const limpar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ');
const vazioParaNulo = (t: string | null | undefined) => limpar(t) || null;
const chave = (c: { banco: string; agencia: string | null; conta: string | null }) =>
  [c.banco, c.agencia, c.conta].map((x) => nomeComparavel(limpar(x))).join('|');

export interface ContasListadas {
  ativas: RegConta[];
  excluidas: RegConta[];
  /** id → nome de todas as fontes, inclusive as excluídas. */
  fontes: Record<string, string>;
  /** Fontes ativas de uso restrito: as únicas aceitas em conta vinculada. */
  fontesRestritas: RegFonte[];
  unidades: { codigo: string; nome: string }[];
}

export async function listarContas(p: Planilhas, quem: Autorizador): Promise<ContasListadas> {
  exigir(quem, PERM.ver);
  const [contas, fontes, unidades] = await lerTabelas(p, [Contas, Fontes, Unidades] as const);
  const ordem = (a: RegConta, b: RegConta) => a.banco.localeCompare(b.banco, 'pt-BR') || (a.conta ?? '').localeCompare(b.conta ?? '', 'pt-BR');
  return {
    ativas: contas.ativos().sort(ordem),
    excluidas: contas.todos().filter((c) => !c.ativo).sort(ordem),
    fontes: Object.fromEntries(fontes.todos().map((f) => [f.id, f.nome])),
    fontesRestritas: fontes.ativos().filter((f) => f.uso === 'restrita').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    unidades: unidades.ativos().map((u) => ({ codigo: u.codigo, nome: u.nome })),
  };
}

export async function salvarConta(
  p: Planilhas,
  quem: Autorizador,
  dados: DadosConta,
  existente?: { id: string; versao: number },
): Promise<string> {
  exigir(quem, PERM.editar);
  const limpa: DadosConta = {
    ...dados,
    banco: limpar(dados.banco),
    agencia: limpar(dados.agencia),
    conta: limpar(dados.conta),
    fonteId: dados.fonteId || null,
    unidade: dados.unidade || null,
  };
  const [contas, fontes] = await lerTabelas(p, [Contas, Fontes] as const);
  const erros = conferirConta(limpa, fontes.todos());
  if (erros.length === 0 && limpa.fonteId && !fontes.porId(limpa.fonteId)) erros.push('A fonte escolhida não existe.');
  if (erros.length) throw new ErroTesouraria(erros.join(' '));

  const campos = {
    banco: limpa.banco,
    agencia: vazioParaNulo(limpa.agencia),
    conta: vazioParaNulo(limpa.conta),
    tipo: limpa.tipo,
    classe: limpa.classe,
    fonte_id: limpa.fonteId,
    unidade: limpa.unidade,
  };
  const igual = contas.todos().find((c) => c.id !== existente?.id && chave(c) === chave(campos));
  if (igual) {
    throw new ErroTesouraria(
      igual.ativo ? 'Já existe esta conta cadastrada.' : 'Já existe esta conta entre as excluídas. Reative em vez de cadastrar de novo.',
    );
  }

  if (!existente) {
    const c = await inserir(p, Contas, campos, { email: quem.email });
    await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Contas', registroId: c.id });
    return c.id;
  }
  const alvo = contas.porId(existente.id);
  if (!alvo || !alvo.ativo) throw new ErroTesouraria('Conta não encontrada.');
  const { colunasAlteradas } = await atualizar(p, Contas, existente.id, existente.versao, campos, { email: quem.email });
  if (colunasAlteradas.length) {
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Contas', registroId: existente.id, detalhes: { colunas: colunasAlteradas } });
  }
  return existente.id;
}

async function mudarSituacao(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean) {
  exigir(quem, PERM.editar);
  const [contas] = await lerTabelas(p, [Contas] as const);
  const alvo = contas.porId(id);
  if (!alvo || alvo.ativo === ativo) throw new ErroTesouraria('Conta não encontrada.');
  if (ativo) {
    const repetida = contas.ativos().some((c) => chave(c) === chave(alvo));
    if (repetida) throw new ErroTesouraria('Já existe esta conta cadastrada.');
  }
  await atualizar(p, Contas, id, versao, { ativo } as never, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'Contas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

export const excluirConta = (p: Planilhas, quem: Autorizador, id: string, versao: number) => mudarSituacao(p, quem, id, versao, false);
export const reativarConta = (p: Planilhas, quem: Autorizador, id: string, versao: number) => mudarSituacao(p, quem, id, versao, true);
