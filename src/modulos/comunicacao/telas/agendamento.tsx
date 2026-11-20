'use client';

/**
 * Detalhe do pedido aprovado ou agendado: agendar ou mudar a data, abrir o e-mail pronto no Gmail
 * e marcar como publicado. Recebe do servidor só o que a pessoa pode fazer (`acoes`).
 */
import { useState } from 'react';
import { Botao, LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { FormularioConfirmado } from '@/ui/confirmar';
import type { Acao, TipoPeca } from '../dominio/pedido';

type Envio = (f: FormData) => void | Promise<void>;

export interface OpcoesDestino {
  grupos: { id: string; nome: string }[];
  contatos: { id: string; rotulo: string }[];
}

/** Data e hora no formato do campo do navegador (AAAA-MM-DDTHH:mm), no horário de Brasília. */
export function paraCampoDeDataHora(iso: string | null): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

const NOME_PUBLICAR = (tipo: TipoPeca) => (tipo === 'entrevista' ? 'Marcar entrevista como realizada' : 'Marcar como publicado');

export function AcoesDeAgendamento({
  acoes,
  id,
  versao,
  tipoPeca,
  agendadoPara,
  destino,
  escolhidos,
  envioAutomatico,
  jaAutomatico = false,
  agendar,
  publicar,
}: {
  acoes: Acao[];
  id: string;
  versao: number;
  tipoPeca: TipoPeca;
  agendadoPara: string | null;
  destino: OpcoesDestino;
  escolhidos: { grupos: string[]; contatos: string[] };
  /** O Elo pode enviar sozinho (a instituição informou o e-mail de envio)? */
  envioAutomatico: boolean;
  /** O pedido já está com envio automático ligado. */
  jaAutomatico?: boolean;
  agendar: Envio;
  publicar: Envio;
}) {
  const reagendar = acoes.includes('reagendar');
  const porEmail = tipoPeca === 'release' || tipoPeca === 'artigo';
  return (
    <div className="flex flex-wrap items-center gap-3">
      {(acoes.includes('agendar') || reagendar) && (
        <FormularioConfirmado
          acao={agendar}
          campos={{ id, versao, reagendando: reagendar ? 1 : 0 }}
          rotulo={reagendar ? 'Mudar data' : 'Agendar'}
          variante={reagendar ? 'secundario' : 'primario'}
          perigoso={false}
          titulo={reagendar ? 'Mudar a data do agendamento' : 'Agendar publicação'}
          mensagem={
            reagendar
              ? 'O pedido continua agendado, e o histórico guarda a data anterior.'
              : porEmail
                ? 'Escolha o dia e a hora do envio e quem recebe o e-mail.'
                : 'Escolha o dia e a hora em que você vai publicar. Depois de publicar, volte aqui e marque como publicado.'
          }
          confirmar={reagendar ? 'Mudar data' : 'Agendar'}
        >
          <Campo rotulo="Dia e hora" obrigatorio dica="Horário de Brasília. Precisa ser no futuro.">
            <input type="datetime-local" name="quando" required defaultValue={paraCampoDeDataHora(agendadoPara)} className={estiloEntrada} />
          </Campo>
          {porEmail && <ComoEnviar disponivel={envioAutomatico} padraoElo={reagendar ? jaAutomatico : true} />}
          {porEmail && <Destinatarios destino={destino} escolhidos={escolhidos} />}
        </FormularioConfirmado>
      )}
      {acoes.includes('publicar') && (
        <FormularioConfirmado
          acao={publicar}
          campos={{ id, versao }}
          rotulo={NOME_PUBLICAR(tipoPeca)}
          perigoso={false}
          titulo={NOME_PUBLICAR(tipoPeca) + '?'}
          mensagem={
            tipoPeca === 'entrevista'
              ? 'O pedido passa para Realizada e não anda mais.'
              : 'O pedido passa para Publicado e não anda mais. O Elo guarda o dia de hoje como o da publicação.'
          }
          confirmar={tipoPeca === 'entrevista' ? 'Marcar como realizada' : 'Marcar como publicado'}
        >
          {(tipoPeca === 'post_instagram' || tipoPeca === 'reel_instagram') && (
            <Campo rotulo="Link da publicação" obrigatorio dica="Cole o endereço do post no Instagram (começa com https://).">
              <input name="link" type="url" required placeholder="https://" className={estiloEntrada} />
            </Campo>
          )}
          <Campo rotulo="Comentário" dica="Opcional.">
            <textarea name="comentario" rows={2} className={estiloEntrada} />
          </Campo>
        </FormularioConfirmado>
      )}
    </div>
  );
}

function ComoEnviar({ disponivel, padraoElo }: { disponivel: boolean; padraoElo: boolean }) {
  const opcao = 'flex min-h-11 items-start gap-2 rounded-lg border border-borda px-3 py-2 text-sm';
  const elo = disponivel && padraoElo;
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Como enviar</legend>
      <div className="mt-1.5 grid gap-2">
        <label className={`${opcao} ${disponivel ? '' : 'opacity-60'}`}>
          <input type="radio" name="como_enviar" value="elo" defaultChecked={elo} disabled={!disponivel} className="mt-1" />
          <span>
            Enviar pelo Elo na hora marcada
            <span className="block text-texto-suave">O e-mail sai sozinho, em cópia oculta, com os anexos do pedido. Se falhar, você é avisado.</span>
          </span>
        </label>
        <label className={opcao}>
          <input type="radio" name="como_enviar" value="gmail" defaultChecked={!elo} className="mt-1" />
          <span>
            Abrir e-mail pronto no meu Gmail
            <span className="block text-texto-suave">Você envia à mão, no dia, e depois marca como publicado.</span>
          </span>
        </label>
      </div>
      {!disponivel && <p className="mt-1.5 text-sm text-texto-suave">A instituição ainda não informou o e-mail de envio.</p>}
    </fieldset>
  );
}

function Destinatarios({ destino, escolhidos }: { destino: OpcoesDestino; escolhidos: { grupos: string[]; contatos: string[] } }) {
  if (destino.grupos.length === 0 && destino.contatos.length === 0)
    return <p className="text-sm text-erro">Não há contatos nem grupos ativos. Cadastre em “Contatos da imprensa”.</p>;
  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold">Grupos</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {destino.grupos.map((g) => (
            <label key={g.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm">
              <input type="checkbox" name="grupos" value={g.id} defaultChecked={escolhidos.grupos.includes(g.id)} />
              {g.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Contatos avulsos</legend>
        <p className="mt-0.5 text-sm text-texto-suave">Além dos grupos. Escolha pelo menos um grupo ou contato.</p>
        <div className="mt-1.5 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
          {destino.contatos.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm">
              <input type="checkbox" name="contatos" value={c.id} defaultChecked={escolhidos.contatos.includes(c.id)} />
              {c.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

const ROTULO_ENVIO: Record<string, string> = { pendente: 'Aguardando a hora marcada', enviado: 'Enviado', falhou: 'Falhou: tente de novo' };

/** Faixa "Envio" do detalhe do pedido: situação em texto (e selo) e, se falhou, o motivo e "Tentar de novo". */
export function FaixaDeEnvio({
  pedidoId,
  envio,
  quando,
  podeTentar,
  tentar,
}: {
  pedidoId: string;
  envio: { id: string; versao: number; situacao: string; erro: string | null; tentativas: number };
  /** Texto já formatado: "Enviado em ..." ou "Previsto para ...". */
  quando: string;
  podeTentar: boolean;
  tentar: Envio;
}) {
  const falhou = envio.situacao === 'falhou';
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${falhou ? 'bg-erro/10 text-erro' : envio.situacao === 'enviado' ? 'bg-sucesso/10 text-sucesso' : 'bg-superficie-2 text-texto-suave'}`}
        >
          {ROTULO_ENVIO[envio.situacao] ?? envio.situacao}
        </span>
        <span>{quando}</span>
      </p>
      {envio.situacao === 'pendente' && envio.tentativas > 0 && (
        <p className="text-sm text-texto-suave">A tentativa {envio.tentativas} não deu certo; o Elo tenta de novo sozinho. {envio.erro}</p>
      )}
      {falhou && (
        <>
          <p className="text-sm">O Elo não conseguiu enviar depois de {envio.tentativas} tentativas. {envio.erro}</p>
          <p className="text-sm text-texto-suave">O pedido continua agendado. Tente de novo ou envie à mão pelo e-mail pronto abaixo.</p>
          {podeTentar && (
            <form action={tentar}>
              <input type="hidden" name="id" value={pedidoId} />
              <input type="hidden" name="envio" value={envio.id} />
              <input type="hidden" name="versao_envio" value={envio.versao} />
              <BotaoEnviar enviando="Colocando na fila…">Tentar de novo</BotaoEnviar>
            </form>
          )}
        </>
      )}
    </div>
  );
}

/** E-mail pronto: abre o Gmail em outra aba; se a lista for longa, mostra os endereços para copiar. */
export function EmailPronto({ url, enderecosNoLink, enderecos }: { url: string; enderecosNoLink: boolean; enderecos: string[] }) {
  const [copiado, setCopiado] = useState(false);
  const lista = enderecos.join(', ');
  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-suave">
        O e-mail abre no seu Gmail com os destinatários em cópia oculta, o título como assunto e a descrição como texto. Anexe o arquivo antes de enviar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <LinkBotao href={url} target="_blank" rel="noopener noreferrer">
          Abrir e-mail no Gmail
        </LinkBotao>
        {!enderecosNoLink && (
          <Botao
            variante="secundario"
            onClick={async () => {
              await navigator.clipboard.writeText(lista);
              setCopiado(true);
            }}
          >
            {copiado ? 'Endereços copiados' : 'Copiar endereços'}
          </Botao>
        )}
      </div>
      {!enderecosNoLink && (
        <div>
          <p className="text-sm">São {enderecos.length} endereços, muitos para abrir de uma vez. Copie e cole no campo “Cco” do e-mail.</p>
          <textarea readOnly rows={3} value={lista} aria-label="Endereços para copiar" className={`${estiloEntrada} mt-1.5`} />
        </div>
      )}
      <p className="text-sm text-texto-suave" aria-live="polite">
        {enderecos.length} {enderecos.length === 1 ? 'destinatário' : 'destinatários'}.
      </p>
    </div>
  );
}
