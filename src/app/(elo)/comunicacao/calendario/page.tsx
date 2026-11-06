import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { itemDoCalendario, listarCalendario, tiposDoItem } from '@/modulos/comunicacao/aplicacao/calendario';
import { Controles, FormularioItem, VisaoLista, VisaoMes, type ItemDaTela, type Visao } from '@/modulos/comunicacao/telas/calendario';
import { diaEmBrasilia } from '@/modulos/comunicacao/dominio/prazos';
import { limitesDoMes, mesValido, nomeDoMes, semanasDoMes, somarMeses } from '@/modulos/comunicacao/telas/mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina } from '@/ui/pagina';
import { pequeno } from '@/ui/botao';
import { acaoDesativarItemCalendario, acaoReativarItemCalendario, acaoSalvarItemCalendario } from '../acoes';

export const metadata: Metadata = { title: 'Calendário da Comunicação' };

const paraTela = (i: Awaited<ReturnType<typeof listarCalendario>>[number]): ItemDaTela => ({
  id: i.id,
  versao: i.versao,
  ativo: i.ativo,
  tema: i.tema,
  tipo_data: i.tipo_data,
  inicio: i.inicio,
  fim: i.fim,
  tipos: tiposDoItem(i.tipos),
  observacao: i.observacao,
  pedidos: i.pedidos,
  publicados: i.publicados,
});

export default async function Calendario({ searchParams }: { searchParams: Promise<{ visao?: string; mes?: string; editar?: string }> }) {
  const p = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('comunicacao.calendario.gerenciar')) redirect('/comunicacao');
  const { planilhas } = await obterAplicacao();

  const hoje = diaEmBrasilia(new Date());
  const mes = mesValido(p.mes) ?? hoje.slice(0, 7);
  const visao: Visao = p.visao === 'lista' ? 'lista' : 'mes';
  // A grade do mês mostra também os dias vizinhos; a lista, só o mês.
  const { inicio, fim } = limitesDoMes(mes);
  const semanas = semanasDoMes(mes);
  const periodo = { inicio: semanas[0][0].dia, fim: semanas[semanas.length - 1][6].dia };
  const itens = (await listarCalendario(planilhas, usuario.autorizador, periodo)).map(paraTela);
  const doMes = itens.filter((i) => i.inicio <= fim && i.fim >= inicio);

  // O item a alterar pode estar em outro mês: busca no calendário todo.
  let emEdicao = p.editar ? itens.find((i) => i.id === p.editar) : undefined;
  if (p.editar && !emEdicao) {
    const achado = await itemDoCalendario(planilhas, usuario.autorizador, p.editar);
    emEdicao = achado ? paraTela(achado) : undefined;
  }
  const voltarPara = `/comunicacao/calendario?visao=${visao}&mes=${mes}`;

  return (
    <div className="space-y-2">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Calendário' }]}
        titulo="Calendário"
        descricao="Os temas e as datas de comunicação. Quem pede uma publicação escolhe um destes temas."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar item
              </>
            }
            className={pequeno}
            titulo="Adicionar item ao calendário"
          >
            <FormularioItem acao={acaoSalvarItemCalendario} visao={visao} mes={mes} rotuloBotao="Adicionar item" />
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={voltarPara} titulo={`Alterar “${emEdicao.tema}”`}>
          <FormularioItem acao={acaoSalvarItemCalendario} visao={visao} mes={mes} valor={emEdicao} rotuloBotao="Salvar alterações" />
        </JanelaFormulario>
      )}

      <Controles visao={visao} mes={mes} anterior={somarMeses(mes, -1)} seguinte={somarMeses(mes, 1)} atual={hoje.slice(0, 7)} />

      {visao === 'mes' ? (
        <div className="space-y-6">
          <VisaoMes mes={mes} itens={itens} hoje={hoje} />
          <section aria-labelledby="t-itens-do-mes" className="space-y-3">
            <h2 id="t-itens-do-mes" className="text-base font-semibold">
              Itens de {nomeDoMes(mes)}
            </h2>
            <VisaoLista itens={doMes} visao={visao} mes={mes} desativar={acaoDesativarItemCalendario} reativar={acaoReativarItemCalendario} />
          </section>
        </div>
      ) : (
        <VisaoLista itens={doMes} visao={visao} mes={mes} desativar={acaoDesativarItemCalendario} reativar={acaoReativarItemCalendario} />
      )}
    </div>
  );
}
