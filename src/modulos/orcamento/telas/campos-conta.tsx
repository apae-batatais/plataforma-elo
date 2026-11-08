'use client';

/** Campos do formulário de conta. O campo Fonte só aparece quando a classe é Vinculada. */
import { useState } from 'react';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CLASSES, ROTULO_CLASSE, ROTULO_TIPO, TIPOS_CONTA, type Classe, type TipoConta } from '../dominio/tesouraria';

export interface ValorConta {
  banco: string;
  agencia: string | null;
  conta: string | null;
  tipo: TipoConta;
  classe: Classe;
  fonte_id: string | null;
  unidade: string | null;
}

export function CamposConta({
  valor,
  fontes,
  fonteAtual,
  unidades,
  mesesTroca,
}: {
  valor?: ValorConta;
  /** Últimos meses para "mudou a partir de um mês". Só vem ao alterar uma conta existente. */
  mesesTroca?: { valor: string; rotulo: string }[];
  /** Fontes restritas ativas: as únicas aceitas em conta vinculada. */
  fontes: { id: string; nome: string }[];
  /** Fonte já gravada na conta, mesmo que hoje não sirva mais (livre ou excluída). */
  fonteAtual?: { id: string; nome: string } | null;
  unidades: { codigo: string; nome: string }[];
}) {
  const [classe, setClasse] = useState<string>(valor?.classe ?? '');
  const [tipo, setTipo] = useState<string>(valor?.tipo ?? '');
  const [modo, setModo] = useState<string>('');
  const caixa = tipo === 'caixa';
  const trocouClasse = !!valor && !!mesesTroca && classe !== '' && classe !== valor.classe;
  const fonteForaDaLista = !!fonteAtual && !fontes.some((f) => f.id === fonteAtual.id);
  return (
    <>
      <Campo rotulo="Banco" obrigatorio dica="Para caixa, escreva o nome do caixa (ex.: Caixa da secretaria).">
        <input name="banco" required defaultValue={valor?.banco} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Tipo" obrigatorio>
        <select name="tipo" required value={tipo} onChange={(e) => setTipo(e.target.value)} className={estiloEntrada}>
          <option value="">Escolha…</option>
          {TIPOS_CONTA.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Agência" obrigatorio={!caixa} dica={caixa ? 'Caixa não precisa de agência.' : undefined}>
          <input name="agencia" required={!caixa} defaultValue={valor?.agencia ?? ''} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Conta" obrigatorio={!caixa} dica={caixa ? 'Caixa não precisa de número.' : undefined}>
          <input name="conta" required={!caixa} defaultValue={valor?.conta ?? ''} className={estiloEntrada} />
        </Campo>
      </div>
      <Campo rotulo="Classe" obrigatorio dica="Livre disponível, reserva ou vinculada a um termo.">
        <select name="classe" required value={classe} onChange={(e) => setClasse(e.target.value)} className={estiloEntrada}>
          <option value="">Escolha…</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CLASSE[c]}
            </option>
          ))}
        </select>
      </Campo>
      {classe === 'vinculada' && (
        <Campo rotulo="Fonte (termo)" obrigatorio dica="Só aparecem fontes de uso restrito.">
          <select name="fonte_id" required defaultValue={valor?.fonte_id ?? ''} className={estiloEntrada}>
            <option value="">Escolha…</option>
            {fonteForaDaLista && (
              <option value={fonteAtual.id}>{fonteAtual.nome} (não serve mais para conta vinculada: escolha outra)</option>
            )}
            {fontes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          {fonteForaDaLista && (
            <span className="mt-1.5 block text-sm text-erro">
              A fonte atual desta conta (“{fonteAtual.nome}”) deixou de ser restrita ou foi excluída. Escolha outra fonte para poder salvar.
            </span>
          )}
        </Campo>
      )}
      {trocouClasse && (
        <fieldset className="space-y-2 rounded-lg border border-borda p-3">
          <legend className="px-1 text-sm font-semibold">Trocar a classe muda os totais por classe.</legend>
          <p className="text-sm text-texto-suave">Escolha como a mudança vale:</p>
          <label className="flex items-start gap-2">
            <input type="radio" name="troca" value="corrigir" required checked={modo === 'corrigir'} onChange={() => setModo('corrigir')} className="mt-1" />
            <span>
              <span className="font-semibold">Corrigir em todos os meses</span>
              <span className="block text-sm text-texto-suave">A classe estava errada desde o início.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="troca" value="a_partir_de" required checked={modo === 'a_partir_de'} onChange={() => setModo('a_partir_de')} className="mt-1" />
            <span className="font-semibold">Mudou a partir de um mês</span>
          </label>
          {modo === 'a_partir_de' && (
            <Campo rotulo="Primeiro mês com a classe nova" obrigatorio dica="Os meses anteriores continuam na classe antiga.">
              <select name="troca_mes" required defaultValue="" className={estiloEntrada}>
                <option value="">Escolha…</option>
                {mesesTroca.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </fieldset>
      )}
      <Campo rotulo="Unidade" dica="Opcional.">
        <select name="unidade" defaultValue={valor?.unidade ?? ''} className={estiloEntrada}>
          <option value="">Nenhuma</option>
          {unidades.map((u) => (
            <option key={u.codigo} value={u.codigo}>
              {u.nome}
            </option>
          ))}
        </select>
      </Campo>
    </>
  );
}
