import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { instrumentosDoCer, PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina, Secao, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Instrumentos de Saúde' };

const link = 'font-semibold text-destaque underline-offset-2 hover:underline';

export default async function Instrumentos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  const { atual: i } = await instrumentosDoCer(app.planilhas);
  return (
    <div className="space-y-8">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Saúde', href: '/saude' }, { rotulo: 'Instrumentos' }]}
        titulo="Instrumentos"
        descricao="O instrumento do CER, na versão em uso, com escala de 0 a 3."
      />
      <Secao titulo="Instrumentos disponíveis">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Instrumentos de Saúde</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Instrumento</th>
                <th scope="col" className={tabela.th}>Versão</th>
                <th scope="col" className={tabela.th}>Domínios e itens</th>
                <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              <tr className={tabela.linha}>
                <td className={tabela.td}><b>{i.nome}</b></td>
                <td className={tabela.td}>{i.versao}</td>
                <td className={tabela.td}>{i.dominios.length} domínios · {i.itens.length} itens</td>
                <td className={`${tabela.td} whitespace-nowrap text-right`}>
                  <LinkBotao href="/saude/nova" className={pequeno}>Aplicar a uma pessoa</LinkBotao>
                  <span className="text-texto-suave" aria-hidden="true">{' · '}</span>
                  <Link href="/saude/sobre" className={link}>Sobre o instrumento</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}
