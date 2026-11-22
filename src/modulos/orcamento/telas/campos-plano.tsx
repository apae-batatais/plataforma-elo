'use client';

/**
 * Item contábil e Área do plano nos lançamentos (proposta #221, ADR-036).
 * O plano só orienta: a lista mostra primeiro os itens habilitados e, abaixo, "Outros itens do grupo";
 * fora do plano aparece um aviso, que nunca impede de salvar. O servidor confere só erro de dado.
 */
import { useState } from 'react';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { OpcoesPlano } from '../aplicacao/plano-lancamento';
import { avisoDoPlano, itensParaEscolher } from '../dominio/plano-contas';

export function CamposPlano({
  plano, ano, grupoId, itemInicial, areaInicial, nomeItem = 'item_id', nomeArea = 'area_plano_id', compacto = false, formId, sufixoId = '',
}: {
  plano: OpcoesPlano;
  ano: number;
  grupoId: string;
  itemInicial: string | null;
  areaInicial: string | null;
  nomeItem?: string;
  nomeArea?: string;
  /** Sem rótulos grandes (usado na grade do Realizado). */
  compacto?: boolean;
  formId?: string;
  sufixoId?: string;
}) {
  const [item, setItem] = useState(itemInicial ?? '');
  const [area, setArea] = useState(areaInicial ?? '');
  const semCadastro = plano.areas.filter((a) => a.ativo).length === 0 && plano.itens.filter((i) => i.ativo).length === 0;
  if (semCadastro && !itemInicial && !areaInicial) return null;

  const itensVisiveis = plano.itens.filter((i) => i.ativo || i.id === itemInicial);
  const { habilitados, outros } = itensParaEscolher(itensVisiveis, grupoId, area || null, plano.linhas);
  // Item que não é do grupo escolhido não aparece: a escolha volta a "sem item" para não gravar erro de dado.
  const itemValido = [...habilitados, ...outros].some((i) => i.id === item) ? item : '';
  const aviso = avisoDoPlano({ grupo_id: grupoId || null, item_id: itemValido || null, area_id: area || null }, plano.linhas, ano);
  const rotulo = (i: { nome: string; codigo: string | null; ativo?: boolean }) => `${i.nome}${i.codigo ? ` (${i.codigo})` : ''}${i.ativo === false ? ' — excluído' : ''}`;
  const classe = `${estiloEntrada} ${compacto ? '!mt-0 text-sm' : ''}`;
  const idArea = `plano-area${sufixoId}`;
  const idItem = `plano-item${sufixoId}`;

  const campoArea = (
    <select id={idArea} form={formId} name={nomeArea} value={area} onChange={(e) => setArea(e.target.value)} className={classe} aria-label={compacto ? 'Área do plano' : undefined}>
      <option value="">{compacto ? 'Área do plano: não informada' : 'Não informada'}</option>
      {plano.areas.filter((a) => a.ativo || a.id === areaInicial).map((a) => (
        <option key={a.id} value={a.id}>
          {a.nome}{a.ativo ? '' : ' — excluída'}
        </option>
      ))}
    </select>
  );
  const campoItem = (
    <select id={idItem} form={formId} name={nomeItem} value={itemValido} onChange={(e) => setItem(e.target.value)} className={classe} aria-label={compacto ? 'Item contábil' : undefined} disabled={!grupoId}>
      <option value="">{grupoId ? (compacto ? 'Item contábil: não informado' : 'Não informado') : 'Escolha o grupo primeiro'}</option>
      {plano.linhas && habilitados.length > 0 ? (
        <optgroup label="Habilitados no plano">
          {habilitados.map((i) => (
            <option key={i.id} value={i.id}>{rotulo(i)}</option>
          ))}
        </optgroup>
      ) : (
        habilitados.map((i) => (
          <option key={i.id} value={i.id}>{rotulo(i)}</option>
        ))
      )}
      {outros.length > 0 && (
        <optgroup label="Outros itens do grupo">
          {outros.map((i) => (
            <option key={i.id} value={i.id}>{rotulo(i)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
  const avisoTela = aviso && (
    <p role="status" className="rounded-md border border-aviso bg-aviso/10 px-3 py-2 text-sm">
      {aviso} Você pode salvar mesmo assim: o plano só orienta.
    </p>
  );

  if (compacto) {
    return (
      <div className="mt-1 space-y-1">
        {campoArea}
        {campoItem}
        {avisoTela}
      </div>
    );
  }
  return (
    <>
      <Campo rotulo="Item contábil (opcional)" dica="Só orienta: você pode escolher outro. Mostra primeiro os itens do plano do ano.">
        {campoItem}
      </Campo>
      <Campo rotulo="Área do plano (opcional)" dica="É a área da contabilidade, diferente da área do serviço. Fica em branco se você não escolher.">
        {campoArea}
      </Campo>
      {avisoTela}
    </>
  );
}
