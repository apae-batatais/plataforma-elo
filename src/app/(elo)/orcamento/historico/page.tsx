import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { lerHistorico } from '@/modulos/orcamento/aplicacao/historico';
import type { IndicadoresAno } from '@/modulos/orcamento/dominio/historico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { Linhas, type Formato } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { TabelaDados, type ColunaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Histórico — indicadores' };

type Chave = Exclude<keyof IndicadoresAno, 'ano' | 'parcial'>;
const GRAFICOS: { chave: Chave; titulo: string; formato: Formato; explicacao: string }[] = [
  { chave: 'receita', titulo: 'Receitas', formato: 'moeda', explicacao: 'Receita realizada no ano.' },
  { chave: 'despesa', titulo: 'Despesas', formato: 'moeda', explicacao: 'Despesa total do ano.' },
  { chave: 'resultado', titulo: 'Resultado', formato: 'moeda', explicacao: 'Receitas menos despesas.' },
  { chave: 'margem', titulo: 'Margem', formato: 'pct', explicacao: 'Resultado dividido pela receita.' },
  { chave: 'folhaSobreReceita', titulo: 'Folha sobre a receita', formato: 'pct', explicacao: 'Quanto da receita foi para a folha.' },
  { chave: 'crescimentoReceita', titulo: 'Crescimento da receita', formato: 'pct', explicacao: 'Sobre o ano anterior. Só entre anos completos.' },
  { chave: 'crescimentoFolha', titulo: 'Crescimento da folha', formato: 'pct', explicacao: 'Sobre o ano anterior. Só entre anos completos.' },
  { chave: 'saldoLivreFim', titulo: 'Saldo livre no fim do ano', formato: 'moeda', explicacao: 'É o saldo livre de 1º de janeiro do ano seguinte.' },
  { chave: 'variacaoSaldoLivre', titulo: 'Variação do saldo livre', formato: 'moeda', explicacao: 'Saldo livre do fim do ano menos o do começo.' },
  { chave: 'coberturaSaldoLivre', titulo: 'Cobertura do saldo livre', formato: 'numero', explicacao: 'Quantos meses de despesa média o saldo livre do fim do ano cobre.' },
];

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function Bloco({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-cartao border border-borda bg-superficie p-4" aria-label={titulo}>
      <h2 className="font-bold">{titulo}</h2>
      <p className="mb-3 text-xs text-texto-suave">{descricao}</p>
      {children}
    </section>
  );
}

export default async function HistoricoIndicadores() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const h = await lerHistorico(app.planilhas, usuario.autorizador);
  const podeImportar = usuario.autorizador.temPermissao('orcamento.historico.editar');
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Histórico' }, { rotulo: 'Indicadores' }];

  if (h.indicadores.length === 0) {
    return (
      <div>
        <CabecalhoPagina trilha={trilha} titulo="Histórico — indicadores" />
        <EstadoVazio titulo="Nenhum ano fechado importado" acao={podeImportar ? <LinkBotao href="/orcamento/historico/importar">Importar ano fechado</LinkBotao> : undefined}>
          Os indicadores aparecem depois que o Financeiro importar os anos fechados (2017 em diante) das planilhas de Previsão.
        </EstadoVazio>
      </div>
    );
  }

  const ind = h.indicadores;
  const periodo = `${ind[0].ano} a ${ind.at(-1)!.ano}`;
  const colunas: ColunaDados[] = [
    { chave: 'ano', rotulo: 'Ano' },
    { chave: 'receita', rotulo: 'Receitas', tipo: 'moeda' },
    { chave: 'despesa', rotulo: 'Despesas', tipo: 'moeda' },
    { chave: 'resultado', rotulo: 'Resultado', tipo: 'moeda' },
    { chave: 'margem', rotulo: 'Margem (%)', tipo: 'numero' },
    { chave: 'folhaSobreReceita', rotulo: 'Folha / receita (%)', tipo: 'numero' },
    { chave: 'crescimentoReceita', rotulo: 'Cresc. receita (%)', tipo: 'numero' },
    { chave: 'crescimentoFolha', rotulo: 'Cresc. folha (%)', tipo: 'numero' },
    { chave: 'saldoLivreFim', rotulo: 'Saldo livre no fim', tipo: 'moeda' },
    { chave: 'variacaoSaldoLivre', rotulo: 'Variação do saldo', tipo: 'moeda' },
    { chave: 'coberturaSaldoLivre', rotulo: 'Cobertura (meses)', tipo: 'numero' },
  ];
  const linhas: LinhaDados[] = [...ind].reverse().map((i) => ({
    id: String(i.ano),
    valores: { ano: i.parcial ? `${i.ano} (parcial)` : String(i.ano), ...Object.fromEntries(colunas.slice(1).map((c) => [c.chave, i[c.chave as Chave] as number | null])) },
  }));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo="Histórico — indicadores"
        descricao={`Como as finanças evoluíram, ano a ano (${periodo}). Cada número é calculado pelo Elo a partir das planilhas importadas.`}
        acoes={podeImportar && <LinkBotao href="/orcamento/historico/importar">Importar ano fechado</LinkBotao>}
      />
      {ind.some((i) => i.parcial) && (
        <p className="text-sm text-texto-suave">
          <Etiqueta tipo="atencao">Parcial</Etiqueta> O ano em andamento fica fora do crescimento, que só compara anos completos.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {GRAFICOS.map((g) => {
          const pontos = ind.filter((i) => i[g.chave] !== null);
          return (
            <Bloco key={g.chave} titulo={g.titulo} descricao={`${g.explicacao} ${pontos.length ? `(${pontos[0].ano} a ${pontos.at(-1)!.ano})` : ''}`}>
              {pontos.length === 0 ? (
                <p className="text-sm text-texto-suave">Sem dados ainda.</p>
              ) : (
                <Linhas
                  categorias={pontos.map((i) => (i.parcial ? `${i.ano}*` : String(i.ano)))}
                  series={[{ nome: g.titulo, valores: pontos.map((i) => i[g.chave] as number), cor: 1 }]}
                  formato={g.formato}
                  altura={200}
                  rotuloCategoria="Ano"
                  descricao={`${g.titulo} por ano, de ${pontos[0].ano} a ${pontos.at(-1)!.ano}.`}
                />
              )}
            </Bloco>
          );
        })}
      </div>
      <Bloco titulo="Tabela comparativa" descricao="Os mesmos números, ano a ano. Campo vazio = sem dado para calcular.">
        <TabelaDados colunas={colunas} linhas={linhas} legenda={`Indicadores históricos de ${periodo}`} grande />
      </Bloco>
      <p className="text-xs text-texto-suave">
        Receita total de {ind.at(-1)!.ano}: {reais(ind.at(-1)!.receita)}. Margem do mesmo ano: {ind.at(-1)!.margem === null ? '—' : pct(ind.at(-1)!.margem!)}.
      </p>
    </div>
  );
}
