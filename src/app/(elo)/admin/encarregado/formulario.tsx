'use client';

/** Formulário do encarregado (cadastrar, corrigir ou trocar). Mantém o digitado quando há erro. */
import { useActionState, useRef, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { EstadoEncarregado } from './acoes';

interface Inicial {
  tipo: string;
  nome: string;
  documento: string;
  email: string;
}

export function FormularioEncarregado({
  acao,
  inicial,
  registro,
  comData,
  hoje,
  rotuloEnviar,
  confirmacao,
}: {
  acao: (e: EstadoEncarregado, f: FormData) => Promise<EstadoEncarregado>;
  inicial?: Inicial;
  registro?: { id: string; versao: number };
  comData?: boolean;
  hoje?: string;
  rotuloEnviar: string;
  /** Texto de confirmação antes de enviar (ações sem volta). */
  confirmacao?: string;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const v = estado.valores ?? inicial;
  const [tipo, setTipo] = useState(v?.tipo || 'fisica');
  const [confirmando, setConfirmando] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const fisica = tipo === 'fisica';

  return (
    <form ref={form} action={enviar} className="space-y-4">
      {registro && (
        <>
          <input type="hidden" name="id" value={registro.id} />
          <input type="hidden" name="versao" value={registro.versao} />
        </>
      )}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo rotulo="Tipo" obrigatorio>
        <select name="tipo" required value={tipo} onChange={(e) => setTipo(e.target.value)} className={estiloEntrada}>
          <option value="fisica">Pessoa física</option>
          <option value="juridica">Pessoa jurídica</option>
        </select>
      </Campo>
      <Campo rotulo={fisica ? 'Nome da pessoa' : 'Razão social'} obrigatorio>
        <input name="nome" required defaultValue={v?.nome} autoComplete="off" className={estiloEntrada} />
      </Campo>
      <Campo rotulo={fisica ? 'CPF' : 'CNPJ'} obrigatorio dica="Pode digitar com pontos e traço.">
        <input name="documento" required inputMode="numeric" defaultValue={v?.documento} autoComplete="off" className={estiloEntrada} />
      </Campo>
      <Campo rotulo="E-mail" obrigatorio dica="Para onde os titulares vão escrever.">
        <input name="email" type="email" required defaultValue={v?.email} autoComplete="off" className={estiloEntrada} />
      </Campo>
      {comData && (
        <Campo rotulo="Data da troca" obrigatorio>
          <input name="data" type="date" required defaultValue={estado.valores?.data || hoje} className={estiloEntrada} />
        </Campo>
      )}
      {confirmacao && confirmando ? (
        <div className="space-y-3 rounded-lg border border-borda-forte bg-superficie-2 p-4 text-sm">
          <p>{confirmacao}</p>
          <div className="flex gap-2">
            <BotaoEnviar enviando="Salvando…">{rotuloEnviar}</BotaoEnviar>
            <Botao type="button" variante="secundario" onClick={() => setConfirmando(false)}>
              Voltar
            </Botao>
          </div>
        </div>
      ) : confirmacao ? (
        <Botao
          type="button"
          className="w-full"
          onClick={() => {
            if (form.current?.reportValidity()) setConfirmando(true);
          }}
        >
          {rotuloEnviar}
        </Botao>
      ) : (
        <BotaoEnviar enviando="Salvando…" className="w-full">
          {rotuloEnviar}
        </BotaoEnviar>
      )}
    </form>
  );
}
