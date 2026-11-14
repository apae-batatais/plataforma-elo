import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCadastros } from '@/modulos/orcamento/aplicacao/previsao';
import { listarRegras } from '@/modulos/orcamento/aplicacao/regras-rateio';
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
import { BotaoBaixar } from '@/modulos/orcamento/telas/botao-baixar';
import { CadastroEmLoteOrcamento } from '@/modulos/orcamento/telas/cadastro-em-lote';
import { acaoExcluirGrupo, acaoReativarGrupo, acaoSalvarGrupo, acaoCadastrarGruposEmLote, acaoConferirGruposEmLote } from '../acoes';

export const metadata: Metadata = { title: 'Grupos de gasto' };

function CamposGrupo({ valor, regras }: { valor?: { nome: string; rh: boolean; regra_rateio_id?: string | null; codigo_conta?: string | null }; regras: { id: string; nome: string }[] }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outro grupo.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Código da conta contábil (opcional)" dica="Como está no sistema da contabilidade, por exemplo 3.1.02.001. Não pode repetir o de outro grupo.">
        <input name="codigo_conta" maxLength={30} defaultValue={valor?.codigo_conta ?? ''} className={estiloEntrada} />
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
      <Campo rotulo="Regra de rateio" dica="Como este gasto comum se divide entre as áreas ou serviços. Cada item pode trocar. Sem regra, vale a base escolhida na Análise por área.">
        <select name="regra_rateio_id" defaultValue={valor?.regra_rateio_id ?? ''} className={estiloEntrada}>
          <option value="">Sem regra (base do painel)</option>
          {regras.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </Campo>
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
  const regras = (await listarRegras(app.planilhas, usuario.autorizador)).regras.ativas;
  const emEdicao = editar ? grupos.ativos.find((g) => g.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Grupos de gasto' }]}
        titulo="Grupos de gasto"
        descricao="Classificam as despesas (ex.: Material de consumo, Serviços). Marque como Recursos Humanos os grupos que somam no indicador da folha, como RPA e rescisões."
        acoes={
          <>
            <BotaoBaixar href="/orcamento/previsao/baixar/grupos" rotulo="Baixar planilha" vazio={grupos.ativos.length === 0} />
            <JanelaFormulario
              rotulo="Cadastrar em lote"
              variante="fantasma"
              className={pequeno}
              larga
              titulo="Cadastrar vários grupos de uma vez"
              descricao="Cole uma lista copiada da planilha, confira e confirme."
            >
              <CadastroEmLoteOrcamento tipo="grupo" conferir={acaoConferirGruposEmLote} cadastrar={acaoCadastrarGruposEmLote} />
            </JanelaFormulario>
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
              <CamposGrupo regras={regras} />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar grupo
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
          </>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/grupos" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarGrupo} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposGrupo valor={emEdicao} regras={regras} />
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
          { chave: 'codigo', rotulo: 'Código da conta' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'regra', rotulo: 'Regra de rateio' },
          { chave: 'itens', rotulo: 'Itens no orçamento', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={grupos.ativos.map((g) => {
          const n = grupos.uso[g.id] ?? 0;
          return {
            id: g.id,
            valores: { nome: g.nome, codigo: g.codigo_conta ?? '—', tipo: g.rh ? 'Recursos Humanos' : 'Despesa geral', regra: regras.find((r) => r.id === g.regra_rateio_id)?.nome ?? 'Base do painel', itens: n },
            celulas: {
              nome: <span className="font-semibold">{g.nome}</span>,
              codigo: g.codigo_conta ?? <span className="text-texto-suave">—</span>,
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
