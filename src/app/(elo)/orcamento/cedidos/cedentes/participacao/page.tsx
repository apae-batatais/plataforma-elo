import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { participacaoDeQuemCede } from '@/modulos/orcamento/aplicacao/participacao';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BarrasHorizontais } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';
import { lerPrevisao } from '@/modulos/orcamento/aplicacao/previsao';

export const metadata: Metadata = { title: 'Participação de quem cede' };
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default async function ParticipacaoDeQuemCede({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.folha.ver')) redirect('/orcamento');
  const app = await obterAplicacao();
  const anos = (await lerPrevisao(app.planilhas, usuario.autorizador, undefined, { incluirCedidos: false })).anos;
  const ano = Number(sp.ano) || anos.at(-1) || new Date().getFullYear();
  const r = await participacaoDeQuemCede(app.planilhas, usuario.autorizador, ano);
  const publico = r.porTipo.find((t) => t.tipo === 'poder_publico')!;
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Participação de quem cede' }];

  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo={`Participação de quem cede ${ano}`}
        descricao="Quanto cada parceiro aporta em pessoas cedidas, em reais e em % do custo de todos os serviços."
        acoes={<SeletorAno anos={anos} atual={ano} href={(a) => `/orcamento/cedidos/cedentes/participacao?ano=${a}`} />}
      />
      {r.total === 0 ? (
        <EstadoVazio titulo={`Nenhum profissional cedido em ${ano}.`}>Quando houver cedidos com valor e lotação, a participação de cada parceiro aparece aqui.</EstadoVazio>
      ) : (
        <>
          <h3 className="text-base font-bold">
            {publico.valor > 0 ? `O poder público cobre ${pct(publico.percentual)} do custo dos serviços em pessoas` : `Quem cede aporta ${pct(r.porTipo.reduce((s, t) => s + t.percentual, 0))} do custo dos serviços em pessoas`}
            {r.previstoAteDezembro ? ' (previsto até dezembro)' : ''}
          </h3>
          {r.cessoesPerto > 0 && (
            <Aviso tipo="atencao">
              {r.cessoesPerto} {r.cessoesPerto === 1 ? 'cessão termina' : 'cessões terminam'} em breve: <Link href="/orcamento/cedidos" className="font-semibold underline">veja a lista</Link>.
            </Aviso>
          )}
          <BarrasHorizontais
            categorias={r.porTipo.map((t) => t.rotulo)}
            series={[{ nome: 'Pessoas cedidas no ano', valores: r.porTipo.map((t) => t.valor), cor: 1 }]}
            formato="moeda"
            rotuloCategoria="Tipo de quem cede"
            descricao={`Valor anual de pessoas cedidas por tipo de quem cede em ${ano}`}
          />
          <p className="text-sm text-texto-suave">
            Total de {reais(r.total)} em pessoas cedidas, de {reais(r.custoTotal)} de custo dos serviços (com cedidos). Despesa e receita de mesmo valor, sem passar pelo caixa.
          </p>
          <Secao titulo="Por quem cede" descricao="Cedente sem cedido ativo no ano aparece zerado. O dinheiro de termos de Parcerias ainda não é mostrado aqui.">
            <TabelaDados
              legenda={`Participação por quem cede em ${ano}`}
              totalRotulo="Total"
              colunas={[
                { chave: 'nome', rotulo: 'Quem cede' },
                { chave: 'tipo', rotulo: 'Tipo' },
                { chave: 'pessoas', rotulo: 'Pessoas (no ano)', tipo: 'moeda', somar: true },
                { chave: 'pct', rotulo: '% do custo', tipo: 'numero' },
              ]}
              linhas={r.porCedente.map((c) => ({
                id: c.id,
                valores: { nome: c.nome, tipo: c.tipoRotulo, pessoas: c.pessoas, pct: c.percentual },
                celulas: { nome: <span className="font-semibold">{c.nome}</span>, pct: pct(c.percentual) },
              }))}
            />
          </Secao>
        </>
      )}
    </div>
  );
}
