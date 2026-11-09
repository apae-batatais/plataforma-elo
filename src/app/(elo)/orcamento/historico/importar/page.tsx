import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerHistorico } from '@/modulos/orcamento/aplicacao/historico';
import { PRIMEIRO_ANO } from '@/modulos/orcamento/dominio/historico';
import { ImportarHistorico } from '@/modulos/orcamento/telas/importar-historico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoAnalisarHistorico, acaoConfirmarHistorico, acaoDesfazerHistorico, acaoLerArquivoHistorico } from '../acoes';

export const metadata: Metadata = { title: 'Importar ano fechado' };

export default async function ImportarAnoFechado({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.historico.editar')) redirect('/orcamento/historico');
  const app = await obterAplicacao();
  const h = await lerHistorico(app.planilhas, usuario.autorizador);
  const anosImportados = h.anos.map((a) => a.ano);
  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Histórico' }, { rotulo: 'Importar ano fechado' }]}
        titulo="Importar ano fechado"
        descricao="Traz as receitas realizadas de um ano que já acabou, a partir da planilha de Previsão daquele ano. O total precisa bater, em centavos, com o total da planilha; senão, nada é gravado."
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <ImportarHistorico
        anoMin={PRIMEIRO_ANO}
        anoMax={h.anoAtual - 1}
        lerArquivo={acaoLerArquivoHistorico}
        analisar={acaoAnalisarHistorico}
        confirmar={acaoConfirmarHistorico}
      />
      {anosImportados.length > 0 && (
        <section className="rounded-cartao border border-borda bg-superficie p-5" aria-labelledby="h-feitos">
          <h2 id="h-feitos" className="font-bold">Anos já importados</h2>
          <p className="mb-3 text-sm text-texto-suave">Desfazer não apaga: as linhas ficam guardadas no histórico, só deixam de contar.</p>
          <ul className="space-y-2">
            {anosImportados.map((ano) => (
              <li key={ano} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{ano}</span>
                <FormularioConfirmado
                  acao={acaoDesfazerHistorico}
                  campos={{ ano }}
                  rotulo={`Desfazer ${ano}`}
                  pequeno
                  titulo={`Desfazer a importação de ${ano}?`}
                  mensagem="Os indicadores deixam de incluir esse ano. As linhas não são apagadas: ficam guardadas no histórico."
                  confirmar="Desfazer importação"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
