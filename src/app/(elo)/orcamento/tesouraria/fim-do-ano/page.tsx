import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerFimDoAno } from '@/modulos/orcamento/aplicacao/fim-do-ano';
import { prepararGrafico } from '@/modulos/orcamento/telas/fim-do-ano';
import { reais, rotuloMes } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { Linhas } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Fim do ano' };

export default async function FimDoAnoPagina() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const f = await lerFimDoAno(app.planilhas, usuario.autorizador);
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Tesouraria' }, { rotulo: 'Fim do ano' }];
  const podeEditar = usuario.autorizador.temPermissao('orcamento.tesouraria.editar');

  if (f.partida === null) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina trilha={trilha} titulo={`Fim de ${f.ano}`} descricao="Vai sobrar ou faltar dinheiro livre em 31 de dezembro?" />
        <EstadoVazio titulo="Informe os saldos do mês" acao={podeEditar ? <LinkBotao href="/orcamento/tesouraria">Informar saldos</LinkBotao> : undefined}>
          Os cenários partem do último mês do ano com saldo. Sem nenhum saldo em {f.ano}, não dá para projetar.
        </EstadoVazio>
      </div>
    );
  }

  const g = prepararGrafico(f.series);
  const folga = f.folgaDoSinal;
  const ano1 = f.ano - 1;
  const por = (id: string) => f.cenarios.find((c) => c.id === id)!;
  const acima = folga !== null && folga >= 0;
  const reserva = f.reservaAtual ?? 0;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo={`Fim de ${f.ano}`}
        descricao={`Vai sobrar ou faltar dinheiro livre em 31 de dezembro? Partimos do saldo de ${rotuloMes(f.partida)} (livre disponível + reserva), o último mês com saldo.`}
      />

      <Secao titulo={folga === null ? 'Ainda não dá para dizer como o ano fecha' : acima ? 'O saldo livre fecha o ano acima da reserva' : 'O saldo livre fecha o ano abaixo da reserva'}>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            {g.series.length > 0 ? (
              <Linhas
                categorias={g.categorias}
                series={g.series}
                formato="moeda"
                referencias={[{ valor: reserva, rotulo: 'Reserva atual' }]}
                descricao={`Saldo livre (disponível mais reserva) no fim de cada mês, em ${g.series.map((s) => s.nome).join(', ')}, com a reserva atual de ${reais(reserva)} como referência.`}
              />
            ) : (
              <EstadoVazio titulo="Sem saldos para desenhar">Informe os saldos de mais meses para ver a evolução.</EstadoVazio>
            )}
            {g.foraDoGrafico.length > 0 && (
              <p className="text-sm text-texto-suave">
                Sem saldos informados nesses meses em {g.foraDoGrafico.join(' e ')}: ficam fora do gráfico (mês sem saldo nunca é desenhado como zero).
              </p>
            )}
          </div>
          <aside className="space-y-3" aria-label="Folga prevista em dezembro">
            <div className="rounded-cartao border border-borda bg-superficie-2 px-5 py-4">
              <p className="text-sm text-texto-suave">Folga prevista em dezembro</p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums">
                {folga === null ? '—' : <NumeroQueConta texto={reais(folga)} chave="folga-fim-ano" />}
              </p>
              {folga === null ? (
                <p className="mt-1 text-sm">
                  Falta o realizado de {ano1} nos meses que restam: {por('ano1_com').faltam.map((m) => rotuloMes(m)).join(', ') || 'informe os saldos'}.
                </p>
              ) : acima ? (
                <p className="mt-1 text-sm">Se {f.ano} se repetir como {ano1} (com não recorrentes), sobram {reais(folga)} acima da reserva.</p>
              ) : (
                <p className="mt-1 text-sm">Se {f.ano} se repetir como {ano1} (com não recorrentes), faltam {reais(-folga)}: seria preciso usar a reserva em {reais(-folga)}.</p>
              )}
              {folga !== null && !acima && (
                <p className="mt-2 text-sm text-texto-suave">
                  Peça o uso da reserva em{' '}
                  <Link href="/orcamento/tesouraria/reserva" className="font-semibold underline">
                    Reserva
                  </Link>{' '}
                  ou reduza o gasto com recurso livre.
                </p>
              )}
            </div>
          </aside>
        </div>
      </Secao>

      <Secao titulo="Os cenários" descricao="Cada cenário soma ao saldo de partida o resultado do recurso livre dos meses que faltam. Só o primeiro alimenta o sinal da Visão geral.">
        <TabelaDados
          legenda="Cenários de fim do ano"
          colunas={[
            { chave: 'cenario', rotulo: 'Cenário' },
            { chave: 'saldo', rotulo: 'Saldo previsto em dezembro', tipo: 'moeda' },
            { chave: 'folga', rotulo: 'Folga (saldo − reserva)', tipo: 'moeda' },
            { chave: 'obs', rotulo: 'Observação' },
          ]}
          linhas={[por('ano1_com'), por('ano1_sem'), por('ano2_com'), por('ano2_sem'), por('previsao')].map((c) => ({
            id: c.id,
            valores: {
              cenario: c.rotulo,
              saldo: c.saldoDezembro,
              folga: c.folga,
              obs:
                c.saldoDezembro === null
                  ? c.faltam.length
                    ? `Sem dado: falta o realizado de ${c.faltam.map((m) => rotuloMes(m)).join(', ')}`
                    : `Sem dado: ${c.motivo ?? 'sem informação'}`
                  : c.folga !== null && c.folga < 0
                    ? `Seria preciso usar a reserva em ${reais(-c.folga)}`
                    : '',
            },
          }))}
        />
        <p className="mt-3 text-sm text-texto-suave">
          O {f.ano} ainda está em andamento. Pedidos de uso da reserva não entram nestas contas; o saldo continua vindo do extrato digitado.
        </p>
      </Secao>
    </div>
  );
}
