import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerAcompanhamento } from '@/modulos/projetos/aplicacao/acompanhamento';
import { NOME_SITUACAO_RELATORIO, SITUACOES_RELATORIO, type SituacaoRelatorio } from '@/modulos/projetos/dominio/acompanhamento';
import { hojeEmBrasilia } from '@/modulos/projetos/dominio/planejamento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoEnviarRelatorio } from '../../acoes';

export const metadata: Metadata = { title: 'Relatórios do projeto' };

const TIPO: Record<SituacaoRelatorio, 'sucesso' | 'atencao' | 'erro'> = { verde: 'sucesso', amarelo: 'atencao', vermelho: 'erro' };
const data = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export default async function PaginaRelatorios({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const a = await lerAcompanhamento(planilhas, usuario.autorizador, id);
  if (!a) notFound();
  const hoje = hojeEmBrasilia(new Date());
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: a.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Relatórios' }]}
        titulo="Relatórios de monitoramento"
        descricao="Compara o planejado com o realizado. A situação geral é calculada pelo Elo; você pode piorá-la, nunca melhorá-la."
      />
      <AbasProjeto id={id} atual="relatorios" />
      {a.relatorios === null ? (
        <Aviso tipo="info">Quem está só na equipe do projeto não vê os relatórios.</Aviso>
      ) : (
        <>
          {a.projeto.etapa !== 'implementacao' && <Aviso tipo="info">Relatórios só são enviados com o projeto em implementação. Você vê o histórico em leitura.</Aviso>}
          {a.foraDaTolerancia && a.foraDaTolerancia.length > 0 && (
            <Aviso tipo="erro">
              <span className="font-semibold">Hoje o projeto está fora da tolerância:</span>
              <ul className="mt-1 list-disc pl-5">
                {a.foraDaTolerancia.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </Aviso>
          )}
          {a.relatorios.length === 0 ? (
            <EstadoVazio titulo="Nada aqui ainda.">{a.podeAlterar ? 'Envie o primeiro relatório do projeto no formulário abaixo.' : 'Nenhum relatório enviado.'}</EstadoVazio>
          ) : (
            <Secao id="t-lista" titulo="Relatórios enviados">
              <ul className="divide-y divide-borda">
                {a.relatorios.map((x) => (
                  <li key={x.id} className="space-y-1 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {data(x.periodo_inicio)} a {data(x.periodo_fim)}
                      <Etiqueta tipo={TIPO[x.situacao]}>{NOME_SITUACAO_RELATORIO[x.situacao]}</Etiqueta>
                      {x.fora_tolerancia && <Etiqueta tipo="erro">Fora da tolerância</Etiqueta>}
                    </p>
                    <p>
                      Planejado {x.planejado_pct}% · realizado {x.realizado_pct}% · {x.atividades_atrasadas} {x.atividades_atrasadas === 1 ? 'atividade atrasada' : 'atividades atrasadas'} · {x.problemas_abertos} {x.problemas_abertos === 1 ? 'problema aberto' : 'problemas abertos'}
                      {x.gasto_realizado !== null && <> · gasto {moeda(x.gasto_realizado)} de {moeda(x.orcamento_total)}</>}
                    </p>
                    <p>{x.texto}</p>
                    {x.situacao !== x.situacao_calculada && (
                      <p className="text-texto-suave">O Elo calculou “{NOME_SITUACAO_RELATORIO[x.situacao_calculada]}”; a pessoa responsável piorou: {x.justificativa}</p>
                    )}
                    <p className="text-texto-suave">Enviado por {x.enviado_por} em {data(x.enviado_em)}</p>
                  </li>
                ))}
              </ul>
            </Secao>
          )}
          {a.podeAlterar && (
            <Secao id="t-novo" titulo="Enviar relatório">
              <form action={acaoEnviarRelatorio} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo rotulo="Início do período" obrigatorio>
                    <input type="date" name="inicio" required className={estiloEntrada} />
                  </Campo>
                  <Campo rotulo="Fim do período" obrigatorio dica="Não pode ser depois de hoje.">
                    <input type="date" name="fim" required max={hoje} defaultValue={hoje} className={estiloEntrada} />
                  </Campo>
                </div>
                <Campo rotulo="O que aconteceu no período" obrigatorio>
                  <textarea name="texto" required rows={4} className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Quanto já foi gasto (R$)" dica="Opcional. ex.: 4500,00. Se informado, entra na conta da tolerância de custo.">
                  <input name="gasto" inputMode="decimal" className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Situação geral" dica="Em branco, vale a calculada pelo Elo. Você só pode escolher uma situação pior.">
                  <select name="situacao" defaultValue="" className={estiloEntrada}>
                    <option value="">Usar a calculada</option>
                    {SITUACOES_RELATORIO.map((s) => <option key={s} value={s}>{NOME_SITUACAO_RELATORIO[s]}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Por que piorou a situação" dica="Obrigatório só se você escolheu uma situação pior que a calculada.">
                  <textarea name="justificativa" rows={2} className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Enviando…">Enviar relatório</BotaoEnviar>
              </form>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
