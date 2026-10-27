/**
 * Folha FICTÍCIA para a demonstração e os testes (semente fixa).
 * Nomes, cargos e valores são inventados; só têm o mesmo formato da folha real.
 */
import { Faker, base, pt_BR } from '@faker-js/faker';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { componentesZerados, dividirIgualmente } from '../dominio/folha';
import { Componentes, Postos, Rateios } from './tabelas';

/** Cargos fictícios e os serviços (do Núcleo, fictícios) em que costumam ser lotados. */
const CARGOS_FICTICIOS = [
  { codigo: 'auxiliar_administrativo', nome: 'Auxiliar administrativo (exemplo)', carga: 200, base: 2100, centros: ['administracao'] },
  { codigo: 'analista_financeiro', nome: 'Analista financeiro (exemplo)', carga: 200, base: 3800, centros: ['administracao'] },
  { codigo: 'professor', nome: 'Professor(a) (exemplo)', carga: 150, base: 3600, centros: ['escola'] },
  { codigo: 'monitor', nome: 'Monitor(a) (exemplo)', carga: 200, base: 1900, centros: ['escola', 'transporte'] },
  { codigo: 'fisioterapeuta', nome: 'Fisioterapeuta (exemplo)', carga: 150, base: 4200, centros: ['cer_reabilitacao'] },
  { codigo: 'psicologo', nome: 'Psicólogo(a) (exemplo)', carga: 150, base: 4000, centros: ['cer_reabilitacao', 'ur'] },
  { codigo: 'assistente_social', nome: 'Assistente social (exemplo)', carga: 150, base: 4000, centros: ['ur', 'centro_dia_intergeracional', 'servico_domicilio'] },
  { codigo: 'cuidador', nome: 'Cuidador(a) (exemplo)', carga: 200, base: 1950, centros: ['centro_dia_intergeracional', 'servico_domicilio'] },
  { codigo: 'tecnico_agricola', nome: 'Técnico agrícola (exemplo)', carga: 200, base: 3000, centros: ['rural_viveiro'] },
  { codigo: 'analista_comunicacao', nome: 'Analista de comunicação (exemplo)', carga: 200, base: 3300, centros: ['comunicacao'] },
];
const DEPARTAMENTOS = ['Administrativo', 'Educação', 'Saúde', 'Assistência Social', 'Apae Rural', null];

export async function popularFolhaFicticia(p: Planilhas): Promise<{ postos: number }> {
  const f = new Faker({ locale: [pt_BR, base], seed: 2027 });
  const autor = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
  const [postos, componentes, rateios] = await lerTabelas(p, [Postos, Componentes, Rateios] as const);

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
    const passos = f.number.int({ min: 0, max: 5 });
    return {
      plano: pl,
      salario: Math.round(pl.cargo.base * 1.04 ** passos * 100) / 100,
      entrada: {
        ficha: pl.vaga ? null : String(2000 + i),
        colaborador: pl.vaga ? `A contratar – ${pl.cargo.nome}` : `${f.person.firstName()} ${f.person.lastName()}`.toUpperCase(),
        cargo: pl.cargo.nome.toUpperCase(),
        departamento: f.helpers.arrayElement(DEPARTAMENTOS),
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
      const { plano, salario } = lista[i];
      return {
        posto_id: posto.id,
        vigencia: posto.inicio < '2027-01-01' ? '2027-01-01' : posto.inicio,
        ...componentesZerados(5),
        salario_atual: salario,
        hora_atividade: plano.cargo.codigo === 'professor',
        insalubridade: ['cuidador', 'fisioterapeuta'].includes(plano.cargo.codigo) ? 303.6 : 0,
        adicional_salarial: f.helpers.arrayElement([0, 0, 0, 150]),
        alimentacao: 340,
        locomocao: f.helpers.arrayElement([0, 0, 0, 120]),
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
        servico: l.centro,
        percentual: l.percentual,
        vigencia: posto.inicio < '2027-01-01' ? '2027-01-01' : posto.inicio,
      }));
    }),
    autor,
  );
  return { postos: gravados.length };
}
