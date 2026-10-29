import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { Excluidos } from '@/ui/excluidos';
import { acaoCadastrarArea, acaoEditarArea, acaoExcluirArea, acaoReativarArea } from '../acoes';

export const metadata: Metadata = { title: 'Áreas' };

export default async function AreasAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const [areas, servicos] = await lerTabelas(app.planilhas, [Areas, Servicos] as const);
  const ativas = areas.ativos();
  const qtd = (codigo: string) => servicos.ativos().filter((s) => s.area === codigo).length;
  const emEdicao = editar ? ativas.find((a) => a.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Áreas' }]}
        titulo="Áreas"
        descricao="As áreas agrupam os serviços (centros de custo) no orçamento e nos perfis de acesso. O nome de cada área é único."
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar área
              </>
            }
            className={pequeno}
            titulo="Adicionar área"
          >
            <form action={acaoCadastrarArea} className="space-y-4">
              <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra área (nem com acento ou maiúscula diferente).">
                <input name="nome" required className={estiloEntrada} />
              </Campo>
              <BotaoEnviar enviando="Cadastrando…" className="w-full">
                Adicionar área
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/admin/areas" titulo={`Alterar “${emEdicao.nome}”`}>
          <form action={acaoEditarArea} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra área.">
              <input name="nome" required defaultValue={emEdicao.nome} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Áreas"
        vazio="Nenhuma área cadastrada. Use “Adicionar área”."
        colunas={[
          { chave: 'nome', rotulo: 'Área' },
          { chave: 'codigo', rotulo: 'Código', secundaria: true },
          { chave: 'servicos', rotulo: 'Serviços', tipo: 'numero' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={ativas.map((a) => {
          const n = qtd(a.codigo);
          return {
            id: a.id,
            valores: { nome: a.nome, codigo: a.codigo, servicos: n },
            celulas: {
              nome: <span className="font-semibold">{a.nome}</span>,
              codigo: <span className="text-texto-suave">{a.codigo}</span>,
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao href={`/admin/areas?editar=${a.id}`} scroll={false} variante="icone" aria-label={`Alterar ${a.nome}`} title="Alterar">
                    <IconeEditar tamanho={16} />
                  </LinkBotao>
                  <FormularioConfirmado
                    acao={acaoExcluirArea}
                    campos={{ id: a.id, versao: a.versao }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Excluir ${a.nome}`}
                    variante="icone-perigo"
                    titulo={`Excluir a área “${a.nome}”?`}
                    mensagem={
                      n > 0
                        ? `Esta área tem ${n} ${n === 1 ? 'serviço' : 'serviços'}. Mude a área ${n === 1 ? 'dele' : 'deles'} em Serviços antes de excluir.`
                        : 'A área deixa de aparecer nas listas. Ela não é apagada: fica em “Áreas excluídas” e pode ser reativada.'
                    }
                    confirmar="Excluir área"
                  />
                </div>
              ),
            },
          };
        })}
      />

      <Excluidos
        titulo="Áreas excluídas"
        itens={areas.todos().filter((a) => a.ativo === false).map((a) => ({ id: a.id, versao: a.versao, nome: a.nome, detalhe: a.codigo }))}
        acao={acaoReativarArea}
        mensagem="A área volta a aparecer nas listas de Serviços e de Acessos."
      />
    </div>
  );
}
