/**
 * Fotos e documentos do pedido (ADR-014): abrir o envio, ligar os arquivos ao pedido e abrir o anexo.
 *
 * O navegador manda o arquivo direto para a pasta de anexos da instituição; o pedido só guarda
 * a referência (aba Anexos). Ninguém abre o arquivo pelo Drive: o Elo lê e entrega só a quem
 * pode ver o pedido, registrando cada abertura na auditoria. Nada é apagado: anexo tirado
 * num ajuste ou na revisão fica com `ativo = FALSE`.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { ArmazenamentoArquivos } from '@/nucleo/armazenamento/arquivos';
import { atualizarVarios, inserirRegistros, lerTabelas, type Planilhas, type TabelaLida } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { AnexosComunicacao, PedidosComunicacao, type RegAnexo } from '../dados/tabelas';
import { conferirArquivo, conferirQuantidade, extensaoDoMime, type TipoAnexo } from '../dominio/anexos';
import { ErroComunicacao } from '../dominio/pedido';
import { diaEmBrasilia } from '../dominio/prazos';

/** Maior trecho entregue de uma vez (o servidor da hospedagem limita o tamanho da resposta). */
export const TRECHO_MAXIMO = 4 * 1024 * 1024;

/**
 * O que o formulário manda de cada arquivo. `arquivoId` é o código dado pelo envio (arquivo novo)
 * ou o `id` do anexo que já está no pedido (para mantê-lo): o código do arquivo guardado é sensível
 * e não sai do servidor.
 */
export interface AnexoPedido {
  arquivoId: string;
  tipo: TipoAnexo;
}

type LinhaAnexo = { tipo: TipoAnexo; arquivo_id: string; nome: string; mime: string; tamanho: number };

/** Resultado da conferência: o que fica, o que entra e o que sai do pedido. */
export interface PlanoAnexos {
  tabela: TabelaLida<typeof AnexosComunicacao.esquema>;
  /** Como o pedido fica (os que já estavam e os novos). */
  finais: { tipo: TipoAnexo }[];
  novos: LinhaAnexo[];
  tirados: RegAnexo[];
  /** Algum anexo muda (entra ou sai)? */
  mudou: boolean;
}

/**
 * Confere os arquivos que vão ficar ligados ao pedido (já enviados à pasta de anexos).
 * `anexos` indefinido deixa os anexos como estão. Nada é gravado aqui.
 */
export async function conferirAnexosDoPedido(
  p: Planilhas,
  arquivos: ArmazenamentoArquivos | null,
  anexos: AnexoPedido[] | undefined,
  pedidoId: string | null,
): Promise<PlanoAnexos> {
  const [tabela] = await lerTabelas(p, [AnexosComunicacao] as const);
  const atuais = tabela.ativos().filter((a) => a.pedido_id === pedidoId);
  if (anexos === undefined) return { tabela, finais: atuais, novos: [], tirados: [], mudou: false };
  const erros = conferirQuantidade(anexos);
  if (anexos.length && !arquivos) throw new ErroComunicacao('Fotos e documentos ainda não estão ativos nesta instituição. Envie sem anexo e descreva o pedido.');
  const emOutroPedido = new Set(
    tabela
      .ativos()
      .filter((a) => a.pedido_id !== pedidoId)
      .map((a) => a.arquivo_id),
  );
  const jaNoPedido = new Map(atuais.flatMap((a) => [[a.arquivo_id, a] as const, [a.id, a] as const]));
  const vistos = new Set<string>();
  const finais: { tipo: TipoAnexo }[] = [];
  const novos: LinhaAnexo[] = [];
  for (const a of anexos) {
    const existente = jaNoPedido.get(a.arquivoId);
    const chave = existente?.arquivo_id ?? a.arquivoId;
    if (vistos.has(chave)) {
      erros.push('Um dos arquivos está repetido.');
      continue;
    }
    vistos.add(chave);
    // Quem já estava no pedido continua sem nova conferência (o arquivo pode ter ido para a lixeira depois).
    if (existente) {
      finais.push({ tipo: existente.tipo });
      continue;
    }
    if (emOutroPedido.has(a.arquivoId)) {
      erros.push('Um dos arquivos já pertence a outro pedido.');
      continue;
    }
    const f = await arquivos!.conferir(a.arquivoId);
    if (!f) {
      erros.push('Um dos arquivos não chegou à pasta de anexos. Envie de novo.');
      continue;
    }
    erros.push(...conferirArquivo({ tipo: a.tipo, mime: f.tipo, tamanho: f.tamanho }));
    finais.push({ tipo: a.tipo });
    novos.push({ tipo: a.tipo, arquivo_id: f.id, nome: f.nome.slice(0, 120), mime: f.tipo, tamanho: f.tamanho });
  }
  if (erros.length) throw new ErroComunicacao([...new Set(erros)].join(' '));
  const tirados = atuais.filter((a) => !vistos.has(a.arquivo_id));
  return { tabela, finais, novos, tirados, mudou: novos.length > 0 || tirados.length > 0 };
}

/** Grava o plano: os tirados são encerrados (`ativo = FALSE`), os novos entram. Auditoria só com colunas. */
export async function gravarAnexos(p: Planilhas, quem: Autorizador, plano: PlanoAnexos, pedidoId: string, agora: Date): Promise<void> {
  if (!plano.mudou) return;
  const autoria = { email: quem.email, agora: () => agora };
  if (plano.tirados.length) {
    await atualizarVarios(
      p,
      AnexosComunicacao,
      plano.tirados.map((a) => ({ id: a.id, versao: a.versao, mudancas: { ativo: false } })),
      autoria,
    );
    await registrarAuditoria(p, { usuario: quem.email, acao: 'alteracao', entidade: 'AnexosComunicacao', registroId: pedidoId, detalhes: { colunas: ['ativo'] } }, agora);
  }
  if (plano.novos.length) {
    await inserirRegistros(
      p,
      plano.tabela,
      plano.novos.map((l) => ({ ...l, pedido_id: pedidoId })),
      autoria,
    );
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'inclusao', entidade: 'AnexosComunicacao', registroId: pedidoId, detalhes: { colunas: [...Object.keys(plano.novos[0]), 'pedido_id'] } },
      agora,
    );
  }
}

/**
 * Abre o envio de uma foto ou documento para a pasta de anexos. O navegador manda o arquivo
 * direto para lá; o vínculo com o pedido só nasce quando o pedido é enviado, ajustado ou revisado.
 */
export async function iniciarEnvioAnexoComunicacao(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  a: { tipo: TipoAnexo; mime: string; tamanho: number; origem: string },
): Promise<{ url: string }> {
  if (!quem.temPermissaoAlgumEscopo('comunicacao.solicitar') && !quem.temPermissao('comunicacao.revisar')) throw new ErroPermissao();
  if (!arquivos) throw new ErroComunicacao('Fotos e documentos ainda não estão ativos nesta instituição.');
  const erros = conferirArquivo(a);
  if (erros.length) throw new ErroComunicacao(erros.join(' '));
  // Nome sem dados pessoais: só o dia, o tipo e um código curto.
  const nome = `comunicacao-${diaEmBrasilia(new Date())}-${a.tipo}-${Date.now().toString(36)}.${extensaoDoMime(a.mime)}`;
  return arquivos.iniciarEnvio({ nome, tipo: a.mime, tamanho: a.tamanho, origem: a.origem });
}

/**
 * Lê um trecho de um anexo para mostrar no Elo, só para quem pode ver o pedido
 * (quem pediu ou quem vê todos). A abertura (primeiro trecho) fica na auditoria.
 */
export async function lerAnexoComunicacao(
  p: Planilhas,
  quem: Autorizador,
  arquivos: ArmazenamentoArquivos | null,
  anexoId: string,
  trecho: { inicio: number; fim: number | null },
) {
  if (!arquivos) throw new ErroComunicacao('Fotos e documentos não estão ativos nesta instituição.');
  const [anexos, pedidos] = await lerTabelas(p, [AnexosComunicacao, PedidosComunicacao] as const);
  const anexo = anexos.porId(anexoId);
  if (!anexo || !anexo.ativo) throw new ErroComunicacao('Anexo não encontrado.');
  const r = pedidos.porId(anexo.pedido_id);
  // Mesma regra de quem vê o pedido (pedidos.ts); repetida aqui para não criar ciclo entre os arquivos.
  if (!r || !r.ativo || !(r.solicitante === quem.email || quem.temPermissao('comunicacao.ver_todos')))
    throw new ErroPermissao('Você não tem acesso a este anexo.');
  const inicio = Math.max(0, Math.min(trecho.inicio, anexo.tamanho - 1));
  const fim = Math.min(trecho.fim ?? anexo.tamanho - 1, inicio + TRECHO_MAXIMO - 1, anexo.tamanho - 1);
  const lido = await arquivos.ler(anexo.arquivo_id, { inicio, fim });
  if (inicio === 0) await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'AnexosComunicacao', registroId: anexo.id });
  return { ...lido, tipo: anexo.mime };
}
