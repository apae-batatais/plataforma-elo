/**
 * Comparativo das aplicações concluídas de uma pessoa num instrumento: escore total por ciclo
 * (barras), enquadramento e justificativa de cada ciclo e o vencimento da reavaliação.
 */
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { BarrasAgrupadas } from '@/ui/graficos';
import { Aviso } from '@/ui/aviso';
import { Etiqueta, Secao, tabela } from '@/ui/pagina';
import type { ComparativoDaPessoa } from '../aplicacao/aplicacoes';

const br = (iso: string) => iso.split('-').reverse().join('/');
const pontos = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;

const SITUACAO = { em_dia: 'Em dia', vence_em_breve: 'Vence em breve', atrasada: 'Atrasada' } as const;

export function ComparativoAplicacoes({ c }: { c: ComparativoDaPessoa }) {
  const { comparativo: m } = c;
  const n = m.pontos.length;
  if (n === 0) {
    return (
      <Aviso tipo="info" titulo="Nenhuma aplicação concluída ainda">
        O comparativo aparece quando houver aplicações concluídas deste instrumento para a pessoa.
      </Aviso>
    );
  }
  const conclusao =
    m.diferencaDoTotal === null
      ? 'Só há uma aplicação concluída: o comparativo aparece a partir da segunda.'
      : m.diferencaDoTotal === 0
        ? 'Escore total ficou igual'
        : `Escore total ${m.diferencaDoTotal < 0 ? 'caiu' : 'subiu'} ${pontos(m.diferencaDoTotal)}`;
  const ultima = m.pontos[n - 1]!;
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
            categorias={m.pontos.map((p) => br(p.data))}
            series={[{ nome: 'Escore total', valores: m.pontos.map((p) => p.escore.total), cor: 1 }]}
            formato="numero"
            rotuloCategoria="Data"
            descricao={`Escore total de cada aplicação concluída, de ${br(m.pontos[0]!.data)} a ${br(ultima.data)}.`}
          />
          <div className="space-y-3">
            <p>
              <span className="block text-3xl font-bold tabular-nums">
                <NumeroQueConta texto={String(ultima.escore.total)} chave="escore-ultimo" />
              </span>
              <span className="text-sm text-texto-suave">
                pontos na última aplicação, de {ultima.escore.maximo} possíveis nos {ultima.escore.itensConsiderados} itens considerados
              </span>
            </p>
            {c.reavaliacao && (
              <p className="text-sm">
                Próxima aplicação até <b>{br(c.reavaliacao.vence)}</b> ({SITUACAO[c.reavaliacao.situacao]}).
              </p>
            )}
          </div>
        </div>
      </Secao>
      <Secao titulo="Cada aplicação">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Aplicações concluídas</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Data</th>
                <th scope="col" className={tabela.th}>Serviço</th>
                <th scope="col" className={`${tabela.th} text-right`}>Escore total</th>
                <th scope="col" className={tabela.th}>Enquadramento</th>
                <th scope="col" className={tabela.th}>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {m.pontos.map((p, i) => (
                <tr key={p.id} className={tabela.linha}>
                  <td className={tabela.td}>{br(p.data)}</td>
                  <td className={tabela.td}>{c.ciclos[i]?.servicoNome}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>{p.escore.total} de {p.escore.maximo}</td>
                  <td className={tabela.td}>{c.ciclos[i]?.enquadramento ? <Etiqueta tipo="info">{c.ciclos[i]!.enquadramento}</Etiqueta> : '—'}</td>
                  <td className={tabela.td}>{c.ciclos[i]?.justificativa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}
