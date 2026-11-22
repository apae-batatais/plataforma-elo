import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerAcompanhamento } from '@/modulos/projetos/aplicacao/acompanhamento';
import { problemaAberto } from '@/modulos/projetos/dominio/acompanhamento';
import { hojeEmBrasilia } from '@/modulos/projetos/dominio/planejamento';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { GRAUS, NOME_GRAU } from '@/modulos/projetos/dominio/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoEncerrarRisco, acaoRegistrarProblema, acaoRegistrarRisco, acaoResolverProblema } from '../../acoes';

export const metadata: Metadata = { title: 'Riscos e problemas do projeto' };

export default async function PaginaRiscos({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  const a = await lerAcompanhamento(planilhas, usuario.autorizador, id);
  if (!f || !a) notFound();
  const editavel = (f.podeAlterar && (f.fase === 1 || f.fase === 2)) || a.podeAlterar;
  const hoje = hojeEmBrasilia(new Date());
  const abertos = a.problemas.filter(problemaAberto).length;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Riscos e problemas' }]}
        titulo="Riscos e problemas"
        descricao="Riscos são o que pode dar errado; problemas são o que já deu. Problema aberto fica na carteira até ter solução e data."
      />
      <AbasProjeto id={id} atual="riscos" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera os riscos, e nas fases 1 e 2 e na implementação. Você vê o conteúdo em leitura.</Aviso>}
      {f.riscos.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Registre ao menos um risco: o porte completo exige isso para abrir a porta 2.' : 'Nenhum risco registrado.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo="Riscos registrados">
          <ul className="divide-y divide-borda">
            {f.riscos.map((x) => (
              <li key={x.id} className="space-y-1 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {x.descricao}
                  <Etiqueta tipo={x.situacao === 'aberto' ? 'atencao' : 'neutro'}>{x.situacao === 'aberto' ? 'Aberto' : 'Encerrado'}</Etiqueta>
                </p>
                <p>Probabilidade: {NOME_GRAU[x.probabilidade]} · Impacto: {NOME_GRAU[x.impacto]}</p>
                {x.resposta && <p>O que fazer: {x.resposta}</p>}
                {x.dono && <p className="text-texto-suave">Dono: {x.dono}</p>}
                {editavel && x.situacao === 'aberto' && (
                  <FormularioConfirmado acao={acaoEncerrarRisco} campos={{ id, risco: x.id, versao_risco: x.versao }} rotulo="Encerrar risco" titulo="Encerrar este risco?" mensagem="O risco continua guardado, mas deixa de contar como aberto." confirmar="Encerrar risco" pequeno />
                )}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {a.podeAlterar || a.problemas.length > 0 ? (
        <Secao id="t-problemas" titulo="Problemas" descricao={abertos > 0 ? `${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}` : 'Nenhum problema aberto.'}>
          {a.problemas.length === 0 ? (
            <EstadoVazio titulo="Nada aqui ainda.">Registre um problema quando algo der errado na execução.</EstadoVazio>
          ) : (
            <ul className="divide-y divide-borda">
              {a.problemas.map((x) => (
                <li key={x.id} className="space-y-1 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {x.descricao}
                    <Etiqueta tipo={problemaAberto(x) ? (x.gravidade === 'alto' ? 'erro' : 'atencao') : 'sucesso'}>{problemaAberto(x) ? `Aberto · gravidade ${NOME_GRAU[x.gravidade].toLowerCase()}` : 'Resolvido'}</Etiqueta>
                  </p>
                  <p className="text-texto-suave">Aberto em {x.aberto_em.split('-').reverse().join('/')}{x.dono ? ` · dono: ${x.dono}` : ''}</p>
                  {x.solucao && <p>Solução: {x.solucao} ({x.resolvido_em ? x.resolvido_em.split('-').reverse().join('/') : '—'})</p>}
                  {a.podeAlterar && problemaAberto(x) && (
                    <FormularioConfirmado acao={acaoResolverProblema} campos={{ id, problema: x.id, versao_problema: x.versao }} rotulo="Registrar solução" titulo="Registrar a solução?" mensagem="O problema deixa de contar como aberto e a solução fica guardada." confirmar="Registrar solução" variante="secundario" perigoso={false} pequeno>
                      <Campo rotulo="Como foi resolvido" obrigatorio>
                        <textarea name="solucao" required rows={2} className={estiloEntrada} />
                      </Campo>
                      <Campo rotulo="Resolvido em" obrigatorio>
                        <input type="date" name="data" required defaultValue={hoje} className={estiloEntrada} />
                      </Campo>
                    </FormularioConfirmado>
                  )}
                </li>
              ))}
            </ul>
          )}
          {a.podeAlterar && (
            <form action={acaoRegistrarProblema} className="mt-4 space-y-4 border-t border-borda pt-4">
              <input type="hidden" name="id" value={id} />
              <p className="font-semibold">Registrar problema</p>
              <Campo rotulo="O que aconteceu" obrigatorio>
                <textarea name="descricao" required rows={2} className={estiloEntrada} />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Gravidade" obrigatorio dica="Alta aparece em destaque.">
                  <select name="gravidade" required defaultValue="" className={estiloEntrada}>
                    <option value="" disabled>Escolha</option>
                    {GRAUS.map((g) => <option key={g} value={g}>{NOME_GRAU[g]}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Quem cuida da solução (e-mail)">
                  <input type="email" name="dono" className={estiloEntrada} />
                </Campo>
              </div>
              <BotaoEnviar enviando="Salvando…">Registrar problema</BotaoEnviar>
            </form>
          )}
        </Secao>
      ) : null}
      {editavel && (
        <Secao id="t-novo" titulo="Registrar risco">
          <form action={acaoRegistrarRisco} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="O que pode dar errado" obrigatorio>
              <textarea name="descricao" required rows={2} className={estiloEntrada} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['probabilidade', 'impacto'] as const).map((campo) => (
                <Campo key={campo} rotulo={campo === 'probabilidade' ? 'Probabilidade' : 'Impacto'} obrigatorio>
                  <select name={campo} required defaultValue="" className={estiloEntrada}>
                    <option value="" disabled>Escolha</option>
                    {GRAUS.map((g) => <option key={g} value={g}>{NOME_GRAU[g]}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
            <Campo rotulo="O que fazer a respeito" dica="ex.: reservar folga de duas semanas no prazo.">
              <input name="resposta" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Dono do risco (e-mail)" dica="Quem acompanha este risco.">
              <input type="email" name="dono" className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…">Registrar risco</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
