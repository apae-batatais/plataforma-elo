import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerVisaoGeral } from '@/modulos/orcamento/aplicacao/visao-geral';
import { CartaoDeSinal } from '@/modulos/orcamento/telas/visao-geral';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Visão geral' };

export default async function VisaoGeralPagina() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Visão geral' }];
  let v;
  try {
    v = await lerVisaoGeral(app.planilhas, usuario.autorizador);
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect('/orcamento');
    return (
      <div>
        <CabecalhoPagina trilha={trilha} titulo="Visão geral" />
        <Aviso tipo="erro" titulo="Não foi possível carregar a Visão geral" acao={<LinkBotao href="/orcamento/visao-geral" variante="secundario">Tentar de novo</LinkBotao>}>
          A leitura das planilhas falhou. Tente de novo em alguns instantes; se continuar, avise a administração.
        </Aviso>
      </div>
    );
  }
  const primeira = v.pendencias[0];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo="Visão geral do orçamento"
        descricao="Estamos bem? Cada sinal diz a situação em palavras, a regra que usamos e de que dado ele veio."
      />

      {v.pendencias.length > 0 && (
        <Aviso
          tipo="atencao"
          titulo={v.pendencias.length === 1 ? '1 pendência' : `${v.pendencias.length} pendências`}
          acao={primeira && <LinkBotao href={primeira.href}>{primeira.acao}</LinkBotao>}
        >
          <ul className="list-disc space-y-1 pl-5">
            {v.pendencias.map((x, i) => (
              <li key={x.texto}>
                {x.texto}
                {i > 0 && (
                  <>
                    {' · '}
                    <Link href={x.href} className="font-semibold underline">
                      {x.acao}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      {!v.faixasAprovadas && v.podeVerSaldos && (
        <Aviso tipo="info" titulo="Faixas ainda não aprovadas">
          Os sinais usam as faixas propostas. A Diretoria aprova as faixas na tela{' '}
          <Link href="/orcamento/tesouraria/reserva" className="font-semibold underline">
            Reserva
          </Link>
          .
        </Aviso>
      )}

      {v.vazia ? (
        <EstadoVazio
          titulo="A Visão geral aparece depois que você informar os saldos do mês e o realizado"
          acao={
            <div className="flex flex-wrap justify-center gap-2">
              {v.podeVerSaldos && <LinkBotao href="/orcamento/tesouraria">Informar saldos</LinkBotao>}
              {v.podeInformarRealizado && <LinkBotao href="/orcamento/execucao/realizado" variante="secundario">Informar realizado</LinkBotao>}
            </div>
          }
        >
          Os sinais são calculados pelo Elo com esses números; nada é digitado aqui.
        </EstadoVazio>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Sinais, do mais grave ao mais tranquilo">
          {v.sinais.map((s) => (
            <CartaoDeSinal key={s.chave} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}
