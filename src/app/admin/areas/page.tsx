import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao, tabela } from '@/ui/pagina';
import { acaoCadastrarArea, acaoEditarArea, acaoExcluirArea, acaoReativarArea } from '../acoes';

export const metadata: Metadata = { title: 'Áreas' };

const botaoPequeno = '!min-h-8 !px-3 !py-1 !text-sm';

export default async function AreasAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const [areas, servicos] = await lerTabelas(app.planilhas, [Areas, Servicos] as const);
  const ativas = areas.ativos().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const excluidas = areas.todos().filter((a) => a.ativo === false);
  const qtdServicos = (codigo: string) => servicos.ativos().filter((s) => s.area === codigo).length;
  const emEdicao = editar ? ativas.find((a) => a.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Áreas' }]}
        titulo="Áreas"
        descricao="As áreas agrupam os serviços (centros de custo) no resumo da folha e nos perfis de acesso. O nome de cada área é único."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {ativas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma área cadastrada">Cadastre as áreas ao lado. Depois, ligue cada serviço a uma área.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Áreas cadastradas</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Área</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Serviços</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {ativas.map((a) => {
                  const n = qtdServicos(a.codigo);
                  return (
                    <tr key={a.id} className={`${tabela.linha} ${emEdicao?.id === a.id ? 'bg-destaque-suave' : ''}`}>
                      <td className={tabela.td}>
                        <span className="font-semibold">{a.nome}</span>
                        <span className="block text-xs text-texto-suave">Código: {a.codigo}</span>
                      </td>
                      <td className={`${tabela.td} ${tabela.numero}`}>
                        {n > 0 ? (
                          <Link href="/admin/servicos" className="underline decoration-borda-forte underline-offset-2 hover:decoration-current">
                            {n}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`${tabela.td} whitespace-nowrap text-right`}>
                        <div className="flex justify-end gap-2">
                          <LinkBotao href={`/admin/areas?editar=${a.id}#t-area`} variante="secundario" className={botaoPequeno} aria-label={`Editar ${a.nome}`}>
                            Editar
                          </LinkBotao>
                          <FormularioConfirmado
                            acao={acaoExcluirArea}
                            campos={{ id: a.id, versao: a.versao }}
                            rotulo="Excluir"
                            variante="fantasma"
                            pequeno
                            titulo={`Excluir a área “${a.nome}”?`}
                            mensagem={
                              n > 0
                                ? `Esta área tem ${n} ${n === 1 ? 'serviço' : 'serviços'}. Mude a área ${n === 1 ? 'dele' : 'deles'} em Serviços antes de excluir.`
                                : 'A área deixa de aparecer nas listas. Ela não é apagada: fica em “Áreas excluídas”, no fim da página, e pode ser reativada.'
                            }
                            confirmar="Excluir área"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {emEdicao ? (
          <Secao titulo="Editar área" id="t-area" className="xl:sticky xl:top-6">
            <form action={acaoEditarArea} className="space-y-4">
              <input type="hidden" name="id" value={emEdicao.id} />
              <input type="hidden" name="versao" value={emEdicao.versao} />
              <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra área.">
                <input name="nome" required defaultValue={emEdicao.nome} className={estiloEntrada} />
              </Campo>
              <div className="flex gap-2">
                <BotaoEnviar enviando="Salvando…" className="flex-1">
                  Salvar alterações
                </BotaoEnviar>
                <LinkBotao href="/admin/areas" variante="secundario">
                  Cancelar
                </LinkBotao>
              </div>
            </form>
          </Secao>
        ) : (
          <Secao titulo="Cadastrar área" id="t-area" className="xl:sticky xl:top-6">
            <form action={acaoCadastrarArea} className="space-y-4">
              <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra área (nem com acento ou maiúscula diferente).">
                <input name="nome" required className={estiloEntrada} />
              </Campo>
              <BotaoEnviar enviando="Cadastrando…" className="w-full">
                Cadastrar área
              </BotaoEnviar>
            </form>
          </Secao>
        )}
      </div>

      {excluidas.length > 0 && (
        <details className="mt-6 rounded-xl border border-borda bg-superficie">
          <summary className="cursor-pointer select-none px-5 py-4">
            <span className="font-bold">Áreas excluídas ({excluidas.length})</span>
            <span className="ml-2 text-sm text-texto-suave">Ficam guardadas e podem ser reativadas.</span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {excluidas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-semibold">{a.nome}</span>
                  <span className="block text-xs text-texto-suave">Código: {a.codigo}</span>
                </div>
                <FormularioConfirmado
                  acao={acaoReativarArea}
                  campos={{ id: a.id, versao: a.versao }}
                  rotulo="Reativar"
                  variante="secundario"
                  pequeno
                  perigoso={false}
                  titulo={`Reativar a área “${a.nome}”?`}
                  mensagem="A área volta a aparecer nas listas de Serviços e de Acessos."
                  confirmar="Reativar área"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
