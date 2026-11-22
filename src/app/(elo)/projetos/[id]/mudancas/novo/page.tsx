import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { conteudoDe, termoAprovado } from '@/modulos/projetos/aplicacao/fases';
import { avaliarPedido, lerAcompanhamento, type PedidoAvaliado } from '@/modulos/projetos/aplicacao/acompanhamento';
import { NOME_MUDANCA, TIPOS_MUDANCA, type TipoMudanca } from '@/modulos/projetos/dominio/acompanhamento';
import { ErroProjetos } from '@/modulos/projetos/dominio/projeto';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoPedirMudanca } from '../../../acoes';

export const metadata: Metadata = { title: 'Pedido de mudança' };

type Busca = { tipo?: string; alvo?: string; proposto?: string; justificativa?: string; escopo_livre?: string };

const DESCRICAO: Record<TipoMudanca, string> = {
  prazo: 'Mudar a data de fim do projeto ou de uma atividade.',
  custo: 'Mudar o valor de uma linha do orçamento do projeto.',
  escopo: 'Mudar o que está dentro do projeto.',
};

export default async function PaginaPedidoDeMudanca({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busca> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const q = await searchParams;
  const { planilhas } = await obterAplicacao();
  const a = await lerAcompanhamento(planilhas, usuario.autorizador, id);
  if (!a) notFound();
  const tipo = (TIPOS_MUDANCA as readonly string[]).includes(q.tipo ?? '') ? (q.tipo as TipoMudanca) : null;
  const caminho = `/projetos/${id}/mudancas/novo`;
  const cabecalho = (
    <>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: a.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Mudanças', href: `/projetos/${id}/mudancas` }, { rotulo: 'Pedido de mudança' }]}
        titulo="Pedido de mudança"
        descricao="O Elo mostra a tolerância e a variação em palavras antes de você enviar."
      />
      <AbasProjeto id={id} atual="mudancas" />
    </>
  );
  if (!a.podeAlterar) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <Aviso tipo="info">Só quem gerencia o projeto pede mudança, e só com o projeto em implementação.</Aviso>
      </div>
    );
  }
  if (!tipo) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <Secao id="t-tipo" titulo="O que muda?">
          <ul className="grid gap-3 sm:grid-cols-3">
            {TIPOS_MUDANCA.map((t) => (
              <li key={t} className="rounded-cartao border border-borda p-4">
                <p className="font-semibold">{NOME_MUDANCA[t]}</p>
                <p className="mb-3 text-sm text-texto-suave">{DESCRICAO[t]}</p>
                <LinkBotao href={`${caminho}?tipo=${t}`} variante="secundario">Pedir mudança de {NOME_MUDANCA[t].toLowerCase()}</LinkBotao>
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    );
  }
  const preenchido = !!q.proposto?.trim();
  let previa: PedidoAvaliado | null = null;
  let erro: string | null = null;
  if (preenchido) {
    try {
      previa = await avaliarPedido(planilhas, usuario.autorizador, id, { tipo, alvo: q.alvo || null, proposto: q.proposto ?? '', justificativa: '', cabeNoEscopoLivre: q.escopo_livre === 'sim' });
    } catch (e) {
      if (!(e instanceof ErroProjetos)) throw e;
      erro = e.message;
    }
  }
  const escopoAtual = tipo === 'escopo' ? await escopoDoTermo(planilhas, id) : '';
  const livre = a.tolerancias?.escopoLivre?.trim() || null;
  return (
    <div className="space-y-6">
      {cabecalho}
      <Secao id="t-dados" titulo={`Mudança de ${NOME_MUDANCA[tipo].toLowerCase()}`} descricao={DESCRICAO[tipo]}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <form method="get" action={caminho} className="space-y-4">
          <input type="hidden" name="tipo" value={tipo} />
          {tipo === 'custo' && (
            <>
              <Campo rotulo="Linha do orçamento" obrigatorio>
                <select name="alvo" required defaultValue={q.alvo ?? ''} className={estiloEntrada}>
                  <option value="" disabled>Escolha</option>
                  {a.linhas.map((l) => <option key={l.id} value={l.id}>{l.rotulo} ({moeda(l.valor)})</option>)}
                </select>
              </Campo>
              <Campo rotulo="Novo valor da linha (R$)" obrigatorio dica="ex.: 6300,00">
                <input name="proposto" required inputMode="decimal" defaultValue={q.proposto ?? ''} className={estiloEntrada} />
              </Campo>
            </>
          )}
          {tipo === 'prazo' && (
            <>
              <Campo rotulo="O que muda de prazo" obrigatorio>
                <select name="alvo" required defaultValue={q.alvo ?? 'projeto'} className={estiloEntrada}>
                  <option value="projeto">Fim do projeto</option>
                  {a.atividades.map((x) => <option key={x.id} value={x.id}>Atividade: {x.rotulo} (fim em {x.fim.split('-').reverse().join('/')})</option>)}
                </select>
              </Campo>
              <Campo rotulo="Nova data de fim" obrigatorio>
                <input type="date" name="proposto" required defaultValue={q.proposto ?? ''} className={estiloEntrada} />
              </Campo>
            </>
          )}
          {tipo === 'escopo' && (
            <>
              <Campo rotulo="Novo texto do escopo" obrigatorio dica="Escreva o escopo completo como ele deve ficar. O texto atual já está aqui para você editar.">
                <textarea name="proposto" required rows={5} defaultValue={q.proposto ?? escopoAtual} className={estiloEntrada} />
              </Campo>
              {livre ? (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="escopo_livre" value="sim" defaultChecked={q.escopo_livre === 'sim'} className="mt-1 size-5" />
                  <span>
                    Esta mudança cabe no escopo livre do Termo: <span className="font-semibold">{livre}</span>
                  </span>
                </label>
              ) : (
                <p className="text-sm text-texto-suave">O Termo de Abertura não declarou escopo livre: a Diretoria decide qualquer mudança de escopo.</p>
              )}
            </>
          )}
          <Campo rotulo="Motivo da mudança" obrigatorio>
            <textarea name="justificativa" required rows={3} defaultValue={q.justificativa ?? ''} className={estiloEntrada} />
          </Campo>
          <BotaoEnviar variante="secundario" enviando="Conferindo…">Conferir a tolerância</BotaoEnviar>
        </form>
      </Secao>
      {previa && (
        <Secao id="t-previa" titulo="O que vai acontecer">
          <p className="text-base font-semibold" role="status">{previa.frase}</p>
          <p className="mt-1">{previa.quem}</p>
          <p className="mt-1 text-sm text-texto-suave">{previa.alvoNome}</p>
          <form action={acaoPedirMudanca} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="alvo" value={q.alvo ?? ''} />
            <input type="hidden" name="proposto" value={q.proposto ?? ''} />
            <input type="hidden" name="justificativa" value={q.justificativa ?? ''} />
            <input type="hidden" name="escopo_livre" value={q.escopo_livre ?? ''} />
            <input type="hidden" name="volta" value={`${caminho}?${new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string') as [string, string][]).toString()}`} />
            <BotaoEnviar enviando="Enviando…">{previa.avaliacao.dentro ? 'Aplicar a mudança' : 'Enviar pedido à Diretoria'}</BotaoEnviar>
            <p className="text-sm text-texto-suave">{previa.avaliacao.dentro ? 'A mudança vale na hora e fica no histórico.' : 'Nada muda até a decisão.'}</p>
          </form>
        </Secao>
      )}
    </div>
  );
}

async function escopoDoTermo(planilhas: Awaited<ReturnType<typeof obterAplicacao>>['planilhas'], id: string): Promise<string> {
  const t = await termoAprovado(planilhas, id);
  return t ? String(conteudoDe(t).escopo ?? '') : '';
}
