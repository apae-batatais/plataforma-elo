import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarRegras, valoresDaBase } from '@/modulos/orcamento/aplicacao/regras-rateio';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirBase, acaoReativarBase, acaoSalvarBase, acaoSalvarValoresBase } from '../acoes';

export const metadata: Metadata = { title: 'Bases próprias de rateio' };

export default async function Bases({ searchParams }: { searchParams: Promise<{ editar?: string; valores?: string; ano?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const quem = usuario.autorizador;
  const app = await obterAplicacao();
  const cad = await listarRegras(app.planilhas, quem);
  const podeEditar = quem.temPermissao('orcamento.parametros.editar');
  const emEdicao = podeEditar && sp.editar ? cad.bases.ativas.find((b) => b.id === sp.editar) : undefined;
  const ano = Number(sp.ano) || new Date().getFullYear();
  const comValores = sp.valores ? cad.bases.ativas.find((b) => b.id === sp.valores) : undefined;
  const valores = comValores ? await valoresDaBase(app.planilhas, quem, comValores.id, ano) : [];

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Bases próprias de rateio' }]}
        titulo="Bases próprias de rateio"
        descricao="Quando nenhuma base pronta serve (ex.: nº de refeições), cadastre a sua: um nome e um valor para cada serviço, por ano. Depois ela aparece nas regras de rateio."
        acoes={
          podeEditar ? (
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Adicionar base
                </>
              }
              className={pequeno}
              titulo="Adicionar base própria"
            >
              <form action={acaoSalvarBase} className="space-y-4">
                <Campo rotulo="Nome" obrigatorio dica="Não pode repetir.">
                  <input name="nome" required className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Salvando…" className="w-full">
                  Adicionar base
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          ) : undefined
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/bases" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarBase} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <Campo rotulo="Nome" obrigatorio>
              <input name="nome" required defaultValue={emEdicao.nome} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Bases próprias"
        vazio="Nenhuma base própria cadastrada."
        colunas={[
          { chave: 'nome', rotulo: 'Base' },
          { chave: 'uso', rotulo: 'Regras que usam', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-40' },
        ]}
        linhas={cad.bases.ativas.map((b) => ({
          id: b.id,
          valores: { nome: b.nome, uso: b.uso },
          celulas: {
            nome: <span className="font-semibold">{b.nome}</span>,
            acoes: (
              <div className="flex justify-end gap-1">
                <LinkBotao href={`/orcamento/previsao/bases?valores=${b.id}&ano=${ano}`} variante="fantasma" className={pequeno}>
                  Valores
                </LinkBotao>
                {podeEditar && (
                  <>
                    <LinkBotao href={`/orcamento/previsao/bases?editar=${b.id}`} scroll={false} variante="icone" aria-label={`Alterar ${b.nome}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    <FormularioConfirmado
                      acao={acaoExcluirBase}
                      campos={{ id: b.id, versao: b.versao }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Excluir ${b.nome}`}
                      variante="icone-perigo"
                      titulo={`Excluir a base “${b.nome}”?`}
                      mensagem={b.uso > 0 ? `${b.uso} regra(s) usam esta base. Troque a base nelas antes de excluir.` : 'A base sai das listas. Ela fica em “Bases excluídas” e pode ser reativada.'}
                      confirmar="Excluir base"
                    />
                  </>
                )}
              </div>
            ),
          },
        }))}
      />

      {comValores && (
        <Secao titulo={`Valores de “${comValores.nome}” em ${ano}`} descricao="Um valor por serviço. Serviço em branco conta zero.">
          <form action={acaoSalvarValoresBase} className="space-y-3">
            <input type="hidden" name="base" value={comValores.id} />
            <input type="hidden" name="ano" value={ano} />
            <div className="grid gap-2 sm:grid-cols-2">
              {valores.map((v) => (
                <label key={v.servico} className="flex items-center justify-between gap-3 text-sm">
                  <span>{v.nome}</span>
                  <input type="hidden" name="servico" value={v.servico} />
                  <input
                    name={`valor_${v.servico}`}
                    inputMode="decimal"
                    defaultValue={v.valor ?? ''}
                    disabled={!podeEditar}
                    aria-label={`Valor de ${v.nome}`}
                    className={`${estiloEntrada} !mt-0 w-32`}
                  />
                </label>
              ))}
            </div>
            {podeEditar && <BotaoEnviar enviando="Salvando…">Salvar valores</BotaoEnviar>}
          </form>
        </Secao>
      )}

      {podeEditar && (
        <Excluidos
          titulo="Bases excluídas"
          itens={cad.bases.excluidas.map((b) => ({ id: b.id, versao: b.versao, nome: b.nome }))}
          acao={acaoReativarBase}
          mensagem="A base volta a aparecer nas regras."
        />
      )}
    </div>
  );
}
