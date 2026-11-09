import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ENDERECO_DO_ARQUIVO } from '@/nucleo/armazenamento/pastas';
import { conferirInstituicao, painelDaRede, type ConferenciaInstituicao } from '@/nucleo/rede/rede';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoMudarSituacao, acaoPrepararEstrutura, acaoPrepararEstruturaDeTodas, acaoSalvarInstituicao } from './acoes';
import { avisoDeEstrutura } from './estrutura-das-instituicoes';
import { FormularioInstituicao } from './formulario-instituicao';
import { PLANILHAS_DA_INSTITUICAO } from './planilhas';
import { planilhasDaInstituicao } from './planilhas-da-instituicao';

export const metadata: Metadata = { title: 'Instituições' };

const SITUACAO = {
  preparacao: 'Em preparação',
  ativa: 'Ativa',
  suspensa: 'Suspensa',
} as const;
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
    const { armazenamento, inst } = await planilhasDaInstituicao(adm, aConferir);
    conferencia = await conferirInstituicao(adm.autorizador, armazenamento, inst, ESTRUTURA_DOS_MODULOS, adm.app.pastas);
  }
  const podePreparar =
    (conferencia?.planilhas.filter((x) => x.chave === 'nucleo' || x.chave === 'auditoria').every((x) => x.ok) ?? false) && (conferencia?.pasta?.ok ?? true);
  // Aviso "Estrutura desatualizada" na lista (suspensas ficam de fora).
  const avisos = new Map(
    await Promise.all(
      painel.instituicoes.filter((i) => i.situacao !== 'suspensa').map(async (i) => [i.id, await avisoDeEstrutura(adm, i)] as const),
    ),
  );
  const desatualizadas = [...avisos.values()].filter((a) => a.desatualizada).length;
  const contagem = (s: keyof typeof SITUACAO) => painel.instituicoes.filter((i) => i.situacao === s).length;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Instituições"
        descricao="As Apaes e entidades que usam o Elo. Cada uma acessa pelo próprio endereço, entra só com e-mails do próprio domínio e guarda os dados no próprio Drive."
        acoes={
          <div className="flex flex-wrap gap-2">
            {painel.instituicoes.some((i) => i.situacao !== 'suspensa') && (
              <FormularioConfirmado
                acao={acaoPrepararEstruturaDeTodas}
                rotulo="Preparar estrutura de todas"
                variante="secundario"
                pequeno
                perigoso={false}
                titulo="Preparar a estrutura de todas as instituições?"
                mensagem="Cria, nas planilhas de cada instituição ativa ou em preparação, as abas e os perfis que esta versão do Elo trouxe. Nada é apagado nem alterado. Use depois de cada atualização do Elo. Pode levar alguns segundos por instituição."
                confirmar="Preparar todas"
              />
            )}
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
          </div>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/rede" larga titulo={`Alterar ${emEdicao.nome}`}>
          <FormularioInstituicao acao={acaoSalvarInstituicao} planilhas={PLANILHAS_DA_INSTITUICAO} instituicao={emEdicao} />
        </JanelaFormulario>
      )}

      {aConferir && conferencia && (
        <section aria-label={`Conferência da ${aConferir.nome}`} className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Conferência: {aConferir.nome}</h2>
              <p className="text-sm text-texto-suave">Testa o acesso a cada planilha e a estrutura, sem ler dados e sem gravar nada.</p>
            </div>
            <LinkBotao href="/rede" variante="secundario" className={pequeno}>
              Fechar
            </LinkBotao>
          </div>
          {conferencia.pasta && (
            <p className="flex gap-2 text-sm">
              <span aria-hidden="true" className={conferencia.pasta.ok ? 'text-sucesso' : 'text-erro'}>
                {conferencia.pasta.ok ? '✓' : '✕'}
              </span>
              <span>{conferencia.pasta.mensagem}</span>
            </p>
          )}
          <ul className="space-y-1.5 text-sm">
            {conferencia.planilhas.map((x) => (
              <li key={x.chave} className="flex flex-wrap gap-2">
                <span aria-hidden="true" className={x.situacao === 'sera_criada' ? 'text-texto-suave' : x.ok ? 'text-sucesso' : 'text-erro'}>
                  {x.situacao === 'sera_criada' ? '○' : x.ok ? '✓' : '✕'}
                </span>
                <span>{x.mensagem}</span>
                {x.id && x.situacao === 'criada' && (
                  <a href={ENDERECO_DO_ARQUIVO(x.id, x.tipo ?? 'planilha')} target="_blank" rel="noreferrer" className="text-destaque hover:underline">
                    Abrir
                  </a>
                )}
              </li>
            ))}
          </ul>
          <Aviso tipo={ESTRUTURA[conferencia.estrutura].tipo} titulo={ESTRUTURA[conferencia.estrutura].titulo}>
            {conferencia.mensagemEstrutura}
          </Aviso>
          {podePreparar && (
            <form action={acaoPrepararEstrutura} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={aConferir.id} />
              <BotaoEnviar variante={conferencia.estrutura === 'em_dia' ? 'secundario' : 'primario'} className={pequeno} enviando="Preparando…">
                {aConferir.pasta && conferencia.estrutura !== 'em_dia' ? 'Tentar de novo' : 'Preparar estrutura'}
              </BotaoEnviar>
              <span className="text-sm text-texto-suave">
                {aConferir.pasta ? 'Cria na pasta o que falta (planilhas e pasta de anexos), as abas e ' : 'Cria as abas que faltam e '}a configuração inicial (unidades do
                cadastro, áreas, perfis e permissões). Nada é apagado, movido nem alterado.
              </span>
            </form>
          )}
          {aConferir.situacao === 'preparacao' && conferencia.estrutura === 'em_dia' && (
            <p className="text-sm">
              Tudo pronto: agora é só clicar em <strong>Ativar</strong> na linha da instituição.
            </p>
          )}
        </section>
      )}

      {painel.instituicoes.length === 0 ? (
        <Aviso tipo="info" titulo="Nenhuma instituição cadastrada ainda">
          Enquanto a rede estiver vazia, o Elo continua usando a instituição das variáveis da hospedagem. Cadastre a primeira com o botão acima e ative-a quando
          a conferência estiver em ordem.
        </Aviso>
      ) : (
        <>
          {desatualizadas > 0 && (
            <Aviso tipo="atencao" titulo={`Estrutura desatualizada em ${desatualizadas} ${desatualizadas === 1 ? 'instituição' : 'instituições'}`}>
              Falta planilha, pasta ou aba. Use <strong>Preparar estrutura de todas</strong> ou abra <strong>Conferir</strong> na instituição.
            </Aviso>
          )}
          <dl className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(SITUACAO) as (keyof typeof SITUACAO)[]).map((s) => (
              <div key={s} className="rounded-cartao border border-borda bg-superficie px-4 py-3">
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
              {
                chave: 'planilhas',
                rotulo: 'Planilhas',
                tipo: 'numero',
                secundaria: true,
              },
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
                    {avisos.get(i.id)?.desatualizada && (
                      <span className="mt-1 block">
                        <Etiqueta tipo="atencao">Estrutura desatualizada</Etiqueta>
                        <span className="block text-xs text-texto-suave">{avisos.get(i.id)?.faltas.join('; ')}</span>
                      </span>
                    )}
                  </>
                ),
                situacao: <Etiqueta tipo={COR[i.situacao]}>{SITUACAO[i.situacao]}</Etiqueta>,
                enderecos: i.enderecos.length ? (
                  <span className="text-sm">{i.enderecos.join(', ')}</span>
                ) : (
                  <span className="text-sm text-texto-suave">nenhum</span>
                ),
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
                        campos={{
                          id: i.id,
                          versao: i.versao,
                          situacao: 'suspensa',
                        }}
                        rotulo="Suspender"
                        variante="fantasma"
                        titulo={`Suspender ${i.nome}?`}
                        mensagem="Ninguém da instituição consegue entrar até você reativar. Os dados continuam no Drive dela; nada é apagado."
                        confirmar="Suspender"
                      />
                    ) : (
                      <FormularioConfirmado
                        acao={acaoMudarSituacao}
                        campos={{
                          id: i.id,
                          versao: i.versao,
                          situacao: 'ativa',
                        }}
                        rotulo="Ativar"
                        variante="fantasma"
                        perigoso={false}
                        titulo={`Ativar ${i.nome}?`}
                        mensagem={
                          i.situacao === 'preparacao'
                            ? 'Use Conferir e Preparar estrutura antes. Depois de ativar, a equipe entra pelo endereço da instituição.'
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

      <details className="rounded-cartao border border-borda bg-superficie px-5 py-4 text-sm">
        <summary className="cursor-pointer font-semibold">Como trazer uma instituição para o Elo</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Cadastre a instituição aqui (ela começa em preparação).</li>
          <li>A TI da instituição cria o endereço (ex.: elo.apaefranca.org.br) no DNS; a Operadora inclui o endereço na Netlify e no login do Google.</li>
          <li>A instituição cria um Drive compartilhado “Elo · nome da instituição”, inclui a conta de serviço como Gerente de conteúdo e envia o link da pasta.</li>
          <li>Cole o link da pasta ao cadastrar (ou em Alterar). Ao salvar, o Elo confere a pasta e cria sozinho as planilhas, a pasta de anexos e as abas.</li>
          <li>Se algo falhar, a tela mostra o motivo; corrija e clique em Tentar de novo na conferência.</li>
          <li>Com a estrutura em dia, clique em Ativar. O administrador inicial já entra pelo endereço da instituição com tudo pronto.</li>
          <li>Depois de cada atualização do Elo, use Preparar estrutura de todas.</li>
        </ol>
      </details>
    </div>
  );
}
