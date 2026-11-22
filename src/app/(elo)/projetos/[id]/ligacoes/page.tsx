import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerLigacoesDoProjeto } from '@/modulos/projetos/aplicacao/ligacoes';
import { lerLigacaoTermo } from '@/modulos/projetos/aplicacao/termo';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoDeLeitura, catalogoDeTermos } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { TabelaDados } from '@/ui/tabela-dados';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { CabecalhoPagina, Etiqueta, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoCriarRascunhoDoTermo } from '../../acoes';

export const metadata: Metadata = { title: 'Ligações do projeto' };

const SITUACAO = { rascunho: 'Rascunho, falta o Financeiro completar', em_vigor: 'Em vigor', encerrado: 'Encerrado' } as const;

export default async function PaginaLigacoes({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const l = await lerLigacaoTermo(planilhas, usuario.autorizador, id, catalogoDeTermos(planilhas));
  const outras = await lerLigacoesDoProjeto(planilhas, usuario.autorizador, id, catalogoDeLeitura(planilhas));
  if (!l || !outras) notFound();
  const podeAbrirTermo = l.termo.estado === 'ok' && usuario.autorizador.temPermissaoAlgumEscopo('parcerias.termos.ver');
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Projeto', href: `/projetos/${id}` }, { rotulo: 'Ligações' }]}
        titulo="Ligações"
        descricao="O que este projeto tem em comum com outros apps. Cada dado aparece só para quem tem acesso ao app onde ele fica."
      />
      <AbasProjeto id={id} atual="ligacoes" />
      {l.pontosDeAtencao.map((t) => (
        <Aviso key={t} tipo="atencao">{t}</Aviso>
      ))}
      <Secao id="t-termo" titulo="Termo de parceria" descricao="Criado em Parcerias como rascunho quando a porta 2 aprova um projeto com financiamento externo.">
        {!l.aplica ? (
          <EstadoVazio titulo="Este projeto ainda não tem termo.">
            Só projeto com financiamento externo tem termo, e só depois que a porta 2 aprova o Termo de Abertura.
          </EstadoVazio>
        ) : l.termo.estado === 'nenhum' ? (
          <div className="space-y-4">
            <EstadoVazio titulo="Este projeto ainda não tem termo.">
              {l.podeCriarRascunho
                ? 'A decisão da porta 2 vale, mas o rascunho não foi criado em Parcerias. Crie agora; clicar de novo não duplica.'
                : 'O rascunho do termo ainda não foi criado. Peça a quem decide a porta ou gerencia o projeto.'}
            </EstadoVazio>
            {l.podeCriarRascunho && (
              <form action={acaoCriarRascunhoDoTermo}>
                <input type="hidden" name="id" value={id} />
                <BotaoEnviar enviando="Criando…">Criar rascunho do termo</BotaoEnviar>
              </form>
            )}
          </div>
        ) : l.termo.estado === 'indisponivel' ? (
          <Aviso tipo="info">Ligação indisponível: Parcerias não está ativo ou não respondeu. O projeto está ligado ao termo {l.termo.nome}.</Aviso>
        ) : l.termo.estado === 'sem_permissao' ? (
          <Aviso tipo="info">Você vê que o projeto está ligado ao termo {l.termo.nome}. Os valores aparecem para quem acessa Parcerias.</Aviso>
        ) : (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{l.termo.termo.parceiro}</span>
              <Etiqueta tipo={l.termo.termo.situacao === 'rascunho' ? 'atencao' : l.termo.termo.situacao === 'em_vigor' ? 'sucesso' : 'neutro'}>{SITUACAO[l.termo.termo.situacao]}</Etiqueta>
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-texto-suave">Valor do termo</dt><dd className="font-medium">{moeda(l.termo.termo.valor)}</dd></div>
              <div><dt className="text-texto-suave">Valor aprovado do projeto</dt><dd className="font-medium">{moeda(l.valorAprovado)}</dd></div>
              <div><dt className="text-texto-suave">Financiador</dt><dd className="font-medium">{l.financiador ?? '—'}</dd></div>
            </dl>
            {podeAbrirTermo && <LinkBotao href="/parcerias">Abrir termo em Parcerias</LinkBotao>}
          </div>
        )}
      </Secao>
      <Secao id="t-outras" titulo="Outras ligações" descricao="O nome vem da cópia guardada no projeto. A situação aparece só para quem tem acesso ao app onde o dado fica.">
        {outras.ligacoes.length === 0 ? (
          <EstadoVazio titulo="Nada aqui ainda.">Quando uma ligação com outro app for criada, ela aparece nesta lista.</EstadoVazio>
        ) : (
          <ul className="space-y-2">
            {outras.ligacoes.map((x) => (
              <li key={x.id} className="rounded border border-borda p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{x.nomeAtual ?? x.nome}</span>
                  <Etiqueta tipo="neutro">{x.appNome}</Etiqueta>
                  {x.estado === 'ok' && x.situacao && <Etiqueta tipo="sucesso">{x.situacao}</Etiqueta>}
                </p>
                {x.estado === 'indisponivel' && <p className="mt-1 text-texto-suave">Ligação indisponível: {x.appNome} não está ativo ou não respondeu.</p>}
                {x.estado === 'sem_permissao' && <p className="mt-1 text-texto-suave">Os detalhes aparecem para quem acessa {x.appNome}.</p>}
              </li>
            ))}
          </ul>
        )}
      </Secao>
      <Secao id="t-compras" titulo="Compras do projeto" descricao="Requisições feitas com este projeto. Valores e detalhes ficam em Requisições.">
        {outras.compras.estado === 'indisponivel' || outras.compras.estado === 'erro' ? (
          <Aviso tipo="info">Ligação indisponível: Requisições não está ativo ou não respondeu.</Aviso>
        ) : outras.compras.estado === 'sem_permissao' ? (
          <Aviso tipo="info">As compras aparecem para quem acessa Requisições.</Aviso>
        ) : outras.compras.dados.length === 0 ? (
          <EstadoVazio titulo="Nada aqui ainda.">Nenhuma requisição foi ligada a este projeto.</EstadoVazio>
        ) : (
          <TabelaDados
            legenda="Compras ligadas ao projeto"
            colunas={[
              { chave: 'numero', rotulo: 'Número' },
              { chave: 'tipo', rotulo: 'Tipo' },
              { chave: 'situacao', rotulo: 'Situação' },
            ]}
            linhas={outras.compras.dados.map((c) => ({ id: c.id, valores: { numero: c.numero, tipo: c.tipo, situacao: c.situacaoNome } }))}
          />
        )}
      </Secao>
    </div>
  );
}
