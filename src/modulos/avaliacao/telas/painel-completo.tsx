/**
 * O painel inteiro (cartões e gráficos), usado na tela e na versão para imprimir.
 * Na impressão, cada quadro fica inteiro numa página e as tabelas de números saem abertas.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { percentual, type PainelAvaliacao } from '../dominio/painel';
import {
  DependenciaPorServico,
  EvolucaoEntreAvaliacoes,
  EvolucaoPorServico,
  IndicadoresPorServico,
  IndicadoresPorSexo,
  PiramideSexo,
  PontosDoIndice,
  TransportePorServico,
} from './graficos-painel';

function Cartao({ rotulo, valor, detalhe, alerta = false }: { rotulo: string; valor: string; detalhe: ReactNode; alerta?: boolean }) {
  return (
    <div
      className={`rounded-cartao border bg-superficie px-4 py-3 break-inside-avoid print:rounded-lg print:px-3 print:py-2 ${alerta ? 'border-erro' : 'border-borda'}`}
    >
      <dt className="text-sm leading-tight text-texto-suave print:text-[11px]">{rotulo}</dt>
      <dd className={`text-2xl font-bold leading-tight tabular-nums print:text-xl ${alerta ? 'text-erro' : ''}`}>{valor}</dd>
      <dd className="text-xs text-texto-suave print:text-[11px]">{detalhe}</dd>
    </div>
  );
}

function Quadro({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 break-inside-avoid rounded-cartao border border-borda bg-superficie px-5 py-4 print:rounded-lg print:px-4 print:py-3">
      <h3 className="font-bold">{titulo}</h3>
      {descricao ? <p className="mb-3 text-sm text-texto-suave print:mb-2 print:text-[12px]">{descricao}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Parte({ numero, titulo, children, umaColuna }: { numero: number; titulo: string; children: ReactNode; umaColuna: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold break-after-avoid">
        <span className="flex size-7 items-center justify-center rounded-lg bg-destaque-suave text-sm text-destaque">{numero}</span>
        {titulo}
      </h2>
      <div className={`grid gap-4 ${umaColuna ? '' : 'xl:grid-cols-2'} print:grid-cols-1`}>{children}</div>
    </section>
  );
}

export function PainelCompleto({ p, impressao = false }: { p: PainelAvaliacao; impressao?: boolean }) {
  const n = p.total;
  return (
    <div className="space-y-6 print:space-y-4">
      <dl className={`grid gap-3 print:grid-cols-6 print:gap-2 ${impressao ? 'grid-cols-3' : 'sm:grid-cols-3 xl:grid-cols-6'}`}>
        <Cartao
          rotulo="Pessoas avaliadas"
          valor={String(n)}
          detalhe={`${p.avaliacoes} ${p.avaliacoes === 1 ? 'avaliação' : 'avaliações'} em ${p.servicos.length} ${p.servicos.length === 1 ? 'serviço' : 'serviços'}`}
        />
        <Cartao rotulo="Índice médio de cuidado" valor={(p.mediaIndice ?? 0).toLocaleString('pt-BR')} detalhe="de 0 a 12, na última avaliação" />
        <Cartao rotulo="Dependência grau III" valor={`${percentual(p.grauIII, n)}%`} detalhe={`${p.grauIII} de ${n} pessoas`} />
        <Cartao rotulo="Regrediram" valor={`${percentual(p.regrediram, n)}%`} detalhe={`${p.regrediram} de ${n} desde a avaliação anterior`} />
        <Cartao
          rotulo="Reavaliação anual atrasada"
          valor={String(p.reavaliacao.atrasadas)}
          alerta={p.reavaliacao.atrasadas > 0}
          detalhe={p.reavaliacao.venceEmBreve ? `e ${p.reavaliacao.venceEmBreve} vencem em até 30 dias` : 'nenhuma vence em até 30 dias'}
        />
        <Cartao
          rotulo="Suspeita de violação de direitos"
          valor={String(p.violacao)}
          alerta={p.violacao > 0}
          detalhe={p.violacao ? 'pessoas com encaminhamento a acompanhar' : 'nenhuma suspeita registrada'}
        />
      </dl>

      <Parte numero={1} titulo="Necessidade de cuidado" umaColuna={impressao}>
        <Quadro
          titulo="Índice de necessidade de cuidado"
          descricao="Cada ponto é uma pessoa, pela avaliação mais recente. O traço escuro marca a mediana do serviço."
        >
          <PontosDoIndice servicos={p.servicos} impressao={impressao} />
        </Quadro>
        <Quadro titulo="Indicadores do diagnóstico" descricao="Percentual de pessoas com cada indicador. Quanto mais forte a cor, maior o percentual.">
          <IndicadoresPorServico servicos={p.servicos} geral={p.geral} />
        </Quadro>
      </Parte>

      <Parte numero={2} titulo="Evolução" umaColuna={impressao}>
        <Quadro
          titulo="Evolução entre avaliações da mesma pessoa"
          descricao={`${p.comparadas} ${p.comparadas === 1 ? 'pessoa tem' : 'pessoas têm'} duas ou mais avaliações. Índice menor na última = melhora na qualidade de vida.`}
        >
          <EvolucaoEntreAvaliacoes servicos={p.servicos} geral={p.geral} impressao={impressao} />
        </Quadro>
        <Quadro
          titulo="Evolução percebida pela equipe"
          descricao="Resposta da avaliação mais recente: a pessoa e a família regrediram, mantiveram ou melhoraram."
        >
          <EvolucaoPorServico servicos={p.servicos} impressao={impressao} />
        </Quadro>
      </Parte>

      <Parte numero={3} titulo="Dependência e mobilidade" umaColuna={impressao}>
        <Quadro titulo="Grau de dependência" descricao="Conforme a RDC Anvisa 502/2021.">
          <DependenciaPorServico servicos={p.servicos} impressao={impressao} />
        </Quadro>
        <Quadro titulo="Transporte necessário" descricao="Tipo de veículo que cada pessoa precisa: base para planejar rotas e frota.">
          <TransportePorServico servicos={p.servicos} impressao={impressao} />
        </Quadro>
      </Parte>

      <Parte numero={4} titulo="Análise por sexo" umaColuna={impressao}>
        <Quadro titulo="Pessoas por geração e sexo">
          <PiramideSexo piramide={p.piramide} sexo={p.sexo} impressao={impressao} />
        </Quadro>
        <Quadro
          titulo="Indicadores entre mulheres e homens"
          descricao="Percentual de cada grupo com o indicador. Quanto mais longe os pontos, maior a diferença."
        >
          <IndicadoresPorSexo itens={p.indicadoresPorSexo} impressao={impressao} />
        </Quadro>
      </Parte>

      <p className="text-xs text-texto-suave break-inside-avoid">
        Cada pessoa conta uma vez, pela avaliação mais recente do período. Índice de necessidade de cuidado (0 a 12): grau de dependência II = 1 e III = 2; soma
        1 cada indicador presente (isolamento, sobrecarga do cuidador, falta de apoio adequado, sem rede de apoio, cuidador idoso, mãe solo, regressão da
        pessoa, regressão da família, suspeita de violação de direitos e cuidados de saúde). Apoia a análise técnica, não a substitui.{' '}
        {!impressao && (
          <Link href="/avaliacao/sobre" className="font-semibold text-destaque underline-offset-2 hover:underline">
            Base técnica e legal do instrumento
          </Link>
        )}
      </p>
    </div>
  );
}
