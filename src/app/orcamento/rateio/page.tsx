import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { gradeDeRateio } from '@/modulos/orcamento/aplicacao/folha';
import { RateioGeral } from '@/modulos/orcamento/telas/rateio-geral';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarRateios } from '../acoes';

export const metadata: Metadata = { title: 'Rateio geral' };

export default async function PaginaRateioGeral({ searchParams }: { searchParams: Promise<{ atalho?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.editar') || !a.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const grade = await gradeDeRateio(app.planilhas, a);
  const { atalho } = await searchParams;
  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Rateio geral' }]}
        titulo="Rateio geral"
        descricao="Todos os postos ativos e o percentual em cada centro de custo. Altere quantos quiser e salve de uma vez; cada posto alterado precisa somar exatamente 100%."
      />
      <RateioGeral key={grade.postos.map((p) => p.rateio.length).join()} grade={grade} acao={acaoSalvarRateios} soPendentes={atalho === 'pendentes'} />
    </div>
  );
}
