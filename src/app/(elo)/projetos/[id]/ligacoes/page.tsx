import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerLigacaoTermo } from '@/modulos/projetos/aplicacao/termo';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoDeTermos } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
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
  if (!l) notFound();
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
    </div>
  );
}
