import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { detalharRequisicao, ErroRequisicao, opcoesDoFormulario } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { FormularioRequisicao } from '@/modulos/requisicoes/telas/formulario-requisicao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { projetosParaRequisicao } from '@/plataforma/ligacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoIniciarEnvioAnexo, acaoReenviarRequisicao } from '../../acoes';

export const metadata: Metadata = { title: 'Ajustar requisição' };

export default async function AjustarRequisicao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let d;
  try {
    d = await detalharRequisicao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroRequisicao) notFound();
    if (erro instanceof ErroPermissao) redirect('/requisicoes');
    throw erro;
  }
  if (!d.acoes.includes('reenviar')) redirect(`/requisicoes/${id}`);
  const opcoes = await opcoesDoFormulario(app.planilhas, usuario.autorizador, { anexosAtivos: app.arquivos !== null });
  const r = d.requisicao;
  // O tipo não muda no ajuste: se tiver sido excluído, continua aparecendo.
  if (!opcoes.tipos.some((t) => t.id === r.tipo_id) && d.tipo)
    opcoes.tipos.push({ id: d.tipo.id, nome: d.tipo.nome, formulario: d.tipo.formulario, descricao: null, areas: [], anexos: false, itens: [] });
  const projetos = (await projetosParaRequisicao(app.planilhas, usuario.autorizador)) ?? [];
  // O projeto já ligado continua escolhível, mesmo que tenha saído da lista de compras.
  if (r.projeto_id && !projetos.some((x) => x.id === r.projeto_id))
    projetos.push({ id: r.projeto_id, codigo: r.projeto_codigo ?? '', titulo: r.projeto_titulo ?? '', servico: null, atividades: [] });
  if (projetos.length) opcoes.projetos = projetos;
  const pedido = [...d.historico].reverse().find((h) => h.acao === 'devolver');
  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Requisições', href: '/requisicoes' },
          { rotulo: r.numero, href: `/requisicoes/${id}` },
          { rotulo: 'Ajustar' },
        ]}
        titulo={`Ajustar ${r.numero}`}
        descricao="Faça o ajuste pedido e reenvie. A requisição volta para a aprovação, e o prazo recomeça."
      />
      {pedido?.comentario && (
        <div className="mb-6">
          <Aviso tipo="atencao" titulo="O que a coordenação pediu">
            {pedido.comentario}
          </Aviso>
        </div>
      )}
      <FormularioRequisicao
        opcoes={opcoes}
        acao={acaoReenviarRequisicao}
        iniciarEnvio={acaoIniciarEnvioAnexo}
        anexosIniciais={d.anexos.map((a) => ({
          chave: a.id,
          tipo: a.tipo,
          nome: a.nome,
          duracao: a.duracao,
          arquivoId: a.arquivoId,
          previa: `/requisicoes/anexos/${a.id}`,
          progresso: 100,
          erro: null,
        }))}
        oculto={{ id: r.id, versao: r.versao }}
        rotuloEnviar="Reenviar requisição"
        comComentario
        inicial={{
          tipoId: r.tipo_id,
          area: r.area,
          centros: d.centros.map((c) => ({ servico: c.servico, percentual: c.percentual })),
          itens: d.itens.map((i) => ({ quantidade: i.quantidade, unidade: i.unidade, descricao: i.descricao })),
          detalhes: d.detalhes,
          observacao: r.observacao,
          projetoId: r.projeto_id,
          atividadeId: r.atividade_id,
        }}
      />
    </div>
  );
}
