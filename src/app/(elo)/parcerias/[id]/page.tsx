import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { detalharTermo, ErroTermo } from '@/modulos/parcerias/aplicacao/parcerias';
import { dinheiro, FONTES_NUMERO, nomeMes, NOME_APORTE, NOME_FONTE_NUMERO, NOME_TIPO, TIPOS_APORTE, unidadeEhPessoa } from '@/modulos/parcerias/dominio/termos';
import { CamposFonte } from '@/modulos/parcerias/telas/campos-fonte';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { numerosDePessoas } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { acaoAdicionarFonte, acaoCancelarAporte, acaoEncerrarTermo, acaoFonteDaMeta, acaoLimiteOcupacao, acaoRegistrarAporte } from '../acoes';
import { NumeroQueConta } from '@/ui/numero-que-conta';

export const metadata: Metadata = { title: 'Ficha do termo' };
const dataBR = (d: string) => d.split('-').reverse().join('/');
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR')}%`);
const din = (v: number | null) => (v === null ? '—' : dinheiro(v));

export default async function FichaDoTermo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  let t;
  try {
    t = await detalharTermo(planilhas, usuario.autorizador, id, new Date(), numerosDePessoas(planilhas));
  } catch (e) {
    if (e instanceof ErroTermo) notFound();
    if (e instanceof ErroPermissao) redirect('/parcerias');
    throw e;
  }
  const edita = usuario.autorizador.temPermissao('parcerias.termos.editar') && t.situacao === 'em_vigor';
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Parcerias', href: '/parcerias' }, { rotulo: `${t.parceiro} ${t.numero}` }]}
        titulo={`${t.parceiro} · ${t.numero}`}
        descricao={`${NOME_TIPO[t.tipo]}${t.tipoDescricao ? ` (${t.tipoDescricao})` : ''} · ${dataBR(t.inicio)} a ${dataBR(t.fim)} · ${t.situacao === 'em_vigor' ? 'em vigor' : 'encerrado'}${t.objeto ? ` · ${t.objeto}` : ''}`}
        acoes={
          edita && (
            <>
              <JanelaFormulario rotulo={<><IconeMais tamanho={16} /> Adicionar fonte</>} className={pequeno} titulo="Adicionar fonte" larga>
                <form action={acaoAdicionarFonte} className="space-y-4">
                  <input type="hidden" name="termo_id" value={t.id} />
                  <CamposFonte />
                  <BotaoEnviar enviando="Salvando…" className="w-full">Adicionar fonte</BotaoEnviar>
                </form>
              </JanelaFormulario>
              <JanelaFormulario rotulo="Registrar aporte" className={pequeno} variante="secundario" titulo="Registrar aporte" larga>
                <form action={acaoRegistrarAporte} className="space-y-4">
                  <input type="hidden" name="termo_id" value={t.id} />
                  <Campo rotulo="Fonte" obrigatorio>
                    <select name="fonte_id" required className={estiloEntrada}>
                      {t.fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Tipo" obrigatorio>
                    <select name="tipo" className={estiloEntrada}>
                      {TIPOS_APORTE.map((v) => <option key={v} value={v}>{NOME_APORTE[v]}</option>)}
                    </select>
                  </Campo>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Campo rotulo="Data do registro" obrigatorio><input type="date" name="registrado_em" required className={estiloEntrada} /></Campo>
                    <Campo rotulo="Início da vigência" obrigatorio><input type="date" name="inicio" required className={estiloEntrada} /></Campo>
                    <Campo rotulo="Fim da vigência" obrigatorio><input type="date" name="fim" required className={estiloEntrada} /></Campo>
                  </div>
                  <Campo rotulo="Valor" obrigatorio dica="Negativo para redução."><input name="valor" inputMode="decimal" required className={estiloEntrada} /></Campo>
                  <Campo rotulo="Cronograma"><select name="cronograma" className={estiloEntrada}><option value="iguais">Partes iguais nos meses abaixo</option><option value="digitado">Digitado mês a mês</option></select></Campo>
                  <Campo rotulo="Meses (partes iguais)" dica="AAAA-MM separados por vírgula."><input name="meses" className={estiloEntrada} /></Campo>
                  <Campo rotulo="Parcelas digitadas" dica="Uma por linha: mês e valor. Ex.: 2026-07 2000,00."><textarea name="parcelas" rows={3} className={estiloEntrada} /></Campo>
                  <Campo rotulo="Categoria de destino (opcional)"><input name="categoria" className={estiloEntrada} /></Campo>
                  <Campo rotulo="Descrição (opcional)"><input name="descricao" className={estiloEntrada} /></Campo>
                  <BotaoEnviar enviando="Salvando…" className="w-full">Registrar aporte</BotaoEnviar>
                </form>
              </JanelaFormulario>
              <FormularioConfirmado
                acao={acaoEncerrarTermo}
                campos={{ termo_id: t.id, versao: t.versao }}
                rotulo="Encerrar termo"
                titulo="Encerrar este termo?"
                mensagem="O termo deixa de aparecer para novos rateios no Orçamento. Nada é apagado e os rateios já feitos continuam valendo."
                confirmar="Encerrar termo"
                pequeno
              />
            </>
          )
        }
      />
      {q.ok && <Aviso tipo="sucesso">{q.ok}</Aviso>}
      {q.erro && <Aviso tipo="erro">{q.erro}</Aviso>}

      <Secao titulo="Valor do termo" descricao="Calculado pelo Elo: valor inicial das fontes mais os aportes. Nunca é digitado.">
        <p className="text-2xl font-bold tabular-nums"><NumeroQueConta texto={dinheiro(t.valorGlobal)} chave="valor-global" /></p>
        {t.recursosProprios !== null && <p className="mt-1 text-sm text-texto-suave">Recursos próprios previstos do termo: {dinheiro(t.recursosProprios)}</p>}
      </Secao>

      {t.pontosDeAtencao.length > 0 && (
        <Aviso tipo="atencao" titulo="Pontos de atenção">
          <ul className="list-disc pl-5">{t.pontosDeAtencao.map((p) => <li key={p}>{p}</li>)}</ul>
        </Aviso>
      )}

      <Secao titulo="Serviços atendidos">
        <ul className="space-y-1 text-sm">
          {t.servicos.map((s) => (
            <li key={s.id}>
              <span className="font-semibold">{s.nome}</span>: {s.vagasCusteadas ?? '—'} vagas custeadas · {s.vagasOferecidas ?? '—'} oferecidas ({t.unidadeMeta})
            </li>
          ))}
        </ul>
      </Secao>

      {t.fontes.map((f) => (
        <Secao
          key={f.id}
          titulo={f.nome}
          descricao={`${f.forma === 'global' ? 'Valor global' : `Per capita ${f.periodicidade} de ${din(f.perCapita)}`} · valor inicial ${dinheiro(f.valorInicial)} · valor atual ${dinheiro(f.valorAtual)}`}
          acoes={f.permiteRemanejar ? <Etiqueta tipo="info">Pode remanejar entre categorias</Etiqueta> : <Etiqueta>Sem remanejamento</Etiqueta>}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Cronograma de desembolso</h3>
              <table className="w-full text-sm"><tbody>
                {f.parcelas.map((x) => (
                  <tr key={x.mes}><td className="py-0.5">{nomeMes(x.mes)}</td><td className="py-0.5 text-right tabular-nums">{dinheiro(x.valor)}</td></tr>
                ))}
              </tbody></table>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Plano de aplicação</h3>
              {f.categorias.length === 0 ? <p className="text-sm text-texto-suave">Sem plano informado.</p> : (
                <table className="w-full text-sm"><tbody>
                  {f.categorias.map((c) => (
                    <tr key={c.categoria}><td className="py-0.5">{c.categoria}</td><td className="py-0.5 text-right tabular-nums">{dinheiro(c.valor)}</td></tr>
                  ))}
                </tbody></table>
              )}
              {f.recursosProprios !== null && <p className="mt-2 text-sm text-texto-suave">Recursos próprios previstos: {dinheiro(f.recursosProprios)}</p>}
            </div>
          </div>
        </Secao>
      ))}

      <Secao titulo="Aportes">
        {t.aportes.length === 0 ? <p className="text-sm text-texto-suave">Nenhum aporte registrado.</p> : (
          <ul className="space-y-3 text-sm">
            {t.aportes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p><span className="font-semibold">{dinheiro(a.valor)}</span> · {a.tipo} · {a.fonteNome} · vigência {dataBR(a.inicio)} a {dataBR(a.fim)}</p>
                  <p className="text-texto-suave">{a.parcelas.length} parcela(s): {a.parcelas.map((x) => `${nomeMes(x.mes)} ${dinheiro(x.valor)}`).join('; ')}</p>
                </div>
                {edita && (
                  <FormularioConfirmado
                    acao={acaoCancelarAporte}
                    campos={{ termo_id: t.id, id: a.id, versao: a.versao }}
                    rotulo="Cancelar aporte"
                    titulo="Cancelar este aporte?"
                    mensagem="O aporte sai do valor da fonte, mas fica guardado. Se foi lançado errado, registre de novo."
                    confirmar="Cancelar aporte"
                    pequeno
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Equipe e metas" descricao="Equipe por função, sem nomes.">
        <ul className="space-y-1 text-sm">
          {t.equipe.map((e) => <li key={e.funcao}>{e.funcao}: {e.pessoas} pessoa(s), {e.horasSemanais} h semanais por pessoa</li>)}
          {t.equipe.length + t.metas.length === 0 && <li className="text-texto-suave">Nada informado.</li>}
        </ul>
        {t.metas.length > 0 && (
          <ul className="mt-3 space-y-4 text-sm">
            {t.metas.map((m) => {
              const hoje = t.hojeDasMetas[m.id];
              const aceitaCadastro = unidadeEhPessoa(m.unidade);
              return (
                <li key={m.id} className="space-y-1">
                  <p>
                    <span className="font-semibold">Meta · {m.descricao}:</span> {m.quantidade ?? m.quantidadeTexto ?? '—'} {m.unidade}
                  </p>
                  {hoje?.estado === 'ok' && (
                    <p className="flex flex-wrap items-center gap-2">
                      <span>Hoje:</span>
                      {hoje.numero.valor !== null ? (
                        <span className="font-semibold tabular-nums">
                          {hoje.numero.valor.toLocaleString('pt-BR')}
                          {m.fonteNumero === 'reavaliacao_em_dia' ? '%' : ''}
                        </span>
                      ) : hoje.numero.motivo === 'poucos_casos' ? (
                        <span>Poucos casos para divulgar (menos de 5 pessoas)</span>
                      ) : (
                        <span>Sem dados ainda</span>
                      )}
                      <Etiqueta tipo="info">Calculado do cadastro</Etiqueta>
                      {hoje.situacao && <Etiqueta tipo={hoje.situacao === 'dentro' ? 'sucesso' : 'atencao'}>{hoje.situacao === 'dentro' ? 'Dentro da meta' : 'Abaixo da meta'}</Etiqueta>}
                    </p>
                  )}
                  {hoje?.estado === 'sem_servico' && <p className="text-texto-suave">Escolha o serviço para calcular.</p>}
                  {hoje?.estado === 'indisponivel' && <p className="text-texto-suave">Ligação indisponível; use “Digitado à mão”, se quiser.</p>}
                  {edita && aceitaCadastro && (
                    <form action={acaoFonteDaMeta} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="termo_id" value={t.id} />
                      <input type="hidden" name="meta_id" value={m.id} />
                      <input type="hidden" name="versao" value={m.versao} />
                      <Campo rotulo="De onde vem o número" dica="Escolha “Digitado à mão” para informar você mesmo.">
                        <select name="fonte" defaultValue={m.fonteNumero} className={estiloEntrada}>
                          {FONTES_NUMERO.map((v) => <option key={v} value={v}>{NOME_FONTE_NUMERO[v]}</option>)}
                        </select>
                      </Campo>
                      <Campo rotulo="Serviço">
                        <select name="servico" defaultValue={m.servico ?? t.servicos[0]?.servico} className={estiloEntrada}>
                          {t.servicos.map((s) => <option key={s.servico} value={s.servico}>{s.nome}</option>)}
                        </select>
                      </Campo>
                      <BotaoEnviar enviando="Salvando…" className={pequeno}>Salvar</BotaoEnviar>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Per capita e ocupação"
        descricao={`Mês a mês, por serviço. Alerta de vagas ociosas quando a ocupação fica abaixo de ${t.limiteOcupacao}% por 2 meses seguidos.`}
        acoes={edita && (
          <JanelaFormulario rotulo="Mudar limite" className={pequeno} variante="secundario" titulo="Limite de ocupação">
            <form action={acaoLimiteOcupacao} className="space-y-4">
              <input type="hidden" name="termo_id" value={t.id} />
              <input type="hidden" name="versao" value={t.versao} />
              <Campo rotulo="Limite (%)" obrigatorio><input name="limite" inputMode="decimal" defaultValue={t.limiteOcupacao} required className={estiloEntrada} /></Campo>
              <BotaoEnviar enviando="Salvando…" className="w-full">Salvar</BotaoEnviar>
            </form>
          </JanelaFormulario>
        )}
      >
        <div className="space-y-6">
          {t.quadro.map((s) => (
            <div key={s.servico}>
              <h3 className="font-semibold">{s.nome}</h3>
              {s.alerta && (
                <Aviso tipo="atencao" titulo="Vagas ociosas">
                  Ocupação abaixo de {t.limiteOcupacao}% em {nomeMes(s.alerta.meses[0])} e {nomeMes(s.alerta.meses[1])}: {s.alerta.vagasOciosas} vaga(s) ociosa(s), cerca de {dinheiro(s.alerta.valorMensal)} por mês. Risco de devolução ou questionamento na prestação de contas.
                </Aviso>
              )}
              {s.semContagem && <p className="text-sm text-texto-suave">Sem contagem automática de atendidos para a unidade “{t.unidadeMeta}”; vale só o per capita contra a meta.</p>}
              {s.linhas.length === 0 ? <p className="text-sm text-texto-suave">A vigência ainda não começou.</p> : (
                <div className="overflow-x-auto">
                  <table className="mt-2 w-full text-sm">
                    <caption className="sr-only">Per capita e ocupação de {s.nome}</caption>
                    <thead><tr className="text-left text-texto-suave">
                      <th className="py-1 pr-3">Mês</th><th className="pr-3">Vagas custeadas</th><th className="pr-3">Oferecidas</th><th className="pr-3">Atendidos</th><th className="pr-3">Ocupação</th><th className="pr-3">Per capita (meta)</th><th>Per capita (atendidos)</th>
                    </tr></thead>
                    <tbody>
                      {s.linhas.map((l) => (
                        <tr key={l.mes} className="border-t border-borda">
                          <td className="py-1 pr-3">{nomeMes(l.mes)}</td>
                          <td className="pr-3">{l.vagasCusteadas ?? 'sem vagas informadas'}</td>
                          <td className="pr-3">{l.vagasOferecidas ?? '—'}</td>
                          <td className="pr-3">{l.atendidos ?? 'sem contagem'}</td>
                          <td className="pr-3">{pct(l.ocupacao)}</td>
                          <td className="pr-3 tabular-nums">{din(l.perCapitaMeta)}</td>
                          <td className="tabular-nums">{din(l.perCapitaAtendidos)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-borda font-semibold">
                        <td className="py-1 pr-3" colSpan={5}>Acumulado da vigência</td>
                        <td className="pr-3 tabular-nums">{din(s.acumulado.perCapitaMeta)}</td>
                        <td className="tabular-nums">{din(s.acumulado.perCapitaAtendidos)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
