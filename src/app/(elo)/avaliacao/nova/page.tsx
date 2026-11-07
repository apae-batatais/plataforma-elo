import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { detalharAvaliacao, PERM, servicosParaAvaliar } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { AVALIACAO_VAZIA, ErroAvaliacao, type DadosAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { FormularioAvaliacao } from '@/modulos/avaliacao/telas/formulario-avaliacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarAvaliacao } from '../acoes';

export const metadata: Metadata = { title: 'Nova avaliação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function NovaAvaliacao({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const servicos = await servicosParaAvaliar(app.planilhas, usuario.autorizador);
  const hoje = hojeBrasilia();
  let inicial: DadosAvaliacao = { ...AVALIACAO_VAZIA, data_avaliacao: hoje };
  let anterior: string | null = null;
  // Acompanhamento anual: começa com a identificação, o serviço e o cuidador da avaliação anterior.
  if (sp.de) {
    try {
      const a = await detalharAvaliacao(app.planilhas, usuario.autorizador, sp.de);
      const d = a.dados;
      inicial = {
        ...inicial,
        tipo: 'Acompanhamento anual',
        iniciais: d.iniciais,
        nascimento: d.nascimento,
        sexo: d.sexo,
        prontuario: d.prontuario,
        servico: d.servico,
        cuidador: d.cuidador,
      };
      anterior = br(d.data_avaliacao);
    } catch (erro) {
      if (!(erro instanceof ErroAvaliacao || erro instanceof ErroPermissao)) throw erro;
    }
  }
  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' }, { rotulo: 'Nova avaliação' }]}
        titulo={anterior ? 'Acompanhamento anual' : 'Nova avaliação'}
        descricao={
          anterior
            ? `Reavaliação da pessoa avaliada em ${anterior}. A identificação, o serviço e o cuidador já vêm preenchidos; responda as demais perguntas pela situação de hoje.`
            : 'Avaliação inicial (quando a pessoa é encaminhada ao serviço) ou acompanhamento anual. Identifique só pelas iniciais, data de nascimento e sexo: o nome completo não é pedido.'
        }
      />
      {servicos.length === 0 ? (
        <Aviso tipo="atencao" titulo="Nenhum serviço para avaliar">
          Você não tem serviço no seu escopo. A administração liga o seu acesso ao serviço em Administração › Acessos.
        </Aviso>
      ) : (
        <FormularioAvaliacao servicos={servicos} inicial={inicial} hoje={hoje} acao={acaoSalvarAvaliacao} />
      )}
    </div>
  );
}
