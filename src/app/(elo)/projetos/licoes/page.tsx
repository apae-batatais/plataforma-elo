import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { consultarLicoes } from '@/modulos/projetos/aplicacao/encerramento';
import { CATEGORIAS_LICAO, NOME_CATEGORIA_LICAO, type CategoriaLicao } from '@/modulos/projetos/dominio/encerramento';
import { NOME_PORTE, NOME_TIPO, PORTES, TIPOS_PROJETO, type Porte, type TipoProjeto } from '@/modulos/projetos/dominio/projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Lições aprendidas' };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const data = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export default async function PaginaLicoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const q = await searchParams;
  const categoria = um(q.categoria);
  const tipo = um(q.tipo);
  const porte = um(q.porte);
  const busca = um(q.q);
  const { planilhas } = await obterAplicacao();
  const licoes = await consultarLicoes(planilhas, usuario.autorizador, {
    categoria: (CATEGORIAS_LICAO as readonly string[]).includes(categoria) ? (categoria as CategoriaLicao) : null,
    tipo: (TIPOS_PROJETO as readonly string[]).includes(tipo) ? (tipo as TipoProjeto) : null,
    porte: (PORTES as readonly string[]).includes(porte) ? (porte as Porte) : null,
    texto: busca,
  });
  const filtrando = !!(categoria || tipo || porte || busca);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Lições aprendidas' }]}
        titulo="Lições aprendidas"
        descricao="O que os projetos já ensinaram. Procure antes de planejar um projeto novo."
      />
      <Secao id="t-filtros" titulo="Procurar">
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Palavra" dica="ex.: compra, prazo.">
            <input name="q" defaultValue={busca} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Categoria">
            <select name="categoria" defaultValue={categoria} className={estiloEntrada}>
              <option value="">Todas</option>
              {CATEGORIAS_LICAO.map((c) => <option key={c} value={c}>{NOME_CATEGORIA_LICAO[c]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo de projeto">
            <select name="tipo" defaultValue={tipo} className={estiloEntrada}>
              <option value="">Todos</option>
              {TIPOS_PROJETO.map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Porte">
            <select name="porte" defaultValue={porte} className={estiloEntrada}>
              <option value="">Todos</option>
              {PORTES.map((x) => <option key={x} value={x}>{NOME_PORTE[x]}</option>)}
            </select>
          </Campo>
          <div className="flex items-end gap-3">
            <Botao type="submit" variante="primario">Procurar</Botao>
            {filtrando && <Link href="/projetos/licoes" className="inline-flex min-h-10 items-center font-semibold text-destaque hover:underline">Limpar</Link>}
          </div>
        </form>
      </Secao>
      {licoes.length === 0 ? (
        <EstadoVazio titulo={filtrando ? 'Nenhuma lição com esses filtros.' : 'Nada aqui ainda.'}>{filtrando ? 'Tente outra palavra ou tire um filtro.' : 'As lições aparecem aqui quando um projeto as registra.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo={`${licoes.length} ${licoes.length === 1 ? 'lição' : 'lições'}`}>
          <ul className="divide-y divide-borda">
            {licoes.map((l) => (
              <li key={l.id} className="space-y-1 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <Etiqueta tipo="info">{NOME_CATEGORIA_LICAO[l.categoria]}</Etiqueta>
                  <Etiqueta tipo="neutro">{NOME_TIPO[l.tipo as TipoProjeto]}</Etiqueta>
                  <Etiqueta tipo="neutro">{NOME_PORTE[l.porte as Porte]}</Etiqueta>
                  {l.projeto ? <Link href={`/projetos/${l.projeto.id}/encerramento`} className="text-destaque hover:underline">{l.projeto.codigo} · {l.projeto.titulo}</Link> : <span className="font-normal text-texto-suave">Projeto que você não acompanha</span>}
                  <span className="font-normal text-texto-suave">{data(l.registradoEm)}</span>
                </p>
                <p><span className="font-semibold">O que aconteceu:</span> {l.oQueAconteceu}</p>
                <p><span className="font-semibold">O que fazer diferente:</span> {l.fazerDiferente}</p>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
