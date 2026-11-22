import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarVeiculos } from '@/modulos/requisicoes/aplicacao/veiculos';
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
import { acaoExcluirVeiculo, acaoMarcarManutencaoFeita, acaoReativarVeiculo, acaoSalvarVeiculo } from '../acoes';

export const metadata: Metadata = { title: 'Veículos' };

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

type Valor = { nome: string; placa: string; capacidade: number; manutencaoPrevista: string | null };

function CamposVeiculo({ valor }: { valor?: Valor }) {
  return (
    <>
      <Campo rotulo="Nome do veículo" obrigatorio dica="Como a equipe reconhece. Ex.: Van 1, Carro pequeno.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Placa" obrigatorio dica="Ex.: ABC-1234 ou ABC1D23.">
          <input name="placa" required defaultValue={valor?.placa} autoCapitalize="characters" className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Capacidade" obrigatorio dica="Passageiros, com o condutor.">
          <input name="capacidade" type="number" min={1} step={1} inputMode="numeric" required defaultValue={valor?.capacidade} className={estiloEntrada} />
        </Campo>
      </div>
      <Campo rotulo="Manutenção prevista" dica="dia/mês/ano. Deste dia em diante o veículo não aparece para pedido novo, até marcarem a manutenção como feita. Vazio = sem manutenção prevista.">
        <input name="manutencao" type="date" defaultValue={valor?.manutencaoPrevista ?? ''} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function Veiculos({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('requisicoes.veiculos.cadastrar')) redirect('/requisicoes');
  const app = await obterAplicacao();
  const v = await listarVeiculos(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? v.ativos.find((x) => x.id === editar) : undefined;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Veículos' }]}
        titulo="Veículos"
        descricao="Os veículos da instituição que a equipe poderá pedir. Aqui você cadastra cada um e a data da próxima manutenção; só a Administração da plataforma altera."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar veículo
              </>
            }
            className={pequeno}
            titulo="Adicionar veículo"
          >
            <form action={acaoSalvarVeiculo} className="space-y-4">
              <CamposVeiculo />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar veículo
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/requisicoes/veiculos" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarVeiculo} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposVeiculo valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Veículos"
        vazio="Nenhum veículo cadastrado. Use “Adicionar veículo”."
        colunas={[
          { chave: 'nome', rotulo: 'Veículo' },
          { chave: 'placa', rotulo: 'Placa' },
          { chave: 'capacidade', rotulo: 'Capacidade', tipo: 'numero' },
          { chave: 'manutencao', rotulo: 'Manutenção prevista' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={v.ativos.map((x) => ({
          id: x.id,
          valores: { nome: x.nome, placa: x.placa, capacidade: x.capacidade, manutencao: x.manutencaoPrevista ?? '' },
          celulas: {
            nome: (
              <>
                <span className="font-semibold">{x.nome}</span>
                {x.ultimaManutencao && <span className="block text-xs text-texto-suave">Última manutenção: {dataBr(x.ultimaManutencao)}</span>}
              </>
            ),
            placa: <span className="tabular-nums">{x.placa}</span>,
            capacidade: <span className="tabular-nums">{x.capacidade} passageiros</span>,
            manutencao: x.manutencaoPrevista ? (
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta tipo="atencao">{dataBr(x.manutencaoPrevista)}</Etiqueta>
                <FormularioConfirmado
                  acao={acaoMarcarManutencaoFeita}
                  campos={{ id: x.id }}
                  rotulo="Marcar feita"
                  variante="secundario"
                  pequeno
                  perigoso={false}
                  titulo={`Marcar a manutenção de “${x.nome}” como feita?`}
                  mensagem="O veículo volta a aparecer para pedido novo. Se já souber a data da próxima, informe abaixo; senão deixe vazio."
                  confirmar="Marcar como feita"
                >
                  <Campo rotulo="Próxima manutenção" dica="dia/mês/ano, a partir de hoje. Opcional.">
                    <input name="proxima" type="date" className={estiloEntrada} />
                  </Campo>
                </FormularioConfirmado>
              </div>
            ) : (
              <span className="text-sm text-texto-suave">Nenhuma</span>
            ),
            acoes: (
              <div className="flex justify-end gap-1">
                <LinkBotao href={`/requisicoes/veiculos?editar=${x.id}`} scroll={false} variante="icone" aria-label={`Alterar ${x.nome}`} title="Alterar">
                  <IconeEditar tamanho={16} />
                </LinkBotao>
                <FormularioConfirmado
                  acao={acaoExcluirVeiculo}
                  campos={{ id: x.id, versao: x.versao }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Excluir ${x.nome}`}
                  variante="icone-perigo"
                  titulo={`Excluir o veículo “${x.nome}”?`}
                  mensagem="Ninguém mais consegue pedir este veículo. Os pedidos que já existem continuam mostrando o nome. Ele fica em “Veículos excluídos”."
                  confirmar="Excluir veículo"
                />
              </div>
            ),
          },
        }))}
      />

      <Excluidos
        titulo="Veículos excluídos"
        itens={v.excluidos.map((x) => ({ id: x.id, versao: x.versao, nome: x.nome, detalhe: x.placa }))}
        acao={acaoReativarVeiculo}
        mensagem="O veículo volta a poder ser pedido."
      />
    </div>
  );
}
