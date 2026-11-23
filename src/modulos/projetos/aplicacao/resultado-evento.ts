/**
 * Resultado do evento de captação e comparação com as edições da série (regras L18, L19 e L21).
 * O Orçamento é o dono dos valores: o Projetos lê pelo leitor que a plataforma entrega (com a permissão do Orçamento)
 * e guarda, ao encerrar, só uma fotografia (receita, custo e lançamentos), sem dado pessoal.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Encerramento, Projetos } from '../dados/tabelas';
import { ITEM_RESULTADO_EVENTO } from '../dominio/encerramento';
import { compararEdicoes, fotografiaDoTexto, fotografiaEmTexto, mesmaSerie, resultadoDoEvento, rotularEdicoes, type EdicaoDaSerie } from '../dominio/evento';
import { auditar, autoriaDe, equipesAtivas, lerConfig, podeVerProjeto, type Opcoes } from './comum';
import type { LeitorResultado } from './catalogo-orcamento';

/** Etapas em que o resultado já faz sentido: o evento já gasta e recebe. */
const ETAPAS_COM_RESULTADO = new Set(['implementacao', 'encerramento', 'em_porta', 'encerrado']);

/**
 * Grava (ou atualiza, até o projeto ser encerrado) a fotografia do resultado do evento. Nunca lança por causa do
 * Orçamento: sem leitor, sem permissão ou com falha, a fotografia que já existia continua. Devolve se gravou.
 */
export async function fotografarResultadoDoEvento(p: Planilhas, quem: Autorizador, projetoId: string, leitor: LeitorResultado | null | undefined, opcoes: Opcoes = {}): Promise<boolean> {
  const agora = opcoes.agora ?? new Date();
  const [projetos, linhas] = await lerTabelas(p, [Projetos, Encerramento] as const);
  const r = projetos.porId(projetoId);
  if (!r || r.tipo !== 'captacao' || !leitor) return false;
  let lida;
  try {
    lida = await leitor(quem, projetoId);
  } catch {
    return false;
  }
  if (lida.estado !== 'ok') return false;
  const texto = fotografiaEmTexto({ receita: lida.dados.receita, custo: lida.dados.custo, lancamentos: lida.dados.lancamentos }, agora.toISOString());
  const atual = linhas.ativos().find((x) => x.projeto_id === projetoId && x.item === ITEM_RESULTADO_EVENTO);
  if (!atual) {
    const campos = { projeto_id: projetoId, item: ITEM_RESULTADO_EVENTO, feito: true, data: agora.toISOString().slice(0, 10), feito_por: quem.email, texto };
    const novo = await inserir(p, Encerramento, campos, autoriaDe(quem, agora));
    await auditar(p, quem, 'inclusao', 'Encerramento', novo.id, Object.keys(campos), agora);
  } else {
    const { colunasAlteradas } = await atualizar(p, Encerramento, atual.id, atual.versao, { data: agora.toISOString().slice(0, 10), feito_por: quem.email, texto }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Encerramento', atual.id, colunasAlteradas, agora);
  }
  return true;
}

export interface ResultadoDoEvento {
  /** Só evento de captação, de implementação em diante, tem este cartão. */
  aplica: boolean;
  serie: string | null;
  /**
   * `ok`: números disponíveis; `sem_permissao`: a pessoa não vê o Orçamento; `indisponivel`: Orçamento desligado ou
   * sem resposta e sem fotografia.
   */
  estado: 'ok' | 'sem_permissao' | 'indisponivel';
  /** Edição ainda em andamento: os números são do momento e ficam fora da comparação. */
  parcial: boolean;
  /** Os números vêm da fotografia do encerramento. */
  daFotografia: boolean;
  receita: number;
  custo: number;
  resultado: number;
  lancamentos: number;
  rotulo: string;
  /** Edições anteriores encerradas que a pessoa vê, da mais antiga para a mais recente (só com números). */
  anteriores: EdicaoDaSerie[];
  comparacao: ReturnType<typeof compararEdicoes>;
}

const VAZIO: ResultadoDoEvento = {
  aplica: false,
  serie: null,
  estado: 'indisponivel',
  parcial: false,
  daFotografia: false,
  receita: 0,
  custo: 0,
  resultado: 0,
  lancamentos: 0,
  rotulo: '',
  anteriores: [],
  comparacao: { anterior: null, variacao: null, melhor: null },
};

/** Lê o cartão "Resultado do evento". `null` se a pessoa não vê o projeto. */
export async function lerResultadoDoEvento(p: Planilhas, quem: Autorizador, projetoId: string, leitor: LeitorResultado | null | undefined): Promise<ResultadoDoEvento | null> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const [[projetos, linhas], config, equipes] = await Promise.all([lerTabelas(p, [Projetos, Encerramento] as const), lerConfig(p), equipesAtivas(p)]);
  const r = projetos.porId(projetoId);
  if (!r || !r.ativo || !podeVerProjeto(quem, r, config, equipes.get(r.id))) return null;
  if (r.tipo !== 'captacao' || !ETAPAS_COM_RESULTADO.has(r.etapa)) return VAZIO;
  const encerrado = r.etapa === 'encerrado';
  const fotografias = new Map(linhas.ativos().filter((x) => x.item === ITEM_RESULTADO_EVENTO).map((x) => [x.projeto_id, fotografiaDoTexto(x.texto)] as const));
  const base: ResultadoDoEvento = { ...VAZIO, aplica: true, serie: r.serie_evento, parcial: !encerrado, rotulo: (r.data_evento ?? '').slice(0, 4) };

  // A permissão é do Orçamento (`orcamento.painel.ver`): o leitor responde por ela, e só com a resposta "ok" os
  // valores (inclusive os fotografados) aparecem. Leitor ausente ou com falha = ligação indisponível.
  let lida: Awaited<ReturnType<LeitorResultado>> | null = null;
  if (leitor) {
    try {
      lida = await leitor(quem, r.id);
    } catch {
      lida = null;
    }
  }
  if (lida?.estado === 'sem_permissao') return { ...base, estado: 'sem_permissao' };
  if (lida?.estado !== 'ok') return { ...base, estado: 'indisponivel' };
  const foto = fotografias.get(r.id);
  const daFotografia = encerrado && !!foto;
  const numeros = daFotografia && foto ? foto : { receita: lida.dados.receita, custo: lida.dados.custo, lancamentos: lida.dados.lancamentos };

  const resultado = resultadoDoEvento(numeros);
  // Comparação (L19): só edições encerradas, com fotografia e lançamentos, que a pessoa vê.
  const brutas = r.serie_evento
    ? projetos
        .ativos()
        .filter((x) => x.id !== r.id && x.tipo === 'captacao' && x.etapa === 'encerrado' && mesmaSerie(x.serie_evento, r.serie_evento) && x.data_evento && podeVerProjeto(quem, x, config, equipes.get(x.id)))
        .flatMap((x) => {
          const f = fotografias.get(x.id);
          return f && f.lancamentos > 0 ? [{ projetoId: x.id, codigo: x.codigo, dataEvento: x.data_evento as string, receita: f.receita, custo: f.custo, lancamentos: f.lancamentos, resultado: resultadoDoEvento(f) }] : [];
        })
        .sort((a, b) => a.dataEvento.localeCompare(b.dataEvento))
    : [];
  // A edição atual entra na rotulagem para que um ano repetido seja reconhecido.
  const rotuladas = rotularEdicoes([...brutas, { projetoId: r.id, codigo: r.codigo, dataEvento: r.data_evento ?? '0000-00-00' }]);
  const rotuloAtual = rotuladas[rotuladas.length - 1].rotulo;
  const anteriores = rotuladas.slice(0, -1).map((e, i) => ({ ...brutas[i], rotulo: e.rotulo }));
  const antes = anteriores.filter((e) => !r.data_evento || e.dataEvento < r.data_evento);
  return {
    ...base,
    estado: 'ok',
    daFotografia,
    receita: numeros.receita,
    custo: numeros.custo,
    lancamentos: numeros.lancamentos,
    resultado,
    rotulo: rotuloAtual,
    anteriores: antes,
    comparacao: numeros.lancamentos > 0 ? compararEdicoes({ rotulo: rotuloAtual, resultado }, antes) : { anterior: null, variacao: null, melhor: null },
  };
}
