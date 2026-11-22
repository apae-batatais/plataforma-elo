import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { agendaDeVeiculos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { momentoBR } from '@/modulos/requisicoes/dominio/veiculo';
import { EtiquetaSituacao } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { acaoMarcarManutencaoFeita } from '../../acoes';

export const metadata: Metadata = { title: 'Agenda dos veículos' };

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export default async function AgendaDosVeiculos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let agenda;
  try {
    agenda = await agendaDeVeiculos(app.planilhas, usuario.autorizador);
  } catch (e) {
    if (e instanceof ErroPermissao) redirect('/requisicoes');
    throw e;
  }
  const nenhum = agenda.every((v) => v.pedidos.length === 0);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: 'Agenda dos veículos' }]}
        titulo="Agenda dos veículos"
        descricao="Pedidos aprovados e aguardando aprovação dos próximos 30 dias, por veículo, e a manutenção prevista. Só leitura: para decidir, abra o pedido."
      />
      {agenda.length === 0 ? (
        <Aviso tipo="info">Nenhum veículo cadastrado. A Administração cadastra em Requisições › Veículos.</Aviso>
      ) : (
        <>
          {nenhum && <p className="text-sm text-texto-suave">Nenhum pedido de veículo nos próximos 30 dias.</p>}
          {agenda.map((v) => (
            <Secao key={v.id} titulo={`${v.nome} · ${v.placa}`} id={`v-${v.id}`}>
              {v.manutencaoPrevista && (
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                  <Etiqueta tipo="atencao">Manutenção prevista em {dataBr(v.manutencaoPrevista)}</Etiqueta>
                  <FormularioConfirmado
                    acao={acaoMarcarManutencaoFeita}
                    campos={{ id: v.id, voltar: 'agenda' }}
                    rotulo="Marcar manutenção feita"
                    variante="secundario"
                    pequeno
                    perigoso={false}
                    titulo={`Marcar a manutenção de “${v.nome}” como feita?`}
                    mensagem="O veículo volta a aparecer para pedido novo. Se já souber a data da próxima, informe abaixo; senão deixe vazio."
                    confirmar="Marcar como feita"
                  >
                    <Campo rotulo="Próxima manutenção" dica="dia/mês/ano, a partir de hoje. Opcional.">
                      <input name="proxima" type="date" className={estiloEntrada} />
                    </Campo>
                  </FormularioConfirmado>
                </div>
              )}
              {v.pedidos.length === 0 ? (
                <p className="text-sm text-texto-suave">Nenhum pedido nos próximos 30 dias.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {v.pedidos.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-borda px-3 py-2">
                      <Link href={`/requisicoes/${x.id}`} className="font-semibold text-destaque hover:underline">
                        {x.numero}
                      </Link>
                      <span className="tabular-nums">
                        {momentoBR(x.saida)} a {momentoBR(x.volta)}
                      </span>
                      <span>{x.quem}</span>
                      <span>{x.destino}</span>
                      <EtiquetaSituacao situacao={x.situacao} nome={x.situacaoNome} />
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          ))}
        </>
      )}
    </div>
  );
}
