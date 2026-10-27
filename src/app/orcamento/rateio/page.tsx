import { redirect } from 'next/navigation';
import { gradeDeRateio } from '@/modulos/orcamento/aplicacao/folha';
import { RateioGeral } from '@/modulos/orcamento/telas/rateio-geral';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Mensagem } from '../../admin/mensagem';
import { acaoSalvarRateios } from '../acoes';

export default async function PaginaRateioGeral({ searchParams }: { searchParams: Promise<{ ok?: string; atalho?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.editar') || !a.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const grade = await gradeDeRateio(app.planilhas, a);
  const { ok, atalho } = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Rateio geral</h2>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Todos os postos ativos e os percentuais em cada centro de custo. Altere quantos quiser e salve de uma vez. Só é possível salvar quando
          cada posto alterado soma exatamente 100%.
        </p>
      </div>
      <Mensagem ok={ok} />
      <RateioGeral key={ok ?? 'grade'} grade={grade} acao={acaoSalvarRateios} soPendentes={atalho === 'pendentes'} />
    </div>
  );
}
