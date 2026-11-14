'use client';

/**
 * Faz os valores de um gráfico se moverem: ao entrar na tela (uma vez) saem da linha de base e,
 * quando os dados mudam (ano, aba, filtro), vão da posição antiga até a nova, em 0,4 s.
 * Com "menos movimento" no computador, os valores aparecem direto. No fim a posição é a exata.
 * O gráfico não pode ser remontado na troca (sem `key` do ano): o mesmo componente recebe os dados novos.
 */
import { useEffect, useRef, useState } from 'react';
import { DURACAO_MS, facilitar, interpolarValores, partidaNaBase, type ValoresPorSerie } from './movimento';

function menosMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useValoresAnimados(
  alvo: ValoresPorSerie,
  { base = 0, abrirNoLugar = false }: { base?: number; /** Linhas: os valores já ficam no lugar e a linha é revelada da esquerda para a direita (use `abertura`). */ abrirNoLugar?: boolean } = {},
) {
  const ref = useRef<HTMLElement>(null);
  const chave = JSON.stringify(alvo);
  const alvoRef = useRef(alvo);
  alvoRef.current = alvo;
  const [valores, setValores] = useState<ValoresPorSerie>(() => (abrirNoLugar ? alvo : partidaNaBase(alvo, base)));
  const mostrado = useRef(valores);
  mostrado.current = valores;
  const [visivel, setVisivel] = useState(false);
  const [abertura, setAbertura] = useState(abrirNoLugar ? 0 : 1);
  const abriu = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        setVisivel(true);
        obs.disconnect();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const destino = alvoRef.current;
    const primeira = !abriu.current;
    abriu.current = true;
    if (menosMovimento()) {
      setValores(destino);
      setAbertura(1);
      return;
    }
    const de = mostrado.current;
    const t0 = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = (agora - t0) / DURACAO_MS;
      setValores(interpolarValores(de, destino, t, base));
      if (primeira && abrirNoLugar) setAbertura(facilitar(t));
      if (t < 1) quadro = requestAnimationFrame(passo);
      else setAbertura(1);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // `chave` muda quando os dados mudam; `alvoRef` sempre tem os dados atuais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, chave]);

  return { ref, valores, abertura };
}
