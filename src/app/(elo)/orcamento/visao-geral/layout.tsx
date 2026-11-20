import { redirect } from 'next/navigation';
import { Contas, PoliticaReserva, Realizado, UsosReserva } from '@/modulos/orcamento/dados/tabelas';
import { usuarioLogado } from '@/plataforma/sessao';
import { ExigirAbas } from '../exigir-abas';

/** A Visão geral lê saldos, realizado, política e usos da reserva (planilha de execução). */
export default async function LayoutVisaoGeral({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.painel.ver') && !a.temPermissao('orcamento.tesouraria.ver')) redirect('/orcamento');
  return (
    <ExigirAbas tabelas={[Contas, Realizado, PoliticaReserva, UsosReserva] as const} nome="a Visão geral" administra={a.temPermissao('core.organizacao.gerenciar')}>
      {children}
    </ExigirAbas>
  );
}
