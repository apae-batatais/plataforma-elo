import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { DIMENSOES, INSTRUMENTOS_EDUCACAO, REFERENCIAIS } from '@/modulos/educacao/dados/instrumentos';
import { LEGENDA_FREQUENCIA, LEGENDA_NOTAS } from '@/modulos/educacao/dominio/educacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, Secao, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Sobre o instrumento de Educação' };

export default async function SobreOInstrumento() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.acessar)) redirect('/');
  const faixas = INSTRUMENTOS_EDUCACAO[0]!.faixas;
  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Educação', href: '/educacao' }, { rotulo: 'Sobre o instrumento' }]}
        titulo="Sobre o instrumento"
        descricao="Os três instrumentos de avaliação de evolução de Educação, como o Elo calcula o total e os subtotais e o que cada faixa significa."
      />

      <Secao titulo="Como a avaliação funciona">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Cada atendido é avaliado por período, com o instrumento do serviço dele. São 10 itens, cada um com nota de 0 a 3: no máximo 30 pontos.</li>
          <li>
            Os itens se agrupam em três dimensões: <b>Evolução</b> (itens 1 a 4, até 12 pontos), <b>Adequação</b> (itens 5 e 6, até 6 pontos) e{' '}
            <b>Barreira</b> (itens 7 a 10, até 12 pontos). O Elo mostra o total e o subtotal de cada dimensão, para ver qual está pesando no resultado.
          </li>
          <li>
            A nota alta é sempre a melhor: em Evolução e Adequação, 3 é a evolução ou a adequação plena; em Barreira, 3 é barreira ausente e 0 é barreira severa.
          </li>
          <li>A etiqueta CIF ao lado de cada item é só uma referência: ela não entra na conta.</li>
          <li>Ao concluir e assinar, a avaliação não muda mais. Para corrigir, o Elo cria uma nova e a anterior fica no histórico. A coordenação dá o ciente.</li>
        </ol>
      </Secao>

      <Secao titulo="Faixas do total (iguais nos três instrumentos)">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Faixas do total</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Pontos</th>
                <th scope="col" className={tabela.th}>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {[...faixas].reverse().map((f) => (
                <tr key={f.nome} className={tabela.linha}>
                  <td className={tabela.td}>{f.de} a {f.ate}</td>
                  <td className={tabela.td}>{f.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-texto-suave">
          A <b>principal barreira</b> é a dimensão com a menor pontuação em relação ao máximo dela (em percentual, porque as dimensões têm máximos
          diferentes: 12, 6 e 12). Em empate, aparecem todas as empatadas.
        </p>
        <p className="mt-2 text-sm text-texto-suave">Frequência e assiduidade (item 7), nos três instrumentos: {LEGENDA_FREQUENCIA.join(' · ')}.</p>
        {DIMENSOES.map((d) => (
          <p key={d.codigo} className="mt-1 text-sm text-texto-suave">
            <b>{d.nome}:</b> {LEGENDA_NOTAS[d.codigo].join(' · ')}.
          </p>
        ))}
      </Secao>

      {INSTRUMENTOS_EDUCACAO.map((i) => (
        <Secao key={i.codigo} titulo={`${i.nome} (versão ${i.versao})`}>
          <p className="mb-3 text-sm text-texto-suave">Referenciais: {REFERENCIAIS[i.codigo]}</p>
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Itens do instrumento {i.nome}</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Item</th>
                  <th scope="col" className={tabela.th}>Dimensão</th>
                  <th scope="col" className={tabela.th}>CIF</th>
                </tr>
              </thead>
              <tbody>
                {i.itens.map((x) => (
                  <tr key={x.numero} className={tabela.linha}>
                    <td className={tabela.td}>{x.numero}. {x.texto}</td>
                    <td className={tabela.td}>{i.dominios.find((dd) => dd.codigo === x.dominio)?.nome}</td>
                    <td className={tabela.td}>{x.etiqueta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      ))}
    </div>
  );
}
