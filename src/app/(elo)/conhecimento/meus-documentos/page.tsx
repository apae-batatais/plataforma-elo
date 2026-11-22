import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { meusDocumentos } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { EtiquetaDaPessoa, formatarDataHora } from '@/modulos/conhecimento/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Meus documentos' };

export default async function MeusDocumentos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const docs = await meusDocumentos(planilhas, usuario.autorizador);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Meus documentos' }]}
        titulo="Meus documentos"
        descricao="O que pede a sua ciência ou um teste e o que você já cumpriu. Pendentes primeiro."
      />
      {docs.length === 0 ? (
        <EstadoVazio titulo="Nada exige sua ciência ou teste por enquanto">Quando uma publicação pedir, ela aparece aqui e na tela inicial.</EstadoVazio>
      ) : (
        <TabelaDados
          legenda="Documentos que exigem ciência ou teste"
          colunas={[
            { chave: 'titulo', rotulo: 'Título' },
            { chave: 'categoria', rotulo: 'Categoria' },
            { chave: 'situacao', rotulo: 'Situação' },
            { chave: 'ciencia', rotulo: 'Ciência em' },
            { chave: 'teste', rotulo: 'Teste em' },
            { chave: 'abrir', rotulo: 'Abrir', fixa: true },
          ]}
          linhas={docs.map((d) => ({
            id: d.id,
            destaque: d.minhaSituacao === 'pendente' || d.minhaSituacao === 'precisa_renovar',
            valores: {
              titulo: d.titulo,
              categoria: d.categoriaNome,
              situacao: d.minhaSituacao,
              ciencia: d.minhaCienciaEm ? formatarDataHora(d.minhaCienciaEm) : null,
              teste: d.minhaAprovacaoEm ? formatarDataHora(d.minhaAprovacaoEm) : null,
              abrir: null,
            },
            celulas: {
              situacao: <EtiquetaDaPessoa situacao={d.minhaSituacao} vencida={d.vencida} />,
              abrir: (
                <LinkBotao href={`/conhecimento/${d.id}`} variante="secundario" className="!min-h-8 !px-3 !py-1 !text-sm">
                  Abrir
                </LinkBotao>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
