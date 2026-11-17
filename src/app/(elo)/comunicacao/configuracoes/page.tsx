import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerAntecedenciaComVersao } from '@/modulos/comunicacao/aplicacao/configuracoes';
import { situacaoDoInstagram } from '@/modulos/comunicacao/aplicacao/instagram';
import { diaEmBrasilia } from '@/modulos/comunicacao/dominio/prazos';
import { configGeral } from '@/plataforma/instituicao';
import { provedorDeInstagram } from '@/plataforma/instagram';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { acaoConectarInstagram, acaoDesconectarInstagram, acaoSalvarAntecedencia } from '../acoes';

const dataBR = (iso: string) => diaEmBrasilia(new Date(iso)).split('-').reverse().join('/');

export const metadata: Metadata = { title: 'Configurações da Comunicação' };

export default async function Configuracoes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('comunicacao.configurar')) redirect('/comunicacao');
  const { planilhas } = await obterAplicacao();
  const { dias, versao } = await lerAntecedenciaComVersao(planilhas);
  const { instituicao } = await obterAplicacao();
  const instagram = await situacaoDoInstagram(planilhas, usuario.autorizador, instituicao.codigo);
  const configurado = provedorDeInstagram(configGeral()) !== null;
  const conectada = instagram.situacao !== 'nenhuma';

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
          <input type="hidden" name="versao" value={versao ?? ''} />
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
      <Secao
        id="t-instagram"
        titulo="Instagram"
        descricao="Conta profissional da instituição, usada para publicar na hora marcada. Você entra com a conta do Instagram e autoriza; o Elo não pede nem guarda a senha."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {!configurado && (
            <Aviso tipo="atencao" titulo="Ligação ainda não configurada">
              A Operadora do Elo ainda não configurou a ligação com o Instagram. Assim que ela fizer, o botão para conectar aparece aqui.
            </Aviso>
          )}
          {!conectada && configurado && <p className="text-sm text-texto">Conecte o Instagram da instituição para publicar na hora marcada.</p>}
          {conectada && (
            <div className="space-y-2">
              <p className="text-sm text-texto">
                Conectado como <strong>@{instagram.conta}</strong>
                {instagram.venceEm && <> · válido até {dataBR(instagram.venceEm)}</>}{' '}
                {instagram.situacao === 'conectada' && <Etiqueta tipo="sucesso">Conectada</Etiqueta>}
                {instagram.situacao === 'expirando' && <Etiqueta tipo="atencao">Vence em breve</Etiqueta>}
                {instagram.situacao === 'expirada' && <Etiqueta tipo="erro">Precisa ser reconectada</Etiqueta>}
              </p>
              {instagram.situacao === 'expirando' && <Aviso tipo="atencao">O Elo não conseguiu renovar a conexão sozinho. Clique em &quot;Reconectar&quot; antes da data de validade.</Aviso>}
              {instagram.situacao === 'expirada' && <Aviso tipo="erro">A conexão venceu e nada será publicado. Clique em &quot;Reconectar&quot; para voltar a publicar.</Aviso>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {configurado && (
              <form action={acaoConectarInstagram}>
                <BotaoEnviar enviando="Abrindo o Instagram…" variante={conectada ? 'secundario' : 'primario'}>
                  {conectada ? 'Reconectar' : 'Conectar Instagram'}
                </BotaoEnviar>
              </form>
            )}
            {conectada && (
              <FormularioConfirmado
                acao={acaoDesconectarInstagram}
                rotulo="Desconectar"
                titulo="Desconectar o Instagram?"
                mensagem="O Elo deixa de publicar. Publicações já agendadas ficam paradas até você conectar de novo."
                confirmar="Desconectar"
                variante="secundario"
              />
            )}
          </div>
        </div>
      </Secao>
    </div>
  );
}
