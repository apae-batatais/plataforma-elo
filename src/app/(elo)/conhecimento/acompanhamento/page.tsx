import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { acompanharPublicacao, listarAcompanhamento } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { ErroConhecimento, type SituacaoDaPessoa } from '@/modulos/conhecimento/dominio/publicacao';
import { EtiquetaDaPessoa, formatarDataHora } from '@/modulos/conhecimento/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Indicadores } from '@/ui/graficos';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Acompanhamento' };

const FILTROS: { valor: string; rotulo: string; situacoes: SituacaoDaPessoa[] | null }[] = [
  { valor: '', rotulo: 'Todos', situacoes: null },
  { valor: 'pendentes', rotulo: 'Pendentes', situacoes: ['pendente'] },
  { valor: 'renovar', rotulo: 'Precisam renovar', situacoes: ['precisa_renovar'] },
  { valor: 'em-dia', rotulo: 'Em dia', situacoes: ['em_dia'] },
];

const pilula = (ativa: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${ativa ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie text-texto hover:bg-superficie-2'}`;

export default async function Acompanhamento({ searchParams }: { searchParams: Promise<{ publicacao?: string; filtro?: string }> }) {
  const { publicacao, filtro = '' } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('conhecimento.acompanhar')) redirect('/conhecimento');
  const { planilhas } = await obterAplicacao();
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Acompanhamento' }];

  if (publicacao) {
    let a;
    try {
      a = await acompanharPublicacao(planilhas, usuario.autorizador, publicacao);
    } catch (erro) {
      if (!(erro instanceof ErroConhecimento)) throw erro;
      return (
        <div className="space-y-6">
          <CabecalhoPagina trilha={trilha} titulo="Acompanhamento" />
          <Aviso tipo="erro">{erro.message}</Aviso>
        </div>
      );
    }
    const f = FILTROS.find((x) => x.valor === filtro) ?? FILTROS[0];
    const pessoas = f.situacoes ? a.pessoas.filter((x) => f.situacoes!.includes(x.situacao)) : a.pessoas;
    return (
      <div className="space-y-6">
        <CabecalhoPagina
          trilha={[...trilha.slice(0, 2), { rotulo: 'Acompanhamento', href: '/conhecimento/acompanhamento' }, { rotulo: a.titulo }]}
          titulo={a.titulo}
          descricao={`${a.emDia} de ${a.total} em dia na versão atual (edição ${a.edicao}). Abrir esta lista fica registrado na auditoria.`}
        />
        <nav aria-label="Filtrar pessoas" className="flex flex-wrap gap-2">
          {FILTROS.map((x) => (
            <Link
              key={x.valor}
              href={`/conhecimento/acompanhamento?publicacao=${a.id}${x.valor ? `&filtro=${x.valor}` : ''}`}
              aria-current={x.valor === f.valor ? 'page' : undefined}
              className={pilula(x.valor === f.valor)}
            >
              {x.rotulo}
            </Link>
          ))}
        </nav>
        {pessoas.length === 0 ? (
          <EstadoVazio titulo="Ninguém nesta situação">Escolha outro filtro para ver as demais pessoas.</EstadoVazio>
        ) : (
          <TabelaDados
            legenda="Pessoas do público e a situação de cada uma"
            colunas={[
              { chave: 'nome', rotulo: 'Pessoa' },
              { chave: 'situacao', rotulo: 'Situação' },
              { chave: 'ciencia', rotulo: 'Ciência em' },
            ]}
            linhas={pessoas.map((x) => ({
              id: x.email,
              valores: { nome: x.nome, situacao: x.situacao, ciencia: x.cienciaEm ? formatarDataHora(x.cienciaEm) : null },
              celulas: { situacao: <EtiquetaDaPessoa situacao={x.situacao} /> },
            }))}
          />
        )}
      </div>
    );
  }

  const linhas = await listarAcompanhamento(planilhas, usuario.autorizador);
  return (
    <div className="space-y-6">
      <CabecalhoPagina trilha={trilha} titulo="Acompanhamento" descricao="Quem já deu ciência e quem falta, publicação por publicação." />
      {linhas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma publicação exige ciência ainda">Quando você publicar algo que exige ciência, o acompanhamento aparece aqui.</EstadoVazio>
      ) : (
        <Secao titulo="Publicações que exigem ciência" id="t-acompanhamento">
          <Indicadores
            itens={linhas.map((l) => ({
              nome: l.titulo,
              valor: l.total ? Math.round((l.emDia / l.total) * 100) : null,
              explicacao: `${l.emDia} de ${l.total} em dia${l.situacao === 'arquivada' ? ' (arquivada)' : ''}.`,
              anteriores: [],
            }))}
          />
          <ul className="mt-6 divide-y divide-borda border-t border-borda">
            {linhas.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold">{l.titulo}</span>
                <Link
                  href={`/conhecimento/acompanhamento?publicacao=${l.id}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-borda-forte bg-superficie px-4 text-sm font-semibold hover:bg-destaque-suave"
                >
                  Ver as pessoas ({l.emDia} de {l.total} em dia)
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
