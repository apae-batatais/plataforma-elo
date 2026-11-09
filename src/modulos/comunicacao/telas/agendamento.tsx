'use client';

/**
 * Detalhe do pedido aprovado ou agendado: agendar ou mudar a data, abrir o e-mail pronto no Gmail
 * e marcar como publicado. Recebe do servidor só o que a pessoa pode fazer (`acoes`).
 */
import { useState } from 'react';
import { Botao, LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
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
