import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { fichaDoServico } from '@/plataforma/ligacoes';
import { MODULOS } from '@/plataforma/registro-modulos';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { formatarValor } from '@/ui/formato';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina } from '@/ui/pagina';
import { Avaliacao, Custo, Projetos, Publicacoes, Requisicoes, Resumo, VagasEAtendidos, type LinksDosApps } from '../blocos';

export const metadata: Metadata = { title: 'Ficha do serviço' };

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

export default async function FichaDoServico({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const { planilhas } = await obterAplicacao();
  const ficha = await fichaDoServico(planilhas, usuario.autorizador, codigo);
  if (!ficha) notFound();

  const links: LinksDosApps = Object.fromEntries(
    menuDoUsuario(MODULOS, usuario.autorizador.permissoes()).map((a) => [a.id, a.rota]),
  );
  const { servico, custo, vagas } = ficha;
  const c = custo.estado === 'ok' ? custo.dados : null;
  const reais = (v: number) => formatarValor(v, 'moeda');
  const pctVagas = vagas.vagas ? `${Math.round((vagas.ocupadas / vagas.vagas) * 100)}%` : '—';
  const numeros = [
    { rotulo: c ? `Previsto em ${c.ano}` : 'Previsto no ano', texto: c ? reais(c.previsto) : '—' },
    { rotulo: 'Realizado', texto: c ? reais(c.realizado) : '—' },
    { rotulo: 'Saldo', texto: c ? reais(c.saldo) : '—' },
    { rotulo: 'Vagas ocupadas', texto: pctVagas },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Serviços', href: '/servicos' }, { rotulo: servico.nome }]}
        titulo={servico.nome}
        descricao={`Código ${servico.codigo} · tudo o que os apps têm sobre este serviço, numa tela só. Cada bloco segue a permissão do próprio app.`}
        acoes={links.orcamento && c ? <LinkBotao href={links.orcamento}>Abrir orçamento do serviço</LinkBotao> : undefined}
      />
      {ficha.encerradoEm && <Aviso tipo="atencao">Serviço encerrado em {dataBR(ficha.encerradoEm)}. Os blocos mostram o histórico.</Aviso>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Números do serviço">
        {numeros.map((n) => (
          <div key={n.rotulo} className="rounded-cartao border border-borda bg-superficie p-4">
            <dt className="text-sm text-texto-suave">{n.rotulo}</dt>
            <dd className="text-2xl font-bold tabular-nums"><NumeroQueConta texto={n.texto} /></dd>
          </div>
        ))}
      </dl>

      <Custo f={ficha} links={links} />
      <VagasEAtendidos f={ficha} />
      <Projetos f={ficha} links={links} />
      <Requisicoes f={ficha} links={links} />
      <Publicacoes f={ficha} links={links} />
      <Avaliacao f={ficha} links={links} />
      <Resumo f={ficha} />
      <p className="text-sm text-texto-suave">Números calculados agora, em {dataBR(ficha.hoje)}; nada é guardado nesta tela.</p>
    </div>
  );
}
