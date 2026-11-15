import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { painelDePassivo, type PedidoSimulacao } from '@/modulos/orcamento/aplicacao/passivo';
import { data as dataBr, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { AtalhosSecoes } from '@/ui/atalhos-secoes';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { BarrasHorizontais } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Passivo trabalhista' };

const MAX_BARRAS = 7;

/** Até 7 itens e o resto somado em "Outros". */
function agrupar<T extends { nome: string; valor: number }>(itens: T[]): { nome: string; valor: number }[] {
  if (itens.length <= MAX_BARRAS) return itens.map((x) => ({ nome: x.nome, valor: x.valor }));
  const resto = itens.slice(MAX_BARRAS - 1).reduce((s, x) => s + x.valor, 0);
  return [...itens.slice(0, MAX_BARRAS - 1).map((x) => ({ nome: x.nome, valor: x.valor })), { nome: 'Outros', valor: Math.round(resto * 100) / 100 }];
}

const parte = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

export default async function PassivoTrabalhista({ searchParams }: { searchParams: Promise<{ alvo?: string; termino?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('orcamento.folha.ver')) redirect('/orcamento');
  const app = await obterAplicacao();
  const filtros = await searchParams;
  const [tipo, ...resto] = (filtros.alvo ?? '').split(':');
  const pedido: PedidoSimulacao | null =
    (tipo === 'servico' || tipo === 'fonte') && resto.length ? { tipo, codigo: resto.join(':'), data: filtros.termino ?? '' } : null;
  const r = await painelDePassivo(app.planilhas, usuario.autorizador, pedido);
  const s = r.simulacao;
  const c = r.composicao;
  const componentes = [
    { nome: 'Férias', valor: c.ferias },
    { nome: '13º salário', valor: c.decimo },
    { nome: 'Aviso prévio', valor: c.aviso },
    { nome: 'Multa do FGTS', valor: c.multa },
  ];
  const maior = [...componentes].sort((a, b) => b.valor - a.valor)[0];
  const servicos = agrupar(r.porServico);
  const fontes = agrupar(r.porFonte);
  const vazio = r.pessoasCalculadas === 0;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Passivo trabalhista' }]}
        titulo="Passivo trabalhista"
        descricao="Quanto a instituição deveria se desligasse cada pessoa hoje, sem justa causa. É uma estimativa pela data de admissão e pela folha."
      />
      <AtalhosSecoes
        secoes={[
          { id: 'resumo', rotulo: 'Resumo' },
          { id: 'composicao', rotulo: 'Composição' },
          { id: 'servico', rotulo: 'Por serviço' },
          { id: 'fonte', rotulo: 'Por fonte' },
          { id: 'reserva', rotulo: 'Reserva' },
          { id: 'simulacao', rotulo: 'Simulação' },
        ]}
      />

      {(r.pendencias.semDados > 0 || r.pendencias.emDobro > 0) && (
        <Aviso tipo="atencao" titulo="Pendências no cálculo">
          <ul className="list-disc pl-5">
            {r.pendencias.semDados > 0 && (
              <li>
                {r.pendencias.semDados} {r.pendencias.semDados === 1 ? 'pessoa sem dados' : 'pessoas sem dados'} para calcular (falta valor da folha); fora do total.
              </li>
            )}
            {r.pendencias.emDobro > 0 && (
              <li>
                {r.pendencias.emDobro} {r.pendencias.emDobro === 1 ? 'pessoa com férias em dobro' : 'pessoas com férias em dobro'}: o prazo para conceder as férias já passou.
              </li>
            )}
          </ul>
          {r.pendencias.pessoas && r.pendencias.pessoas.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {r.pendencias.pessoas.map((x) => (
                <Link key={`${x.id}-${x.motivo}`} href={`/orcamento/folha/${x.id}`} className="underline">
                  {x.nome} ({x.motivo === 'em_dobro' ? 'férias em dobro' : 'sem dados'})
                </Link>
              ))}
            </p>
          )}
        </Aviso>
      )}

      <section id="resumo" aria-labelledby="t-resumo" className="scroll-mt-20 space-y-3">
        <h2 id="t-resumo" className="sr-only">
          Resumo
        </h2>
        {vazio ? (
          <EstadoVazio titulo="Ainda não há passivo para calcular">Cadastre funcionários com código e valores na folha. Vagas previstas não entram.</EstadoVazio>
        ) : (
          <div className="rounded-cartao border border-borda bg-superficie px-5 py-4">
            <p className="text-sm text-texto-suave">Se todos saíssem hoje, em {dataBr(r.data)}, a instituição deveria</p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums">
              <NumeroQueConta texto={reais(r.total)} chave="passivo-total" />
            </p>
            <p className="text-sm text-texto-suave">
              {r.pessoasCalculadas} {r.pessoasCalculadas === 1 ? 'pessoa' : 'pessoas'}. Estimativa pela data de admissão e pela folha
              {r.podeEditar ? '; corrija com extratos do FGTS e férias tiradas na ficha de cada funcionário.' : '.'}
            </p>
            <a href="#simulacao" className="mt-3 inline-block text-sm font-semibold underline">
              Simular término de serviço ou termo
            </a>
          </div>
        )}
      </section>

      {!vazio && (
        <>
          <Secao id="composicao" titulo={`${maior.nome === 'Multa do FGTS' ? 'A multa do FGTS' : maior.nome === 'Aviso prévio' ? 'O aviso prévio' : maior.nome === '13º salário' ? 'O 13º salário' : 'As férias'} ${maior.nome === 'Multa do FGTS' || maior.nome === 'Aviso prévio' || maior.nome === '13º salário' ? 'é' : 'são'} a maior parte do passivo`} descricao={`${parte(maior.valor, r.total)}% do total, ${reais(maior.valor)}.`} className="scroll-mt-20">
            <BarrasHorizontais
              categorias={componentes.map((x) => x.nome)}
              series={[{ nome: 'Passivo', valores: componentes.map((x) => x.valor), cor: 1 }]}
              formato="moeda"
              rotuloCategoria="Verba"
              descricao={`Passivo por tipo de verba: ${componentes.map((x) => `${x.nome} ${reais(x.valor)}`).join('; ')}.`}
            />
          </Secao>

          <Secao id="servico" titulo={`O serviço ${r.porServico[0].nome} concentra ${parte(r.porServico[0].valor, r.total)}% do passivo`} descricao="Passivo de cada pessoa dividido pela lotação." className="scroll-mt-20">
            <div className="space-y-4">
              <BarrasHorizontais
                categorias={servicos.map((x) => x.nome)}
                series={[{ nome: 'Passivo', valores: servicos.map((x) => x.valor), cor: 1 }]}
                formato="moeda"
                rotuloCategoria="Serviço"
                descricao={`Passivo por serviço. O maior é ${r.porServico[0].nome}, ${reais(r.porServico[0].valor)}.`}
              />
              <TabelaDados
                legenda="Passivo trabalhista por serviço"
                colunas={[{ chave: 'nome', rotulo: 'Serviço' }, { chave: 'valor', rotulo: 'Passivo', tipo: 'moeda', somar: true }]}
                linhas={r.porServico.map((x) => ({ id: x.codigo, valores: { nome: x.nome, valor: x.valor } }))}
              />
            </div>
          </Secao>

          <Secao id="fonte" titulo={`A fonte ${r.porFonte[0].nome} concentra ${parte(r.porFonte[0].valor, r.total)}% do passivo`} descricao="Pelo rateio de fonte do serviço no cadastro atual." className="scroll-mt-20">
            <div className="space-y-4">
              <BarrasHorizontais
                categorias={fontes.map((x) => x.nome)}
                series={[{ nome: 'Passivo', valores: fontes.map((x) => x.valor), cor: 1 }]}
                formato="moeda"
                rotuloCategoria="Fonte"
                descricao={`Passivo por fonte de recurso. A maior é ${r.porFonte[0].nome}, ${reais(r.porFonte[0].valor)}.`}
              />
              <TabelaDados
                legenda="Passivo trabalhista por fonte"
                colunas={[{ chave: 'nome', rotulo: 'Fonte' }, { chave: 'valor', rotulo: 'Passivo', tipo: 'moeda', somar: true }]}
                linhas={r.porFonte.map((x) => ({ id: x.id, valores: { nome: x.nome, valor: x.valor } }))}
              />
              <p className="text-sm text-texto-suave">Informação: se a fonte pode pagar essas verbas depende do plano de aplicação do termo, que ainda não foi conferido.</p>
            </div>
          </Secao>

          {r.pessoas && (
            <Secao titulo="Por pessoa" descricao="Só para quem vê os valores individuais. Clique no nome para abrir a ficha." className="scroll-mt-20">
              <TabelaDados
                grande
                legenda="Passivo trabalhista por pessoa"
                colunas={[
                  { chave: 'nome', rotulo: 'Pessoa' },
                  { chave: 'cargo', rotulo: 'Cargo' },
                  { chave: 'ferias', rotulo: 'Férias', tipo: 'moeda', somar: true },
                  { chave: 'decimo', rotulo: '13º', tipo: 'moeda', somar: true },
                  { chave: 'aviso', rotulo: 'Aviso prévio', tipo: 'moeda', somar: true },
                  { chave: 'multa', rotulo: 'Multa do FGTS', tipo: 'moeda', somar: true },
                  { chave: 'total', rotulo: 'Total', tipo: 'moeda', somar: true },
                  { chave: 'dobro', rotulo: 'Férias em dobro' },
                ]}
                linhas={r.pessoas.map((x) => ({
                  id: x.id,
                  valores: { nome: x.nome, cargo: x.cargo, ferias: x.ferias, decimo: x.decimo, aviso: x.aviso, multa: x.multa, total: x.total, dobro: x.emDobro ? 'Sim' : 'Não' },
                  celulas: { nome: <Link href={`/orcamento/folha/${x.id}`} className="underline">{x.nome}</Link> },
                }))}
              />
            </Secao>
          )}

          <Secao id="reserva" titulo="Reserva trabalhista" className="scroll-mt-20">
            <EstadoVazio titulo="O saldo da reserva ainda não é informado no Elo">
              Assim que o Financeiro puder informar o saldo da reserva, ele aparece aqui ao lado do passivo, com a parcela coberta.
            </EstadoVazio>
          </Secao>
        </>
      )}

      <Secao id="simulacao" titulo="Simular término de serviço ou termo" descricao="Calcula o passivo na data escolhida e a parte que cabe ao serviço ou à fonte. Não grava nada." className="scroll-mt-20">
        <form method="get" action="/orcamento/passivo" className="grid items-end gap-4 sm:grid-cols-[1fr_12rem_auto]">
          <Campo rotulo="Serviço ou termo" obrigatorio>
            <select name="alvo" required defaultValue={filtros.alvo ?? ''} className={estiloEntrada}>
              <option value="" disabled>
                Escolha…
              </option>
              <optgroup label="Serviços">
                {r.opcoes.servicos.map((x) => (
                  <option key={x.codigo} value={`servico:${x.codigo}`}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Fontes (termos)">
                {r.opcoes.fontes.map((x) => (
                  <option key={x.id} value={`fonte:${x.id}`}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          </Campo>
          <Campo rotulo="Data de término" obrigatorio>
            <input type="date" name="termino" required defaultValue={filtros.termino ?? ''} className={estiloEntrada} />
          </Campo>
          <BotaoEnviar enviando="Calculando…">Calcular</BotaoEnviar>
        </form>
        <div className="mt-5" aria-live="polite">
          {r.erroSimulacao && <Aviso tipo="erro">{r.erroSimulacao}</Aviso>}
          {!s && !r.erroSimulacao && <p className="text-sm text-texto-suave">Escolha um serviço ou termo e a data em que ele acaba, e clique em Calcular.</p>}
          {s && (
            <div className="space-y-4">
              <h3 className="text-base font-bold">
                Se {s.nome} acabar em {dataBr(s.data)}, o passivo atribuído a ele é {reais(s.parcela)}
              </h3>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-cartao border border-borda px-4 py-3">
                  <dt className="text-sm text-texto-suave">Parcela atribuída</dt>
                  <dd className="text-xl font-bold tabular-nums">{reais(s.parcela)}</dd>
                </div>
                <div className="rounded-cartao border border-borda px-4 py-3">
                  <dt className="text-sm text-texto-suave">Passivo total na data</dt>
                  <dd className="text-xl font-bold tabular-nums">{reais(s.total)}</dd>
                </div>
                <div className="rounded-cartao border border-borda px-4 py-3">
                  <dt className="text-sm text-texto-suave">Pessoas</dt>
                  <dd className="text-sm">
                    {s.pessoasInteiras} {s.pessoasInteiras === 1 ? 'pessoa tem' : 'pessoas têm'} 100% da lotação neste {s.tipo === 'servico' ? 'serviço' : 'termo'}; {s.pessoasEmParte} só em parte.
                  </dd>
                </div>
              </dl>
              {s.pessoas && s.pessoas.length > 0 && (
                <TabelaDados
                  legenda="Pessoas atingidas pela simulação"
                  colunas={[
                    { chave: 'nome', rotulo: 'Pessoa' },
                    { chave: 'percentual', rotulo: 'Lotação aqui (%)', tipo: 'numero' },
                    { chave: 'valor', rotulo: 'Parcela', tipo: 'moeda', somar: true },
                  ]}
                  linhas={s.pessoas.map((x, i) => ({ id: String(i), valores: { nome: x.nome, percentual: x.percentual, valor: x.valor } }))}
                />
              )}
            </div>
          )}
        </div>
      </Secao>
    </div>
  );
}
