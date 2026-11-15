import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { NIVEIS_MARCO, NIVEL_ACIMA, NOME_NIVEL, pendenciasDoMarco } from '@/modulos/projetos/dominio/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoRetirarItemMarco, acaoSalvarItemMarco } from '../../acoes';

export const metadata: Metadata = { title: 'Marco lógico' };

export default async function PaginaMarcoLogico({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const editavel = f.podeAlterar && (f.fase === 1 || f.fase === 2);
  const itens = f.marco.map((m) => ({ id: m.id, nivel: m.nivel, descricao: m.descricao, indicador: m.indicador, fonte_verificacao: m.fonte_verificacao, acima: m.acima }));
  const falta = pendenciasDoMarco(itens);
  const nome = (acima: string | null) => f.marco.find((m) => m.id === acima)?.descricao ?? '—';

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Marco lógico' }]}
        titulo="Marco lógico"
        descricao="Do impacto às atividades: cada resultado precisa de atividades, e cada item de um indicador e de uma fonte de verificação."
      />
      <AbasProjeto id={id} atual="marco" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera o marco lógico, e só nas fases 1 e 2. Você vê o conteúdo em leitura.</Aviso>}
      {falta.length > 0 ? (
        <Aviso tipo="atencao" titulo="O que falta para o marco lógico ficar completo">
          <ul className="list-disc pl-5">{falta.map((x) => <li key={x}>{x}</li>)}</ul>
        </Aviso>
      ) : (
        <Aviso tipo="sucesso">O marco lógico está completo.</Aviso>
      )}
      {f.marco.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">Comece pelo impacto: a mudança maior que o projeto quer ajudar a alcançar.</EstadoVazio>
      ) : (
        NIVEIS_MARCO.map((n) => {
          const doNivel = f.marco.filter((m) => m.nivel === n);
          if (doNivel.length === 0) return null;
          return (
            <Secao key={n} id={`t-${n}`} titulo={`${NOME_NIVEL[n]}s`}>
              <ul className="divide-y divide-borda">
                {doNivel.map((m) => (
                  <li key={m.id} className="space-y-1 py-3 text-sm">
                    <p className="font-semibold">{m.descricao}</p>
                    {NIVEL_ACIMA[n] && <p className="text-texto-suave">Pertence a: {nome(m.acima)}</p>}
                    {m.indicador && <p>Indicador: {m.indicador}</p>}
                    {m.fonte_verificacao && <p>Fonte de verificação: {m.fonte_verificacao}</p>}
                    {m.pressuposto && <p>Pressuposto: {m.pressuposto}</p>}
                    {editavel && (
                      <FormularioConfirmado
                        acao={acaoRetirarItemMarco}
                        campos={{ id, item: m.id, versao_item: m.versao }}
                        rotulo="Retirar"
                        titulo="Retirar este item?"
                        mensagem="O item deixa de aparecer, mas continua guardado."
                        confirmar="Retirar item"
                        pequeno
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Secao>
          );
        })
      )}
      {editavel && (
        <Secao id="t-novo" titulo="Adicionar item" descricao="Os itens de nível acima precisam existir primeiro.">
          <form action={acaoSalvarItemMarco} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="Nível" obrigatorio>
              <select name="nivel" required defaultValue="" className={estiloEntrada}>
                <option value="" disabled>Escolha</option>
                {NIVEIS_MARCO.map((n) => <option key={n} value={n}>{NOME_NIVEL[n]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Descrição" obrigatorio>
              <textarea name="descricao" required rows={2} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Pertence a" dica="Item do nível imediatamente acima (não vale para o impacto).">
              <select name="acima" defaultValue="" className={estiloEntrada}>
                <option value="">Nenhum (só para impacto)</option>
                {f.marco.map((m) => <option key={m.id} value={m.id}>{NOME_NIVEL[m.nivel]}: {m.descricao}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Indicador" dica="Como saber que foi alcançado. ex.: 80% das famílias com frequência regular. Atividades não precisam.">
              <input name="indicador" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Fonte de verificação" dica="De onde vem a prova. ex.: lista de presença.">
              <input name="fonte" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Pressuposto" dica="O que precisa continuar verdadeiro para dar certo (opcional).">
              <input name="pressuposto" className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…">Adicionar item</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
