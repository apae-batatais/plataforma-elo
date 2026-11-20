import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { filtrarPedidos, listarPedidos, opcoesDoPedido, type FiltrosPedidos, type Visao } from '@/modulos/comunicacao/aplicacao/pedidos';
import { NOME_SITUACAO, NOME_TIPO_PECA, SITUACOES, TIPOS_PECA } from '@/modulos/comunicacao/dominio/pedido';
import { problemasDePublicacao } from '@/modulos/comunicacao/aplicacao/publicacoes';
import { ControleFilas, FILAS, PilulasDeFiltro } from '@/modulos/comunicacao/telas/filtros-pedidos';
import { ListaPedidos } from '@/modulos/comunicacao/telas/lista-pedidos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Pedidos' };

const PERMISSAO_DA_FILA: Record<string, string> = {
  revisar: 'comunicacao.revisar',
  aprovar: 'comunicacao.aprovar',
  agendar: 'comunicacao.revisar',
  agendados: 'comunicacao.revisar',
  todos: 'comunicacao.ver_todos',
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Pedidos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const filas = FILAS.filter((f) => usuario.autorizador.temPermissao(PERMISSAO_DA_FILA[f.fila]));
  if (filas.length === 0) redirect('/comunicacao');
  const fila = filas.find((f) => f.fila === um(q.fila))?.fila ?? filas[0].fila;
  const filtros: FiltrosPedidos = { situacao: um(q.situacao), tipo: um(q.tipo), area: um(q.area), tema: um(q.tema) };
  const { planilhas, instituicao } = await obterAplicacao();
  const problemas = await problemasDePublicacao(planilhas, usuario.autorizador, instituicao.codigo);
  const todas = await listarPedidos(planilhas, usuario.autorizador, fila as Visao);
  const linhas = filtrarPedidos(todas, filtros);
  const { areas } = await opcoesDoPedido(planilhas, usuario.autorizador);
  const temas = [...new Set(todas.map((r) => r.tema).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const presentes = <T extends string>(valores: readonly T[], de: (r: (typeof todas)[number]) => string) => valores.filter((v) => todas.some((r) => de(r) === v));
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Pedidos' }]}
        titulo="Pedidos"
        descricao="Os pedidos de publicação de toda a instituição, por etapa."
      />
      {(problemas.falharam > 0 || problemas.atrasadas > 0 || problemas.reconectar) && (
        <Aviso
          tipo="atencao"
          titulo="Publicações no Instagram precisam de atenção"
          acao={usuario.autorizador.temPermissao('comunicacao.configurar') && problemas.reconectar ? <LinkBotao href="/comunicacao/configuracoes#t-instagram">Abrir as configurações</LinkBotao> : undefined}
        >
          {problemas.falharam > 0 && <>{problemas.falharam === 1 ? '1 publicação falhou' : `${problemas.falharam} publicações falharam`}. </>}
          {problemas.atrasadas > 0 && <>{problemas.atrasadas === 1 ? '1 publicação está atrasada' : `${problemas.atrasadas} publicações estão atrasadas`}. </>}
          {problemas.reconectar && <>A conta do Instagram precisa ser reconectada pela coordenação. </>}
          Abra o pedido na fila “Agendados” para tentar de novo ou publicar à mão.
        </Aviso>
      )}
      <ControleFilas filas={filas} atual={fila} />
      <PilulasDeFiltro
        fila={fila}
        filtros={filtros}
        grupos={[
          { chave: 'situacao', rotulo: 'Situação', opcoes: presentes(SITUACOES, (r) => r.situacao).map((s) => ({ valor: s, rotulo: NOME_SITUACAO[s] })) },
          { chave: 'tipo', rotulo: 'Tipo', opcoes: presentes(TIPOS_PECA, (r) => r.tipoPeca).map((t) => ({ valor: t, rotulo: NOME_TIPO_PECA[t] })) },
          { chave: 'area', rotulo: 'Área', opcoes: areas.filter((a) => todas.some((r) => r.area === a.codigo)).map((a) => ({ valor: a.codigo, rotulo: a.nome })) },
          {
            chave: 'tema',
            rotulo: 'Tema',
            opcoes: [...(todas.some((r) => r.tema === null) ? [{ valor: 'fora', rotulo: 'Fora do calendário' }] : []), ...temas.map((t) => ({ valor: t, rotulo: t }))],
          },
        ]}
      />
      {linhas.length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido aqui">Quando houver pedidos nesta etapa, eles aparecem nesta lista.</EstadoVazio>
      ) : (
        <ListaPedidos linhas={linhas} legenda="Pedidos de publicação" vazio="Nenhum pedido." comSolicitante />
      )}
    </div>
  );
}
