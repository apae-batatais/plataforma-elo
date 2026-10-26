/**
 * Esquema tipado do Núcleo para consultas com Drizzle.
 *
 * A fonte da verdade do banco são as migrações SQL em `supabase/migrations/`
 * (ADR-009). Este arquivo espelha aquelas tabelas para dar tipos às consultas.
 * Ao mudar uma migração, atualize este arquivo no mesmo commit; o teste
 * `schema-espelho.test.ts` falha se uma coluna daqui não existir no banco.
 */
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const core = pgSchema('core');

const carimbos = {
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  criadoPor: uuid('criado_por'),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }),
  atualizadoPor: uuid('atualizado_por'),
};

export const EIXOS = ['assistencia_social', 'educacao', 'saude'] as const;
export const PAPEIS = ['atendido', 'familiar', 'colaborador', 'voluntario', 'doador', 'parceiro'] as const;
export const ESCOPOS = ['global', 'unidade', 'area', 'servico'] as const;
export const SIGILOS = ['interno', 'pessoal', 'sensivel'] as const;

export type Eixo = (typeof EIXOS)[number];
export type Papel = (typeof PAPEIS)[number];
export type EscopoTipo = (typeof ESCOPOS)[number];
export type Sigilo = (typeof SIGILOS)[number];

// Organização ---------------------------------------------------------
export const unidade = core.table('unidade', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nome: text('nome').notNull(),
  ativa: boolean('ativa').notNull().default(true),
  ...carimbos,
});

export const area = core.table('area', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nome: text('nome').notNull(),
  ativa: boolean('ativa').notNull().default(true),
  ...carimbos,
});

export const servico = core.table('servico', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nome: text('nome').notNull(),
  eixo: text('eixo', { enum: EIXOS }).notNull(),
  unidadeId: uuid('unidade_id').notNull(),
  areaId: uuid('area_id'),
  vagas: integer('vagas'),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  ...carimbos,
});

// Pessoas -------------------------------------------------------------
export const pessoa = core.table('pessoa', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  nomeSocial: text('nome_social'),
  dataNascimento: date('data_nascimento'),
  cpf: text('cpf'),
  nis: text('nis'),
  email: text('email'),
  telefone: text('telefone'),
  endereco: jsonb('endereco'),
  ativa: boolean('ativa').notNull().default(true),
  ...carimbos,
});

export const papelPessoa = core.table('papel_pessoa', {
  id: uuid('id').primaryKey().defaultRandom(),
  pessoaId: uuid('pessoa_id').notNull(),
  papel: text('papel', { enum: PAPEIS }).notNull(),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  ...carimbos,
});

export const vinculoFamiliar = core.table('vinculo_familiar', {
  id: uuid('id').primaryKey().defaultRandom(),
  pessoaId: uuid('pessoa_id').notNull(),
  relacionadoId: uuid('relacionado_id').notNull(),
  parentesco: text('parentesco').notNull(),
  responsavelLegal: boolean('responsavel_legal').notNull().default(false),
  cuidadorPrincipal: boolean('cuidador_principal').notNull().default(false),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  ...carimbos,
});

export const vinculoServico = core.table('vinculo_servico', {
  id: uuid('id').primaryKey().defaultRandom(),
  pessoaId: uuid('pessoa_id').notNull(),
  servicoId: uuid('servico_id').notNull(),
  entrada: date('entrada').notNull(),
  saida: date('saida'),
  motivoSaida: text('motivo_saida'),
  ...carimbos,
});

// Acesso --------------------------------------------------------------
export const usuario = core.table('usuario', {
  id: uuid('id').primaryKey(),
  pessoaId: uuid('pessoa_id').notNull(),
  email: text('email').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  ...carimbos,
});

export const perfil = core.table('perfil', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  ...carimbos,
});

export const perfilPermissao = core.table(
  'perfil_permissao',
  {
    perfilId: uuid('perfil_id').notNull(),
    permissao: text('permissao').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    criadoPor: uuid('criado_por'),
  },
  (t) => [primaryKey({ columns: [t.perfilId, t.permissao] })],
);

export const atribuicao = core.table('atribuicao', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull(),
  perfilId: uuid('perfil_id').notNull(),
  escopoTipo: text('escopo_tipo', { enum: ESCOPOS }).notNull(),
  escopoId: uuid('escopo_id'),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  ...carimbos,
});

// Documentos, auditoria, eventos, indicadores -------------------------
export const documento = core.table('documento', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  caminhoStorage: text('caminho_storage').notNull(),
  tipo: text('tipo').notNull(),
  donoTipo: text('dono_tipo').notNull(),
  donoId: uuid('dono_id'),
  sigilo: text('sigilo', { enum: SIGILOS }).notNull(),
  ativo: boolean('ativo').notNull().default(true),
  ...carimbos,
});

export const auditoria = core.table('auditoria', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull(),
  usuarioId: uuid('usuario_id'),
  acao: text('acao').notNull(),
  entidade: text('entidade').notNull(),
  registroId: text('registro_id'),
  detalhes: jsonb('detalhes').notNull(),
});

export const eventoDominio = core.table('evento_dominio', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tipo: text('tipo').notNull(),
  versao: integer('versao').notNull(),
  payload: jsonb('payload').notNull(),
  publicadoPor: text('publicado_por').notNull(),
  publicadoEm: timestamp('publicado_em', { withTimezone: true }).notNull(),
  usuarioId: uuid('usuario_id'),
});

export const eventoEntrega = core.table(
  'evento_entrega',
  {
    eventoId: bigint('evento_id', { mode: 'number' }).notNull(),
    consumidor: text('consumidor').notNull(),
    entregueEm: timestamp('entregue_em', { withTimezone: true }),
    tentativas: integer('tentativas').notNull().default(0),
    ultimoErro: text('ultimo_erro'),
  },
  (t) => [primaryKey({ columns: [t.eventoId, t.consumidor] })],
);

export const indicador = core.table('indicador', {
  codigo: text('codigo').primaryKey(),
  modulo: text('modulo').notNull(),
  nome: text('nome').notNull(),
  unidade: text('unidade').notNull(),
  referencia: jsonb('referencia'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const valorIndicador = core.table('valor_indicador', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  indicadorCodigo: text('indicador_codigo').notNull(),
  periodo: text('periodo').notNull(),
  escopoTipo: text('escopo_tipo', { enum: ESCOPOS }).notNull(),
  escopoId: uuid('escopo_id'),
  valor: numeric('valor').notNull(),
  calculadoEm: timestamp('calculado_em', { withTimezone: true }).notNull(),
});
