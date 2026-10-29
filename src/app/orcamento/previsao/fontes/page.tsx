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
import { NATUREZA, USO } from '@/modulos/orcamento/dominio/previsao';
import { acaoExcluirFonte, acaoReativarFonte, acaoSalvarFonte } from '../acoes';

export const metadata: Metadata = { title: 'Fontes de recurso' };
const pequeno = '!min-h-8 !px-3 !py-1 !text-sm';

export default async function FontesDeRecurso({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  const app = await obterAplicacao();
  const { fontes } = await listarCadastros(app.planilhas, usuario.autorizador);
  const emEdicao = editar ? fontes.ativos.find((g) => g.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Fontes de recurso' }]}
        titulo="Fontes de recurso"
        descricao="De onde vem o dinheiro de cada receita e o que paga cada despesa. A natureza (pública ou própria) e o uso (livre ou restrito) alimentam os indicadores. Projeto Incentivado conta como pública. O nome é único."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {fontes.ativos.length === 0 ? (
          <EstadoVazio titulo="Nenhuma fonte cadastrada">Cadastre as fontes ao lado. Depois, cada receita e cada despesa escolhe a sua fonte.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Fontes de recurso</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Fonte</th>
                  <th scope="col" className={tabela.th}>Natureza</th>
                  <th scope="col" className={tabela.th}>Uso</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Itens</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {fontes.ativos.map((g) => {
                  const n = fontes.uso[g.id] ?? 0;
                  return (
                    <tr key={g.id} className={`${tabela.linha} ${emEdicao?.id === g.id ? 'bg-destaque-suave' : ''}`}>
                      <td className={`${tabela.td} font-semibold`}>{g.nome}</td>
                      <td className={tabela.td}>{g.natureza === 'publica' ? <Etiqueta tipo="info">{NATUREZA.publica}</Etiqueta> : <Etiqueta>{NATUREZA.propria}</Etiqueta>}</td>
                      <td className={tabela.td}>{USO[g.uso]}</td>
                      <td className={`${tabela.td} ${tabela.numero}`}>{n || '—'}</td>
                      <td className={`${tabela.td} whitespace-nowrap text-right`}>
                        <div className="flex justify-end gap-2">
                          <LinkBotao href={`/orcamento/previsao/fontes?editar=${g.id}#t-form`} variante="secundario" className={pequeno} aria-label={`Alterar ${g.nome}`}>
                            Alterar
                          </LinkBotao>
                          <FormularioConfirmado
                            acao={acaoExcluirFonte}
                            campos={{ id: g.id, versao: g.versao }}
                            rotulo="Excluir"
                            variante="fantasma"
                            pequeno
                            titulo={`Excluir a fonte “${g.nome}”?`}
                            mensagem={
                              n > 0
                                ? `${n} ${n === 1 ? 'item do orçamento usa' : 'itens do orçamento usam'} esta fonte. Troque a fonte desses itens antes de excluir.`
                                : 'A fonte sai das listas. Ela não é apagada: fica em “Fontes excluídas” e pode ser reativada.'
                            }
                            confirmar="Excluir fonte"
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

        <Secao titulo={emEdicao ? 'Alterar fonte' : 'Adicionar fonte'} id="t-form" className="xl:sticky xl:top-6">
          <form action={acaoSalvarFonte} className="space-y-4" key={emEdicao?.id ?? 'novo'}>
            {emEdicao && (
              <>
                <input type="hidden" name="id" value={emEdicao.id} />
                <input type="hidden" name="versao" value={emEdicao.versao} />
              </>
            )}
            <Campo rotulo="Nome" obrigatorio dica="Não pode repetir o nome de outra fonte.">
              <input name="nome" required defaultValue={emEdicao?.nome} className={estiloEntrada} />
            </Campo>
            <fieldset className="text-sm">
              <legend className="font-semibold">Natureza</legend>
              <label className="mt-2 flex items-center gap-2">
                <input type="radio" name="natureza" value="publica" required defaultChecked={emEdicao?.natureza === 'publica'} /> Pública (governo, convênios, Projeto Incentivado)
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input type="radio" name="natureza" value="propria" defaultChecked={emEdicao?.natureza === 'propria'} /> Própria (doações, eventos, vendas)
              </label>
            </fieldset>
            <fieldset className="text-sm">
              <legend className="font-semibold">Uso</legend>
              <label className="mt-2 flex items-center gap-2">
                <input type="radio" name="uso" value="livre" required defaultChecked={emEdicao?.uso === 'livre'} /> Livre (pode pagar qualquer despesa)
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input type="radio" name="uso" value="restrita" defaultChecked={emEdicao?.uso === 'restrita'} /> Restrita (só o que o termo permite)
              </label>
            </fieldset>
            <div className="flex gap-2">
              <BotaoEnviar enviando="Salvando…" className="flex-1">
                {emEdicao ? 'Salvar alterações' : 'Adicionar fonte'}
              </BotaoEnviar>
              {emEdicao && (
                <LinkBotao href="/orcamento/previsao/fontes" variante="secundario">
                  Cancelar
                </LinkBotao>
              )}
            </div>
          </form>
        </Secao>
      </div>

      {fontes.excluidos.length > 0 && (
        <details className="mt-6 rounded-xl border border-borda bg-superficie">
          <summary className="cursor-pointer select-none px-5 py-4">
            <span className="font-bold">Fontes excluídas ({fontes.excluidos.length})</span>
            <span className="ml-2 text-sm text-texto-suave">Ficam guardadas e podem ser reativadas.</span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {fontes.excluidos.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="font-semibold">{g.nome}</span>
                <FormularioConfirmado
                  acao={acaoReativarFonte}
                  campos={{ id: g.id, versao: g.versao }}
                  rotulo="Reativar"
                  variante="secundario"
                  pequeno
                  perigoso={false}
                  titulo={`Reativar a fonte “${g.nome}”?`}
                  mensagem="A fonte volta a aparecer nas listas de receitas e despesas."
                  confirmar="Reativar fonte"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
