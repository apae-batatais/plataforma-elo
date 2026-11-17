/** Leitura de uma avaliação concluída: total, subtotais, faixa, principal barreira e respostas por dimensão. */
import type { AplicacaoDetalhada } from '../aplicacao/avaliacoes';
import { ENCAMINHAMENTO_POR_FAIXA } from '../dominio/cer';
import { Secao, tabela } from '@/ui/pagina';

export function ResumoAplicacao({ a }: { a: AplicacaoDetalhada }) {
  const { escore, instrumento } = a;
  return (
    <div className="space-y-5">
      <Secao titulo={a.faixa ? a.faixa.nome : 'Avaliação incompleta'}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <p>
            <span className="text-4xl font-bold tabular-nums">{escore.total}</span>
            <span className="text-texto-suave"> de {instrumento.itens.length * 3} pontos</span>
          </p>
          {escore.dominios.map((d) => (
            <p key={d.codigo} className="text-sm">
              <span className="text-texto-suave">{d.nome}: </span>
              <b className="tabular-nums">
                {d.pontos}/{instrumento.itens.filter((i) => i.dominio === d.codigo).length * 3}
              </b>
            </p>
          ))}
        </div>
        {a.faixa && <p className="mt-3">{ENCAMINHAMENTO_POR_FAIXA[a.faixa.nome]}</p>}
        {a.principalBarreira.length > 0 && (
          <p className="mt-2 text-sm">
            Principal barreira: <b>{a.principalBarreira.map((d) => d.nome).join(' e ')}</b> (menor percentual do máximo da dimensão).
          </p>
        )}
        {a.justificativa && (
          <p className="mt-3 text-sm">
            <b>Justificativa do enquadramento:</b> {a.justificativa}
          </p>
        )}
      </Secao>

      {instrumento.dominios.map((dom) => (
        <div key={dom.codigo} className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="px-4 py-2 text-left text-sm font-bold">{dom.nome}</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Item</th>
                <th scope="col" className={tabela.th}>CIF</th>
                <th scope="col" className={`${tabela.th} text-right`}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {instrumento.itens
                .filter((i) => i.dominio === dom.codigo)
                .map((i) => (
                  <tr key={i.numero} className={tabela.linha}>
                    <td className={tabela.td}>
                      {i.numero}. {i.texto}
                    </td>
                    <td className={tabela.td}>{i.etiqueta ?? ''}</td>
                    <td className={`${tabela.td} text-right font-bold tabular-nums`}>{a.respostas[i.numero] ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
