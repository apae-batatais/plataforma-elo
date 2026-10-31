/**
 * Lista recolhida dos registros excluídos (encerrados), com "Reativar".
 * Nada é apagado: excluir só tira das listas.
 */
import { FormularioConfirmado } from './confirmar';

export function Excluidos({
  titulo,
  itens,
  acao,
  mensagem,
  campos,
}: {
  titulo: string;
  itens: { id: string; versao: number; nome: string; detalhe?: string | null }[];
  acao: (f: FormData) => void | Promise<void>;
  mensagem: string;
  /** Campos extras enviados junto (ex.: a que tipo o item pertence). */
  campos?: Record<string, string | number>;
}) {
  if (itens.length === 0) return null;
  return (
    <details className="mt-6 rounded-xl border border-borda bg-superficie">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm">
        <span className="font-semibold">
          {titulo} ({itens.length})
        </span>
        <span className="ml-2 text-texto-suave">Ficam guardados e podem ser reativados.</span>
      </summary>
      <ul className="divide-y divide-borda border-t border-borda">
        {itens.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
            <span>
              <span className="font-semibold">{x.nome}</span>
              {x.detalhe && <span className="ml-2 text-xs text-texto-suave">{x.detalhe}</span>}
            </span>
            <FormularioConfirmado
              acao={acao}
              campos={{ ...campos, id: x.id, versao: x.versao }}
              rotulo="Reativar"
              variante="fantasma"
              pequeno
              perigoso={false}
              titulo={`Reativar “${x.nome}”?`}
              mensagem={mensagem}
              confirmar="Reativar"
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
