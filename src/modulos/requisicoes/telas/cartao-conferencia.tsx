/**
 * Cartão "Conferência do orçamento" (L2): o que quem aprova vê antes de decidir.
 * É só aviso: nunca bloqueia nem desabilita o botão de aprovar. Os números chegam prontos da plataforma
 * (Requisições não lê o Orçamento; ADR-022).
 */
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { NumeroQueConta } from '@/ui/numero-que-conta';

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface SaldoDoCentro {
  ano: number;
  previsaoAprovada: boolean;
  servico: { previsto: number; realizado: number; saldo: number };
  grupo: { id: string; nome: string; previsto: number; realizado: number; saldo: number } | null;
  grupos: { id: string; nome: string }[];
}

export type ConferenciaCentro = {
  servico: string;
  nome: string;
  saldo: { estado: 'ok'; dados: SaldoDoCentro } | { estado: 'sem_permissao' | 'indisponivel' | 'erro' };
};

export function CartaoConferencia({
  centros,
  grupoId,
  valor,
  projeto,
}: {
  centros: ConferenciaCentro[];
  grupoId: string;
  valor: number | null;
  projeto: { codigo: string; titulo: string; atividade: string | null } | null;
}) {
  const grupos = centros.flatMap((c) => (c.saldo.estado === 'ok' ? c.saldo.dados.grupos : [])).filter((g, i, l) => l.findIndex((x) => x.id === g.id) === i);
  return (
    <section aria-labelledby="t-conferencia" className="space-y-4 rounded-cartao border border-borda bg-superficie p-5 print:hidden">
      <h2 id="t-conferencia" className="text-lg font-bold">
        Conferência do orçamento
      </h2>
      {projeto && (
        <p className="text-sm">
          Projeto {projeto.codigo} · {projeto.titulo}
          {projeto.atividade ? ` · Atividade ${projeto.atividade}` : ''}
        </p>
      )}
      <ul className="space-y-4">
        {centros.map((c) => (
          <li key={c.servico} className="space-y-2">
            <p className="font-semibold">{c.nome}</p>
            <Estado c={c} valor={valor} />
          </li>
        ))}
      </ul>
      {grupos.length > 0 && (
        <details className="text-sm" open={Boolean(grupoId || valor != null)}>
          <summary className="cursor-pointer font-semibold">Conferir o saldo (opcional)</summary>
          <form method="get" className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Campo rotulo="Grupo de gasto" dica="Só para conferir o saldo. Fica registrado na requisição.">
              <select name="grupo" defaultValue={grupoId} className={estiloEntrada}>
                <option value="">Sem grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Valor estimado">
              <input name="valor" inputMode="decimal" defaultValue={valor != null ? String(valor).replace('.', ',') : ''} className={estiloEntrada} />
            </Campo>
            <Botao type="submit" variante="secundario">
              Conferir
            </Botao>
          </form>
        </details>
      )}
      <p className="text-sm text-texto-suave">A conferência é só um aviso: a aprovação segue sem ela.</p>
    </section>
  );
}

function Estado({ c, valor }: { c: ConferenciaCentro; valor: number | null }) {
  const s = c.saldo;
  if (s.estado !== 'ok') {
    const texto = {
      sem_permissao: 'Você não tem acesso ao orçamento deste serviço; a aprovação segue sem a conferência.',
      indisponivel: 'O Orçamento não está ativo; a aprovação segue sem a conferência.',
      erro: 'Não foi possível conferir o saldo agora; a aprovação segue sem a conferência.',
    }[s.estado];
    return <Aviso tipo="info">{texto}</Aviso>;
  }
  const d = s.dados;
  if (!d.previsaoAprovada) return <Aviso tipo="info">Sem orçamento aprovado para {d.ano}.</Aviso>;
  const base = d.grupo ?? d.servico;
  const depois = d.grupo && valor != null ? d.grupo.saldo - valor : null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-texto-suave">
        {d.grupo ? `Saldo do grupo ${d.grupo.nome} neste serviço` : `Saldo do serviço em ${d.ano}`}
      </p>
      <p className="text-3xl font-bold tabular-nums">
        <NumeroQueConta texto={moeda(base.saldo)} />
      </p>
      <p className="text-sm text-texto-suave">
        Previsto {moeda(base.previsto)} · realizado {moeda(base.realizado)}. Saldo sem as compras aprovadas ainda não lançadas.
      </p>
      {depois != null && (
        <>
          <p className="text-sm">
            Depois desta compra: <strong className="tabular-nums">{moeda(depois)}</strong>
          </p>
          {depois < 0 && (
            <Aviso tipo="atencao" titulo="Passa do previsto">
              Esta compra passa do previsto para o grupo neste serviço. Você ainda pode aprovar.
            </Aviso>
          )}
        </>
      )}
    </div>
  );
}
