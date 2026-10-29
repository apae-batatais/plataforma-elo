import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarPropostas } from '@/modulos/orcamento/aplicacao/aprovacao';
import { reais } from '@/modulos/orcamento/telas/formato';
import { FormularioItem } from '@/modulos/orcamento/telas/formulario-item';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeCerto, IconeEditar, IconeFechar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoDecidirProposta, acaoRetirarProposta, acaoSalvarProposta } from '../acoes';

export const metadata: Metadata = { title: 'Propostas' };
const SITUACAO = { proposta: 'Aguardando o Financeiro', aceito: 'Aceita', recusada: 'Recusada' } as const;
const COR = { proposta: 'atencao', aceito: 'sucesso', recusada: 'erro' } as const;

export default async function Propostas({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string; recusar?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const r = await listarPropostas(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const base = `/orcamento/previsao/propostas?ano=${r.ano}`;
  const emEdicao = sp.editar ? r.lista.find((x) => x.id === sp.editar && x.podeAlterar) : undefined;
  const aRecusar = sp.recusar && r.decide ? r.lista.find((x) => x.id === sp.recusar && x.situacao === 'proposta') : undefined;
  const pendentes = r.lista.filter((x) => x.situacao === 'proposta');
  const emElaboracao = r.situacao === 'elaboracao';

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: `Propostas ${r.ano}` }]}
        titulo={`Propostas ${r.ano}`}
        descricao={
          r.decide
            ? 'Itens de despesa propostos pelas coordenações. Aceite (entra no orçamento), ajuste antes de aceitar ou recuse com um motivo.'
            : 'Proponha os itens de despesa dos seus serviços. O Financeiro aceita, ajusta ou recusa; o motivo aparece aqui.'
        }
        acoes={
          r.podePropor && !r.decide ? (
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Propor despesa
                </>
              }
              className={pequeno}
              larga
              titulo="Propor despesa"
              descricao="Só nos serviços em que você é coordenação."
            >
              <FormularioItem tipo="despesa" acao={acaoSalvarProposta} ano={r.ano} opcoes={r.opcoes} cancelarHref={base} proposta={!r.decide} />
            </JanelaFormulario>
          ) : undefined
        }
      />

      {!emElaboracao && (
        <Aviso tipo="info">
          O exercício {r.ano} {r.situacao === 'aprovado' ? 'já foi aprovado' : r.situacao === 'encerrado' ? 'está encerrado' : 'ainda não foi aberto'}: não recebe mais propostas.
        </Aviso>
      )}
      {r.decide && pendentes.length > 0 && (
        <Aviso tipo="atencao" titulo={`${pendentes.length} ${pendentes.length === 1 ? 'proposta aguarda' : 'propostas aguardam'} a sua decisão`}>
          O exercício só pode ser aprovado pela Diretoria depois que todas forem decididas.
        </Aviso>
      )}

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} larga titulo={r.decide ? `Ajustar “${emEdicao.descricao}”` : `Alterar “${emEdicao.descricao}”`} descricao={r.decide ? 'Depois de salvar, aceite a proposta na lista.' : undefined}>
          <FormularioItem tipo="despesa" acao={acaoSalvarProposta} ano={r.ano} opcoes={r.opcoes} item={emEdicao} cancelarHref={base} proposta={!r.decide} />
        </JanelaFormulario>
      )}
      {aRecusar && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} titulo={`Recusar “${aRecusar.descricao}”`} descricao={`${aRecusar.servicoNome} · ${reais(aRecusar.valor)}`}>
          <form action={acaoDecidirProposta} className="space-y-4">
            <input type="hidden" name="id" value={aRecusar.id} />
            <input type="hidden" name="versao" value={aRecusar.versao} />
            <input type="hidden" name="ano" value={r.ano} />
            <input type="hidden" name="decisao" value="recusar" />
            <Campo rotulo="Motivo" obrigatorio dica="A coordenação vai ler este texto.">
              <textarea name="motivo" required rows={3} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar variante="perigo" enviando="Recusando…" className="w-full">
              Recusar proposta
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda={`Propostas de ${r.ano}`}
        vazio={r.decide ? 'Nenhuma proposta das coordenações.' : 'Você ainda não propôs nada. Use “Propor despesa”.'}
        totalRotulo="Total"
        colunas={[
          { chave: 'situacao', rotulo: 'Situação' },
          { chave: 'descricao', rotulo: 'Item' },
          { chave: 'servico', rotulo: 'Serviço' },
          { chave: 'grupo', rotulo: 'Grupo' },
          { chave: 'proposto', rotulo: 'Proposto por', secundaria: !r.decide },
          { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', somar: true },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-28' },
        ]}
        linhas={r.lista.map((x) => ({
          id: x.id,
          valores: {
            situacao: SITUACAO[x.situacao],
            descricao: x.descricao,
            servico: x.servicoNome,
            grupo: x.grupoNome,
            proposto: x.propostoPor,
            valor: x.valor,
          },
          celulas: {
            situacao: (
              <>
                <Etiqueta tipo={COR[x.situacao]}>{SITUACAO[x.situacao]}</Etiqueta>
                {x.motivoDecisao && <span className="mt-1 block max-w-56 text-xs text-texto-suave">“{x.motivoDecisao}”</span>}
              </>
            ),
            descricao: (
              <>
                <span className="font-semibold">{x.descricao}</span>
                <span className="block text-xs text-texto-suave">Fonte: {x.fonteNome}</span>
              </>
            ),
            valor: x.valor === 0 ? <span className="text-sm italic text-texto-suave">a definir</span> : undefined,
            acoes: x.podeAlterar ? (
              <div className="flex justify-end gap-1">
                {r.decide && x.valor > 0 && (
                  <FormularioConfirmado
                    acao={acaoDecidirProposta}
                    campos={{ id: x.id, versao: x.versao, ano: r.ano, decisao: 'aceitar' }}
                    rotulo={<IconeCerto tamanho={16} />}
                    rotuloAcessivel={`Aceitar ${x.descricao}`}
                    variante="icone"
                    perigoso={false}
                    titulo={`Aceitar “${x.descricao}”?`}
                    mensagem={`O item de ${reais(x.valor)} entra no orçamento de ${r.ano} (${x.servicoNome}).`}
                    confirmar="Aceitar"
                  />
                )}
                <LinkBotao href={`${base}&editar=${x.id}`} scroll={false} variante="icone" aria-label={`${r.decide ? 'Ajustar' : 'Alterar'} ${x.descricao}`} title={r.decide ? (x.valor > 0 ? 'Ajustar' : 'Informar o valor para poder aceitar') : 'Alterar'}>
                  <IconeEditar tamanho={16} />
                </LinkBotao>
                {r.decide ? (
                  <LinkBotao href={`${base}&recusar=${x.id}`} scroll={false} variante="icone-perigo" aria-label={`Recusar ${x.descricao}`} title="Recusar">
                    <IconeFechar tamanho={16} />
                  </LinkBotao>
                ) : (
                  <FormularioConfirmado
                    acao={acaoRetirarProposta}
                    campos={{ id: x.id, versao: x.versao, ano: r.ano }}
                    rotulo={<IconeLixeira tamanho={16} />}
                    rotuloAcessivel={`Retirar ${x.descricao}`}
                    variante="icone-perigo"
                    titulo={`Retirar “${x.descricao}”?`}
                    mensagem="A proposta sai da lista do Financeiro. Ela fica registrada como cancelada."
                    confirmar="Retirar proposta"
                  />
                )}
              </div>
            ) : null,
          },
        }))}
      />
    </div>
  );
}
