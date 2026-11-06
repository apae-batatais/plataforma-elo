import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerAntecedencia } from '@/modulos/comunicacao/aplicacao/configuracoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoSalvarAntecedencia } from '../acoes';

export const metadata: Metadata = { title: 'Configurações da Comunicação' };

export default async function Configuracoes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('comunicacao.configurar')) redirect('/comunicacao');
  const { planilhas } = await obterAplicacao();
  const dias = await lerAntecedencia(planilhas);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Configurações' }]}
        titulo="Configurações"
      />
      <Secao
        id="t-antecedencia"
        titulo="Antecedência mínima"
        descricao="Quantos dias úteis antes da publicação o pedido precisa chegar. Pedido com data desejada mais perto que isso é marcado como urgente."
        className="max-w-2xl"
      >
        <form action={acaoSalvarAntecedencia} className="space-y-4">
          <Campo rotulo="Dias úteis" obrigatorio dica="De 0 a 30. Conta de segunda a sexta, sem feriados nesta fase.">
            <input
              type="number"
              name="dias"
              required
              min={0}
              max={30}
              step={1}
              inputMode="numeric"
              defaultValue={dias}
              className={`${estiloEntrada} max-w-32`}
            />
          </Campo>
          <BotaoEnviar enviando="Salvando…">Salvar antecedência</BotaoEnviar>
        </form>
      </Secao>
    </div>
  );
}
