import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { conferirInstituicao, painelDaRede, type ConferenciaInstituicao } from '@/nucleo/rede/rede';
import { aplicacaoDa } from '@/plataforma/aplicacao';
import { configGeral } from '@/plataforma/instituicao';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoMudarSituacao, acaoSalvarInstituicao } from './acoes';
import { FormularioInstituicao } from './formulario-instituicao';
import { PLANILHAS_DA_INSTITUICAO } from './planilhas';

export const metadata: Metadata = { title: 'Instituições' };

const SITUACAO = { preparacao: 'Em preparação', ativa: 'Ativa', suspensa: 'Suspensa' } as const;
const COR = { preparacao: 'info', ativa: 'sucesso', suspensa: 'erro' } as const;
const ESTRUTURA = {
  em_dia: { tipo: 'sucesso', titulo: 'Tudo certo' },
  desatualizada: { tipo: 'atencao', titulo: 'Falta rodar Preparar estrutura' },
  nao_preparada: { tipo: 'atencao', titulo: 'Planilhas ainda em branco' },
  sem_acesso: { tipo: 'erro', titulo: 'Sem acesso às planilhas' },
} as const;

export default async function Instituicoes({ searchParams }: { searchParams: Promise<{ editar?: string; conferir?: string }> }) {
  const sp = await searchParams;
  const adm = await administradorDaRedeLogado();
  if (!adm) redirect('/rede/entrar');
  const painel = await painelDaRede(adm.app.planilhas, adm.autorizador);
  const emEdicao = sp.editar ? painel.instituicoes.find((i) => i.id === sp.editar) : undefined;
  const aConferir = sp.conferir ? painel.instituicoes.find((i) => i.id === sp.conferir) : undefined;
  let conferencia: ConferenciaInstituicao | null = null;
  if (aConferir) {
    if (adm.demonstracao) {
      // Na demonstração, as planilhas de cada instituição fictícia ficam em memória, com os nomes das chaves.
      const g = configGeral();
      const app = await aplicacaoDa(g, { ...aConferir, planilhas: {} });
      const chaves = Object.fromEntries(['nucleo', 'auditoria', ...new Set((ESTRUTURA_DOS_MODULOS.tabelas ?? []).map((t) => t.planilha))].map((c) => [c, c]));
      conferencia = await conferirInstituicao(adm.autorizador, app.planilhas.armazenamento, { ...aConferir, planilhas: chaves }, ESTRUTURA_DOS_MODULOS);
    } else {
      conferencia = await conferirInstituicao(adm.autorizador, adm.app.armazenamentoDasInstituicoes, aConferir, ESTRUTURA_DOS_MODULOS);
    }
  }
  const contagem = (s: keyof typeof SITUACAO) => painel.instituicoes.filter((i) => i.situacao === s).length;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Instituições"
        descricao="As Apaes e entidades que usam o Elo. Cada uma acessa pelo próprio endereço, entra só com e-mails do próprio domínio e guarda os dados no próprio Drive."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Cadastrar instituição
              </>
            }
            className={pequeno}
            larga
            titulo="Cadastrar instituição"
            descricao="Ela começa em preparação: ninguém entra até você ativar."
          >
            <FormularioInstituicao acao={acaoSalvarInstituicao} planilhas={PLANILHAS_DA_INSTITUICAO} />
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/rede" larga titulo={`Alterar ${emEdicao.nome}`}>
          <FormularioInstituicao acao={acaoSalvarInstituicao} planilhas={PLANILHAS_DA_INSTITUICAO} instituicao={emEdicao} />
        </JanelaFormulario>
      )}

      {aConferir && conferencia && (
        <section aria-label={`Conferência da ${aConferir.nome}`} className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Conferência: {aConferir.nome}</h2>
              <p className="text-sm text-texto-suave">Testa o acesso a cada planilha e a estrutura, sem ler dados e sem gravar nada.</p>
            </div>
            <LinkBotao href="/rede" variante="secundario" className={pequeno}>
              Fechar
            </LinkBotao>
          </div>
          <ul className="space-y-1.5 text-sm">
            {conferencia.planilhas.map((x) => (
              <li key={x.chave} className="flex gap-2">
                <span aria-hidden="true" className={x.ok ? 'text-sucesso' : 'text-erro'}>
                  {x.ok ? '✓' : '✕'}
                </span>
                <span>{x.mensagem}</span>
              </li>
            ))}
          </ul>
          <Aviso tipo={ESTRUTURA[conferencia.estrutura].tipo} titulo={ESTRUTURA[conferencia.estrutura].titulo}>
            {conferencia.mensagemEstrutura}
          </Aviso>
        </section>
      )}

      {painel.instituicoes.length === 0 ? (
        <Aviso tipo="info" titulo="Nenhuma instituição cadastrada ainda">
          Enquanto a rede estiver vazia, o Elo continua usando a instituição das variáveis da hospedagem. Cadastre a primeira com o botão acima e ative-a
          quando a conferência estiver em ordem.
        </Aviso>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(SITUACAO) as (keyof typeof SITUACAO)[]).map((s) => (
              <div key={s} className="rounded-xl border border-borda bg-superficie px-4 py-3">
                <dt className="text-sm text-texto-suave">{SITUACAO[s]}</dt>
                <dd className="text-2xl font-bold tabular-nums">{contagem(s)}</dd>
              </div>
            ))}
          </dl>
          <TabelaDados
            legenda="Instituições da rede"
            colunas={[
              { chave: 'nome', rotulo: 'Instituição' },
              { chave: 'situacao', rotulo: 'Situação' },
              { chave: 'dominio', rotulo: 'Domínio' },
              { chave: 'enderecos', rotulo: 'Endereços' },
              { chave: 'planilhas', rotulo: 'Planilhas', tipo: 'numero', secundaria: true },
              { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-72' },
            ]}
            linhas={painel.instituicoes.map((i) => ({
              id: i.id,
              destaque: i.id === aConferir?.id,
              valores: {
                nome: i.nome,
                situacao: SITUACAO[i.situacao],
                dominio: i.dominio,
                enderecos: i.enderecos.join(', ') || '—',
                planilhas: Object.keys(i.planilhas).length,
              },
              celulas: {
                nome: (
                  <>
                    <span className="font-semibold">{i.nome}</span>
                    <span className="block text-xs text-texto-suave">{i.codigo}</span>
                  </>
                ),
                situacao: <Etiqueta tipo={COR[i.situacao]}>{SITUACAO[i.situacao]}</Etiqueta>,
                enderecos: i.enderecos.length ? <span className="text-sm">{i.enderecos.join(', ')}</span> : <span className="text-sm text-texto-suave">nenhum</span>,
                acoes: (
                  <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                    <LinkBotao href={`/rede?conferir=${i.id}`} scroll={false} variante="secundario" className={pequeno}>
                      Conferir
                    </LinkBotao>
                    <LinkBotao href={`/rede?editar=${i.id}`} scroll={false} variante="icone" aria-label={`Alterar ${i.nome}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    {i.situacao === 'ativa' ? (
                      <FormularioConfirmado
                        acao={acaoMudarSituacao}
                        campos={{ id: i.id, versao: i.versao, situacao: 'suspensa' }}
                        rotulo="Suspender"
                        variante="fantasma"
                        titulo={`Suspender ${i.nome}?`}
                        mensagem="Ninguém da instituição consegue entrar até você reativar. Os dados continuam no Drive dela; nada é apagado."
                        confirmar="Suspender"
                      />
                    ) : (
                      <FormularioConfirmado
                        acao={acaoMudarSituacao}
                        campos={{ id: i.id, versao: i.versao, situacao: 'ativa' }}
                        rotulo="Ativar"
                        variante="fantasma"
                        perigoso={false}
                        titulo={`Ativar ${i.nome}?`}
                        mensagem={
                          i.situacao === 'preparacao'
                            ? 'Use Conferir antes: as planilhas precisam estar compartilhadas. Depois de ativar, a equipe entra pelo endereço da instituição.'
                            : 'A equipe volta a entrar pelo endereço da instituição.'
                        }
                        confirmar="Ativar"
                      />
                    )}
                  </div>
                ),
              },
            }))}
          />
        </>
      )}

      <details className="rounded-xl border border-borda bg-superficie px-5 py-4 text-sm">
        <summary className="cursor-pointer font-semibold">Como trazer uma instituição para o Elo</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Cadastre a instituição aqui (ela começa em preparação).</li>
          <li>A TI da instituição cria o endereço (ex.: elo.apaefranca.org.br) no DNS; a Operadora inclui o endereço na Netlify e no login do Google.</li>
          <li>A instituição cria as planilhas no próprio Drive, compartilha com a conta de serviço e envia os IDs; cole-os em Alterar.</li>
          <li>Use Conferir até tudo estar certo e clique em Ativar.</li>
          <li>O administrador inicial entra pelo endereço da instituição e roda Preparar estrutura.</li>
        </ol>
      </details>
    </div>
  );
}
