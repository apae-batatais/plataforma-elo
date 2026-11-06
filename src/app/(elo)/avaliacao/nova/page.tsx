import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM, servicosParaAvaliar } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { AVALIACAO_VAZIA } from '@/modulos/avaliacao/dominio/avaliacao';
import { FormularioAvaliacao } from '@/modulos/avaliacao/telas/formulario-avaliacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarAvaliacao } from '../acoes';

export const metadata: Metadata = { title: 'Nova avaliação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export default async function NovaAvaliacao() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const servicos = await servicosParaAvaliar(app.planilhas, usuario.autorizador);
  const hoje = hojeBrasilia();
  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação Diagnóstica', href: '/avaliacao' }, { rotulo: 'Nova avaliação' }]}
        titulo="Nova avaliação"
        descricao="Questionário diagnóstico da pessoa atendida. Identifique só pelas iniciais, data de nascimento e sexo: o nome completo não é pedido."
      />
      {servicos.length === 0 ? (
        <Aviso tipo="atencao" titulo="Nenhum serviço para avaliar">
          Você não tem serviço no seu escopo. A administração liga o seu acesso ao serviço em Administração › Acessos.
        </Aviso>
      ) : (
        <FormularioAvaliacao servicos={servicos} inicial={{ ...AVALIACAO_VAZIA, data_avaliacao: hoje }} hoje={hoje} acao={acaoSalvarAvaliacao} />
      )}
    </div>
  );
}
