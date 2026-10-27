import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ErroValidacaoFolha, fichaDoPosto } from '@/modulos/orcamento/aplicacao/folha';
import { data } from '@/modulos/orcamento/telas/formato';
import { FormularioPosto } from '@/modulos/orcamento/telas/formulario-posto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { acaoEncerrarPosto, acaoSalvarPosto } from '../../acoes';

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
    </div>
  );
}
