import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarContas } from '@/modulos/orcamento/aplicacao/tesouraria';
import { mesAnterior, mesAtualBrasilia, ROTULO_CLASSE, ROTULO_TIPO } from '@/modulos/orcamento/dominio/tesouraria';
import { rotuloMes } from '@/modulos/orcamento/telas/formato';
import { CamposConta } from '@/modulos/orcamento/telas/campos-conta';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirConta, acaoReativarConta, acaoSalvarConta } from '../acoes';

export const metadata: Metadata = { title: 'Contas' };

export default async function ContasDaTesouraria({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const { ativas, excluidas, fontes, fontesRestritas, unidades } = await listarContas(app.planilhas, usuario.autorizador);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.tesouraria.editar');
  const emEdicao = podeEditar && editar ? ativas.find((c) => c.id === editar) : undefined;
  const nomeUnidade = new Map(unidades.map((u) => [u.codigo, u.nome]));
  const opcoesFonte = fontesRestritas.map((f) => ({ id: f.id, nome: f.nome }));
  const meses = [mesAtualBrasilia()];
  while (meses.length < 24) meses.push(mesAnterior(meses[meses.length - 1]));
  const mesesTroca = meses.map((m) => ({ valor: m, rotulo: rotuloMes(m) }));
  const descrever = (c: { banco: string; agencia: string | null; conta: string | null }) =>
    [c.banco, c.agencia && `ag. ${c.agencia}`, c.conta && `conta ${c.conta}`].filter(Boolean).join(' · ');

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Tesouraria' }, { rotulo: 'Contas' }]}
        titulo="Contas"
        descricao="As contas da instituição onde o dinheiro fica guardado. Cada conta é livre disponível, reserva ou vinculada a um termo."
        acoes={
          podeEditar && (
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Adicionar conta
                </>
              }
              className={pequeno}
              titulo="Adicionar conta"
            >
              <form action={acaoSalvarConta} className="space-y-4">
                <CamposConta fontes={opcoesFonte} unidades={unidades} />
                <BotaoEnviar enviando="Salvando…" className="w-full">
                  Adicionar conta
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          )
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/tesouraria/contas" titulo={`Alterar ${descrever(emEdicao)}`}>
          <form action={acaoSalvarConta} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposConta
              valor={emEdicao}
              fontes={opcoesFonte}
              fonteAtual={emEdicao.fonte_id ? { id: emEdicao.fonte_id, nome: fontes[emEdicao.fonte_id] ?? 'Fonte não encontrada' } : null}
              unidades={unidades}
              mesesTroca={mesesTroca}
            />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Contas da tesouraria"
        vazio={podeEditar ? 'Nenhuma conta cadastrada. Use “Adicionar conta”.' : 'Nenhuma conta cadastrada.'}
        colunas={[
          { chave: 'banco', rotulo: 'Banco' },
          { chave: 'agencia', rotulo: 'Agência' },
          { chave: 'conta', rotulo: 'Conta' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'classe', rotulo: 'Classe' },
          { chave: 'fonte', rotulo: 'Fonte' },
          { chave: 'unidade', rotulo: 'Unidade' },
          ...(podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' }] : []),
        ]}
        linhas={ativas.map((c) => {
          const fonte = c.fonte_id ? (fontes[c.fonte_id] ?? '—') : '—';
          const descricao = descrever(c);
          return {
            id: c.id,
            valores: {
              banco: c.banco,
              agencia: c.agencia ?? '—',
              conta: c.conta ?? '—',
              tipo: ROTULO_TIPO[c.tipo],
              classe: ROTULO_CLASSE[c.classe],
              fonte,
              unidade: (c.unidade && nomeUnidade.get(c.unidade)) || c.unidade || '—',
            },
            celulas: {
              banco: <span className="font-semibold">{c.banco}</span>,
              classe: <Etiqueta tipo={c.classe === 'vinculada' ? 'info' : 'neutro'}>{ROTULO_CLASSE[c.classe]}</Etiqueta>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/orcamento/tesouraria/contas?editar=${c.id}`} scroll={false} variante="icone" aria-label={`Alterar ${descricao}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirConta}
                    campos={{ id: c.id, versao: c.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${descricao}`}
                    variante="icone-perigo"
                    titulo={`Excluir a conta ${descricao}?`}
                    mensagem="A conta sai da lista de pendências e da digitação dos próximos meses. Os saldos que já foram informados continuam somando nos meses passados. Ela não é apagada: fica em “Contas excluídas” e pode ser reativada."
                    confirmar="Excluir conta"
                  />
                </div>
              ),
            },
          };
        })}
      />

      {podeEditar && (
        <Excluidos
          titulo="Contas excluídas"
          itens={excluidas.map((c) => ({ id: c.id, versao: c.versao, nome: descrever(c), detalhe: ROTULO_CLASSE[c.classe] }))}
          acao={acaoReativarConta}
          mensagem="A conta volta para a lista de pendências e para a digitação dos saldos."
        />
      )}
    </div>
  );
}
