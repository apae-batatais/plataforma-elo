import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { listarRequisicoes, type LinhaRequisicao } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { momentoBR } from '@/modulos/requisicoes/dominio/veiculo';
import { dataHora, EtiquetaSituacao } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Pedidos de veículo' };

function Tabela({ linhas, legenda, vazio }: { linhas: LinhaRequisicao[]; legenda: string; vazio: string }) {
  // Ordenados pela saída: o que sai primeiro aparece primeiro.
  const ordenadas = [...linhas].sort((a, b) => (a.veiculo?.saida ?? '').localeCompare(b.veiculo?.saida ?? ''));
  return (
    <TabelaDados
      legenda={legenda}
      vazio={vazio}
      colunas={[
        { chave: 'numero', rotulo: 'Número' },
        { chave: 'veiculo', rotulo: 'Veículo' },
        { chave: 'quando', rotulo: 'Saída e volta' },
        { chave: 'requisitante', rotulo: 'Quem pediu' },
        { chave: 'enviada', rotulo: 'Enviada em', secundaria: true },
        { chave: 'situacao', rotulo: 'Situação' },
      ]}
      linhas={ordenadas.map((r) => ({
        id: r.id,
        valores: {
          numero: r.numero,
          veiculo: r.veiculo?.nome ?? '',
          quando: r.veiculo?.saida ?? '',
          requisitante: r.requisitante,
          enviada: r.enviadaEm.slice(0, 16),
          situacao: r.situacaoNome,
        },
        celulas: {
          numero: (
            <Link href={`/requisicoes/${r.id}`} className="font-semibold text-destaque hover:underline">
              {r.numero}
            </Link>
          ),
          veiculo: (
            <span className="flex flex-wrap items-center gap-2">
              {r.veiculo?.nome ?? '—'}
              {r.veiculo?.conflito && <Etiqueta tipo="atencao">Conflito</Etiqueta>}
              {r.veiculo?.manutencao && <Etiqueta tipo="atencao">Manutenção</Etiqueta>}
            </span>
          ),
          quando: r.veiculo ? (
            <span className="tabular-nums">
              {momentoBR(r.veiculo.saida)} a {momentoBR(r.veiculo.volta)}
            </span>
          ) : (
            '—'
          ),
          enviada: <span className="tabular-nums">{dataHora(r.enviadaEm)}</span>,
          situacao: <EtiquetaSituacao situacao={r.situacao} nome={r.situacaoNome} />,
        },
      }))}
    />
  );
}

export default async function PedidosDeVeiculo() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let decidir;
  try {
    decidir = await listarRequisicoes(app.planilhas, usuario.autorizador, 'veiculos');
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect('/requisicoes');
    throw erro;
  }
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Pedidos de veículo' }]}
        titulo="Pedidos de veículo"
        descricao="Abra a ficha para ver os pedidos no mesmo horário e aprovar, devolver ou recusar. Para ver a ocupação dos próximos dias, use a Agenda dos veículos."
      />
      <Secao titulo={`Para aprovar (${decidir.length})`} id="t-aprovar">
        <Tabela linhas={decidir} legenda="Pedidos de veículo para aprovar" vazio="Nenhum pedido de veículo espera a sua decisão." />
      </Secao>
    </div>
  );
}
