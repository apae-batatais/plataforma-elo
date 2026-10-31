import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ErroRequisicao, itensDoTipo } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { ItensEmLote } from '@/modulos/requisicoes/telas/itens-em-lote';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoCadastrarItensEmLote, acaoConferirItensEmLote, acaoExcluirItemCatalogo, acaoReativarItemCatalogo, acaoSalvarItemCatalogo } from '../../acoes';

export const metadata: Metadata = { title: 'Itens aceitos' };

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'resma', 'dúzia', 'fardo', 'rolo', 'par', 'frasco', 'galão'];

function CamposItem({ tipo, valor }: { tipo: string; valor?: { descricao: string; unidade: string } }) {
  return (
    <>
      <input type="hidden" name="tipo" value={tipo} />
      <Campo rotulo="Item" obrigatorio dica="Como quem pede vai procurar. Ex.: Detergente neutro 500 ml.">
        <input name="descricao" required defaultValue={valor?.descricao} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Unidade" obrigatorio dica="Vem preenchida para quem pede.">
        <input name="unidade" required list="unidades-catalogo" defaultValue={valor?.unidade ?? 'un'} className={estiloEntrada} />
        <datalist id="unidades-catalogo">
          {UNIDADES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </Campo>
    </>
  );
}

export default async function ItensAceitos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('requisicoes.tipos.gerenciar')) redirect('/requisicoes');
  const app = await obterAplicacao();
  let c;
  try {
    c = await itensDoTipo(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroRequisicao) notFound();
    throw erro;
  }
  const emEdicao = editar ? c.ativos.find((x) => x.id === editar) : undefined;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Requisições', href: '/requisicoes' },
          { rotulo: 'Tipos de requisição', href: '/requisicoes/tipos' },
          { rotulo: c.tipo.nome },
        ]}
        titulo={`Itens aceitos: ${c.tipo.nome}`}
        descricao="Quem pede escolhe os itens desta lista, e a unidade vem preenchida. Enquanto a lista estiver vazia, o tipo aceita itens digitados livremente."
        acoes={
          <>
            <JanelaFormulario
              rotulo="Cadastrar em lote"
              variante="fantasma"
              className={pequeno}
              larga
              titulo={`Itens de “${c.tipo.nome}” de uma vez`}
              descricao="Cole uma lista copiada da planilha, confira e confirme."
            >
              <ItensEmLote tipo={id} conferir={acaoConferirItensEmLote} cadastrar={acaoCadastrarItensEmLote} />
            </JanelaFormulario>
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Adicionar item
                </>
              }
              className={pequeno}
              titulo="Adicionar item"
            >
              <form action={acaoSalvarItemCatalogo} className="space-y-4">
                <CamposItem tipo={id} />
                <BotaoEnviar enviando="Salvando…" className="w-full">
                  Adicionar item
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          </>
        }
      />

      {!c.tipo.ativo && <Aviso tipo="atencao">Este tipo está excluído: a lista fica guardada, mas ninguém abre requisição dele.</Aviso>}

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={`/requisicoes/tipos/${id}`} titulo={`Alterar “${emEdicao.descricao}”`}>
          <form action={acaoSalvarItemCatalogo} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposItem tipo={id} valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda={`Itens aceitos em ${c.tipo.nome}`}
        vazio="Lista vazia: o tipo aceita itens digitados livremente. Use “Adicionar item” ou “Cadastrar em lote”."
        colunas={[
          { chave: 'descricao', rotulo: 'Item' },
          { chave: 'unidade', rotulo: 'Unidade' },
          { chave: 'pedidos', rotulo: 'Vezes pedido', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={c.ativos.map((x) => ({
          id: x.id,
          valores: { descricao: x.descricao, unidade: x.unidade, pedidos: x.pedidos },
          celulas: {
            descricao: <span className="font-semibold">{x.descricao}</span>,
            acoes: (
              <div className="flex justify-end gap-1">
                <LinkBotao
                  href={`/requisicoes/tipos/${id}?editar=${x.id}`}
                  scroll={false}
                  variante="icone"
                  aria-label={`Alterar ${x.descricao}`}
                  title="Alterar"
                >
                  <IconeEditar tamanho={16} />
                </LinkBotao>
                <FormularioConfirmado
                  acao={acaoExcluirItemCatalogo}
                  campos={{ id: x.id, versao: x.versao, tipo: id }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Tirar ${x.descricao} da lista`}
                  variante="icone-perigo"
                  titulo={`Tirar “${x.descricao}” da lista?`}
                  mensagem="O item deixa de aparecer para quem pede. Requisições que já o têm não mudam. Ele fica em “Itens excluídos”."
                  confirmar="Tirar da lista"
                />
              </div>
            ),
          },
        }))}
      />

      <Excluidos
        titulo="Itens excluídos"
        itens={c.excluidos.map((x) => ({ id: x.id, versao: x.versao, nome: `${x.descricao} (${x.unidade})` }))}
        acao={acaoReativarItemCatalogo}
        mensagem="O item volta para a lista."
        campos={{ tipo: id }}
      />
    </div>
  );
}
