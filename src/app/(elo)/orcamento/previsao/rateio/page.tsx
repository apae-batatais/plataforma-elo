import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarLancamentos } from '@/modulos/orcamento/aplicacao/lancamentos-rateio';
import { lerPrevisao, type LinhaDespesa } from '@/modulos/orcamento/aplicacao/previsao';
import { faixaDeMeses, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioItem } from '@/modulos/orcamento/telas/formulario-item';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirLancamento, acaoPreviaLancamento, acaoSalvarLancamento } from '../acoes';

export const metadata: Metadata = { title: 'Despesas por rateio' };

export default async function LancamentosPorRateio({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const lista = await listarLancamentos(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, lista.ano, { incluirCedidos: false });
  const base = `/orcamento/previsao/rateio?ano=${lista.ano}`;
  const podeLancar = lista.podeEditar && lista.emElaboracao && prev.opcoes.grupos.length > 0 && (prev.opcoes.regras?.length ?? 0) > 0;
  const emEdicao = sp.editar && lista.podeEditar && lista.emElaboracao ? lista.lancamentos.find((l) => l.id === sp.editar) : undefined;
  // O formulário de despesa lê estes campos do lançamento (não há serviço: a regra decide).
  const comoItem = (l: NonNullable<typeof emEdicao>) => l as unknown as LinhaDespesa;
  const formulario = (l?: NonNullable<typeof emEdicao>) => (
    <FormularioItem tipo="despesa" rateio acao={acaoSalvarLancamento} previa={acaoPreviaLancamento} ano={lista.ano} opcoes={prev.opcoes} item={l ? comoItem(l) : undefined} cancelarHref={base} />
  );

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Despesas', href: `/orcamento/previsao/despesas?ano=${lista.ano}` }, { rotulo: `Despesas por rateio ${lista.ano}` }]}
        titulo={`Despesas por rateio ${lista.ano}`}
        descricao="Lance uma despesa uma só vez e escolha a Regra de rateio: o Elo gera uma despesa para cada serviço, com o valor já dividido, e mantém tudo atualizado enquanto o orçamento está em elaboração."
        acoes={
          <>
            <SeletorAno anos={lista.anos} atual={lista.ano} href={(a) => `/orcamento/previsao/rateio?ano=${a}`} />
            {podeLancar && (
              <JanelaFormulario
                rotulo={
                  <>
                    <IconeMais tamanho={16} /> Novo lançamento
                  </>
                }
                className={pequeno}
                larga
                titulo="Novo lançamento por rateio"
              >
                {formulario()}
              </JanelaFormulario>
            )}
          </>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} larga titulo={`Alterar “${emEdicao.descricao}”`}>
          {formulario(emEdicao)}
        </JanelaFormulario>
      )}

      {!lista.exercicioAberto ? (
        <EstadoVazio titulo={`O exercício ${lista.ano} ainda não foi aberto`} acao={<LinkBotao href={`/orcamento/previsao?ano=${lista.ano}`}>Ir para a Previsão</LinkBotao>}>
          O Financeiro abre o exercício na tela Previsão. Depois disso, os lançamentos podem ser feitos.
        </EstadoVazio>
      ) : (
        <div className="space-y-6">
          {!lista.emElaboracao && (
            <Aviso tipo="info">O exercício {lista.ano} está aprovado: as despesas geradas ficam como estão. Mudanças só por remanejamento ou suplementação aprovados pela Diretoria.</Aviso>
          )}
          {lista.podeEditar && lista.emElaboracao && (prev.opcoes.regras?.length ?? 0) === 0 && (
            <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/regras">Ver regras de rateio</LinkBotao>}>
              Cadastre uma Regra de rateio antes de fazer um lançamento.
            </Aviso>
          )}
          {lista.podeEditar && lista.emElaboracao && prev.opcoes.grupos.length === 0 && (
            <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/grupos">Cadastrar grupos</LinkBotao>}>
              Cadastre os grupos de gasto antes de fazer um lançamento.
            </Aviso>
          )}
          {lista.lancamentos.some((l) => l.servicos === 0) && (
            <Aviso tipo="atencao" titulo="Há lançamento sem nenhuma despesa gerada">
              Nenhum serviço recebe o valor com a regra atual. Ajuste a Regra de rateio e salve o lançamento de novo.
            </Aviso>
          )}
          <TabelaDados
            legenda={`Lançamentos por rateio de ${lista.ano}`}
            vazio={lista.podeEditar ? 'Nenhum lançamento de rateio ainda. Use “Novo lançamento”.' : 'Nenhum lançamento de rateio ainda.'}
            totalRotulo="Total dos lançamentos"
            colunas={[
              { chave: 'descricao', rotulo: 'Descrição' },
              { chave: 'grupo', rotulo: 'Grupo' },
              { chave: 'regra', rotulo: 'Regra de rateio' },
              { chave: 'servicos', rotulo: 'Serviços que recebem', secundaria: true },
              { chave: 'valor', rotulo: 'Valor no ano', tipo: 'moeda', somar: true },
              ...(lista.podeEditar && lista.emElaboracao ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' }] : []),
            ]}
            linhas={lista.lancamentos.map((l) => ({
              id: l.id,
              destaque: emEdicao?.id === l.id,
              valores: { descricao: l.descricao, grupo: l.grupoNome, regra: l.regraNome, servicos: l.servicos, valor: l.valor },
              celulas: {
                descricao: (
                  <>
                    <span className="font-semibold">{l.descricao}</span>
                    <span className="block text-xs text-texto-suave">{l.distribuicao === 'manual' ? `mês a mês: ${faixaDeMeses(l.meses)}` : faixaDeMeses(l.meses)}</span>
                  </>
                ),
                servicos: l.servicos === 0 ? <Etiqueta tipo="atencao">Nenhum</Etiqueta> : String(l.servicos),
                acoes: (
                  <div className="flex justify-end gap-1">
                    <LinkBotao href={`${base}&editar=${l.id}`} scroll={false} variante="icone" aria-label={`Alterar ${l.descricao}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    <FormularioConfirmado
                      acao={acaoExcluirLancamento}
                      campos={{ id: l.id, versao: l.versao, ano: lista.ano }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Excluir ${l.descricao}`}
                      variante="icone-perigo"
                      titulo={`Excluir “${l.descricao}”?`}
                      mensagem={`O lançamento de ${reais(l.valor)} e as ${l.servicos} despesas geradas por ele serão encerradas. Nada é apagado da planilha.`}
                      confirmar="Excluir lançamento"
                    />
                  </div>
                ),
              },
            }))}
          />
        </div>
      )}
    </div>
  );
}
