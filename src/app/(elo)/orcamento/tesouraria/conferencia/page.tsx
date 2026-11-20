import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerConferencia } from '@/modulos/orcamento/aplicacao/conferencia';
import { mesAnterior, mesAtualBrasilia, mesValido } from '@/modulos/orcamento/dominio/tesouraria';
import { reais, rotuloMes } from '@/modulos/orcamento/telas/formato';
import { SeletorMes } from '@/modulos/orcamento/telas/seletor-mes';
import { ResultadoDaConferencia } from '@/modulos/orcamento/telas/situacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina, EstadoVazio, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Conferência' };

export default async function ConferenciaPagina({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: pedido } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const atual = mesAtualBrasilia();
  const opcoes = [atual];
  while (opcoes.length < 24) opcoes.push(mesAnterior(opcoes[opcoes.length - 1]));
  const disponivel = !!pedido && mesValido(pedido) && opcoes.includes(pedido);
  const mes = disponivel ? pedido : mesAnterior(atual);
  const app = await obterAplicacao();
  const c = await lerConferencia(app.planilhas, usuario.autorizador, mes);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.tesouraria.editar');
  const irParaSaldos = (m: string) => (podeEditar ? `/orcamento/tesouraria?mes=${m}` : null);
  const atalho = (faltam: { o: 'saldo' | 'realizado'; mes: string }[]) => {
    const f = faltam[0];
    if (!f) return undefined;
    const href = f.o === 'saldo' ? irParaSaldos(f.mes) : usuario.autorizador.temPermissao('orcamento.realizado.editar') ? `/orcamento/execucao/realizado?mes=${f.mes}` : null;
    return href ? (
      <Link href={href} className="font-semibold text-destaque underline">
        Informar
      </Link>
    ) : undefined;
  };
  const ajuste = podeEditar ? (
    <Link href={`/orcamento/tesouraria?mes=${mes}`} className="font-semibold text-destaque underline">
      Ajuste de conciliação
    </Link>
  ) : undefined;
  const moeda = (v: number | null) => (v === null ? '—' : reais(v));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Tesouraria' }, { rotulo: 'Conferência' }]}
        titulo={`Conferência de ${rotuloMes(mes)}`}
        descricao="O saldo do extrato bate com o que foi informado no realizado? O Elo só mostra a diferença; para explicá-la, registre um ajuste de conciliação em Saldos do mês."
        acoes={<SeletorMes mes={mes} opcoes={opcoes.map((m) => ({ valor: m, rotulo: rotuloMes(m) }))} />}
      />

      {pedido && !disponivel && <Aviso tipo="info">Esse mês não está disponível; mostramos {rotuloMes(mes)}.</Aviso>}

      <section aria-labelledby="t-termos" className="space-y-3">
        <div>
          <h2 id="t-termos" className="text-lg font-bold">
            Termos (contas vinculadas)
          </h2>
          <p className="text-sm text-texto-suave">Saldo do mês − (saldo do mês anterior + entradas − saídas da fonte no realizado). Contas da mesma fonte são somadas.</p>
        </div>
        {c.termos.length === 0 ? (
          <EstadoVazio titulo="Nenhuma conta vinculada">
            Cadastre as contas de cada termo em{' '}
            <Link href="/orcamento/tesouraria/contas" className="font-semibold underline">
              Contas
            </Link>
            .
          </EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Conferência dos termos em {rotuloMes(mes)}</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Fonte e contas</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Saldo do mês</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Saldo anterior</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Entradas</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Saídas</th>
                  <th scope="col" className={tabela.th}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {c.termos.map((t) => (
                  <tr key={t.fonteId} className={tabela.linha}>
                    <th scope="row" className={`${tabela.td} text-left font-semibold`}>
                      {t.fonteNome}
                      <span className="block text-xs font-normal text-texto-suave">{t.contas.join(' + ')}</span>
                    </th>
                    <td className={`${tabela.td} ${tabela.numero}`}>{moeda(t.saldoMes)}</td>
                    <td className={`${tabela.td} ${tabela.numero}`}>{moeda(t.saldoAnterior)}</td>
                    <td className={`${tabela.td} ${tabela.numero}`}>{reais(t.entradas)}</td>
                    <td className={`${tabela.td} ${tabela.numero}`}>{reais(t.saidas)}</td>
                    <td className={`${tabela.td} min-w-56`}>
                      <ResultadoDaConferencia situacao={t.situacao} diferenca={t.diferenca} faltam={t.faltam} acao={t.situacao === 'diferenca' ? ajuste : atalho(t.faltam)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="t-livre" className="space-y-3">
        <div>
          <h2 id="t-livre" className="text-lg font-bold">
            Recurso livre
          </h2>
          <p className="text-sm text-texto-suave">Quanto o saldo livre (disponível + reserva) mudou no mês − receita menos despesa das fontes de uso livre no realizado.</p>
        </div>
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Conferência do recurso livre em {rotuloMes(mes)}</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={`${tabela.th} text-right`}>Saldo livre do mês</th>
                <th scope="col" className={`${tabela.th} text-right`}>Saldo livre anterior</th>
                <th scope="col" className={`${tabela.th} text-right`}>Variação</th>
                <th scope="col" className={`${tabela.th} text-right`}>Resultado do realizado</th>
                <th scope="col" className={tabela.th}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr className={tabela.linha}>
                <td className={`${tabela.td} ${tabela.numero}`}>{moeda(c.recursoLivre.saldoMes)}</td>
                <td className={`${tabela.td} ${tabela.numero}`}>{moeda(c.recursoLivre.saldoAnterior)}</td>
                <td className={`${tabela.td} ${tabela.numero}`}>{moeda(c.recursoLivre.variacao)}</td>
                <td className={`${tabela.td} ${tabela.numero}`}>{c.recursoLivre.situacao === 'sem_dado' && c.recursoLivre.faltam.some((f) => f.o === 'realizado') ? '—' : reais(c.recursoLivre.resultadoLivre)}</td>
                <td className={`${tabela.td} min-w-56`}>
                  <ResultadoDaConferencia
                    situacao={c.recursoLivre.situacao}
                    diferenca={c.recursoLivre.diferenca}
                    faltam={c.recursoLivre.faltam}
                    acao={c.recursoLivre.situacao === 'diferenca' ? ajuste : atalho(c.recursoLivre.faltam)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
