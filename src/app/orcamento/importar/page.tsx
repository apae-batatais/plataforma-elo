import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ImportarFolha } from '@/modulos/orcamento/telas/importar-folha';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoAnalisarImportacao, acaoConfirmarImportacao } from '../acoes';

export const metadata: Metadata = { title: 'Importar planilha da folha' };

export default async function Importar() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.editar') || !a.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Importar planilha' }]}
        titulo="Importar a planilha da folha"
        descricao="Traz cargos, tabela salarial, postos e rateios de uma vez. Fichas já cadastradas são ignoradas e nada existente é alterado, então dá para importar de novo com segurança."
      />
      <ImportarFolha analisar={acaoAnalisarImportacao} confirmar={acaoConfirmarImportacao} />
    </div>
  );
}
