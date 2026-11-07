import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { BARREIRAS, DEFINICAO_GRAU, MESES_ENTRE_AVALIACOES } from '@/modulos/avaliacao/dominio/avaliacao';
import { DECISOES_TECNICAS, FUNDAMENTOS, NORMAS } from '@/modulos/avaliacao/dominio/fundamentos';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, Secao, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Sobre o instrumento' };

export default async function SobreOInstrumento() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.acessar)) redirect('/');
  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' }, { rotulo: 'Sobre o instrumento' }]}
        titulo="Sobre o instrumento"
        descricao="De onde vêm as perguntas da Avaliação de Serviços Sociais, quando ela é feita e como o índice de necessidade de cuidado é calculado."
      />

      <Secao titulo="Quando a avaliação é feita">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <b>Inicial:</b> quando a pessoa é encaminhada ao serviço. É o ponto de partida do plano de atendimento.
          </li>
          <li>
            <b>Acompanhamento anual:</b> a cada {MESES_ENTRE_AVALIACOES} meses depois da última avaliação. A lista avisa 30 dias antes do vencimento e mostra as
            atrasadas.
          </li>
          <li>
            <b>Comparativo:</b> com duas ou mais avaliações, o Elo compara a primeira e a última da mesma pessoa e mostra o que melhorou ou piorou.
          </li>
        </ol>
      </Secao>

      <Secao titulo="Fundamento de cada grupo de perguntas">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Grupos de perguntas e a base legal de cada um</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>
                  Grupo
                </th>
                <th scope="col" className={tabela.th}>
                  Perguntas
                </th>
                <th scope="col" className={tabela.th}>
                  Base técnica e legal
                </th>
              </tr>
            </thead>
            <tbody>
              {FUNDAMENTOS.map((f) => (
                <tr key={f.grupo} className={tabela.linha}>
                  <th scope="row" className={`${tabela.td} text-left font-semibold`}>
                    {f.grupo}
                  </th>
                  <td className={tabela.td}>{f.perguntas}</td>
                  <td className={tabela.td}>{f.base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Normas de referência">
        <dl className="grid gap-3 md:grid-cols-2">
          {NORMAS.map((n) => (
            <div key={n.sigla} className="rounded-cartao border border-borda bg-superficie px-5 py-4">
              <dt>
                <span className="font-bold text-destaque">{n.sigla}</span>
                <span className="block text-sm text-texto-suave">{n.nome}</span>
              </dt>
              <dd className="mt-1.5 text-sm">{n.usoNoInstrumento}</dd>
            </div>
          ))}
        </dl>
      </Secao>

      <Secao titulo="Grau de dependência (RDC Anvisa 502/2021)">
        <ul className="space-y-1.5">
          {(['I', 'II', 'III'] as const).map((g) => (
            <li key={g}>
              <b>Grau {g}:</b> {DEFINICAO_GRAU[g]}
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Índice de necessidade de cuidado (0 a 12)">
        <p>
          Grau de dependência II vale 1 ponto e grau III vale 2. Cada um destes soma 1 ponto: isolamento social, sobrecarga do cuidador, ausência de apoio
          adequado, sem rede de apoio, cuidador idoso, mãe solo, pessoa regrediu, família regrediu, suspeita de violação de direitos (
          {BARREIRAS.filter((b) => b.violacao)
            .map((b) => b.nome.replace('Suspeita de ', '').toLowerCase())
            .join(', ')}
          ) e cuidados de saúde (apoio de enfermagem ou ostomia).
        </p>
      </Secao>

      <Secao titulo="Decisões técnicas da instituição">
        <ul className="list-disc space-y-1.5 pl-5">
          {DECISOES_TECNICAS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-texto-suave">
          As referências são normas federais vigentes na data desta versão. Mudanças de norma ou de critério devem ser revisadas pela equipe técnica e pela
          assessoria jurídica antes de alterar o instrumento.
        </p>
      </Secao>
    </div>
  );
}
