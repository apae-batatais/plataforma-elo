import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dominiosDeMenorPercentual } from '@/capacidades/motor-avaliacao';
import { detalharAplicacao } from '@/modulos/avaliacao/aplicacao/aplicacoes';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { FormularioAplicacao } from '@/modulos/avaliacao/telas/formulario-aplicacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { acaoCorrigirAplicacao, acaoDesistirAplicacao, acaoSalvarAplicacao } from '../../acoes';

export const metadata: Metadata = { title: 'Aplicação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function Aplicacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let a;
  try {
    a = await detalharAplicacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) redirect(`/avaliacao/instrumentos?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const trilha = [
    { rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' },
    { rotulo: 'Assistência Social', href: '/avaliacao' },
    { rotulo: 'Instrumentos', href: '/avaliacao/instrumentos' },
    { rotulo: `${a.iniciais} · ${a.instrumento.nome}` },
  ];
  const tipo = a.tipo === 'Anual' ? 'Acompanhamento anual' : 'Inicial';
  const descricao = `${tipo} · ${a.servicoNome} · ${br(a.data)}`;

  if (a.situacao === 'aberta') {
    return (
      <div>
        <CabecalhoPagina
          trilha={trilha}
          titulo={`${a.instrumento.nome} · ${a.iniciais}`}
          descricao={`${descricao}. Em aberto: continue de onde parou.${a.corrige ? ' Esta aplicação corrige uma anterior.' : ''}`}
          acoes={
            <FormularioConfirmado
              acao={acaoDesistirAplicacao}
              campos={{ id: a.id, versao: a.versao }}
              rotulo="Desistir desta aplicação"
              pequeno
              titulo="Desistir desta aplicação?"
              mensagem="Ela deixa de contar, mas continua guardada. Escreva o motivo."
              confirmar="Desistir"
            >
              <Campo rotulo="Motivo" obrigatorio>
                <input name="motivo" required className={estiloEntrada} autoComplete="off" />
              </Campo>
            </FormularioConfirmado>
          }
        />
        <FormularioAplicacao
          instrumento={a.instrumento}
          pessoas={[{ id: a.pessoaId, nome: a.iniciais, iniciais: a.iniciais, servicos: [{ codigo: a.servico, nome: a.servicoNome }] }]}
          hoje={hojeBrasilia()}
          acao={acaoSalvarAplicacao}
          id={a.id}
          versao={a.versao}
          inicial={{
            pessoaId: a.pessoaId,
            servico: a.servico,
            tipo: a.tipo,
            data: a.data,
            respostas: a.respostas,
            profissional: a.profissional,
            registroProfissional: a.registroProfissional,
            justificativa: a.justificativa,
          }}
        />
      </div>
    );
  }

  const menores = dominiosDeMenorPercentual(a.escore);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo={`${a.instrumento.nome} · ${a.iniciais}`}
        descricao={`${descricao}. Concluída e assinada: não se edita.`}
        acoes={
          <>
            <LinkBotao href={`/avaliacao/aplicacao/${a.id}/comparativo`} variante="secundario" className={pequeno}>
              Comparativo da pessoa
            </LinkBotao>
            {!a.corrigidaPor && (
              <FormularioConfirmado
                acao={acaoCorrigirAplicacao}
                campos={{ id: a.id }}
                rotulo="Corrigir"
                pequeno
                variante="secundario"
                perigoso={false}
                titulo="Corrigir esta aplicação?"
                mensagem="Esta aplicação não pode ser editada. A correção cria uma nova aplicação, com as mesmas respostas, para você ajustar e assinar de novo. Esta continua no histórico."
                confirmar="Criar correção"
              />
            )}
          </>
        }
      />
      {a.corrigidaPor && (
        <Aviso tipo="info" titulo="Esta aplicação foi corrigida">
          <Link href={`/avaliacao/aplicacao/${a.corrigidaPor}`} className="font-semibold underline">
            Abrir a correção
          </Link>
          . Só a correção entra no comparativo.
        </Aviso>
      )}
      {a.corrige && (
        <Aviso tipo="info" titulo="Esta aplicação corrige outra">
          <Link href={`/avaliacao/aplicacao/${a.corrige}`} className="font-semibold underline">
            Ver a aplicação anterior
          </Link>
        </Aviso>
      )}
      <Secao titulo={`Escore total: ${a.escore.total} de ${a.escore.maximo}`}>
        <p>
          Enquadramento: <Etiqueta tipo="info">{a.escore.enquadramento?.nome ?? 'sem faixa'}</Etiqueta>
        </p>
        <p className="mt-2">
          <b>Justificativa:</b> {a.justificativa}
        </p>
        {menores.length > 0 && (
          <p className="mt-2 text-sm text-texto-suave">Domínio de menor pontuação relativa: {menores.map((d) => d.nome).join(', ')}.</p>
        )}
        {(a.profissional || a.registroProfissional) && (
          <p className="mt-2 text-sm text-texto-suave">
            Assinada por {a.profissional || 'profissional não informado'}
            {a.registroProfissional ? ` (registro ${a.registroProfissional})` : ''}.
          </p>
        )}
      </Secao>
      <Secao titulo="Escore por domínio">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Escore por domínio</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Domínio</th>
                <th scope="col" className={`${tabela.th} text-right`}>Pontos</th>
                <th scope="col" className={`${tabela.th} text-right`}>Itens considerados</th>
              </tr>
            </thead>
            <tbody>
              {a.escore.dominios.map((d) => (
                <tr key={d.codigo} className={tabela.linha}>
                  <td className={tabela.td}>{d.nome}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>{d.pontos} de {d.maximo}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>{d.itensConsiderados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
      <Secao titulo="Respostas">
        <ol className="space-y-1">
          {a.instrumento.itens.map((i) => (
            <li key={i.numero} className="flex justify-between gap-4 border-b border-borda py-1.5">
              <span>
                {i.numero}. {i.texto}
              </span>
              <b className="whitespace-nowrap">{a.respostas[i.numero] === 'nao_se_aplica' ? 'Não se aplica' : a.respostas[i.numero]}</b>
            </li>
          ))}
        </ol>
      </Secao>
    </div>
  );
}
