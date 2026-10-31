import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { opcoesDoFormulario } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { FormularioRequisicao } from '@/modulos/requisicoes/telas/formulario-requisicao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoOrcamento } from '@/plataforma/catalogos';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoEnviarRequisicao } from '../acoes';

export const metadata: Metadata = { title: 'Nova requisição' };

export default async function NovaRequisicao() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('requisicoes.solicitar')) redirect('/requisicoes');
  const app = await obterAplicacao();
  const opcoes = await opcoesDoFormulario(app.planilhas, usuario.autorizador, catalogoOrcamento(app.planilhas));
  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Nova requisição' }]}
        titulo="Nova requisição"
        descricao="Depois de enviada, a requisição vai para a coordenação dos centros de custo aprovar e, aprovada, para o setor que atende."
      />
      {opcoes.tipos.length === 0 ? (
        <Aviso tipo="atencao" titulo="Nenhum tipo de requisição cadastrado">
          A administração cadastra os tipos em Requisições › Tipos de requisição.
        </Aviso>
      ) : (
        <FormularioRequisicao opcoes={opcoes} acao={acaoEnviarRequisicao} />
      )}
    </div>
  );
}
