import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerPrevisao } from '@/modulos/orcamento/aplicacao/previsao';
import { CAPTACAO, NATUREZA, USO, type Captacao } from '@/modulos/orcamento/dominio/previsao';
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
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoCancelarItem, acaoSalvarReceita } from '../acoes';

export const metadata: Metadata = { title: 'Receitas' };
const TIPO_CAPTACAO: Record<Captacao, 'sucesso' | 'info' | 'atencao'> = { garantida: 'sucesso', negociacao: 'info', a_captar: 'atencao' };
const resumoMeses = (r: { distribuicao: string; meses: number[] }) => (r.distribuicao === 'manual' ? `mês a mês: ${faixaDeMeses(r.meses)}` : faixaDeMeses(r.meses));

export default async function Receitas({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const base = `/orcamento/previsao/receitas?ano=${prev.ano}`;
  const emEdicao = sp.editar && prev.podeEditar ? prev.receitas.find((r) => r.id === sp.editar) : undefined;
  const total = prev.totais.receita.anual;
  const podeLancar = prev.podeEditar && prev.opcoes.fontes.length > 0;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: `Receitas ${prev.ano}` }]}
        titulo={`Receitas ${prev.ano}`}
        descricao="O que se espera receber, por fonte de recurso e área, e a situação da captação de cada receita."
        acoes={
          <>
            {prev.anos.length > 1 &&
              prev.anos.map((a) => (
                <LinkBotao key={a} href={`/orcamento/previsao/receitas?ano=${a}`} variante={a === prev.ano ? 'secundario' : 'fantasma'} className={pequeno}>
                  {a}
                </LinkBotao>
              ))}
            {podeLancar && (
              <JanelaFormulario
                rotulo={
                  <>
                    <IconeMais tamanho={16} /> Lançar receita
                  </>
                }
                className={pequeno}
                larga
                titulo="Lançar receita"
              >
                <FormularioItem tipo="receita" acao={acaoSalvarReceita} ano={prev.ano} opcoes={prev.opcoes} cancelarHref={base} />
              </JanelaFormulario>
            )}
          </>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} larga titulo={`Alterar “${emEdicao.descricao}”`}>
          <FormularioItem tipo="receita" acao={acaoSalvarReceita} ano={prev.ano} opcoes={prev.opcoes} item={emEdicao} cancelarHref={base} />
        </JanelaFormulario>
      )}

      {!prev.exercicio ? (
        <EstadoVazio titulo={`O exercício ${prev.ano} ainda não foi aberto`} acao={<LinkBotao href={`/orcamento/previsao?ano=${prev.ano}`}>Ir para a Previsão</LinkBotao>}>
          O Financeiro abre o exercício na tela Previsão. Depois disso, as receitas podem ser lançadas.
        </EstadoVazio>
      ) : (
        <div className="space-y-4">
          {prev.exercicio.situacao !== 'elaboracao' && (
            <Aviso tipo="info">O exercício {prev.ano} está aprovado: as receitas só mudam por suplementação aprovada pela Diretoria.</Aviso>
          )}
          {prev.podeEditar && prev.opcoes.fontes.length === 0 && (
            <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/fontes">Cadastrar fontes</LinkBotao>}>
              Cadastre as fontes de recurso antes de lançar receitas.
            </Aviso>
          )}

          <dl className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(CAPTACAO) as Captacao[]).map((c) => (
              <div key={c} className="rounded-xl border border-borda bg-superficie px-4 py-3">
                <dt>
                  <Etiqueta tipo={TIPO_CAPTACAO[c]}>{CAPTACAO[c]}</Etiqueta>
                </dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{reais(prev.totais.porCaptacao[c])}</dd>
                <dd className="text-sm text-texto-suave">{total > 0 ? `${Math.round((prev.totais.porCaptacao[c] / total) * 1000) / 10}% da receita` : '—'}</dd>
              </div>
            ))}
          </dl>

          <TabelaDados
            legenda={`Receitas de ${prev.ano}`}
            vazio={prev.podeEditar ? 'Nenhuma receita lançada. Use “Lançar receita”.' : 'Nenhuma receita lançada.'}
            totalRotulo="Total das receitas"
            colunas={[
              { chave: 'descricao', rotulo: 'Receita' },
              { chave: 'fonte', rotulo: 'Fonte' },
              { chave: 'natureza', rotulo: 'Natureza', secundaria: true },
              { chave: 'uso', rotulo: 'Uso', secundaria: true },
              { chave: 'area', rotulo: 'Área' },
              { chave: 'captacao', rotulo: 'Captação' },
              { chave: 'meses', rotulo: 'Meses', secundaria: true },
              { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', somar: true },
              ...(prev.podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' }] : []),
            ]}
            linhas={prev.receitas.map((r) => ({
              id: r.id,
              destaque: emEdicao?.id === r.id,
              valores: {
                descricao: r.descricao,
                fonte: r.fonteNome,
                natureza: NATUREZA[r.natureza],
                uso: USO[r.uso],
                area: r.areaNome ?? 'Geral',
                captacao: CAPTACAO[r.captacao],
                meses: resumoMeses(r),
                valor: r.valor,
              },
              celulas: {
                descricao: (
                  <>
                    <span className="font-semibold">{r.descricao}</span>
                    {r.observacao && <span className="block text-xs italic text-texto-suave">{r.observacao}</span>}
                  </>
                ),
                area: r.areaNome ?? <span className="text-texto-suave">Geral</span>,
                captacao: <Etiqueta tipo={TIPO_CAPTACAO[r.captacao]}>{CAPTACAO[r.captacao]}</Etiqueta>,
                meses: <span className="text-xs text-texto-suave">{resumoMeses(r)}</span>,
                acoes: (
                  <div className="flex justify-end gap-1">
                    <LinkBotao href={`${base}&editar=${r.id}`} scroll={false} variante="icone" aria-label={`Alterar ${r.descricao}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    <FormularioConfirmado
                      acao={acaoCancelarItem}
                      campos={{ id: r.id, versao: r.versao, tipo: 'receita', ano: prev.ano }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Excluir ${r.descricao}`}
                      variante="icone-perigo"
                      titulo={`Excluir “${r.descricao}”?`}
                      mensagem={`A receita de ${reais(r.valor)} sai do orçamento. Ela não é apagada da planilha: fica registrada como cancelada.`}
                      confirmar="Excluir receita"
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
