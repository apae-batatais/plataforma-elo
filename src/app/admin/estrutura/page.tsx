import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { prepararEstruturaAgora } from './acoes';

export const metadata: Metadata = { title: 'Estrutura das planilhas' };

const NOME_PLANILHA: Record<string, string> = {
  nucleo: 'Núcleo (pessoas, serviços e acessos)',
  auditoria: 'Auditoria',
  orcamento: 'Orçamento',
  orcamento_folha: 'Folha de pagamento',
};

export default async function Estrutura({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const { resultado } = await searchParams;
  const falhou = resultado?.startsWith('Não foi possível');

  return (
    <div className="max-w-3xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Estrutura das planilhas' }]}
        titulo="Estrutura das planilhas"
        descricao="Cria no Drive as abas que ainda não existem, com o cabeçalho certo, e grava a configuração inicial. Pode ser usado quantas vezes for preciso: nada que já existe é apagado."
      />

      {usuario.estruturaPendente && (
        <Aviso tipo="atencao" titulo="Primeiro uso: as planilhas estão em branco">
          Clique em <strong>Preparar estrutura</strong>. Depois disso, o restante da plataforma fica disponível.
        </Aviso>
      )}
      {resultado && (
        <Aviso tipo={falhou ? 'erro' : resultado.includes('Atenção') ? 'atencao' : 'sucesso'} titulo={falhou ? 'A estrutura não foi preparada' : 'Estrutura conferida'}>
          {resultado}
        </Aviso>
      )}

      <Secao titulo="Preparar estrutura" descricao="Leva alguns segundos. Você pode continuar usando a plataforma normalmente depois.">
        <form action={prepararEstruturaAgora}>
          <BotaoEnviar enviando="Preparando as planilhas…">Preparar estrutura</BotaoEnviar>
        </form>
      </Secao>

      {app.config.modo === 'producao' && (
        <Secao titulo="Planilhas ligadas à plataforma" descricao="Configuradas na variável PLANILHAS da hospedagem.">
          <dl className="divide-y divide-borda text-sm">
            {Object.entries(app.config.planilhas).map(([chave, id]) => (
              <div key={chave} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr]">
                <dt className="font-semibold">{NOME_PLANILHA[chave] ?? chave}</dt>
                <dd className="break-all text-texto-suave">
                  <a href={`https://docs.google.com/spreadsheets/d/${id}`} target="_blank" rel="noreferrer" className="text-destaque hover:underline">
                    Abrir no Drive
                  </a>{' '}
                  <span className="text-xs">({id})</span>
                </dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}
    </div>
  );
}
