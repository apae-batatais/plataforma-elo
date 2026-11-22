import type { Metadata } from 'next';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { redirect } from 'next/navigation';
import { lerGradeDoMes } from '@/modulos/orcamento/aplicacao/realizado';
import { mesInformavel } from '@/modulos/orcamento/dominio/realizado';
import { mesAnterior, mesAtualBrasilia } from '@/modulos/orcamento/dominio/tesouraria';
import { rotuloMes } from '@/modulos/orcamento/telas/formato';
import { InformarRealizado } from '@/modulos/orcamento/telas/informar-realizado';
import { SeletorMes } from '@/modulos/orcamento/telas/seletor-mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarRealizado } from '../acoes';

export const metadata: Metadata = { title: 'Informar realizado' };

export default async function InformarRealizadoPagina({ searchParams }: { searchParams: Promise<{ mes?: string; salvo?: string }> }) {
  const { mes: pedido, salvo } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const atual = mesAtualBrasilia();
  // Padrão: o mês anterior (o extrato do mês fecha no último dia). Lista: o mês atual e os 23 anteriores.
  const opcoes = [atual];
  while (opcoes.length < 24) opcoes.push(mesAnterior(opcoes[opcoes.length - 1]));
  const disponivel = !!pedido && mesInformavel(pedido, atual);
  const mes = disponivel ? pedido : mesAnterior(atual);
  const app = await obterAplicacao();
  // Quem não vê o realizado (ex.: Leitura) volta ao Orçamento em vez de ver "Algo deu errado".
  const g = await lerGradeDoMes(app.planilhas, usuario.autorizador, mes).catch((erro) => {
    if (erro instanceof ErroPermissao) redirect('/orcamento');
    throw erro;
  });
  const jaTinha = [...g.despesas, ...g.receitas].some((l) => l.versao !== null);

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Execução' }, { rotulo: 'Informar realizado' }]}
        titulo={`Realizado de ${rotuloMes(mes)}`}
        descricao="O que foi gasto e recebido no mês, por serviço, grupo de gasto e fonte. A grade vem montada pela Previsão aprovada, com o previsto ao lado."
        acoes={<SeletorMes mes={mes} opcoes={opcoes.map((m) => ({ valor: m, rotulo: rotuloMes(m) }))} />}
      />
      {pedido && !disponivel && (
        <div className="mb-6">
          <Aviso tipo="info">Esse mês não está disponível; mostramos {rotuloMes(mes)}.</Aviso>
        </div>
      )}
      {g.podeEditar && jaTinha && (
        <div className="mb-6">
          <Aviso tipo="info">{rotuloMes(mes)} já tem valores informados. Ao salvar, os valores alterados são atualizados (nada é duplicado).</Aviso>
        </div>
      )}
      <InformarRealizado
        key={`${mes}-${Date.now()}`}
        ano={g.ano}
        mes={mes}
        rotuloMes={rotuloMes(mes)}
        linhas={[...g.despesas, ...g.receitas]}
        opcoes={g.opcoes}
        previsaoAprovada={g.previsaoAprovada}
        podeEditar={g.podeEditar}
        salvouAgora={salvo === '1'}
        salvar={acaoSalvarRealizado}
      />
    </div>
  );
}
