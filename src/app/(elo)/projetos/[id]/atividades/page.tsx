import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { andamentoPercentual, hojeEm, NOME_SITUACAO_ATIVIDADE, SITUACOES_ATIVIDADE, situacaoExibida } from '@/modulos/projetos/dominio/planejamento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoAndamentoAtividade, acaoRetirarAtividade, acaoSalvarAtividade } from '../../acoes';

export const metadata: Metadata = { title: 'Atividades do projeto' };

const data = (v: string | null) => (v ? v.split('-').reverse().join('/') : '—');
const TIPO = { a_fazer: 'neutro', em_andamento: 'info', concluida: 'sucesso', cancelada: 'neutro', atrasada: 'erro' } as const;

function CamposPlano({ v }: { v?: { descricao: string; responsavel: string; inicio_previsto: string; fim_previsto: string; peso: number | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="O que será feito" obrigatorio className="sm:col-span-2">
        <input name="descricao" required defaultValue={v?.descricao} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Pessoa responsável (e-mail)" obrigatorio dica="A pessoa precisa ter acesso ao Elo.">
        <input type="email" name="responsavel" required defaultValue={v?.responsavel} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Peso no andamento" dica="Opcional. Atividade maior pode valer mais (ex.: 3). Sem peso, vale 1.">
        <input name="peso" inputMode="decimal" defaultValue={v?.peso ?? ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Início previsto" obrigatorio>
        <input type="date" name="inicio_previsto" required defaultValue={v?.inicio_previsto} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Fim previsto" obrigatorio>
        <input type="date" name="fim_previsto" required defaultValue={v?.fim_previsto} className={estiloEntrada} />
      </Campo>
    </div>
  );
}

export default async function PaginaAtividades({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const etapa = f.projeto.etapa;
  const planejar = f.podeAlterar && etapa === 'fase_3';
  const andamento = f.podeAlterar && (etapa === 'fase_3' || etapa === 'implementacao');
  const hoje = hojeEm(new Date());
  const pct = andamentoPercentual(f.atividades);
  const atrasadas = f.atividades.filter((a) => situacaoExibida(a, hoje) === 'atrasada').length;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Atividades' }]}
        titulo="Atividades"
        descricao="O que será feito, por quem e até quando. Esta lista é também o cronograma do projeto."
      />
      <AbasProjeto id={id} atual="atividades" />
      {!f.podeAlterar && <Aviso tipo="info">Só quem gerencia o projeto altera as atividades. Você vê a lista em leitura.</Aviso>}
      {f.podeAlterar && !planejar && etapa !== 'implementacao' && <Aviso tipo="info">As atividades só são planejadas na fase 3 e sem porta aberta.</Aviso>}
      {f.podeAlterar && etapa === 'implementacao' && <Aviso tipo="info">O planejamento está travado. Aqui você lança o andamento de cada atividade.</Aviso>}
      {f.atividades.length > 0 && (
        <p className="text-sm">
          {pct !== null && <span className="font-semibold">{pct}% concluído</span>}
          {atrasadas > 0 && <span> · <span className="font-semibold">{atrasadas} {atrasadas === 1 ? 'atividade atrasada' : 'atividades atrasadas'}</span></span>}
        </p>
      )}
      {f.atividades.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{planejar ? 'Adicione a primeira atividade, com datas e responsável.' : 'Nenhuma atividade cadastrada.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo="Atividades do projeto">
          <ul className="divide-y divide-borda">
            {f.atividades.map((a) => {
              const sit = situacaoExibida(a, hoje);
              return (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.descricao}
                    <Etiqueta tipo={TIPO[sit]}>{NOME_SITUACAO_ATIVIDADE[sit]}</Etiqueta>
                  </p>
                  <p>Previsto: {data(a.inicio_previsto)} a {data(a.fim_previsto)} · Responsável: {a.responsavel}{a.peso !== null && ` · Peso ${a.peso}`}</p>
                  {(a.inicio_real || a.fim_real) && <p className="text-texto-suave">Real: {data(a.inicio_real)} a {data(a.fim_real)}</p>}
                  {andamento && (
                    <details className="rounded-md border border-borda p-3">
                      <summary className="min-h-10 cursor-pointer font-semibold">Lançar andamento</summary>
                      <form action={acaoAndamentoAtividade} className="mt-3 grid gap-4 sm:grid-cols-3">
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="atividade" value={a.id} />
                        <input type="hidden" name="versao_atividade" value={a.versao} />
                        <Campo rotulo="Situação" obrigatorio>
                          <select name="situacao" required defaultValue={a.situacao} className={estiloEntrada}>
                            {SITUACOES_ATIVIDADE.map((s) => <option key={s} value={s}>{NOME_SITUACAO_ATIVIDADE[s]}</option>)}
                          </select>
                        </Campo>
                        <Campo rotulo="Início real"><input type="date" name="inicio_real" defaultValue={a.inicio_real ?? ''} className={estiloEntrada} /></Campo>
                        <Campo rotulo="Fim real" dica="Obrigatório para concluir."><input type="date" name="fim_real" defaultValue={a.fim_real ?? ''} className={estiloEntrada} /></Campo>
                        <div className="sm:col-span-3"><BotaoEnviar enviando="Salvando…">Salvar andamento</BotaoEnviar></div>
                      </form>
                    </details>
                  )}
                  {planejar && (
                    <div className="flex flex-wrap gap-3">
                      <details className="min-w-64 flex-1 rounded-md border border-borda p-3">
                        <summary className="min-h-10 cursor-pointer font-semibold">Alterar atividade</summary>
                        <form action={acaoSalvarAtividade} className="mt-3 space-y-4">
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="atividade" value={a.id} />
                          <input type="hidden" name="versao_atividade" value={a.versao} />
                          <CamposPlano v={a} />
                          <BotaoEnviar enviando="Salvando…">Salvar alterações</BotaoEnviar>
                        </form>
                      </details>
                      <FormularioConfirmado acao={acaoRetirarAtividade} campos={{ id, atividade: a.id, versao_atividade: a.versao }} rotulo="Retirar" titulo="Retirar esta atividade?" mensagem="Ela sai da lista e do cronograma, mas continua guardada." confirmar="Retirar atividade" pequeno />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Secao>
      )}
      {planejar && (
        <Secao id="t-nova" titulo="Adicionar atividade">
          <form action={acaoSalvarAtividade} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <CamposPlano />
            <BotaoEnviar enviando="Salvando…">Adicionar atividade</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
