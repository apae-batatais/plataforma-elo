/**
 * Blocos da Ficha do serviço. Cada bloco vem de um app, com a permissão dele; aqui só se desenha.
 * Estados de todo bloco: com dados, vazio, sem permissão, app indisponível e erro de leitura.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FichaDoServico, LigacaoLida } from '@/plataforma/ligacoes';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BarrasHorizontais, Indicadores } from '@/ui/graficos';
import { formatarValor } from '@/ui/formato';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

const reais = (v: number) => formatarValor(v, 'moeda');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (aaaamm: string) => MESES[Number(aaaamm.slice(5)) - 1] ?? aaaamm;
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Mostra o aviso do estado quando o bloco não tem dados; devolve `null` quando há dados para desenhar. */
function semDados<T>(l: LigacaoLida<T>, app: string, semAcesso: string): ReactNode | null {
  if (l.estado === 'ok') return null;
  if (l.estado === 'sem_permissao') return <Aviso tipo="info">{semAcesso}</Aviso>;
  if (l.estado === 'indisponivel') return <Aviso tipo="info">Este app não está ativo na sua instituição.</Aviso>;
  return (
    <Aviso tipo="atencao" titulo={`Não foi possível carregar ${app} agora.`}>
      Tente de novo em instantes. Os outros blocos continuam valendo.
    </Aviso>
  );
}

function Bloco({ id, titulo, link, children }: { id: string; titulo: string; link?: { href: string; rotulo: string } | null; children: ReactNode }) {
  return (
    <Secao
      id={id}
      titulo={titulo}
      acoes={link ? <LinkBotao href={link.href} variante="secundario" className={pequeno}>{link.rotulo}</LinkBotao> : undefined}
    >
      <div className="p-5">{children}</div>
    </Secao>
  );
}

/** "Abrir em <app>" só aparece quando a pessoa tem acesso ao app (ele está no menu dela). */
export type LinksDosApps = Partial<Record<'orcamento' | 'projetos' | 'requisicoes' | 'comunicacao' | 'avaliacao', string>>;
const abrirEm = (links: LinksDosApps, app: keyof LinksDosApps, nome: string) => (links[app] ? { href: links[app]!, rotulo: `Abrir em ${nome}` } : null);

function Dado({ rotulo, valor, dica }: { rotulo: string; valor: ReactNode; dica?: string }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="text-2xl font-bold tabular-nums">{valor}</dd>
      {dica && <p className="text-sm text-texto-suave">{dica}</p>}
    </div>
  );
}

export function Resumo({ f }: { f: FichaDoServico }) {
  const s = f.servico;
  return (
    <Bloco id="bloco-resumo" titulo="Resumo">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Dado rotulo="Código" valor={s.codigo} />
        <Dado rotulo="Unidade" valor={s.unidade} />
        <Dado rotulo="Área" valor={f.area ?? '—'} />
        <Dado rotulo="Vigência" valor={`${s.inicio ? dataBR(s.inicio) : '—'} a ${s.fim ? dataBR(s.fim) : 'sem fim'}`} />
      </dl>
    </Bloco>
  );
}

export function Custo({ f, links }: { f: FichaDoServico; links: LinksDosApps }) {
  const aviso = semDados(f.custo, 'o orçamento', 'Você não tem acesso ao orçamento deste serviço. Fale com o Financeiro.');
  const c = f.custo.estado === 'ok' ? f.custo.dados : null;
  return (
    <Bloco id="bloco-custo" titulo="Custo e fontes" link={abrirEm(links, 'orcamento', 'Orçamento')}>
      {aviso ?? (c && <CustoComDados c={c} />)}
    </Bloco>
  );
}

function CustoComDados({ c }: { c: NonNullable<Extract<FichaDoServico['custo'], { estado: 'ok' }>['dados']> }) {
  if (!c.previsaoAprovada && c.porFonte.length === 0) {
    return <EstadoVazio titulo={`Sem orçamento aprovado para ${c.ano}`}>Quando o exercício for aprovado, o previsto e o saldo aparecem aqui.</EstadoVazio>;
  }
  const ate = c.ultimoMes ? `até ${nomeDoMes(c.ultimoMes)}` : 'nenhum mês informado ainda';
  const totalGasto = c.realizado;
  const maior = c.porFonte.reduce((m, l) => (l.realizado > m.realizado ? l : m), c.porFonte[0]);
  const titulo =
    totalGasto > 0 && maior
      ? `${maior.fonte} concentra ${Math.round((maior.realizado / totalGasto) * 100)}% do gasto do serviço`
      : `Nenhum gasto informado em ${c.ano} (${ate})`;
  const baixo = c.previsto > 0 && c.saldo < c.previsto * 0.1;
  return (
    <div className="space-y-4">
      {!c.previsaoAprovada && <Aviso tipo="info">O orçamento de {c.ano} ainda não foi aprovado: só o realizado aparece.</Aviso>}
      <h3 className="text-base font-bold">{titulo}</h3>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {c.porFonte.length > 7 ? (
            <TabelaDados
              legenda={`Previsto e realizado por fonte, ${ate}`}
              colunas={[
                { chave: 'fonte', rotulo: 'Fonte' },
                { chave: 'previsto', rotulo: 'Previsto no ano', tipo: 'moeda', somar: true },
                { chave: 'realizado', rotulo: 'Realizado', tipo: 'moeda', somar: true },
              ]}
              linhas={c.porFonte.map((l) => ({ id: l.fonte, valores: { fonte: l.fonte, previsto: l.previsto, realizado: l.realizado } }))}
            />
          ) : (
            <BarrasHorizontais
              categorias={c.porFonte.map((l) => l.fonte)}
              series={[
                { nome: 'Previsto no ano', valores: c.porFonte.map((l) => l.previsto), cor: 1 },
                { nome: `Realizado (${ate})`, valores: c.porFonte.map((l) => l.realizado), cor: 2 },
              ]}
              formato="moeda"
              rotuloCategoria="Fonte"
              descricao={`Previsto e realizado por fonte de recurso do serviço em ${c.ano}`}
            />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-texto-suave">Saldo ({ate})</p>
          <p className="text-3xl font-bold"><NumeroQueConta texto={reais(c.saldo)} /></p>
          <p className="text-sm text-texto-suave">
            {c.saldo < 0
              ? 'O realizado passou do previsto. Converse com o Financeiro.'
              : baixo
                ? 'Saldo menor que 10% do previsto: converse com o Financeiro.'
                : `Do previsto de ${reais(c.previsto)} no ano.`}
          </p>
        </div>
      </div>
      {c.cedidos.length > 0 && (
        <p className="text-sm text-texto-suave">
          <strong className="text-texto">Pessoal cedido em {c.ano}, fora do previsto e do realizado acima:</strong>{' '}
          {c.cedidos.map((x) => `${x.cedente} (${x.tipo}): ${reais(x.previsto)}`).join('; ')}. Despesa e receita de mesmo valor, sem passar pelo caixa.
        </p>
      )}
    </div>
  );
}

export function VagasEAtendidos({ f }: { f: FichaDoServico }) {
  const { vagas, ocupadas } = f.vagas;
  const pct = vagas ? Math.round((ocupadas / vagas) * 100) : null;
  return (
    <Bloco id="bloco-vagas" titulo="Vagas e atendidos">
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-4">
          <Dado rotulo="Vagas" valor={vagas ?? '—'} dica={vagas === null ? 'Sem vagas cadastradas' : undefined} />
          <Dado rotulo="Pessoas com vínculo ativo" valor={ocupadas} dica="Só a quantidade, sem nomes." />
        </dl>
        <Indicadores
          itens={[
            {
              nome: 'Vagas ocupadas',
              valor: pct,
              explicacao: pct === null ? 'Cadastre as vagas do serviço para ver a ocupação.' : `${ocupadas} de ${vagas} vagas`,
              referencia: { valor: 100, sentido: 'ate' },
              anteriores: [],
            },
          ]}
        />
      </div>
    </Bloco>
  );
}

export function Projetos({ f, links }: { f: FichaDoServico; links: LinksDosApps }) {
  const aviso = semDados(f.projetos, 'os projetos', 'Você não tem acesso a Projetos.');
  const d = f.projetos.estado === 'ok' ? f.projetos.dados : null;
  return (
    <Bloco id="bloco-projetos" titulo="Projetos" link={abrirEm(links, 'projetos', 'Projetos')}>
      {aviso ??
        (d && d.projetos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum projeto neste serviço ainda."
            acao={d.podePropor ? <LinkBotao href="/projetos/nova" variante="secundario">Cadastrar uma ideia</LinkBotao> : undefined}
          />
        ) : (
          d && (
            <div className="space-y-3">
              <ul className="flex flex-wrap gap-2" aria-label="Projetos por etapa">
                {d.porEtapa.map((e) => (
                  <li key={e.etapa}><Etiqueta>{e.nome}: {e.quantidade}</Etiqueta></li>
                ))}
              </ul>
              <TabelaDados
                legenda="Projetos do serviço"
                colunas={[
                  { chave: 'codigo', rotulo: 'Código' },
                  { chave: 'titulo', rotulo: 'Projeto' },
                  { chave: 'etapa', rotulo: 'Etapa' },
                ]}
                linhas={d.projetos.map((p) => ({
                  id: p.id,
                  valores: { codigo: p.codigo, titulo: p.titulo, etapa: p.etapaNome },
                  celulas: { titulo: <Link href={`/projetos/${p.id}`} className="font-medium text-destaque hover:underline">{p.titulo}</Link> },
                }))}
              />
            </div>
          )
        ))}
    </Bloco>
  );
}

export function Requisicoes({ f, links }: { f: FichaDoServico; links: LinksDosApps }) {
  const aviso = semDados(f.requisicoes, 'as requisições', 'Você não tem acesso a Requisições.');
  const d = f.requisicoes.estado === 'ok' ? f.requisicoes.dados : null;
  return (
    <Bloco id="bloco-requisicoes" titulo="Requisições" link={abrirEm(links, 'requisicoes', 'Requisições')}>
      {aviso ??
        (d && (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Dado rotulo="Abertas" valor={d.abertas} />
            <Dado rotulo="Esperando aprovação" valor={d.esperandoAprovacao} />
            <Dado rotulo="Atrasadas" valor={d.atrasadas} dica={d.atrasadas ? 'Passaram do prazo da etapa.' : undefined} />
            <Dado rotulo={`Atendidas em ${d.ano}`} valor={d.atendidasNoAno} />
          </dl>
        ))}
    </Bloco>
  );
}

const TIPO_PECA: Record<string, string> = {};
export function Publicacoes({ f, links }: { f: FichaDoServico; links: LinksDosApps }) {
  const aviso = semDados(f.publicacoes, 'as publicações', 'Você não tem acesso a Comunicação.');
  const d = f.publicacoes.estado === 'ok' ? f.publicacoes.dados : null;
  return (
    <Bloco id="bloco-publicacoes" titulo="Publicações" link={abrirEm(links, 'comunicacao', 'Comunicação')}>
      {aviso ??
        (d && d.emAndamento === 0 && d.publicadosNosUltimos12Meses === 0 ? (
          <EstadoVazio titulo="Nenhum pedido de publicação ligado a este serviço.">Pedidos ligados ao serviço aparecem aqui.</EstadoVazio>
        ) : (
          d && (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-4">
                <Dado rotulo="Pedidos em andamento" valor={d.emAndamento} />
                <Dado rotulo="Publicados nos últimos 12 meses" valor={d.publicadosNosUltimos12Meses} />
              </dl>
              {d.ultimosPublicados.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {d.ultimosPublicados.map((u) => (
                    <li key={u.numero}>
                      {u.link ? <a href={u.link} className="text-destaque hover:underline" rel="noreferrer">{u.titulo}</a> : u.titulo}{' '}
                      <span className="text-texto-suave">· {TIPO_PECA[u.tipoPeca] ?? u.tipoPeca.replace(/_/g, ' ')}{u.publicadoEm ? ` · ${dataBR(u.publicadoEm.slice(0, 10))}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        ))}
    </Bloco>
  );
}

export function Avaliacao({ f, links }: { f: FichaDoServico; links: LinksDosApps }) {
  const aviso = semDados(f.avaliacao, 'a avaliação', 'Você não tem acesso ao painel da Avaliação deste serviço.');
  const d = f.avaliacao.estado === 'ok' ? f.avaliacao.dados : null;
  return (
    <Bloco id="bloco-avaliacao" titulo="Avaliação" link={abrirEm(links, 'avaliacao', 'Avaliação')}>
      {aviso ??
        (d && d.avaliacoesNoAno === 0 ? (
          <EstadoVazio titulo={`Nenhuma avaliação em ${d.ano} neste serviço.`} />
        ) : (
          d && (
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Dado rotulo={`Avaliações em ${d.ano}`} valor={d.avaliacoesNoAno} />
              <Dado rotulo="Pessoas avaliadas" valor={d.pessoas} dica="Só a quantidade, sem nomes." />
              <Dado rotulo="Índice médio de cuidado" valor={d.indiceMedioDeCuidado === null ? '—' : d.indiceMedioDeCuidado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} />
              <Dado rotulo="Reavaliações atrasadas" valor={d.reavaliacoesAtrasadas} />
            </dl>
          )
        ))}
    </Bloco>
  );
}
