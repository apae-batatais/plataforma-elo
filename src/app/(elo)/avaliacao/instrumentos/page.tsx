import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarAplicacoes, listarInstrumentos } from '@/modulos/avaliacao/aplicacao/aplicacoes';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Instrumentos' };

const br = (iso: string) => iso.split('-').reverse().join('/');
const link = 'font-semibold text-destaque underline-offset-2 hover:underline';
const EIXOS = { assistencia: 'Assistência Social', educacao: 'Educação', saude: 'Saúde/CER' } as const;

export default async function Instrumentos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const [instrumentos, aplicacoes] = await Promise.all([
    listarInstrumentos(app.planilhas, usuario.autorizador),
    listarAplicacoes(app.planilhas, usuario.autorizador),
  ]);
  return (
    <div className="space-y-8">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' }, { rotulo: 'Instrumentos' }]}
        titulo="Instrumentos"
        descricao="Instrumentos com escala de 0 a 3, aplicados a pessoas do Cadastro Único. As pessoas aparecem só pelas iniciais."
      />
      <Secao titulo="Instrumentos disponíveis">
        {instrumentos.length === 0 ? (
          <EstadoVazio titulo="Nenhum instrumento cadastrado ainda.">Os instrumentos são cadastrados pela equipe técnica do Elo.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Instrumentos disponíveis</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Instrumento</th>
                  <th scope="col" className={tabela.th}>Eixo</th>
                  <th scope="col" className={tabela.th}>Versão</th>
                  <th scope="col" className={tabela.th}>Domínios e itens</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {instrumentos.map((i) => (
                  <tr key={i.codigo} className={tabela.linha}>
                    <td className={tabela.td}><b>{i.nome}</b></td>
                    <td className={tabela.td}>{EIXOS[i.eixo]}</td>
                    <td className={tabela.td}>{i.versao}{i.usado && <span className="block text-xs text-texto-suave">já aplicada</span>}</td>
                    <td className={tabela.td}>{i.dominios} domínios · {i.itens} itens</td>
                    <td className={`${tabela.td} text-right`}>
                      <LinkBotao href={`/avaliacao/aplicar/${i.codigo}`} className={pequeno}>Aplicar a uma pessoa</LinkBotao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
      <Secao titulo="Aplicações">
        {aplicacoes.length === 0 ? (
          <EstadoVazio titulo="Nenhuma aplicação ainda.">Escolha um instrumento acima e aplique a uma pessoa.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Aplicações de instrumentos</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Pessoa</th>
                  <th scope="col" className={tabela.th}>Instrumento</th>
                  <th scope="col" className={tabela.th}>Serviço</th>
                  <th scope="col" className={tabela.th}>Data</th>
                  <th scope="col" className={tabela.th}>Situação</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {aplicacoes.map((a) => (
                  <tr key={a.id} className={tabela.linha}>
                    <td className={tabela.td}><b>{a.iniciais}</b></td>
                    <td className={tabela.td}>{a.instrumentoNome}<span className="block text-xs text-texto-suave">{a.tipo === 'Anual' ? 'Acompanhamento anual' : 'Inicial'}</span></td>
                    <td className={tabela.td}>{a.servicoNome}</td>
                    <td className={tabela.td}>{br(a.data)}</td>
                    <td className={tabela.td}>
                      {a.situacao === 'aberta' ? <Etiqueta tipo="atencao">Em aberto</Etiqueta> : a.corrigida ? <Etiqueta>Corrigida</Etiqueta> : <Etiqueta tipo="sucesso">Concluída</Etiqueta>}
                      {a.corrige && <span className="block text-xs text-texto-suave">correção</span>}
                    </td>
                    <td className={`${tabela.td} whitespace-nowrap text-right`}>
                      <Link href={`/avaliacao/aplicacao/${a.id}`} className={link} aria-label={`Abrir aplicação de ${a.iniciais} em ${br(a.data)}`}>Abrir</Link>
                      {a.situacao === 'fechada' && !a.corrigida && (
                        <>
                          <span className="text-texto-suave" aria-hidden="true">{' · '}</span>
                          <Link href={`/avaliacao/aplicacao/${a.id}/comparativo`} className={link} aria-label={`Comparativo de ${a.iniciais}`}>Comparativo</Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
