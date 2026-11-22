import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerPlanejamento, type AtividadeLida } from '@/modulos/projetos/aplicacao/planejamento';
import { NOME_SITUACAO_ATIVIDADE, SITUACOES_ATIVIDADE, type SituacaoExibida } from '@/modulos/projetos/dominio/planejamento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoMudarSituacaoAtividade, acaoRetirarAtividade, acaoSalvarAtividade } from '../../acoes';

export const metadata: Metadata = { title: 'Atividades do projeto' };

const data = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const TIPO: Record<SituacaoExibida, 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'> = { a_fazer: 'neutro', em_andamento: 'info', concluida: 'sucesso', cancelada: 'neutro', atrasada: 'erro' };

function CamposAtividade({ a }: { a?: AtividadeLida }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="O que será feito" obrigatorio className="sm:col-span-2">
        <input name="descricao" required defaultValue={a?.descricao} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Pessoa responsável (e-mail)" obrigatorio dica="A pessoa precisa ter acesso ao Elo.">
        <input type="email" name="responsavel" required defaultValue={a?.responsavel} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Peso no andamento" dica="Opcional. Sem peso, todas valem o mesmo. ex.: 2">
        <input name="peso" inputMode="decimal" defaultValue={a?.peso ?? ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Início previsto" obrigatorio>
        <input type="date" name="inicio" required defaultValue={a?.inicio_previsto} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Fim previsto" obrigatorio>
        <input type="date" name="fim" required defaultValue={a?.fim_previsto} className={estiloEntrada} />
      </Campo>
    </div>
  );
}

export default async function PaginaAtividades({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const l = await lerPlanejamento(planilhas, usuario.autorizador, id);
  if (!l) notFound();
  const editavel = l.podeAlterarAtividades;
  const atrasadas = l.atividades.filter((a) => a.exibida === 'atrasada').length;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: l.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Atividades' }]}
        titulo="Atividades"
        descricao="O que será feito, por quem e até quando."
      />
      <AbasProjeto id={id} atual="atividades" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera as atividades, e só na fase 3 e na implementação. Você vê a lista em leitura.</Aviso>}
      {l.atividades.length > 0 && (
        <p className="text-sm" role="status">
          <span className="font-semibold">Andamento: {l.andamento}%</span> das atividades concluídas
          {atrasadas > 0 && <> · <span className="font-semibold text-erro">{atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span></>}
        </p>
      )}
      {l.atividades.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Cadastre as atividades do projeto, com prazos e responsável. Elas são exigidas para sair da fase 3.' : 'Nenhuma atividade cadastrada.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo="Atividades do projeto">
          <ul className="divide-y divide-borda">
            {l.atividades.map((a) => (
              <li key={a.id} className="space-y-2 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.descricao}
                  <Etiqueta tipo={TIPO[a.exibida]}>{NOME_SITUACAO_ATIVIDADE[a.exibida]}</Etiqueta>
                </p>
                <p>
                  {data(a.inicio_previsto)} a {data(a.fim_previsto)} · {a.responsavel}
                  {a.peso !== null && <> · peso {a.peso}</>}
                </p>
                {(a.inicio_real || a.fim_real) && <p className="text-texto-suave">Real: {data(a.inicio_real)} a {data(a.fim_real)}</p>}
                {editavel && (
                  <div className="flex flex-wrap items-end gap-3">
                    <form action={acaoMudarSituacaoAtividade} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="atividade" value={a.id} />
                      <input type="hidden" name="versao_atividade" value={a.versao} />
                      <Campo rotulo="Situação">
                        <select name="situacao" defaultValue={a.situacao} className={estiloEntrada}>
                          {SITUACOES_ATIVIDADE.map((s) => <option key={s} value={s}>{NOME_SITUACAO_ATIVIDADE[s]}</option>)}
                        </select>
                      </Campo>
                      <Campo rotulo="Terminou em" dica="Obrigatório ao concluir.">
                        <input type="date" name="fim_real" defaultValue={a.fim_real ?? ''} className={estiloEntrada} />
                      </Campo>
                      <BotaoEnviar variante="secundario" enviando="Salvando…">Atualizar situação</BotaoEnviar>
                    </form>
                    <FormularioConfirmado acao={acaoRetirarAtividade} campos={{ id, atividade: a.id, versao_atividade: a.versao }} rotulo="Retirar" titulo="Retirar esta atividade?" mensagem="Ela deixa de aparecer na lista, mas continua guardada." confirmar="Retirar atividade" pequeno />
                  </div>
                )}
                {editavel && (
                  <details>
                    <summary className="inline-flex min-h-10 cursor-pointer items-center font-semibold underline">Alterar dados</summary>
                    <form action={acaoSalvarAtividade} className="mt-2 space-y-4">
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="atividade" value={a.id} />
                      <input type="hidden" name="versao_atividade" value={a.versao} />
                      <CamposAtividade a={a} />
                      <BotaoEnviar enviando="Salvando…">Salvar alterações</BotaoEnviar>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {editavel && (
        <Secao id="t-novo" titulo="Adicionar atividade">
          <form action={acaoSalvarAtividade} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <CamposAtividade />
            <BotaoEnviar enviando="Salvando…">Adicionar atividade</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
