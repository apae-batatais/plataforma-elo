import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarTermos, termosComAlertaDeOciosas } from '@/modulos/parcerias/aplicacao/parcerias';
import { dinheiro, NOME_TIPO } from '@/modulos/parcerias/dominio/termos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { rascunhosDeTermo } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Termos de parceria' };
const dataBR = (d: string) => d.split('-').reverse().join('/');

export default async function Termos({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const q = await searchParams;
  const termos = await listarTermos(planilhas, usuario.autorizador);
  const ociosas = await termosComAlertaDeOciosas(planilhas, usuario.autorizador);
  const rascunhos = await rascunhosDeTermo(planilhas, usuario.autorizador);
  const acaba = termos.filter((t) => t.terminaEmAte90Dias);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Parcerias' }]}
        titulo="Termos de parceria"
        descricao="Cada termo, com suas fontes de recurso, o cronograma de desembolso, os aportes e a ocupação das vagas."
        acoes={
          usuario.autorizador.temPermissao('parcerias.termos.editar') && (
            <LinkBotao href="/parcerias/novo" className={pequeno}>
              <IconeMais tamanho={16} /> Novo termo
            </LinkBotao>
          )
        }
      />
      {q.ok && <Aviso tipo="sucesso">{q.ok}</Aviso>}
      {q.erro && <Aviso tipo="erro">{q.erro}</Aviso>}
      {acaba.length > 0 && (
        <Aviso tipo="atencao" titulo="Termos que terminam em até 90 dias">
          {acaba.map((t) => `${t.parceiro} (${t.numero}), até ${dataBR(t.fim)}`).join('; ')}.
        </Aviso>
      )}
      {rascunhos.length > 0 && (
        <Secao id="t-rascunhos" titulo="Rascunhos para completar" descricao="Vieram de projetos aprovados na porta 2. Não entram no orçamento, na ocupação nem nos alertas até serem concluídos.">
          <TabelaDados
            legenda="Rascunhos de termo"
            vazio="Nenhum rascunho para completar."
            colunas={[
              { chave: 'projeto', rotulo: 'Projeto' },
              { chave: 'parceiro', rotulo: 'Parceiro' },
              { chave: 'valor', rotulo: 'Valor do projeto', tipo: 'moeda' },
              { chave: 'falta', rotulo: 'O que falta' },
            ]}
            linhas={rascunhos.map((r) => ({
              id: r.id,
              valores: { projeto: r.projetoCodigo ?? '', parceiro: r.parceiro, valor: r.valor, falta: r.falta.join(', ') },
              celulas: {
                projeto: (
                  <span className="flex flex-wrap gap-1">
                    {r.projetoCodigo ?? '—'} <Etiqueta tipo="atencao">Rascunho</Etiqueta>
                    {r.origemParadaOuCancelada && <Etiqueta tipo="erro">Projeto de origem cancelado</Etiqueta>}
                  </span>
                ),
                valor: <span className="tabular-nums">{dinheiro(r.valor)}</span>,
              },
            }))}
          />
        </Secao>
      )}
      <TabelaDados
        legenda="Termos de parceria"
        vazio="Nenhum termo cadastrado."
        colunas={[
          { chave: 'parceiro', rotulo: 'Parceiro' },
          { chave: 'numero', rotulo: 'Número' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'vigencia', rotulo: 'Vigência' },
          { chave: 'valor', rotulo: 'Valor global', tipo: 'moeda', somar: true },
          { chave: 'servicos', rotulo: 'Serviços' },
          { chave: 'situacao', rotulo: 'Situação' },
        ]}
        linhas={termos.map((t) => ({
          id: t.id,
          valores: {
            parceiro: t.parceiro,
            numero: t.numero,
            tipo: NOME_TIPO[t.tipo],
            vigencia: `${dataBR(t.inicio)} a ${dataBR(t.fim)}`,
            valor: t.valorGlobal,
            servicos: t.servicos.join(', '),
            situacao: t.situacao === 'em_vigor' ? 'Em vigor' : 'Encerrado',
          },
          celulas: {
            parceiro: (
              <Link href={`/parcerias/${t.id}`} className="font-semibold text-destaque hover:underline">
                {t.parceiro}
              </Link>
            ),
            valor: <span className="tabular-nums">{dinheiro(t.valorGlobal)}</span>,
            situacao: (
              <span className="flex flex-wrap gap-1">
                <Etiqueta tipo={t.situacao === 'em_vigor' ? 'sucesso' : 'neutro'}>{t.situacao === 'em_vigor' ? 'Em vigor' : 'Encerrado'}</Etiqueta>
                {ociosas.has(t.id) && <Etiqueta tipo="atencao">Vagas ociosas</Etiqueta>}
                {t.pontosDeAtencao > 0 && <Etiqueta tipo="atencao">{t.pontosDeAtencao} ponto(s) de atenção</Etiqueta>}
              </span>
            ),
          },
        }))}
      />
    </div>
  );
}
