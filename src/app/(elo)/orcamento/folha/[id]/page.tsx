import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ErroValidacaoFolha, fichaDoPosto } from '@/modulos/orcamento/aplicacao/folha';
import { ajustesDaPessoa } from '@/modulos/orcamento/aplicacao/passivo';
import { data, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioPosto } from '@/modulos/orcamento/telas/formulario-posto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoEncerrarPosto, acaoRegistrarFerias, acaoRegistrarSaldoFgts, acaoRemoverFerias, acaoSalvarPosto } from '../../acoes';

export const metadata: Metadata = { title: 'Funcionário' };

export default async function FichaDoPosto({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const novo = id === 'novo';
  if (!usuario.autorizador.temPermissao(novo ? 'orcamento.folha.editar' : 'orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  let ficha;
  try {
    ficha = await fichaDoPosto(app.planilhas, usuario.autorizador, novo ? null : id);
  } catch (erro) {
    if (erro instanceof ErroValidacaoFolha) redirect('/orcamento/folha');
    throw erro;
  }
  const p = ficha.posto;
  const ajustes = p?.ficha ? await ajustesDaPessoa(app.planilhas, usuario.autorizador, p.id) : null;
  const cargo = p?.cargo ?? null;
  const titulo = novo ? 'Cadastrar na folha' : (p?.colaborador ?? 'Vaga prevista');

  return (
    <div>
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Orçamento', href: '/orcamento' },
          { rotulo: 'Folha de Pagamento', href: '/orcamento/folha' },
          { rotulo: titulo },
        ]}
        titulo={titulo}
        descricao={
          p ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {cargo}
                {p.departamento ? ` · ${p.departamento}` : ''}
                {p.ficha ? ` · código ${p.ficha}` : ''}
              </span>
              {p.desligamento ? (
                <Etiqueta tipo="neutro">Desligado em {data(p.desligamento)}</Etiqueta>
              ) : !p.ficha ? (
                <Etiqueta tipo="info">Vaga prevista a partir de {data(p.inicio)}</Etiqueta>
              ) : null}
            </span>
          ) : (
            'Um funcionário ou uma vaga prevista, com todas as colunas da aba Estudo. O custo entra no resumo assim que você salvar.'
          )
        }
        acoes={
          p && ficha.podeEditar && !p.desligamento ? (
            <FormularioConfirmado
              acao={acaoEncerrarPosto}
              campos={{ id: p.id, versao: p.versao }}
              rotulo="Registrar desligamento"
              variante="secundario"
              perigoso={false}
              titulo={`Registrar o desligamento de ${p.colaborador ?? 'esta vaga'}?`}
              mensagem="O funcionário deixa de contar no custo depois do mês do desligamento. Os meses anteriores e o histórico são mantidos."
              confirmar="Registrar desligamento"
            >
              <Campo rotulo="Data de desligamento" obrigatorio>
                <input type="date" name="desligamento" required className={estiloEntrada} />
              </Campo>
            </FormularioConfirmado>
          ) : undefined
        }
      />

      {ficha.cadastros.centros.length === 0 ? (
        <EstadoVazio
          titulo="Cadastre os serviços primeiro"
          acao={<LinkBotao href="/admin/servicos">Ir para Serviços</LinkBotao>}
        >
          A lotação de cada funcionário é feita nos Serviços da instituição. Peça à administração da plataforma para cadastrá-los.
        </EstadoVazio>
      ) : (
        <FormularioPosto key={`${p?.id}-${p?.versao}`} ficha={ficha} acao={acaoSalvarPosto} />
      )}

      {p && ajustes && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Secao titulo="Férias já tiradas" descricao="Servem para calcular as férias vencidas no passivo trabalhista.">
            {ajustes.ferias.length === 0 ? (
              <p className="text-sm text-texto-suave">Nenhum período registrado.</p>
            ) : (
              <ul className="divide-y divide-borda text-sm">
                {ajustes.ferias.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {data(x.inicio)} · {x.dias} {x.dias === 1 ? 'dia' : 'dias'}
                      {x.observacao ? ` · ${x.observacao}` : ''}
                    </span>
                    {ajustes.podeEditar && (
                      <form action={acaoRemoverFerias}>
                        <input type="hidden" name="posto_id" value={p.id} />
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="versao" value={x.versao} />
                        <BotaoEnviar variante="secundario" enviando="Removendo…">
                          Remover
                        </BotaoEnviar>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {ajustes.podeEditar && (
              <form action={acaoRegistrarFerias} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_6rem_auto]">
                <input type="hidden" name="posto_id" value={p.id} />
                <Campo rotulo="Início do período" obrigatorio>
                  <input type="date" name="inicio" required className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Dias" obrigatorio>
                  <input type="number" name="dias" min={1} max={30} required inputMode="numeric" className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Registrando…">Registrar período de férias</BotaoEnviar>
              </form>
            )}
          </Secao>
          <Secao titulo="Saldo do FGTS" descricao="Opcional. Sem extrato, o Elo estima pelo valor da folha.">
            <p className="text-sm">
              {ajustes.saldo ? (
                <>
                  Último extrato: <strong>{reais(ajustes.saldo.valor)}</strong> em {data(ajustes.saldo.referencia)}.
                </>
              ) : (
                <span className="text-texto-suave">Nenhum extrato registrado; saldo estimado.</span>
              )}
            </p>
            {ajustes.podeEditar && (
              <form action={acaoRegistrarSaldoFgts} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="posto_id" value={p.id} />
                <Campo rotulo="Data do extrato" obrigatorio>
                  <input type="date" name="referencia" required className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Saldo (R$)" obrigatorio>
                  <input name="valor" required inputMode="decimal" className={`${estiloEntrada} text-right tabular-nums`} />
                </Campo>
                <BotaoEnviar enviando="Atualizando…">Atualizar com o extrato</BotaoEnviar>
              </form>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
