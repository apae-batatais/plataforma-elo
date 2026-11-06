import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { detalharAvaliacao, PERM, servicosParaAvaliar } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { FormularioAvaliacao } from '@/modulos/avaliacao/telas/formulario-avaliacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoRetirarAvaliacao, acaoSalvarAvaliacao } from '../acoes';

export const metadata: Metadata = { title: 'Avaliação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function AbrirAvaliacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let av;
  try {
    av = await detalharAvaliacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) redirect(`/avaliacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const servicos = await servicosParaAvaliar(app.planilhas, usuario.autorizador);
  // Serviço que saiu do cadastro continua aparecendo nesta avaliação.
  if (!servicos.some((s) => s.codigo === av.dados.servico))
    servicos.push({ codigo: av.dados.servico, nome: av.servicoNome, areaNome: 'Fora do cadastro atual' });
  const d = av.dados;
  return (
    <div>
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' },
          { rotulo: `${d.iniciais} · ${br(d.nascimento)}` },
        ]}
        titulo={`Avaliação de ${d.iniciais} · ${br(d.nascimento)} · ${d.sexo}`}
        descricao={`${d.tipo} · ${av.servicoNome} · avaliada em ${br(d.data_avaliacao)}. Corrija o que precisar e salve.`}
        acoes={
          <>
            <LinkBotao href={`/avaliacao/${av.id}/comparativo`} variante="secundario" className={pequeno}>
              Comparativo da pessoa
            </LinkBotao>
            <LinkBotao href={`/avaliacao/${av.id}/ficha`} variante="secundario" className={pequeno}>
              Imprimir ficha
            </LinkBotao>
            <FormularioConfirmado
              acao={acaoRetirarAvaliacao}
              campos={{ id: av.id, versao: av.versao }}
              rotulo="Retirar avaliação"
              pequeno
              variante="secundario"
              titulo="Retirar esta avaliação?"
              mensagem="Use quando ela foi lançada por engano ou em duplicidade. Ela sai da lista e do painel, mas continua guardada na planilha com o motivo."
              confirmar="Retirar"
            >
              <Campo rotulo="Motivo" obrigatorio>
                <input name="motivo" required minLength={3} className={estiloEntrada} placeholder="Ex.: lançada em duplicidade" />
              </Campo>
            </FormularioConfirmado>
          </>
        }
      />
      <FormularioAvaliacao servicos={servicos} inicial={d} hoje={hojeBrasilia()} acao={acaoSalvarAvaliacao} id={av.id} versao={av.versao} />
    </div>
  );
}
