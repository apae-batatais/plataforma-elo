import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { painelDaRede } from '@/nucleo/rede/rede';
import { administradorDaRedeLogado } from '@/plataforma/sessao-rede';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { pequeno } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoIncluirAdministrador, acaoRetirarAdministrador } from '../acoes';

export const metadata: Metadata = { title: 'Administradores da rede' };

export default async function Administradores() {
  const adm = await administradorDaRedeLogado();
  if (!adm) redirect('/rede/entrar');
  const painel = await painelDaRede(adm.app.planilhas, adm.autorizador);
  const iniciais = adm.app.rede.administradores;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Instituições', href: '/rede' }, { rotulo: 'Administradores' }]}
        titulo="Administradores da rede"
        descricao={`Quem cadastra, confere, ativa e suspende instituições. Só e-mails da Operadora (@${adm.app.rede.dominio}). Não dá acesso aos dados de nenhuma instituição.`}
        acoes={
          <JanelaFormulario
            rotulo={
              <>
                <IconeMais tamanho={16} /> Incluir administrador
              </>
            }
            className={pequeno}
            titulo="Incluir administrador da rede"
          >
            <form action={acaoIncluirAdministrador} className="space-y-4">
              <Campo rotulo="Nome" obrigatorio>
                <input name="nome" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="E-mail" obrigatorio dica={`Conta Google @${adm.app.rede.dominio}.`}>
                <input name="email" type="email" required className={estiloEntrada} />
              </Campo>
              <BotaoEnviar enviando="Incluindo…" className="w-full">
                Incluir
              </BotaoEnviar>
            </form>
          </JanelaFormulario>
        }
      />
      <TabelaDados
        legenda="Administradores da rede"
        vazio="Ninguém cadastrado aqui ainda: só os administradores iniciais da configuração entram."
        colunas={[
          { chave: 'nome', rotulo: 'Nome' },
          { chave: 'email', rotulo: 'E-mail' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-16' },
        ]}
        linhas={painel.administradores.map((a) => ({
          id: a.id,
          valores: { nome: a.nome, email: a.email },
          celulas: {
            acoes:
              a.email.toLowerCase() === adm.email.toLowerCase() ? null : (
                <FormularioConfirmado
                  acao={acaoRetirarAdministrador}
                  campos={{ id: a.id, versao: a.versao }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Retirar ${a.nome}`}
                  variante="icone-perigo"
                  titulo={`Retirar ${a.nome} da administração da rede?`}
                  mensagem="A pessoa deixa de entrar na área da rede. O registro fica no histórico."
                  confirmar="Retirar"
                />
              ),
          },
        }))}
      />
      <p className="text-sm text-texto-suave">
        Administradores iniciais, da configuração da hospedagem: {iniciais.join(', ')}. Eles sempre entram, para que a rede nunca fique sem quem a administre.
      </p>
    </div>
  );
}
