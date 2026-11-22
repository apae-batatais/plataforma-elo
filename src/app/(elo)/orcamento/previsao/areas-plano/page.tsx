import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
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
import { acaoExcluirAreaPlano, acaoReativarAreaPlano, acaoSalvarAreaPlano } from '../plano/acoes';

export const metadata: Metadata = { title: 'Áreas do plano de contas' };

function CamposArea({ valor }: { valor?: { nome: string; codigo: string | null } }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra área.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Código (opcional)" dica="Como está no sistema da contabilidade. Não pode repetir o de outra área.">
        <input name="codigo" maxLength={30} defaultValue={valor?.codigo ?? ''} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function AreasDoPlano({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { areas } = await listarCadastrosDoPlano(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? areas.ativos.find((a) => a.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Áreas do plano de contas' }]}
        titulo="Áreas do plano de contas"
        descricao="As áreas da contabilidade. Não são as áreas dos serviços: cada lançamento pode ter uma área do plano diferente da área do serviço."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar área
              </>
            }
            className={pequeno}
            titulo="Adicionar área"
          >
            <form action={acaoSalvarAreaPlano} className="space-y-4">
              <CamposArea />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar área
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/areas-plano" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarAreaPlano} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposArea valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Áreas do plano de contas"
        vazio="Nenhuma área cadastrada. Use “Adicionar área”."
        colunas={[
          { chave: 'nome', rotulo: 'Área' },
          { chave: 'codigo', rotulo: 'Código' },
          { chave: 'planos', rotulo: 'Versões de plano que usam', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={areas.ativos.map((a) => {
          const n = areas.uso[a.id] ?? 0;
          return {
            id: a.id,
            valores: { nome: a.nome, codigo: a.codigo ?? '—', planos: n },
            celulas: {
              nome: <span className="font-semibold">{a.nome}</span>,
              codigo: a.codigo ?? <span className="text-texto-suave">—</span>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/orcamento/previsao/areas-plano?editar=${a.id}`} scroll={false} variante="icone" aria-label={`Alterar ${a.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirAreaPlano}
                    campos={{ id: a.id, versao: a.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${a.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir a área “${a.nome}”?`}
                    mensagem={
                      n > 0
                        ? `${n} ${n === 1 ? 'versão de plano usa' : 'versões de plano usam'} esta área. Os planos antigos continuam como estão (a área aparece como encerrada); ela só não entra em plano novo. Pode ser reativada.`
                        : 'A área sai das listas. Ela não é apagada: fica em “Áreas excluídas” e pode ser reativada.'
                    }
                    confirmar="Excluir área"
                  />
                </div>
              ),
            },
          };
        })}
      />

      <Excluidos
        titulo="Áreas excluídas"
        itens={areas.excluidos.map((a) => ({ id: a.id, versao: a.versao, nome: a.nome }))}
        acao={acaoReativarAreaPlano}
        mensagem="A área volta a poder entrar no plano."
      />
    </div>
  );
}
