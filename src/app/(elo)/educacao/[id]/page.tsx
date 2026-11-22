import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { detalharAplicacao, opcoesParaNova, PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { ErroEducacao, LEGENDA_FREQUENCIA, LEGENDA_NOTAS, ITEM_FREQUENCIA } from '@/modulos/educacao/dominio/educacao';
import { FormularioAplicacao } from '@/modulos/educacao/telas/formulario-aplicacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { acaoCorrigirAplicacao, acaoDarCiente, acaoDesistirAplicacao, acaoSalvarAplicacao } from '../acoes';

export const metadata: Metadata = { title: 'Avaliação de Educação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export default async function AbrirAvaliacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  let a;
  try {
    a = await detalharAplicacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroEducacao || erro instanceof ErroPermissao) redirect(`/educacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Educação', href: '/educacao' }, { rotulo: a.pessoaNome }];
  const periodo = a.periodoInicio || a.periodoFim ? `${br(a.periodoInicio)} a ${br(a.periodoFim)}` : 'período ainda não informado';

  if (a.situacao === 'aberta') {
    const opcoes = await opcoesParaNova(app.planilhas, usuario.autorizador);
    const instrumento = opcoes.instrumentos.find((i) => i.codigo === a.instrumento.codigo) ?? {
      codigo: a.instrumento.codigo,
      nome: a.instrumento.nome,
      versao: a.instrumento.versao,
      referenciais: a.referenciais,
      instrumento: a.instrumento,
    };
    // Rascunho de uma versão anterior do instrumento continua nela.
    const instrumentos = [instrumento.instrumento.versao === a.instrumento.versao ? instrumento : { ...instrumento, instrumento: a.instrumento }];
    const servicos = opcoes.servicos.some((s) => s.codigo === a.servico) ? opcoes.servicos : [...opcoes.servicos, { codigo: a.servico, nome: a.servicoNome, instrumentoSugerido: null }];
    return (
      <div className="space-y-5">
        <CabecalhoPagina
          trilha={trilha}
          titulo={`Avaliação de ${a.pessoaNome}`}
          descricao={`Rascunho · ${a.servicoNome} · ${a.instrumento.nome} · ${periodo}${a.corrige ? ' · correção de uma avaliação concluída' : ''}. Continue de onde parou.`}
        />
        <FormularioAplicacao
          pessoas={[]}
          servicos={servicos}
          instrumentos={instrumentos}
          hoje={hojeBrasilia()}
          nomePessoaTravada={a.pessoaNome}
          acao={acaoSalvarAplicacao}
          inicial={{
            id: a.id,
            versao: a.versao,
            pessoaId: a.pessoaId,
            servico: a.servico,
            instrumento: a.instrumento.codigo,
            periodoInicio: a.periodoInicio ?? '',
            periodoFim: a.periodoFim ?? '',
            dataIngresso: a.dataIngresso ?? '',
            profissional: a.profissional ?? '',
            funcao: a.funcao ?? '',
            justificativa: a.justificativa ?? '',
            respostas: a.respostas as Record<number, number>,
          }}
        />
        <div className="max-w-xl rounded-cartao border border-borda bg-superficie p-4">
          <FormularioConfirmado
            acao={acaoDesistirAplicacao}
            campos={{ id: a.id, versao: a.versao }}
            rotulo="Descartar este rascunho"
            titulo="Descartar o rascunho?"
            mensagem="O rascunho sai da lista e deixa de contar. Nada é apagado: o motivo fica registrado."
            confirmar="Descartar"
            variante="secundario"
            pequeno
          >
            <Campo rotulo="Motivo" obrigatorio>
              <input name="motivo" required minLength={3} className={estiloEntrada} autoComplete="off" />
            </Campo>
          </FormularioConfirmado>
        </div>
      </div>
    );
  }

  const r = a.resultado;
  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo={`Avaliação de ${a.pessoaNome}`}
        descricao={`${a.servicoNome} · ${a.instrumento.nome} · período ${periodo}`}
        acoes={
          <>
            {a.podeDarCiente && (
              <form action={acaoDarCiente}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="versao" value={a.versao} />
                <BotaoEnviar enviando="Registrando…">Dar o ciente</BotaoEnviar>
              </form>
            )}
            <LinkBotao href={`/educacao/${a.id}/comparativo`} variante="secundario" className={pequeno}>
              Comparar
            </LinkBotao>
            <LinkBotao href={`/educacao/${a.id}/ficha`} variante="secundario" className={pequeno}>
              Imprimir ficha
            </LinkBotao>
            {!a.corrigidaPor && (
              <FormularioConfirmado
                acao={acaoCorrigirAplicacao}
                campos={{ id: a.id }}
                rotulo="Corrigir"
                titulo="Corrigir esta avaliação?"
                mensagem="Esta avaliação concluída não muda. O Elo cria uma nova avaliação aberta, com as mesmas respostas, para você ajustar e concluir. A anterior fica no histórico."
                confirmar="Criar a correção"
                variante="secundario"
                perigoso={false}
              />
            )}
          </>
        }
      />

      {a.corrigidaPor && (
        <Aviso tipo="atencao" titulo="Esta avaliação foi corrigida">
          Os números válidos estão na correção.{' '}
          <Link href={`/educacao/${a.corrigidaPor}`} className="font-semibold underline">
            Abrir a correção
          </Link>
        </Aviso>
      )}
      {a.corrige && (
        <Aviso tipo="info">
          Esta avaliação corrige outra.{' '}
          <Link href={`/educacao/${a.corrige}`} className="font-semibold underline">
            Ver a anterior
          </Link>
        </Aviso>
      )}

      <section aria-label="Resultado" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-cartao border border-borda bg-superficie p-4">
          <p className="text-sm text-texto-suave">Total</p>
          <p className="text-3xl font-bold tabular-nums text-destaque">
            {r.total} <span className="text-base font-normal text-texto-suave">de {r.maximo}</span>
          </p>
        </div>
        {r.subtotais.map((s) => (
          <div key={s.codigo} className="rounded-cartao border border-borda bg-superficie p-4">
            <p className="text-sm text-texto-suave">{s.nome}</p>
            <p className="text-3xl font-bold tabular-nums">
              {s.pontos} <span className="text-base font-normal text-texto-suave">de {s.maximo}</span>
            </p>
          </div>
        ))}
      </section>

      <Aviso tipo="info" titulo={`Faixa: ${r.faixa ?? '—'}`}>
        {r.principalBarreira.length > 0 && (
          <p>
            Principal barreira (dimensão com menor pontuação em relação ao máximo): <b>{r.principalBarreira.join(' e ')}</b>.
          </p>
        )}
        <p className="text-texto-suave">Faixas: 21 a 30 · 11 a 20 · 0 a 10 pontos.</p>
      </Aviso>

      <Secao titulo="Respostas">
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Respostas por item</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Item</th>
                <th scope="col" className={tabela.th}>Dimensão</th>
                <th scope="col" className={tabela.th}>CIF</th>
                <th scope="col" className={tabela.th}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {a.instrumento.itens.map((i) => {
                const nota = a.respostas[i.numero];
                const legenda = i.numero === ITEM_FREQUENCIA ? LEGENDA_FREQUENCIA : LEGENDA_NOTAS[i.dominio as keyof typeof LEGENDA_NOTAS];
                return (
                  <tr key={i.numero} className={tabela.linha}>
                    <td className={tabela.td}>
                      {i.numero}. {i.texto}
                    </td>
                    <td className={tabela.td}>{a.instrumento.dominios.find((d) => d.codigo === i.dominio)?.nome}</td>
                    <td className={tabela.td}>{i.etiqueta ?? '—'}</td>
                    <td className={tabela.td}>{typeof nota === 'number' ? (legenda?.[nota] ?? nota) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Justificativa e assinatura">
        <p className="whitespace-pre-line">{a.justificativa}</p>
        <p className="mt-3 text-sm text-texto-suave">
          Profissional: {a.profissional} ({a.funcao}) · ingresso no serviço em {br(a.dataIngresso)} · concluída e assinada em {br(a.dataAssinatura)}.
        </p>
        <p className="mt-1 text-sm">
          {a.cientePor ? (
            <Etiqueta tipo="info">{`Ciente da coordenação técnica em ${br(a.cienteEm)} (${a.cientePor})`}</Etiqueta>
          ) : (
            <Etiqueta>Aguardando o ciente da coordenação técnica</Etiqueta>
          )}
        </p>
      </Secao>
    </div>
  );
}
