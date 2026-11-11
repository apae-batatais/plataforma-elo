/**
 * Termos FICTÍCIOS da demonstração, nos mesmos formatos dos termos reais (sem valores reais):
 * - termo de colaboração com 3 fontes (per capita anual pago em 4 parcelas; global com cronograma digitado);
 * - termo federal com 2 fontes (custeio e piso), unidade da meta em procedimentos;
 * - aporte de julho a dezembro com 6 parcelas, a primeira maior.
 */
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { gravarTermo, registrarAporteDemonstracao } from '../aplicacao/parcerias';

const AGORA = new Date('2026-10-15T12:00:00Z');

export async function popularParceriasFicticias(p: Planilhas): Promise<void> {
  const educacao = await gravarTermo(
    p,
    'demonstracao',
    {
      parceiro: 'Secretaria de Educação (exemplo)',
      numero: '001/2026',
      objeto: 'Atendimento educacional especializado (exemplo).',
      tipo: 'colaboracao',
      inicio: '2026-01-01',
      fim: '2026-12-31',
      unidadeMeta: 'alunos',
      recursosProprios: 20000,
      servicos: [{ servico: 'escola', vagasOferecidas: 120, vagasCusteadas: 100 }],
      fontes: [
        {
          nome: 'Fundo municipal',
          forma: 'per_capita',
          perCapita: 1000,
          periodicidade: 'anual',
          cronograma: 'iguais',
          meses: ['2026-03', '2026-06', '2026-09', '2026-12'],
          permiteRemanejar: false,
          categorias: [
            { categoria: 'Pessoal', valor: 70000 },
            { categoria: 'Administrativas', valor: 30000 },
          ],
        },
        {
          nome: 'Cofinanciamento estadual',
          forma: 'global',
          valorInicial: 30000,
          cronograma: 'digitado',
          parcelas: [
            { mes: '2026-02', valor: 12000 },
            { mes: '2026-06', valor: 9000 },
            { mes: '2026-10', valor: 9000 },
          ],
          permiteRemanejar: true,
        },
        { nome: 'Recurso federal', forma: 'global', valorInicial: 12000, cronograma: 'iguais', meses: ['2026-04', '2026-10'] },
      ],
      equipe: [
        { funcao: 'Professor', pessoas: 4, horasSemanais: 20 },
        { funcao: 'Administrativo', pessoas: 1, horasSemanais: 10 },
      ],
      metas: [{ descricao: 'Alunos atendidos', unidade: 'alunos', quantidade: 100 }],
    },
    AGORA,
  );
  await gravarTermo(
    p,
    'demonstracao',
    {
      parceiro: 'Secretaria de Saúde (exemplo)',
      numero: '014/2026',
      tipo: 'convenio',
      inicio: '2026-01-01',
      fim: '2026-12-31',
      unidadeMeta: 'procedimentos',
      servicos: [{ servico: 'cer_reabilitacao', vagasOferecidas: 500, vagasCusteadas: 500 }],
      fontes: [
        { nome: 'Custeio', forma: 'global', valorInicial: 240000, cronograma: 'iguais', meses: Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`) },
        { nome: 'Piso da enfermagem', forma: 'global', valorInicial: 36000, cronograma: 'iguais', meses: ['2026-03', '2026-06', '2026-09', '2026-12'] },
      ],
      metas: [
        { descricao: 'Consultas', unidade: 'procedimentos', quantidade: 300 },
        { descricao: 'Sessões de terapia', unidade: 'procedimentos', quantidade: 200 },
      ],
    },
    AGORA,
  );
  await registrarAporteDemonstracao(p, educacao, AGORA);
}
