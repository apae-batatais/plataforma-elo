import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCentros } from '@/modulos/orcamento/aplicacao/analise-area';
import { listarRegras } from '@/modulos/orcamento/aplicacao/regras-rateio';
import { TIPO_CENTRO, type TipoCentro } from '@/modulos/orcamento/dominio/analise-area';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeEditar } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoSalvarCentro } from '../acoes';

export const metadata: Metadata = { title: 'Centros de custo' };
const COR_TIPO: Record<TipoCentro, 'info' | 'neutro' | 'atencao'> = { direto: 'info', indireto: 'neutro', despesa: 'atencao' };

const podeVerRegras = (a: { temPermissao: (p: string) => boolean }) => a.temPermissao('orcamento.painel.ver');

export default async function Centros({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const centros = await listarCentros(app.planilhas, usuario.autorizador);
  const regras = podeVerRegras(usuario.autorizador) ? (await listarRegras(app.planilhas, usuario.autorizador)).regras.ativas : [];
  const podeEditar = usuario.autorizador.temPermissao('orcamento.previsao.editar');
  const emEdicao = podeEditar && editar ? centros.find((c) => c.codigo === editar) : undefined;
  const semClassificacao = centros.filter((c) => !c.classificado).length;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Centros de custo' }]}
        titulo="Centros de custo"
        descricao={
          <>
            Como cada serviço entra na Análise por área: <strong>custo direto</strong> (atende pessoas), <strong>custo indireto</strong> (apoio da área,
            rateado entre os diretos) ou <strong>despesa</strong> (administrativo, rateado entre as áreas). Os profissionais vêm da lotação da folha.
          </>
        }
      />

      {semClassificacao > 0 && podeEditar && (
        <div className="mb-4">
          <Aviso tipo="info">
            {semClassificacao} {semClassificacao === 1 ? 'serviço ainda não foi classificado e conta' : 'serviços ainda não foram classificados e contam'} como custo direto.
          </Aviso>
        </div>
      )}

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara="/orcamento/previsao/centros" titulo={emEdicao.nome} descricao={`Área: ${emEdicao.areaNome}`}>
          <form action={acaoSalvarCentro} className="space-y-4">
            <input type="hidden" name="servico" value={emEdicao.codigo} />
            <fieldset className="text-sm">
              <legend className="font-semibold">Tipo</legend>
              {(Object.keys(TIPO_CENTRO) as TipoCentro[]).map((t) => (
                <label key={t} className="mt-1.5 flex items-center gap-2">
                  <input type="radio" name="tipo" value={t} defaultChecked={emEdicao.tipo === t} required /> {TIPO_CENTRO[t]}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Atendidos" dica={emEdicao.vagas !== null ? `Vagas: ${emEdicao.vagas}` : 'Pessoas ou vagas'}>
                <input name="atendidos" inputMode="numeric" defaultValue={emEdicao.atendidos ?? ''} className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Sessões no ano" dica="Opcional">
                <input name="sessoes" inputMode="numeric" defaultValue={emEdicao.sessoes ?? ''} className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Área (m²)" dica="Opcional">
                <input name="area_m2" inputMode="decimal" defaultValue={emEdicao.m2 ?? ''} className={estiloEntrada} />
              </Campo>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Vagas" dica="Base de rateio “vagas”">
                <input name="vagas" inputMode="numeric" defaultValue={emEdicao.vagas ?? ''} className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Regra de rateio" dica="Só para serviço de apoio ou administrativo: como o custo dele se divide entre os serviços diretos.">
                <select name="regra_rateio_id" defaultValue={emEdicao.regraId ?? ''} className={estiloEntrada}>
                  <option value="">Sem regra (base do painel)</option>
                  {regras.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <p className="text-sm text-texto-suave">Profissionais (pela lotação): {emEdicao.profissionais.toLocaleString('pt-BR')}</p>
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Salvar
            </BotaoEnviar>
          </form>
        </JanelaFormulario>
      )}

      <TabelaDados
        legenda="Centros de custo"
        colunas={[
          { chave: 'nome', rotulo: 'Serviço' },
          { chave: 'area', rotulo: 'Área' },
          { chave: 'tipo', rotulo: 'Tipo' },
          { chave: 'atendidos', rotulo: 'Atendidos', tipo: 'numero', somar: true },
          { chave: 'sessoes', rotulo: 'Sessões/ano', tipo: 'numero', secundaria: true },
          { chave: 'm2', rotulo: 'Área (m²)', tipo: 'numero', secundaria: true },
          { chave: 'vagas', rotulo: 'Vagas', tipo: 'numero', secundaria: true },
          { chave: 'regra', rotulo: 'Regra de rateio', secundaria: true },
          { chave: 'profissionais', rotulo: 'Profissionais', tipo: 'numero', somar: true },
          ...(podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-12' }] : []),
        ]}
        linhas={centros.map((c) => ({
          id: c.codigo,
          valores: {
            nome: c.nome,
            area: c.areaNome,
            tipo: TIPO_CENTRO[c.tipo],
            atendidos: c.atendidos,
            sessoes: c.sessoes,
            m2: c.m2,
            vagas: c.vagas,
            regra: regras.find((r) => r.id === c.regraId)?.nome ?? (c.tipo === 'direto' ? '' : 'Base do painel'),
            profissionais: c.profissionais,
          },
          celulas: {
            nome: <span className="font-semibold">{c.nome}</span>,
            tipo: (
              <>
                <Etiqueta tipo={COR_TIPO[c.tipo]}>{TIPO_CENTRO[c.tipo]}</Etiqueta>
                {!c.classificado && <span className="block text-xs text-texto-suave">padrão</span>}
              </>
            ),
            acoes: (
              <LinkBotao href={`/orcamento/previsao/centros?editar=${c.codigo}`} scroll={false} variante="icone" aria-label={`Alterar ${c.nome}`} title="Alterar">
                <IconeEditar tamanho={16} />
              </LinkBotao>
            ),
          },
        }))}
      />
    </div>
  );
}
