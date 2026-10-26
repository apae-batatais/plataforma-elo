/**
 * Dados FICTÍCIOS do Núcleo, para o modo local, a demonstração e as prévias.
 *
 * - Nomes inventados por gerador com semente fixa: sempre os mesmos dados.
 * - CPF e NIS ficam vazios.
 * - Usuários têm identificadores FIXOS, para que a escolha de usuário na tela
 *   de entrada valha em qualquer servidor da demonstração.
 *
 * Trava de segurança: só grava em banco vazio (que passa a ser marcado como
 * "demonstracao") ou já marcado como "demonstracao". Banco de "producao" é recusado.
 */
import { Faker, pt_BR, base } from '@faker-js/faker';
import { lerAmbiente, type ExecutorSql } from './executor';

export const SERVICOS_FICTICIOS = [
  { codigo: 'ur', nome: 'Unidade Referenciada (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: null, atendidos: 12 },
  { codigo: 'centro_dia_intergeracional', nome: 'Centro Dia Intergeracional (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: 80, atendidos: 8 },
  { codigo: 'servico_domicilio', nome: 'Serviço no Domicílio (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: 40, atendidos: 5 },
  { codigo: 'cer_reabilitacao', nome: 'Reabilitação CER (exemplo)', eixo: 'saude', unidade: 'cer', area: 'saude', vagas: null, atendidos: 6 },
  { codigo: 'escola', nome: 'Escola (exemplo)', eixo: 'educacao', unidade: 'sede', area: 'educacao', vagas: null, atendidos: 6 },
] as const;

export const USUARIOS_FICTICIOS = [
  { id: '00000000-0000-4000-8000-000000000001', nome: 'Diretoria (fictícia)', email: 'diretoria@exemplo.local', perfil: 'diretoria', escopo: null },
  { id: '00000000-0000-4000-8000-000000000002', nome: 'Administração da Plataforma (fictícia)', email: 'admin@exemplo.local', perfil: 'administrador_plataforma', escopo: null },
  { id: '00000000-0000-4000-8000-000000000003', nome: 'Financeiro (fictício)', email: 'financeiro@exemplo.local', perfil: 'financeiro', escopo: null },
  { id: '00000000-0000-4000-8000-000000000004', nome: 'Coordenação UR (fictícia)', email: 'coord.ur@exemplo.local', perfil: 'coordenacao_servico', escopo: 'ur' },
  { id: '00000000-0000-4000-8000-000000000005', nome: 'Técnico CER (fictício)', email: 'tecnico.cer@exemplo.local', perfil: 'tecnico_avaliador', escopo: 'cer_reabilitacao' },
  { id: '00000000-0000-4000-8000-000000000006', nome: 'Conselho, somente leitura (fictício)', email: 'leitura@exemplo.local', perfil: 'leitura', escopo: null },
] as const;

const PARENTESCOS = ['mãe', 'pai', 'avó', 'avô', 'tia', 'irmã'];

export interface ResumoDadosFicticios {
  servicos: number;
  atendidos: number;
  usuarios: number;
  /** false quando o banco de demonstração já tinha os dados (nada foi gravado). */
  gravado: boolean;
}

/**
 * Popula um banco já migrado com os dados fictícios, em uma transação.
 * O executor deve usar uma única conexão.
 */
export async function popularDadosFicticios(pg: ExecutorSql): Promise<ResumoDadosFicticios> {
  const resumo = { servicos: SERVICOS_FICTICIOS.length, usuarios: USUARIOS_FICTICIOS.length };
  const tipo = await lerAmbiente(pg);
  if (tipo === 'producao') {
    throw new Error('Recusado: este banco é de PRODUÇÃO. Dados fictícios nunca são gravados nele.');
  }
  if (tipo === 'demonstracao') {
    const { rows } = await pg.query(`select 1 from core.usuario where id = $1`, [USUARIOS_FICTICIOS[0].id]);
    if (rows.length > 0) return { ...resumo, atendidos: 0, gravado: false };
  } else {
    const { rows } = await pg.query(`select count(*)::int as n from core.pessoa`);
    if ((rows[0] as { n: number }).n > 0) {
      throw new Error('Recusado: o banco já tem pessoas cadastradas e não está marcado como demonstração.');
    }
  }

  await pg.exec('begin');
  try {
    const atendidos = await gravar(pg, tipo === null);
    await pg.exec('commit');
    return { ...resumo, atendidos, gravado: true };
  } catch (erro) {
    await pg.exec('rollback');
    throw erro;
  }
}

async function gravar(pg: ExecutorSql, marcarAmbiente: boolean): Promise<number> {
  if (marcarAmbiente) await pg.query(`insert into core.ambiente (tipo) values ('demonstracao')`);
  const faker = new Faker({ locale: [pt_BR, base], seed: 2027 });
  const um = async (sql: string, params: unknown[] = []) =>
    ((await pg.query<{ id: string }>(sql, params)).rows[0] as { id: string }).id;

  const servicoIds: Record<string, string> = {};
  for (const s of SERVICOS_FICTICIOS) {
    servicoIds[s.codigo] = await um(
      `insert into core.servico (codigo, nome, eixo, unidade_id, area_id, vagas, inicio)
       select $1, $2, $3, u.id, a.id, $6, date '2026-01-01'
         from core.unidade u, core.area a where u.codigo = $4 and a.codigo = $5
       returning id`,
      [s.codigo, s.nome, s.eixo, s.unidade, s.area, s.vagas],
    );
  }

  let atendidos = 0;
  for (const s of SERVICOS_FICTICIOS) {
    for (let i = 0; i < s.atendidos; i++) {
      const sexo = faker.helpers.arrayElement(['female', 'male'] as const);
      const atendido = await um(
        `insert into core.pessoa (nome, data_nascimento, endereco) values ($1, $2, $3) returning id`,
        [
          faker.person.fullName({ sex: sexo }),
          faker.date.birthdate({ min: 3, max: 80, mode: 'age', refDate: '2026-10-01' }).toISOString().slice(0, 10),
          JSON.stringify({ cidade: 'Batatais', uf: 'SP', bairro: faker.location.street() }),
        ],
      );
      await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'atendido')`, [atendido]);
      await pg.query(`insert into core.vinculo_servico (pessoa_id, servico_id, entrada) values ($1, $2, $3)`, [
        atendido,
        servicoIds[s.codigo],
        faker.date.between({ from: '2020-01-01', to: '2026-09-30' }).toISOString().slice(0, 10),
      ]);

      const familiar = await um(`insert into core.pessoa (nome, telefone) values ($1, $2) returning id`, [
        faker.person.fullName(),
        `16 9${faker.string.numeric(4)}-${faker.string.numeric(4)}`,
      ]);
      await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'familiar')`, [familiar]);
      await pg.query(
        `insert into core.vinculo_familiar (pessoa_id, relacionado_id, parentesco, responsavel_legal, cuidador_principal)
         values ($1, $2, $3, true, true)`,
        [atendido, familiar, faker.helpers.arrayElement(PARENTESCOS)],
      );
      atendidos++;
    }
  }

  for (const u of USUARIOS_FICTICIOS) {
    const pessoa = await um(`insert into core.pessoa (nome, email) values ($1, $2) returning id`, [u.nome, u.email]);
    await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'colaborador')`, [pessoa]);
    await pg.query(`insert into auth.users (id, email) values ($1, $2)`, [u.id, u.email]);
    await pg.query(`insert into core.usuario (id, pessoa_id, email) values ($1, $2, $3)`, [u.id, pessoa, u.email]);
    await pg.query(
      `insert into core.atribuicao (usuario_id, perfil_id, escopo_tipo, escopo_id)
       select $1, p.id, $3, $4 from core.perfil p where p.codigo = $2`,
      [u.id, u.perfil, u.escopo ? 'servico' : 'global', u.escopo ? servicoIds[u.escopo] : null],
    );
  }

  return atendidos;
}
