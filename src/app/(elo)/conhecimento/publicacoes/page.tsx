import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPublicacoes } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoArquivar, acaoReativar } from '../acoes';

export const metadata: Metadata = { title: 'Publicações' };

export default async function Publicacoes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('conhecimento.publicar')) redirect('/conhecimento');
  const { planilhas } = await obterAplicacao();
  const lista = await listarPublicacoes(planilhas, usuario.autorizador);
  const nova = <LinkBotao href="/conhecimento/publicacoes/nova">Nova publicação</LinkBotao>;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Publicações' }]}
        titulo="Publicações"
        descricao="Crie, edite e arquive comunicados, normas e material de referência."
        acoes={nova}
      />
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhuma publicação ainda" acao={nova}>
          Crie a primeira e escolha quem deve ler.
        </EstadoVazio>
      ) : (
        <TabelaDados
          legenda="Publicações"
          colunas={[
            { chave: 'titulo', rotulo: 'Título' },
            { chave: 'categoria', rotulo: 'Categoria' },
            { chave: 'situacao', rotulo: 'Situação' },
            { chave: 'edicao', rotulo: 'Versão', tipo: 'numero' },
            { chave: 'publico', rotulo: 'Para quem' },
            { chave: 'emDia', rotulo: 'Em dia' },
            { chave: 'acoes', rotulo: 'Ações', fixa: true },
          ]}
          linhas={lista.map((l) => ({
            id: l.id,
            valores: {
              titulo: l.titulo,
              categoria: l.categoriaNome,
              situacao: l.situacao,
              edicao: l.edicao,
              publico: l.publico,
              emDia: l.exigeCiencia && l.situacao !== 'rascunho' ? `${l.emDia} de ${l.total} em dia` : 'Sem exigência',
              acoes: null,
            },
            celulas: {
              titulo: (
                <Link href={`/conhecimento/${l.id}`} className="font-semibold text-destaque underline-offset-2 hover:underline">
                  {l.titulo}
                </Link>
              ),
              situacao: <Etiqueta tipo={l.situacao === 'publicada' ? 'sucesso' : 'neutro'}>{{ rascunho: 'Rascunho', publicada: 'Publicada', arquivada: 'Arquivada' }[l.situacao]}</Etiqueta>,
              acoes: (
                <span className="flex flex-wrap gap-2">
                  <LinkBotao href={`/conhecimento/publicacoes/${l.id}/editar`} variante="secundario" className="!min-h-8 !px-3 !py-1 !text-sm">
                    Editar
                  </LinkBotao>
                  {l.situacao === 'publicada' && (
                    <FormularioConfirmado
                      acao={acaoArquivar}
                      campos={{ id: l.id, versao: l.versao }}
                      rotulo="Arquivar"
                      variante="perigo"
                      pequeno
                      titulo={`Arquivar “${l.titulo}”?`}
                      mensagem="A publicação some das listas e das pendências. O registro de quem deu ciência é mantido e você pode reativá-la depois."
                      confirmar="Arquivar"
                    />
                  )}
                  {l.situacao === 'arquivada' && (
                    <FormularioConfirmado
                      acao={acaoReativar}
                      campos={{ id: l.id, versao: l.versao }}
                      rotulo="Reativar"
                      variante="fantasma"
                      pequeno
                      perigoso={false}
                      titulo={`Reativar “${l.titulo}”?`}
                      mensagem="A publicação volta às listas e quem ainda não deu ciência volta a ter a pendência."
                      confirmar="Reativar"
                    />
                  )}
                </span>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
