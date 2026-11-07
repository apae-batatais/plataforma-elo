'use client';

/** Alterações da Comunicação durante a revisão: título, descrição, tipo de peça, tema e data. */
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { NOME_TIPO_PECA, TIPOS_PECA, type TipoPeca } from '../dominio/pedido';
import { CamposDeData } from './campos-de-data';
import type { EstadoPedido, ItemEscolha } from './formulario-pedido';

export function EditarNaRevisao({
  acao,
  id,
  versao,
  itens,
  inicial,
}: {
  acao: (estado: EstadoPedido, f: FormData) => Promise<EstadoPedido>;
  id: string;
  versao: number;
  itens: ItemEscolha[];
  inicial: { titulo: string; descricao: string; tipoPeca: TipoPeca; calendarioId: string | null; calendarioTema: string | null; dataDesejada: string };
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  // Sem "action" no formulário, o React não limpa os campos quando o servidor devolve um erro.
  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(() => enviar(f));
  };
  const [tema, setTema] = useState(inicial.calendarioId ?? '');
  const lista = [...itens];
  if (inicial.calendarioId && !lista.some((i) => i.id === inicial.calendarioId))
    lista.unshift({ id: inicial.calendarioId, tema: inicial.calendarioTema ?? 'Tema do pedido', inicio: '', fim: '', tipos: [] });
  return (
    <form onSubmit={aoEnviar} className="space-y-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="versao" value={versao} />
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {estado.erro}
        </Aviso>
      )}
      <Campo rotulo="Título" obrigatorio>
        <input type="text" name="titulo" required maxLength={140} defaultValue={inicial.titulo} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="O que deve ser publicado" obrigatorio>
        <textarea name="descricao" required rows={5} defaultValue={inicial.descricao} className={estiloEntrada} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo de peça" obrigatorio>
          <select name="tipo_peca" required defaultValue={inicial.tipoPeca} className={estiloEntrada}>
            {TIPOS_PECA.map((t) => (
              <option key={t} value={t}>
                {NOME_TIPO_PECA[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Data desejada" obrigatorio>
          <input type="date" name="data_desejada" required defaultValue={inicial.dataDesejada} className={estiloEntrada} />
        </Campo>
      </div>
      <Campo rotulo="Tema do calendário" dica="Ligue o pedido a um tema que já existe no calendário, ou deixe fora do calendário.">
        <select name="calendario_id" value={tema} onChange={(e) => setTema(e.target.value)} className={estiloEntrada}>
          <option value="">Fora do calendário</option>
          <option value="__novo__">Criar novo tema no calendário</option>
          {lista.map((i) => (
            <option key={i.id} value={i.id}>
              {i.tema}
            </option>
          ))}
        </select>
      </Campo>
      {tema === '__novo__' && (
        <fieldset className="space-y-4 rounded-lg border border-borda p-4">
          <legend className="px-1 text-sm font-semibold">Novo tema do calendário</legend>
          <Campo rotulo="Tema" obrigatorio>
            <input name="novo_tema" required className={estiloEntrada} />
          </Campo>
          <CamposDeData tipoData="exata" />
          <fieldset>
            <legend className="text-sm font-semibold">Tipos de peça sugeridos</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {TIPOS_PECA.map((t) => (
                <label key={t} className="flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm">
                  <input type="checkbox" name="tipos" value={t} defaultChecked={t === inicial.tipoPeca} />
                  {NOME_TIPO_PECA[t]}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}
      <BotaoEnviar enviando="Salvando…" pendente={enviando}>
        Salvar alterações
      </BotaoEnviar>
    </form>
  );
}
