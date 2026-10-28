import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCadastros } from '@/modulos/orcamento/aplicacao/previsao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { acaoExcluirGrupo, acaoReativarGrupo, acaoSalvarGrupo } from '../acoes';

export const metadata: Metadata = { title: 'Grupos de gasto' };
const pequeno = '!min-h-8 !px-3 !py-1 !text-sm';

export default async function Grupos({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { grupos } = await listarCadastros(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? grupos.ativos.find((g) => g.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Grupos de gasto' }]}
        titulo="Grupos de gasto"
        descricao="Classificam as despesas (ex.: Material de consumo, Alimentação). Marque como Recursos Humanos os grupos que somam no indicador da folha, como RPA e rescisões. O nome é único."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {grupos.ativos.length === 0 ? (
          <EstadoVazio titulo="Nenhum grupo cadastrado">Cadastre os grupos ao lado. Depois, cada despesa escolhe o seu grupo.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Grupos de gasto</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Grupo</th>
                  <th scope="col" className={tabela.th}>Tipo</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Itens</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {grupos.ativos.map((g) => {
                  const n = grupos.uso[g.id] ?? 0;
                  return (
                    <tr key={g.id} className={`${tabela.linha} ${emEdicao?.id === g.id ? 'bg-destaque-suave' : ''}`}>
                      <td className={`${tabela.td} font-semibold`}>{g.nome}</td>
                      <td className={tabela.td}>{g.rh ? <Etiqueta tipo="info">Recursos Humanos</Etiqueta> : <span className="text-texto-suave">Despesa geral</span>}</td>
                      <td className={`${tabela.td} ${tabela.numero}`}>{n || '—'}</td>
                      <td className={`${tabela.td} whitespace-nowrap text-right`}>
                        <div className="flex justify-end gap-2">
                          <LinkBotao href={`/orcamento/previsao/grupos?editar=${g.id}#t-form`} variante="secundario" className={pequeno} aria-label={`Alterar ${g.nome}`}>
                            Alterar
                          </LinkBotao>
                          <FormularioConfirmado
                            acao={acaoExcluirGrupo}
                            campos={{ id: g.id, versao: g.versao }}
                            rotulo="Excluir"
                            variante="fantasma"
                            pequeno
                            titulo={`Excluir o grupo “${g.nome}”?`}
                            mensagem={
                              n > 0
                                ? `${n} ${n === 1 ? 'item do orçamento usa' : 'itens do orçamento usam'} este grupo. Troque o grupo desses itens antes de excluir.`
                                : 'O grupo sai das listas. Ele não é apagado: fica em “Grupos excluídos” e pode ser reativado.'
                            }
                            confirmar="Excluir grupo"
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

        <Secao titulo={emEdicao ? 'Alterar grupo' : 'Adicionar grupo'} id="t-form" className="xl:sticky xl:top-6">
          <form action={acaoSalvarGrupo} className="space-y-4" key={emEdicao?.id ?? 'novo'}>
            {emEdicao && (
              <>
                <input type="hidden" name="id" value={emEdicao.id} />
                <input type="hidden" name="versao" value={emEdicao.versao} />
              </>
            )}
            <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outro grupo.">
              <input name="nome" required defaultValue={emEdicao?.nome} className={estiloEntrada} />
            </Campo>
            <fieldset className="text-sm">
              <legend className="font-semibold">Tipo</legend>
              <label className="mt-2 flex items-center gap-2">
                <input type="radio" name="rh" value="nao" defaultChecked={!emEdicao?.rh} /> Despesa geral
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input type="radio" name="rh" value="sim" defaultChecked={emEdicao?.rh} /> Recursos Humanos (fora da folha)
              </label>
            </fieldset>
            <div className="flex gap-2">
              <BotaoEnviar enviando="Salvando…" className="flex-1">
                {emEdicao ? 'Salvar alterações' : 'Adicionar grupo'}
              </BotaoEnviar>
              {emEdicao && (
                <LinkBotao href="/orcamento/previsao/grupos" variante="secundario">
                  Cancelar
                </LinkBotao>
              )}
            </div>
          </form>
        </Secao>
      </div>

      {grupos.excluidos.length > 0 && (
        <details className="mt-6 rounded-xl border border-borda bg-superficie">
          <summary className="cursor-pointer select-none px-5 py-4">
            <span className="font-bold">Grupos excluídos ({grupos.excluidos.length})</span>
            <span className="ml-2 text-sm text-texto-suave">Ficam guardados e podem ser reativados.</span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {grupos.excluidos.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="font-semibold">{g.nome}</span>
                <FormularioConfirmado
                  acao={acaoReativarGrupo}
                  campos={{ id: g.id, versao: g.versao }}
                  rotulo="Reativar"
                  variante="secundario"
                  pequeno
                  perigoso={false}
                  titulo={`Reativar o grupo “${g.nome}”?`}
                  mensagem="O grupo volta a aparecer na lista das despesas."
                  confirmar="Reativar grupo"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
