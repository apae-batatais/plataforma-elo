/**
 * Fotos e documentos anexados ao pedido (ADR-014). Regras puras.
 *
 * Limites: até 10 arquivos por pedido (um carrossel do Instagram tem até 10 imagens; era 5 até a
 * entrega 3 da proposta #64); fotos reduzidas no navegador antes do envio; documentos PDF ou DOCX de
 * até 10 MB; vídeo MP4 ou MOV de até 100 MB, para o Reel sair pelo Elo (ADR-028). O link da pasta do
 * Drive continua valendo para vídeo que não vai pelo Elo.
 */

export const LIMITES_ANEXOS = {
  arquivos: 10,
  /** Foto já reduzida no navegador (lado maior até 1600 px). */
  fotoBytes: 1_500_000,
  documentoBytes: 10 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
} as const;

export type TipoAnexo = 'foto' | 'documento' | 'video';

const FOTOS = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEOS = ['video/mp4', 'video/quicktime'];
const DOCUMENTOS = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** Foto ou documento pelo tipo do arquivo; outro tipo não é aceito. */
export function tipoDoArquivo(mime: string): TipoAnexo | null {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (FOTOS.includes(m)) return 'foto';
  if (DOCUMENTOS.includes(m)) return 'documento';
  if (VIDEOS.includes(m)) return 'video';
  return null;
}

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

/** Confere um arquivo antes de abrir o envio (e de ligá-lo ao pedido). */
export function conferirArquivo(a: { tipo: TipoAnexo; mime: string; tamanho: number }): string[] {
  const erros: string[] = [];
  const pelo = tipoDoArquivo(a.mime);
  if (!pelo || pelo !== a.tipo)
    erros.push(a.tipo === 'foto' ? 'Envie a foto em JPG, PNG ou WebP.' : a.tipo === 'video' ? 'Envie o vídeo em MP4 ou MOV.' : 'Envie o documento em PDF ou DOCX.');
  if (!(a.tamanho > 0)) erros.push('O arquivo está vazio.');
  const limite = a.tipo === 'foto' ? LIMITES_ANEXOS.fotoBytes : a.tipo === 'video' ? LIMITES_ANEXOS.videoBytes : LIMITES_ANEXOS.documentoBytes;
  if (a.tamanho > limite)
    erros.push(
      a.tipo === 'foto' ? `A foto passa de ${mb(limite)}.` : `${a.tipo === 'video' ? 'O vídeo' : 'O documento'} tem ${mb(a.tamanho)}; o limite é ${mb(limite)}.`,
    );
  return erros;
}

/** Confere a quantidade de arquivos do pedido. */
export function conferirQuantidade(anexos: unknown[]): string[] {
  return anexos.length > LIMITES_ANEXOS.arquivos ? [`Cada pedido aceita até ${LIMITES_ANEXOS.arquivos} arquivos.`] : [];
}

/** Extensão do nome gerado para o arquivo (sem dados pessoais no nome). */
export function extensaoDoMime(mime: string): string {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (m === 'application/pdf') return 'pdf';
  if (m.endsWith('wordprocessingml.document')) return 'docx';
  if (m === 'video/quicktime') return 'mov';
  return m.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
}

export const NOME_MAXIMO = 120;

/**
 * Nome original do arquivo para guardar no pedido (dado pessoal, só quem vê o pedido o lê):
 * sem caminho, sem caracteres de controle, espaços únicos, até 120 caracteres com a extensão.
 * Vazio depois de limpar: usa o nome `padrao` (o gerado pelo Elo).
 */
export function limparNomeArquivo(nome: string | null | undefined, padrao: string): string {
  let n = String(nome ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  n = n.slice(n.lastIndexOf('/') + 1);
  n = n.slice(n.lastIndexOf('\\') + 1);
  n = n.replace(/\s+/g, ' ').trim();
  if (!n || /^\.+$/.test(n)) return padrao;
  if (n.length <= NOME_MAXIMO) return n;
  const ponto = n.lastIndexOf('.');
  const ext = ponto > 0 && n.length - ponto <= 10 ? n.slice(ponto) : '';
  return n.slice(0, NOME_MAXIMO - ext.length).trimEnd() + ext;
}

/** Nome da foto depois de reduzida no navegador (sempre JPG): mantém o nome-base original. */
export function nomeDaFotoReduzida(original: string): string {
  const n = original.trim();
  const ponto = n.lastIndexOf('.');
  const base = ponto > 0 ? n.slice(0, ponto) : n;
  return `${base || 'foto'}.jpg`;
}
