import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCadastros } from '@/modulos/orcamento/aplicacao/previsao';
import { NATUREZA, USO } from '@/modulos/orcamento/dominio/previsao';
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
import { acaoExcluirFonte, acaoReativarFonte, acaoSalvarFonte } from '../acoes';

export const metadata: Metadata = { title: 'Fontes de recurso' };

function CamposFonte({ valor }: { valor?: { nome: string; natureza: 'publica' | 'propria'; uso: 'livre' | 'restrita' } }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra fonte.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <fieldset className="text-sm">
        <legend className="font-semibold">Natureza</legend>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="natureza" value="publica" required defaultChecked={valor?.natureza === 'publica'} /> Pública (governo, convênios, Projeto Incentivado)
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="natureza" value="propria" defaultChecked={valor?.natureza === 'propria'} /> Própria (doações, eventos, vendas)
        </label>
      </fieldset>
      <fieldset className="text-sm">
        <legend className="font-semibold">Uso</legend>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="uso" value="livre" required defaultChecked={valor?.uso === 'livre'} /> Livre (pode pagar qualquer despesa)
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="uso" value="restrita" defaultChecked={valor?.uso === 'restrita'} /> Restrita (só o que o termo permite)
        </label>
      </fieldset>
    </>
  );
}

export default async function FontesDeRecurso({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { fontes } = await listarCadastros(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? fontes.ativos.find((f) => f.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Fontes de recurso' }]}
        titulo="Fontes de recurso"
        descricao="De onde vem o dinheiro de cada receita e o que paga cada despesa. Natureza e uso alimentam os indicadores; Projeto Incentivado conta como pública."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar fonte
              </>
            }
            className={pequeno}
            titulo="Adicionar fonte de recurso"
          >
            <form action={acaoSalvarFonte} className="space-y-4">
              <CamposFonte />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar fonte
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/fontes" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarFonte} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposFonte valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Fontes de recurso"
        vazio="Nenhuma fonte cadastrada. Use “Adicionar fonte”."
        colunas={[
          { chave: 'nome', rotulo: 'Fonte' },
          { chave: 'natureza', rotulo: 'Natureza' },
          { chave: 'uso', rotulo: 'Uso' },
          { chave: 'itens', rotulo: 'Itens no orçamento', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={fontes.ativos.map((f) => {
          const n = fontes.uso[f.id] ?? 0;
          return {
            id: f.id,
            valores: { nome: f.nome, natureza: NATUREZA[f.natureza], uso: USO[f.uso], itens: n },
            celulas: {
              nome: <span className="font-semibold">{f.nome}</span>,
              natureza: <Etiqueta tipo={f.natureza === 'publica' ? 'info' : 'neutro'}>{NATUREZA[f.natureza]}</Etiqueta>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/orcamento/previsao/fontes?editar=${f.id}`} scroll={false} variante="icone" aria-label={`Alterar ${f.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirFonte}
                    campos={{ id: f.id, versao: f.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${f.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir a fonte “${f.nome}”?`}
                    mensagem={
                      n > 0
                        ? `${n} ${n === 1 ? 'item do orçamento usa' : 'itens do orçamento usam'} esta fonte. Troque a fonte desses itens antes de excluir.`
                        : 'A fonte sai das listas. Ela não é apagada: fica em “Fontes excluídas” e pode ser reativada.'
                    }
                    confirmar="Excluir fonte"
                  />
                </div>
              ),
            },
          };
        })}
      />

      <Excluidos
        titulo="Fontes excluídas"
        itens={fontes.excluidos.map((f) => ({ id: f.id, versao: f.versao, nome: f.nome }))}
        acao={acaoReativarFonte}
        mensagem="A fonte volta a aparecer nas listas de receitas e despesas."
      />
    </div>
  );
}
