import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { avaliacoesParaLigar } from '@/modulos/avaliacao/aplicacao/ligacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, tabela } from '@/ui/pagina';
import { acaoConfirmarLigacao } from '../acoes';

export const metadata: Metadata = { title: 'Ligar avaliações antigas' };

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function LigarAvaliacoes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const lista = await avaliacoesParaLigar(app.planilhas, usuario.autorizador);
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Assistência Social', href: '/avaliacao' }, { rotulo: 'Ligar avaliações antigas' }]}
        titulo="Ligar avaliações antigas"
        descricao="As avaliações feitas só por iniciais podem ser ligadas à pessoa do Cadastro Único. Confira cada uma e confirme: a avaliação original não muda, e o comparativo passa a usar a pessoa cadastrada."
      />
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação para ligar.">Todas as avaliações dos serviços em que você avalia já estão ligadas a uma pessoa.</EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Avaliações sem ligação com o Cadastro Único</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Avaliação</th>
                <th scope="col" className={tabela.th}>Serviço</th>
                <th scope="col" className={tabela.th}>Pessoa do Cadastro Único</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className={tabela.linha}>
                  <td className={tabela.td}>
                    <b>{a.iniciais}</b> · {br(a.nascimento)} · {a.sexo}
                    <span className="block text-xs text-texto-suave">de {br(a.dataAvaliacao)}</span>
                  </td>
                  <td className={tabela.td}>{a.servicoNome}</td>
                  <td className={tabela.td}>
                    <form action={acaoConfirmarLigacao} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="avaliacao" value={a.id} />
                      <label className="block text-sm">
                        <span className="sr-only">Pessoa para a avaliação {a.iniciais} de {br(a.dataAvaliacao)}</span>
                        <select name="pessoa" defaultValue={a.sugerida ?? ''} required className={`${estiloEntrada} mt-0 w-64`}>
                          <option value="">{a.candidatas.length ? 'Escolha a pessoa' : 'Nenhuma pessoa neste serviço'}</option>
                          {a.candidatas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome} ({c.iniciais}){c.combina ? ' · iniciais iguais' : ''}
                            </option>
                          ))}
                        </select>
                        {a.sugerida && <span className="block text-xs text-texto-suave">Sugerida: iniciais e nascimento conferem.</span>}
                      </label>
                      <button type="submit" disabled={!a.candidatas.length} className="min-h-10 rounded-md border border-borda-forte px-4 font-semibold hover:border-texto-suave disabled:opacity-50">
                        Confirmar ligação
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
