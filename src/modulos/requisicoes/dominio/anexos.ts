/**
 * Fotos e vídeo anexados à requisição (ADR-014). Regras puras.
 *
 * Limites (decisão da Diretoria, 04/11/2026): até 3 fotos, reduzidas no
 * celular antes do envio, e 1 vídeo de até 30 segundos e 25 MB.
 */
import { FICHA_DE_SERVICO, type Formulario } from './requisicao';

export const LIMITES_ANEXOS = {
  fotos: 3,
  videos: 1,
  /** Foto já reduzida no navegador (lado maior até 1600 px). */
  fotoBytes: 1_500_000,
  videoBytes: 25 * 1024 * 1024,
  videoSegundos: 30,
} as const;

export type TipoAnexo = 'foto' | 'video';

const FOTOS = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEOS = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];

/** Foto ou vídeo pelo tipo do arquivo; outro tipo não é aceito. */
export function tipoDoArquivo(mime: string): TipoAnexo | null {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (FOTOS.includes(m)) return 'foto';
  if (VIDEOS.includes(m)) return 'video';
  return null;
}

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

/** Confere um arquivo antes de abrir o envio. */
export function conferirArquivo(a: { tipo: TipoAnexo; mime: string; tamanho: number; duracao?: number | null }): string[] {
  const erros: string[] = [];
  const pelo = tipoDoArquivo(a.mime);
  if (!pelo || pelo !== a.tipo) erros.push(a.tipo === 'foto' ? 'Envie a foto em JPG, PNG ou WebP.' : 'Envie o vídeo em MP4, MOV, WebM ou 3GP.');
  if (!(a.tamanho > 0)) erros.push('O arquivo está vazio.');
  const limite = a.tipo === 'foto' ? LIMITES_ANEXOS.fotoBytes : LIMITES_ANEXOS.videoBytes;
  if (a.tamanho > limite) erros.push(a.tipo === 'foto' ? `A foto passa de ${mb(limite)}.` : `O vídeo tem ${mb(a.tamanho)}; o limite é ${mb(limite)}.`);
  // Tolerância de 1 s: celulares arredondam a duração.
  if (a.tipo === 'video' && a.duracao != null && a.duracao > LIMITES_ANEXOS.videoSegundos + 1)
    erros.push(`O vídeo tem ${Math.round(a.duracao)} segundos; grave até ${LIMITES_ANEXOS.videoSegundos}.`);
  return erros;
}

/** Confere a quantidade de cada tipo na requisição. */
export function conferirQuantidade(anexos: { tipo: TipoAnexo }[]): string[] {
  const fotos = anexos.filter((a) => a.tipo === 'foto').length;
  const videos = anexos.filter((a) => a.tipo === 'video').length;
  const erros: string[] = [];
  if (fotos > LIMITES_ANEXOS.fotos) erros.push(`No máximo ${LIMITES_ANEXOS.fotos} fotos por requisição.`);
  if (videos > LIMITES_ANEXOS.videos) erros.push(`No máximo ${LIMITES_ANEXOS.videos} vídeo por requisição.`);
  return erros;
}

/**
 * O tipo aceita foto e vídeo? A Administração marca no cadastro; sem marcação
 * (tipos cadastrados antes), as fichas de serviço aceitam e as de materiais não.
 */
export function aceitaAnexos(tipo: { anexos: string | null; formulario: Formulario }): boolean {
  if (tipo.anexos === 'sim') return true;
  if (tipo.anexos === 'nao') return false;
  return FICHA_DE_SERVICO[tipo.formulario];
}
