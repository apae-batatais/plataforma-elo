import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerEncerramento } from '@/modulos/projetos/aplicacao/encerramento';
import { CATEGORIAS_LICAO, NOME_CATEGORIA_LICAO, NOME_ITEM_ENCERRAMENTO } from '@/modulos/projetos/dominio/encerramento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoAbrirPortaEncerramento, acaoIniciarEncerramento, acaoMarcarChecklist, acaoRegistrarLicao, acaoSalvarTextoEncerramento } from '../../acoes';

export const metadata: Metadata = { title: 'Encerramento e lições do projeto' };

const data = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export default async function PaginaEncerramento({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const s = await lerEncerramento(planilhas, usuario.autorizador, id);
  if (!s) notFound();
  const { projeto: r } = s;
  const naFase5 = r.etapa === 'encerramento';
  const resumo = s.podeSalvarResumo;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: r.codigo, href: `/projetos/${id}` }, { rotulo: 'Encerramento e lições' }]}
        titulo="Encerramento e lições aprendidas"
        descricao="O projeto só encerra com o check-list completo, o relatório final e ao menos uma lição aprendida."
      />
      <AbasProjeto id={id} atual="encerramento" />

      {s.atraso && <Aviso tipo="erro">Encerramento atrasado: {s.atraso}</Aviso>}
      {r.etapa === 'encerrado' && <Aviso tipo="sucesso">Projeto encerrado. Tudo fica só para leitura.</Aviso>}
      {r.etapa === 'em_porta' && <Aviso tipo="info">A porta está aberta: o check-list e o relatório ficam travados até a decisão da Diretoria.</Aviso>}

      {s.podeIniciar && (
        <Secao id="t-iniciar" titulo="Começar o encerramento" descricao="Leva o projeto para a fase 5. As atividades e os problemas podem ser tratados também depois.">
          <FormularioConfirmado
            acao={acaoIniciarEncerramento}
            campos={{ id, versao: r.versao }}
            rotulo="Iniciar o encerramento"
            titulo="Iniciar o encerramento?"
            mensagem="O projeto passa para a fase 5. Pedidos de mudança e novos relatórios de monitoramento deixam de ser enviados."
            confirmar="Iniciar o encerramento"
            variante="primario"
            perigoso={false}
          />
        </Secao>
      )}

      {(naFase5 || r.etapa === 'em_porta' || r.etapa === 'encerrado') && (
        <>
          <Secao id="t-falta" titulo="O que falta para abrir a porta de encerramento">
            {s.falta.length === 0 ? (
              <Aviso tipo="sucesso">Tudo pronto para a porta de encerramento.</Aviso>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.falta.map((x) => <li key={x}>{x}</li>)}
              </ul>
            )}
            {s.podeAbrirPorta && (
              <div className="mt-4">
                <FormularioConfirmado
                  acao={acaoAbrirPortaEncerramento}
                  campos={{ id, versao: r.versao }}
                  rotulo="Abrir porta de encerramento"
                  titulo="Abrir a porta de encerramento?"
                  mensagem="Depois de aberta, o check-list e o relatório final ficam travados até a decisão. Se a Diretoria aceitar, o projeto passa a somente leitura."
                  confirmar="Abrir a porta"
                  variante="primario"
                  perigoso={false}
                />
              </div>
            )}
          </Secao>

          <Secao id="t-checklist" titulo="Check-list de encerramento">
            <ul className="divide-y divide-borda">
              {s.checklist.map((c) => (
                <li key={c.item} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <span className="space-y-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {NOME_ITEM_ENCERRAMENTO[c.item]}
                      {c.feito ? <Etiqueta tipo="sucesso">Feito</Etiqueta> : <Etiqueta tipo="atencao">Falta</Etiqueta>}
                    </span>
                    {c.feito && <span className="block text-texto-suave">Marcado por {c.por} em {c.data ? data(c.data) : ''}{c.observacao ? ` · ${c.observacao}` : ''}</span>}
                  </span>
                  {s.podeAlterar && (
                    <form action={acaoMarcarChecklist} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="item" value={c.item} />
                      <input type="hidden" name="feito" value={c.feito ? 'nao' : 'sim'} />
                      {!c.feito && (
                        <Campo rotulo="Observação" dica="Opcional.">
                          <input name="observacao" className={estiloEntrada} />
                        </Campo>
                      )}
                      <BotaoEnviar variante="secundario" enviando="Salvando…">{c.feito ? 'Reabrir' : 'Marcar como feito'}</BotaoEnviar>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Secao>

          {(['relatorio_final', 'transicao', 'sustentabilidade'] as const).map((item) => (
            <Secao key={item} id={`t-${item}`} titulo={NOME_ITEM_ENCERRAMENTO[item].split(':')[0]} descricao={item === 'relatorio_final' ? 'Obrigatório: o que foi feito, o que foi alcançado e o que ficou.' : 'Opcional.'}>
              {s.podeAlterar ? (
                <form action={acaoSalvarTextoEncerramento} className="space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="item" value={item} />
                  <Campo rotulo={NOME_ITEM_ENCERRAMENTO[item].split(':')[0]} obrigatorio={item === 'relatorio_final'} dica={item === 'relatorio_final' ? undefined : NOME_ITEM_ENCERRAMENTO[item].split(': ')[1]}>
                    <textarea name="texto" rows={5} required={item === 'relatorio_final'} defaultValue={s.textos[item]} className={estiloEntrada} />
                  </Campo>
                  <BotaoEnviar enviando="Salvando…">Salvar</BotaoEnviar>
                </form>
              ) : s.textos[item] ? (
                <p className="whitespace-pre-line text-sm">{s.textos[item]}</p>
              ) : (
                <EstadoVazio titulo="Nada aqui ainda.">Nada foi escrito.</EstadoVazio>
              )}
            </Secao>
          ))}
        </>
      )}

      {resumo && (
        <Secao id="t-resumo" titulo="Relatório resumido" descricao="Projeto parado ou cancelado também registra o que aconteceu.">
          <form action={acaoSalvarTextoEncerramento} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="item" value="relatorio_final" />
            <Campo rotulo="O que aconteceu e por que o projeto parou" obrigatorio>
              <textarea name="texto" rows={4} required defaultValue={s.textos.relatorio_final} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…">Salvar relatório resumido</BotaoEnviar>
          </form>
        </Secao>
      )}

      <Secao id="t-licoes" titulo="Lições aprendidas" descricao="O que o projeto ensinou. Quem tem acesso ao app pode consultar as lições de todos os projetos.">
        {s.licoes.length === 0 ? (
          <EstadoVazio titulo="Nada aqui ainda.">{s.podeRegistrarLicao ? 'Registre a primeira lição no formulário abaixo.' : 'Nenhuma lição registrada.'}</EstadoVazio>
        ) : (
          <ul className="divide-y divide-borda">
            {s.licoes.map((l) => (
              <li key={l.id} className="space-y-1 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <Etiqueta tipo="info">{NOME_CATEGORIA_LICAO[l.categoria]}</Etiqueta>
                  <span className="font-normal text-texto-suave">{l.registrado_por} em {data(l.registrado_em)}</span>
                </p>
                <p><span className="font-semibold">O que aconteceu:</span> {l.o_que_aconteceu}</p>
                <p><span className="font-semibold">O que fazer diferente:</span> {l.fazer_diferente}</p>
              </li>
            ))}
          </ul>
        )}
        {s.podeRegistrarLicao && (
          <form action={acaoRegistrarLicao} className="mt-4 space-y-4 border-t border-borda pt-4">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="Categoria" obrigatorio>
              <select name="categoria" required defaultValue="" className={estiloEntrada}>
                <option value="" disabled>Escolha</option>
                {CATEGORIAS_LICAO.map((c) => <option key={c} value={c}>{NOME_CATEGORIA_LICAO[c]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="O que aconteceu" obrigatorio dica="ex.: o material chegou duas semanas depois do previsto.">
              <textarea name="aconteceu" required rows={3} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="O que fazer diferente" obrigatorio dica="ex.: pedir o material com um mês de folga.">
              <textarea name="diferente" required rows={3} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Registrando…">Registrar lição</BotaoEnviar>
          </form>
        )}
      </Secao>
    </div>
  );
}
