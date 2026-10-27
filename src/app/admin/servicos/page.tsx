import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos, Unidades } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, Secao, tabela } from '@/ui/pagina';
import { acaoCadastrarServico } from '../acoes';

export const metadata: Metadata = { title: 'Serviços' };

export default async function ServicosAdmin() {
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

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Serviços' }]}
        titulo="Serviços"
        descricao="Os serviços organizam atendidos, equipes e perfis de acesso. Cada serviço pertence a uma área e a uma unidade."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {ativos.length === 0 ? (
            <EstadoVazio titulo="Nenhum serviço cadastrado">Cadastre os serviços ao lado para poder dar perfis por serviço e vincular atendidos.</EstadoVazio>
          ) : (
            <div className={tabela.moldura}>
              <table className={tabela.tabela}>
                <caption className="sr-only">Serviços por área</caption>
                <thead className={tabela.cabeca}>
                  <tr>
                    <th scope="col" className={tabela.th}>Serviço</th>
                    <th scope="col" className={tabela.th}>Unidade</th>
                    <th scope="col" className={`${tabela.th} text-right`}>Vagas</th>
                  </tr>
                </thead>
                {[...porArea, ...(semArea.length ? [{ area: { codigo: '', nome: 'Sem área' }, lista: semArea }] : [])].map((g) => (
                  <tbody key={g.area.codigo}>
                    <tr className="border-b border-borda bg-destaque-suave/60">
                      <th scope="rowgroup" colSpan={3} className="px-4 py-2 text-sm font-bold">
                        {g.area.nome}
                      </th>
                    </tr>
                    {g.lista.map((s) => (
                      <tr key={s.id} className={tabela.linha}>
                        <td className={tabela.td}>
                          <span className="font-semibold">{s.nome}</span>
                          <span className="block text-xs text-texto-suave">Código: {s.codigo}</span>
                        </td>
                        <td className={tabela.td}>{nomeUnidade.get(s.unidade) ?? s.unidade}</td>
                        <td className={`${tabela.td} ${tabela.numero}`}>{s.vagas ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </div>

        <Secao titulo="Cadastrar serviço" id="t-novo" className="xl:sticky xl:top-6">
          <form action={acaoCadastrarServico} className="space-y-4">
            <Campo rotulo="Nome" obrigatorio>
              <input name="nome" required className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Código" obrigatorio dica="Minúsculas, sem espaços nem acentos. Ex.: centro_dia">
              <input name="codigo" required pattern="[a-z0-9_]+" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Área" obrigatorio>
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
      </div>
    </div>
  );
}
