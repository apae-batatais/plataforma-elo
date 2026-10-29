import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarAjustes } from '@/modulos/orcamento/aplicacao/aprovacao';
import { data, MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeCerto, IconeFechar } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoDecidirAjuste, acaoSolicitarAjuste } from '../acoes';

export const metadata: Metadata = { title: 'Remanejamentos' };
const SITUACAO = { pendente: 'Aguardando a Diretoria', aprovado: 'Aprovado', recusado: 'Recusado' } as const;
const COR = { pendente: 'atencao', aprovado: 'sucesso', recusado: 'erro' } as const;
const TIPO = { remanejamento: 'Remanejamento', suplementacao: 'Suplementação' } as const;

function CamposComuns() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Mês" obrigatorio>
          <select name="mes" required defaultValue="" className={estiloEntrada}>
            <option value="" disabled>
              Escolha o mês
            </option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Valor (R$)" obrigatorio>
          <input name="valor" required inputMode="decimal" className={estiloEntrada} />
        </Campo>
      </div>
      <Campo rotulo="Justificativa" obrigatorio dica="A Diretoria decide a partir deste texto.">
        <textarea name="justificativa" required rows={3} className={estiloEntrada} />
      </Campo>
    </>
  );
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ano?: string; recusar?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const { prev, lista, podeSolicitar, podeDecidir } = await listarAjustes(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const base = `/orcamento/previsao/ajustes?ano=${prev.ano}`;
  const aRecusar = podeDecidir && sp.recusar ? lista.find((a) => a.id === sp.recusar && a.situacao === 'pendente') : undefined;
  const pendentes = lista.filter((a) => a.situacao === 'pendente').length;
  const rotuloDespesa = (d: (typeof prev.despesas)[number]) => `${d.descricao} · ${d.servicoNome} (${reais(d.valor)})`;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: `Remanejamentos ${prev.ano}` }]}
        titulo={`Remanejamentos e suplementações ${prev.ano}`}
        descricao="Depois de aprovado, o orçamento só muda por aqui. Remanejamento move valor entre despesas (o total não muda). Suplementação aumenta ou reduz um item. A Diretoria aprova cada pedido."
        acoes={
          podeSolicitar ? (
            <>
              <JanelaFormulario rotulo="Pedir suplementação" variante="fantasma" className={pequeno} titulo="Pedir suplementação" descricao="Aumenta ou reduz uma despesa ou uma receita num mês.">
                <form action={acaoSolicitarAjuste} className="space-y-4">
                  <input type="hidden" name="ano" value={prev.ano} />
                  <input type="hidden" name="tipo" value="suplementacao" />
                  <Campo rotulo="Item" obrigatorio>
                    <select name="destino" required defaultValue="" className={estiloEntrada}>
                      <option value="" disabled>
                        Escolha o item
                      </option>
                      <optgroup label="Despesas">
                        {prev.despesas.map((d) => (
                          <option key={d.id} value={`despesa:${d.id}`}>
                            {rotuloDespesa(d)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Receitas">
                        {prev.receitas.map((r) => (
                          <option key={r.id} value={`receita:${r.id}`}>
                            {r.descricao} · {r.fonteNome} ({reais(r.valor)})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </Campo>
                  <fieldset className="text-sm">
                    <legend className="font-semibold">Sentido</legend>
                    <div className="mt-1.5 flex gap-4">
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="sentido" value="aumentar" defaultChecked /> Aumentar
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="sentido" value="reduzir" /> Reduzir
                      </label>
                    </div>
                  </fieldset>
                  <CamposComuns />
                  <BotaoEnviar enviando="Enviando…" className="w-full">
                    Enviar para a Diretoria
                  </BotaoEnviar>
                </form>
              </JanelaFormulario>
              <JanelaFormulario rotulo="Pedir remanejamento" className={pequeno} larga titulo="Pedir remanejamento" descricao="Tira valor de uma despesa e põe em outra, no mesmo mês. O total não muda.">
                <form action={acaoSolicitarAjuste} className="space-y-4">
                  <input type="hidden" name="ano" value={prev.ano} />
                  <input type="hidden" name="tipo" value="remanejamento" />
                  <Campo rotulo="Tirar de (origem)" obrigatorio>
                    <select name="origem" required defaultValue="" className={estiloEntrada}>
                      <option value="" disabled>
                        Escolha a despesa
                      </option>
                      {prev.despesas.map((d) => (
                        <option key={d.id} value={d.id}>
                          {rotuloDespesa(d)}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Pôr em (destino)" obrigatorio>
                    <select name="destino" required defaultValue="" className={estiloEntrada}>
                      <option value="" disabled>
                        Escolha a despesa
                      </option>
                      {prev.despesas.map((d) => (
                        <option key={d.id} value={`despesa:${d.id}`}>
                          {rotuloDespesa(d)}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <CamposComuns />
                  <BotaoEnviar enviando="Enviando…" className="w-full">
                    Enviar para a Diretoria
                  </BotaoEnviar>
                </form>
              </JanelaFormulario>
            </>
          ) : undefined
        }
      />

      {prev.exercicio?.situacao !== 'aprovado' && (
        <Aviso tipo="info">
          {prev.exercicio?.situacao === 'encerrado'
            ? `O exercício ${prev.ano} está encerrado.`
            : `O exercício ${prev.ano} ainda está em elaboração: as mudanças são feitas direto em Despesas e Receitas. Remanejamentos só depois da aprovação da Diretoria.`}
        </Aviso>
      )}
      {podeDecidir && pendentes > 0 && (
        <Aviso tipo="atencao" titulo={`${pendentes} ${pendentes === 1 ? 'pedido aguarda' : 'pedidos aguardam'} a sua decisão`}>
          Aprove ou recuse cada pedido na lista abaixo.
        </Aviso>
      )}

      {aRecusar && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} titulo={`Recusar ${TIPO[aRecusar.tipo].toLowerCase()}`} descricao={`${aRecusar.destino} · ${reais(aRecusar.valor)}`}>
          <form action={acaoDecidirAjuste} className="space-y-4">
            <input type="hidden" name="id" value={aRecusar.id} />
            <input type="hidden" name="versao" value={aRecusar.versao} />
            <input type="hidden" name="ano" value={prev.ano} />
            <input type="hidden" name="decisao" value="recusar" />
            <Campo rotulo="Motivo" obrigatorio dica="O Financeiro vai ler este texto.">
              <textarea name="motivo" required rows={3} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar variante="perigo" enviando="Recusando…" className="w-full">
              Recusar pedido
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda={`Remanejamentos e suplementações de ${prev.ano}`}
        vazio="Nenhum pedido."
        colunas={[
          { chave: 'situacao', rotulo: 'Situação' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'movimento', rotulo: 'De → para' },
          { chave: 'mes', rotulo: 'Mês' },
          { chave: 'valor', rotulo: 'Valor', tipo: 'moeda' },
          { chave: 'justificativa', rotulo: 'Justificativa' },
          { chave: 'pedido', rotulo: 'Pedido por', secundaria: true },
          { chave: 'decisao', rotulo: 'Decisão', secundaria: true },
          ...(podeDecidir ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' }] : []),
        ]}
        linhas={lista.map((a) => ({
          id: a.id,
          valores: {
            situacao: SITUACAO[a.situacao],
            tipo: TIPO[a.tipo],
            movimento: a.origem ? `${a.origem} → ${a.destino}` : a.destino,
            mes: MESES[a.mes - 1],
            valor: a.valor,
            justificativa: a.justificativa,
            pedido: a.solicitadoPor,
            decisao: a.decididoPor ? `${a.decididoPor} em ${data(a.decididoEm)}` : null,
          },
          celulas: {
            situacao: (
              <>
                <Etiqueta tipo={COR[a.situacao]}>{SITUACAO[a.situacao]}</Etiqueta>
                {a.motivoDecisao && <span className="mt-1 block max-w-56 text-xs text-texto-suave">“{a.motivoDecisao}”</span>}
              </>
            ),
            movimento: a.origem ? (
              <span className="text-sm">
                <span className="block text-texto-suave">De: {a.origem}</span>
                <span className="block">Para: {a.destino}</span>
              </span>
            ) : (
              <span className="text-sm">
                {a.destino} <span className="text-xs text-texto-suave">({a.destinoTipo})</span>
              </span>
            ),
            justificativa: <span className="block max-w-72 text-sm">{a.justificativa}</span>,
            acoes:
              podeDecidir && a.situacao === 'pendente' ? (
                <div className="flex justify-end gap-1">
                  <FormularioConfirmado
                    acao={acaoDecidirAjuste}
                    campos={{ id: a.id, versao: a.versao, ano: prev.ano, decisao: 'aprovar' }}
                    rotulo={<IconeCerto tamanho={16} />}
                    rotuloAcessivel="Aprovar pedido"
                    variante="icone"
                    perigoso={false}
                    titulo={`Aprovar ${TIPO[a.tipo].toLowerCase()} de ${reais(a.valor)}?`}
                    mensagem={a.origem ? `Sai de “${a.origem}” e vai para “${a.destino}” em ${MESES[a.mes - 1].toLowerCase()}.` : `“${a.destino}” muda ${reais(a.valor)} em ${MESES[a.mes - 1].toLowerCase()}.`}
                    confirmar="Aprovar"
                  />
                  <LinkBotao href={`${base}&recusar=${a.id}`} scroll={false} variante="icone-perigo" aria-label="Recusar pedido" title="Recusar">
                    <IconeFechar tamanho={16} />
                  </LinkBotao>
                </div>
              ) : null,
          },
        }))}
      />
    </div>
  );
}
