import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cadastros } from '@/modulos/orcamento/aplicacao/folha';
import { NIVEIS } from '@/modulos/orcamento/dados/tabelas';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, Secao, tabela } from '@/ui/pagina';
import { acaoSalvarCargo, acaoSalvarCentro, acaoSalvarValorTabela } from '../acoes';

export const metadata: Metadata = { title: 'Cargos e centros de custo' };

export default async function Cadastros() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const c = await cadastros(app.planilhas, usuario.autorizador);
  const areas = [...new Set(c.centros.map((x) => x.area))];
  const niveisUsados = NIVEIS.filter((n) => c.cargosCompletos.some((x) => c.tabela[`${x.codigo}|${n}`] !== undefined));
  const niveis = niveisUsados.length ? niveisUsados : NIVEIS.slice(0, 4);

  return (
    <div className="space-y-8">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Cargos e centros de custo' }]}
        titulo="Cargos e centros de custo"
        descricao={
          c.podeEditar
            ? 'Os cadastros que a folha usa. Valores da tabela salarial nunca são sobrescritos: um valor novo vale a partir do mês escolhido.'
            : 'Os cadastros que a folha usa. Alterações são feitas pelo Financeiro.'
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Secao titulo="Tabela salarial" descricao="Valor vigente de cada cargo por nível, para a carga horária de referência." id="t-tabela">
          {c.cargosCompletos.length === 0 ? (
            <EstadoVazio titulo="Nenhum cargo cadastrado">Importe a planilha da folha ou cadastre os cargos ao lado.</EstadoVazio>
          ) : (
            <div className="-m-5 overflow-x-auto">
              <table className={tabela.tabela}>
                <thead className={tabela.cabeca}>
                  <tr>
                    <th scope="col" className={`${tabela.th} sticky left-0 bg-superficie-2`}>Cargo</th>
                    <th scope="col" className={tabela.th}>Horas</th>
                    {niveis.map((n) => (
                      <th key={n} scope="col" className={`${tabela.th} text-right`}>
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.cargosCompletos.map((x) => (
                    <tr key={x.id} className={tabela.linha}>
                      <th scope="row" className="sticky left-0 bg-superficie px-4 py-3 text-left font-semibold">
                        {x.nome}
                        {x.grupo && <span className="block text-xs font-normal text-texto-suave">{x.grupo}</span>}
                      </th>
                      <td className={`${tabela.td} tabular-nums`}>{x.carga_horaria_referencia ? `${x.carga_horaria_referencia}h` : '—'}</td>
                      {niveis.map((n) => {
                        const v = c.tabela[`${x.codigo}|${n}`];
                        return (
                          <td key={n} className={`${tabela.td} ${tabela.numero}`}>
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
        </Secao>

        {c.podeEditar && (
          <div className="space-y-6">
            <Secao titulo="Gravar valor na tabela" descricao="O valor anterior fica guardado." id="t-valor">
              <form action={acaoSalvarValorTabela} className="space-y-4">
                <Campo rotulo="Cargo" obrigatorio>
                  <select name="cargo" required className={estiloEntrada}>
                    {c.cargosCompletos.map((x) => (
                      <option key={x.codigo} value={x.codigo}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Nível" obrigatorio>
                    <select name="nivel" required className={estiloEntrada}>
                      {NIVEIS.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Valor (R$)" obrigatorio>
                    <input name="valor" required inputMode="decimal" placeholder="0,00" className={`${estiloEntrada} text-right`} />
                  </Campo>
                </div>
                <Campo rotulo="Vale a partir de" obrigatorio>
                  <input name="vigencia" type="month" required defaultValue={`${c.ano}-01`} className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Gravando…" className="w-full">
                  Gravar valor
                </BotaoEnviar>
              </form>
            </Secao>
            <Secao titulo="Cadastrar cargo" id="t-cargo">
              <form action={acaoSalvarCargo} className="space-y-4">
                <Campo rotulo="Nome" obrigatorio>
                  <input name="nome" required className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Código" obrigatorio dica="Minúsculas, sem espaços. Ex.: professor">
                  <input name="codigo" required pattern="[a-z0-9_]+" className={estiloEntrada} />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Horas de referência">
                    <input name="carga" type="number" min="1" max="44" className={estiloEntrada} />
                  </Campo>
                  <Campo rotulo="Grupo">
                    <input name="grupo" className={estiloEntrada} />
                  </Campo>
                </div>
                <BotaoEnviar enviando="Cadastrando…" className="w-full" variante="secundario">
                  Cadastrar cargo
                </BotaoEnviar>
              </form>
            </Secao>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Secao titulo="Centros de custo" descricao="Para onde o custo de cada posto é dividido. Cada centro pertence a uma área." id="t-centros">
          {c.centros.length === 0 ? (
            <EstadoVazio titulo="Nenhum centro de custo cadastrado">Cadastre ao lado ou importe a planilha da folha.</EstadoVazio>
          ) : (
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {areas.map((a) => (
                <div key={a}>
                  <h3 className="text-sm font-bold text-texto-suave">{a}</h3>
                  <ul className="mt-1.5 divide-y divide-borda text-sm">
                    {c.centros
                      .filter((x) => x.area === a)
                      .map((x) => (
                        <li key={x.codigo} className="flex justify-between gap-2 py-1.5">
                          <span>{x.nome}</span>
                          <span className="text-xs text-texto-suave">{x.codigo}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Secao>
        {c.podeEditar && (
          <Secao titulo="Cadastrar centro de custo" id="t-centro">
            <form action={acaoSalvarCentro} className="space-y-4">
              <Campo rotulo="Nome" obrigatorio dica="Ex.: Apae Rural › Viveiro de mudas">
                <input name="nome" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Código" obrigatorio dica="Minúsculas, sem espaços. Ex.: rural_viveiro">
                <input name="codigo" required pattern="[a-z0-9_]+" className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Área" obrigatorio>
                <select name="area" required defaultValue="" className={estiloEntrada}>
                  <option value="" disabled>
                    Escolha a área
                  </option>
                  {c.areas.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <BotaoEnviar enviando="Cadastrando…" className="w-full" variante="secundario">
                Cadastrar centro
              </BotaoEnviar>
            </form>
          </Secao>
        )}
      </div>
    </div>
  );
}
