/**
 * Abas do app Projetos (entrega P1), na planilha própria "projetos". Sem dados pessoais de atendidos;
 * as colunas de e-mail são de uso interno da instituição.
 *
 * - Projetos: a ficha da ideia/projeto, do rascunho até a decisão da porta 1.
 * - Portas: cada abertura de porta (uma nova a cada reenvio depois de "ajustar").
 * - Pareceres e Decisoes: o que cada parecerista e cada decisor registrou (nunca editados).
 * - ConfigProjetos: ajustes por instituição (chave e valor em texto).
 * - HistoricoProjetos: cada passo do projeto, só inclusões.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { GRAUS, NIVEIS_MARCO, SITUACOES_RISCO } from '../dominio/fases';
import { SITUACOES_ATIVIDADE } from '../dominio/planejamento';
import { DECISOES, ETAPAS, NIVEIS_DECISAO, PORTES, RESULTADOS_PARECER, SITUACOES_PORTA, TIPOS_PARECER, TIPOS_PORTA, TIPOS_PROJETO } from '../dominio/projeto';

export const PLANILHA_PROJETOS = 'projetos';

export const Projetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Projetos',
  esquema: z.object({
    /** PRJ-0001. */
    codigo: texto(),
    titulo: texto(),
    resumo: texto(),
    tipo: z.enum(TIPOS_PROJETO),
    porte: z.enum(PORTES),
    etapa: z.enum(ETAPAS),
    proponente: texto(),
    responsavel: textoOpcional(),
    /** Código do serviço do Núcleo (opcional). */
    servico: textoOpcional(),
    valor_estimado: numeroOpcional(),
    inicio_previsto: dataOpcional(),
    fim_previsto: dataOpcional(),
    /** Total do Termo de Abertura aprovado na porta 2 (regra de borda 4). */
    valor_aprovado: numeroOpcional(),
  }),
});

export const Portas = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Portas',
  esquema: z.object({
    projeto_id: texto(),
    tipo: z.enum(TIPOS_PORTA),
    situacao: z.enum(SITUACOES_PORTA),
    /** Valor considerado na abertura (regra 8): mudar o limite depois não muda portas abertas. */
    valor_considerado: numeroOpcional(),
    exige_alcada: booleano(),
    /** Tipos de parecer exigidos na abertura, separados por vírgula (pode ficar vazio). */
    pareceres_exigidos: textoOpcional(),
    aberta_em: texto(),
    aberta_por: texto(),
    /** Resultado final (decisão que encerrou a porta). */
    resultado: z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(DECISOES).nullable()),
  }),
});

export const Pareceres = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Pareceres',
  esquema: z.object({
    porta_id: texto(),
    projeto_id: texto(),
    tipo: z.enum(TIPOS_PARECER),
    parecerista: texto(),
    resultado: z.enum(RESULTADOS_PARECER),
    texto: textoOpcional(),
    em: texto(),
  }),
});

export const Decisoes = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Decisoes',
  esquema: z.object({
    porta_id: texto(),
    projeto_id: texto(),
    nivel: z.enum(NIVEIS_DECISAO),
    decisor: texto(),
    decisao: z.enum(DECISOES),
    justificativa: texto(),
    em: texto(),
  }),
});

export const ConfigProjetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ConfigProjetos',
  esquema: z.object({ chave: texto(), valor: textoOpcional() }),
});

export const HistoricoProjetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'HistoricoProjetos',
  modo: 'somente_inclusao',
  esquema: z.object({
    projeto_id: texto(),
    em: texto(),
    usuario: texto(),
    acao: texto(),
    /** Texto livre, nunca o conteúdo de um parecer. */
    comentario: textoOpcional(),
  }),
});

export const ProjetoDocumentos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoDocumentos',
  esquema: z.object({
    projeto_id: texto(),
    /** Um dos TIPOS_DOCUMENTO (dominio/fases.ts). */
    tipo: texto(),
    /** Número da versão do documento (1, 2…); não é a versão da linha. */
    numero: z.coerce.number().int().min(1),
    /** Conteúdo estruturado (JSON validado em dominio/fases.ts). */
    conteudo: texto(),
    situacao: z.enum(['rascunho', 'aprovado', 'substituido']),
    /** Marca "pronto" do próprio documento (não é aprovação). */
    pronto: booleano(),
  }),
});

export const MarcoLogico = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'MarcoLogico',
  esquema: z.object({
    projeto_id: texto(),
    nivel: z.enum(NIVEIS_MARCO),
    ordem: z.coerce.number().int().min(1),
    descricao: texto(),
    indicador: textoOpcional(),
    fonte_verificacao: textoOpcional(),
    pressuposto: textoOpcional(),
    /** Id do item do nível imediatamente acima. */
    acima: textoOpcional(),
  }),
});

export const Riscos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Riscos',
  esquema: z.object({
    projeto_id: texto(),
    descricao: texto(),
    probabilidade: z.enum(GRAUS),
    impacto: z.enum(GRAUS),
    resposta: textoOpcional(),
    dono: textoOpcional(),
    situacao: z.enum(SITUACOES_RISCO),
  }),
});

export const ProjetoEquipe = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoEquipe',
  esquema: z.object({
    projeto_id: texto(),
    email: texto(),
    funcao: texto(),
    inicio: texto(),
    /** Preenchido quando a pessoa sai da equipe (nada é apagado). */
    fim: dataOpcional(),
  }),
});

export const Atividades = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Atividades',
  esquema: z.object({
    projeto_id: texto(),
    descricao: texto(),
    /** E-mail da pessoa responsável (uso interno). */
    responsavel: texto(),
    inicio_previsto: texto(),
    fim_previsto: texto(),
    inicio_real: dataOpcional(),
    fim_real: dataOpcional(),
    /** `atrasada` não é gravada: é calculada pela data (regra 20). */
    situacao: z.enum(SITUACOES_ATIVIDADE),
    /** Peso opcional no andamento do projeto. */
    peso: numeroOpcional(),
  }),
});

export const ProjetoOrcamento = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoOrcamento',
  esquema: z.object({
    projeto_id: texto(),
    categoria: texto(),
    descricao: texto(),
    valor_planejado: z.coerce.number().min(0),
    fonte: textoOpcional(),
    /** Número da versão do Termo de Abertura aprovado quando a linha foi gravada (vazio antes da aprovação). */
    versao_termo: numeroOpcional(),
  }),
});

export const TABELAS_PROJETOS = [Projetos, ProjetoDocumentos, MarcoLogico, Riscos, ProjetoEquipe, Atividades, ProjetoOrcamento, Portas, Pareceres, Decisoes, ConfigProjetos, HistoricoProjetos] as const;

export type RegProjeto = Registro<typeof Projetos.esquema>;
export type RegDocumento = Registro<typeof ProjetoDocumentos.esquema>;
export type RegMarco = Registro<typeof MarcoLogico.esquema>;
export type RegRisco = Registro<typeof Riscos.esquema>;
export type RegEquipe = Registro<typeof ProjetoEquipe.esquema>;
export type RegAtividade = Registro<typeof Atividades.esquema>;
export type RegLinhaOrcamento = Registro<typeof ProjetoOrcamento.esquema>;
export type RegPorta = Registro<typeof Portas.esquema>;
export type RegParecer = Registro<typeof Pareceres.esquema>;
export type RegDecisao = Registro<typeof Decisoes.esquema>;
export type RegConfig = Registro<typeof ConfigProjetos.esquema>;
export type RegHistorico = z.infer<typeof HistoricoProjetos.esquema>;
