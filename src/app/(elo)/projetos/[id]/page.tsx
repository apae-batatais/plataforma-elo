import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { NOME_ITEM } from '@/modulos/projetos/dominio/fases';
import { FormularioConfirmado } from '@/ui/confirmar';
import Link from 'next/link';
import { lerFicha, type PortaDetalhe } from '@/modulos/projetos/aplicacao/portas';
import { servicosParaEscolher } from '@/modulos/projetos/aplicacao/ideias';
import {
  NOME_DECISAO,
  NOME_PARECER,
  NOME_PORTA,
  NOME_PORTE,
  NOME_RESULTADO,
  NOME_SITUACAO_PORTA,
  NOME_TIPO,
  RESULTADOS_PARECER,
  DECISOES,
} from '@/modulos/projetos/dominio/projeto';
import { FormularioIdeia } from '@/modulos/projetos/telas/formulario-ideia';
import { EtiquetaEtapa, moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import {
  acaoAbrirPorta,
  acaoAvancarFase,
  acaoAssumirIdeia,
  acaoCancelarProjeto,
  acaoDarParecer,
  acaoDecidirPorta,
  acaoEnviarIdeia,
  acaoIniciarImplementacao,
  acaoRetomarProjeto,
  acaoSalvarIdeia,
  acaoTrocarResponsavel,
} from '../acoes';

export const metadata: Metadata = { title: 'Projeto' };

/** Itens da fase que têm tela própria (os demais são formulários em /fase/<item>). */
const ROTA_ITEM: Partial<Record<string, string>> = { marco_logico: '/marco-logico', riscos: '/riscos', atividades: '/atividades', orcamento: '/orcamento' };

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function BlocoPorta({ d, f, pode }: { d: PortaDetalhe; f: NonNullable<Awaited<ReturnType<typeof lerFicha>>>; pode: boolean }) {
  const { porta } = d;
  return (
    <Secao id={`porta-${porta.id}`} titulo={NOME_PORTA[porta.tipo]} descricao={NOME_SITUACAO_PORTA[porta.situacao]}>
      <div className="space-y-4">
        <p className="text-sm text-texto-suave">
          Aberta em {dataHora(porta.aberta_em)} · valor considerado {moeda(porta.valor_considerado)}
        </p>
        {porta.exige_alcada && <Aviso tipo="info">Este valor passa do limite: a decisão sobe para a Presidência ou o Conselho.</Aviso>}
        {d.exigidos.length === 0 ? (
          <p>Esta porta não exige pareceres.</p>
        ) : (
          <div>
            <h3 className="font-semibold">Pareceres</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {d.exigidos.map((t) => {
                const dado = d.pareceres.find((x) => x.tipo === t);
                const pendente = d.faltando.includes(t);
                return (
                  <li key={t} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{NOME_PARECER[t]}:</span>
                    {pendente ? <Etiqueta tipo="atencao">Pendente</Etiqueta> : dado ? <Etiqueta tipo="info">{NOME_RESULTADO[dado.resultado]}</Etiqueta> : <Etiqueta tipo="sucesso">Dado</Etiqueta>}
                    {dado?.texto && <span className="text-texto-suave">— {dado.texto}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {d.decisoes.length > 0 && (
          <div>
            <h3 className="font-semibold">Decisões</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {d.decisoes.map((x) => (
                <li key={x.id}>
                  <span className="font-medium">{x.nivel === 'alcada' ? 'Presidência ou Conselho' : 'Diretoria'}: {NOME_DECISAO[x.decisao]}</span> · {dataHora(x.em)}
                  <span className="block text-texto-suave">{x.justificativa}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pode && f.pode.parecerDos.map((t) => (
          <form key={t} action={acaoDarParecer} className="space-y-3 rounded-md border border-borda p-4">
            <input type="hidden" name="id" value={f.projeto.id} />
            <input type="hidden" name="porta" value={porta.id} />
            <input type="hidden" name="tipo" value={t} />
            <h3 className="font-semibold">Dar meu parecer ({NOME_PARECER[t].toLowerCase()})</h3>
            <Campo rotulo="Resultado" obrigatorio>
              <select name="resultado" required className={estiloEntrada} defaultValue="">
                <option value="" disabled>Escolha</option>
                {RESULTADOS_PARECER.map((r) => (
                  <option key={r} value={r}>{NOME_RESULTADO[r]}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Texto do parecer" dica="Obrigatório quando houver ressalvas ou o resultado for insatisfatório.">
              <textarea name="texto" rows={3} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Registrando…">Registrar parecer</BotaoEnviar>
          </form>
        ))}
        {pode && (f.pode.decidir || f.pode.decidirAlcada) && (
          <form action={acaoDecidirPorta} className="space-y-3 rounded-md border border-borda p-4">
            <input type="hidden" name="id" value={f.projeto.id} />
            <input type="hidden" name="porta" value={porta.id} />
            <input type="hidden" name="versao_porta" value={porta.versao} />
            <h3 className="font-semibold">{f.pode.decidirAlcada ? 'Decidir pela Presidência ou pelo Conselho' : 'Decidir'}</h3>
            {f.pode.decidir && porta.exige_alcada && <Aviso tipo="info">Se você escolher “seguir”, esta decisão sobe para a Presidência ou o Conselho.</Aviso>}
            {porta.tipo === 'termo' && f.projeto.tipo === 'financiado' && <Aviso tipo="info">Ao seguir, o Elo cria o rascunho do termo em Parcerias para o Financeiro completar.</Aviso>}
            <Campo rotulo="Decisão" obrigatorio>
              <select name="decisao" required className={estiloEntrada} defaultValue="">
                <option value="" disabled>Escolha</option>
                {DECISOES.map((x) => (
                  <option key={x} value={x}>{NOME_DECISAO[x]}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Justificativa" obrigatorio>
              <textarea name="justificativa" required rows={3} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Registrando…">Registrar decisão</BotaoEnviar>
          </form>
        )}
      </div>
    </Secao>
  );
}

export default async function PaginaProjeto({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFicha(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const { projeto: r, pode } = f;
  const fase = await lerFase(planilhas, usuario.autorizador, id);
  const campos = { id: r.id, versao: r.versao };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: r.codigo }]}
        titulo={`${r.codigo} · ${r.titulo}`}
        descricao={<EtiquetaEtapa etapa={r.etapa} />}
        acoes={
          <>
            {pode.enviar && (
              <form action={acaoEnviarIdeia}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <BotaoEnviar enviando="Enviando…">Enviar para uma coordenação assumir</BotaoEnviar>
              </form>
            )}
            {pode.assumir && (
              <form action={acaoAssumirIdeia}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <BotaoEnviar enviando="Assumindo…">Assumir como responsável</BotaoEnviar>
              </form>
            )}
            {pode.abrirPorta && (
              <form action={acaoAbrirPorta}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <BotaoEnviar enviando="Abrindo…">Abrir a porta 1</BotaoEnviar>
              </form>
            )}
            {pode.retomar && (
              <form action={acaoRetomarProjeto}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <BotaoEnviar variante="secundario" enviando="Retomando…">Retomar projeto</BotaoEnviar>
              </form>
            )}
          </>
        }
      />

      {['fase_1', 'fase_2', 'fase_3', 'implementacao', 'em_porta'].includes(r.etapa) && <AbasProjeto id={r.id} atual="resumo" />}

      <Secao id="t-resumo" titulo="Resumo">
        <p className="whitespace-pre-line">{r.resumo}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-texto-suave">Tipo</dt><dd className="font-medium">{NOME_TIPO[r.tipo]}</dd></div>
          <div><dt className="text-texto-suave">Porte</dt><dd className="font-medium">{NOME_PORTE[r.porte]}</dd></div>
          <div><dt className="text-texto-suave">Valor estimado</dt><dd className="font-medium">{moeda(r.valor_estimado)}</dd></div>
          <div><dt className="text-texto-suave">Quem propôs</dt><dd className="font-medium">{r.proponente}</dd></div>
          <div><dt className="text-texto-suave">Responsável</dt><dd className="font-medium">{r.responsavel ?? 'Ainda sem responsável'}</dd></div>
          <div><dt className="text-texto-suave">Serviço</dt><dd className="font-medium">{r.servico ?? '—'}</dd></div>
        </dl>
        {(r.etapa === 'fase_3' || r.etapa === 'implementacao') && <div className="mt-4"><Aviso tipo="sucesso">O Termo de Abertura foi aprovado (valor aprovado {moeda(r.valor_aprovado)}).</Aviso></div>}
      </Secao>

      {fase && fase.fase && (
        <Secao id="t-fase" titulo={`Fase ${fase.fase} · O que falta para a próxima porta`} descricao={fase.fase === 1 ? 'Conclua os itens abaixo e passe para a fase 2.' : fase.fase === 2 ? 'Conclua os itens abaixo para abrir a porta 2 (Termo de Abertura).' : fase.projeto.porte === 'completo' ? 'Conclua os itens abaixo para abrir a porta 3 (plano).' : 'Conclua os itens abaixo e inicie a implementação.'}>
          <ul className="divide-y divide-borda">
            {fase.itens.map((i) => (
              <li key={i.item} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{i.nome}</span>
                  {i.pronto ? <Etiqueta tipo="sucesso">Pronto</Etiqueta> : <Etiqueta tipo="atencao">{i.falta[0] ?? 'Falta'}</Etiqueta>}
                </span>
                <Link
                  href={ROTA_ITEM[i.item] ? `/projetos/${r.id}${ROTA_ITEM[i.item]}` : `/projetos/${r.id}/fase/${i.item}`}
                  className="inline-flex min-h-10 items-center rounded-md border border-borda px-3 font-semibold hover:bg-superficie-2"
                >
                  {fase.podeAlterar ? (i.pronto ? 'Ver ou alterar' : `Preencher ${NOME_ITEM[i.item].toLowerCase()}`) : 'Ver'}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            {fase.podeAvancar && (
              <FormularioConfirmado
                acao={acaoAvancarFase}
                campos={{ id: r.id, versao: r.versao }}
                rotulo="Concluir a fase 1 e ir para a fase 2"
                titulo="Concluir a fase 1?"
                mensagem="Você poderá continuar editando o marco lógico e os riscos, mas os documentos da fase 1 deixam de ser alterados."
                confirmar="Concluir a fase 1"
                variante="primario"
                perigoso={false}
              />
            )}
            {fase.podeAbrirPorta2 && (
              <FormularioConfirmado
                acao={acaoAbrirPorta}
                campos={{ id: r.id, versao: r.versao }}
                rotulo="Abrir porta de decisão"
                titulo="Abrir a porta 2?"
                mensagem="Depois de aberta, os documentos da fase ficam travados até a decisão."
                confirmar="Abrir a porta 2"
                variante="primario"
                perigoso={false}
              />
            )}
            {fase.podeAbrirPorta3 && (
              <FormularioConfirmado
                acao={acaoAbrirPorta}
                campos={{ id: r.id, versao: r.versao }}
                rotulo="Abrir porta de decisão"
                titulo="Abrir a porta 3?"
                mensagem="Depois de aberta, os documentos da fase ficam travados até a decisão."
                confirmar="Abrir a porta 3"
                variante="primario"
                perigoso={false}
              />
            )}
            {fase.podeIniciarImplementacao && (
              <FormularioConfirmado
                acao={acaoIniciarImplementacao}
                campos={{ id: r.id, versao: r.versao }}
                rotulo="Iniciar a implementação"
                titulo="Iniciar a implementação?"
                mensagem="O projeto passa para a fase 4. O orçamento deixa de ser alterado diretamente; as atividades continuam."
                confirmar="Iniciar a implementação"
                variante="primario"
                perigoso={false}
              />
            )}
            {!fase.podeAlterar && <p className="text-sm text-texto-suave">Só quem gerencia o projeto preenche esta fase.</p>}
          </div>
        </Secao>
      )}

      {f.portas.map((d) => (
        <BlocoPorta key={d.porta.id} d={d} f={f} pode={d.porta.situacao !== 'decidida'} />
      ))}

      {pode.editar && (
        <Secao id="t-editar" titulo="Alterar a ideia" descricao="O responsável também pode mudar o porte até a porta de decisão.">
          <FormularioIdeia
            acao={acaoSalvarIdeia}
            servicos={await servicosParaEscolher(planilhas)}
            comEnviar={pode.enviar}
            valores={{ ...campos, titulo: r.titulo, resumo: r.resumo, tipo: r.tipo, porte: r.porte, valorEstimado: r.valor_estimado, servico: r.servico }}
          />
        </Secao>
      )}

      {pode.trocarResponsavel && (
        <Secao id="t-responsavel" titulo="Trocar o responsável" descricao="Fica registrado no histórico.">
          <form action={acaoTrocarResponsavel} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="versao" value={r.versao} />
            <Campo rotulo="E-mail do novo responsável" obrigatorio className="min-w-64 flex-1">
              <input type="email" name="responsavel" required className={estiloEntrada} />
            </Campo>
            <BotaoEnviar variante="secundario" enviando="Trocando…">Trocar responsável</BotaoEnviar>
          </form>
        </Secao>
      )}

      {pode.cancelar && (
        <Secao id="t-cancelar" titulo="Cancelar" descricao="O projeto continua guardado, só deixa de andar.">
          <form action={acaoCancelarProjeto} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="versao" value={r.versao} />
            <Campo rotulo="Motivo" obrigatorio className="min-w-64 flex-1">
              <input name="motivo" required className={estiloEntrada} />
            </Campo>
            <BotaoEnviar variante="perigo" enviando="Cancelando…">Cancelar projeto</BotaoEnviar>
          </form>
        </Secao>
      )}

      <Secao id="t-historico" titulo="Histórico">
        <ol className="space-y-2 text-sm">
          {f.historico.map((h, i) => (
            <li key={i}>
              <span className="tabular-nums text-texto-suave">{dataHora(h.em)}</span> · <span className="font-medium">{h.acao}</span> · {h.usuario}
              {h.comentario && <span className="block text-texto-suave">{h.comentario}</span>}
            </li>
          ))}
        </ol>
      </Secao>
    </div>
  );
}
