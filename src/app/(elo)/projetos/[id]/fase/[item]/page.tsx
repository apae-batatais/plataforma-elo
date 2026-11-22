import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { conteudoDe, lerFase, termoPreenchido } from '@/modulos/projetos/aplicacao/fases';
import { camposDe, ehDocumento, faseDoDocumento, itensDaFase, NOME_DOCUMENTO, type TipoDocumento } from '@/modulos/projetos/dominio/fases';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoSalvarDocumento } from '../../../acoes';

export const metadata: Metadata = { title: 'Documento do projeto' };

export default async function PaginaDocumento({ params }: { params: Promise<{ id: string; item: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id, item } = await params;
  if (!ehDocumento(item as TipoDocumento)) notFound();
  const tipo = item as TipoDocumento;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const { projeto: r } = f;
  if (!itensDaFase(r.porte, faseDoDocumento(tipo)).includes(tipo)) notFound();
  const doc = f.documentos[tipo];
  const editavel = f.podeAlterar && f.fase === faseDoDocumento(tipo) && doc?.situacao !== 'aprovado';
  const valores = doc ? conteudoDe(doc) : tipo === 'termo_abertura' && editavel ? await termoPreenchido(planilhas, usuario.autorizador, id) : {};
  const titulo = NOME_DOCUMENTO[tipo];
  const motivo = !f.podeAlterar ? 'Só quem gerencia o projeto altera esta parte. Você vê o conteúdo em leitura.' : doc?.situacao === 'aprovado' ? 'Este documento foi aprovado e está travado. Mudanças passam por pedido de mudança.' : 'Este documento só pode ser alterado enquanto o projeto está na fase correspondente e sem porta aberta.';

  return (
    <div className="max-w-3xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: r.codigo, href: `/projetos/${id}` }, { rotulo: titulo }]}
        titulo={titulo}
        descricao={`${r.codigo} · ${r.titulo}`}
      />
      {tipo === 'termo_abertura' && editavel && !doc && <Aviso tipo="info">O Termo veio preenchido com a proposta e as tolerâncias padrão da instituição. Confira e ajuste.</Aviso>}
      {!editavel && <Aviso tipo="info">{motivo}</Aviso>}
      <Secao id="t-doc" titulo={titulo} descricao={doc ? (doc.pronto ? 'Marcado como pronto.' : 'Rascunho.') : 'Ainda não preenchido.'}>
        <form action={acaoSalvarDocumento} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tipo" value={tipo} />
          {doc && <input type="hidden" name="versao_doc" value={doc.versao} />}
          {camposDe(tipo, r.tipo).map((c) => (
            <Campo key={c.nome} rotulo={c.rotulo} dica={c.dica} obrigatorio={c.obrigatorio}>
              {c.tipo === 'longo' ? (
                <textarea name={`c_${c.nome}`} rows={4} defaultValue={String(valores[c.nome] ?? '')} disabled={!editavel} className={estiloEntrada} />
              ) : (
                <input name={`c_${c.nome}`} inputMode={c.tipo === 'numero' ? 'decimal' : undefined} defaultValue={String(valores[c.nome] ?? '')} disabled={!editavel} className={estiloEntrada} />
              )}
            </Campo>
          ))}
          {editavel && (
            <div className="flex flex-wrap gap-3">
              <BotaoEnviar name="pronto" value="sim" enviando="Salvando…">Marcar como pronto</BotaoEnviar>
              <BotaoEnviar name="pronto" value="nao" variante="secundario" enviando="Salvando…">Salvar rascunho</BotaoEnviar>
            </div>
          )}
        </form>
      </Secao>
    </div>
  );
}
