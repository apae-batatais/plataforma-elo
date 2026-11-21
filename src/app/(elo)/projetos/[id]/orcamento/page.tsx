import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { resumoDoOrcamento } from '@/modulos/projetos/aplicacao/planejamento';
import { conteudoDe } from '@/modulos/projetos/aplicacao/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoRetirarLinhaOrcamento, acaoSalvarLinhaOrcamento } from '../../acoes';

export const metadata: Metadata = { title: 'Orçamento do projeto' };

function CamposLinha({ v }: { v?: { categoria: string; descricao: string; valor_planejado: number; fonte: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Categoria" obrigatorio dica="ex.: pessoal, materiais, serviços">
        <input name="categoria" required defaultValue={v?.categoria} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Valor planejado (R$)" obrigatorio dica="ex.: 2500 ou 2.500,50">
        <input name="valor" required inputMode="decimal" defaultValue={v ? String(v.valor_planejado).replace('.', ',') : ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="O que é" obrigatorio className="sm:col-span-2">
        <input name="descricao" required defaultValue={v?.descricao} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Fonte do recurso" dica="De onde vem o dinheiro. Opcional." className="sm:col-span-2">
        <input name="fonte" defaultValue={v?.fonte ?? ''} className={estiloEntrada} />
      </Campo>
    </div>
  );
}

export default async function PaginaOrcamento({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const editavel = f.podeAlterar && f.projeto.etapa === 'fase_3';
  const termo = f.documentos.termo_abertura;
  const total = termo ? conteudoDe(termo).valor_total : null;
  const resumo = resumoDoOrcamento(f.orcamento, f.projeto.valor_aprovado ?? (typeof total === 'number' ? total : null));
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Orçamento' }]}
        titulo="Orçamento do projeto"
        descricao="O plano de gastos deste projeto. Ele é separado do Orçamento da instituição: nada é enviado para lá."
      />
      <AbasProjeto id={id} atual="orcamento" />
      {!f.podeAlterar && <Aviso tipo="info">Só quem gerencia o projeto altera o orçamento. Você vê as linhas em leitura.</Aviso>}
      {f.podeAlterar && !editavel && <Aviso tipo="info">O orçamento só é alterado na fase 3 e sem porta aberta. Mudanças depois disso passam por pedido de mudança.</Aviso>}
      <Secao id="t-total" titulo="Total do plano">
        <p className="text-3xl font-semibold"><NumeroQueConta texto={moeda(resumo.total)} /></p>
        {resumo.valorDoTermo !== null && (
          <p className="mt-2 text-sm">
            Valor do Termo de Abertura: {moeda(resumo.valorDoTermo)}.{' '}
            {resumo.diferenca === 0 ? 'O plano fecha com o Termo.' : resumo.diferenca! > 0 ? `O plano passa ${moeda(resumo.diferenca!)} do Termo.` : `O plano ficou ${moeda(-resumo.diferenca!)} abaixo do Termo.`}
          </p>
        )}
      </Secao>
      {f.orcamento.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Inclua a primeira linha do orçamento.' : 'Nenhuma linha no orçamento.'}</EstadoVazio>
      ) : (
        <Secao id="t-linhas" titulo="Linhas do orçamento">
          <ul className="divide-y divide-borda">
            {f.orcamento.map((l) => (
              <li key={l.id} className="space-y-2 py-3 text-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="font-semibold">{l.categoria}</span> · {l.descricao}</span>
                  <span className="font-semibold tabular-nums">{moeda(l.valor_planejado)}</span>
                </p>
                {l.fonte && <p className="text-texto-suave">Fonte: {l.fonte}</p>}
                {editavel && (
                  <div className="flex flex-wrap gap-3">
                    <details className="min-w-64 flex-1 rounded-md border border-borda p-3">
                      <summary className="min-h-10 cursor-pointer font-semibold">Alterar linha</summary>
                      <form action={acaoSalvarLinhaOrcamento} className="mt-3 space-y-4">
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="linha" value={l.id} />
                        <input type="hidden" name="versao_linha" value={l.versao} />
                        <CamposLinha v={l} />
                        <BotaoEnviar enviando="Salvando…">Salvar alterações</BotaoEnviar>
                      </form>
                    </details>
                    <FormularioConfirmado acao={acaoRetirarLinhaOrcamento} campos={{ id, linha: l.id, versao_linha: l.versao }} rotulo="Retirar" titulo="Retirar esta linha?" mensagem="Ela sai do total, mas continua guardada." confirmar="Retirar linha" pequeno />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {editavel && (
        <Secao id="t-nova" titulo="Incluir linha">
          <form action={acaoSalvarLinhaOrcamento} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <CamposLinha />
            <BotaoEnviar enviando="Salvando…">Incluir linha</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
