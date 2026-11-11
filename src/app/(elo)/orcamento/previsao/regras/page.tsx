import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarRegras, nomeDaBase, previaDaRegra, type RegraLida } from '@/modulos/orcamento/aplicacao/regras-rateio';
import { BASES_FIXAS } from '@/modulos/orcamento/dominio/rateio-custos';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Excluidos } from '@/ui/excluidos';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoExcluirRegra, acaoReativarRegra, acaoSalvarRegra } from '../acoes';

export const metadata: Metadata = { title: 'Regras de rateio' };

type Cadastro = Awaited<ReturnType<typeof listarRegras>>;

function CamposRegra({ regra, cad }: { regra?: RegraLida; cad: Cadastro }) {
  const bases = [
    ...Object.entries(BASES_FIXAS).map(([v, n]) => ({ v, n })),
    ...cad.bases.ativas.map((b) => ({ v: `propria:${b.id}`, n: `${b.nome} (base própria)` })),
  ];
  const seleciona = (nome: string, atual: string | null | undefined, vazio?: string) => (
    <select name={nome} defaultValue={atual ?? ''} className={estiloEntrada} required={!vazio}>
      {vazio && <option value="">{vazio}</option>}
      {bases.map((b) => (
        <option key={b.v} value={b.v}>
          {b.n}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <Campo rotulo="Nome" obrigatorio dica="Ex.: Energia e limpeza, Alimentação. Não pode repetir.">
        <input name="nome" required defaultValue={regra?.nome} className={estiloEntrada} />
      </Campo>
      <fieldset className="text-sm">
        <legend className="font-semibold">Quem participa</legend>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="tipo" value="area" defaultChecked={!regra || regra.tipo === 'area'} /> Áreas (divide em dois níveis: entre as áreas e depois entre os serviços)
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="tipo" value="servico" defaultChecked={regra?.tipo === 'servico'} /> Serviços (um nível só)
        </label>
      </fieldset>
      <Campo rotulo="Base do primeiro nível" obrigatorio dica="Entre as áreas (ou entre os serviços, se escolheu serviços).">
        {seleciona('base1', regra?.base1)}
      </Campo>
      <Campo rotulo="Base do segundo nível" dica="Só para áreas: como dividir dentro de cada área. Em branco, repete a base do primeiro nível.">
        {seleciona('base2', regra?.base2, 'Igual ao primeiro nível')}
      </Campo>
      <fieldset className="text-sm">
        <legend className="font-semibold">Participantes (marque as áreas ou os serviços da regra escolhida acima)</legend>
        <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
          {cad.opcoes.areas.map((a) => (
            <label key={`a-${a.codigo}`} className="flex items-center gap-2">
              <input type="checkbox" name="participantes" value={a.codigo} defaultChecked={regra?.tipo === 'area' && regra.participantes.includes(a.codigo)} /> Área: {a.nome}
            </label>
          ))}
          {cad.opcoes.servicos.map((s) => (
            <label key={`s-${s.codigo}`} className="flex items-center gap-2">
              <input type="checkbox" name="participantes" value={s.codigo} defaultChecked={regra?.tipo === 'servico' && regra.participantes.includes(s.codigo)} /> {s.nome}
              <span className="text-xs text-texto-suave">({s.areaNome}{s.tipo !== 'direto' ? ' · apoio/adm.' : ''})</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-texto-suave">Marque só áreas, ou só serviços, de acordo com “Quem participa”.</p>
      </fieldset>
    </>
  );
}

export default async function Regras({ searchParams }: { searchParams: Promise<{ editar?: string; ano?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const quem = usuario.autorizador;
  const app = await obterAplicacao();
  const cad = await listarRegras(app.planilhas, quem);
  const podeEditar = quem.temPermissao('orcamento.parametros.editar');
  const emEdicao = podeEditar && editar ? cad.regras.ativas.find((r) => r.id === editar) : undefined;
  const previa = emEdicao
    ? await previaDaRegra(app.planilhas, quem, { id: emEdicao.id, nome: emEdicao.nome, tipo: emEdicao.tipo, base1: emEdicao.base1, base2: emEdicao.base2, participantes: emEdicao.participantes }, new Date().getFullYear()).catch(() => null)
    : null;
  const descreve = (r: RegraLida) =>
    `${nomeDaBase(r.base1, cad.bases.ativas)}${r.base2 ? ` → ${nomeDaBase(r.base2, cad.bases.ativas)}` : ''}`;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Regras de rateio' }]}
        titulo="Regras de rateio"
        descricao="Cada despesa comum tem a sua lógica: energia entre todas as áreas, alimentação só onde há refeição. A regra diz quem participa e por qual base o valor se divide. Escolha a regra no grupo de gasto (padrão), no item ou no serviço de apoio/administrativo. Quem não escolher regra continua com a base da Análise por área."
        acoes={
          podeEditar ? (
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Adicionar regra
                </>
              }
              className={pequeno}
              titulo="Adicionar regra de rateio"
              larga
            >
              <form action={acaoSalvarRegra} className="space-y-4">
                <CamposRegra cad={cad} />
                <BotaoEnviar enviando="Salvando…" className="w-full">
                  Adicionar regra
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          ) : undefined
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/regras" titulo={`Alterar “${emEdicao.nome}”`} larga>
          <form action={acaoSalvarRegra} className="space-y-4">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="versao" value={emEdicao.versao} />
            <CamposRegra regra={emEdicao} cad={cad} />
            {previa && (
              <div className="rounded-cartao border border-borda px-4 py-3 text-sm">
                <p className="font-semibold">Como fica hoje (exemplo: {reais(previa.exemplo)})</p>
                <ul className="mt-1">
                  {previa.linhas.map((l) => (
                    <li key={l.codigo}>
                      {l.nome}: {reais(l.valor)} ({(l.percentual * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-texto-suave">Base usada: {previa.baseUsada}. Salve para ver a prévia com as mudanças.</p>
              </div>
            )}
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar alterações
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <Secao titulo="Regras cadastradas">
        <TabelaDados
          legenda="Regras de rateio"
          vazio="Nenhuma regra cadastrada. Sem regra, vale a base escolhida na Análise por área."
          colunas={[
            { chave: 'nome', rotulo: 'Regra' },
            { chave: 'base', rotulo: 'Base' },
            { chave: 'quem', rotulo: 'Participantes' },
            { chave: 'uso', rotulo: 'Em uso' },
            ...(podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' }] : []),
          ]}
          linhas={cad.regras.ativas.map((r) => {
            const usos = r.uso.grupos + r.uso.itens + r.uso.servicos;
            return {
              id: r.id,
              valores: { nome: r.nome, base: descreve(r), quem: r.participantesNomes.join(', '), uso: `${r.uso.grupos} grupos · ${r.uso.itens} itens · ${r.uso.servicos} serviços` },
              celulas: {
                nome: <span className="font-semibold">{r.nome}</span>,
                quem: (
                  <span>
                    <Etiqueta tipo="info">{r.tipo === 'area' ? 'Áreas' : 'Serviços'}</Etiqueta> {r.participantesNomes.join(', ')}
                  </span>
                ),
                acoes: (
                  <div className="flex justify-end gap-1">
                    <LinkBotao href={`/orcamento/previsao/regras?editar=${r.id}`} scroll={false} variante="icone" aria-label={`Alterar ${r.nome}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    <FormularioConfirmado
                      acao={acaoExcluirRegra}
                      campos={{ id: r.id, versao: r.versao }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Excluir ${r.nome}`}
                      variante="icone-perigo"
                      titulo={`Excluir a regra “${r.nome}”?`}
                      mensagem={
                        usos > 0
                          ? `${r.uso.grupos} grupos, ${r.uso.itens} itens e ${r.uso.servicos} serviços usam esta regra. Troque a regra neles antes de excluir.`
                          : 'A regra sai das listas. Ela não é apagada: fica em “Regras excluídas” e pode ser reativada.'
                      }
                      confirmar="Excluir regra"
                    />
                  </div>
                ),
              },
            };
          })}
        />
      </Secao>

      {podeEditar && (
        <Excluidos
          titulo="Regras excluídas"
          itens={cad.regras.excluidas.map((r) => ({ id: r.id, versao: r.versao, nome: r.nome }))}
          acao={acaoReativarRegra}
          mensagem="A regra volta a aparecer nas listas."
        />
      )}
    </div>
  );
}
