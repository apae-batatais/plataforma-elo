import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos, Unidades } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import {
  acaoCadastrarServico, acaoCadastrarServicosEmLote, acaoConferirServicosEmLote, acaoEditarServico, acaoExcluirServico, acaoReativarServico,
} from '../acoes';
import { CadastroEmLote } from './cadastro-em-lote';

export const metadata: Metadata = { title: 'Serviços' };

type Opcao = { codigo: string; nome: string };

function CamposServico({ areas, unidades, valor }: { areas: Opcao[]; unidades: Opcao[]; valor?: { nome: string; codigo: string; area: string | null; unidade: string; vagas: number | null } }) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio>
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      {valor ? (
        <Campo rotulo="Código" dica="O código não muda: ele liga o serviço à lotação da folha, aos perfis e aos atendidos.">
          <input value={valor.codigo} readOnly disabled className={estiloEntrada} />
        </Campo>
      ) : (
        <Campo rotulo="Código" obrigatorio dica="Minúsculas, sem espaços nem acentos. Ex.: centro_dia">
          <input name="codigo" required pattern="[a-z0-9_]+" className={estiloEntrada} />
        </Campo>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Área" obrigatorio dica={<>Falta uma? <a href="/admin/areas" className="underline">Cadastre em Áreas</a>.</>}>
          <select name="area" required defaultValue={valor?.area ?? ''} className={estiloEntrada}>
            <option value="" disabled>
              Escolha a área
            </option>
            {areas.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Unidade" obrigatorio>
          <select name="unidade" required defaultValue={valor?.unidade} className={estiloEntrada}>
            {unidades.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Vagas" dica="Opcional.">
        <input name="vagas" type="number" min="0" step="1" inputMode="numeric" defaultValue={valor?.vagas ?? ''} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function ServicosAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const [servicos, unidades, areas] = await lerTabelas(app.planilhas, [Servicos, Unidades, Areas] as const);
  const nomeUnidade = new Map(unidades.todos().map((u) => [u.codigo, u.nome]));
  const ativos = servicos.ativos();
  const areasAtivas = areas.ativos();
  const nomeArea = new Map(areasAtivas.map((a) => [a.codigo, a.nome]));
  const excluidos = servicos.todos().filter((s) => s.ativo === false);
  const emEdicao = editar ? ativos.find((s) => s.id === editar) : undefined;
  const opcoesAreas = areasAtivas.map((a) => ({ codigo: a.codigo, nome: a.nome }));
  const opcoesUnidades = unidades.ativos().map((u) => ({ codigo: u.codigo, nome: u.nome }));

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Serviços' }]}
        titulo="Serviços"
        descricao="Os serviços são os centros de custo da folha e organizam atendidos, equipes e perfis de acesso. Cada serviço pertence a uma área e a uma unidade."
        acoes={
          <>
            <JanelaFormulario
              rotulo="Cadastrar em lote"
              variante="fantasma"
              className={pequeno}
              larga
              titulo="Cadastrar vários serviços de uma vez"
              descricao="Cole uma lista copiada da planilha, confira e confirme."
            >
              <CadastroEmLote conferir={acaoConferirServicosEmLote} cadastrar={acaoCadastrarServicosEmLote} />
            </JanelaFormulario>
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Adicionar serviço
                </>
              }
              className={pequeno}
              titulo="Adicionar serviço"
            >
              <form action={acaoCadastrarServico} className="space-y-4">
                <CamposServico areas={opcoesAreas} unidades={opcoesUnidades} />
                <BotaoEnviar enviando="Cadastrando…" className="w-full">
                  Adicionar serviço
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          </>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/admin/servicos" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoEditarServico} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposServico areas={opcoesAreas} unidades={opcoesUnidades} valor={emEdicao} />
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      {ativos.length === 0 ? (
        <EstadoVazio titulo="Nenhum serviço cadastrado">Use “Adicionar serviço”, ou “Cadastrar em lote” para colar uma lista da planilha.</EstadoVazio>
      ) : (
        <TabelaDados
          legenda="Serviços"
          colunas={[
            { chave: 'nome', rotulo: 'Serviço' },
            { chave: 'codigo', rotulo: 'Código', secundaria: true },
            { chave: 'area', rotulo: 'Área' },
            { chave: 'unidade', rotulo: 'Unidade' },
            { chave: 'vagas', rotulo: 'Vagas', tipo: 'numero' },
            { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
          ]}
          linhas={ativos.map((s) => ({
            id: s.id,
            valores: {
              nome: s.nome,
              codigo: s.codigo,
              area: (s.area && nomeArea.get(s.area)) || 'Sem área',
              unidade: nomeUnidade.get(s.unidade) ?? s.unidade,
              vagas: s.vagas ?? null,
            },
            celulas: {
              nome: <span className="font-semibold">{s.nome}</span>,
              codigo: <span className="text-texto-suave">{s.codigo}</span>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/admin/servicos?editar=${s.id}`} scroll={false} variante="icone" aria-label={`Alterar ${s.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirServico}
                    campos={{ id: s.id, versao: s.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${s.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir “${s.nome}”?`}
                    mensagem="O serviço deixa de aparecer nas listas, na lotação da folha e nos perfis de acesso. Ele não é apagado: fica em “Serviços excluídos” e pode ser reativado. Se houver funcionários lotados nele, mude a lotação deles na folha."
                    confirmar="Excluir serviço"
                  />
                </div>
              ),
            },
          }))}
        />
      )}

      {excluidos.length > 0 && (
        <details className="mt-6 rounded-xl border border-borda bg-superficie">
          <summary className="cursor-pointer select-none px-5 py-3 text-sm">
            <span className="font-semibold">Serviços excluídos ({excluidos.length})</span>
            <span className="ml-2 text-texto-suave">Ficam guardados e podem ser reativados.</span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {excluidos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{s.nome}</span>
                  <span className="ml-2 text-xs text-texto-suave">
                    {s.codigo}
                    {s.fim ? ` · excluído em ${s.fim.split('-').reverse().join('/')}` : ''}
                  </span>
                </span>
                <FormularioConfirmado
                  acao={acaoReativarServico}
                  campos={{ id: s.id, versao: s.versao }}
                  rotulo="Reativar"
                  variante="fantasma"
                  pequeno
                  perigoso={false}
                  titulo={`Reativar “${s.nome}”?`}
                  mensagem="O serviço volta a aparecer nas listas, na lotação da folha e nos perfis de acesso."
                  confirmar="Reativar serviço"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
