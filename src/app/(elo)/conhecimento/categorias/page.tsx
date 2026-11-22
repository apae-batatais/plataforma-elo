import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCategorias } from '@/modulos/conhecimento/aplicacao/categorias';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { acaoCriarCategoria, acaoDesativarCategoria, acaoReativarCategoria } from '../acoes';

export const metadata: Metadata = { title: 'Categorias' };

export default async function Categorias() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('conhecimento.categorias.gerenciar')) redirect('/conhecimento');
  const { planilhas } = await obterAplicacao();
  const todas = await listarCategorias(planilhas, usuario.autorizador);
  const ativas = todas.filter((c) => c.ativo);
  const desativadas = todas.filter((c) => !c.ativo);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Categorias' }]}
        titulo="Categorias"
        descricao="Os assuntos em que as publicações se organizam."
      />
      <Secao titulo="Nova categoria" id="t-nova">
        <form action={acaoCriarCategoria} className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Nome da categoria" obrigatorio dica="Até 60 caracteres.">
            <input name="nome" required maxLength={60} className={`${estiloEntrada} w-80 max-w-full`} />
          </Campo>
          <BotaoEnviar enviando="Salvando…">Adicionar categoria</BotaoEnviar>
        </form>
      </Secao>
      <Secao titulo="Categorias ativas" id="t-ativas">
        {ativas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma categoria ainda">Cadastre a primeira acima para poder publicar.</EstadoVazio>
        ) : (
          <ul className="divide-y divide-borda">
            {ativas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="font-semibold">{c.nome}</span>
                <FormularioConfirmado
                  acao={acaoDesativarCategoria}
                  campos={{ id: c.id, versao: c.versao }}
                  rotulo="Desativar"
                  pequeno
                  titulo={`Desativar “${c.nome}”?`}
                  mensagem="A categoria deixa de aparecer para novas publicações. Só dá para desativar se nenhuma publicação (fora as arquivadas) a usa. Pode ser reativada depois."
                  confirmar="Desativar"
                />
              </li>
            ))}
          </ul>
        )}
      </Secao>
      <Excluidos
        titulo="Categorias desativadas"
        itens={desativadas.map((c) => ({ id: c.id, versao: c.versao, nome: c.nome }))}
        acao={acaoReativarCategoria}
        mensagem="A categoria volta a aparecer para novas publicações."
      />
    </div>
  );
}
