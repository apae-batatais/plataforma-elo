import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { painelDaAvaliacao, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { percentual } from '@/modulos/avaliacao/dominio/painel';
import { BarraImpressao } from '@/modulos/avaliacao/telas/barra-impressao';
import { agoraBrasilia, Folha } from '@/modulos/avaliacao/telas/folha';
import { DependenciaPorServico, EvolucaoPorServico, IndicadoresPorServico, PontosDoIndice } from '@/modulos/avaliacao/telas/graficos-painel';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export const metadata: Metadata = { title: 'Painel da Avaliação Diagnóstica para imprimir' };

const MES = /^\d{4}-\d{2}$/;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;

/** Cada quadro fica inteiro numa página: se não couber no fim de uma, começa na próxima. */
function Quadro({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-lg border border-borda px-4 py-3">
      <h2 className="font-bold">{titulo}</h2>
      {descricao && <p className="mb-2 text-[12px] text-texto-suave">{descricao}</p>}
      {!descricao && <div className="mb-2" />}
      {children}
    </section>
  );
}

export default async function ImprimirPainel({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.painel)) redirect('/avaliacao');
  const app = await obterAplicacao();
  const de = sp.de && MES.test(sp.de) ? sp.de : '';
  const ate = sp.ate && MES.test(sp.ate) ? sp.ate : '';
  const p = await painelDaAvaliacao(app.planilhas, usuario.autorizador, { de, ate });
  const n = p.total;
  const periodo = de || ate ? `Avaliações de ${de ? nomeMes(de) : 'o início'} a ${ate ? nomeMes(ate) : 'hoje'}` : 'Todas as avaliações salvas';
  const voltar = `/avaliacao/painel${de || ate ? `?${new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}) })}` : ''}`;

  return (
    <div>
      <BarraImpressao voltar={voltar} rotuloVoltar="Voltar para o painel" />
      <Folha
        instituicao={app.instituicao.nome}
        titulo="Painel por serviço atual"
        subtitulo={`${periodo} · ${p.todos ? 'todos os serviços' : 'serviços do escopo de quem emitiu'}`}
        emitidoPor={usuario.nome}
        emitidoEm={agoraBrasilia()}
        sigilo="Números agregados: nenhuma pessoa é identificada neste documento."
      >
        {n === 0 ? (
          <p className="py-8 text-center text-texto-suave">Nenhuma avaliação no período.</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-5 gap-2 break-inside-avoid">
              {(
                [
                  ['Pessoas avaliadas', String(n), `em ${p.servicos.length} ${p.servicos.length === 1 ? 'serviço' : 'serviços'}`],
                  ['Índice médio de cuidado', (p.mediaIndice ?? 0).toLocaleString('pt-BR'), 'de 0 a 12'],
                  ['Dependência grau III', `${percentual(p.grauIII, n)}%`, `${p.grauIII} de ${n}`],
                  ['Regrediram', `${percentual(p.regrediram, n)}%`, `${p.regrediram} de ${n}`],
                  ['Suspeita de violação', String(p.violacao), p.violacao ? 'pessoas' : 'nenhuma'],
                ] as const
              ).map(([r, v, x]) => (
                <div key={r} className="rounded-lg border border-borda px-3 py-2">
                  <dt className="text-[11px] leading-tight text-texto-suave">{r}</dt>
                  <dd className="text-xl font-bold leading-tight tabular-nums">{v}</dd>
                  <dd className="text-[11px] text-texto-suave">{x}</dd>
                </div>
              ))}
            </dl>
            <Quadro titulo="Índice de necessidade de cuidado" descricao="Cada ponto é uma pessoa. O traço escuro marca a mediana do serviço.">
              <PontosDoIndice servicos={p.servicos} impressao />
            </Quadro>
            <Quadro titulo="Indicadores do diagnóstico" descricao="Percentual de pessoas com cada indicador.">
              <IndicadoresPorServico servicos={p.servicos} geral={p.geral} />
            </Quadro>
            <Quadro titulo="Grau de dependência" descricao="Conforme a RDC Anvisa 502/2021.">
              <DependenciaPorServico servicos={p.servicos} impressao />
            </Quadro>
            <Quadro titulo="Evolução desde a avaliação anterior">
              <EvolucaoPorServico servicos={p.servicos} impressao />
            </Quadro>
            <p className="text-[11px] text-texto-suave break-inside-avoid">
              Índice de necessidade de cuidado (0 a 12): grau de dependência II = 1 e III = 2; soma 1 cada indicador presente (isolamento, sobrecarga do
              cuidador, falta de apoio adequado, sem rede de apoio, cuidador idoso, mãe solo, regressão da pessoa, regressão da família, suspeita de violação de
              direitos e cuidados de saúde). Apoia a análise técnica, não a substitui.
            </p>
          </div>
        )}
      </Folha>
    </div>
  );
}
