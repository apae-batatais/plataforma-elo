import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos, Unidades } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao, tabela } from '@/ui/pagina';
import {
  acaoCadastrarServico, acaoCadastrarServicosEmLote, acaoConferirServicosEmLote, acaoEditarServico, acaoExcluirServico, acaoReativarServico,
} from '../acoes';
import { CadastroEmLote } from './cadastro-em-lote';

export const metadata: Metadata = { title: 'Serviços' };

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
  const porArea = areas
    .ativos()
    .map((a) => ({ area: a, lista: ativos.filter((s) => s.area === a.codigo) }))
    .filter((g) => g.lista.length > 0);
  const semArea = ativos.filter((s) => !s.area || !areas.ativos().some((a) => a.codigo === s.area));
  const excluidos = servicos.todos().filter((s) => s.ativo === false);
  const emEdicao = editar ? ativos.find((s) => s.id === editar) : undefined;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Serviços' }]}
        titulo="Serviços"
        descricao="Os serviços são os centros de custo da folha e organizam atendidos, equipes e perfis de acesso. Cada serviço pertence a uma área e a uma unidade."
      />

      <details className="mb-6 rounded-xl border border-borda bg-superficie" open={ativos.length === 0}>
        <summary className="cursor-pointer select-none px-5 py-4">
          <span className="text-lg font-bold">Cadastrar vários de uma vez</span>
          <span className="ml-2 text-sm text-texto-suave">Cole uma lista copiada da planilha, confira e confirme.</span>
        </summary>
        <div className="border-t border-borda p-5">
          <CadastroEmLote conferir={acaoConferirServicosEmLote} cadastrar={acaoCadastrarServicosEmLote} />
        </div>
      </details>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {ativos.length === 0 ? (
            <EstadoVazio titulo="Nenhum serviço cadastrado">Cadastre os serviços (um a um ao lado, ou vários de uma vez acima) para usar na lotação da folha, nos perfis de acesso e no vínculo de atendidos.</EstadoVazio>
          ) : (
            <div className={tabela.moldura}>
              <table className={tabela.tabela}>
                <caption className="sr-only">Serviços por área</caption>
                <thead className={tabela.cabeca}>
                  <tr>
                    <th scope="col" className={tabela.th}>Serviço</th>
                    <th scope="col" className={tabela.th}>Unidade</th>
                    <th scope="col" className={`${tabela.th} text-right`}>Vagas</th>
                    <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                {[...porArea, ...(semArea.length ? [{ area: { codigo: '', nome: 'Sem área' }, lista: semArea }] : [])].map((g) => (
                  <tbody key={g.area.codigo}>
                    <tr className="border-b border-borda bg-destaque-suave/60">
                      <th scope="rowgroup" colSpan={4} className="px-4 py-2 text-sm font-bold">
                        {g.area.nome}
                      </th>
                    </tr>
                    {g.lista.map((s) => (
                      <tr key={s.id} className={`${tabela.linha} ${emEdicao?.id === s.id ? 'bg-destaque-suave' : ''}`}>
                        <td className={tabela.td}>
                          <span className="font-semibold">{s.nome}</span>
                          <span className="block text-xs text-texto-suave">Código: {s.codigo}</span>
                        </td>
                        <td className={tabela.td}>{nomeUnidade.get(s.unidade) ?? s.unidade}</td>
                        <td className={`${tabela.td} ${tabela.numero}`}>{s.vagas ?? '—'}</td>
                        <td className={`${tabela.td} whitespace-nowrap text-right`}>
                          <div className="flex justify-end gap-2">
                            <LinkBotao
                              href={`/admin/servicos?editar=${s.id}#t-novo`}
                              variante="secundario"
                              className="!min-h-8 !px-3 !py-1 !text-sm"
                              aria-label={`Editar ${s.nome}`}
                            >
                              Editar
                            </LinkBotao>
                            <FormularioConfirmado
                              acao={acaoExcluirServico}
                              campos={{ id: s.id, versao: s.versao }}
                              rotulo="Excluir"
                              variante="fantasma"
                              pequeno
                              titulo={`Excluir “${s.nome}”?`}
                              mensagem={
                                <>
                                  O serviço deixa de aparecer nas listas, na lotação da folha e nos perfis de acesso. Ele não é apagado:
                                  fica em “Serviços excluídos”, no fim da página, e pode ser reativado. Se houver funcionários lotados nele,
                                  mude a lotação deles na folha.
                                </>
                              }
                              confirmar="Excluir serviço"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </div>

        {emEdicao ? (
          <Secao titulo="Editar serviço" id="t-novo" className="xl:sticky xl:top-6">
            <form action={acaoEditarServico} className="space-y-4">
              <input type="hidden" name="id" value={emEdicao.id} />
              <input type="hidden" name="versao" value={emEdicao.versao} />
              <Campo rotulo="Nome" obrigatorio>
                <input name="nome" required defaultValue={emEdicao.nome} className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Código" dica="O código não muda: ele liga o serviço à lotação da folha, aos perfis e aos atendidos.">
                <input value={emEdicao.codigo} readOnly disabled className={`${estiloEntrada} bg-superficie-2`} />
              </Campo>
              <Campo rotulo="Área" obrigatorio>
                <select name="area" required defaultValue={emEdicao.area ?? ''} className={estiloEntrada}>
                  <option value="" disabled>
                    Escolha a área
                  </option>
                  {areas.ativos().map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Unidade" obrigatorio>
                <select name="unidade" required defaultValue={emEdicao.unidade} className={estiloEntrada}>
                  {unidades.ativos().map((u) => (
                    <option key={u.codigo} value={u.codigo}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vagas" dica="Opcional.">
                <input name="vagas" type="number" min="0" step="1" inputMode="numeric" defaultValue={emEdicao.vagas ?? ''} className={estiloEntrada} />
              </Campo>
              <div className="flex gap-2">
                <BotaoEnviar enviando="Salvando…" className="flex-1">
                  Salvar alterações
                </BotaoEnviar>
                <LinkBotao href="/admin/servicos" variante="secundario">
                  Cancelar
                </LinkBotao>
              </div>
            </form>
          </Secao>
        ) : (
          <Secao titulo="Cadastrar serviço" id="t-novo" className="xl:sticky xl:top-6">
            <form action={acaoCadastrarServico} className="space-y-4">
              <Campo rotulo="Nome" obrigatorio>
                <input name="nome" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Código" obrigatorio dica="Minúsculas, sem espaços nem acentos. Ex.: centro_dia">
                <input name="codigo" required pattern="[a-z0-9_]+" className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Área" obrigatorio dica={<>Falta uma área? Cadastre em <a href="/admin/areas" className="underline">Áreas</a>.</>}>
                <select name="area" required defaultValue="" className={estiloEntrada}>
                  <option value="" disabled>
                    Escolha a área
                  </option>
                  {areas.ativos().map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Unidade" obrigatorio>
                <select name="unidade" required className={estiloEntrada}>
                  {unidades.ativos().map((u) => (
                    <option key={u.codigo} value={u.codigo}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vagas" dica="Opcional.">
                <input name="vagas" type="number" min="0" step="1" inputMode="numeric" className={estiloEntrada} />
              </Campo>
              <BotaoEnviar enviando="Cadastrando…" className="w-full">
                Cadastrar serviço
              </BotaoEnviar>
            </form>
          </Secao>
        )}
      </div>

      {excluidos.length > 0 && (
        <details className="mt-6 rounded-xl border border-borda bg-superficie">
          <summary className="cursor-pointer select-none px-5 py-4">
            <span className="font-bold">Serviços excluídos ({excluidos.length})</span>
            <span className="ml-2 text-sm text-texto-suave">Ficam guardados e podem ser reativados.</span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {excluidos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-semibold">{s.nome}</span>
                  <span className="block text-xs text-texto-suave">
                    Código: {s.codigo}
                    {s.fim ? ` · excluído em ${s.fim.split('-').reverse().join('/')}` : ''}
                  </span>
                </div>
                <FormularioConfirmado
                  acao={acaoReativarServico}
                  campos={{ id: s.id, versao: s.versao }}
                  rotulo="Reativar"
                  variante="secundario"
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
