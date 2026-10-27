import { redirect } from 'next/navigation';
import { cadastros } from '@/modulos/orcamento/aplicacao/folha';
import { NIVEIS } from '@/modulos/orcamento/dados/tabelas';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, estiloCampo, Mensagem } from '../../admin/mensagem';
import { acaoSalvarCargo, acaoSalvarCentro, acaoSalvarValorTabela } from '../acoes';

export default async function Cadastros({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const c = await cadastros(app.planilhas, usuario.autorizador);
  const { ok, erro } = await searchParams;
  const areas = [...new Set(c.centros.map((x) => x.area))];

  return (
    <div className="space-y-10">
      <Mensagem ok={ok} erro={erro} />

      <section className="space-y-4" aria-labelledby="t-centros">
        <div>
          <h2 id="t-centros" className="text-xl font-semibold">Centros de custo</h2>
          <p className="mt-1 text-texto-suave">Para onde o custo de cada posto é dividido. Cada centro pertence a uma área.</p>
        </div>
        {c.centros.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda p-5">Nenhum centro de custo cadastrado.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <div key={a} className="rounded-lg border border-borda bg-superficie p-4">
                <h3 className="font-semibold">{a}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {c.centros
                    .filter((x) => x.area === a)
                    .map((x) => (
                      <li key={x.codigo}>
                        {x.nome} <span className="text-texto-suave">({x.codigo})</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {c.podeEditar && (
          <form action={acaoSalvarCentro} className="grid gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-4">
            <h3 className="font-semibold sm:col-span-4">Cadastrar centro de custo</h3>
            <label className="text-sm sm:col-span-2">
              Nome
              <input name="nome" required className={estiloCampo} placeholder="ex.: Apae Rural › Viveiro de mudas" />
            </label>
            <label className="text-sm">
              Código
              <input name="codigo" required pattern="[a-z0-9_]+" className={estiloCampo} placeholder="ex.: rural_viveiro" />
            </label>
            <label className="text-sm">
              Área
              <select name="area" required className={estiloCampo}>
                <option value="">Escolha…</option>
                {c.areas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-4">
              <button className={estiloBotao}>Cadastrar centro</button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="t-tabela">
        <div>
          <h2 id="t-tabela" className="text-xl font-semibold">Cargos e tabela salarial</h2>
          <p className="mt-1 text-texto-suave">
            Valor vigente de cada cargo por nível, para a carga horária de referência. Na ficha do posto, o salário é sugerido a partir daqui.
          </p>
        </div>
        {c.cargosCompletos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda p-5">Nenhum cargo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
                  <th scope="col" className="sticky left-0 bg-superficie px-3 py-2 font-medium">Cargo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Carga</th>
                  {NIVEIS.map((n) => (
                    <th key={n} scope="col" className="px-3 py-2 text-right font-medium">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.cargosCompletos.map((x) => (
                  <tr key={x.id} className="border-b border-borda last:border-0">
                    <th scope="row" className="sticky left-0 bg-superficie px-3 py-2 font-normal">
                      {x.nome}
                      {x.grupo && <span className="block text-xs text-texto-suave">{x.grupo}</span>}
                    </th>
                    <td className="px-3 py-2 tabular-nums">{x.carga_horaria_referencia ? `${x.carga_horaria_referencia}h` : '—'}</td>
                    {NIVEIS.map((n) => {
                      const v = c.tabela[`${x.codigo}|${n}`];
                      return (
                        <td key={n} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {v === undefined ? <span className="text-texto-suave">—</span> : reais(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {c.podeEditar && (
          <div className="grid gap-4 lg:grid-cols-2">
            <form action={acaoSalvarCargo} className="grid gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-2">
              <h3 className="font-semibold sm:col-span-2">Cadastrar cargo</h3>
              <label className="text-sm sm:col-span-2">
                Nome
                <input name="nome" required className={estiloCampo} />
              </label>
              <label className="text-sm">
                Código
                <input name="codigo" required pattern="[a-z0-9_]+" className={estiloCampo} placeholder="ex.: professor" />
              </label>
              <label className="text-sm">
                Carga horária de referência
                <input name="carga" type="number" min="1" max="44" className={estiloCampo} />
              </label>
              <label className="text-sm sm:col-span-2">
                Grupo (opcional)
                <input name="grupo" className={estiloCampo} />
              </label>
              <div className="sm:col-span-2">
                <button className={estiloBotao}>Cadastrar cargo</button>
              </div>
            </form>
            <form action={acaoSalvarValorTabela} className="grid gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-2">
              <h3 className="font-semibold sm:col-span-2">Gravar valor na tabela salarial</h3>
              <p className="text-sm text-texto-suave sm:col-span-2">O valor anterior fica guardado; o novo vale a partir do mês escolhido.</p>
              <label className="text-sm sm:col-span-2">
                Cargo
                <select name="cargo" required className={estiloCampo}>
                  {c.cargosCompletos.map((x) => (
                    <option key={x.codigo} value={x.codigo}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Nível
                <select name="nivel" required className={estiloCampo}>
                  {NIVEIS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Valor (R$)
                <input name="valor" required inputMode="decimal" className={estiloCampo} />
              </label>
              <label className="text-sm">
                Vale a partir de
                <input name="vigencia" type="month" required defaultValue={`${c.ano}-01`} className={estiloCampo} />
              </label>
              <div className="sm:col-span-2">
                <button className={estiloBotao}>Gravar valor</button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
