import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoAdicionarMembro, acaoEncerrarMembro } from '../../acoes';

export const metadata: Metadata = { title: 'Equipe do projeto' };

export default async function PaginaEquipe({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const editavel = f.podeAlterar && f.projeto.etapa !== 'cancelado' && f.projeto.etapa !== 'parado';
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Equipe' }]}
        titulo="Equipe"
        descricao="Quem participa do projeto. A equipe vê o projeto, mas não o altera nem lê os pareceres."
      />
      <AbasProjeto id={id} atual="equipe" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera a equipe. Você vê a lista em leitura.</Aviso>}
      {f.equipe.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Inclua as pessoas que vão participar do projeto.' : 'Ninguém foi incluído na equipe.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo="Pessoas na equipe">
          <ul className="divide-y divide-borda">
            {f.equipe.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span><span className="font-semibold">{m.email}</span> · {m.funcao} <span className="text-texto-suave">(desde {m.inicio.split('-').reverse().join('/')})</span></span>
                {editavel && <FormularioConfirmado acao={acaoEncerrarMembro} campos={{ id, membro: m.id, versao_membro: m.versao }} rotulo="Tirar da equipe" titulo="Tirar esta pessoa da equipe?" mensagem="Ela deixa de ver o projeto. A participação continua registrada." confirmar="Tirar da equipe" pequeno />}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {editavel && (
        <Secao id="t-novo" titulo="Incluir pessoa">
          <form action={acaoAdicionarMembro} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="E-mail" obrigatorio dica="A pessoa precisa ter acesso ao Elo.">
              <input type="email" name="email" required className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Função no projeto" obrigatorio dica="ex.: apoio técnico">
              <input name="funcao" required className={estiloEntrada} />
            </Campo>
            <div className="sm:col-span-2"><BotaoEnviar enviando="Incluindo…">Incluir na equipe</BotaoEnviar></div>
          </form>
        </Secao>
      )}
    </div>
  );
}
