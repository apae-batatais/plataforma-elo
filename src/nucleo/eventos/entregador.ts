/**
 * Entrega de eventos de domínio (padrão outbox).
 *
 * Os eventos são gravados em `core.evento_dominio` na mesma transação da
 * operação que os gerou. Esta rotina, executada de tempos em tempos,
 * entrega cada evento a cada consumidor interessado, em ordem.
 *
 * Garantias:
 * - cada consumidor recebe os eventos na ordem em que foram publicados;
 * - se um consumidor falhar, a falha é registrada e ele para ali; na
 *   próxima execução o mesmo evento é tentado de novo (nada se perde);
 * - o tratamento e o registro da entrega ocorrem na mesma transação,
 *   então um evento nunca é marcado como entregue sem ter sido tratado.
 *
 * Por isso, todo consumidor deve ser idempotente: tratar o mesmo evento
 * duas vezes não pode gerar efeito duplicado.
 */
import { sql } from 'drizzle-orm';
import { comoSistema, type Banco } from '@/nucleo/db/contexto';
import { linhas } from '@/nucleo/db/linhas';

export interface EventoRecebido {
  id: number;
  tipo: string;
  versao: number;
  payload: unknown;
  publicadoPor: string;
  publicadoEm: string;
}

export interface Consumidor {
  /** Nome único e estável, ex.: "avaliacao.abrir-avaliacao-entrada". */
  nome: string;
  eventos: readonly string[];
  tratar: (evento: EventoRecebido, tx: Banco) => Promise<void>;
}

export interface ResultadoEntrega {
  consumidor: string;
  entregues: number;
  falha?: { eventoId: number; erro: string };
}

export async function entregarPendentes(
  db: Banco,
  consumidores: readonly Consumidor[],
  limitePorConsumidor = 100,
): Promise<ResultadoEntrega[]> {
  const nomes = new Set<string>();
  for (const c of consumidores) {
    if (nomes.has(c.nome)) throw new Error(`Consumidor duplicado: ${c.nome}`);
    nomes.add(c.nome);
  }

  const resultados: ResultadoEntrega[] = [];
  for (const consumidor of consumidores) {
    resultados.push(await entregarAoConsumidor(db, consumidor, limitePorConsumidor));
  }
  return resultados;
}

async function entregarAoConsumidor(db: Banco, consumidor: Consumidor, limite: number): Promise<ResultadoEntrega> {
  const resultado: ResultadoEntrega = { consumidor: consumidor.nome, entregues: 0 };
  if (consumidor.eventos.length === 0) return resultado;

  const tipos = sql.join(
    consumidor.eventos.map((t) => sql`${t}`),
    sql`, `,
  );
  const pendentes = await comoSistema(db, async (tx) =>
    linhas<EventoRecebido>(
      await tx.execute(sql`
        select e.id::int as "id", e.tipo, e.versao, e.payload,
               e.publicado_por as "publicadoPor", e.publicado_em::text as "publicadoEm"
          from core.evento_dominio e
          left join core.evento_entrega en on en.evento_id = e.id and en.consumidor = ${consumidor.nome}
         where e.tipo in (${tipos}) and en.entregue_em is null
         order by e.id
         limit ${limite}`),
    ),
  );

  for (const evento of pendentes) {
    try {
      await comoSistema(db, async (tx) => {
        await consumidor.tratar(evento, tx);
        await tx.execute(sql`
          insert into core.evento_entrega (evento_id, consumidor, entregue_em, tentativas)
          values (${evento.id}, ${consumidor.nome}, now(), 1)
          on conflict (evento_id, consumidor)
          do update set entregue_em = now(), tentativas = core.evento_entrega.tentativas + 1, ultimo_erro = null`);
      });
      resultado.entregues += 1;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await comoSistema(db, (tx) =>
        tx.execute(sql`
          insert into core.evento_entrega (evento_id, consumidor, tentativas, ultimo_erro)
          values (${evento.id}, ${consumidor.nome}, 1, ${mensagem})
          on conflict (evento_id, consumidor)
          do update set tentativas = core.evento_entrega.tentativas + 1, ultimo_erro = ${mensagem}`),
      );
      resultado.falha = { eventoId: evento.id, erro: mensagem };
      break; // mantém a ordem: não pula para o próximo evento
    }
  }
  return resultado;
}
