import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerInteracao } from '@/modulos/conhecimento/aplicacao/interacao';
import { lerPublicacao } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { ErroConhecimento } from '@/modulos/conhecimento/dominio/publicacao';
import { EtiquetaDaPessoa, formatarData, formatarDataHora } from '@/modulos/conhecimento/telas/rotulos';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { TesteDeCompreensao } from '@/modulos/conhecimento/telas/teste-de-compreensao';
import { BotaoCurtir, FormularioComentario } from '@/modulos/conhecimento/telas/curtir-e-comentar';
import { acaoAlternarCurtida, acaoComentar, acaoDarCiencia, acaoEnviarTeste, acaoEsconderComentario, acaoReativarComentario } from '../acoes';

export const metadata: Metadata = { title: 'Publicação' };

export default async function Publicacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  let x;
  try {
    x = await lerPublicacao(planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroPermissao)
      return (
        <section className="mx-auto max-w-2xl py-8">
          <EstadoVazio titulo="Esta publicação não é para o seu perfil" acao={<LinkBotao href="/conhecimento" variante="secundario">Voltar à biblioteca</LinkBotao>}>
            Se você acha que deveria ler, fale com quem publicou.
          </EstadoVazio>
        </section>
      );
    if (erro instanceof ErroConhecimento) notFound();
    throw erro;
  }
  const publica = usuario.autorizador.temPermissao('conhecimento.publicar');
  const interacao = x.situacao === 'rascunho' ? null : await lerInteracao(planilhas, usuario.autorizador, id);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: x.titulo }]}
        titulo={x.titulo}
        descricao={
          <>
            {x.categoriaNome} · por {x.autorNome} · {x.publicadaEm ? `publicada em ${formatarData(x.publicadaEm)}` : 'rascunho'}
          </>
        }
        acoes={publica ? <LinkBotao href={`/conhecimento/publicacoes/${x.id}/editar`} variante="secundario">Editar</LinkBotao> : undefined}
      />

      {x.situacao === 'rascunho' && <Aviso tipo="info">Rascunho: só quem publica vê esta página. Ninguém recebe pendência até publicar.</Aviso>}
      {x.situacao === 'arquivada' && <Aviso tipo="info">Publicação arquivada. Ela fica aqui só para consulta e não aceita nova ciência.</Aviso>}

      {(x.exigeCiencia || x.temTeste) && x.doPublico && x.situacao !== 'rascunho' && (
        <section aria-labelledby="t-falta" className="rounded-cartao border border-borda-forte bg-superficie p-5 md:sticky md:top-2 md:z-10">
          <h2 id="t-falta" className="flex flex-wrap items-center gap-2 text-lg font-bold">
            O que falta <EtiquetaDaPessoa situacao={x.minhaSituacao} vencida={x.vencida} />
          </h2>
          {x.minhaSituacao === 'em_dia' ? (
            <p className="mt-1">
              Em dia desde {formatarDataHora(x.minhaCienciaEm ?? x.minhaAprovacaoEm)}. Você não precisa fazer mais nada.
            </p>
          ) : null}
          {x.minhaSituacao !== 'em_dia' && x.podeFazerTeste && (
            <p className="mt-1 text-texto-suave">
              {x.minhaSituacao === 'precisa_renovar' ? 'O conteúdo mudou: leia de novo e refaça o teste abaixo.' : 'Leia o documento e responda ao teste abaixo.'}
              {x.cienciaEsperaTeste ? ' A ciência só é liberada depois de acertar todas as perguntas.' : ''}
            </p>
          )}
          {x.cienciaEsperaTeste && !x.podeDarCiencia && x.exigeCiencia && x.minhaSituacao !== 'em_dia' && (
            <p className="mt-2">
              <button type="button" disabled className="min-h-11 cursor-not-allowed rounded-md border border-borda bg-superficie-2 px-4 text-sm font-semibold text-texto-suave">
                Li e estou de acordo
              </button>
              <span className="ml-3 text-sm text-texto-suave">Disponível depois de acertar o teste.</span>
            </p>
          )}
          {x.podeDarCiencia ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-texto-suave">
                {x.minhaSituacao === 'precisa_renovar' ? 'O conteúdo mudou: leia de novo e confirme.' : 'Leia o documento e confirme que está de acordo.'}
              </p>
              <FormularioConfirmado
                acao={acaoDarCiencia}
                campos={{ id: x.id }}
                rotulo="Li e estou de acordo"
                variante="primario"
                perigoso={false}
                titulo="Confirmar ciência?"
                mensagem="Isto registra que você leu e está de acordo, com seu nome, data e hora. Não dá para desfazer."
                confirmar="Confirmar ciência"
              />
            </div>
          ) : null}
        </section>
      )}

      {x.exigeCiencia && !x.doPublico && publica && x.situacao !== 'rascunho' && (
        <Aviso tipo="info">Você vê esta publicação por poder publicar, mas não faz parte do público dela. Por isso não há ciência a dar.</Aviso>
      )}

      {x.temTeste && x.doPublico && x.situacao === 'publicada' && (
        <Secao titulo="Teste de compreensão" id="t-teste" descricao="Acerte todas as perguntas. Pode tentar quantas vezes precisar; errar não avisa ninguém.">
          {x.podeFazerTeste ? (
            <TesteDeCompreensao id={x.id} perguntas={x.perguntas} enviar={acaoEnviarTeste} cienciaDepois={x.exigeCiencia} />
          ) : x.perguntas.length === 0 ? (
            <Aviso tipo="info">O teste ainda não tem perguntas. Fale com quem publicou.</Aviso>
          ) : (
            <p>Você já acertou o teste desta versão{x.minhaAprovacaoEm ? ` em ${formatarDataHora(x.minhaAprovacaoEm)}` : ''}.</p>
          )}
        </Secao>
      )}

      <Secao titulo="Conteúdo" id="t-conteudo">
        {x.resumo && <p className="mb-4 text-lg text-texto-suave">{x.resumo}</p>}
        {x.corpo ? <div className="max-w-prose space-y-3 whitespace-pre-wrap leading-relaxed">{x.corpo}</div> : !x.anexoNome && <p className="text-texto-suave">Sem texto.</p>}
        {x.anexoNome && (
          <div className="mt-5 space-y-3 border-t border-borda pt-4">
            <p className="flex flex-wrap items-center gap-2">
              <Etiqueta tipo="info">{x.anexoTipo === 'pdf' ? 'PDF' : 'Imagem'}</Etiqueta>
              <span className="font-semibold">{x.anexoNome}</span>
            </p>
            {x.anexoTipo === 'imagem' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/conhecimento/anexos/${x.id}`} alt={`Imagem anexada: ${x.anexoNome}`} className="max-h-[32rem] max-w-full rounded-lg border border-borda" />
            ) : (
              <LinkBotao href={`/conhecimento/anexos/${x.id}`} target="_blank" rel="noopener" variante="secundario">
                Abrir PDF
              </LinkBotao>
            )}
          </div>
        )}
      </Secao>

      {interacao && (
        <Secao titulo="Curtir e comentar" id="t-comentarios">
          <div className="space-y-5">
            {interacao.podeInteragir ? (
              <BotaoCurtir id={x.id} curtidas={interacao.curtidas} euCurti={interacao.euCurti} alternar={acaoAlternarCurtida} />
            ) : (
              <p className="text-sm text-texto-suave">
                {interacao.curtidas === 1 ? '1 pessoa curtiu' : `${interacao.curtidas} pessoas curtiram`}. Publicação arquivada: não recebe novas curtidas nem comentários.
              </p>
            )}
            {interacao.comentarios.length === 0 ? (
              <p className="text-texto-suave">Ainda não há comentários.</p>
            ) : (
              <ul className="space-y-3">
                {interacao.comentarios.map((c) => (
                  <li key={c.id} className={`rounded-cartao border border-borda p-4 ${c.escondido ? 'bg-superficie-2' : 'bg-superficie'}`}>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                      <span className="font-semibold text-texto">{c.nome}</span>
                      <span>{formatarDataHora(c.criadoEm)}</span>
                      {c.escondido && <Etiqueta tipo="atencao">Escondido</Etiqueta>}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{c.texto}</p>
                    {publica && (
                      <div className="mt-2">
                        {c.escondido ? (
                          <FormularioConfirmado
                            acao={acaoReativarComentario}
                            campos={{ id: c.id, versao: c.versao, publicacao: x.id }}
                            rotulo="Reativar"
                            variante="secundario"
                            pequeno
                            perigoso={false}
                            titulo="Reativar comentário?"
                            mensagem="O comentário volta a aparecer para todos."
                            confirmar="Reativar"
                          />
                        ) : (
                          <FormularioConfirmado
                            acao={acaoEsconderComentario}
                            campos={{ id: c.id, versao: c.versao, publicacao: x.id }}
                            rotulo="Esconder"
                            variante="secundario"
                            pequeno
                            titulo="Esconder comentário?"
                            mensagem="O comentário some para todos; fica guardado e pode ser reativado."
                            confirmar="Esconder"
                          />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {interacao.podeInteragir && <FormularioComentario id={x.id} comentar={acaoComentar} />}
          </div>
        </Secao>
      )}
    </div>
  );
}
