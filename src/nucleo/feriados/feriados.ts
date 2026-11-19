/**
 * Feriados da instituição (Núcleo): uma lista só, que vale para todos os apps.
 * Só a Administração da plataforma altera (`core.feriados.gerenciar`); os apps
 * apenas leem as datas (`feriadosAtivos`) para pular esses dias nas contas de prazo.
 * Nada é apagado: tirar um feriado encerra o registro (`ativo = FALSE`).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { atualizar, inserir, inserirRegistros, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Feriados, type RegFeriado } from '@/nucleo/estrutura/tabelas';
import { conferirFeriado, feriadosNacionais, type Feriado } from './calendario';

export const PERMISSAO_FERIADOS = 'core.feriados.gerenciar';

const exigir = (quem: Autorizador) => {
  if (!quem.temPermissao(PERMISSAO_FERIADOS)) throw new ErroPermissao();
};
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Datas dos feriados ativos. É a única fonte dos apps; leitura de dado não sensível, sem auditoria. */
export async function feriadosAtivos(p: Planilhas): Promise<ReadonlySet<string>> {
  return new Set((await lerTabela(p, Feriados)).ativos().map((f) => f.data));
}

/** Lista para a tela de Administração, por data. */
export async function listarFeriados(p: Planilhas, quem: Autorizador): Promise<RegFeriado[]> {
  exigir(quem);
  return (await lerTabela(p, Feriados)).ativos().sort((a, b) => a.data.localeCompare(b.data));
}

export async function incluirFeriado(p: Planilhas, quem: Autorizador, dados: { data: string; nome: string }): Promise<void> {
  exigir(quem);
  const f = conferirFeriado(dados);
  const igual = (await lerTabela(p, Feriados)).ativos().find((x) => x.data === f.data);
  if (igual) throw new ErroValidacao(`Já há feriado em ${dataBr(f.data)}: ${igual.nome}.`);
  const novo = await inserir(p, Feriados, f, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Feriados', registroId: novo.id });
}

/** Inclui os nacionais (e o de São Paulo) do ano que ainda não estão cadastrados. Devolve quantos entraram. */
export async function incluirFeriadosNacionais(p: Planilhas, quem: Autorizador, ano: number): Promise<number> {
  exigir(quem);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroValidacao('Escolha o ano.');
  const tabela = await lerTabela(p, Feriados);
  const ja = new Set(tabela.ativos().map((f) => f.data));
  const novos = feriadosNacionais(ano).filter((f) => !ja.has(f.data));
  if (!novos.length) return 0;
  await inserirRegistros(p, tabela, novos, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'Feriados', detalhes: { colunas: ['data', 'nome'] } });
  return novos.length;
}

export async function tirarFeriado(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  exigir(quem);
  const f = (await lerTabela(p, Feriados)).porId(id);
  if (!f || !f.ativo) throw new ErroValidacao('Feriado não encontrado.');
  await atualizar(p, Feriados, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'Feriados', registroId: id, detalhes: { colunas: ['ativo'] } });
}

/**
 * Migração ("Preparar estrutura"): copia para o Núcleo as datas que ainda não estão
 * na lista. Não repete data, não apaga a origem e pode rodar quantas vezes for preciso.
 */
export async function copiarFeriados(p: Planilhas, origem: readonly Feriado[], autor: string): Promise<number> {
  const tabela = await lerTabela(p, Feriados);
  const ja = new Set(tabela.ativos().map((f) => f.data));
  const novos: Feriado[] = [];
  for (const f of origem) {
    if (ja.has(f.data)) continue;
    ja.add(f.data);
    novos.push({ data: f.data, nome: f.nome });
  }
  await inserirRegistros(p, tabela, novos, { email: autor });
  return novos.length;
}
