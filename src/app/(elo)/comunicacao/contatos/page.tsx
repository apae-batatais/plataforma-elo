import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarContatos } from '@/modulos/comunicacao/aplicacao/contatos';
import { FormularioContato, FormularioGrupo, ListaContatos, ListaGrupos } from '@/modulos/comunicacao/telas/contatos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { pequeno } from '@/ui/botao';
import { IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import {
  acaoDesativarContato,
  acaoDesativarGrupo,
  acaoReativarContato,
  acaoReativarGrupo,
  acaoSalvarContato,
  acaoSalvarGrupo,
} from '../acoes';

export const metadata: Metadata = { title: 'Contatos da imprensa' };

export default async function Contatos({ searchParams }: { searchParams: Promise<{ contato?: string; grupo?: string }> }) {
  const p = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('comunicacao.contatos.gerenciar')) redirect('/comunicacao');
  const { planilhas } = await obterAplicacao();
  const { grupos, contatos } = await listarContatos(planilhas, usuario.autorizador);
  const gruposAtivos = grupos.filter((g) => g.ativo);
  const nomesDosGrupos = Object.fromEntries(grupos.map((g) => [g.id, g.nome]));
  const contatoEmEdicao = contatos.find((c) => c.id === p.contato);
  const grupoEmEdicao = grupos.find((g) => g.id === p.grupo);
  const voltarPara = '/comunicacao/contatos';

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Contatos da imprensa' }]}
        titulo="Contatos da imprensa"
        descricao="Quem recebe os releases e artigos. Um contato pode estar em vários grupos; ao agendar, você escolhe grupos e contatos."
      />

      {contatoEmEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={voltarPara} titulo={`Alterar “${contatoEmEdicao.nome}”`}>
          <FormularioContato acao={acaoSalvarContato} grupos={gruposAtivos} valor={contatoEmEdicao} rotuloBotao="Salvar alterações" />
        </JanelaFormulario>
      )}
      {grupoEmEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={voltarPara} titulo={`Alterar “${grupoEmEdicao.nome}”`}>
          <FormularioGrupo acao={acaoSalvarGrupo} valor={grupoEmEdicao} rotuloBotao="Salvar alterações" />
        </JanelaFormulario>
      )}

      <Secao
        titulo="Contatos"
        id="t-contatos"
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar contato
              </>
            }
            className={pequeno}
            titulo="Adicionar contato"
          >
            <FormularioContato acao={acaoSalvarContato} grupos={gruposAtivos} rotuloBotao="Adicionar contato" />
          </JanelaFormulario>
        }
      >
        <ListaContatos contatos={contatos} nomesDosGrupos={nomesDosGrupos} desativar={acaoDesativarContato} reativar={acaoReativarContato} />
      </Secao>

      <Secao
        titulo="Grupos"
        id="t-grupos"
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Adicionar grupo
              </>
            }
            className={pequeno}
            titulo="Adicionar grupo"
          >
            <FormularioGrupo acao={acaoSalvarGrupo} rotuloBotao="Adicionar grupo" />
          </JanelaFormulario>
        }
      >
        <ListaGrupos grupos={grupos} desativar={acaoDesativarGrupo} reativar={acaoReativarGrupo} />
      </Secao>
    </div>
  );
}
