import { redirect } from 'next/navigation';
import { PoliticaReserva, UsosReserva } from '@/modulos/orcamento/dados/tabelas';
import { usuarioLogado } from '@/plataforma/sessao';
import { ExigirAbas } from '../../exigir-abas';

/** A Reserva usa as abas PoliticaReserva e UsosReserva (1D.2), além das da Tesouraria. */
export default async function LayoutReserva({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  return (
    <ExigirAbas tabelas={[PoliticaReserva, UsosReserva] as const} nome="a Reserva" administra={a.temPermissao('core.organizacao.gerenciar')}>
      {children}
    </ExigirAbas>
  );
}
