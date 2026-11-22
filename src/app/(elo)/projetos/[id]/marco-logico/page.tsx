import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { lerIndicadores } from '@/modulos/projetos/aplicacao/indicadores';
import { ehPercentual, FONTES_NUMERO, fraseDoNumero, NOME_FONTE_NUMERO, NOME_ORIGEM, TEXTO_MOTIVO } from '@/modulos/projetos/dominio/indicadores';
import { NIVEIS_MARCO, NIVEL_ACIMA, NOME_NIVEL, pendenciasDoMarco } from '@/modulos/projetos/dominio/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { numerosDePessoas } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { pequeno } from '@/ui/botao';
import { Indicadores } from '@/ui/graficos';
import { SelecaoAutomatica } from '@/ui/selecao-automatica';
import { TabelaDados } from '@/ui/tabela-dados';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoFonteDoItem, acaoRegistrarMedicao, acaoRetirarItemMarco, acaoSalvarItemMarco } from '../../acoes';

export const metadata: Metadata = { title: 'Marco lógico' };

export default async function PaginaMarcoLogico({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const editavel = f.podeAlterar && (f.fase === 1 || f.fase === 2);
  const itens = f.marco.map((m) => ({ id: m.id, nivel: m.nivel, descricao: m.descricao, indicador: m.indicador, fonte_verificacao: m.fonte_verificacao, acima: m.acima }));
  const falta = pendenciasDoMarco(itens);
  const ind = await lerIndicadores(planilhas, usuario.autorizador, id, numerosDePessoas(planilhas));
  const servicos = (await lerTabela(planilhas, Servicos)).ativos().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const dataBR = ind.data.split('-').reverse().join('/');
  const automaticos = ind.itens.filter((i) => i.hoje);
  const nomeDoItem = (itemId: string) => ind.itens.find((i) => i.itemId === itemId)?.descricao ?? '—';
  const nome = (acima: string | null) => f.marco.find((m) => m.id === acima)?.descricao ?? '—';

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Marco lógico' }]}
        titulo="Marco lógico"
        descricao="Do impacto às atividades: cada resultado precisa de atividades, e cada item de um indicador e de uma fonte de verificação."
      />
      <AbasProjeto id={id} atual="marco" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera o marco lógico, e só nas fases 1 e 2. Você vê o conteúdo em leitura.</Aviso>}
      {falta.length > 0 ? (
        <Aviso tipo="atencao" titulo="O que falta para o marco lógico ficar completo">
          <ul className="list-disc pl-5">{falta.map((x) => <li key={x}>{x}</li>)}</ul>
        </Aviso>
      ) : (
        <Aviso tipo="sucesso">O marco lógico está completo.</Aviso>
      )}
      {ind.itens.length > 0 && (
        <Secao
          id="t-indicadores"
          titulo="Indicadores"
          descricao={`Os números marcados “Calculado do cadastro” vêm das pessoas atendidas, sem nomes, e valem para ${dataBR}.`}
          acoes={
            ind.podeRegistrar && automaticos.length > 0 && (
              <form action={acaoRegistrarMedicao}>
                <input type="hidden" name="id" value={id} />
                <BotaoEnviar enviando="Registrando…" className={pequeno}>Registrar medição</BotaoEnviar>
              </form>
            )
          }
        >
          {automaticos.some((i) => i.hoje?.estado === 'ok' && i.hoje.situacao === 'abaixo') && (
            <p className="mb-3 text-sm font-semibold">Há indicador abaixo da meta. Converse com a equipe técnica sobre o que fazer.</p>
          )}
          <ul className="space-y-4">
            {ind.itens.map((i) => {
              const h = i.hoje;
              const grafico = h?.estado === 'ok' && h.valor !== null && ehPercentual(i.fonte);
              return (
                <li key={i.itemId} className="space-y-1 text-sm">
                  <p className="font-semibold">{i.indicador ?? i.descricao}</p>
                  <p className="text-texto-suave">{i.meta !== null ? `Meta: ${i.meta.toLocaleString('pt-BR')}${ehPercentual(i.fonte) ? '%' : ''}` : 'Sem meta definida'}</p>
                  {!h && <p>Número digitado à mão: o Elo não calcula este indicador.</p>}
                  {h?.estado === 'sem_servico' && <p>Escolha o serviço para calcular.</p>}
                  {h?.estado === 'indisponivel' && <p>{TEXTO_MOTIVO.indisponivel}</p>}
                  {h?.estado === 'ok' && !grafico && (
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">{h.valor !== null ? fraseDoNumero(i.fonte, h.valor) : TEXTO_MOTIVO[h.motivo ?? 'sem_dados']}</span>
                      <Etiqueta tipo="info">Calculado do cadastro</Etiqueta>
                      {h.situacao && <Etiqueta tipo={h.situacao === 'dentro' ? 'sucesso' : 'atencao'}>{h.situacao === 'dentro' ? 'Dentro da meta' : 'Abaixo da meta'}</Etiqueta>}
                    </p>
                  )}
                  {h?.estado === 'ok' && grafico && h.valor !== null && (
                    <div className="space-y-1">
                      <Indicadores
                        itens={[
                          {
                            nome: i.indicador ?? i.descricao,
                            valor: h.valor,
                            explicacao: `${fraseDoNumero(i.fonte, h.valor)} (${h.base} pessoas). Calculado do cadastro em ${dataBR}.`,
                            referencia: i.meta !== null ? { valor: i.meta, sentido: 'desde' } : undefined,
                            anteriores: [],
                          },
                        ]}
                      />
                      {h.situacao === 'abaixo' && <p className="text-xs">Peça à equipe técnica para reavaliar as pessoas com avaliação vencida.</p>}
                    </div>
                  )}
                  {i.servicoNome && <p className="text-xs text-texto-suave">Serviço: {i.servicoNome}</p>}
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <TabelaDados
              legenda="Medições registradas"
              vazio="Nenhuma medição registrada ainda. Use “Registrar medição” para guardar os números de hoje."
              colunas={[
                { chave: 'data', rotulo: 'Data' },
                { chave: 'indicador', rotulo: 'Indicador' },
                { chave: 'numero', rotulo: 'Número' },
                { chave: 'base', rotulo: 'Pessoas', tipo: 'numero' },
                { chave: 'origem', rotulo: 'Origem' },
              ]}
              linhas={ind.medicoes.map((m) => ({
                id: m.id,
                valores: {
                  data: m.data.split('-').reverse().join('/'),
                  indicador: nomeDoItem(m.itemId),
                  numero: m.valor !== null ? m.valor : m.motivo ? TEXTO_MOTIVO[m.motivo] : '—',
                  base: m.base,
                  origem: NOME_ORIGEM[m.origem],
                },
              }))}
            />
          </div>
        </Secao>
      )}
      {f.marco.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">Comece pelo impacto: a mudança maior que o projeto quer ajudar a alcançar.</EstadoVazio>
      ) : (
        NIVEIS_MARCO.map((n) => {
          const doNivel = f.marco.filter((m) => m.nivel === n);
          if (doNivel.length === 0) return null;
          return (
            <Secao key={n} id={`t-${n}`} titulo={`${NOME_NIVEL[n]}s`}>
              <ul className="divide-y divide-borda">
                {doNivel.map((m) => (
                  <li key={m.id} className="space-y-1 py-3 text-sm">
                    <p className="font-semibold">{m.descricao}</p>
                    {NIVEL_ACIMA[n] && <p className="text-texto-suave">Pertence a: {nome(m.acima)}</p>}
                    {m.indicador && <p>Indicador: {m.indicador}</p>}
                    {m.fonte_verificacao && <p>Fonte de verificação: {m.fonte_verificacao}</p>}
                    {m.pressuposto && <p>Pressuposto: {m.pressuposto}</p>}
                    {ind.podeAlterar && m.indicador && (
                      <form action={acaoFonteDoItem} className="flex flex-wrap items-end gap-3 pt-1">
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="item" value={m.id} />
                        <input type="hidden" name="versao_item" value={m.versao} />
                        <Campo rotulo="De onde vem o número" dica="Escolha “Digitado à mão” para informar você mesmo.">
                          <SelecaoAutomatica name="fonte" defaultValue={m.fonte_numero} className={estiloEntrada}>
                            {FONTES_NUMERO.map((v) => <option key={v} value={v}>{NOME_FONTE_NUMERO[v]}</option>)}
                          </SelecaoAutomatica>
                        </Campo>
                        <Campo rotulo="Serviço" dica="Só vale para número do cadastro.">
                          <SelecaoAutomatica name="servico" defaultValue={m.servico_id ?? ''} className={estiloEntrada}>
                            <option value="">Escolha o serviço</option>
                            {servicos.map((s) => <option key={s.codigo} value={s.codigo}>{s.nome}</option>)}
                          </SelecaoAutomatica>
                        </Campo>
                        <Campo rotulo="Meta" dica="ex.: 80 (opcional)">
                          <input name="meta" inputMode="decimal" defaultValue={m.meta ?? ''} className={`${estiloEntrada} w-28`} />
                        </Campo>
                        <BotaoEnviar enviando="Salvando…" className={pequeno}>Salvar meta</BotaoEnviar>
                      </form>
                    )}
                    {editavel && (
                      <FormularioConfirmado
                        acao={acaoRetirarItemMarco}
                        campos={{ id, item: m.id, versao_item: m.versao }}
                        rotulo="Retirar"
                        titulo="Retirar este item?"
                        mensagem="O item deixa de aparecer, mas continua guardado."
                        confirmar="Retirar item"
                        pequeno
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Secao>
          );
        })
      )}
      {editavel && (
        <Secao id="t-novo" titulo="Adicionar item" descricao="Os itens de nível acima precisam existir primeiro.">
          <form action={acaoSalvarItemMarco} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="Nível" obrigatorio>
              <select name="nivel" required defaultValue="" className={estiloEntrada}>
                <option value="" disabled>Escolha</option>
                {NIVEIS_MARCO.map((n) => <option key={n} value={n}>{NOME_NIVEL[n]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Descrição" obrigatorio>
              <textarea name="descricao" required rows={2} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Pertence a" dica="Item do nível imediatamente acima (não vale para o impacto).">
              <select name="acima" defaultValue="" className={estiloEntrada}>
                <option value="">Nenhum (só para impacto)</option>
                {f.marco.map((m) => <option key={m.id} value={m.id}>{NOME_NIVEL[m.nivel]}: {m.descricao}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Indicador" dica="Como saber que foi alcançado. ex.: 80% das famílias com frequência regular. Atividades não precisam.">
              <input name="indicador" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Fonte de verificação" dica="De onde vem a prova. ex.: lista de presença.">
              <input name="fonte" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Pressuposto" dica="O que precisa continuar verdadeiro para dar certo (opcional).">
              <input name="pressuposto" className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…">Adicionar item</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
