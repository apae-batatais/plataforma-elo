import { redirect } from 'next/navigation';
import { ImportarFolha } from '@/modulos/orcamento/telas/importar-folha';
import { usuarioLogado } from '@/plataforma/sessao';
import { acaoAnalisarImportacao, acaoConfirmarImportacao } from '../acoes';

export default async function Importar() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.editar') || !a.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Importar a planilha da folha</h2>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Traz cargos, tabela salarial, postos e rateios de uma vez. Fichas já cadastradas são ignoradas e nada existente é alterado, então
          dá para importar de novo com segurança.
        </p>
      </div>
      <ImportarFolha analisar={acaoAnalisarImportacao} confirmar={acaoConfirmarImportacao} />
    </div>
  );
}
