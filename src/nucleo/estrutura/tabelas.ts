/**
 * Tabelas do Núcleo, guardadas na planilha "nucleo" e na planilha "auditoria".
 *
 * Referências a unidades, áreas, serviços e perfis usam o CÓDIGO (legível na
 * planilha); referências a pessoas usam o id.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';

export const EIXOS = ['assistencia_social', 'educacao', 'saude'] as const;
export const PAPEIS = ['atendido', 'familiar', 'colaborador', 'voluntario', 'doador', 'parceiro'] as const;
export const ESCOPOS = ['global', 'unidade', 'area', 'servico'] as const;
export type EscopoTipo = (typeof ESCOPOS)[number];

const codigo = () => z.preprocess((v) => String(v ?? '').trim(), z.string().regex(/^[a-z0-9_]+$/, 'código em minúsculas, sem espaços'));

// Organização -------------------------------------------------------------
export const Unidades = definirTabela({
  planilha: 'nucleo',
  aba: 'Unidades',
  esquema: z.object({ codigo: codigo(), nome: texto() }),
});

export const Areas = definirTabela({
  planilha: 'nucleo',
  aba: 'Areas',
  esquema: z.object({ codigo: codigo(), nome: texto() }),
});

export const Servicos = definirTabela({
  planilha: 'nucleo',
  aba: 'Servicos',
  esquema: z.object({
    codigo: codigo(),
    nome: texto(),
    /** Não é mais preenchido (o serviço se liga à área). Mantido para os registros antigos. */
    eixo: z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(EIXOS).nullable()),
    unidade: codigo(),
    area: textoOpcional(),
    vagas: numeroOpcional(),
    inicio: dataOpcional(),
    fim: dataOpcional(),
  }),
});

// Cadastro Único de Pessoas -------------------------------------------------
export const Pessoas = definirTabela({
  planilha: 'nucleo',
  aba: 'Pessoas',
  esquema: z.object({
    nome: texto(),
    nome_social: textoOpcional(),
    data_nascimento: dataOpcional(),
    cpf: textoOpcional(),
    nis: textoOpcional(),
    email: textoOpcional(),
    telefone: textoOpcional(),
    cidade: textoOpcional(),
    bairro: textoOpcional(),
  }),
  sigilo: { data_nascimento: 'pessoal', cpf: 'pessoal', nis: 'pessoal', telefone: 'pessoal', bairro: 'pessoal' },
});

export const Papeis = definirTabela({
  planilha: 'nucleo',
  aba: 'Papeis',
  esquema: z.object({ pessoa_id: texto(), papel: z.enum(PAPEIS), inicio: dataOpcional(), fim: dataOpcional() }),
});

export const VinculosFamiliares = definirTabela({
  planilha: 'nucleo',
  aba: 'VinculosFamiliares',
  esquema: z.object({
    pessoa_id: texto(),
    relacionado_id: texto(),
    parentesco: texto(),
    responsavel_legal: booleano(),
    cuidador_principal: booleano(),
    inicio: dataOpcional(),
    fim: dataOpcional(),
  }),
});

export const VinculosServico = definirTabela({
  planilha: 'nucleo',
  aba: 'VinculosServico',
  esquema: z.object({
    pessoa_id: texto(),
    servico: codigo(),
    entrada: dataOpcional(),
    saida: dataOpcional(),
    motivo_saida: textoOpcional(),
  }),
});

// Acesso -------------------------------------------------------------------
export const Usuarios = definirTabela({
  planilha: 'nucleo',
  aba: 'Usuarios',
  esquema: z.object({ email: z.preprocess((v) => String(v ?? '').trim().toLowerCase(), z.email()), pessoa_id: textoOpcional() }),
});

export const Perfis = definirTabela({
  planilha: 'nucleo',
  aba: 'Perfis',
  esquema: z.object({ codigo: codigo(), nome: texto(), descricao: textoOpcional() }),
});

export const PerfilPermissoes = definirTabela({
  planilha: 'nucleo',
  aba: 'PerfilPermissoes',
  esquema: z.object({
    perfil: codigo(),
    permissao: z.preprocess((v) => String(v ?? '').trim(), z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/)),
  }),
});

export const Atribuicoes = definirTabela({
  planilha: 'nucleo',
  aba: 'Atribuicoes',
  esquema: z.object({
    usuario_email: z.preprocess((v) => String(v ?? '').trim().toLowerCase(), z.email()),
    perfil: codigo(),
    escopo_tipo: z.enum(ESCOPOS),
    escopo: textoOpcional(),
    inicio: dataOpcional(),
    fim: dataOpcional(),
  }),
});

// Encarregado de dados (DPO, LGPD) ---------------------------------------
export const Encarregados = definirTabela({
  planilha: 'nucleo',
  aba: 'Encarregados',
  esquema: z.object({
    nome: texto(),
    tipo: z.enum(['fisica', 'juridica']),
    /** Só dígitos: CPF (11) ou CNPJ (14). */
    documento: texto(),
    email: z.preprocess((v) => String(v ?? '').trim().toLowerCase(), z.email()),
    inicio: dataOpcional(),
    fim: dataOpcional(),
  }),
  sigilo: { documento: 'pessoal' },
});

// Auditoria (planilha própria, somente inclusão) ---------------------------
export const ACOES_AUDITORIA = ['leitura', 'inclusao', 'alteracao', 'encerramento', 'exportacao', 'entrada', 'estrutura'] as const;

export const RegistrosAuditoria = definirTabela({
  planilha: 'auditoria',
  aba: 'Registros',
  modo: 'somente_inclusao',
  esquema: z.object({
    ocorrido_em: texto(),
    usuario: texto(),
    acao: z.enum(ACOES_AUDITORIA),
    entidade: texto(),
    registro_id: textoOpcional(),
    detalhes: textoOpcional(),
  }),
});

export const TABELAS_DO_NUCLEO = [
  Unidades, Areas, Servicos, Pessoas, Papeis, VinculosFamiliares, VinculosServico,
  Usuarios, Perfis, PerfilPermissoes, Atribuicoes, Encarregados, RegistrosAuditoria,
] as const;

// Tipos dos registros ------------------------------------------------------
export type RegServico = Registro<typeof Servicos.esquema>;
export type RegPessoa = Registro<typeof Pessoas.esquema>;
export type RegPapel = Registro<typeof Papeis.esquema>;
export type RegVinculoFamiliar = Registro<typeof VinculosFamiliares.esquema>;
export type RegVinculoServico = Registro<typeof VinculosServico.esquema>;
export type RegUsuario = Registro<typeof Usuarios.esquema>;
export type RegPerfil = Registro<typeof Perfis.esquema>;
export type RegPerfilPermissao = Registro<typeof PerfilPermissoes.esquema>;
export type RegEncarregado = Registro<typeof Encarregados.esquema>;
export type RegAtribuicao = Registro<typeof Atribuicoes.esquema>;
