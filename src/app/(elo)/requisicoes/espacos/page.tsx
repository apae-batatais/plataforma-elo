import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarRequisicoes } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { dataBR } from '@/modulos/requisicoes/dominio/espaco';
import { dataHora, EtiquetaSituacao } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import Link from 'next/link';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import type { LinhaRequisicao } from '@/modulos/requisicoes/aplicacao/requisicoes';

export const metadata: Metadata = { title: 'Reservas de espaço' };

function Tabela({ linhas, legenda, vazio }: { linhas: LinhaRequisicao[]; legenda: string; vazio: string }) {
  return (
    <TabelaDados
      legenda={legenda}
      vazio={vazio}
      colunas={[
        { chave: 'numero', rotulo: 'Número' },
        { chave: 'espaco', rotulo: 'Espaço' },
        { chave: 'quando', rotulo: 'Quando' },
        { chave: 'requisitante', rotulo: 'Quem pediu' },
        { chave: 'enviada', rotulo: 'Enviada em', secundaria: true },
        { chave: 'situacao', rotulo: 'Situação' },
      ]}
      linhas={linhas.map((r) => ({
        id: r.id,
        valores: {
          numero: r.numero,
          espaco: r.reserva?.espaco ?? '',
          quando: `${r.reserva?.data ?? ''} ${r.reserva?.inicio ?? ''}`,
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
          quando: r.reserva ? (
            <span className="tabular-nums">
              {dataBR(r.reserva.data)}, {r.reserva.inicio} às {r.reserva.fim}
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

export default async function ReservasDeEspaco() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let decidir, fechar;
  try {
    [decidir, fechar] = await Promise.all([
      listarRequisicoes(app.planilhas, usuario.autorizador, 'espacos'),
      listarRequisicoes(app.planilhas, usuario.autorizador, 'fechar'),
    ]);
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect('/requisicoes');
    throw erro;
  }
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Reservas de espaço' }]}
        titulo="Reservas de espaço"
        descricao="Abra a ficha para ver o conflito de horário e aprovar, devolver ou recusar. Depois do uso, registre como foi."
      />
      <Secao titulo={`Para aprovar (${decidir.length})`} id="t-aprovar">
        <Tabela linhas={decidir} legenda="Reservas para aprovar" vazio="Nenhuma reserva espera a sua decisão." />
      </Secao>
      <Secao titulo={`Para fechar (${fechar.length})`} id="t-fechar">
        <p className="mb-3 text-sm text-texto-suave">Reservas aprovadas cuja hora de fim já passou: registre se o espaço foi usado sem ou com problema.</p>
        <Tabela linhas={fechar} legenda="Reservas para registrar o uso" vazio="Nenhuma reserva para registrar o uso." />
      </Secao>
    </div>
  );
}
