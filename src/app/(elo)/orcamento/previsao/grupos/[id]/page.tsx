import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { listarCadastrosDoPlano } from '@/modulos/orcamento/aplicacao/plano-contas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirItemContabil, acaoReativarItemContabil, acaoSalvarItemContabil } from '../../plano/acoes';

export const metadata: Metadata = { title: 'Itens contábeis do grupo' };

function CamposItem({ valor }: { valor?: { nome: string; codigo: string | null } }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outro item do mesmo grupo.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Código (opcional)" dica="Como está no sistema da contabilidade. Não pode repetir o de outro item do mesmo grupo.">
        <input name="codigo" maxLength={30} defaultValue={valor?.codigo ?? ''} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function ItensDoGrupo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { itens, grupos } = await listarCadastrosDoPlano(app.planilhas, usuario.autorizador);
  const grupo = grupos.find((g) => g.id === id && g.ativo);
  if (!grupo) notFound();
  const ativos = itens.ativos.filter((i) => i.grupo_id === id);
  const excluidos = itens.excluidos.filter((i) => i.grupo_id === id);
  const emEdicao = editar ? ativos.find((i) => i.id === editar) : undefined;
  const aqui = `/orcamento/previsao/grupos/${id}`;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Grupos de contas', href: '/orcamento/previsao/grupos' }, { rotulo: grupo.nome }]}
        titulo={`Itens contábeis de ${grupo.nome}`}
        descricao="Cada item pertence a um só grupo. O plano de contas diz quais itens cada área usa em cada exercício."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar item
              </>
            }
            className={pequeno}
            titulo="Adicionar item contábil"
          >
            <form action={acaoSalvarItemContabil} className="space-y-4">
              <input type="hidden" name="grupo_id" value={id} />
              <CamposItem />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar item
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={aqui} titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarItemContabil} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <input type="hidden" name="grupo_id" value={id} />
            <CamposItem valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Itens contábeis"
        vazio="Nenhum item neste grupo. Use “Adicionar item”."
        colunas={[
          { chave: 'nome', rotulo: 'Item' },
          { chave: 'codigo', rotulo: 'Código' },
          { chave: 'planos', rotulo: 'Versões de plano que usam', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={ativos.map((i) => {
          const n = itens.uso[i.id] ?? 0;
          return {
            id: i.id,
            valores: { nome: i.nome, codigo: i.codigo ?? '—', planos: n },
            celulas: {
              nome: <span className="font-semibold">{i.nome}</span>,
              codigo: i.codigo ?? <span className="text-texto-suave">—</span>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`${aqui}?editar=${i.id}`} scroll={false} variante="icone" aria-label={`Alterar ${i.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirItemContabil}
                    campos={{ id: i.id, versao: i.versao, grupo_id: id }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${i.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir o item “${i.nome}”?`}
                    mensagem={
                      n > 0
                        ? `${n} ${n === 1 ? 'versão de plano usa' : 'versões de plano usam'} este item. Os planos antigos continuam como estão (o item aparece como encerrado); ele só não entra em plano novo. Pode ser reativado.`
                        : 'O item sai das listas. Ele não é apagado: fica em “Itens excluídos” e pode ser reativado.'
                    }
                    confirmar="Excluir item"
                  />
                </div>
              ),
            },
          };
        })}
      />

      <Excluidos
        titulo="Itens excluídos"
        itens={excluidos.map((i) => ({ id: i.id, versao: i.versao, nome: i.nome }))}
        campos={{ grupo_id: id }}
        acao={acaoReativarItemContabil}
        mensagem="O item volta a poder entrar no plano."
      />
    </div>
  );
}
