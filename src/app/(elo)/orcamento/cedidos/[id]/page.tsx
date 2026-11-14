import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ErroValidacaoCedidos, fichaDoCedido } from '@/modulos/orcamento/aplicacao/cedidos';
import { ROTULO_TIPO_VALOR, TIPOS_VALOR } from '@/modulos/orcamento/dominio/cedidos';
import { data, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioCedido } from '@/modulos/orcamento/telas/formulario-cedido';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoAlterarValorCedido, acaoEncerrarCessao, acaoProrrogarCessao, acaoSalvarCedido } from '../../acoes';

export const metadata: Metadata = { title: 'Cedido' };

export default async function FichaDoCedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const novo = id === 'novo';
  if (!usuario.autorizador.temPermissao(novo ? 'orcamento.folha.editar' : 'orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  let ficha;
  try {
    ficha = await fichaDoCedido(app.planilhas, usuario.autorizador, novo ? null : id);
  } catch (erro) {
    if (erro instanceof ErroValidacaoCedidos) redirect('/orcamento/cedidos');
    throw erro;
  }
  const c = ficha.cedido;
  const titulo = novo ? 'Adicionar cedido' : (c?.colaborador ?? 'Vaga cedida');
  const encerrada = Boolean(c?.encerramento);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Cedidos', href: '/orcamento/cedidos' }, { rotulo: titulo }]}
        titulo={titulo}
        descricao={
          c && ficha.linha ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {c.funcao} · cedido por {ficha.linha.cedente}
              </span>
              {encerrada ? <Etiqueta tipo="neutro">Encerrada em {data(c.encerramento)}</Etiqueta> : ficha.linha.aviso && <Etiqueta tipo={ficha.linha.aviso.vencida ? 'erro' : 'atencao'}>{ficha.linha.aviso.vencida ? 'Vencida' : 'Termina em breve'}</Etiqueta>}
            </span>
          ) : (
            'Quem é cedido, por quem, a que custo e em quais serviços trabalha. Não entra na folha nem no caixa.'
          )
        }
        acoes={
          c && ficha.podeEditar && !encerrada ? (
            <>
              <FormularioConfirmado
                acao={acaoProrrogarCessao}
                campos={{ id: c.id, versao: c.versao }}
                rotulo="Prorrogar cessão"
                variante="secundario"
                perigoso={false}
                titulo="Prorrogar a cessão?"
                mensagem="O novo fim previsto substitui o atual. Se ficar além do prazo de aviso, o aviso some."
                confirmar="Prorrogar"
              >
                <Campo rotulo="Novo fim previsto" obrigatorio>
                  <input type="date" name="fim" required defaultValue={c.fimPrevisto ?? ''} className={estiloEntrada} />
                </Campo>
              </FormularioConfirmado>
              <FormularioConfirmado
                acao={acaoEncerrarCessao}
                campos={{ id: c.id, versao: c.versao }}
                rotulo="Encerrar cessão"
                variante="secundario"
                titulo="Encerrar a cessão?"
                mensagem="A pessoa deixa de contar no custo dos serviços a partir do mês seguinte ao encerramento. O histórico fica guardado."
                confirmar="Encerrar cessão"
              >
                <Campo rotulo="Data de encerramento" obrigatorio>
                  <input type="date" name="encerramento" required defaultValue={hoje} className={estiloEntrada} />
                </Campo>
              </FormularioConfirmado>
            </>
          ) : undefined
        }
      />
      {ficha.opcoes.cedentes.length === 0 ? (
        <EstadoVazio titulo="Cadastre quem cede primeiro" acao={<LinkBotao href="/orcamento/cedidos/cedentes">Ir para Quem cede</LinkBotao>}>
          Todo profissional cedido tem uma origem (poder público, empresa ou outro).
        </EstadoVazio>
      ) : (
        <div className="space-y-6">
          {encerrada && <Aviso tipo="info">Cessão encerrada: os dados ficam guardados e a pessoa não conta mais no custo.</Aviso>}
          {ficha.linha && ficha.linha.pendencias.length > 0 && (
            <Aviso tipo="atencao" titulo="Esta pessoa ainda não conta nos totais">
              {ficha.linha.pendencias.includes('valor') ? 'Falta o valor mensal. ' : ''}
              {ficha.linha.pendencias.includes('lotacao') ? 'A lotação não soma 100%.' : ''}
            </Aviso>
          )}
          <FormularioCedido key={`${c?.id}-${c?.versao}`} ficha={ficha} acao={acaoSalvarCedido} />
          {c && (
            <Secao titulo="Valor mensal" descricao="Mudar o valor grava uma nova linha com a data de início; o histórico fica.">
              {ficha.valor ? (
                <p className="mb-3 text-sm">
                  Hoje: <strong className="tabular-nums">{reais(ficha.valor.valorMensal)}</strong> por mês ·{' '}
                  {ficha.valor.tipoValor === 'informado' ? 'informado por quem cede' : 'custo equivalente, digitado'} · desde {data(ficha.valor.vigencia)}
                </p>
              ) : (
                <p className="mb-3 text-sm text-texto-suave">Nenhum valor informado.</p>
              )}
              {ficha.historicoDeValores.length > 1 && (
                <ul className="mb-4 space-y-1 text-sm text-texto-suave">
                  {ficha.historicoDeValores.map((h) => (
                    <li key={`${h.vigencia}-${h.valorMensal}`} className="tabular-nums">
                      {data(h.vigencia)}: {reais(h.valorMensal)} ({ROTULO_TIPO_VALOR[h.tipoValor]})
                    </li>
                  ))}
                </ul>
              )}
              {ficha.podeEditar && !encerrada && (
                <FormularioConfirmado
                  acao={acaoAlterarValorCedido}
                  campos={{ id: c.id }}
                  rotulo="Alterar valor"
                  variante="secundario"
                  perigoso={false}
                  titulo="Alterar o valor mensal?"
                  mensagem="O novo valor vale a partir do mês escolhido. Os meses anteriores continuam com o valor antigo. O Elo não calcula o custo equivalente."
                  confirmar="Salvar valor"
                >
                  <div className="space-y-3">
                    <Campo rotulo="Novo valor mensal" dica="Valor em reais por mês." obrigatorio>
                      <input name="valor" required inputMode="decimal" className={`${estiloEntrada} text-right tabular-nums`} />
                    </Campo>
                    <Campo rotulo="Tipo do valor" obrigatorio>
                      <select name="tipo" defaultValue={ficha.valor?.tipoValor ?? 'informado'} className={estiloEntrada}>
                        {TIPOS_VALOR.map((t) => (
                          <option key={t} value={t}>
                            {ROTULO_TIPO_VALOR[t]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo rotulo="Vale a partir de" obrigatorio>
                      <input type="month" name="vigencia" required defaultValue={hoje.slice(0, 7)} className={estiloEntrada} />
                    </Campo>
                  </div>
                </FormularioConfirmado>
              )}
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}
