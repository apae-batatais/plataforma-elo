'use client';

/**
 * Anexo da publicação: um PDF (até 10 MB) ou uma imagem (JPG, PNG ou WebP, reduzida aqui até 1,5 MB).
 * O arquivo vai direto para a pasta de anexos da instituição; a publicação só guarda a referência.
 * O campo escondido `anexo` leva ao servidor: vazio (mantém), "tirar" ou o código do envio com o nome.
 */
import { useRef, useState } from 'react';
import { conferirAnexo, LIMITES, mb, tipoDoAnexo } from '../dominio/publicacao';

type Iniciar = (a: { mime: string; tamanho: number }) => Promise<{ url?: string; erro?: string }>;

const LADO_MAXIMO = 1600;

async function reduzirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('Não foi possível ler esta imagem. Escolha outra.');
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(bitmap.width * escala);
  tela.height = Math.round(bitmap.height * escala);
  tela.getContext('2d')!.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();
  for (const qualidade of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', qualidade));
    if (blob && blob.size <= LIMITES.imagemBytes) return blob;
  }
  throw new Error(`A imagem continua acima de ${mb(LIMITES.imagemBytes)} mesmo reduzida.`);
}

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
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-borda-forte bg-superficie px-3 py-2 text-sm font-semibold text-texto hover:border-destaque hover:bg-destaque-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--destaque)] disabled:cursor-not-allowed disabled:opacity-50';

export function CampoAnexo({ nomeAtual, iniciar, aoMudarEnvio }: { nomeAtual: string | null; iniciar: Iniciar; aoMudarEnvio?: (enviando: boolean) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState('');
  const [nome, setNome] = useState<string | null>(nomeAtual);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function receber(arquivo: File) {
    setErro(null);
    const tipo = tipoDoAnexo(arquivo.type);
    if (!tipo) return setErro('Escolha um PDF ou uma imagem (JPG, PNG ou WebP).');
    let corpo: Blob = arquivo;
    let mime = arquivo.type;
    try {
      if (tipo === 'imagem') {
        corpo = await reduzirImagem(arquivo);
        mime = 'image/jpeg';
      }
    } catch (e) {
      return setErro((e as Error).message);
    }
    const erros = conferirAnexo({ mime, tamanho: corpo.size });
    if (erros.length) return setErro(erros.join(' '));
    setProgresso(0);
    aoMudarEnvio?.(true);
    const r = await iniciar({ mime, tamanho: corpo.size });
    if (!r.url) {
      setProgresso(null);
      aoMudarEnvio?.(false);
      return setErro(r.erro ?? 'Não foi possível enviar.');
    }
    try {
      const id = await enviarArquivo(r.url, corpo, mime, setProgresso);
      setValor(JSON.stringify({ arquivoId: id, nome: arquivo.name }));
      setNome(arquivo.name || 'anexo');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProgresso(null);
      aoMudarEnvio?.(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="anexo" value={valor} />
      <p className="text-sm font-semibold" id="rotulo-anexo">
        Anexo
      </p>
      <p className="text-sm text-texto-suave">Opcional. Um PDF de até {mb(LIMITES.pdfBytes)} ou uma imagem (JPG, PNG ou WebP, reduzida automaticamente).</p>
      {nome && progresso === null && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Anexo: {nome}</span>
          <button
            type="button"
            className={botao}
            onClick={() => {
              setValor('tirar');
              setNome(null);
            }}
          >
            Tirar anexo
          </button>
        </p>
      )}
      {progresso !== null && (
        <p className="text-sm" role="status">
          Enviando… {progresso}%
        </p>
      )}
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-labelledby="rotulo-anexo"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void receber(f);
        }}
      />
      <button type="button" className={botao} disabled={progresso !== null} onClick={() => entrada.current?.click()}>
        {nome ? 'Trocar anexo' : 'Escolher arquivo'}
      </button>
      {erro && (
        <p className="text-sm font-semibold text-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
