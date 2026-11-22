import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { detalharAplicacao, pessoasParaAvaliar, PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { ErroSaude } from '@/modulos/saude/dominio/cer';
import { FormularioAplicacao } from '@/modulos/saude/telas/formulario-aplicacao';
import { ResumoAplicacao } from '@/modulos/saude/telas/resumo-aplicacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { acaoDarCiente, acaoDesistir, acaoSalvarAplicacao } from '../acoes';

export const metadata: Metadata = { title: 'Avaliação de Saúde' };

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function AbrirAvaliacaoDeSaude({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  let a;
  try {
    a = await detalharAplicacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroSaude || erro instanceof ErroPermissao) redirect(`/saude?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Saúde', href: '/saude' }, { rotulo: a.pessoaNome }];
  const periodo = `${br(a.periodoInicio)} a ${br(a.periodoFim)}`;

  if (a.situacao === 'aberta') {
    const pessoas = await pessoasParaAvaliar(app.planilhas, usuario.autorizador);
    return (
      <div>
        <CabecalhoPagina
          trilha={trilha}
          titulo={`Avaliação de ${a.pessoaNome}`}
          descricao={`Rascunho · ${a.servicoNome} · período de ${periodo}. Complete e conclua quando estiver pronta.`}
          acoes={
            <FormularioConfirmado
              acao={acaoDesistir}
              campos={{ id: a.id, versao: a.versao }}
              rotulo="Desistir do rascunho"
              pequeno
              variante="secundario"
              titulo="Desistir deste rascunho?"
              mensagem="Ele sai da lista, mas continua guardado na planilha com o motivo. Depois você pode começar outra avaliação desta pessoa."
              confirmar="Desistir"
            >
              <Campo rotulo="Motivo" obrigatorio>
                <input name="motivo" required minLength={3} className={estiloEntrada} placeholder="Ex.: começada por engano" />
              </Campo>
            </FormularioConfirmado>
          }
        />
        <FormularioAplicacao
          pessoas={pessoas.some((x) => x.id === a.pessoaId) ? pessoas : [...pessoas, { id: a.pessoaId, nome: a.pessoaNome, servicos: [{ codigo: a.servico, nome: a.servicoNome, entrada: null }] }]}
          instrumento={a.instrumento}
          inicial={{
            pessoaId: a.pessoaId,
            servico: a.servico,
            periodoInicio: a.periodoInicio,
            periodoFim: a.periodoFim,
            dataIngresso: a.dataIngresso,
            profissional: a.profissional,
            funcao: a.funcao,
            justificativa: a.justificativa,
            respostas: { ...a.respostas } as Record<number, number | undefined>,
          }}
          acao={acaoSalvarAplicacao}
          id={a.id}
          versao={a.versao}
          corrige={a.corrige ?? undefined}
          pessoaFixa
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={trilha}
        titulo={`Avaliação de ${a.pessoaNome}`}
        descricao={
          <>
            {a.servicoNome} · período de {periodo} · ingresso em {br(a.dataIngresso)} · {a.profissional}, {a.funcao}
            {a.dataAssinatura && <> · assinada em {br(a.dataAssinatura)}</>}
          </>
        }
        acoes={
          <>
            {a.podeDarCiente && (
              <FormularioConfirmado
                acao={acaoDarCiente}
                campos={{ id: a.id, versao: a.versao }}
                rotulo="Dar o ciente"
                pequeno
                perigoso={false}
                variante="primario"
                titulo="Dar o ciente da coordenação técnica?"
                mensagem="O Elo registra o seu nome e a data. As respostas não mudam."
                confirmar="Dar o ciente"
              />
            )}
            <LinkBotao href={`/saude/${a.id}/comparativo`} variante="secundario" className={pequeno}>
              Comparar
            </LinkBotao>
            <LinkBotao href={`/saude/${a.id}/ficha`} variante="secundario" className={pequeno}>
              Imprimir ficha
            </LinkBotao>
            {!a.corrigida && (
              <LinkBotao href={`/saude/nova?corrige=${a.id}`} variante="secundario" className={pequeno}>
                Corrigir
              </LinkBotao>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {a.cienteEm ? (
          <Etiqueta tipo="sucesso">
            Ciente de {a.cientePor} em {br(a.cienteEm.slice(0, 10))}
          </Etiqueta>
        ) : (
          <Etiqueta tipo="info">Aguardando o ciente da coordenação técnica</Etiqueta>
        )}
        {a.proximaAvaliacao && <span className="text-texto-suave">Próxima avaliação até {br(a.proximaAvaliacao)}.</span>}
      </div>
      {a.corrigida && (
        <Aviso tipo="info">Esta avaliação foi corrigida por outra mais recente. Ela continua guardada aqui, no histórico.</Aviso>
      )}
      {a.corrige && <Aviso tipo="info">Esta avaliação corrige uma anterior, que continua guardada no histórico.</Aviso>}
      <ResumoAplicacao a={a} />
    </div>
  );
}
