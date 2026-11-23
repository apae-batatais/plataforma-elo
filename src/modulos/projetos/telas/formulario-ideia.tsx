/** Formulário da ideia (nova ou edição). Os campos têm dica de quando usar cada porte. */
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { NOME_PORTE, NOME_TIPO, PORTES, TIPOS_PROJETO, type Porte, type TipoProjeto } from '../dominio/projeto';

export interface ValoresIdeia {
  id?: string;
  versao?: number;
  titulo: string;
  resumo: string;
  tipo: TipoProjeto;
  porte: Porte;
  valorEstimado: number | null;
  servico: string | null;
  /** Só no evento de captação (modelo curto). */
  serie?: string | null;
  dataEvento?: string | null;
  metaReceita?: number | null;
  fonteReceitaId?: string | null;
}

/** Opções do modelo curto do evento: séries já usadas e fontes próprias do Orçamento (`null` = lista indisponível). */
export interface OpcoesEvento {
  series: string[];
  fontes: { id: string; nome: string }[] | null;
}

export function FormularioIdeia({
  acao,
  servicos,
  valores,
  comEnviar = true,
  evento,
}: {
  acao: (f: FormData) => Promise<void>;
  servicos: { codigo: string; nome: string }[];
  valores?: ValoresIdeia;
  comEnviar?: boolean;
  /** Presente só no modelo curto do evento de captação. */
  evento?: OpcoesEvento;
}) {
  const curto = valores?.tipo === 'captacao' || !!evento;
  return (
    <form action={acao} className="space-y-5 rounded-cartao border border-borda bg-superficie p-5">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}
      {valores?.versao !== undefined && <input type="hidden" name="versao" value={valores.versao} />}
      <Campo rotulo="Título" obrigatorio>
        <input name="titulo" required maxLength={120} defaultValue={valores?.titulo} className={estiloEntrada} />
      </Campo>
      <Campo rotulo={curto ? 'Objetivo do evento' : 'Resumo'} obrigatorio dica={curto ? 'Em poucas linhas: o que o evento quer alcançar e para quem.' : 'Em poucas linhas: qual a necessidade e o que se pretende fazer.'}>
        <textarea name="resumo" required rows={5} defaultValue={valores?.resumo} className={estiloEntrada} />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        {curto ? (
          <>
            <input type="hidden" name="tipo" value="captacao" />
            <Campo rotulo="Data do evento" obrigatorio>
              <input name="data_evento" type="date" required defaultValue={valores?.dataEvento ?? ''} className={`${estiloEntrada} max-w-48`} />
            </Campo>
            <Campo rotulo="Meta de receita (R$)" obrigatorio dica="Quanto o evento quer arrecadar. Entra no Orçamento como receita a captar quando a porta 2 aprovar.">
              <input name="meta_receita" inputMode="decimal" required defaultValue={valores?.metaReceita ?? ''} className={`${estiloEntrada} max-w-48`} />
            </Campo>
            <Campo rotulo="Série" dica="Para comparar com as outras edições. Deixe em branco se o evento é único.">
              <input name="serie" list="series-de-eventos" maxLength={80} defaultValue={valores?.serie ?? ''} className={estiloEntrada} />
              <datalist id="series-de-eventos">
                {(evento?.series ?? []).map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Fonte de receita" dica={evento?.fontes && evento.fontes.length === 0 ? 'Peça ao Financeiro para cadastrar a fonte do evento. Você pode escolher depois.' : 'Escolha onde a receita entra no orçamento.'}>
              <select name="fonte_receita" defaultValue={valores?.fonteReceitaId ?? ''} className={estiloEntrada} disabled={!evento?.fontes?.length}>
                <option value="">{evento?.fontes === null ? 'Lista indisponível agora' : 'Escolher depois'}</option>
                {(evento?.fontes ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </>
        ) : (
          <Campo rotulo="Tipo" obrigatorio>
            <select name="tipo" defaultValue={valores?.tipo ?? 'interno'} className={estiloEntrada}>
              {TIPOS_PROJETO.filter((t) => t !== 'captacao').map((t) => (
                <option key={t} value={t}>
                  {NOME_TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="Porte" obrigatorio dica="Enxuto: projeto pequeno, roteiro simplificado. Completo: as 5 fases do método.">
          <select name="porte" defaultValue={valores?.porte ?? (curto ? 'enxuto' : 'completo')} className={estiloEntrada}>
            {PORTES.map((t) => (
              <option key={t} value={t}>
                {NOME_PORTE[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo={curto ? 'Custo estimado (R$)' : 'Valor estimado (R$)'} dica={curto ? 'Quanto o evento deve custar. O orçamento de custos em linhas é feito na fase 3.' : 'Se já tiver uma ideia do custo. Pode ficar em branco.'}>
          <input name="valor" inputMode="decimal" defaultValue={valores?.valorEstimado ?? ''} className={`${estiloEntrada} max-w-48`} />
        </Campo>
        <Campo rotulo="Serviço" dica="Se a ideia pertence a um serviço da instituição.">
          <select name="servico" defaultValue={valores?.servico ?? ''} className={estiloEntrada}>
            <option value="">Nenhum</option>
            {servicos.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="flex flex-wrap gap-3">
        {comEnviar && (
          <BotaoEnviar name="enviar" value="sim" enviando="Enviando…">
            Enviar para uma coordenação assumir
          </BotaoEnviar>
        )}
        <BotaoEnviar variante="secundario" enviando="Salvando…">
          Salvar rascunho
        </BotaoEnviar>
      </div>
    </form>
  );
}
