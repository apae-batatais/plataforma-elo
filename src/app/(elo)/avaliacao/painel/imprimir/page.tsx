import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { painelDaAvaliacao, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { BarraImpressao } from '@/modulos/avaliacao/telas/barra-impressao';
import { agoraBrasilia, Folha } from '@/modulos/avaliacao/telas/folha';
import { PainelCompleto } from '@/modulos/avaliacao/telas/painel-completo';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export const metadata: Metadata = { title: 'Painel da Avaliação de Serviços Sociais para imprimir' };

const MES = /^\d{4}-\d{2}$/;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;

export default async function ImprimirPainel({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; servico?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.painel)) redirect('/avaliacao');
  const app = await obterAplicacao();
  const de = sp.de && MES.test(sp.de) ? sp.de : '';
  const ate = sp.ate && MES.test(sp.ate) ? sp.ate : '';
  const servico = sp.servico ?? '';
  const p = await painelDaAvaliacao(app.planilhas, usuario.autorizador, { de, ate, servico });
  const periodo = de || ate ? `Avaliações de ${de ? nomeMes(de) : 'o início'} a ${ate ? nomeMes(ate) : 'hoje'}` : 'Todas as avaliações salvas';
  const filtros = new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(servico ? { servico } : {}) });
  const nomeServico = p.servicosDisponiveis.find((s) => s.codigo === servico)?.nome;

  return (
    <div>
      <BarraImpressao voltar={`/avaliacao/painel${filtros.size ? `?${filtros}` : ''}`} rotuloVoltar="Voltar para o painel" />
      <Folha
        instituicao={app.instituicao.nome}
        titulo="Painel por serviço atual"
        subtitulo={`${periodo} · ${nomeServico ?? (p.todos ? 'todos os serviços' : 'serviços do escopo de quem emitiu')}`}
        emitidoPor={usuario.nome}
        emitidoEm={agoraBrasilia()}
        sigilo="Números agregados: nenhuma pessoa é identificada neste documento."
      >
        {p.total === 0 ? <p className="py-8 text-center text-texto-suave">Nenhuma avaliação com esses filtros.</p> : <PainelCompleto p={p} impressao />}
      </Folha>
    </div>
  );
}
