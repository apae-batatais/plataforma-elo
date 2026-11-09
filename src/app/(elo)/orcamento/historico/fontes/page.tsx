import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerHistorico } from '@/modulos/orcamento/aplicacao/historico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { BarrasAgrupadas } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';
import { TabelaDados, type ColunaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Histórico — fontes de receita' };

export default async function HistoricoFontes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const h = await lerHistorico(app.planilhas, usuario.autorizador);
  const f = h.fontes;
  const podeImportar = usuario.autorizador.temPermissao('orcamento.historico.editar');
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Histórico' }, { rotulo: 'Fontes de receita' }];
  if (f.anos.length === 0) {
    return (
      <div>
        <CabecalhoPagina trilha={trilha} titulo="Histórico — fontes de receita" />
        <EstadoVazio titulo="Nenhum ano fechado importado" acao={podeImportar ? <LinkBotao href="/orcamento/historico/importar">Importar ano fechado</LinkBotao> : undefined}>
          As fontes aparecem depois que o Financeiro importar os anos fechados.
        </EstadoVazio>
      </div>
    );
  }
  const rotuloAno = (a: number) => (a >= h.anoAtual ? `${a} (parcial)` : String(a));
  const colunas: ColunaDados[] = [
    { chave: 'fonte', rotulo: 'Fonte' },
    { chave: 'natureza', rotulo: 'Natureza' },
    ...f.anos.map((a): ColunaDados => ({ chave: `a${a}`, rotulo: rotuloAno(a), tipo: 'moeda' })),
    { chave: 'peso', rotulo: f.ultimoCompleto ? `Peso em ${f.ultimoCompleto} (%)` : 'Peso (%)', tipo: 'numero' },
    { chave: 'variacao', rotulo: 'Variação (%)', tipo: 'numero' },
  ];
  const linhas: LinhaDados[] = f.linhas.map((l) => ({
    id: l.fonteId,
    valores: {
      fonte: l.nome,
      natureza: l.natureza === 'publica' ? 'Pública' : 'Própria',
      ...Object.fromEntries(f.anos.map((a) => [`a${a}`, l.porAno[a] ?? 0])),
      peso: l.peso,
      variacao: l.variacao,
    },
  }));
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo="Histórico — fontes de receita"
        descricao={`Receita pública e própria por ano, e quanto cada fonte pesa no último ano completo${f.ultimoCompleto ? ` (${f.ultimoCompleto})` : ''}. A variação compara esse ano com o anterior.`}
      />
      <section className="rounded-cartao border border-borda bg-superficie p-5" aria-label="Receita pública e própria por ano">
        <h2 className="mb-4 font-bold">Pública × própria, por ano</h2>
        <BarrasAgrupadas
          categorias={f.publicaPropria.map((x) => rotuloAno(x.ano))}
          series={[
            { nome: 'Pública', valores: f.publicaPropria.map((x) => x.publica), cor: 1 },
            { nome: 'Própria', valores: f.publicaPropria.map((x) => x.propria), cor: 2 },
          ]}
          formato="moeda"
          descricao="Receita de fontes públicas e próprias em cada ano importado."
        />
      </section>
      <section className="rounded-cartao border border-borda bg-superficie p-5" aria-label="Receita por fonte">
        <h2 className="mb-4 font-bold">Por fonte</h2>
        <TabelaDados colunas={colunas} linhas={linhas} legenda="Receita realizada por fonte, ano a ano" grande />
      </section>
    </div>
  );
}
