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

const mes = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const SITUACAO_ATIVIDADE: Record<string, string> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', concluida: 'Concluída' };

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
            {l.prazos && (
              <div className="space-y-5 pt-2">
                <div>
                  <h3 className="mb-2 font-semibold">Prazos</h3>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-texto-suave">Próxima parcela</dt><dd className="font-medium">{l.prazos.proximaParcela ? `${mes(l.prazos.proximaParcela.mes)}, ${moeda(l.prazos.proximaParcela.valor)}` : 'Nenhuma parcela a receber'}</dd></div>
                    <div><dt className="text-texto-suave">Última parcela</dt><dd className="font-medium">{l.prazos.ultimaParcela ? `${mes(l.prazos.ultimaParcela.mes)}, ${moeda(l.prazos.ultimaParcela.valor)}` : '—'}</dd></div>
                    <div><dt className="text-texto-suave">Fim da vigência</dt><dd className="font-medium">{l.prazos.fimVigencia ? dia(l.prazos.fimVigencia) : 'Ainda não informado'}</dd></div>
                  </dl>
                  <p className="mt-2 text-sm text-texto-suave">Prazos de prestação de contas: ainda não cadastrados em Parcerias.</p>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Fontes, cronograma e plano de aplicação</h3>
                  {l.termo.termo.fontes.length === 0 ? (
                    <EstadoVazio titulo="Nada aqui ainda.">O Financeiro ainda não cadastrou as fontes do termo.</EstadoVazio>
                  ) : (
                    <ul className="space-y-3">
                      {l.termo.termo.fontes.map((f) => (
                        <li key={f.nome} className="rounded border border-borda p-3 text-sm">
                          <p className="font-semibold">{f.nome}: {moeda(f.valorAtual)}</p>
                          <p className="mt-2 text-texto-suave">Cronograma de desembolso</p>
                          {f.cronograma.length === 0 ? (
                            <p>Ainda sem cronograma.</p>
                          ) : (
                            <TabelaDados legenda={`Cronograma de desembolso da fonte ${f.nome}`} colunas={[{ chave: 'mes', rotulo: 'Mês' }, { chave: 'valor', rotulo: 'Valor' }]} linhas={f.cronograma.map((x) => ({ id: x.mes, valores: { mes: mes(x.mes), valor: moeda(x.valor) } }))} />
                          )}
                          <p className="mt-2 text-texto-suave">Plano de aplicação</p>
                          {f.plano.length === 0 ? (
                            <p>Ainda sem plano de aplicação.</p>
                          ) : (
                            <TabelaDados legenda={`Plano de aplicação da fonte ${f.nome}`} colunas={[{ chave: 'categoria', rotulo: 'Categoria' }, { chave: 'valor', rotulo: 'Valor' }]} linhas={f.plano.map((x) => ({ id: x.categoria, valores: { categoria: x.categoria, valor: moeda(x.valor) } }))} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-sm"><span className="text-texto-suave">Recursos próprios previstos: </span><span className="font-medium">{l.termo.termo.recursosProprios === null ? 'Não informados' : moeda(l.termo.termo.recursosProprios)}</span></p>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Linha do tempo</h3>
                  {l.linhaDoTempo.length === 0 ? (
                    <EstadoVazio titulo="Nada aqui ainda.">Sem atividades com prazo nem parcelas do termo.</EstadoVazio>
                  ) : (
                    <TabelaDados
                      legenda="Atividades com prazo e parcelas do termo, em ordem de data"
                      colunas={[{ chave: 'data', rotulo: 'Data' }, { chave: 'o_que', rotulo: 'O que' }, { chave: 'detalhe', rotulo: 'Detalhe' }]}
                      linhas={l.linhaDoTempo.map((e, i) => ({
                        id: `${i}`,
                        valores: e.tipo === 'parcela' ? { data: mes(e.data.slice(0, 7)), o_que: e.texto, detalhe: moeda(e.valor) } : { data: dia(e.data), o_que: `Atividade: ${e.texto}`, detalhe: SITUACAO_ATIVIDADE[e.situacao ?? ''] ?? '' },
                      }))}
                    />
                  )}
                </div>
              </div>
            )}
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
