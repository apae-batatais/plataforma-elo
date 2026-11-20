/**
 * Ficha de avaliação para imprimir (A4, branca também no tema escuro): identificação, respostas por
 * dimensão, total, subtotais, faixa, assinaturas do profissional e do "ciente" da coordenação técnica.
 */
import { SimboloElo } from '@/ui/marca';
import type { AplicacaoDetalhada } from '../aplicacao/avaliacoes';

const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export function FichaEducacao({ a, instituicao, emitidoPor, emitidoEm }: { a: AplicacaoDetalhada; instituicao: string; emitidoPor: string; emitidoEm: string }) {
  const { resultado: r, instrumento } = a;
  return (
    <article className="folha mx-auto max-w-[210mm] rounded-cartao border border-borda px-[12mm] py-[10mm] text-[13px] leading-snug shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-destaque pb-3">
        <div>
          <p className="text-xs font-semibold text-destaque">Educação</p>
          <h1 className="text-xl font-bold leading-tight">{instrumento.nome}</h1>
          <p className="mt-0.5 text-texto-suave">Ficha de avaliação · período de {br(a.periodoInicio)} a {br(a.periodoFim)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right">
          <div>
            <p className="font-bold">{instituicao}</p>
            <p className="text-xs text-texto-suave">Elo · plataforma de gestão</p>
          </div>
          <SimboloElo tamanho={34} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div><dt className="inline text-texto-suave">Serviço: </dt><dd className="inline font-semibold">{a.servicoNome}</dd></div>
        <div><dt className="inline text-texto-suave">Usuário: </dt><dd className="inline font-semibold">{a.pessoaNome}</dd></div>
        <div><dt className="inline text-texto-suave">Data de ingresso: </dt><dd className="inline font-semibold">{br(a.dataIngresso)}</dd></div>
        <div><dt className="inline text-texto-suave">Período avaliado: </dt><dd className="inline font-semibold">{br(a.periodoInicio)} a {br(a.periodoFim)}</dd></div>
        <div><dt className="inline text-texto-suave">Profissional responsável: </dt><dd className="inline font-semibold">{a.profissional}</dd></div>
        <div><dt className="inline text-texto-suave">Função/categoria: </dt><dd className="inline font-semibold">{a.funcao}</dd></div>
      </dl>

      {instrumento.dominios.map((dom) => (
        <table key={dom.codigo} className="mt-4 w-full border-collapse break-inside-avoid">
          <caption className="border-b border-borda pb-1 text-left font-bold">{dom.nome}</caption>
          <tbody>
            {instrumento.itens
              .filter((i) => i.dominio === dom.codigo)
              .map((i) => (
                <tr key={i.numero} className="border-b border-borda">
                  <td className="py-1 pr-2">{i.numero}. {i.texto}</td>
                  <td className="w-16 py-1 text-texto-suave">{i.etiqueta ?? ''}</td>
                  <td className="w-10 py-1 text-right font-bold tabular-nums">{a.respostas[i.numero] ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}

      <section className="mt-4 break-inside-avoid rounded-cartao border border-borda p-3">
        <p>
          <span className="text-2xl font-bold tabular-nums">{r.total}</span> de {r.maximo} pontos
          {r.faixa && <> · <b>{r.faixa}</b></>}
        </p>
        <p className="mt-1 text-texto-suave">{r.subtotais.map((d) => `${d.nome}: ${d.pontos}/${d.maximo}`).join(' · ')}</p>
        {r.principalBarreira.length > 0 && <p className="mt-1">Principal barreira: <b>{r.principalBarreira.join(' e ')}</b></p>}
        {a.justificativa && <p className="mt-1"><b>Justificativa do enquadramento:</b> {a.justificativa}</p>}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-10 break-inside-avoid">
        <div className="border-t border-texto pt-1 text-center">
          Assinatura do profissional
          {a.dataAssinatura && <span className="block text-xs text-texto-suave">Concluída em {br(a.dataAssinatura)}</span>}
        </div>
        <div className="border-t border-texto pt-1 text-center">
          Ciente da coordenação técnica
          {a.cienteEm && <span className="block text-xs text-texto-suave">{a.cientePor} em {br(a.cienteEm.slice(0, 10))}</span>}
        </div>
      </section>

      <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-borda pt-2 text-[11px] text-texto-suave break-inside-avoid">
        <span>Documento com dados pessoais sensíveis (LGPD). Guarde em local restrito.</span>
        <span>Emitido em {emitidoEm} por {emitidoPor}</span>
      </footer>
    </article>
  );
}
