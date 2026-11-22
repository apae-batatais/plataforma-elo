import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { detalharAplicacao, instrumentosDoCer, pessoasParaAvaliar, PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { ErroSaude } from '@/modulos/saude/dominio/cer';
import { FormularioAplicacao, type ValoresIniciais } from '@/modulos/saude/telas/formulario-aplicacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarAplicacao } from '../acoes';

export const metadata: Metadata = { title: 'Nova avaliação de Saúde' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export default async function NovaAvaliacaoDeSaude({ searchParams }: { searchParams: Promise<{ corrige?: string; pessoa?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  const [pessoas, { atual }] = await Promise.all([pessoasParaAvaliar(app.planilhas, usuario.autorizador), instrumentosDoCer(app.planilhas)]);
  const inicial: ValoresIniciais = {
    pessoaId: pessoas.some((x) => x.id === sp.pessoa) ? sp.pessoa! : '',
    servico: '',
    periodoInicio: '',
    periodoFim: hojeBrasilia(),
    dataIngresso: '',
    profissional: usuario.nome,
    funcao: '',
    justificativa: '',
    respostas: {},
  };
  let corrige: string | undefined;
  if (sp.corrige) {
    // Correção: começa com tudo o que a avaliação fechada tinha; ao concluir, ela passa a valer no lugar da anterior.
    try {
      const a = await detalharAplicacao(app.planilhas, usuario.autorizador, sp.corrige);
      if (a.situacao !== 'fechada' || a.corrigida) redirect(`/saude/${a.id}?erro=${encodeURIComponent('Só uma avaliação concluída e ainda não corrigida pode ser corrigida.')}`);
      Object.assign(inicial, {
        pessoaId: a.pessoaId,
        servico: a.servico,
        periodoInicio: a.periodoInicio,
        periodoFim: a.periodoFim,
        dataIngresso: a.dataIngresso,
        profissional: a.profissional,
        funcao: a.funcao,
        justificativa: a.justificativa,
        respostas: { ...a.respostas } as Record<number, number | undefined>,
      });
      corrige = a.id;
    } catch (erro) {
      if (erro instanceof ErroSaude || erro instanceof ErroPermissao) redirect(`/saude?erro=${encodeURIComponent(erro.message)}`);
      throw erro;
    }
  }
  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Saúde', href: '/saude' }, { rotulo: corrige ? 'Corrigir avaliação' : 'Nova avaliação' }]}
        titulo={corrige ? 'Corrigir avaliação' : 'Nova avaliação'}
        descricao={
          corrige
            ? 'Isto cria uma nova avaliação com as respostas da anterior já preenchidas. A anterior fica guardada no histórico.'
            : 'Avaliação de evolução no CER. Escolha a pessoa e o período, dê as notas de 0 a 3 e conclua. Dá para salvar um rascunho e voltar depois.'
        }
      />
      {pessoas.length === 0 && !corrige ? (
        <Aviso tipo="atencao" titulo="Nenhuma pessoa para avaliar">
          Você não tem pessoas atendidas visíveis em serviço de Saúde. A administração liga o seu acesso ao serviço em Administração › Acessos.
        </Aviso>
      ) : (
        <FormularioAplicacao pessoas={pessoas} instrumento={atual} inicial={inicial} acao={acaoSalvarAplicacao} corrige={corrige} pessoaFixa={Boolean(corrige)} />
      )}
    </div>
  );
}
