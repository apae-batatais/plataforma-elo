import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { painelDaAvaliacao, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { percentual } from '@/modulos/avaliacao/dominio/painel';
import { DependenciaPorServico, EvolucaoPorServico, IndicadoresPorServico, PontosDoIndice } from '@/modulos/avaliacao/telas/graficos-painel';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Painel da Avaliação Diagnóstica' };

const MES = /^\d{4}-\d{2}$/;

function Cartao({ rotulo, valor, detalhe, alerta = false }: { rotulo: string; valor: string; detalhe: ReactNode; alerta?: boolean }) {
  return (
    <div className={`rounded-cartao border bg-superficie px-5 py-3 ${alerta ? 'border-erro' : 'border-borda'}`}>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className={`text-2xl font-bold leading-tight tabular-nums ${alerta ? 'text-erro' : ''}`}>{valor}</dd>
      <dd className="text-xs text-texto-suave">{detalhe}</dd>
    </div>
  );
}

function Quadro({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-cartao border border-borda bg-superficie px-5 py-4">
      <h2 className="font-bold">{titulo}</h2>
      {descricao && <p className="mb-3 text-sm text-texto-suave">{descricao}</p>}
      {!descricao && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function PainelAvaliacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.painel)) redirect('/avaliacao');
  const app = await obterAplicacao();
  const de = sp.de && MES.test(sp.de) ? sp.de : '';
  const ate = sp.ate && MES.test(sp.ate) ? sp.ate : '';
  const p = await painelDaAvaliacao(app.planilhas, usuario.autorizador, { de, ate });
  const n = p.total;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação Diagnóstica', href: '/avaliacao' }, { rotulo: 'Painel' }]}
        titulo="Painel por serviço atual"
        descricao={
          p.todos
            ? 'Números das avaliações de todos os serviços. Nenhuma pessoa é identificada aqui.'
            : 'Números das avaliações dos serviços do seu escopo. Nenhuma pessoa é identificada aqui.'
        }
        acoes={
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Campo rotulo="De (mês)">
              <input type="month" name="de" defaultValue={de} className={`${estiloEntrada} w-40 !mt-1`} />
            </Campo>
            <Campo rotulo="Até (mês)">
              <input type="month" name="ate" defaultValue={ate} className={`${estiloEntrada} w-40 !mt-1`} />
            </Campo>
            <BotaoEnviar variante="secundario" enviando="Calculando…">
              Ver período
            </BotaoEnviar>
          </form>
        }
      />

      {n === 0 ? (
        <EstadoVazio titulo={de || ate ? 'Nenhuma avaliação no período escolhido' : 'Nenhuma avaliação salva ainda'}>
          {de || ate ? 'Escolha outro período.' : 'Os números aparecem aqui assim que as primeiras avaliações forem salvas.'}
        </EstadoVazio>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Cartao rotulo="Pessoas avaliadas" valor={String(n)} detalhe={`em ${p.servicos.length} ${p.servicos.length === 1 ? 'serviço' : 'serviços'}`} />
            <Cartao rotulo="Índice médio de cuidado" valor={(p.mediaIndice ?? 0).toLocaleString('pt-BR')} detalhe="de 0 a 12" />
            <Cartao rotulo="Dependência grau III" valor={`${percentual(p.grauIII, n)}%`} detalhe={`${p.grauIII} de ${n} pessoas`} />
            <Cartao rotulo="Regrediram" valor={`${percentual(p.regrediram, n)}%`} detalhe={`${p.regrediram} de ${n} desde a avaliação anterior`} />
            <Cartao
              rotulo="Suspeita de violação de direitos"
              valor={String(p.violacao)}
              alerta={p.violacao > 0}
              detalhe={p.violacao ? 'pessoas com encaminhamento a acompanhar' : 'nenhuma suspeita registrada'}
            />
          </dl>

          <div className="grid gap-4 xl:grid-cols-2">
            <Quadro titulo="Índice de necessidade de cuidado" descricao="Cada ponto é uma pessoa. O traço escuro marca a mediana do serviço.">
              <PontosDoIndice servicos={p.servicos} />
            </Quadro>
            <Quadro titulo="Indicadores do diagnóstico" descricao="Percentual de pessoas com cada indicador. Quanto mais forte a cor, maior o percentual.">
              <IndicadoresPorServico servicos={p.servicos} geral={p.geral} />
            </Quadro>
            <Quadro titulo="Grau de dependência" descricao="Conforme a RDC Anvisa 502/2021.">
              <DependenciaPorServico servicos={p.servicos} />
            </Quadro>
            <Quadro titulo="Evolução desde a avaliação anterior">
              <EvolucaoPorServico servicos={p.servicos} />
            </Quadro>
          </div>
          <p className="text-xs text-texto-suave">
            O índice de necessidade de cuidado vai de 0 a 12: o grau de dependência vale até 2 pontos (II = 1, III = 2) e cada indicador presente soma 1
            (isolamento, sobrecarga do cuidador, falta de apoio adequado, sem rede de apoio, cuidador idoso, mãe solo, regressão da pessoa, regressão da
            família, suspeita de violação de direitos e cuidados de saúde). Apoia a análise técnica, não a substitui.
          </p>
        </>
      )}
    </div>
  );
}
