import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarTipos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { EscolhaLista } from '@/modulos/requisicoes/telas/escolha-lista';
import { catalogoOrcamento } from '@/plataforma/catalogos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirTipo, acaoReativarTipo, acaoSalvarExpediente, acaoSalvarTipo } from '../acoes';

export const metadata: Metadata = { title: 'Tipos de requisição' };

type Tipo = {
  nome: string;
  categoria: string;
  perfil_responsavel: string;
  prazo_aprovacao: number;
  prazo_atendimento: number;
  descricao: string | null;
  listaAreas: string[];
  listaGrupos: string[];
};
type Opcoes = { perfis: { codigo: string; nome: string }[]; areas: { codigo: string; nome: string }[]; grupos: { id: string; nome: string }[] };

function CamposTipo({ opcoes: { perfis, areas, grupos }, valor }: { opcoes: Opcoes; valor?: Tipo }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Ex.: Higiene e limpeza, Material pedagógico.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Descrição" dica="Ajuda quem pede a escolher o tipo certo.">
        <input name="descricao" defaultValue={valor?.descricao ?? ''} className={estiloEntrada} />
      </Campo>
      <input type="hidden" name="categoria" value="material" />
      <Campo rotulo="Setor que recebe e atende" obrigatorio dica="Quem tem este perfil vê a requisição na fila depois de aprovada.">
        <select name="perfil" required defaultValue={valor?.perfil_responsavel ?? perfis[0]?.codigo} className={estiloEntrada}>
          {perfis.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Prazo de aprovação" obrigatorio dica="Em horas úteis. Um dia útil = horas do expediente.">
          <input name="prazo_aprovacao" inputMode="decimal" required defaultValue={valor?.prazo_aprovacao ?? 8} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Prazo de atendimento" obrigatorio dica="Em horas úteis, contadas da aprovação.">
          <input name="prazo_atendimento" inputMode="decimal" required defaultValue={valor?.prazo_atendimento ?? 16} className={estiloEntrada} />
        </Campo>
      </div>
      <EscolhaLista
        legenda="Áreas que podem usar"
        nome="areas"
        campoTodas="todas_areas"
        rotuloTodas="Todas as áreas"
        opcoes={areas.map((a) => ({ valor: a.codigo, rotulo: a.nome }))}
        marcados={valor?.listaAreas ?? []}
      />
      <EscolhaLista
        legenda="Grupos de despesa aceitos"
        nome="grupos"
        campoTodas="todos_grupos"
        rotuloTodas="Todos os grupos do orçamento"
        opcoes={grupos.map((g) => ({ valor: g.id, rotulo: g.nome }))}
        marcados={valor?.listaGrupos ?? []}
      />
    </>
  );
}

export default async function TiposDeRequisicao({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('requisicoes.tipos.gerenciar')) redirect('/requisicoes');
  const app = await obterAplicacao();
  const t = await listarTipos(app.planilhas, usuario.autorizador, catalogoOrcamento(app.planilhas));
  const emEdicao = editar ? t.ativos.find((x) => x.id === editar) : undefined;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Tipos de requisição' }]}
        titulo="Tipos de requisição"
        descricao="Cada tipo diz qual setor atende, os prazos do SLA, quais áreas e grupos de despesa podem usá-lo e quais itens aceita. Só a Administração da plataforma cria e altera os tipos."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar tipo
              </>
            }
            className={pequeno}
            titulo="Adicionar tipo de requisição"
          >
            <form action={acaoSalvarTipo} className="space-y-4">
              <CamposTipo opcoes={t} />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Adicionar tipo
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {t.perfis.length === 0 && (
        <Aviso tipo="atencao" titulo="Nenhum setor pode atender ainda">
          Rode Preparar estrutura para criar o perfil Almoxarifado e atribua esse perfil às pessoas do setor em Administração › Acessos.
        </Aviso>
      )}

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/requisicoes/tipos" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoSalvarTipo} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposTipo opcoes={t} valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Tipos de requisição"
        vazio="Nenhum tipo cadastrado. Use “Adicionar tipo”."
        colunas={[
          { chave: 'nome', rotulo: 'Tipo' },
          { chave: 'setor', rotulo: 'Setor que atende' },
          { chave: 'aprovacao', rotulo: 'Prazo de aprovação', tipo: 'numero' },
          { chave: 'atendimento', rotulo: 'Prazo de atendimento', tipo: 'numero' },
          { chave: 'quem', rotulo: 'Áreas e grupos' },
          { chave: 'itens', rotulo: 'Itens aceitos', tipo: 'numero' },
          { chave: 'uso', rotulo: 'Requisições', tipo: 'numero', secundaria: true },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={t.ativos.map((x) => ({
          id: x.id,
          valores: {
            nome: x.nome,
            setor: x.perfilNome,
            aprovacao: x.prazo_aprovacao,
            atendimento: x.prazo_atendimento,
            quem: [...x.nomesAreas, ...x.nomesGrupos].join(', ') || 'Todos',
            itens: x.itensAceitos,
            uso: x.requisicoes,
          },
          celulas: {
            nome: (
              <>
                <span className="font-semibold">{x.nome}</span>
                {x.descricao && <span className="block text-xs text-texto-suave">{x.descricao}</span>}
              </>
            ),
            setor: <Etiqueta tipo="info">{x.perfilNome}</Etiqueta>,
            aprovacao: <span className="tabular-nums">{x.prazo_aprovacao.toLocaleString('pt-BR')} h úteis</span>,
            atendimento: <span className="tabular-nums">{x.prazo_atendimento.toLocaleString('pt-BR')} h úteis</span>,
            quem: (
              <span className="text-sm">
                <span className="block">
                  <span className="text-texto-suave">Áreas:</span> {x.nomesAreas.length ? x.nomesAreas.join(', ') : 'todas'}
                </span>
                <span className="block">
                  <span className="text-texto-suave">Grupos:</span> {x.nomesGrupos.length ? x.nomesGrupos.join(', ') : 'todos'}
                </span>
              </span>
            ),
            itens: (
              <Link href={`/requisicoes/tipos/${x.id}`} className="font-semibold text-destaque hover:underline">
                {x.itensAceitos ? `${x.itensAceitos} ${x.itensAceitos === 1 ? 'item' : 'itens'}` : 'Livre: cadastrar lista'}
              </Link>
            ),
            acoes: (
              <div className="flex justify-end gap-1">
                <LinkBotao href={`/requisicoes/tipos?editar=${x.id}`} scroll={false} variante="icone" aria-label={`Alterar ${x.nome}`} title="Alterar">
                  <IconeEditar tamanho={16} />
                </LinkBotao>
                <FormularioConfirmado
                  acao={acaoExcluirTipo}
                  campos={{ id: x.id, versao: x.versao }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Excluir ${x.nome}`}
                  variante="icone-perigo"
                  titulo={`Excluir o tipo “${x.nome}”?`}
                  mensagem="Ninguém mais consegue abrir requisição deste tipo. As que já existem continuam e podem ser atendidas. O tipo fica em “Tipos excluídos”."
                  confirmar="Excluir tipo"
                />
              </div>
            ),
          },
        }))}
      />

      <Excluidos
        titulo="Tipos excluídos"
        itens={t.excluidos.map((x) => ({ id: x.id, versao: x.versao, nome: x.nome }))}
        acao={acaoReativarTipo}
        mensagem="O tipo volta a aparecer para quem faz requisições."
      />

      <Secao
        titulo="Expediente para o SLA"
        descricao="Os prazos contam só de segunda a sexta, dentro deste horário (horário de Brasília). Feriados ainda contam como dia útil."
        id="t-expediente"
      >
        <form action={acaoSalvarExpediente} className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Início (hora)">
            <input name="inicio" type="number" min={0} max={23} defaultValue={t.expediente.inicio} className={`${estiloEntrada} w-28`} />
          </Campo>
          <Campo rotulo="Fim (hora)">
            <input name="fim" type="number" min={1} max={24} defaultValue={t.expediente.fim} className={`${estiloEntrada} w-28`} />
          </Campo>
          <BotaoEnviar variante="secundario" enviando="Salvando…">
            Salvar expediente
          </BotaoEnviar>
        </form>
      </Secao>
    </div>
  );
}
