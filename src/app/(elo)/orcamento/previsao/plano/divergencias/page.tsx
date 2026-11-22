import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerPlano } from '@/modulos/orcamento/aplicacao/plano-contas';
import { lerDivergencias } from '@/modulos/orcamento/aplicacao/plano-comparacao';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Divergências de área' };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function DivergenciasDeArea({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const q = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const ano = Number(q.ano) || new Date().getFullYear();
  const [d, plano] = await Promise.all([lerDivergencias(app.planilhas, usuario.autorizador, ano), lerPlano(app.planilhas, usuario.autorizador, ano)]);

  const pares: LinhaDados[] = d.pares.map((x) => ({
    id: `${x.areaPlanoId}|${x.areaServicoCodigo}`,
    valores: { plano: x.areaPlanoNome, servico: x.areaServicoNome, valor: x.centavos / 100, qtd: x.quantidade },
  }));
  const lancamentos: LinhaDados[] = d.pares.flatMap((x) =>
    x.lancamentos.map((l) => ({
      id: `${l.origem}|${l.id}`,
      valores: { origem: l.origem === 'despesa' ? 'Previsão' : 'Realizado', servico: l.servicoNome, plano: x.areaPlanoNome, area: x.areaServicoNome, valor: l.centavos / 100 },
    })),
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Plano de contas', href: '/orcamento/previsao/plano' }, { rotulo: 'Divergências de área' }]}
        titulo="Divergências de área"
        descricao="Despesas lançadas em uma área do plano diferente da área do serviço. Só leitura: nada muda nos totais do orçamento."
        acoes={<SeletorAno anos={plano.anos} atual={ano} href={(a) => `/orcamento/previsao/plano/divergencias?ano=${a}`} />}
      />
      {d.escopoParcial && <Aviso tipo="info">Você vê só os serviços que coordena.</Aviso>}
      {!d.comLinhas && <Aviso tipo="info">O seu perfil vê só os totais, sem a lista de lançamentos.</Aviso>}

      {d.pares.length === 0 ? (
        <EstadoVazio titulo={`Nenhuma divergência em ${ano}.`}>
          {d.semAreaDoPlano > 0 ? `Mas ${plural(d.semAreaDoPlano, 'lançamento ainda não tem', 'lançamentos ainda não têm')} área do plano.` : 'Todos os lançamentos com área do plano estão na área do serviço.'}
        </EstadoVazio>
      ) : (
        <>
          <p className="text-[1.05rem]">
            <strong>{reais(d.totalCentavos / 100)} foram lançados em área diferente da do serviço</strong> em {ano}, em {plural(d.pares.reduce((s, x) => s + x.quantidade, 0), 'lançamento', 'lançamentos')}.
          </p>
          {d.semAreaDoPlano > 0 && <Aviso tipo="info">{plural(d.semAreaDoPlano, 'lançamento ainda não tem', 'lançamentos ainda não têm')} área do plano. Eles não entram na conta.</Aviso>}
          <Secao titulo="Área do plano × área do serviço">
            <TabelaDados
              legenda="Divergências por par de áreas"
              colunas={[
                { chave: 'plano', rotulo: 'Área do plano' },
                { chave: 'servico', rotulo: 'Área do serviço' },
                { chave: 'qtd', rotulo: 'Lançamentos', tipo: 'numero', somar: true },
                { chave: 'valor', rotulo: 'Total', tipo: 'moeda', somar: true },
              ]}
              linhas={pares}
            />
          </Secao>
          {d.comLinhas && (
            <Secao titulo="Lançamentos">
              <TabelaDados
                legenda="Lançamentos com área divergente"
                colunas={[
                  { chave: 'origem', rotulo: 'Origem' },
                  { chave: 'servico', rotulo: 'Serviço' },
                  { chave: 'plano', rotulo: 'Área do plano' },
                  { chave: 'area', rotulo: 'Área do serviço' },
                  { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', somar: true },
                ]}
                linhas={lancamentos}
                grande
              />
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
