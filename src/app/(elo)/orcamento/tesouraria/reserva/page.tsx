import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerReserva } from '@/modulos/orcamento/aplicacao/reserva';
import { CAMPOS_FAIXAS } from '@/modulos/orcamento/dominio/reserva';
import { mesAnterior, mesAtualBrasilia } from '@/modulos/orcamento/dominio/tesouraria';
import { reais, rotuloMes } from '@/modulos/orcamento/telas/formato';
import { FormularioPedirUso, FormularioProporPolitica } from '@/modulos/orcamento/telas/formularios-reserva';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Indicadores } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';
import {
  acaoAprovarPolitica, acaoAprovarUso, acaoCancelarUso, acaoMarcarRecomposto, acaoPedirUso, acaoProporPolitica, acaoRecusarPolitica, acaoRecusarUso,
} from './acoes';

export const metadata: Metadata = { title: 'Reserva' };

function mesesAdiante(inicio: string, n: number) {
  const lista: string[] = [];
  let [a, m] = inicio.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    lista.push(`${a}-${String(m).padStart(2, '0')}`);
    if (m === 12) {
      a += 1;
      m = 1;
    } else m += 1;
  }
  return lista;
}

const MOTIVO = (
  <Campo rotulo="Motivo da recusa" obrigatorio dica="Aparece para quem fez o pedido.">
    <textarea name="motivo" required rows={2} className={estiloEntrada} />
  </Campo>
);

export default async function ReservaPagina() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const r = await lerReserva(app.planilhas, usuario.autorizador);
  const atual = mesAtualBrasilia();
  const mesesPrazo = mesesAdiante(atual, 18).map((m) => ({ valor: m, rotulo: rotuloMes(m) }));
  const mesesRecompor = [atual];
  while (mesesRecompor.length < 6) mesesRecompor.push(mesAnterior(mesesRecompor[mesesRecompor.length - 1]));
  const vencidos = r.usos.filter((u) => u.vencido);
  const prop = r.proposta;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Tesouraria' }, { rotulo: 'Reserva' }]}
        titulo="Reserva"
        descricao="O mínimo que a instituição guarda, as faixas dos sinais da Visão geral e os pedidos de uso da reserva. A Diretoria aprova; o Financeiro propõe e pede."
      />

      {vencidos.length > 0 && (
        <Aviso tipo="atencao" titulo={vencidos.length === 1 ? '1 recomposição vencida' : `${vencidos.length} recomposições vencidas`}>
          O prazo para devolver o valor à reserva passou. O Financeiro marca como recomposto quando o valor voltar.
        </Aviso>
      )}

      <Secao titulo={r.aprovada ? `Política em vigor desde ${rotuloMes(r.vigencia ?? atual)}` : 'Ainda não há política aprovada'}>
        {r.aprovada ? (
          <div className="space-y-4">
            <p className="text-sm text-texto-suave">
              Mínimo = {r.faixas.meses_minimo} {r.faixas.meses_minimo === 1 ? 'mês' : 'meses'} de folha média mensal do ano (RH e encargos da Previsão aprovada ÷ 12).
            </p>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-texto-suave">Mínimo da reserva</dt>
                <dd className="text-2xl font-bold tabular-nums">{r.minimo === null ? '—' : reais(r.minimo)}</dd>
                {r.minimo === null && <dd className="text-sm">A Previsão do ano ainda não está aprovada.</dd>}
              </div>
              <div>
                <dt className="text-sm text-texto-suave">Reserva atual{r.mesDoSaldo ? ` (${rotuloMes(r.mesDoSaldo)})` : ''}</dt>
                <dd className="text-2xl font-bold tabular-nums">{r.reservaAtual === null ? '—' : reais(r.reservaAtual)}</dd>
                {r.reservaAtual === null && <dd className="text-sm">Informe os saldos do mês.</dd>}
              </div>
            </dl>
            <Indicadores
              itens={[
                {
                  nome: 'Reserva sobre o mínimo',
                  valor: r.percentual === null ? null : Math.min(r.percentual, 100),
                  explicacao:
                    r.percentual === null
                      ? 'Sem dado: falta o saldo da reserva ou a Previsão aprovada.'
                      : `A reserva está em ${r.percentual.toLocaleString('pt-BR')}% do mínimo (meta: 100%).`,
                  referencia: { valor: 100, sentido: 'desde' },
                  anteriores: [],
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm">
            Enquanto a Diretoria não aprovar uma política, a Visão geral usa as faixas propostas de fábrica e o sinal da Reserva fica sem dado. O Financeiro propõe abaixo.
          </p>
        )}
      </Secao>

      {prop && (
        <Secao titulo="Proposta aguardando a Diretoria" descricao={`Enviada por ${prop.criado_por} em ${prop.criado_em.slice(0, 10).split('-').reverse().join('/')}. Vale a partir de ${rotuloMes(prop.vigencia)}, se aprovada.`}>
          <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <li>Meses de folha na reserva: <strong>{prop.meses_minimo}</strong></li>
            <li>Livre disponível: ok a partir de <strong>{prop.livre_ok}</strong> meses; atenção a partir de <strong>{prop.livre_atencao}</strong></li>
            <li>Fim do ano: ok a partir de <strong>{reais(prop.fim_ok)}</strong></li>
            <li>Execução: atenção até <strong>{prop.exec_atencao}%</strong> da receita prevista</li>
            <li>Folha sobre a receita: ok até <strong>{prop.folha_ok}%</strong>; atenção até <strong>{prop.folha_atencao}%</strong></li>
            <li>Gasto com recurso livre: ok até <strong>{prop.gasto_ok}</strong> pontos; atenção até <strong>{prop.gasto_atencao}</strong></li>
            <li>Reserva: ok a partir de <strong>{prop.reserva_ok}%</strong>; atenção a partir de <strong>{prop.reserva_atencao}%</strong></li>
          </ul>
          {r.podeAprovar && !r.propostaEhMinha ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <FormularioConfirmado
                acao={acaoAprovarPolitica}
                campos={{ id: prop.id, versao: prop.versao }}
                rotulo="Aprovar política"
                variante="primario"
                perigoso={false}
                titulo="Aprovar a política da reserva?"
                mensagem={`Os sinais da Visão geral passam a usar estas faixas e o mínimo de ${prop.meses_minimo} ${prop.meses_minimo === 1 ? 'mês' : 'meses'} de folha, a partir de ${rotuloMes(prop.vigencia)}. Isso não pode ser desfeito; para mudar, será preciso uma nova proposta.`}
                confirmar="Aprovar política"
              />
              <FormularioConfirmado
                acao={acaoRecusarPolitica}
                campos={{ id: prop.id, versao: prop.versao }}
                rotulo="Recusar"
                variante="secundario"
                titulo="Recusar a proposta?"
                mensagem="A proposta fica registrada como recusada e o Financeiro pode enviar outra."
                confirmar="Recusar proposta"
              >
                {MOTIVO}
              </FormularioConfirmado>
            </div>
          ) : (
            <p className="mt-4 text-sm text-texto-suave">{r.propostaEhMinha ? 'Você fez esta proposta; outra pessoa da Diretoria decide.' : 'Aguardando a decisão da Diretoria.'}</p>
          )}
        </Secao>
      )}

      {r.podeEditar && !prop && (
        <Secao titulo="Propor política" descricao="Os campos já vêm com as faixas em vigor. A proposta só vale depois que a Diretoria aprovar.">
          <FormularioProporPolitica acao={acaoProporPolitica} atuais={Object.fromEntries(CAMPOS_FAIXAS.map((k) => [k, r.faixas[k]])) as never} />
        </Secao>
      )}

      {r.podeEditar && (
        <Secao titulo="Pedir uso da reserva" descricao="O pedido não mexe no saldo: o saldo continua vindo do extrato digitado. A Diretoria aprova ou recusa.">
          <FormularioPedirUso acao={acaoPedirUso} meses={mesesPrazo} />
        </Secao>
      )}

      <Secao titulo="Pedidos de uso da reserva">
        {r.usos.length === 0 ? (
          <EstadoVazio titulo="Nenhum pedido de uso da reserva">Quando o Financeiro pedir, o pedido aparece aqui para a Diretoria decidir.</EstadoVazio>
        ) : (
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Pedidos de uso da reserva</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Pedido em</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Valor</th>
                  <th scope="col" className={tabela.th}>Motivo</th>
                  <th scope="col" className={tabela.th}>Recompor até</th>
                  <th scope="col" className={tabela.th}>Situação</th>
                  <th scope="col" className={tabela.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {r.usos.map((u) => {
                  const campos = { id: u.id, versao: u.versao };
                  return (
                    <tr key={u.id} className={tabela.linha}>
                      <td className={tabela.td}>{rotuloMes(u.mes_pedido)}</td>
                      <td className={`${tabela.td} ${tabela.numero}`}>{reais(u.valor)}</td>
                      <td className={`${tabela.td} max-w-64`}>
                        {u.motivo}
                        {u.motivo_decisao && <span className="block text-xs text-texto-suave">Recusa: {u.motivo_decisao}</span>}
                      </td>
                      <td className={tabela.td}>{rotuloMes(u.prazo_recomposicao)}</td>
                      <td className={tabela.td}>
                        {u.vencido ? <Etiqueta tipo="erro">Recomposição vencida</Etiqueta> : u.situacao === 'pedido' ? <Etiqueta tipo="info">Aguardando a Diretoria</Etiqueta> : u.situacao === 'aprovado' ? <Etiqueta tipo="sucesso">Aprovado</Etiqueta> : u.situacao === 'recusado' ? <Etiqueta>Recusado</Etiqueta> : <Etiqueta tipo="sucesso">Recomposto em {u.mes_recomposicao ? rotuloMes(u.mes_recomposicao) : '—'}</Etiqueta>}
                      </td>
                      <td className={tabela.td}>
                        <div className="flex flex-wrap gap-2">
                          {u.situacao === 'pedido' && r.podeAprovar && u.criado_por !== usuario.email && (
                            <>
                              <FormularioConfirmado
                                acao={acaoAprovarUso}
                                campos={campos}
                                rotulo="Aprovar uso"
                                variante="primario"
                                perigoso={false}
                                pequeno
                                titulo="Aprovar o uso da reserva?"
                                mensagem={`Aprovar o uso de ${reais(u.valor)} da reserva até a recomposição em ${rotuloMes(u.prazo_recomposicao)}. Isso não pode ser desfeito; se mudar de ideia, será preciso um novo pedido.`}
                                confirmar="Aprovar uso"
                              />
                              <FormularioConfirmado
                                acao={acaoRecusarUso}
                                campos={campos}
                                rotulo="Recusar"
                                variante="secundario"
                                pequeno
                                titulo="Recusar o pedido?"
                                mensagem={`O pedido de ${reais(u.valor)} fica registrado como recusado.`}
                                confirmar="Recusar pedido"
                              >
                                {MOTIVO}
                              </FormularioConfirmado>
                            </>
                          )}
                          {u.situacao === 'pedido' && r.podeEditar && (
                            <FormularioConfirmado
                              acao={acaoCancelarUso}
                              campos={campos}
                              rotulo="Cancelar pedido"
                              variante="secundario"
                              pequeno
                              titulo="Cancelar o pedido?"
                              mensagem="O pedido é encerrado e some desta lista; o registro continua guardado."
                              confirmar="Cancelar pedido"
                            />
                          )}
                          {u.situacao === 'aprovado' && r.podeEditar && (
                            <FormularioConfirmado
                              acao={acaoMarcarRecomposto}
                              campos={campos}
                              rotulo="Marcar como recomposto"
                              variante="secundario"
                              perigoso={false}
                              pequeno
                              titulo="Marcar como recomposto?"
                              mensagem={`O valor de ${reais(u.valor)} voltou para a reserva. Escolha o mês em que isso aconteceu.`}
                              confirmar="Marcar como recomposto"
                            >
                              <Campo rotulo="Mês da recomposição" obrigatorio>
                                <select name="mes" required defaultValue={atual} className={estiloEntrada}>
                                  {mesesRecompor.map((m) => (
                                    <option key={m} value={m}>
                                      {rotuloMes(m)}
                                    </option>
                                  ))}
                                </select>
                              </Campo>
                            </FormularioConfirmado>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
