/**
 * Folha FICTÍCIA para a demonstração e os testes (semente fixa).
 * Nomes, cargos e valores são inventados; só têm o mesmo formato da folha real.
 */
import { Faker, base, pt_BR } from '@faker-js/faker';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { componentesZerados, dividirIgualmente, salarioPelaTabela } from '../dominio/folha';
import { Cargos, CentrosCusto, Componentes, NIVEIS, Postos, Rateios, TabelaSalarial } from './tabelas';

export const CENTROS_FICTICIOS = [
  { codigo: 'adm_geral', nome: 'Administração geral', area: 'administrativo' },
  { codigo: 'adm_financeiro', nome: 'Financeiro', area: 'administrativo' },
  { codigo: 'edu_escola', nome: 'Escola', area: 'educacao' },
  { codigo: 'edu_transporte', nome: 'Transporte escolar', area: 'educacao' },
  { codigo: 'saude_reabilitacao', nome: 'Reabilitação', area: 'saude' },
  { codigo: 'saude_odontologia', nome: 'Odontologia', area: 'saude' },
  { codigo: 'as_ur', nome: 'Unidade Referenciada', area: 'assistencia_social' },
  { codigo: 'as_centro_dia', nome: 'Centro Dia Intergeracional', area: 'assistencia_social' },
  { codigo: 'as_domicilio', nome: 'Serviço no Domicílio', area: 'assistencia_social' },
  { codigo: 'rural_viveiro', nome: 'Apae Rural › Viveiro de mudas', area: 'rural' },
  { codigo: 'rural_agroindustria', nome: 'Apae Rural › Agroindústria', area: 'rural' },
  { codigo: 'mob_eventos', nome: 'Eventos e campanhas', area: 'mobilizacao' },
  { codigo: 'com_comunicacao', nome: 'Comunicação', area: 'comunicacao' },
];

const CARGOS_FICTICIOS = [
  { codigo: 'auxiliar_administrativo', nome: 'Auxiliar administrativo (exemplo)', grupo: 'Administrativo', carga: 40, base: 2100, centros: ['adm_geral', 'adm_financeiro'] },
  { codigo: 'analista_financeiro', nome: 'Analista financeiro (exemplo)', grupo: 'Administrativo', carga: 40, base: 3800, centros: ['adm_financeiro'] },
  { codigo: 'professor', nome: 'Professor(a) (exemplo)', grupo: 'Educação', carga: 30, base: 3600, centros: ['edu_escola'] },
  { codigo: 'monitor', nome: 'Monitor(a) (exemplo)', grupo: 'Educação', carga: 40, base: 1900, centros: ['edu_escola', 'edu_transporte'] },
  { codigo: 'fisioterapeuta', nome: 'Fisioterapeuta (exemplo)', grupo: 'Saúde', carga: 30, base: 4200, centros: ['saude_reabilitacao'] },
  { codigo: 'dentista', nome: 'Cirurgião-dentista (exemplo)', grupo: 'Saúde', carga: 20, base: 4500, centros: ['saude_odontologia'] },
  { codigo: 'assistente_social', nome: 'Assistente social (exemplo)', grupo: 'Assistência Social', carga: 30, base: 4000, centros: ['as_ur', 'as_centro_dia', 'as_domicilio'] },
  { codigo: 'cuidador', nome: 'Cuidador(a) (exemplo)', grupo: 'Assistência Social', carga: 40, base: 1950, centros: ['as_centro_dia', 'as_domicilio'] },
  { codigo: 'tecnico_agricola', nome: 'Técnico agrícola (exemplo)', grupo: 'Rural', carga: 40, base: 3000, centros: ['rural_viveiro', 'rural_agroindustria'] },
  { codigo: 'analista_comunicacao', nome: 'Analista de comunicação (exemplo)', grupo: 'Mobilização', carga: 40, base: 3300, centros: ['com_comunicacao', 'mob_eventos'] },
];

export async function popularFolhaFicticia(p: Planilhas): Promise<{ postos: number }> {
  const f = new Faker({ locale: [pt_BR, base], seed: 2027 });
  const autor = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
  const [centros, cargos, tabela, postos, componentes, rateios] = await lerTabelas(p, [
    CentrosCusto, Cargos, TabelaSalarial, Postos, Componentes, Rateios,
  ] as const);

  await inserirRegistros(p, centros, CENTROS_FICTICIOS, autor);
  await inserirRegistros(
    p,
    cargos,
    CARGOS_FICTICIOS.map((c) => ({ codigo: c.codigo, nome: c.nome, grupo: c.grupo, carga_horaria_referencia: c.carga })),
    autor,
  );
  // Tabela salarial: cada nível 4% acima do anterior.
  await inserirRegistros(
    p,
    tabela,
    CARGOS_FICTICIOS.flatMap((c) =>
      NIVEIS.map((nivel, i) => ({ cargo: c.codigo, nivel, valor: Math.round(c.base * 1.04 ** i * 100) / 100, vigencia: '2026-01-01' })),
    ),
    autor,
  );

  type Plano = { cargo: (typeof CARGOS_FICTICIOS)[number]; vaga: boolean; semRateio: boolean };
  const planos: Plano[] = [];
  CARGOS_FICTICIOS.forEach((cargo, i) => {
    const quantos = [2, 1, 4, 3, 2, 1, 3, 4, 2, 1][i];
    for (let k = 0; k < quantos; k++) planos.push({ cargo, vaga: false, semRateio: false });
  });
  planos.push({ cargo: CARGOS_FICTICIOS[7], vaga: true, semRateio: false }, { cargo: CARGOS_FICTICIOS[6], vaga: true, semRateio: false });
  planos[3].semRateio = true;
  planos[11].semRateio = true;

  const lista = planos.map((pl, i) => {
    const nivel = f.helpers.arrayElement(NIVEIS.slice(0, 6));
    return {
      plano: pl,
      nivel,
      entrada: {
        ficha: pl.vaga ? null : String(1000 + i),
        colaborador: pl.vaga ? null : `${f.person.firstName()} ${f.person.lastName()}`,
        cargo: pl.cargo.codigo,
        nivel,
        carga_horaria: pl.cargo.carga,
        inicio: pl.vaga ? f.helpers.arrayElement(['2027-03-01', '2027-07-01']) : f.date.between({ from: '2008-01-01', to: '2026-06-30' }).toISOString().slice(0, 10),
        observacao: pl.vaga ? 'Contratação prevista para os Novos Serviços 2027 (exemplo)' : null,
      },
    };
  });
  const gravados = await inserirRegistros(p, postos, lista.map((x) => x.entrada), autor);

  await inserirRegistros(
    p,
    componentes,
    gravados.map((posto, i) => {
      const { plano, nivel } = lista[i];
      const valorTabela = Math.round(plano.cargo.base * 1.04 ** NIVEIS.indexOf(nivel) * 100) / 100;
      return {
        posto_id: posto.id,
        vigencia: posto.inicio < '2027-01-01' ? '2027-01-01' : posto.inicio,
        ...componentesZerados(),
        salario_base: salarioPelaTabela(valorTabela, posto.carga_horaria, plano.cargo.carga),
        insalubridade: ['cuidador', 'fisioterapeuta', 'dentista'].includes(plano.cargo.codigo) ? 303.6 : 0,
        hora_atividade: plano.cargo.codigo === 'professor' ? 540 : 0,
        alimentacao: 450,
        plano_saude: f.helpers.arrayElement([0, 180, 260]),
        locomocao: f.helpers.arrayElement([0, 0, 120]),
        fora_da_tabela: false,
      };
    }),
    autor,
  );

  await inserirRegistros(
    p,
    rateios,
    gravados.flatMap((posto, i) => {
      const { plano } = lista[i];
      if (plano.semRateio) return [];
      const quantos = f.number.int({ min: 1, max: plano.cargo.centros.length });
      const lote = crypto.randomUUID();
      return dividirIgualmente(plano.cargo.centros.slice(0, quantos)).map((l) => ({
        posto_id: posto.id,
        lote,
        centro_custo: l.centro,
        percentual: l.percentual,
        vigencia: posto.inicio < '2027-01-01' ? '2027-01-01' : posto.inicio,
      }));
    }),
    autor,
  );
  return { postos: gravados.length };
}
