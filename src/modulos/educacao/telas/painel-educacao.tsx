/**
 * Painel de Educação: cartões, faixas por serviço (barras 100%) e média das três dimensões em % do máximo.
 * Só agregados; abaixo de 5 pessoas o número não aparece (nunca arredondado nem em faixa).
 */
import { Aviso } from '@/ui/aviso';
import { BarrasHorizontais, Barras100 } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { EstadoVazio, Secao } from '@/ui/pagina';
import type { NumeroAgregado } from '@/nucleo/ligacoes/numero-agregado';
import type { PainelDeEducacao } from '../aplicacao/painel';

const POUCOS = 'Poucos casos para mostrar sem identificar ninguém.';
const pt = (n: number) => n.toLocaleString('pt-BR');

function Cartao({ rotulo, n, formato, detalhe }: { rotulo: string; n: NumeroAgregado; formato: (v: number) => string; detalhe: string }) {
  return (
    <div className="rounded-cartao border border-borda bg-superficie px-4 py-3">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="text-2xl font-bold tabular-nums">
        {n.valor === null ? <span aria-label={n.motivo === 'sem_dados' ? 'Sem dados' : POUCOS}>—</span> : <NumeroQueConta texto={formato(n.valor)} chave={`educacao-painel:${rotulo}`} />}
      </dd>
      <dd className="text-xs text-texto-suave">{n.valor === null ? (n.motivo === 'sem_dados' ? 'Sem avaliações no filtro.' : POUCOS) : detalhe}</dd>
    </div>
  );
}

/** Título em forma de conclusão, a partir do que o painel mostra (sem nome de pessoa). */
export function conclusaoDoPainel(p: PainelDeEducacao): string {
  if (p.pessoas.valor === null || p.pessoas.valor === 0) return p.pessoas.motivo === 'poucos_casos' ? POUCOS : 'Sem avaliações concluídas no filtro';
  const melhor = p.faixas[0]!;
  return `${pt(melhor.percentual.valor ?? 0)}% das pessoas estão na faixa “${melhor.nome}”`;
}

export function PainelEducacao({ p }: { p: PainelDeEducacao }) {
  if (p.pessoas.motivo === 'poucos_casos') {
    return (
      <Aviso tipo="info" titulo={POUCOS}>
        O painel só mostra números com {5} pessoas ou mais avaliadas. Amplie o período ou escolha todos os serviços.
      </Aviso>
    );
  }
  const n = p.pessoas.valor ?? 0;
  if (n === 0) {
    return (
      <EstadoVazio titulo="Nenhuma avaliação concluída nesse filtro">Mude o serviço ou o período. Os números aparecem quando houver avaliações concluídas.</EstadoVazio>
    );
  }
  const comNumero = p.porServico.filter((s) => s.pessoas.valor !== null && s.faixas.every((f) => f.pessoas.valor !== null));
  const ocultos = p.porServico.length - comNumero.length;
  const dimensoes = p.dimensoes.filter((d) => d.percentualMedio.valor !== null);
  const leitura =
    p.principalBarreira.length > 0
      ? `${p.principalBarreira.join(' e ')} ${p.principalBarreira.length > 1 ? 'estão mais baixas' : 'está mais baixa'}: ${
          p.principalBarreira.includes('Barreira') ? 'veja frequência, saúde, apoio da família e comportamentos que dificultam a permanência.' : 'olhe o plano individual e a evolução nos itens dessa dimensão.'
        }`
      : null;
  const principais = p.pessoasPorPrincipalBarreira.filter((d) => d.pessoas.valor !== null);
  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Cartao rotulo="Pessoas avaliadas" n={p.pessoas} formato={(v) => String(v)} detalhe="pela avaliação concluída mais recente do período" />
        <Cartao rotulo="Total médio" n={p.totalMedio} formato={(v) => pt(v)} detalhe={`de ${p.maximo} pontos`} />
        <Cartao rotulo="Evoluindo adequadamente" n={p.percentualEvoluindo} formato={(v) => `${pt(v)}%`} detalhe={`${p.faixas[0]!.pessoas.valor ?? 0} de ${n} pessoas`} />
      </dl>

      <Secao titulo={conclusaoDoPainel(p)}>
        <ul className="grid gap-2 sm:grid-cols-3" aria-label="Pessoas em cada faixa">
          {p.faixas.map((f) => (
            <li key={f.nome} className="rounded-cartao border border-borda px-3 py-2 text-sm">
              <b className="tabular-nums">{f.percentual.valor === null ? '—' : `${pt(f.percentual.valor)}%`}</b> {f.nome}
              <span className="block text-xs text-texto-suave">{f.pessoas.valor ?? 0} {f.pessoas.valor === 1 ? 'pessoa' : 'pessoas'}</span>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Faixas por serviço">
        {comNumero.length > 0 ? (
          <Barras100
            categorias={comNumero.map((s) => s.nome)}
            series={p.faixas.map((f, k) => ({ nome: f.nome, valores: comNumero.map((s) => s.faixas[k]!.percentual.valor ?? 0), cor: (k + 1) as 1 | 2 | 3 }))}
            rotuloCategoria="Serviço"
            formatoTabela="pct"
            descricao={`Proporção de pessoas em cada faixa, por serviço: ${comNumero.map((s) => s.nome).join(', ')}.`}
          />
        ) : (
          <p className="text-sm text-texto-suave">{POUCOS}</p>
        )}
        {ocultos > 0 && <p className="mt-2 text-sm text-texto-suave">{ocultos === 1 ? 'Um serviço não aparece' : `${ocultos} serviços não aparecem`}: {POUCOS.toLowerCase()}</p>}
      </Secao>

      <Secao titulo="Média de cada dimensão, em % do máximo">
        {dimensoes.length > 0 && (
          <BarrasHorizontais
            categorias={dimensoes.map((d) => d.nome)}
            series={[{ nome: 'Média em % do máximo', valores: dimensoes.map((d) => d.percentualMedio.valor!), cor: 'destaque' }]}
            formato="pct"
            rotuloCategoria="Dimensão"
            descricao={`Média das pessoas em cada dimensão, em percentual do máximo: ${dimensoes.map((d) => `${d.nome} ${pt(d.percentualMedio.valor!)}%`).join('; ')}.`}
          />
        )}
        {leitura && <p className="mt-3 text-sm">{leitura}</p>}
        {principais.length > 0 && (
          <p className="mt-2 text-sm text-texto-suave">
            Dimensão de menor pontuação de cada pessoa: {principais.map((d) => `${d.nome} (${d.pessoas.valor})`).join('; ')}. Em empate, a pessoa conta nas duas.
          </p>
        )}
      </Secao>
    </div>
  );
}
