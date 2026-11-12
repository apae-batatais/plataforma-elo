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
}

export function FormularioIdeia({
  acao,
  servicos,
  valores,
  comEnviar = true,
}: {
  acao: (f: FormData) => Promise<void>;
  servicos: { codigo: string; nome: string }[];
  valores?: ValoresIdeia;
  comEnviar?: boolean;
}) {
  return (
    <form action={acao} className="space-y-5 rounded-cartao border border-borda bg-superficie p-5">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}
      {valores?.versao !== undefined && <input type="hidden" name="versao" value={valores.versao} />}
      <Campo rotulo="Título" obrigatorio>
        <input name="titulo" required maxLength={120} defaultValue={valores?.titulo} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Resumo" obrigatorio dica="Em poucas linhas: qual a necessidade e o que se pretende fazer.">
        <textarea name="resumo" required rows={5} defaultValue={valores?.resumo} className={estiloEntrada} />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Tipo" obrigatorio>
          <select name="tipo" defaultValue={valores?.tipo ?? 'interno'} className={estiloEntrada}>
            {TIPOS_PROJETO.map((t) => (
              <option key={t} value={t}>
                {NOME_TIPO[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Porte" obrigatorio dica="Enxuto: projeto pequeno, roteiro simplificado. Completo: as 5 fases do método.">
          <select name="porte" defaultValue={valores?.porte ?? 'completo'} className={estiloEntrada}>
            {PORTES.map((t) => (
              <option key={t} value={t}>
                {NOME_PORTE[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Valor estimado (R$)" dica="Se já tiver uma ideia do custo. Pode ficar em branco.">
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
