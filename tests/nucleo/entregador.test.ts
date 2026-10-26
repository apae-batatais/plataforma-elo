import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { entregarPendentes, type Consumidor } from '@/nucleo/eventos/entregador';
import { criarBancoTeste, type BancoTeste } from '../apoio/banco-teste';

let b: BancoTeste;

beforeAll(async () => {
  b = await criarBancoTeste();
  await b.pg.exec(`create schema teste;
    create table teste.recebido (consumidor text, evento_id int, valor text);
    grant usage on schema teste to service_role;
    grant all on teste.recebido to service_role;`);
});
afterAll(async () => b.fechar());

beforeEach(async () => {
  await b.admin(`truncate teste.recebido`);
});

async function publicar(tipo: string, valor: string) {
  await b.admin(`select core.publicar_evento($1, $2::jsonb, 'teste')`, [tipo, JSON.stringify({ valor })]);
}

function gravador(nome: string, eventos: string[], falharEm?: { valor: string; vezes: number }): Consumidor {
  let falhas = 0;
  return {
    nome,
    eventos,
    tratar: async (evento, tx) => {
      const valor = (evento.payload as { valor: string }).valor;
      await tx.execute(sql`insert into teste.recebido values (${nome}, ${evento.id}, ${valor})`);
      if (falharEm && valor === falharEm.valor && falhas < falharEm.vezes) {
        falhas += 1;
        throw new Error(`falha simulada em ${valor}`);
      }
    },
  };
}

async function recebidos(consumidor: string) {
  return (await b.admin(`select valor from teste.recebido where consumidor = $1 order by evento_id`, [consumidor])).map(
    (l) => l.valor,
  );
}

describe('entrega de eventos', () => {
  it('entrega só os tipos assinados, em ordem, uma única vez', async () => {
    await publicar('TesteA', 'a1');
    await publicar('TesteB', 'b1');
    await publicar('TesteA', 'a2');
    const c = gravador('so-a', ['TesteA']);

    const [r1] = await entregarPendentes(b.db, [c]);
    expect(r1.entregues).toBe(2);
    expect(await recebidos('so-a')).toEqual(['a1', 'a2']);

    const [r2] = await entregarPendentes(b.db, [c]);
    expect(r2.entregues).toBe(0);
  });

  it('para no evento que falhou, desfaz o efeito e retoma na próxima execução', async () => {
    await publicar('TesteC', 'c1');
    await publicar('TesteC', 'c2');
    await publicar('TesteC', 'c3');
    const c = gravador('instavel', ['TesteC'], { valor: 'c2', vezes: 1 });

    const [r1] = await entregarPendentes(b.db, [c]);
    expect(r1.entregues).toBe(1);
    expect(r1.falha?.erro).toContain('falha simulada em c2');
    expect(await recebidos('instavel')).toEqual(['c1']); // efeito de c2 foi desfeito

    const [registro] = await b.admin(
      `select tentativas, ultimo_erro from core.evento_entrega where consumidor = 'instavel' and entregue_em is null`,
    );
    expect(registro.tentativas).toBe(1);

    const [r2] = await entregarPendentes(b.db, [c]);
    expect(r2.entregues).toBe(2);
    expect(await recebidos('instavel')).toEqual(['c1', 'c2', 'c3']);
  });

  it('um consumidor com falha não atrasa os outros', async () => {
    await publicar('TesteD', 'd1');
    const quebrado = gravador('quebrado', ['TesteD'], { valor: 'd1', vezes: 99 });
    const saudavel = gravador('saudavel', ['TesteD']);
    const resultados = await entregarPendentes(b.db, [quebrado, saudavel]);
    expect(resultados.find((r) => r.consumidor === 'saudavel')?.entregues).toBe(1);
    expect(resultados.find((r) => r.consumidor === 'quebrado')?.falha).toBeDefined();
  });

  it('recusa consumidores com o mesmo nome', async () => {
    await expect(entregarPendentes(b.db, [gravador('x', ['A']), gravador('x', ['B'])])).rejects.toThrow(/duplicado/);
  });
});
