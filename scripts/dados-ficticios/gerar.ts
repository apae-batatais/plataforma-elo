/**
 * Gera dados FICTÍCIOS no banco local (.dados-locais/).
 *
 *   npm run dados:ficticios
 *
 * Recria o banco local do zero. Nunca roda contra um banco real:
 * se DATABASE_URL estiver definida, o script se recusa a executar.
 * Os nomes são inventados (gerador com semente fixa); CPF e NIS ficam vazios.
 */
import { rmSync } from 'node:fs';
import { fakerPT_BR as faker } from '@faker-js/faker';
import { abrirBancoLocal, PASTA_DADOS_LOCAIS } from '../../src/nucleo/db/banco-local';

if (process.env.DATABASE_URL) {
  console.error('Recusado: DATABASE_URL está definida. Dados fictícios só vão para o banco local.');
  process.exit(1);
}

faker.seed(2027);

const SERVICOS = [
  { codigo: 'ur', nome: 'Unidade Referenciada (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: null, atendidos: 12 },
  { codigo: 'centro_dia_intergeracional', nome: 'Centro Dia Intergeracional (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: 80, atendidos: 8 },
  { codigo: 'servico_domicilio', nome: 'Serviço no Domicílio (exemplo)', eixo: 'assistencia_social', unidade: 'sede', area: 'assistencia_social', vagas: 40, atendidos: 5 },
  { codigo: 'cer_reabilitacao', nome: 'Reabilitação CER (exemplo)', eixo: 'saude', unidade: 'cer', area: 'saude', vagas: null, atendidos: 6 },
  { codigo: 'escola', nome: 'Escola (exemplo)', eixo: 'educacao', unidade: 'sede', area: 'educacao', vagas: null, atendidos: 6 },
] as const;

const USUARIOS = [
  { nome: 'Diretoria (fictícia)', email: 'diretoria@exemplo.local', perfil: 'diretoria', escopo: null },
  { nome: 'Administração da Plataforma (fictícia)', email: 'admin@exemplo.local', perfil: 'administrador_plataforma', escopo: null },
  { nome: 'Financeiro (fictício)', email: 'financeiro@exemplo.local', perfil: 'financeiro', escopo: null },
  { nome: 'Coordenação UR (fictícia)', email: 'coord.ur@exemplo.local', perfil: 'coordenacao_servico', escopo: 'ur' },
  { nome: 'Técnico CER (fictício)', email: 'tecnico.cer@exemplo.local', perfil: 'tecnico_avaliador', escopo: 'cer_reabilitacao' },
  { nome: 'Conselho, somente leitura (fictício)', email: 'leitura@exemplo.local', perfil: 'leitura', escopo: null },
] as const;

const PARENTESCOS = ['mãe', 'pai', 'avó', 'avô', 'tia', 'irmã'];

async function main() {
  rmSync(PASTA_DADOS_LOCAIS, { recursive: true, force: true });
  const { pg } = await abrirBancoLocal();
  const um = async (sql: string, params: unknown[] = []) =>
    ((await pg.query<{ id: string }>(sql, params)).rows[0] as { id: string }).id;

  const servicoIds: Record<string, string> = {};
  for (const s of SERVICOS) {
    servicoIds[s.codigo] = await um(
      `insert into core.servico (codigo, nome, eixo, unidade_id, area_id, vagas, inicio)
       select $1, $2, $3, u.id, a.id, $6, date '2026-01-01'
         from core.unidade u, core.area a where u.codigo = $4 and a.codigo = $5
       returning id`,
      [s.codigo, s.nome, s.eixo, s.unidade, s.area, s.vagas],
    );
  }

  let atendidos = 0;
  for (const s of SERVICOS) {
    for (let i = 0; i < s.atendidos; i++) {
      const sexo = faker.helpers.arrayElement(['female', 'male'] as const);
      const atendido = await um(
        `insert into core.pessoa (nome, data_nascimento, telefone, endereco) values ($1, $2, $3, $4) returning id`,
        [
          faker.person.fullName({ sex: sexo }),
          faker.date.birthdate({ min: 3, max: 80, mode: 'age' }).toISOString().slice(0, 10),
          null,
          JSON.stringify({ cidade: 'Batatais', uf: 'SP', bairro: faker.location.street() }),
        ],
      );
      await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'atendido')`, [atendido]);
      await pg.query(
        `insert into core.vinculo_servico (pessoa_id, servico_id, entrada) values ($1, $2, $3)`,
        [atendido, servicoIds[s.codigo], faker.date.between({ from: '2020-01-01', to: '2026-09-30' }).toISOString().slice(0, 10)],
      );

      const familiar = await um(
        `insert into core.pessoa (nome, telefone) values ($1, $2) returning id`,
        [faker.person.fullName(), `16 9${faker.string.numeric(4)}-${faker.string.numeric(4)}`],
      );
      await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'familiar')`, [familiar]);
      await pg.query(
        `insert into core.vinculo_familiar (pessoa_id, relacionado_id, parentesco, responsavel_legal, cuidador_principal)
         values ($1, $2, $3, true, true)`,
        [atendido, familiar, faker.helpers.arrayElement(PARENTESCOS)],
      );
      atendidos++;
    }
  }

  for (const u of USUARIOS) {
    const pessoa = await um(`insert into core.pessoa (nome, email) values ($1, $2) returning id`, [u.nome, u.email]);
    await pg.query(`insert into core.papel_pessoa (pessoa_id, papel) values ($1, 'colaborador')`, [pessoa]);
    const usuario = await um(`insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`, [u.email]);
    await pg.query(`insert into core.usuario (id, pessoa_id, email) values ($1, $2, $3)`, [usuario, pessoa, u.email]);
    await pg.query(
      `insert into core.atribuicao (usuario_id, perfil_id, escopo_tipo, escopo_id)
       select $1, p.id, $3, $4 from core.perfil p where p.codigo = $2`,
      [usuario, u.perfil, u.escopo ? 'servico' : 'global', u.escopo ? servicoIds[u.escopo] : null],
    );
  }

  await pg.close();
  console.log(`Banco local recriado: ${SERVICOS.length} serviços, ${atendidos} atendidos com familiares, ${USUARIOS.length} usuários.`);
  console.log('Todos os dados são fictícios. Rode "npm run dev" e escolha um usuário na tela de entrada.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
