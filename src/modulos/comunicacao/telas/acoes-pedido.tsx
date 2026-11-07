'use client';

/**
 * Botões do detalhe do pedido na revisão e na aprovação. Mostra só as ações que a pessoa pode
 * fazer agora (`acoes`, vindas do servidor), com textos do ponto de vista de quem usa.
 */
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import type { Acao, Situacao } from '../dominio/pedido';
import { ACOES_DA_EQUIPE } from './acoes-da-equipe';

type Envio = (f: FormData) => void | Promise<void>;

export const ROTULO_ACAO: Partial<Record<Acao, string>> = {
  iniciar_revisao: 'Começar revisão',
  enviar_aprovacao: 'Enviar para aprovação',
  devolver: 'Devolver para quem pediu',
  recusar: 'Recusar',
  juntar: 'Juntar com outro pedido',
  aprovar: 'Aprovar',
  pedir_ajustes: 'Pedir ajustes',
};

const MOTIVO: Partial<Record<Acao, { titulo: string; mensagem: string; confirmar: string }>> = {
  devolver: {
    titulo: 'Devolver o pedido?',
    mensagem: 'Quem pediu recebe o motivo, ajusta o pedido e o envia de novo.',
    confirmar: 'Devolver pedido',
  },
  pedir_ajustes: {
    titulo: 'Pedir ajustes?',
    mensagem: 'O pedido volta para a revisão da Comunicação, com o motivo no histórico.',
    confirmar: 'Pedir ajustes',
  },
  recusar: {
    titulo: 'Recusar este pedido?',
    mensagem: 'O pedido deixa de andar, mas fica guardado no histórico, com o motivo.',
    confirmar: 'Recusar pedido',
  },
};

export function AcoesPedido({
  acoes,
  situacao,
  id,
  versao,
  destinos,
  revisar,
  decidir,
  juntar,
}: {
  acoes: Acao[];
  /** Situação atual do pedido: decide se "Recusar" é da revisão ou da aprovação. */
  situacao: Situacao;
  id: string;
  versao: number;
  /** Pedidos em andamento que podem receber este. */
  destinos: { id: string; rotulo: string }[];
  revisar: Envio;
  decidir: Envio;
  juntar: Envio;
}) {
  const quais = ACOES_DA_EQUIPE.filter((a) => acoes.includes(a));
  if (quais.length === 0) return null;
  // Recusar na aprovação é da coordenação; na revisão, da Comunicação.
  const envioDe = (a: Acao): Envio => (a === 'aprovar' || a === 'pedir_ajustes' || (a === 'recusar' && situacao === 'aguardando_aprovacao') ? decidir : revisar);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {acoes.includes('enviar_aprovacao') && (
        <LinkBotao href={`/comunicacao/${id}/revisar`} variante="secundario">
          Editar dados do pedido
        </LinkBotao>
      )}
      {quais.map((a) => {
        const rotulo = ROTULO_ACAO[a]!;
        const campos = { id, versao, acao: a };
        const motivo = MOTIVO[a];
        if (a === 'juntar')
          return (
            <FormularioConfirmado
              key={a}
              acao={juntar}
              campos={{ id, versao }}
              rotulo={rotulo}
              variante="secundario"
              titulo="Juntar com outro pedido?"
              mensagem="Este pedido deixa de andar e fica guardado com o número do pedido escolhido. O pedido escolhido recebe o registro no histórico."
              confirmar="Juntar pedidos"
              perigoso={false}
            >
              <Campo rotulo="Pedido de destino" obrigatorio>
                <select name="destino_id" required defaultValue="" className={estiloEntrada}>
                  <option value="" disabled>
                    Escolha
                  </option>
                  {destinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Observação" dica="Opcional.">
                <textarea name="comentario" rows={2} className={estiloEntrada} />
              </Campo>
            </FormularioConfirmado>
          );
        if (motivo)
          return (
            <FormularioConfirmado
              key={a}
              acao={envioDe(a)}
              campos={campos}
              rotulo={rotulo}
              variante={a === 'recusar' ? 'perigo' : 'secundario'}
              titulo={motivo.titulo}
              mensagem={motivo.mensagem}
              confirmar={motivo.confirmar}
              perigoso={a === 'recusar'}
            >
              <Campo rotulo="Motivo para quem pediu" obrigatorio>
                <textarea name="comentario" required rows={3} className={estiloEntrada} />
              </Campo>
            </FormularioConfirmado>
          );
        return (
          <form key={a} action={envioDe(a)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="versao" value={versao} />
            <input type="hidden" name="acao" value={a} />
            <BotaoEnviar enviando="Registrando…">{rotulo}</BotaoEnviar>
          </form>
        );
      })}
    </div>
  );
}

