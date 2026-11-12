import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { painelDePrazos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import type { Resumo } from '@/modulos/requisicoes/dominio/painel';
import { textoHoras } from '@/modulos/requisicoes/dominio/sla';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { Linhas } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { TabelaDados, type LinhaDados } from '@/ui/tabela-dados';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export const metadata: Metadata = { title: 'Painel de prazos' };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

function Cartao({ rotulo, valor, detalhe, alerta = false }: { rotulo: string; valor: string; detalhe: ReactNode; alerta?: boolean }) {
  return (
    <div className={`rounded-cartao border bg-superficie px-5 py-4 ${alerta ? 'border-erro' : 'border-borda'}`}>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className={`mt-0.5 text-2xl font-bold leading-tight tabular-nums ${alerta ? 'text-erro' : ''}`}><NumeroQueConta texto={valor} chave={`cartao:${rotulo}`} /></dd>
      <dd className="mt-1 text-sm text-texto-suave">{detalhe}</dd>
    </div>
  );
}

const COLUNAS = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'decididas', rotulo: 'Decididas', tipo: 'numero' as const, somar: true },
  { chave: 'ap_pct', rotulo: 'Aprovação no prazo (%)', tipo: 'numero' as const, calculada: true },
  { chave: 'concluidas', rotulo: 'Concluídas', tipo: 'numero' as const, somar: true },
  { chave: 'at_pct', rotulo: 'Atendimento no prazo (%)', tipo: 'numero' as const, calculada: true },
  { chave: 'parciais', rotulo: 'Em parte', tipo: 'numero' as const, somar: true, secundaria: true },
];

const linhas = (lista: { nome: string; resumo: Resumo }[]): LinhaDados[] =>
  lista.map((x) => ({
    id: x.nome,
    valores: {
      nome: x.nome,
      decididas: x.resumo.aprovacao.total,
      ap_pct: x.resumo.aprovacao.pct,
      concluidas: x.resumo.atendimento.total,
      at_pct: x.resumo.atendimento.pct,
      parciais: x.resumo.parciais,
    },
  }));

export default async function PainelDePrazos({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('requisicoes.painel')) redirect('/requisicoes');
  const app = await obterAplicacao();
  const p = await painelDePrazos(app.planilhas, usuario.autorizador, { de: sp.de, ate: sp.ate });
  const e = p.expediente;
  const horas = (h: number | null) => (h === null ? '—' : textoHoras(h, e));
  const { aprovacao, atendimento, parciais } = p.total;
  const semDados = aprovacao.total === 0 && atendimento.total === 0;
  // No gráfico, só os meses que têm as duas medidas (um mês sem nada não é 0%).
  const comAmbos = p.meses.map((m, i) => ({ m, r: p.porMes[i] })).filter((x) => x.r.aprovacao.pct !== null && x.r.atendimento.pct !== null);
  const periodo = p.de === p.ate ? nomeMes(p.de) : `${nomeMes(p.de)} a ${nomeMes(p.ate)}`;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Painel de prazos' }]}
        titulo="Painel de prazos"
        descricao={
          p.todas
            ? 'Quanto foi decidido e atendido dentro do prazo de cada tipo, em horas úteis.'
            : 'Quanto foi decidido e atendido dentro do prazo, contando só as requisições que você acompanha (do seu escopo ou do seu setor).'
        }
      />

      <form className="flex flex-wrap items-end gap-3 rounded-cartao border border-borda bg-superficie px-5 py-4" method="get">
        <Campo rotulo="De (mês)">
          <input type="month" name="de" defaultValue={p.de} className={`${estiloEntrada} w-44`} />
        </Campo>
        <Campo rotulo="Até (mês)">
          <input type="month" name="ate" defaultValue={p.ate} className={`${estiloEntrada} w-44`} />
        </Campo>
        <BotaoEnviar variante="secundario" enviando="Calculando…">
          Ver período
        </BotaoEnviar>
        <p className="basis-full text-xs text-texto-suave">
          Expediente das {e.inicio}h às {e.fim}h, de segunda a sexta
          {p.feriadosNoPeriodo ? `, sem os ${p.feriadosNoPeriodo} feriados cadastrados no período` : ', sem feriados cadastrados no período'}. A aprovação conta
          no mês da decisão; o atendimento, no mês da conclusão.
        </p>
      </form>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          rotulo="Aprovação no prazo"
          valor={pct(aprovacao.pct)}
          detalhe={
            aprovacao.total ? `${aprovacao.noPrazo} de ${aprovacao.total} decididas · média ${horas(aprovacao.mediaHoras)}` : 'Nenhuma decisão no período'
          }
        />
        <Cartao
          rotulo="Atendimento no prazo"
          valor={pct(atendimento.pct)}
          detalhe={
            atendimento.total
              ? `${atendimento.noPrazo} de ${atendimento.total} concluídas · média ${horas(atendimento.mediaHoras)}`
              : 'Nenhuma conclusão no período'
          }
        />
        <Cartao
          rotulo="Atendidas em parte"
          valor={String(parciais)}
          detalhe={atendimento.total ? `de ${atendimento.total} concluídas no período` : 'Nenhuma conclusão no período'}
        />
        <Cartao
          rotulo="Atrasadas agora"
          valor={String(p.atrasadas.length)}
          alerta={p.atrasadas.length > 0}
          detalhe={p.atrasadas.length ? 'esperando decisão ou atendimento além do prazo' : 'Nada esperando além do prazo'}
        />
      </dl>

      {p.atrasadas.length > 0 && (
        <Secao titulo="Atrasadas agora" descricao="Da mais atrasada para a menos atrasada. Abra a ficha para ver quem precisa agir." id="p-atrasadas">
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Requisições atrasadas agora</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>
                    Número
                  </th>
                  <th scope="col" className={tabela.th}>
                    Tipo
                  </th>
                  <th scope="col" className={tabela.th}>
                    Esperando
                  </th>
                  <th scope="col" className={tabela.th}>
                    Há quanto tempo
                  </th>
                  <th scope="col" className={tabela.th}>
                    Prazo
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.atrasadas.map((a) => (
                  <PiscaOndeMudou key={a.id} chave={`atrasada:${a.id}`} como="tr" className={tabela.linha}>
                    <td className={tabela.td}>
                      <Link href={`/requisicoes/${a.id}`} className="font-semibold text-destaque underline-offset-2 hover:underline">
                        {a.numero}
                      </Link>
                    </td>
                    <td className={tabela.td}>{a.tipo}</td>
                    <td className={tabela.td}>
                      {a.etapa === 'aprovação' ? <Etiqueta tipo="atencao">Decisão</Etiqueta> : <Etiqueta tipo="info">{a.setor}</Etiqueta>}
                    </td>
                    <td className={`${tabela.td} text-erro`}>{textoHoras(a.horas, e)}</td>
                    <td className={tabela.td}>{textoHoras(a.prazo, e)}</td>
                  </PiscaOndeMudou>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {semDados ? (
        <EstadoVazio titulo={`Nenhuma requisição decidida ou concluída em ${periodo}`}>Escolha outro período acima.</EstadoVazio>
      ) : (
        <>
          {comAmbos.length >= 2 && (
            <Secao
              titulo="Mês a mês"
              descricao="Percentual no prazo em cada mês. Meses sem decisão ou sem conclusão ficam de fora do gráfico; a tabela abaixo mostra todos."
            >
              <Linhas
                descricao={`Percentual de aprovação e de atendimento no prazo, ${periodo}`}
                formato="pct"
                minimo={0}
                maximo={100}
                categorias={comAmbos.map((x) => nomeMes(x.m))}
                series={[
                  { nome: 'Aprovação no prazo', valores: comAmbos.map((x) => x.r.aprovacao.pct ?? 0), cor: 1 },
                  { nome: 'Atendimento no prazo', valores: comAmbos.map((x) => x.r.atendimento.pct ?? 0), cor: 2 },
                ]}
              />
            </Secao>
          )}

          <Secao titulo="Por mês" id="p-mes">
            <TabelaDados
              legenda={`Prazos por mês, ${periodo}`}
              colunas={[{ chave: 'nome', rotulo: 'Mês' }, ...COLUNAS.slice(1)]}
              linhas={linhas(p.meses.map((m, i) => ({ nome: nomeMes(m), resumo: p.porMes[i] })))}
            />
          </Secao>

          <div className="grid gap-6 xl:grid-cols-2">
            <Secao titulo="Por setor" descricao="Setor que atende o tipo." id="p-setor">
              <TabelaDados
                legenda={`Prazos por setor, ${periodo}`}
                colunas={[{ chave: 'nome', rotulo: 'Setor' }, ...COLUNAS.slice(1)]}
                linhas={linhas(p.porSetor)}
              />
            </Secao>
            <Secao titulo="Por tipo" id="p-tipo">
              <TabelaDados
                legenda={`Prazos por tipo, ${periodo}`}
                colunas={[{ chave: 'nome', rotulo: 'Tipo' }, ...COLUNAS.slice(1)]}
                linhas={linhas(p.porTipo)}
              />
            </Secao>
          </div>
        </>
      )}
    </div>
  );
}
