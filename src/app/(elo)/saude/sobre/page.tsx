import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { ENCAMINHAMENTO_POR_FAIXA, FAIXAS_FREQUENCIA, INSTRUMENTO_CER, LEGENDA_NIVEIS, MESES_ENTRE_AVALIACOES } from '@/modulos/saude/dominio/cer';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, Secao, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Sobre o instrumento de Saúde' };

export default async function SobreOInstrumentoDeSaude() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.acessar)) redirect('/');
  const i = INSTRUMENTO_CER;
  const maximo = i.itens.length * 3;
  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Saúde', href: '/saude' }, { rotulo: 'Sobre o instrumento' }]}
        titulo="Sobre o instrumento"
        descricao="O que o instrumento do CER mede, como as notas viram pontos e quando a avaliação se repete."
      />

      <Secao titulo="De onde vem">
        <p>
          Escala de 0 a 3, estruturada a partir da CIF (Classificação Internacional de Funcionalidade, componentes b/s, d e e), em consonância com os protocolos do SUS e do
          PRONAS/PCD. É o instrumento validado pela Diretoria, na versão {i.versao}. Cada item mostra ao lado a sua etiqueta CIF; ela é só informação e não entra na conta.
        </p>
      </Secao>

      <Secao titulo="Os itens">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Itens do instrumento do CER</caption>
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
                  <td className={tabela.td}>{i.dominios.find((d) => d.codigo === x.dominio)?.nome}</td>
                  <td className={tabela.td}>{x.etiqueta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Como o Elo calcula">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            O <b>total</b> é a soma dos 10 itens (de 0 a {maximo}). Os <b>subtotais</b> são Evolução (itens 1 a 4, de 0 a 12), Adequação (itens 5 e 6, de 0 a 6) e Barreira (itens 7 a 10, de 0 a 12).
          </li>
          <li>
            A <b>principal barreira</b> é a dimensão de menor pontuação em percentual do máximo dela (12, 6 e 12 pontos). Em empate, aparecem todas as empatadas.
          </li>
          <li>
            Em Barreira, <b>nota alta é melhor</b>: 3 = barreira ausente e 0 = barreira severa.
          </li>
          <li>
            Item 7 (frequência): {FAIXAS_FREQUENCIA.map((f, n) => `${n} = ${f}`).join(' · ')}.
          </li>
          <li>Nada disso é guardado na planilha: o Elo calcula a cada vez que a avaliação é aberta.</li>
        </ul>
      </Secao>

      <Secao titulo="Faixas do total">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Faixas do total</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Pontos</th>
                <th scope="col" className={tabela.th}>Enquadramento</th>
                <th scope="col" className={tabela.th}>O que fazer</th>
              </tr>
            </thead>
            <tbody>
              {[...i.faixas].reverse().map((f) => (
                <tr key={f.nome} className={tabela.linha}>
                  <td className={`${tabela.td} tabular-nums`}>{f.de} a {f.ate}</td>
                  <td className={tabela.td}><b>{f.nome}</b></td>
                  <td className={tabela.td}>{ENCAMINHAMENTO_POR_FAIXA[f.nome]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="O que significa cada nota">
        <ul className="space-y-1">
          {LEGENDA_NIVEIS.map((n) => (
            <li key={n.nota}>
              <b>{n.nota}</b>: {n.evolucao} (em Barreira: {n.barreira.toLowerCase()})
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-texto-suave">O documento não traz o texto de cada nota por item; esta é a legenda geral.</p>
      </Secao>

      <Secao titulo="Quando se repete">
        <p>
          A avaliação é feita por período. A próxima vence {MESES_ENTRE_AVALIACOES} meses depois da última concluída. Depois de concluída, a avaliação não se edita: a correção cria uma nova e a
          anterior fica guardada. A coordenação técnica dá o “ciente” no próprio Elo.
        </p>
      </Secao>
    </div>
  );
}
