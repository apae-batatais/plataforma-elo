import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerEncarregadoPublico } from '@/nucleo/encarregado/encarregado';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { instituicaoAtual } from '@/plataforma/instituicao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { NOME_PLATAFORMA } from '@/ui/marca';
import { CabecalhoPagina } from '@/ui/pagina';
import { calcularPode, montarAssuntos, textoPara } from './assuntos';

export const metadata: Metadata = { title: 'Ajuda' };

/**
 * Ajuda dentro da plataforma: o passo a passo de cada tela, mostrando só o que
 * o perfil de quem está vendo pode fazer (as mesmas permissões que montam o menu).
 * O conteúdo vem de `assuntos.tsx`, o mesmo do manual completo (`/ajuda/manual`, ADR-040).
 */
export default async function Ajuda() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  const instituicao = await instituicaoAtual();
  const encarregado = await lerEncarregadoPublico((await obterAplicacao()).planilhas, a);
  const assuntos = montarAssuntos({ pode: calcularPode(a), instituicao, encarregado });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Ajuda' }]}
        titulo="Ajuda"
        descricao={`Como usar o ${NOME_PLATAFORMA} na ${instituicao.nome}. Aparecem aqui só os assuntos do seu perfil.`}
      />
      <section
        aria-label="Manual completo"
        className="flex flex-wrap items-center justify-between gap-4 rounded-cartao border border-borda bg-superficie px-5 py-4"
      >
        <div>
          <p className="font-bold">Manual completo do {NOME_PLATAFORMA}</p>
          <p className="text-sm text-texto-suave">Todas as telas e todos os perfis num documento só, para ler, imprimir ou compartilhar (PDF).</p>
        </div>
        <LinkBotao href="/ajuda/manual" target="_blank" rel="noopener" variante="secundario">
          Baixar o manual (PDF)
        </LinkBotao>
      </section>
      <nav aria-label="Assuntos" className="flex flex-wrap gap-2">
        {assuntos.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-borda bg-superficie px-3 py-1 text-sm hover:border-destaque/60">
            {s.titulo}
          </a>
        ))}
      </nav>
      <div className="space-y-3">
        {assuntos.map((s, i) => (
          <details key={s.id} id={s.id} open={i === 0} className="group scroll-mt-20 rounded-cartao border border-borda bg-superficie">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4">
              <span>
                <span className="block text-lg font-bold">{s.titulo}</span>
                <span className="block text-sm text-texto-suave">{s.resumo}</span>
              </span>
              <span aria-hidden="true" className="mt-1 text-texto-suave transition-transform group-open:rotate-90">
                ▸
              </span>
            </summary>
            <div className="border-t border-borda px-5 py-4">
              <p className="mb-3 text-sm text-texto-suave">Para: {textoPara(s)}</p>
              <div className="max-w-3xl text-[0.95rem] leading-relaxed">{s.conteudo}</div>
              {s.atalhos && s.atalhos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.atalhos.map((t) => (
                    <LinkBotao key={t.href} href={t.href} variante="secundario" className={pequeno}>
                      {t.rotulo}
                    </LinkBotao>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
