import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarEspacos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { dataBR } from '@/modulos/requisicoes/dominio/espaco';
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
import { acaoAdicionarPeriodo, acaoEncerrarEspaco, acaoEncerrarPeriodo, acaoReativarEspaco, acaoSalvarEspaco } from '../../acoes';

export const metadata: Metadata = { title: 'Espaços' };

type Espaco = { nome: string; local: string | null; capacidade: number };

function CamposEspaco({ valor }: { valor?: Espaco }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Como quem pede vai procurar. Ex.: Sala de reuniões.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Local ou unidade" dica="Opcional. Ajuda a distinguir espaços com nome parecido.">
        <input name="local" defaultValue={valor?.local ?? ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Capacidade (pessoas)" obrigatorio dica="Pedido acima disso é enviado com aviso, não é barrado.">
        <input name="capacidade" inputMode="numeric" required defaultValue={valor?.capacidade} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function CadastroDeEspacos({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string; erro?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('requisicoes.tipos.gerenciar')) redirect('/requisicoes');
  const app = await obterAplicacao();
  const e = await listarEspacos(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? e.ativos.find((x) => x.id === editar) : undefined;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Espaços' }]}
        titulo="Espaços"
        descricao="Os espaços que podem ser reservados e os períodos em que não podem (reforma, obra). Só a Administração da plataforma cadastra."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Novo espaço
              </>
            }
            className={pequeno}
            titulo="Novo espaço"
          >
            <form action={acaoSalvarEspaco} className="space-y-4">
              <CamposEspaco />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Cadastrar espaço
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/requisicoes/espacos/cadastro" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarEspaco} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposEspaco valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      {e.ativos.length === 0 && (
        <p className="rounded-cartao border border-borda bg-superficie p-5 text-texto-suave">Nenhum espaço cadastrado. Cadastre o primeiro para liberar os pedidos.</p>
      )}

      <ul className="space-y-4">
        {e.ativos.map((x) => (
          <li key={x.id} className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{x.nome}</h2>
                <p className="text-sm text-texto-suave">
                  {x.local ? `${x.local} · ` : ''}até {x.capacidade} pessoas
                </p>
              </div>
              <div className="flex gap-1">
                <LinkBotao href={`/requisicoes/espacos/cadastro?editar=${x.id}`} scroll={false} variante="icone" aria-label={`Alterar ${x.nome}`} title="Alterar">
                  <IconeEditar tamanho={16} />
                </LinkBotao>
                <FormularioConfirmado
                  acao={acaoEncerrarEspaco}
                  campos={{ id: x.id, versao: x.versao }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Encerrar ${x.nome}`}
                  variante="icone-perigo"
                  titulo={`Encerrar o espaço “${x.nome}”?`}
                  mensagem="Ninguém mais consegue pedir este espaço. Os pedidos que já existem continuam com o nome dele. Ele fica em “Espaços encerrados”."
                  confirmar="Encerrar espaço"
                />
              </div>
            </div>

            <h3 className="text-sm font-semibold">Períodos de indisponibilidade</h3>
            {x.periodos.length === 0 ? (
              <p className="text-sm text-texto-suave">Nenhum período. O espaço pode ser pedido em qualquer data.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {x.periodos.map((per) => (
                  <li key={per.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borda px-3 py-2">
                    <span>
                      <Etiqueta tipo="atencao">
                        {dataBR(per.inicio)} a {dataBR(per.fim)}
                      </Etiqueta>{' '}
                      {per.motivo}
                    </span>
                    <FormularioConfirmado
                      acao={acaoEncerrarPeriodo}
                      campos={{ id: per.id, versao: per.versao }}
                      rotulo="Encerrar período"
                      variante="fantasma"
                      titulo="Encerrar este período?"
                      mensagem="O espaço volta a poder ser pedido nessas datas. O período fica guardado no histórico."
                      confirmar="Encerrar período"
                    />
                  </li>
                ))}
              </ul>
            )}
            <form action={acaoAdicionarPeriodo} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="espaco" value={x.id} />
              <Campo rotulo="Início" obrigatorio>
                <input type="date" name="inicio" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Fim" obrigatorio>
                <input type="date" name="fim" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Motivo" obrigatorio dica="Ex.: reforma, obra.">
                <input name="motivo" required className={estiloEntrada} />
              </Campo>
              <BotaoEnviar variante="secundario" enviando="Salvando…">
                Adicionar período
              </BotaoEnviar>
            </form>
          </li>
        ))}
      </ul>

      <Excluidos
        titulo="Espaços encerrados"
        itens={e.encerrados.map((x) => ({ id: x.id, versao: x.versao, nome: x.nome }))}
        acao={acaoReativarEspaco}
        mensagem="O espaço volta a aparecer para quem pede."
      />
    </div>
  );
}
