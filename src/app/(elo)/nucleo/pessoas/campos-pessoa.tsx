/**
 * Campos de dados da pessoa, usados no cadastro e na correção.
 * "Mais dados" fica recolhido: o essencial para começar é o nome.
 */
import { Campo, estiloEntrada } from '@/ui/campo';

export type ValoresDaPessoa = Partial<Record<'nome' | 'nomeSocial' | 'dataNascimento' | 'cpf' | 'nis' | 'email' | 'telefone' | 'cidade' | 'bairro', string | null>>;

export function CamposPessoa({ valor = {}, maisDadosAberto = false }: { valor?: ValoresDaPessoa; maisDadosAberto?: boolean }) {
  const v = (k: keyof ValoresDaPessoa) => valor[k] ?? '';
  return (
    <>
      <Campo rotulo="Nome completo" obrigatorio>
        <input name="nome" required autoComplete="off" defaultValue={v('nome')} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Nome social" dica="Como a pessoa prefere ser chamada.">
        <input name="nomeSocial" autoComplete="off" defaultValue={v('nomeSocial')} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Data de nascimento">
        <input name="dataNascimento" type="date" defaultValue={v('dataNascimento')} className={estiloEntrada} />
      </Campo>
      <details open={maisDadosAberto || undefined} className="rounded-lg border border-borda">
        <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold">Mais dados</summary>
        <div className="space-y-4 border-t border-borda p-3">
          <Campo rotulo="CPF" dica="Só números ou com pontos e traço.">
            <input name="cpf" inputMode="numeric" autoComplete="off" defaultValue={v('cpf')} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="NIS" dica="11 números.">
            <input name="nis" inputMode="numeric" autoComplete="off" defaultValue={v('nis')} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="E-mail">
            <input name="email" type="email" autoComplete="off" defaultValue={v('email')} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Telefone">
            <input name="telefone" type="tel" autoComplete="off" defaultValue={v('telefone')} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Cidade">
            <input name="cidade" autoComplete="off" defaultValue={v('cidade')} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Bairro">
            <input name="bairro" autoComplete="off" defaultValue={v('bairro')} className={estiloEntrada} />
          </Campo>
        </div>
      </details>
    </>
  );
}
