import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerEncarregadoPublico } from '@/nucleo/encarregado/encarregado';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { instituicaoAtual } from '@/plataforma/instituicao';
import { usuarioLogado } from '@/plataforma/sessao';
import { NOME_PLATAFORMA, textoVersao } from '@/ui/marca';
import { autorizadorTotal, calcularPode, caminhoDoAtalho, montarAssuntos, telasDoMenu, menuCompleto, textoPara } from '../assuntos';
import { BarraManual } from './barra-manual';

export const metadata: Metadata = { title: 'Manual' };

/**
 * Manual completo: todos os assuntos da Ajuda, cada um com "Para: <perfis>". Vira PDF pela impressão
 * do navegador (ADR-040); nenhum arquivo PDF fica no repositório.
 */
export default async function Manual() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const instituicao = await instituicaoAtual();
  const encarregado = await lerEncarregadoPublico((await obterAplicacao()).planilhas, usuario.autorizador);
  const assuntos = montarAssuntos({ pode: calcularPode(autorizadorTotal(), true), instituicao, encarregado });
  const telas = telasDoMenu(menuCompleto());
  const data = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-3xl">
      <BarraManual />
      <header className="mb-8 border-b border-borda pb-8 print:break-after-page print:border-0">
        <h1 className="text-3xl font-bold">Manual do {NOME_PLATAFORMA}</h1>
        <p className="mt-1 text-lg text-texto-suave">{instituicao.nome}</p>
        <p className="mt-4 text-sm text-texto-suave">
          Versão {textoVersao()} · gerado em {data}
        </p>
        <p className="mt-1 text-sm text-texto-suave">Este manual traz todos os assuntos; em cada um, “Para” diz quais perfis usam a tela.</p>
        <nav aria-label="Assuntos do manual" className="mt-6">
          <h2 className="mb-2 font-semibold">Assuntos</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {assuntos.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>
      <div className="space-y-10 print:space-y-0">
        {assuntos.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6 print:break-before-page">
            <h2 className="text-2xl font-bold print:break-after-avoid">{s.titulo}</h2>
            <p className="mt-1 text-sm text-texto-suave print:break-after-avoid">Para: {textoPara(s)}</p>
            <p className="mt-2 text-texto-suave print:break-after-avoid">{s.resumo}</p>
            <div className="mt-4 max-w-3xl text-[0.95rem] leading-relaxed">{s.conteudo}</div>
            {s.atalhos && s.atalhos.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold">Onde fica</h3>
                <ul className="list-disc space-y-1 pl-5 text-[0.95rem]">
                  {s.atalhos.map((t) => (
                    <li key={t.href}>{caminhoDoAtalho(t, telas)}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
