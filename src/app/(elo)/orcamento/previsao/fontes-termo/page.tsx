import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarFontesDosTermos, type LinhaFonteDoTermo } from '@/modulos/orcamento/aplicacao/fontes-termo';
import { ORIGEM_FOLHA, origemDoGrupo } from '@/modulos/orcamento/dominio/fontes-termo';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoParcerias } from '@/plataforma/catalogos';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoSalvarLigacaoFonteTermo, acaoSalvarOrigensDoPlano } from '../acoes';

export const metadata: Metadata = { title: 'Fontes dos termos' };

const SITUACAO = {
  sem_ligacao: { tipo: 'atencao', texto: 'Sem ligação' },
  ligada: { tipo: 'sucesso', texto: 'Ligada' },
  nao_combina: { tipo: 'erro', texto: 'Conta e fonte não combinam' },
} as const;

export default async function FontesDosTermos({ searchParams }: { searchParams: Promise<{ categorias?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const quem = usuario.autorizador;
  const app = await obterAplicacao();
  const dados = await listarFontesDosTermos(app.planilhas, quem, catalogoParcerias(app.planilhas));
  const podeEditar = quem.temPermissao('orcamento.parametros.editar');
  const { opcoes } = dados;
  const nomeDoGrupo = new Map(opcoes.grupos.map((g) => [g.id, g.nome]));
  const emPlano: LinhaFonteDoTermo | undefined = sp.categorias ? dados.linhas.find((l) => l.fonteTermoId === sp.categorias) : undefined;
  const rotuloOrigem = (o: string) => (o === ORIGEM_FOLHA ? 'Folha de pessoal' : (nomeDoGrupo.get(o.replace('grupo:', '')) ?? 'Grupo excluído'));

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Fontes dos termos' }]}
        titulo="Fontes dos termos"
        descricao="Cada fonte de um termo (lida de Parcerias) precisa ser ligada a uma Fonte do cadastro, que diz se o recurso é público ou próprio, livre ou restrito, e à conta vinculada onde o repasse entra."
      />

      {dados.linhas.length === 0 ? (
        <EstadoVazio titulo="Nenhum termo em vigor">Cadastre o termo em Parcerias para ligar as fontes aqui.</EstadoVazio>
      ) : (
        <>
          {dados.semLigacao > 0 && (
            <Aviso tipo="atencao" titulo={`${dados.semLigacao} ${dados.semLigacao === 1 ? 'fonte de termo ainda sem ligação' : 'fontes de termos ainda sem ligação'}`}>
              Fonte de termo sem ligação não aparece no rateio das despesas.
            </Aviso>
          )}
          {!podeEditar && <Aviso tipo="info">Só o Financeiro liga as fontes.</Aviso>}
          <TabelaDados
            legenda="Fontes dos termos em vigor"
            vazio="Nenhuma fonte."
            colunas={[
              { chave: 'termo', rotulo: 'Termo' },
              { chave: 'fonte', rotulo: 'Fonte do termo' },
              { chave: 'valor', rotulo: 'Valor atual', tipo: 'moeda' },
              { chave: 'ligacao', rotulo: 'Fonte do cadastro e conta vinculada', fixa: true, largura: 'min-w-[22rem]' },
              { chave: 'situacao', rotulo: 'Situação' },
              { chave: 'plano', rotulo: 'Plano de aplicação', fixa: true },
            ]}
            linhas={dados.linhas.map((l) => ({
              id: l.fonteTermoId,
              valores: { termo: l.termo, fonte: l.fonte, valor: l.valorAtual, situacao: SITUACAO[l.situacao].texto },
              celulas: {
                valor: <span className="tabular-nums">{reais(l.valorAtual)}</span>,
                ligacao: (
                  <form action={acaoSalvarLigacaoFonteTermo} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="fonte_termo" value={l.fonteTermoId} />
                    <input type="hidden" name="versao" value={l.versao} />
                    <label className="block text-xs font-semibold">
                      Fonte do cadastro
                      <select name="fonte" required disabled={!podeEditar} defaultValue={l.fonteId ?? ''} className={`${estiloEntrada} !mt-1 min-w-44`}>
                        <option value="" disabled>
                          Escolha…
                        </option>
                        {opcoes.fontes.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold">
                      Conta vinculada
                      <select name="conta" disabled={!podeEditar} defaultValue={l.contaId ?? ''} className={`${estiloEntrada} !mt-1 min-w-44`}>
                        <option value="">Sem conta</option>
                        {opcoes.contas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.rotulo}
                          </option>
                        ))}
                      </select>
                    </label>
                    {podeEditar && <BotaoEnviar enviando="Salvando…" className={pequeno}>Salvar ligação</BotaoEnviar>}
                  </form>
                ),
                situacao: (
                  <div className="space-y-1">
                    <Etiqueta tipo={SITUACAO[l.situacao].tipo}>{SITUACAO[l.situacao].texto}</Etiqueta>
                    {l.contaRepetidaCom.length > 0 && <p className="text-xs text-aviso">A mesma conta também está em: {l.contaRepetidaCom.join('; ')}.</p>}
                  </div>
                ),
                plano: l.categorias.length ? (
                  <LinkBotao href={`/orcamento/previsao/fontes-termo?categorias=${l.fonteTermoId}`} scroll={false} variante="fantasma" className={pequeno}>
                    Categorias ({l.categorias.filter((c) => c.origens.length).length}/{l.categorias.length} ligadas)
                  </LinkBotao>
                ) : (
                  <span className="text-texto-suave">Sem plano em Parcerias</span>
                ),
              },
            }))}
          />
        </>
      )}

      {emPlano && (
        <JanelaFormulario
          rotulo={null}
          abrirAoCarregar
          larga
          voltarPara="/orcamento/previsao/fontes-termo"
          titulo={`Plano de aplicação: ${emPlano.fonte}`}
          descricao="Para cada categoria do plano, diga de onde ela vem: um ou mais Grupos de gasto e/ou a Folha de pessoal. Categoria sem origem aparece como “sem categoria no plano” nos avisos das despesas."
        >
          <form action={acaoSalvarOrigensDoPlano} className="space-y-4">
            <input type="hidden" name="fonte_termo" value={emPlano.fonteTermoId} />
            {emPlano.categorias.map((c, i) => (
              <fieldset key={c.categoria} className="rounded-md border border-borda p-3 text-sm">
                <legend className="px-1 font-semibold">
                  {c.categoria} <span className="font-normal text-texto-suave">({reais(c.valor)})</span>
                </legend>
                <input type="hidden" name="categoria" value={c.categoria} />
                {podeEditar ? (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {[ORIGEM_FOLHA, ...opcoes.grupos.map((g) => origemDoGrupo(g.id))].map((o) => (
                      <label key={o} className="flex items-center gap-2">
                        <input type="checkbox" name={`origem_${i}`} value={o} defaultChecked={c.origens.includes(o)} /> {rotuloOrigem(o)}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>{c.origens.length ? c.origens.map(rotuloOrigem).join(', ') : 'Sem categoria no plano'}</p>
                )}
              </fieldset>
            ))}
            {podeEditar ? <BotaoEnviar enviando="Salvando…" className="w-full">Salvar origens</BotaoEnviar> : <p className="text-sm text-texto-suave">Só o Financeiro liga as categorias.</p>}
          </form>
        </JanelaFormulario>
      )}
    </div>
  );
}
