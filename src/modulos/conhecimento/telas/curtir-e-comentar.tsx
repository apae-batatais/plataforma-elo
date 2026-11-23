'use client';

/**
 * Curtir e comentar (regras 15 a 17). O botão "Curtir" alterna e diz o estado em texto; o comentário
 * que não pôde ser enviado permanece no campo.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { LIMITES } from '../dominio/publicacao';

type Resposta = { erro: string } | { ok: true };

export function BotaoCurtir({ id, curtidas, euCurti, alternar }: { id: string; curtidas: number; euCurti: boolean; alternar: (id: string) => Promise<Resposta> }) {
  const roteador = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao
        type="button"
        variante={euCurti ? 'primario' : 'secundario'}
        aria-pressed={euCurti}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await alternar(id);
            if ('erro' in r) return setErro(r.erro);
            roteador.refresh();
          })
        }
      >
        {euCurti ? 'Curtida' : 'Curtir'}
      </Botao>
      <span className="text-sm text-texto-suave" aria-live="polite">
        {curtidas === 0 ? 'Ninguém curtiu ainda' : curtidas === 1 ? '1 pessoa curtiu' : `${curtidas} pessoas curtiram`}
      </span>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

export function FormularioComentario({ id, comentar }: { id: string; comentar: (id: string, texto: string) => Promise<Resposta> }) {
  const roteador = useRouter();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await comentar(id, texto);
          if ('erro' in r) return setErro(r.erro);
          setTexto('');
          roteador.refresh();
        });
      }}
    >
      {erro && (
        <Aviso tipo="erro" titulo="Não foi possível comentar">
          {erro}
        </Aviso>
      )}
      <Campo rotulo="Escreva um comentário" dica={`Até ${LIMITES.comentario.toLocaleString('pt-BR')} caracteres. Seu nome aparece junto.`}>
        <textarea className={estiloEntrada} rows={3} maxLength={LIMITES.comentario} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Campo>
      <Botao type="submit" disabled={pendente || !texto.trim()}>
        {pendente ? 'Enviando…' : 'Comentar'}
      </Botao>
    </form>
  );
}
