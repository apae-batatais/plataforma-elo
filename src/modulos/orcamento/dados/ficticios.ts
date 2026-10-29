/**
 * Folha FICTÍCIA para a demonstração e os testes (semente fixa).
 * Nomes, cargos e valores são inventados; só têm o mesmo formato da folha real.
 */
import { Faker, base, pt_BR } from '@faker-js/faker';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { componentesZerados, dividirIgualmente } from '../dominio/folha';
import { distribuir, valorDoItem } from '../dominio/previsao';
import { CentrosCusto, Componentes, Despesas, Exercicios, Fontes, FontesFolha, GruposGasto, Postos, Rateios, Receitas } from './tabelas';

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

// ---------------------------------------------------------------------------
// Previsão FICTÍCIA (Entrega 1B): grupos, fontes, exercício 2027, despesas e receitas
// ---------------------------------------------------------------------------

const GRUPOS_FICTICIOS = [
  { nome: 'Material de consumo (exemplo)', rh: false },
  { nome: 'Alimentação (exemplo)', rh: false },
  { nome: 'Serviços de terceiros (exemplo)', rh: false },
  { nome: 'Manutenção e conservação (exemplo)', rh: false },
  { nome: 'Combustível e transporte (exemplo)', rh: false },
  { nome: 'RH – RPA e autônomos (exemplo)', rh: true },
  { nome: 'RH – Rescisões (exemplo)', rh: true },
];

const FONTES_FICTICIAS = [
  { nome: 'Subvenção municipal – Assistência (exemplo)', natureza: 'publica', uso: 'restrita' },
  { nome: 'Convênio estadual – Educação (exemplo)', natureza: 'publica', uso: 'restrita' },
  { nome: 'SUS – Reabilitação (exemplo)', natureza: 'publica', uso: 'restrita' },
  { nome: 'Projeto Incentivado (exemplo)', natureza: 'publica', uso: 'restrita' },
  { nome: 'Leilão anual (exemplo)', natureza: 'propria', uso: 'livre' },
  { nome: 'Doações e contribuições (exemplo)', natureza: 'propria', uso: 'livre' },
  { nome: 'Vendas da Rural (exemplo)', natureza: 'propria', uso: 'livre' },
] as const;

export async function popularPrevisaoFicticia(p: Planilhas): Promise<void> {
  const autor = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
  const [grupos, fontes, exercicios, despesas, receitas, fontesFolha, centros] = await lerTabelas(p, [
    GruposGasto, Fontes, Exercicios, Despesas, Receitas, FontesFolha, CentrosCusto,
  ] as const);
  const g = await inserirRegistros(p, grupos, GRUPOS_FICTICIOS, autor);
  const f = await inserirRegistros(p, fontes, FONTES_FICTICIAS.map((x) => ({ ...x })), autor);
  await inserirRegistros(p, exercicios, [{ ano: 2027, situacao: 'elaboracao', aprovado_em: null, aprovado_por: null }], autor);
  const G = (i: number) => g[i].id;
  const F = (i: number) => f[i].id;

  const igual = (valor: number) => Object.fromEntries(distribuir(valor, 'igual').map((v, i) => [`m${i + 1}`, v]));
  const nosMeses = (valor: number, meses: number[]) => Object.fromEntries(distribuir(valor, 'meses', { meses }).map((v, i) => [`m${i + 1}`, v]));
  const projetos = new Set(['Material pedagógico (exemplo)', 'Reforma do telhado (exemplo)', 'Manutenção de equipamentos (exemplo)']);
  const prioridades = ['ui', 'ni', 'un', 'nn'] as const;
  let k = 0;
  const item = (servico: string, grupo: number, fonte: number | null, descricao: string, q: number, o: number, vu: number, meses?: number[]) => ({
    categoria: projetos.has(descricao) ? ('projetos' as const) : ('operacional' as const),
    prioridade: prioridades[k++ % 4],
    cotacao: k % 5 === 0 ? ('pendente' as const) : ('ok' as const),
    ano: 2027,
    servico,
    grupo_id: G(grupo),
    fonte_id: fonte === null ? null : F(fonte),
    descricao,
    quantidade: q,
    ocorrencias: o,
    valor_unitario: vu,
    distribuicao: meses ? ('meses' as const) : ('igual' as const),
    ...(meses ? nosMeses(valorDoItem(q, o, vu), meses) : igual(valorDoItem(q, o, vu))),
    situacao: 'aceito' as const,
    observacao: null,
  });
  const itens2027 = [
      item('escola', 0, 1, 'Material pedagógico (exemplo)', 1, 2, 9800, [2, 8]),
      item('escola', 1, 1, 'Merenda escolar (exemplo)', 60, 200, 7.5),
      item('transporte', 4, 1, 'Diesel do transporte escolar (exemplo)', 1, 12, 6400),
      item('transporte', 3, null, 'Revisão dos veículos (exemplo)', 3, 1, 4200, [1, 7]),
      item('centro_dia_intergeracional', 1, 0, 'Refeições do Centro Dia (exemplo)', 80, 240, 9.2),
      item('centro_dia_intergeracional', 0, 0, 'Material de oficinas (exemplo)', 1, 12, 1500),
      item('servico_domicilio', 4, 0, 'Deslocamento das equipes (exemplo)', 1, 12, 2100),
      item('cer_reabilitacao', 2, 2, 'Manutenção de equipamentos (exemplo)', 1, 4, 3500, [3, 6, 9, 12]),
      item('cer_reabilitacao', 5, 3, 'Fonoaudióloga – RPA (exemplo)', 1, 12, 4800),
      item('administracao', 2, 5, 'Contabilidade (exemplo)', 1, 12, 5200),
      item('administracao', 3, 4, 'Reforma do telhado (exemplo)', 1, 1, 38000, [4]),
      item('administracao', 6, 4, 'Provisão para rescisões (exemplo)', 1, 1, 60000, [12]),
      item('rural_viveiro', 0, 6, 'Insumos do viveiro (exemplo)', 1, 12, 1800),
      item('comunicacao', 2, null, 'Impressão de materiais (exemplo)', 1, 2, 4500, [5, 10]),
  ];
  await inserirRegistros(p, despesas, itens2027, autor);

  const AREA_DA_FONTE = ['assistencia_social', 'educacao', 'saude', 'saude', null, null, 'rural'];
  const receita = (fonte: number, descricao: string, valor: number, captacao: 'garantida' | 'negociacao' | 'a_captar', meses?: number[]) => ({
    ano: 2027,
    area: AREA_DA_FONTE[fonte],
    fonte_id: F(fonte),
    descricao,
    valor,
    captacao,
    distribuicao: meses ? ('meses' as const) : ('igual' as const),
    ...(meses ? nosMeses(valor, meses) : igual(valor)),
    observacao: null,
  });
  const receitas2027 = [
      receita(0, 'Termo de colaboração – Centro Dia (exemplo)', 980000, 'garantida'),
      receita(0, 'Termo de colaboração – Serviço no Domicílio (exemplo)', 420000, 'negociacao'),
      receita(1, 'Convênio da Escola (exemplo)', 1350000, 'garantida'),
      receita(2, 'Produção SUS do CER (exemplo)', 610000, 'garantida'),
      receita(3, 'Projeto Incentivado 2027 (exemplo)', 300000, 'a_captar', [6, 7, 8, 9, 10, 11, 12]),
      receita(4, 'Leilão 2027 (exemplo)', 420000, 'negociacao', [8]),
      receita(5, 'Doações mensais (exemplo)', 96000, 'garantida'),
      receita(6, 'Vendas Vem da Rural (exemplo)', 72000, 'a_captar'),
  ];
  await inserirRegistros(p, receitas, receitas2027, autor);

  // Exercícios anteriores (2025 e 2026), para o Painel geral comparar os anos.
  // Valores inventados a partir dos de 2027; a folha desses anos entra como item de RH por serviço.
  const [gruposAgora] = await lerTabelas(p, [GruposGasto] as const);
  const grupoFolha = await inserirRegistros(p, gruposAgora, [{ nome: 'Folha de pagamento – anos anteriores (exemplo)', rh: true }], autor);
  const FOLHA_POR_SERVICO: [string, number, number][] = [
    ['administracao', 199000, 5], ['centro_dia_intergeracional', 212000, 0], ['servico_domicilio', 74000, 0], ['ur', 253000, 0],
    ['comunicacao', 79500, 5], ['escola', 324000, 1], ['transporte', 67600, 1], ['rural_viveiro', 123000, 6], ['cer_reabilitacao', 187000, 2],
  ];
  const variacao = (i: number, ano: number) => 1 + (((i * 7 + ano) % 9) - 4) / 100;
  for (const [ano, fator] of [[2025, 0.84], [2026, 0.92]] as const) {
    await inserirRegistros(p, exercicios, [{ ano, situacao: 'encerrado', aprovado_em: `${ano - 1}-12-15`, aprovado_por: 'diretoria@exemplo.local' }], autor);
    const itens = itens2027.map((d, i) => {
      const vu = Math.round(d.valor_unitario * fator * variacao(i, ano) * 100) / 100;
      const valor = valorDoItem(d.quantidade, d.ocorrencias, vu);
      const meses = Array.from({ length: 12 }, (_, m) => Number((d as Record<string, unknown>)[`m${m + 1}`]) || 0);
      const usados = meses.map((v, m) => (v ? m + 1 : 0)).filter(Boolean);
      return {
        ...d,
        ano,
        fonte_id: d.fonte_id ?? F(5),
        valor_unitario: vu,
        ...(d.distribuicao === 'igual' ? igual(valor) : nosMeses(valor, usados)),
      };
    });
    const folha = FOLHA_POR_SERVICO.map(([servico, base, fonte], i) => {
      const valor = Math.round(base * fator * variacao(i + 3, ano) * 100) / 100;
      return {
        ano, servico, grupo_id: grupoFolha[0].id, fonte_id: F(fonte), descricao: 'Folha de pagamento consolidada (exemplo)',
        quantidade: 1, ocorrencias: 1, valor_unitario: valor, distribuicao: 'igual' as const, ...igual(valor),
        categoria: 'operacional' as const, prioridade: null, cotacao: null, situacao: 'aceito' as const, observacao: null,
      };
    });
    await inserirRegistros(p, despesas, [...itens, ...folha], autor);
    // A receita própria cresce menos que a pública nos anos anteriores (dependência subindo em 2027).
    const rec = receitas2027.map((r, i) => {
      const propria = r.fonte_id === F(4) || r.fonte_id === F(5) || r.fonte_id === F(6);
      const valor = Math.round(r.valor * (propria ? fator * 1.12 : fator * 0.97) * variacao(i, ano) * 100) / 100;
      const meses = Array.from({ length: 12 }, (_, m) => Number((r as Record<string, unknown>)[`m${m + 1}`]) || 0);
      const usados = meses.map((v, m) => (v ? m + 1 : 0)).filter(Boolean);
      return {
        ...r,
        ano,
        descricao: r.descricao.replace('2027', String(ano)),
        valor,
        captacao: 'garantida' as const,
        ...(r.distribuicao === 'igual' ? igual(valor) : nosMeses(valor, usados)),
      };
    });
    await inserirRegistros(p, receitas, rec, autor);
  }

  await inserirRegistros(
    p,
    centros,
    [
      { servico: 'administracao', tipo: 'despesa', atendidos: null, sessoes: null, area_m2: 180 },
      { servico: 'comunicacao', tipo: 'despesa', atendidos: null, sessoes: null, area_m2: 40 },
      { servico: 'transporte', tipo: 'indireto', atendidos: null, sessoes: null, area_m2: null },
      { servico: 'escola', tipo: 'direto', atendidos: 107, sessoes: null, area_m2: 900 },
      { servico: 'ur', tipo: 'direto', atendidos: 90, sessoes: null, area_m2: 250 },
      { servico: 'centro_dia_intergeracional', tipo: 'direto', atendidos: 80, sessoes: null, area_m2: 400 },
      { servico: 'servico_domicilio', tipo: 'direto', atendidos: 40, sessoes: null, area_m2: 30 },
      { servico: 'cer_reabilitacao', tipo: 'direto', atendidos: 120, sessoes: 9600, area_m2: 600 },
      { servico: 'rural_viveiro', tipo: 'direto', atendidos: 25, sessoes: null, area_m2: 5000 },
    ],
    autor,
  );

  await inserirRegistros(
    p,
    fontesFolha,
    [
      { ano: 2027, servico: 'escola', fonte_id: F(1) },
      { ano: 2027, servico: 'transporte', fonte_id: F(1) },
      { ano: 2027, servico: 'centro_dia_intergeracional', fonte_id: F(0) },
      { ano: 2027, servico: 'servico_domicilio', fonte_id: F(0) },
      { ano: 2027, servico: 'cer_reabilitacao', fonte_id: F(2) },
      { ano: 2027, servico: 'administracao', fonte_id: F(5) },
    ],
    autor,
  );
}
