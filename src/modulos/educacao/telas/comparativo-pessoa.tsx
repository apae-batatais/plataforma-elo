/**
 * Comparativo da pessoa entre períodos: barras agrupadas com os três subtotais, conclusão no título
 * e a tabela item a item. Só períodos da mesma versão do instrumento entram.
 */
import { Aviso } from '@/ui/aviso';
import { BarrasAgrupadas } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { Etiqueta, Secao, tabela } from '@/ui/pagina';
import type { ComparativoDaPessoa } from '../aplicacao/avaliacoes';

const br = (iso: string) => iso.split('-').reverse().join('/');
const pontos = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;
const SITUACAO = { em_dia: 'Em dia', vence_em_breve: 'Vence em breve', atrasada: 'Atrasada' } as const;

export function ComparativoPessoa({ c }: { c: ComparativoDaPessoa }) {
  const { comparativo: m, instrumento } = c;
  const n = m.pontos.length;
  if (n === 0) {
    return (
      <Aviso tipo="info" titulo="Nenhuma avaliação concluída ainda">
        O comparativo aparece quando houver avaliações concluídas desta pessoa.
      </Aviso>
    );
  }
  const conclusao =
    m.diferencaDoTotal === null
      ? 'Só há uma avaliação. A comparação aparece a partir da segunda.'
      : m.diferencaDoTotal === 0
        ? 'Total ficou igual entre os períodos'
        : `Total ${m.diferencaDoTotal < 0 ? 'caiu' : 'subiu'} ${pontos(m.diferencaDoTotal)} entre os períodos`;
  const ultima = m.pontos[n - 1]!;
  const rotulos = m.pontos.map((p) => br(c.periodos.find((x) => x.id === p.id)!.periodoFim));
  const maximo = ultima.escore.maximo;
  return (
    <div className="space-y-6">
      {m.avisoDeVersoes && (
        <Aviso tipo="atencao" titulo="Versões diferentes do instrumento">
          {m.avisoDeVersoes} A comparação usa a versão {m.versao}.
        </Aviso>
      )}
      <Secao titulo={conclusao}>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <BarrasAgrupadas
            categorias={rotulos}
            series={ultima.escore.dominios.map((d, k) => ({ nome: d.nome, valores: m.pontos.map((p) => p.escore.dominios[k]?.pontos ?? 0), cor: (k + 1) as 1 | 2 | 3 }))}
            formato="numero"
            rotuloCategoria="Fim do período"
            descricao={`Pontos de ${ultima.escore.dominios.map((d) => d.nome).join(', ')} em cada período avaliado, de ${rotulos[0]} a ${rotulos[n - 1]}.`}
          />
          <div className="space-y-3">
            <p>
              <span className="block text-3xl font-bold tabular-nums">
                <NumeroQueConta texto={String(ultima.escore.total)} chave="educacao-total-ultimo" />
              </span>
              <span className="text-sm text-texto-suave">de {maximo} pontos na última avaliação</span>
            </p>
            {ultima.escore.enquadramento && <p className="text-sm"><b>{ultima.escore.enquadramento.nome}</b></p>}
            {c.principalBarreira.length > 0 && (
              <p className="text-sm">
                Principal barreira: <b>{c.principalBarreira.join(' e ')}</b> (menor pontuação em relação ao máximo).
              </p>
            )}
            {c.reavaliacao && (
              <p className="text-sm">
                Próxima avaliação até <b>{br(c.reavaliacao.vence)}</b> ({SITUACAO[c.reavaliacao.situacao]}).
              </p>
            )}
          </div>
        </div>
      </Secao>

      <Secao titulo="Cada período">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Avaliações concluídas, do período mais antigo ao mais recente</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Período</th>
                <th scope="col" className={tabela.th}>Serviço</th>
                {ultima.escore.dominios.map((d) => (
                  <th key={d.codigo} scope="col" className={`${tabela.th} text-right`}>{d.nome}</th>
                ))}
                <th scope="col" className={`${tabela.th} text-right`}>Total</th>
                <th scope="col" className={tabela.th}>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {m.pontos.map((p) => {
                const per = c.periodos.find((x) => x.id === p.id)!;
                return (
                  <tr key={p.id} className={tabela.linha}>
                    <td className={tabela.td}>{br(per.periodoInicio)} a {br(per.periodoFim)}</td>
                    <td className={tabela.td}>{per.servicoNome}</td>
                    {p.escore.dominios.map((d) => (
                      <td key={d.codigo} className={`${tabela.td} text-right tabular-nums`}>{d.pontos}/{d.maximo}</td>
                    ))}
                    <td className={`${tabela.td} text-right tabular-nums`}><b>{p.escore.total}</b></td>
                    <td className={tabela.td}>{per.faixa ? <Etiqueta tipo="info">{per.faixa}</Etiqueta> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <details className="rounded-cartao border border-borda bg-superficie p-4">
        <summary className="cursor-pointer font-semibold">Ver os números item a item</summary>
        <div className={`${tabela.moldura} mt-3`}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Nota de cada item em cada período</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Item</th>
                {c.periodos.map((per) => (
                  <th key={per.id} scope="col" className={`${tabela.th} text-right`}>{br(per.periodoFim)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instrumento.itens.map((i) => (
                <tr key={i.numero} className={tabela.linha}>
                  <td className={tabela.td}>{i.numero}. {i.texto}</td>
                  {c.periodos.map((per) => (
                    <td key={per.id} className={`${tabela.td} text-right tabular-nums`}>{per.notas[i.numero] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
