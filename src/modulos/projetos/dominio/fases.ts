/**
 * Fases 1 e 2 (entrega P2): documentos exigidos por porte, campos de cada documento, marco lógico,
 * riscos e tolerâncias do Termo de Abertura. Regras puras, sem leitura nem gravação.
 */
import { z } from 'zod';
import { ErroProjetos, type Porte } from './projeto';

export const TIPOS_DOCUMENTO = ['necessidade', 'partes_interessadas', 'problema_objetivos', 'estimativas', 'proposta', 'termo_abertura', 'lancamento', 'monitoramento', 'comunicacao', 'compras', 'sustentabilidade'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const NOME_DOCUMENTO: Record<TipoDocumento, string> = {
  necessidade: 'Necessidade',
  partes_interessadas: 'Partes interessadas',
  problema_objetivos: 'Problema e objetivos',
  estimativas: 'Estimativas',
  proposta: 'Proposta',
  termo_abertura: 'Termo de Abertura',
  lancamento: 'Lançamento',
  monitoramento: 'Monitoramento e avaliação',
  comunicacao: 'Comunicação',
  compras: 'Compras',
  sustentabilidade: 'Sustentabilidade e encerramento',
};

/** Itens que também contam para a porta, mas têm tela própria (não são um formulário de documento). */
export type ItemEspecial = 'marco_logico' | 'riscos' | 'atividades' | 'orcamento';
export type ItemDaFase = TipoDocumento | ItemEspecial;
export const NOME_ITEM: Record<ItemDaFase, string> = { ...NOME_DOCUMENTO, marco_logico: 'Marco lógico', riscos: 'Riscos', atividades: 'Atividades', orcamento: 'Orçamento' };

export type NumeroFase = 1 | 2 | 3;

/** Regra 5: o que cada fase exige, por porte. O enxuto traz só o mínimo. */
export const EXIGIDOS: Record<Porte, Record<NumeroFase, ItemDaFase[]>> = {
  completo: {
    1: ['necessidade', 'partes_interessadas', 'problema_objetivos', 'marco_logico', 'estimativas', 'proposta'],
    2: ['termo_abertura', 'riscos', 'lancamento'],
    // O cronograma é a própria lista de atividades com datas (sem Gantt nesta entrega).
    3: ['atividades', 'orcamento', 'monitoramento', 'comunicacao', 'compras', 'sustentabilidade'],
  },
  enxuto: { 1: ['proposta'], 2: ['termo_abertura'], 3: ['atividades'] },
};

export const itensDaFase = (porte: Porte, fase: NumeroFase): ItemDaFase[] => [...EXIGIDOS[porte][fase]];
export const ehDocumento = (i: ItemDaFase): i is TipoDocumento => (TIPOS_DOCUMENTO as readonly string[]).includes(i);

/** Em que fase cada documento é preenchido (a mesma lista vale para os dois portes). */
export function faseDoDocumento(tipo: TipoDocumento): NumeroFase {
  if (tipo === 'monitoramento' || tipo === 'comunicacao' || tipo === 'compras' || tipo === 'sustentabilidade') return 3;
  return tipo === 'termo_abertura' || tipo === 'lancamento' ? 2 : 1;
}

export interface CampoDocumento {
  nome: string;
  rotulo: string;
  dica?: string;
  tipo: 'curto' | 'longo' | 'numero';
  obrigatorio: boolean;
}

export const CAMPOS: Record<TipoDocumento, CampoDocumento[]> = {
  necessidade: [{ nome: 'descricao', rotulo: 'Qual é a necessidade?', dica: 'Quem precisa, de quê e por quê.', tipo: 'longo', obrigatorio: true }],
  partes_interessadas: [
    { nome: 'quem', rotulo: 'Quem é afetado ou pode influenciar o projeto?', dica: 'Uma pessoa ou grupo por linha, com o papel de cada um.', tipo: 'longo', obrigatorio: true },
  ],
  problema_objetivos: [
    { nome: 'problema', rotulo: 'Qual é o problema?', tipo: 'longo', obrigatorio: true },
    { nome: 'objetivo', rotulo: 'O que o projeto quer alcançar?', tipo: 'longo', obrigatorio: true },
  ],
  estimativas: [
    { nome: 'valor_total', rotulo: 'Valor total estimado (R$)', dica: 'ex.: 25000', tipo: 'numero', obrigatorio: true },
    { nome: 'duracao', rotulo: 'Duração estimada', dica: 'ex.: 6 meses', tipo: 'curto', obrigatorio: true },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'longo', obrigatorio: false },
  ],
  proposta: [{ nome: 'descricao', rotulo: 'Proposta resumida', dica: 'O que será feito, para quem e com que resultado.', tipo: 'longo', obrigatorio: true }],
  termo_abertura: [
    { nome: 'objetivo', rotulo: 'Objetivo do projeto', tipo: 'longo', obrigatorio: true },
    { nome: 'escopo', rotulo: 'O que está dentro do projeto', dica: 'Entregas principais. O que não estiver aqui é novo escopo.', tipo: 'longo', obrigatorio: true },
    { nome: 'valor_total', rotulo: 'Valor total do projeto (R$)', dica: 'ex.: 25000. É o valor que a porta 2 considera.', tipo: 'numero', obrigatorio: true },
    { nome: 'tolerancia_custo_linha', rotulo: 'Tolerância de custo por linha do orçamento (%)', dica: 'ex.: 10 para até 10% a mais em uma linha', tipo: 'numero', obrigatorio: true },
    { nome: 'tolerancia_custo_total', rotulo: 'Tolerância de custo no total (%)', dica: 'ex.: 5', tipo: 'numero', obrigatorio: true },
    { nome: 'tolerancia_prazo_fim', rotulo: 'Tolerância de prazo no fim (dias de atraso)', dica: 'ex.: 15', tipo: 'numero', obrigatorio: true },
    { nome: 'tolerancia_prazo_marco', rotulo: 'Tolerância de prazo em cada marco (dias de atraso)', dica: 'ex.: 7', tipo: 'numero', obrigatorio: true },
    { nome: 'escopo_livre', rotulo: 'Escopo livre', dica: 'O que o responsável pode mudar sem pedir à Diretoria. Deixe em branco se nada.', tipo: 'longo', obrigatorio: false },
  ],
  lancamento: [{ nome: 'descricao', rotulo: 'Como o projeto será lançado e comunicado', dica: 'Quem será avisado, quando e como.', tipo: 'longo', obrigatorio: true }],
  monitoramento: [
    { nome: 'como', rotulo: 'Como o andamento e os resultados serão acompanhados?', dica: 'O que será medido, com que frequência e por quem.', tipo: 'longo', obrigatorio: true },
    { nome: 'avaliacao', rotulo: 'Como o projeto será avaliado no fim?', tipo: 'longo', obrigatorio: true },
  ],
  comunicacao: [{ nome: 'plano', rotulo: 'Quem recebe informação do projeto, quando e como', dica: 'ex.: relatório mensal para a Diretoria.', tipo: 'longo', obrigatorio: true }],
  compras: [{ nome: 'plano', rotulo: 'O que será comprado ou contratado e quando', dica: 'Uma compra por linha, com o mês previsto.', tipo: 'longo', obrigatorio: true }],
  sustentabilidade: [
    { nome: 'sustentabilidade', rotulo: 'O que garante que os resultados continuam depois do projeto?', tipo: 'longo', obrigatorio: true },
    { nome: 'encerramento', rotulo: 'Como o projeto será encerrado?', dica: 'O que precisa estar pronto para fechar o projeto.', tipo: 'longo', obrigatorio: true },
  ],
};

export type ConteudoDocumento = Record<string, string | number | null>;

/** Confere o conteúdo gravado contra os campos do documento. Devolve o conteúdo limpo ou lança o erro em português. */
export function validarConteudo(tipo: TipoDocumento, bruto: Record<string, unknown>, paraPronto: boolean): ConteudoDocumento {
  const saida: ConteudoDocumento = {};
  for (const c of CAMPOS[tipo]) {
    const v = bruto[c.nome];
    const vazio = v === undefined || v === null || String(v).trim() === '';
    if (c.tipo === 'numero') {
      if (vazio) {
        if (paraPronto && c.obrigatorio) throw new ErroProjetos(`Preencha: ${c.rotulo}.`);
        saida[c.nome] = null;
        continue;
      }
      const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) throw new ErroProjetos(`${c.rotulo}: use um número igual ou maior que zero.`);
      saida[c.nome] = n;
    } else {
      if (vazio && paraPronto && c.obrigatorio) throw new ErroProjetos(`Preencha: ${c.rotulo}.`);
      saida[c.nome] = vazio ? null : String(v).trim();
    }
  }
  return z.record(z.string(), z.union([z.string(), z.number(), z.null()])).parse(saida);
}

/** Tolerâncias do Termo de Abertura (regra 15). */
export interface Tolerancias {
  custoLinhaPct: number;
  custoTotalPct: number;
  prazoFimDias: number;
  prazoMarcoDias: number;
  escopoLivre: string | null;
}

export const TOLERANCIAS_PADRAO: Tolerancias = { custoLinhaPct: 0, custoTotalPct: 0, prazoFimDias: 0, prazoMarcoDias: 0, escopoLivre: null };

export function toleranciasDoTermo(c: ConteudoDocumento): Tolerancias {
  const n = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : 0);
  return {
    custoLinhaPct: n('tolerancia_custo_linha'),
    custoTotalPct: n('tolerancia_custo_total'),
    prazoFimDias: n('tolerancia_prazo_fim'),
    prazoMarcoDias: n('tolerancia_prazo_marco'),
    escopoLivre: typeof c.escopo_livre === 'string' ? c.escopo_livre : null,
  };
}

// ---------- Marco lógico (regra 7) ----------

export const NIVEIS_MARCO = ['impacto', 'objetivo', 'resultado', 'atividade'] as const;
export type NivelMarco = (typeof NIVEIS_MARCO)[number];
export const NOME_NIVEL: Record<NivelMarco, string> = { impacto: 'Impacto', objetivo: 'Objetivo', resultado: 'Resultado', atividade: 'Atividade' };
/** O nível imediatamente acima de cada nível (o impacto não tem). */
export const NIVEL_ACIMA: Record<NivelMarco, NivelMarco | null> = { impacto: null, objetivo: 'impacto', resultado: 'objetivo', atividade: 'resultado' };

export interface ItemMarco {
  id: string;
  nivel: NivelMarco;
  descricao: string;
  indicador: string | null;
  fonte_verificacao: string | null;
  acima: string | null;
}

/** Regra 7: devolve o que falta (lista vazia = marco lógico completo). */
export function pendenciasDoMarco(itens: readonly ItemMarco[]): string[] {
  const falta: string[] = [];
  for (const nivel of ['impacto', 'objetivo', 'resultado'] as const) {
    if (!itens.some((i) => i.nivel === nivel)) falta.push(`Falta ao menos um item de ${NOME_NIVEL[nivel].toLowerCase()}.`);
  }
  const porId = new Map(itens.map((i) => [i.id, i]));
  for (const i of itens) {
    const nome = `${NOME_NIVEL[i.nivel]} "${i.descricao}"`;
    if (i.nivel !== 'atividade' && (!i.indicador?.trim() || !i.fonte_verificacao?.trim())) falta.push(`${nome}: falta o indicador ou a fonte de verificação.`);
    const esperado = NIVEL_ACIMA[i.nivel];
    if (esperado) {
      const pai = i.acima ? porId.get(i.acima) : undefined;
      if (!pai) falta.push(`${nome}: escolha o item de ${NOME_NIVEL[esperado].toLowerCase()} a que ele pertence.`);
      else if (pai.nivel !== esperado) falta.push(`${nome}: precisa apontar para um item de ${NOME_NIVEL[esperado].toLowerCase()}.`);
    }
  }
  for (const r of itens.filter((i) => i.nivel === 'resultado')) {
    if (!itens.some((i) => i.nivel === 'atividade' && i.acima === r.id)) falta.push(`Resultado "${r.descricao}": falta ao menos uma atividade.`);
  }
  return falta;
}

// ---------- Riscos ----------

export const GRAUS = ['baixo', 'medio', 'alto'] as const;
export type Grau = (typeof GRAUS)[number];
export const NOME_GRAU: Record<Grau, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
export const SITUACOES_RISCO = ['aberto', 'encerrado'] as const;
export type SituacaoRisco = (typeof SITUACOES_RISCO)[number];
