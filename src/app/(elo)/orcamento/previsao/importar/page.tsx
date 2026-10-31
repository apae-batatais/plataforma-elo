import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ImportarItens } from '@/modulos/orcamento/telas/importar-itens';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoAnalisarItens, acaoConfirmarItens, acaoLerArquivoItens } from '../acoes';

export const metadata: Metadata = { title: 'Importar despesas e receitas' };

export default async function ImportarDespesasEReceitas() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.previsao.editar')) redirect('/orcamento/previsao');
  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Importar despesas e receitas' }]}
        titulo="Importar despesas e receitas"
        descricao="Traz as despesas ou as receitas de uma planilha para o exercício em elaboração. Você escolhe a aba e diz qual coluna corresponde a cada campo. Importar de novo substitui a importação anterior do mesmo tipo; os itens lançados à mão não mudam."
      />
      <ImportarItens lerArquivo={acaoLerArquivoItens} analisar={acaoAnalisarItens} confirmar={acaoConfirmarItens} />
    </div>
  );
}
