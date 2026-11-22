import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { compararExercicios } from '@/modulos/orcamento/aplicacao/plano-comparacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Comparar planos de contas' };

export default async function CompararPlanos({ searchParams }: { searchParams: Promise<{ de?: string; para?: string }> }) {
  const q = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const anoAtual = new Date().getFullYear();
  const para = Number(q.para) || anoAtual;
  const de = Number(q.de) || para - 1;
  const c = await compararExercicios(app.planilhas, usuario.autorizador, de, para);
  const href = (nova: { de?: number; para?: number }) => `/orcamento/previsao/plano/comparar?de=${nova.de ?? de}&para=${nova.para ?? para}`;
  const area = (id: string) => c.areas[id]?.nome ?? 'Área';
  const grupo = (id: string) => c.grupos[id]?.nome ?? 'Grupo';
  const item = (id: string) => c.itens[id]?.nome ?? 'Item';

  const x = c.comparacao;
  const linhas = (lista: { chave: string; area?: string; grupo?: string; item?: string; extra?: string }[]): LinhaDados[] =>
    lista.map((l) => ({ id: l.chave, valores: { area: l.area ?? null, grupo: l.grupo ?? null, item: l.item ?? null, extra: l.extra ?? null } }));
  const colunas = (comItem: boolean, comExtra = false) => [
    { chave: 'area', rotulo: 'Área' },
    { chave: 'grupo', rotulo: 'Grupo de Contas' },
    ...(comItem ? [{ chave: 'item', rotulo: 'Item' }] : []),
    ...(comExtra ? [{ chave: 'extra', rotulo: 'Mudou' }] : []),
  ];
  const bloco = (titulo: string, n: number, corpo: React.ReactNode) => (
    <Secao titulo={`${titulo} (${n})`}>{n === 0 ? <p className="text-sm text-texto-suave">Nada em “{titulo.toLowerCase()}”.</p> : corpo}</Secao>
  );

  const entrou = x
    ? [
        ...x.areasEntraram.map((a) => ({ chave: `a|${a}`, area: area(a), grupo: 'Área inteira', item: '' })),
        ...x.gruposEntraram.filter((g) => !x.areasEntraram.includes(g.area_id)).map((g) => ({ chave: `g|${g.area_id}|${g.grupo_id}`, area: area(g.area_id), grupo: grupo(g.grupo_id), item: '' })),
        ...x.itensEntraram.map((i) => ({ chave: `i|${i.area_id}|${i.item_id}`, area: area(i.area_id), grupo: grupo(i.grupo_id), item: item(i.item_id as string) })),
      ]
    : [];
  const saiu = x
    ? [
        ...x.areasSairam.map((a) => ({ chave: `a|${a}`, area: area(a), grupo: 'Área inteira', item: '' })),
        ...x.gruposSairam.filter((g) => !x.areasSairam.includes(g.area_id)).map((g) => ({ chave: `g|${g.area_id}|${g.grupo_id}`, area: area(g.area_id), grupo: grupo(g.grupo_id), item: '' })),
        ...x.itensSairam.map((i) => ({ chave: `i|${i.area_id}|${i.item_id}`, area: area(i.area_id), grupo: grupo(i.grupo_id), item: item(i.item_id as string) })),
      ]
    : [];
  const mudou = x
    ? x.mudaramDeGrupo.map((m) => ({ chave: `m|${m.area_id}|${m.item_id}`, area: area(m.area_id), grupo: grupo(m.para_grupo_id), item: item(m.item_id), extra: `de ${grupo(m.de_grupo_id)} para ${grupo(m.para_grupo_id)}` }))
    : [];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Plano de contas', href: '/orcamento/previsao/plano' }, { rotulo: 'Comparar exercícios' }]}
        titulo={`Comparar ${para} com ${de}`}
        descricao="O que entrou e o que saiu do plano de contas, usando o plano que valia no fim de cada exercício. Só leitura."
        acoes={
          <>
            <span className="text-sm text-texto-suave">Comparar</span>
            <SeletorAno anos={c.anos} atual={para} href={(a) => href({ para: a })} />
            <span className="text-sm text-texto-suave">com</span>
            <SeletorAno anos={c.anos} atual={de} href={(a) => href({ de: a })} />
          </>
        }
      />

      {de === para ? (
        <EstadoVazio titulo="Escolha dois exercícios diferentes.">Os dois seletores estão no mesmo ano.</EstadoVazio>
      ) : !x ? (
        <EstadoVazio
          titulo={`${c.semPlano.antes && c.semPlano.depois ? `${de} e ${para} ainda não têm` : c.semPlano.antes ? `${de} ainda não tem` : `${para} ainda não tem`} plano de contas.`}
          acao={<LinkBotao href={`/orcamento/previsao/plano?ano=${c.semPlano.antes ? de : para}`} className={pequeno} variante="fantasma">Abrir o plano</LinkBotao>}
        >
          Só dá para comparar quando os dois exercícios têm plano.
        </EstadoVazio>
      ) : x.iguais ? (
        <EstadoVazio titulo="Os dois planos são iguais.">Nenhuma área, grupo ou item entrou, saiu ou mudou entre {de} e {para}.</EstadoVazio>
      ) : (
        <>
          <p className="text-[1.05rem]">
            <strong>
              Em {para}: {entrou.length} {entrou.length === 1 ? 'entrada' : 'entradas'}, {saiu.length} {saiu.length === 1 ? 'saída' : 'saídas'}, {mudou.length} {mudou.length === 1 ? 'mudança' : 'mudanças'} de grupo
            </strong>{' '}
            em relação a {de}.
          </p>
          {bloco('Entrou', entrou.length, <TabelaDados colunas={colunas(true)} linhas={linhas(entrou)} legenda="Entrou no plano" />)}
          {bloco('Saiu', saiu.length, <TabelaDados colunas={colunas(true)} linhas={linhas(saiu)} legenda="Saiu do plano" />)}
          {bloco('Mudou de grupo', mudou.length, <TabelaDados colunas={colunas(true, true)} linhas={linhas(mudou)} legenda="Mudou de grupo" />)}
        </>
      )}
    </div>
  );
}
