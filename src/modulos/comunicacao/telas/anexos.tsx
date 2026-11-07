'use client';

/**
 * Fotos e documentos no pedido de publicação (ADR-014).
 *
 * - "Tirar foto" abre a câmera direto no celular; no computador, abre a escolha de arquivo.
 *   "Escolher arquivo" aceita foto da galeria, PDF e DOCX.
 * - A foto é reduzida aqui mesmo (lado maior até 1600 px, JPG) antes do envio.
 * - O documento (PDF ou DOCX, até 10 MB) vai como está.
 * - O arquivo vai direto para a pasta de anexos; o pedido só guarda a referência.
 */
import { useEffect, useRef, useState } from 'react';
import { conferirArquivo, LIMITES_ANEXOS, mb, nomeDaFotoReduzida, tipoDoArquivo, type TipoAnexo } from '../dominio/anexos';
import { IconeFechar } from '@/ui/icones';

export interface AnexoNaFicha {
  /** Chave local (antes de existir o arquivo). */
  chave: string;
  tipo: TipoAnexo;
  nome: string;
  /** Envio novo: o código do arquivo, preenchido quando o envio termina. Anexo já guardado: o id do anexo. */
  arquivoId: string | null;
  /** Endereço para mostrar a miniatura da foto (arquivo local ou anexo já guardado). */
  previa: string | null;
  progresso: number;
  erro: string | null;
}

type Iniciar = (a: { tipo: TipoAnexo; mime: string; tamanho: number }) => Promise<{ url?: string; erro?: string }>;

const LADO_MAXIMO = 1600;

/** Reduz a foto para JPG (lado maior até 1600 px), baixando a qualidade se ainda passar do limite. */
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('Não foi possível ler esta foto. Tente tirar de novo ou escolher outra.');
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(bitmap.width * escala);
  tela.height = Math.round(bitmap.height * escala);
  tela.getContext('2d')!.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();
  for (const qualidade of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', qualidade));
    if (blob && blob.size <= LIMITES_ANEXOS.fotoBytes) return blob;
  }
  throw new Error(`A foto continua acima de ${mb(LIMITES_ANEXOS.fotoBytes)} mesmo reduzida.`);
}

/** Manda o arquivo para o endereço do envio, avisando o progresso. Devolve o id do arquivo. */
function enviarArquivo(url: string, corpo: Blob, mime: string, progresso: (p: number) => void): Promise<string> {
  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && progresso(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText) as { id?: string; erro?: string };
        if (xhr.status >= 200 && xhr.status < 300 && r.id) ok(r.id);
        else falha(new Error(r.erro ?? `O envio falhou (${xhr.status}). Tente de novo.`));
      } catch {
        falha(new Error(`O envio falhou (${xhr.status}). Tente de novo.`));
      }
    };
    xhr.onerror = () => falha(new Error('A internet caiu durante o envio. Tente de novo.'));
    xhr.send(corpo);
  });
}

const botao =
  'inline-flex items-center gap-2 rounded-lg border border-borda-forte bg-superficie px-3 py-2 text-sm font-semibold text-texto transition-colors duration-150 ease-out hover:border-destaque hover:bg-destaque-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--destaque)] disabled:cursor-not-allowed disabled:opacity-50';

export function AnexosDoPedido({
  anexos,
  mudar,
  iniciar,
}: {
  anexos: AnexoNaFicha[];
  mudar: (f: (l: AnexoNaFicha[]) => AnexoNaFicha[]) => void;
  iniciar: Iniciar;
}) {
  const foto = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cabe = anexos.length < LIMITES_ANEXOS.arquivos;

  // Libera as miniaturas locais ao sair da tela.
  const previas = useRef(new Set<string>());
  useEffect(() => {
    const lista = previas.current;
    return () => lista.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const atualizar = (chave: string, m: Partial<AnexoNaFicha>) => mudar((l) => l.map((a) => (a.chave === chave ? { ...a, ...m } : a)));

  async function receber(arquivo: File) {
    setAviso(null);
    const tipo = tipoDoArquivo(arquivo.type) ?? (arquivo.type.startsWith('image/') ? 'foto' : null);
    if (!tipo) return setAviso('Escolha uma foto (JPG, PNG ou WebP) ou um documento (PDF ou DOCX).');
    let corpo: Blob = arquivo;
    let mime = arquivo.type;
    try {
      if (tipo === 'foto') {
        // Fotos do iPhone (HEIC) e grandes viram JPG reduzido.
        corpo = await reduzirFoto(arquivo);
        mime = 'image/jpeg';
      }
    } catch (e) {
      return setAviso((e as Error).message);
    }
    const erros = conferirArquivo({ tipo, mime, tamanho: corpo.size });
    if (erros.length) return setAviso(erros.join(' '));

    const chave = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previa = tipo === 'foto' ? URL.createObjectURL(corpo) : null;
    if (previa) previas.current.add(previa);
    mudar((l) => [...l, { chave, tipo, nome: tipo === 'foto' ? nomeDaFotoReduzida(arquivo.name) : arquivo.name || 'documento', arquivoId: null, previa, progresso: 0, erro: null }]);
    const r = await iniciar({ tipo, mime, tamanho: corpo.size });
    if (!r.url) return atualizar(chave, { erro: r.erro ?? 'Não foi possível enviar.' });
    try {
      const id = await enviarArquivo(r.url, corpo, mime, (p) => atualizar(chave, { progresso: p }));
      atualizar(chave, { arquivoId: id, progresso: 100 });
    } catch (e) {
      atualizar(chave, { erro: (e as Error).message });
    }
  }

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = [...(e.target.files ?? [])];
    e.target.value = '';
    // O limite é conferido na escolha, para várias de uma vez não passarem de 5 (o servidor confere de novo).
    const vagas = Math.max(0, LIMITES_ANEXOS.arquivos - anexos.length);
    lista.slice(0, vagas).forEach((f) => void receber(f));
    if (lista.length > vagas) setAviso(`Cada pedido aceita até ${LIMITES_ANEXOS.arquivos} arquivos.`);
  };

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5 sm:p-6" aria-labelledby="t-anexos">
      <div>
        <h2 id="t-anexos" className="text-lg font-bold">
          Fotos e documentos
        </h2>
        <p className="mt-0.5 text-sm text-texto-suave">
          Opcional. Até {LIMITES_ANEXOS.arquivos} arquivos: fotos (JPG, PNG ou WebP) e documentos em PDF ou DOCX de até {mb(LIMITES_ANEXOS.documentoBytes)}. Vídeo não
          entra aqui: cole o link da pasta do Drive no campo de vídeo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={botao} disabled={!cabe} onClick={() => foto.current?.click()}>
          <IconeCamera /> Tirar foto
        </button>
        <button type="button" className={botao} disabled={!cabe} onClick={() => galeria.current?.click()}>
          Escolher arquivo
        </button>
        <input ref={foto} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolher} />
        <input
          ref={galeria}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={escolher}
        />
      </div>
      {aviso && (
        <p role="alert" className="rounded-lg bg-erro-fundo px-3 py-2 text-sm text-erro">
          {aviso}
        </p>
      )}
      {anexos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {anexos.map((a) => (
            <li
              key={a.chave}
              className={`group relative overflow-hidden rounded-lg border bg-superficie-2 transition-shadow duration-200 ease-out hover:shadow-md ${a.erro ? 'border-erro' : 'border-borda'}`}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-black/5">
                {a.tipo === 'foto' && a.previa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previa} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-sm font-semibold text-texto-suave">{a.nome.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF'}</span>
                )}
              </div>
              <div className="space-y-1 px-2 py-1.5 text-xs">
                <p className="truncate font-semibold" title={a.nome}>
                  {a.nome}
                </p>
                {a.erro ? (
                  <p className="text-erro">{a.erro}</p>
                ) : a.arquivoId ? (
                  <p className="text-sucesso">Enviado</p>
                ) : (
                  <div className="h-1.5 overflow-hidden rounded-full bg-borda" role="progressbar" aria-valuenow={a.progresso} aria-valuemin={0} aria-valuemax={100} aria-label="Enviando">
                    <div className="h-full rounded-full bg-destaque transition-[width] duration-300 ease-out" style={{ width: `${Math.max(a.progresso, 4)}%` }} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => mudar((l) => l.filter((x) => x.chave !== a.chave))}
                aria-label={`Tirar ${a.tipo === 'foto' ? 'a foto' : `o documento ${a.nome}`}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-90 transition-opacity duration-150 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--destaque)]"
              >
                <IconeFechar tamanho={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IconeCamera() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
