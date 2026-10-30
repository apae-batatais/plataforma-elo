import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCadastros } from '@/modulos/orcamento/aplicacao/previsao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirGrupo, acaoReativarGrupo, acaoSalvarGrupo } from '../acoes';

export const metadata: Metadata = { title: 'Grupos de gasto' };

function CamposGrupo({ valor }: { valor?: { nome: string; rh: boolean } }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outro grupo.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <fieldset className="text-sm">
        <legend className="font-semibold">Tipo</legend>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="rh" value="nao" defaultChecked={!valor?.rh} /> Despesa geral
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="rh" value="sim" defaultChecked={valor?.rh} /> Recursos Humanos (fora da folha)
        </label>
      </fieldset>
    </>
  );
}

export default async function Grupos({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { grupos } = await listarCadastros(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? grupos.ativos.find((g) => g.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Grupos de gasto' }]}
        titulo="Grupos de gasto"
        descricao="Classificam as despesas (ex.: Material de consumo, Serviços). Marque como Recursos Humanos os grupos que somam no indicador da folha, como RPA e rescisões."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar grupo
              </>
            }
            className={pequeno}
            titulo="Adicionar grupo de gasto"
          >
            <form action={acaoSalvarGrupo} className="space-y-4">
              <CamposGrupo />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar grupo
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/grupos" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarGrupo} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposGrupo valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Grupos de gasto"
        vazio="Nenhum grupo cadastrado. Use “Adicionar grupo”."
        colunas={[
          { chave: 'nome', rotulo: 'Grupo' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'itens', rotulo: 'Itens no orçamento', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={grupos.ativos.map((g) => {
          const n = grupos.uso[g.id] ?? 0;
          return {
            id: g.id,
            valores: { nome: g.nome, tipo: g.rh ? 'Recursos Humanos' : 'Despesa geral', itens: n },
            celulas: {
              nome: <span className="font-semibold">{g.nome}</span>,
              tipo: g.rh ? <Etiqueta tipo="info">Recursos Humanos</Etiqueta> : <span className="text-texto-suave">Despesa geral</span>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/orcamento/previsao/grupos?editar=${g.id}`} scroll={false} variante="icone" aria-label={`Alterar ${g.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirGrupo}
                    campos={{ id: g.id, versao: g.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${g.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir o grupo “${g.nome}”?`}
                    mensagem={
                      n > 0
                        ? `${n} ${n === 1 ? 'item do orçamento usa' : 'itens do orçamento usam'} este grupo. Troque o grupo desses itens antes de excluir.`
                        : 'O grupo sai das listas. Ele não é apagado: fica em “Grupos excluídos” e pode ser reativado.'
                    }
                    confirmar="Excluir grupo"
                  />
                </div>
              ),
            },
          };
        })}
      />

      <Excluidos
        titulo="Grupos excluídos"
        itens={grupos.excluidos.map((g) => ({ id: g.id, versao: g.versao, nome: g.nome }))}
        acao={acaoReativarGrupo}
        mensagem="O grupo volta a aparecer na lista das despesas."
      />
    </div>
  );
}
