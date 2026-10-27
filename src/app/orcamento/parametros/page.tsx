import { redirect } from 'next/navigation';
import { cadastros } from '@/modulos/orcamento/aplicacao/folha';
import { PARAMETROS } from '@/modulos/orcamento/dominio/folha';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, estiloCampo, Mensagem } from '../../admin/mensagem';
import { acaoSalvarParametros } from '../acoes';

const GRUPOS = [
  { titulo: 'Ano', chaves: ['ano'] },
  {
    titulo: 'Provisões e encargos',
    texto: 'Percentuais aplicados sobre a remuneração (salário base, adicional, hora atividade, insalubridade, periculosidade e gratificação). Benefícios não entram na conta.',
    chaves: ['ferias', 'terco_ferias', 'decimo_terceiro', 'abono', 'fgts', 'indenizacoes'],
  },
  { titulo: 'Reajuste', texto: 'Aplicado à remuneração a partir do mês indicado. Os meses anteriores não mudam.', chaves: ['reajuste_percentual', 'reajuste_mes'] },
];

export default async function Parametros({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const c = await cadastros(app.planilhas, usuario.autorizador);
  const { ok, erro } = await searchParams;
  const def = new Map(PARAMETROS.map((p) => [p.chave as string, p]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Parâmetros da folha</h2>
        <p className="mt-1 text-texto-suave">
          {c.podeEditar ? 'Definidos pelo Financeiro. Valem para o cálculo de todos os postos.' : 'Definidos pelo Financeiro. Você pode consultar, sem alterar.'}
        </p>
      </div>
      <Mensagem ok={ok} erro={erro} />
      <form action={acaoSalvarParametros} className="space-y-6">
        <fieldset disabled={!c.podeEditar} className="min-w-0 space-y-6">
          {GRUPOS.map((g) => (
            <section key={g.titulo} className="rounded-lg border border-borda bg-superficie p-5">
              <h3 className="text-lg font-semibold">{g.titulo}</h3>
              {g.texto && <p className="mt-1 max-w-2xl text-sm text-texto-suave">{g.texto}</p>}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {g.chaves.map((k) => (
                  <label key={k} className="text-sm">
                    {def.get(k)!.nome}
                    <input
                      name={k}
                      required
                      inputMode="decimal"
                      defaultValue={String(c.parametros[k as keyof typeof c.parametros]).replace('.', ',')}
                      className={`${estiloCampo} text-right tabular-nums disabled:opacity-70`}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
          {c.podeEditar && <button className={estiloBotao}>Salvar parâmetros</button>}
        </fieldset>
      </form>
    </div>
  );
}
