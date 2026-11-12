'use client';

/**
 * Número grande que sobe de zero até o valor ao aparecer na tela (identidade visual, "Efeitos de acabamento").
 * Recebe o texto final já formatado pelo servidor. O leitor de tela lê só o valor final, a impressão
 * sai no valor final e, com "menos movimento" no computador, o número já aparece completo.
 * Valor que muda depois (nova gravação) vai do número atual ao novo, sem recomeçar do zero.
 */
import { useEffect, useRef, useState } from 'react';
import { acharNumero, textoDaContagem } from './contagem';
import { PiscaOndeMudou } from './pisca-onde-mudou';

const DURACAO_PRIMEIRA = 600;
const DURACAO_MUDANCA = 300;

/** Com `chave`, o número também pisca depois de uma gravação que o altere (veja `PiscaOndeMudou`). */
export function NumeroQueConta({ texto, chave }: { texto: string; chave?: string }) {
  const numero = <Contador texto={texto} />;
  return chave ? <PiscaOndeMudou chave={chave}>{numero}</PiscaOndeMudou> : numero;
}

function Contador({ texto }: { texto: string }) {
  const [mostrado, setMostrado] = useState(texto);
  const caixa = useRef<HTMLSpanElement>(null);
  const atual = useRef<number | null>(null); // número visto agora; null = ainda não contou
  const quadro = useRef(0);

  useEffect(() => {
    const final = acharNumero(texto);
    const parar = () => cancelAnimationFrame(quadro.current);
    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!final || menosMovimento) {
      atual.current = final?.valor ?? null;
      setMostrado(texto);
      return parar;
    }
    const correr = (de: number, duracao: number) => {
      const t0 = performance.now();
      const passo = (agora: number) => {
        const p = (agora - t0) / duracao;
        setMostrado(textoDaContagem(texto, p, de));
        if (p < 1) quadro.current = requestAnimationFrame(passo);
        else atual.current = final.valor;
      };
      setMostrado(textoDaContagem(texto, 0, de));
      quadro.current = requestAnimationFrame(passo);
    };
    if (atual.current !== null) {
      correr(atual.current, DURACAO_MUDANCA);
      return parar;
    }
    // Primeira vez: espera aparecer na tela.
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      correr(0, DURACAO_PRIMEIRA);
      return parar;
    }
    const obs = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        obs.disconnect();
        correr(0, DURACAO_PRIMEIRA);
      }
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      parar();
    };
  }, [texto]);

  return (
    <span ref={caixa} className="relative inline-block tabular-nums">
      {/* Valor final: reserva a largura (sem pular), é o que o leitor de tela lê e o que sai na impressão. */}
      <span className="sr-only print:not-sr-only">{texto}</span>
      <span aria-hidden="true" className="invisible print:hidden">
        {texto}
      </span>
      <span aria-hidden="true" className="absolute inset-0 whitespace-nowrap print:hidden">
        {mostrado}
      </span>
    </span>
  );
}
