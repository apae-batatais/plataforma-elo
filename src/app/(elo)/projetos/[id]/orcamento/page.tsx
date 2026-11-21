import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerPlanejamento } from '@/modulos/projetos/aplicacao/planejamento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoRetirarLinhaOrcamento, acaoSalvarLinhaOrcamento } from '../../acoes';

export const metadata: Metadata = { title: 'Orçamento do projeto' };

function CamposLinha({ v }: { v?: { categoria: string; descricao: string; valor_planejado: number; fonte: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Categoria" obrigatorio dica="ex.: pessoal, material, serviços">
        <input name="categoria" required defaultValue={v?.categoria} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Valor planejado (R$)" obrigatorio dica="ex.: 1500,50">
        <input name="valor" required inputMode="decimal" defaultValue={v ? String(v.valor_planejado).replace('.', ',') : ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Descrição" obrigatorio className="sm:col-span-2">
        <input name="descricao" required defaultValue={v?.descricao} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="De onde vem o dinheiro" dica="Opcional. ex.: recurso próprio" className="sm:col-span-2">
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
  const l = await lerPlanejamento(planilhas, usuario.autorizador, id);
  if (!l) notFound();
  const editavel = l.podeAlterarOrcamento;
  const o = l.orcamento;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: l.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Orçamento' }]}
        titulo="Orçamento do projeto"
        descricao="O plano de gastos do projeto. É separado do Orçamento da instituição: nada é enviado para lá."
      />
      <AbasProjeto id={id} atual="orcamento" />
      {!o ? (
        <Aviso tipo="info">Quem está só na equipe do projeto não vê o orçamento.</Aviso>
      ) : (
        <>
          {!editavel && <Aviso tipo="info">O orçamento só é alterado por quem gerencia o projeto, e só na fase 3. Depois disso, mudanças passam por pedido de mudança. Você vê a lista em leitura.</Aviso>}
          <p className="text-lg" role="status">
            Total planejado: <span className="font-bold tabular-nums">{moeda(o.total)}</span>
            {o.valorAprovado !== null && <span className="block text-sm text-texto-suave">Valor aprovado no Termo de Abertura: {moeda(o.valorAprovado)}{o.total !== o.valorAprovado ? ' (o orçamento soma outro valor)' : ''}</span>}
          </p>
          {o.linhas.length === 0 ? (
            <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Inclua as linhas do orçamento. Ao menos uma é exigida para sair da fase 3.' : 'Nenhuma linha no orçamento.'}</EstadoVazio>
          ) : (
            <Secao id="t-linhas" titulo="Linhas do orçamento">
              <ul className="divide-y divide-borda">
                {o.linhas.map((x) => (
                  <li key={x.id} className="space-y-2 py-3 text-sm">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span><span className="font-semibold">{x.descricao}</span> <span className="text-texto-suave">· {x.categoria}</span></span>
                      <span className="font-semibold tabular-nums">{moeda(x.valor_planejado)}</span>
                    </p>
                    {x.fonte && <p className="text-texto-suave">Fonte: {x.fonte}</p>}
                    {editavel && (
                      <div className="flex flex-wrap items-start gap-3">
                        <details className="flex-1">
                          <summary className="inline-flex min-h-10 cursor-pointer items-center font-semibold underline">Alterar</summary>
                          <form action={acaoSalvarLinhaOrcamento} className="mt-2 space-y-4">
                            <input type="hidden" name="id" value={id} />
                            <input type="hidden" name="linha" value={x.id} />
                            <input type="hidden" name="versao_linha" value={x.versao} />
                            <CamposLinha v={x} />
                            <BotaoEnviar enviando="Salvando…">Salvar alterações</BotaoEnviar>
                          </form>
                        </details>
                        <FormularioConfirmado acao={acaoRetirarLinhaOrcamento} campos={{ id, linha: x.id, versao_linha: x.versao }} rotulo="Retirar" titulo="Retirar esta linha?" mensagem="Ela deixa de somar no total, mas continua guardada." confirmar="Retirar linha" pequeno />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Secao>
          )}
          {o.porCategoria.length > 1 && (
            <Secao id="t-categorias" titulo="Por categoria">
              <ul className="space-y-1 text-sm">
                {o.porCategoria.map((c) => (
                  <li key={c.categoria} className="flex justify-between gap-3"><span>{c.categoria}</span><span className="tabular-nums">{moeda(c.total)}</span></li>
                ))}
              </ul>
            </Secao>
          )}
          {editavel && (
            <Secao id="t-novo" titulo="Adicionar linha">
              <form action={acaoSalvarLinhaOrcamento} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <CamposLinha />
                <BotaoEnviar enviando="Salvando…">Adicionar linha</BotaoEnviar>
              </form>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
