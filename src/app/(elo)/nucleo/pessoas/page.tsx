import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPessoasVisiveis } from '@/nucleo/pessoas/servico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { IconeBusca } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export const metadata: Metadata = { title: 'Pessoas' };

const PAPEIS: Record<string, string> = {
  atendido: 'Atendido',
  familiar: 'Familiar',
  colaborador: 'Colaborador',
  voluntario: 'Voluntário',
  doador: 'Doador',
  parceiro: 'Parceiro',
};

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function Pessoas({ searchParams }: { searchParams: Promise<{ busca?: string; papel?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const app = await obterAplicacao();
  const { busca = '', papel = '' } = await searchParams;

  // A camada de aplicação filtra pelo perfil: cada um recebe só quem pode ver.
  const todas = await listarPessoasVisiveis(app.planilhas, usuario.autorizador);
  const termo = semAcento(busca.trim());
  const pessoas = todas.filter((p) => (!termo || semAcento(p.nome).includes(termo)) && (!papel || p.papeis.includes(papel)));
  const contagem = (x: string) => todas.filter((p) => p.papeis.includes(x)).length;
  const filtros = [{ valor: '', rotulo: 'Todas', n: todas.length }, ...Object.entries(PAPEIS).map(([valor, rotulo]) => ({ valor, rotulo, n: contagem(valor) }))].filter(
    (f) => f.valor === '' || f.n > 0,
  );
  const link = (valor: string) => {
    const q = new URLSearchParams({ ...(busca ? { busca } : {}), ...(valor ? { papel: valor } : {}) });
    return `/nucleo/pessoas${q.size ? `?${q}` : ''}`;
  };

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Pessoas' }]}
        titulo="Pessoas"
        descricao="Atendidos, familiares e equipe que o seu perfil permite ver. Quem não aparece está fora do seu escopo de acesso."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form className="flex min-w-0 flex-1 gap-2 sm:max-w-md" role="search">
          {papel && <input type="hidden" name="papel" value={papel} />}
          <label className="sr-only" htmlFor="busca">
            Buscar pelo nome
          </label>
          <div className="relative flex-1">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-texto-suave" tamanho={18} />
            <input id="busca" name="busca" defaultValue={busca} placeholder="Buscar pelo nome" className={`${estiloEntrada} pl-10`} />
          </div>
          <button className={estiloBotao('secundario', 'mt-1.5')}>Buscar</button>
        </form>
      </div>
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar por papel">
        {filtros.map((f) => (
          <li key={f.valor}>
            <Link
              href={link(f.valor)}
              aria-current={papel === f.valor ? 'true' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                papel === f.valor ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie hover:bg-destaque-suave'
              }`}
            >
              {f.rotulo}
              <span className="tabular-nums opacity-80">{f.n}</span>
            </Link>
          </li>
        ))}
      </ul>

      {pessoas.length === 0 ? (
        <EstadoVazio
          titulo={todas.length === 0 ? 'Nenhuma pessoa visível para o seu perfil' : 'Ninguém encontrado'}
          acao={
            todas.length > 0 ? (
              <Link href="/nucleo/pessoas" className={estiloBotao('secundario')}>
                Limpar busca
              </Link>
            ) : undefined
          }
        >
          {todas.length === 0 ? 'Se você deveria ver atendidos de um serviço, peça à administração para ajustar o seu perfil.' : 'Confira a grafia ou tente só o primeiro nome.'}
        </EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">{pessoas.length} pessoas</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Nome</th>
                <th scope="col" className={tabela.th}>Papel</th>
                <th scope="col" className={tabela.th}>Serviço</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <PiscaOndeMudou key={p.id} chave={`pessoa:${p.id}`} como="tr" className={tabela.linha}>
                  <td className={`${tabela.td} font-semibold`}>{p.nome}</td>
                  <td className={tabela.td}>
                    <span className="flex flex-wrap gap-1">
                      {p.papeis.map((x) => (
                        <Etiqueta key={x} tipo={x === 'atendido' ? 'info' : 'neutro'}>
                          {PAPEIS[x] ?? x}
                        </Etiqueta>
                      ))}
                    </span>
                  </td>
                  <td className={`${tabela.td} text-texto-suave`}>{p.servicos.join(', ') || '—'}</td>
                </PiscaOndeMudou>
              ))}
            </tbody>
          </table>
          <p className="border-t border-borda px-4 py-2.5 text-sm text-texto-suave">
            {pessoas.length === todas.length ? `${todas.length} pessoas` : `${pessoas.length} de ${todas.length} pessoas`}
          </p>
        </div>
      )}
    </div>
  );
}
