/**
 * Anexo da publicação (ADR-014, regra 3): abrir o envio e entregar o arquivo só a quem vê a publicação.
 * O navegador manda o arquivo direto para a pasta de anexos; a publicação guarda a referência.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { lerTrechoDeAnexo, TRECHO_MAXIMO } from '@/nucleo/armazenamento/leitura-de-anexo';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { PublicacoesConhecimento } from '../dados/tabelas';
import { conferirAnexo, ErroConhecimento, extensaoDoMime } from '../dominio/publicacao';
import { carregarPublico, diaDe, PERM } from './base';

export { TRECHO_MAXIMO };

export async function iniciarEnvioAnexo(
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  a: { mime: string; tamanho: number; origem: string },
): Promise<{ url: string }> {
  if (!quem.temPermissao(PERM.publicar)) throw new ErroPermissao();
  if (!arquivos) throw new ErroConhecimento('Anexos ainda não estão ativos nesta instituição.');
  const erros = conferirAnexo(a);
  if (erros.length) throw new ErroConhecimento(erros.join(' '));
  // Nome na pasta do Drive sem dado pessoal: só o dia e um código curto.
  const nome = `conhecimento-${diaDe(new Date())}-${Date.now().toString(36)}.${extensaoDoMime(a.mime)}`;
  return arquivos.iniciarEnvio({ nome, tipo: a.mime, tamanho: a.tamanho, origem: a.origem });
}

/** Mesma regra de `lerPublicacao`: o público, quem publica, e (arquivada) quem já deu ciência. */
async function autorizar(p: Planilhas, quem: Autorizador, arquivos: ArmazenamentoArquivos | null, id: string) {
  if (!arquivos) throw new ErroConhecimento('Anexos não estão ativos nesta instituição.');
  if (!quem.temPermissaoAlgumEscopo(PERM.acessar)) throw new ErroPermissao();
  const [publicacoes] = await lerTabelas(p, [PublicacoesConhecimento] as const);
  const x = publicacoes.porId(id);
  if (!x || !x.ativo || !x.anexo_id || !x.anexo_mime || !x.anexo_tamanho) throw new ErroConhecimento('Anexo não encontrado.');
  if (!quem.temPermissao(PERM.publicar)) {
    const doPublico = (await carregarPublico(p, new Date())).membros(x).includes(quem.email);
    if (x.situacao === 'rascunho' || !doPublico) throw new ErroPermissao('Você não tem acesso a este anexo.');
  }
  return { x, arquivos };
}

/** Abre o anexo inteiro: confere quem vê, registra a leitura uma vez e devolve a função que lê cada trecho. */
export async function abrirAnexo(p: Planilhas, quem: Autorizador, arquivos: ArmazenamentoArquivos | null, id: string) {
  const { x, arquivos: pasta } = await autorizar(p, quem, arquivos, id);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'PublicacoesConhecimento', registroId: x.id });
  const total = x.anexo_tamanho!;
  return {
    tipo: x.anexo_mime!,
    total,
    nome: x.anexo_nome ?? 'anexo',
    lerTrecho: (inicio: number) => pasta.ler(x.anexo_id!, { inicio, fim: Math.min(inicio + TRECHO_MAXIMO, total) - 1 }),
  };
}

/** Lê um trecho (pedido com faixa); cada trecho lido fica na auditoria (ADR-033). */
export async function lerTrechoDoAnexo(p: Planilhas, quem: Autorizador, arquivos: ArmazenamentoArquivos | null, id: string, trecho: { inicio: number; fim: number | null }) {
  const { x, arquivos: pasta } = await autorizar(p, quem, arquivos, id);
  return lerTrechoDeAnexo(
    p,
    pasta,
    { id: x.id, arquivo_id: x.anexo_id!, tamanho: x.anexo_tamanho!, mime: x.anexo_mime! },
    trecho,
    { usuario: quem.email, entidade: 'PublicacoesConhecimento' },
  );
}
