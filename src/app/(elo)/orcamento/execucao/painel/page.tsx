import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerPainelExecucao } from '@/modulos/orcamento/aplicacao/execucao';
import { Bloco, CartaoNumero, GraficoComLeitura, LinhaPrevisto, listaDeMeses, SeletorPeriodo, textoDoPeriodo } from '@/modulos/orcamento/telas/execucao-partes';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BarrasHorizontais, ResultadoMensal } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados, type ColunaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Painel de execução' };

const COLUNAS: ColunaDados[] = [
  { chave: 'area', rotulo: 'Área' },
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'grupo', rotulo: 'Grupo de gasto' },
  { chave: 'fonte', rotulo: 'Fonte' },
  { chave: 'previsto', rotulo: 'Previsto', tipo: 'moeda', somar: true },
  { chave: 'realizado', rotulo: 'Realizado', tipo: 'moeda', somar: true },
  { chave: 'diferenca', rotulo: 'Diferença', tipo: 'moeda', somar: true, calculada: true },
  { chave: 'execucao', rotulo: 'Execução (%)', tipo: 'numero', calculada: true },
];

export default async function PainelDeExecucaoPagina({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const r = await lerPainelExecucao(app.planilhas, usuario.autorizador, { ano: Number(sp.ano) || undefined, mes: /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes : null });
  const base = `/orcamento/execucao/painel?ano=${r.ano}`;
  const escolhido = r.periodo.meses.length === 1 && sp.mes ? r.periodo.meses[0] : null;
  const informados = r.porMes?.filter((m) => m.informado).map((m) => m.mes) ?? [];
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Execução' }, { rotulo: 'Painel de execução' }];
  const cabecalho = (
    <CabecalhoPagina
      trilha={trilha}
      titulo={`Painel de execução de ${r.ano}`}
      descricao={`${textoDoPeriodo(r.ano, r.periodo)}. Compara o que foi gasto e recebido com o previsto na Previsão aprovada.`}
      acoes={
        <>
          <SeletorAno anos={r.anos} atual={r.ano} href={(a) => `/orcamento/execucao/painel?ano=${a}`} />
          {r.nivel === 'completo' && (
            <LinkBotao href="/orcamento/execucao/recursos-livres" variante="secundario">
              Recursos livres
            </LinkBotao>
          )}
          {r.podeInformar && <LinkBotao href="/orcamento/execucao/realizado">Informar realizado</LinkBotao>}
        </>
      }
    />
  );

  if (!r.temRealizado) {
    return (
      <div>
        {cabecalho}
        <EstadoVazio titulo={`Ainda não há realizado em ${r.ano}`} acao={r.podeInformar ? <LinkBotao href="/orcamento/execucao/realizado">Informar realizado</LinkBotao> : undefined}>
          O Financeiro informa mês a mês em Informar realizado.
        </EstadoVazio>
      </div>
    );
  }

  // Meses em que o resultado realizado ficou abaixo do previsto (só quando há Previsão aprovada).
  const comparaveis = (r.porMes ?? []).filter((m) => m.informado && m.receita !== null && m.despesa !== null && m.receitaPrevista !== null && m.despesaPrevista !== null);
  const abaixo = comparaveis.filter((m) => (m.receita as number) - (m.despesa as number) < (m.receitaPrevista as number) - (m.despesaPrevista as number));
  const tituloResultado = !r.previsaoAprovada
    ? 'Receita e despesa realizadas, mês a mês'
    : abaixo.length === 0
      ? `Resultado ficou no previsto ou acima em ${comparaveis.length === 1 ? 'todo o mês informado' : `todos os ${comparaveis.length} meses informados`}`
      : `Resultado ficou abaixo do previsto em ${abaixo.length} de ${comparaveis.length} ${comparaveis.length === 1 ? 'mês' : 'meses'}`;

  const linhas: LinhaDados[] = r.linhas.map((l, i) => ({
    id: String(i),
    valores: {
      area: l.area, servico: l.servico, grupo: l.grupo, fonte: l.fonte,
      previsto: r.previsaoAprovada ? l.previsto : null,
      realizado: l.realizado,
      diferenca: r.previsaoAprovada ? Math.round((l.realizado - l.previsto) * 100) / 100 : null,
      execucao: r.previsaoAprovada && l.previsto ? Math.round((l.realizado / l.previsto) * 1000) / 10 : null,
    },
    celulas: l.foraDaPrevisao ? { grupo: <span>{l.grupo} <Etiqueta tipo="atencao">Fora da previsão</Etiqueta></span> } : undefined,
  }));
  const colunas = COLUNAS.filter((c) => r.previsaoAprovada || !['previsto', 'diferenca', 'execucao'].includes(c.chave));
  const despesas = linhas.filter((_, i) => r.linhas[i].tipo === 'despesa');
  const receitas = linhas.filter((_, i) => r.linhas[i].tipo === 'receita');
  const pendente = r.pendencias.mesesSemDado.length > 0 || r.pendencias.adiantamentosAcimaDoLimite > 0;

  return (
    <div className="space-y-6">
      {cabecalho}
      {r.nivel === 'escopo' && <Aviso tipo="info">Você vê só a despesa dos serviços do seu escopo. Receitas não aparecem.</Aviso>}
      {r.nivel === 'totais' && <Aviso tipo="info">Você vê só os totais. Serviço, grupo e fonte aparecem para a Diretoria e o Financeiro.</Aviso>}
      {!r.previsaoAprovada && <Aviso tipo="atencao">Sem Previsão aprovada em {r.ano}: mostramos só o realizado.</Aviso>}
      {pendente && (
        <div className="space-y-2">
          {r.pendencias.mesesSemDado.length > 0 && (
            <Aviso
              tipo="atencao"
              titulo="Mês sem realizado"
              acao={r.podeInformar ? <LinkBotao variante="secundario" href={`/orcamento/execucao/realizado?mes=${r.pendencias.mesesSemDado[0]}`}>Informar</LinkBotao> : undefined}
            >
              Sem dado em {listaDeMeses(r.pendencias.mesesSemDado)}: esses meses ficam fora das contas, do realizado e do previsto.
            </Aviso>
          )}
          {r.pendencias.adiantamentosAcimaDoLimite > 0 && (
            <Aviso tipo="atencao" titulo="Adiantamento em aberto há muito tempo" acao={<LinkBotao variante="secundario" href="/orcamento/execucao/recursos-livres#adiantamentos">Ver adiantamentos</LinkBotao>}>
              {r.pendencias.adiantamentosAcimaDoLimite === 1 ? 'Um termo tem' : `${r.pendencias.adiantamentosAcimaDoLimite} termos têm`} adiantamento sem ressarcimento há mais de 60 dias.
            </Aviso>
          )}
        </div>
      )}

      {informados.length > 1 && <SeletorPeriodo base={base} meses={informados} escolhido={escolhido} />}

      <dl className="grid gap-3 sm:grid-cols-3">
        <CartaoNumero rotulo="Despesa" valor={r.despesa.realizado} chave="exec:despesa">
          <LinhaPrevisto previsto={r.despesa.previsto} execucao={r.despesa.execucao} />
        </CartaoNumero>
        {r.receita && (
          <CartaoNumero rotulo="Receita" valor={r.receita.realizado} chave="exec:receita">
            <LinhaPrevisto previsto={r.receita.previsto} execucao={r.receita.execucao} />
          </CartaoNumero>
        )}
        {r.resultado && (
          <CartaoNumero rotulo="Resultado" valor={r.resultado.realizado} chave="exec:resultado" alerta={r.resultado.realizado < 0 ? 'Déficit' : null}>
            <LinhaPrevisto previsto={r.resultado.previsto} execucao={null} />
          </CartaoNumero>
        )}
      </dl>

      {r.porMes && (
        <GraficoComLeitura
          titulo={tituloResultado}
          descricao="Receita e despesa realizadas em cada mês informado."
          leitura={
            <>
              <p className="text-2xl font-bold tabular-nums">{reais(r.resultado?.realizado ?? 0)}</p>
              <p>Resultado do período.</p>
              {abaixo.length > 0 ? <p>Confira {listaDeMeses(abaixo.map((m) => m.mes))}: o resultado ficou abaixo do previsto.</p> : <p>Nenhum mês pede atenção agora.</p>}
            </>
          }
        >
          <ResultadoMensal
            descricao={`Receita, despesa e resultado realizados em cada mês informado de ${r.ano}`}
            categorias={r.porMes.filter((m) => m.informado).map((m) => m.rotulo)}
            receita={r.porMes.filter((m) => m.informado).map((m) => m.receita ?? 0)}
            despesa={r.porMes.filter((m) => m.informado).map((m) => m.despesa ?? 0)}
          />
        </GraficoComLeitura>
      )}

      {r.porServico.length > 0 && (
        <GraficoComLeitura
          titulo={r.previsaoAprovada ? 'Execução da despesa por serviço' : 'Despesa realizada por serviço'}
          descricao="Maior despesa primeiro."
          leitura={
            <>
              <p className="text-2xl font-bold tabular-nums">{r.despesa.execucao === null ? '—' : `${r.despesa.execucao.toLocaleString('pt-BR')}%`}</p>
              <p>{r.despesa.execucao === null ? 'Sem previsto para calcular a execução.' : 'da despesa prevista já foi gasta no período.'}</p>
              <p>
                <Link className="underline" href="#tabela">Ver a tabela completa</Link>
              </p>
            </>
          }
        >
          <BarrasHorizontais
            rotuloCategoria="Serviço"
            formato="moeda"
            descricao="Despesa prevista e realizada de cada serviço no período"
            categorias={r.porServico.map((s) => s.servico)}
            series={[
              ...(r.previsaoAprovada ? [{ nome: 'Previsto', valores: r.porServico.map((s) => s.previsto), cor: 1 as const }] : []),
              { nome: 'Realizado', valores: r.porServico.map((s) => s.realizado), cor: 2 as const },
            ]}
          />
        </GraficoComLeitura>
      )}

      {r.nivel !== 'totais' && (
        <div id="tabela" className="scroll-mt-20 space-y-4">
          <Bloco titulo="Despesas por área, serviço, grupo e fonte" descricao="Diferença = realizado − previsto. Execução = realizado ÷ previsto; sem previsto, fica em branco.">
            <TabelaDados colunas={colunas} linhas={despesas} legenda="Despesas: previsto e realizado no período" vazio="Nenhuma despesa no período." />
          </Bloco>
          {r.receita && (
            <Bloco titulo="Receitas por fonte">
              <TabelaDados colunas={colunas.filter((c) => !['area', 'servico', 'grupo'].includes(c.chave))} linhas={receitas} legenda="Receitas: previsto e realizado no período" vazio="Nenhuma receita no período." />
            </Bloco>
          )}
        </div>
      )}
    </div>
  );
}
