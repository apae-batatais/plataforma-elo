import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { painelSustentabilidade } from '@/modulos/orcamento/aplicacao/sustentabilidade';
import { NOME_ORIGEM, ORIGENS, type Origem } from '@/modulos/orcamento/dominio/sustentabilidade';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoDeParcerias } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Barras100, BarrasAgrupadas, BarrasHorizontais, formatarValor, Indicadores } from '@/ui/graficos';
import { IconeEditar } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoAlterarOrigem } from '../previsao/acoes';

export const metadata: Metadata = { title: 'Sustentabilidade financeira' };

const pct = (v: number | null) => (v === null ? '—' : formatarValor(v * 100, 'pct'));
const pctDireto = (v: number | null) => (v === null ? '—' : formatarValor(v, 'pct'));
const moeda = (v: number | null) => (v === null ? '—' : reais(v));

export default async function Sustentabilidade({ searchParams }: { searchParams: Promise<{ ano?: string; origem?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const painel = await painelSustentabilidade(planilhas, usuario.autorizador, catalogoDeParcerias(planilhas), { ano: Number(sp.ano) || undefined });
  const href = (ano: number) => `/orcamento/sustentabilidade?ano=${ano}`;
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Sustentabilidade financeira' }];
  const cab = (
    <CabecalhoPagina
      trilha={trilha}
      titulo={`Sustentabilidade financeira ${painel.ano}`}
      descricao="Quanto o repasse de cada termo cobre do custo do serviço, quanto sai de recurso próprio e se esse aporte pesa demais na receita livre da instituição."
      acoes={<SeletorAno anos={painel.anos} atual={painel.ano} href={href} />}
    />
  );
  if (!painel.situacao || !painel.peso) {
    return (
      <div className="space-y-6">
        {cab}
        <EstadoVazio titulo="Nenhum exercício neste ano" acao={<LinkBotao href="/orcamento/previsao">Abrir a Previsão</LinkBotao>}>
          Abra o exercício na Previsão e lance despesas e receitas para ver a cobertura dos serviços.
        </EstadoVazio>
      </div>
    );
  }

  const peso = painel.peso;
  const contratados = painel.servicos.filter((s) => s.origem.origem === 'contratado');
  const proprios = painel.servicos.filter((s) => s.origem.origem !== 'contratado');
  const limitesDefinidos = peso.limite !== null;
  const acima = painel.servicos.filter((s) => s.acimaDoLimiteServico);
  const emEdicao = painel.podeEditar && sp.origem ? painel.servicos.find((s) => s.codigo === sp.origem) : undefined;
  const comAporte = [...contratados].sort((a, b) => (b.parteProria ?? 0) - (a.parteProria ?? 0));
  const maisDependente = comAporte[0];
  const melhor = [...contratados].filter((s) => s.coberturaTermo !== null).sort((a, b) => (b.coberturaTermo ?? 0) - (a.coberturaTermo ?? 0))[0];
  const tituloCobertura =
    melhor && maisDependente && melhor.codigo !== maisDependente.codigo
      ? `O termo paga ${pct(melhor.coberturaTermo)} do serviço ${melhor.nome}; o serviço ${maisDependente.nome} depende mais de recurso próprio`
      : maisDependente
        ? `O recurso próprio cobre ${pct(maisDependente.parteProria)} do custo do serviço ${maisDependente.nome}`
        : 'Cobertura dos serviços contratados';

  const colunas = [
    { chave: 'nome', rotulo: 'Serviço' },
    { chave: 'origem', rotulo: 'Origem' },
    { chave: 'custo', rotulo: 'Custo total', tipo: 'moeda' as const, somar: true },
    { chave: 'repasse', rotulo: 'Repasse do termo', tipo: 'moeda' as const, somar: true },
    { chave: 'deficit', rotulo: 'Déficit', tipo: 'moeda' as const },
    { chave: 'cobertura', rotulo: 'Termo cobre', tipo: 'numero' as const },
    { chave: 'aporte', rotulo: 'Aporte próprio', tipo: 'moeda' as const, somar: true },
    { chave: 'peso', rotulo: '% da receita livre', tipo: 'numero' as const },
    { chave: 'vaga', rotulo: 'Custo por vaga/mês', tipo: 'moeda' as const, secundaria: true },
    { chave: 'repVaga', rotulo: 'Repasse por vaga/mês', tipo: 'moeda' as const, secundaria: true },
    { chave: 'atendido', rotulo: 'Custo por atendido/mês', tipo: 'moeda' as const, secundaria: true },
    { chave: 'avisos', rotulo: 'Avisos', secundaria: true },
    ...(painel.podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-12' }] : []),
  ];
  const linha = (s: (typeof painel.servicos)[number]) => ({
    id: s.codigo,
    valores: {
      nome: s.nome, origem: NOME_ORIGEM[s.origem.origem], custo: s.custoTotal, repasse: s.repasse, deficit: s.deficit,
      cobertura: s.coberturaTermo === null ? null : Math.round(s.coberturaTermo * 1000) / 10, aporte: s.aporte,
      peso: s.pesoNaReceitaLivre === null ? null : Math.round(s.pesoNaReceitaLivre * 10) / 10,
      vaga: s.custoPorVagaMes, repVaga: s.repassePorVagaMes, atendido: s.custoPorAtendidoMes, avisos: s.avisos.length,
    },
    celulas: {
      nome: <span className="font-semibold">{s.nome}</span>,
      origem: (
        <span>
          {NOME_ORIGEM[s.origem.origem]}
          <span className="block text-xs text-texto-suave">
            {s.origem.fonte === 'definida' ? 'definida por você' : s.origem.fonte === 'sugerida' ? `sugerida pelo termo ${s.origem.termo}` : 'sem termo'}
          </span>
        </span>
      ),
      deficit: s.repasseAcima > 0 ? <span>Repasse acima do custo em {reais(s.repasseAcima)}</span> : moeda(s.deficit),
      cobertura: <span>{pct(s.coberturaTermo)}</span>,
      peso: (
        <span>
          {pctDireto(s.pesoNaReceitaLivre)}
          {s.limiteServico !== null && <span className="block text-xs text-texto-suave">limite do serviço: {pctDireto(s.limiteServico)}</span>}
          {s.acimaDoLimiteServico && <Etiqueta tipo="erro">Acima do limite</Etiqueta>}
        </span>
      ),
      vaga: s.vagas === null ? <span className="text-texto-suave">sem vagas informadas</span> : moeda(s.custoPorVagaMes),
      atendido: s.custoPorAtendidoMes === null ? <span className="text-texto-suave">sem contagem automática</span> : moeda(s.custoPorAtendidoMes),
      avisos: s.avisos.length ? <span className="text-xs">{s.avisos.join(' ')}</span> : '',
      acoes: (
        <LinkBotao href={`/orcamento/sustentabilidade?ano=${painel.ano}&origem=${s.codigo}`} scroll={false} variante="icone" aria-label={`Alterar origem de ${s.nome}`} title="Alterar origem">
          <IconeEditar tamanho={16} />
        </LinkBotao>
      ),
    },
  });

  return (
    <div className="space-y-6">
      {cab}
      {painel.situacao === 'elaboracao' && <Aviso tipo="info">Previsão ainda em elaboração; os números podem mudar.</Aviso>}
      {painel.parceriasDesligado && <Aviso tipo="info">Ative o app Parcerias para ver a cobertura: sem ele o painel mostra só o custo, sem repasse.</Aviso>}
      {peso.acimaDoLimite && (
        <Aviso tipo="atencao">O aporte de recursos próprios passa de {pctDireto(peso.limite)} da receita livre ({pctDireto(peso.peso)}).</Aviso>
      )}
      {acima.length > 0 && <Aviso tipo="atencao">{acima.length === 1 ? '1 serviço está acima do limite dele' : `${acima.length} serviços estão acima do limite deles`}: {acima.map((s) => s.nome).join(', ')}.</Aviso>}

      <Secao titulo="Peso do aporte na instituição" id="peso">
        <div className="space-y-4 p-5">
          {peso.peso === null ? (
            <p>{peso.semReceitaLivre ? `Não há receita livre prevista para cobrir o aporte de ${reais(peso.aporteContratado)}.` : 'Nenhum aporte próprio em serviços contratados neste ano.'}</p>
          ) : (
            <Indicadores
              itens={[
                {
                  nome: 'Peso do aporte na receita livre',
                  valor: peso.peso,
                  explicacao: `Dos ${reais(peso.receitaLivre)} de receita livre do ano, ${reais(peso.aporteContratado)} (${pctDireto(peso.peso)}${peso.peso > 100 ? ', acima de 100%' : ''}) vão cobrir déficit de serviços contratados.`,
                  referencia: limitesDefinido(peso.limite),
                  anteriores: painel.evolucao.map((e) => ({ rotulo: String(e.ano), valor: e.peso })),
                },
              ]}
            />
          )}
          {peso.acimaDoLimite && <p className="text-sm font-semibold">Acima do limite de {pctDireto(peso.limite)}: leve este painel para a negociação dos repasses.</p>}
          {!limitesDefinidos && (
            <p className="flex flex-wrap items-center gap-3 text-sm">
              Defina o limite de alerta em Cadastros › Limites do painel.
              {painel.podeEditar && <LinkBotao href="/orcamento/previsao/limites" variante="secundario">Definir limite</LinkBotao>}
            </p>
          )}
          {painel.semOrigem > 0 && (
            <p className="text-sm text-texto-suave">
              {painel.semOrigem} {painel.semOrigem === 1 ? 'serviço sem termo e sem origem definida conta' : 'serviços sem termo e sem origem definida contam'} como iniciativa própria.
            </p>
          )}
          <LinkBotao href="#cobertura" variante="secundario">Ver a cobertura por serviço</LinkBotao>
        </div>
      </Secao>

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={`/orcamento/sustentabilidade?ano=${painel.ano}`} titulo={emEdicao.nome} descricao="Como este serviço entra no painel">
          <form action={acaoAlterarOrigem} className="space-y-3">
            <input type="hidden" name="servico" value={emEdicao.codigo} />
            <input type="hidden" name="volta" value={`/orcamento/sustentabilidade?ano=${painel.ano}`} />
            <fieldset className="text-sm">
              <legend className="font-semibold">Origem do serviço</legend>
              {ORIGENS.map((o: Origem) => (
                <label key={o} className="mt-1.5 flex min-h-11 items-center gap-2">
                  <input type="radio" name="origem" value={o} defaultChecked={emEdicao.origem.fonte === 'definida' && emEdicao.origem.origem === o} /> {NOME_ORIGEM[o]}
                </label>
              ))}
              <label className="mt-1.5 flex min-h-11 items-center gap-2">
                <input type="radio" name="origem" value="" defaultChecked={emEdicao.origem.fonte !== 'definida'} /> Usar a sugestão do termo
              </label>
            </fieldset>
            <BotaoEnviar enviando="Salvando…" className="w-full">Salvar</BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <Secao titulo="Cobertura dos serviços" id="cobertura" descricao="Aporte próprio = custo do serviço − repasse do termo, quando positivo. O custo é o mesmo da Análise por área.">
        <div className="space-y-8 p-5">
          {contratados.length === 0 ? (
            <EstadoVazio titulo="Nenhum serviço contratado ainda">Em Orçamento › Painéis, na coluna Origem, marque a origem do serviço, ou cadastre um termo em Parcerias.</EstadoVazio>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-lg font-semibold">{tituloCobertura}</h3>
                <Barras100
                  categorias={contratados.map((s) => s.nome)}
                  series={[
                    { nome: 'Repasse do termo', valores: contratados.map((s) => Math.min(s.repasse, s.custoTotal)), cor: 1 },
                    { nome: 'Recurso próprio', valores: contratados.map((s) => s.aporte), cor: 2 },
                  ]}
                  rotuloCategoria="Serviço"
                  descricao="Para cada serviço contratado, a parte do custo coberta pelo repasse do termo e a parte coberta por recurso próprio."
                />
                {maisDependente && maisDependente.aporte > 0 && <p className="mt-2 text-sm">Peça a revisão do repasse do serviço {maisDependente.nome}: {pct(maisDependente.parteProria)} do custo sai de recurso próprio.</p>}
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Aporte próprio por serviço</h3>
                <BarrasHorizontais
                  categorias={contratados.map((s) => s.nome)}
                  series={[{ nome: 'Aporte próprio', valores: contratados.map((s) => s.aporte), cor: 1 }]}
                  formato="moeda"
                  rotuloCategoria="Serviço"
                  descricao="Valor em reais que a instituição completa com recurso próprio em cada serviço contratado, do maior para o menor."
                  notas={contratados.map((s) => (s.acimaDoLimiteServico ? `acima do limite do serviço: ${pctDireto(s.limiteServico)}` : null))}
                />
              </div>
              {contratados.some((s) => s.custoPorVagaMes !== null) && (
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Custo e repasse por vaga, por mês</h3>
                  <BarrasAgrupadas
                    categorias={contratados.filter((s) => s.custoPorVagaMes !== null).map((s) => s.nome)}
                    series={[
                      { nome: 'Custo', valores: contratados.filter((s) => s.custoPorVagaMes !== null).map((s) => s.custoPorVagaMes ?? 0), cor: 1 },
                      { nome: 'Repasse', valores: contratados.filter((s) => s.custoPorVagaMes !== null).map((s) => s.repassePorVagaMes ?? 0), cor: 2 },
                    ]}
                    formato="moeda"
                    rotuloCategoria="Serviço"
                    descricao="Custo e repasse por vaga custeada, por mês, em cada serviço contratado."
                  />
                </div>
              )}
              <TabelaDados legenda="Serviços contratados: cobertura e aporte" totalRotulo="Total" colunas={colunas} linhas={contratados.map(linha)} />
            </>
          )}
          {proprios.length > 0 && (
            <div>
              <h3 className="mb-2 text-lg font-semibold">Serviços de iniciativa própria</h3>
              <p className="mb-2 text-sm text-texto-suave">Aparecem com o aporte deles, mas não entram no peso do aporte da instituição.</p>
              <TabelaDados legenda="Serviços de iniciativa própria" totalRotulo="Total" colunas={colunas} linhas={proprios.map(linha)} />
            </div>
          )}
        </div>
      </Secao>
    </div>
  );
}

function limitesDefinido(limite: number | null) {
  return limite === null ? undefined : { valor: limite, sentido: 'ate' as const };
}

