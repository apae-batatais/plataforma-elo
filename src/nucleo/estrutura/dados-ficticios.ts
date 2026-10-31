/**
 * Dados FICTÍCIOS para a demonstração e os testes. Sempre os mesmos
 * (gerador com semente fixa). CPF e NIS ficam vazios.
 * Só são gravados em armazenamento em memória (ver aplicacao.ts).
 */
import { Faker, base, pt_BR } from '@faker-js/faker';
import { inserir, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, Papeis, Pessoas, Servicos, Usuarios, VinculosFamiliares, VinculosServico } from './tabelas';

/** Unidades das instituições fictícias (demonstração e testes). */
export const UNIDADES_FICTICIAS = [
  { codigo: 'sede', nome: 'Sede (exemplo)' },
  { codigo: 'rural', nome: 'Unidade Rural (Filial)' },
];

export const SERVICOS_FICTICIOS = [
  { codigo: 'ur', nome: 'Unidade Referenciada (exemplo)', unidade: 'sede', area: 'assistencia_social', vagas: null, atendidos: 12 },
  { codigo: 'centro_dia_intergeracional', nome: 'Centro Dia Intergeracional (exemplo)', unidade: 'sede', area: 'assistencia_social', vagas: 80, atendidos: 8 },
  { codigo: 'servico_domicilio', nome: 'Serviço no Domicílio (exemplo)', unidade: 'sede', area: 'assistencia_social', vagas: 40, atendidos: 5 },
  { codigo: 'cer_reabilitacao', nome: 'Reabilitação CER (exemplo)', unidade: 'sede', area: 'saude', vagas: null, atendidos: 6 },
  { codigo: 'escola', nome: 'Escola (exemplo)', unidade: 'sede', area: 'educacao', vagas: null, atendidos: 6 },
  // Serviços sem atendidos: também são centros de custo da folha.
  { codigo: 'transporte', nome: 'Transporte escolar (exemplo)', unidade: 'sede', area: 'educacao', vagas: null, atendidos: 0 },
  { codigo: 'administracao', nome: 'Administração (exemplo)', unidade: 'sede', area: 'administrativo', vagas: null, atendidos: 0 },
  { codigo: 'rural_viveiro', nome: 'Viveiro de mudas (exemplo)', unidade: 'rural', area: 'rural', vagas: null, atendidos: 0 },
  { codigo: 'comunicacao', nome: 'Comunicação e Mobilização (exemplo)', unidade: 'sede', area: 'comunicacao', vagas: null, atendidos: 0 },
] as const;

export const USUARIOS_FICTICIOS = [
  { email: 'diretoria@exemplo.local', nome: 'Diretoria (fictícia)', perfil: 'diretoria', escopo: null },
  { email: 'admin@exemplo.local', nome: 'Administração da Plataforma (fictícia)', perfil: 'administrador_plataforma', escopo: null },
  { email: 'financeiro@exemplo.local', nome: 'Financeiro (fictício)', perfil: 'financeiro', escopo: null },
  { email: 'coord.ur@exemplo.local', nome: 'Coordenação UR (fictícia)', perfil: 'coordenacao_servico', escopo: 'ur' },
  { email: 'tecnico.cer@exemplo.local', nome: 'Técnico CER (fictício)', perfil: 'tecnico_avaliador', escopo: 'cer_reabilitacao' },
  { email: 'leitura@exemplo.local', nome: 'Conselho, somente leitura (fictício)', perfil: 'leitura', escopo: null },
  { email: 'dp@exemplo.local', nome: 'Departamento Pessoal (fictício)', perfil: 'departamento_pessoal', escopo: null },
  { email: 'compras@exemplo.local', nome: 'Setor de Compras (fictício)', perfil: 'compras', escopo: null },
  { email: 'coord.educacao@exemplo.local', nome: 'Coordenação da Educação (fictícia)', perfil: 'coordenacao_servico', escopo: 'area:educacao' },
  { email: 'almoxarifado@exemplo.local', nome: 'Almoxarifado (fictício)', perfil: 'almoxarifado', escopo: null },
  { email: 'informatica@exemplo.local', nome: 'Setor de Informática (fictício)', perfil: 'informatica', escopo: null },
  { email: 'patrimonio@exemplo.local', nome: 'Setor de Patrimônio (fictício)', perfil: 'patrimonio', escopo: null },
  { email: 'manutencao@exemplo.local', nome: 'Setor de Manutenção (fictício)', perfil: 'manutencao', escopo: null },
] as const;

const PARENTESCOS = ['mãe', 'pai', 'avó', 'avô', 'tia', 'irmã'];

export async function popularDadosFicticios(p: Planilhas): Promise<{ atendidos: number }> {
  const f = new Faker({ locale: [pt_BR, base], seed: 2027 });
  const autor = { email: 'demonstracao', agora: () => new Date('2026-10-01T12:00:00Z') };
  const data = (d: Date) => d.toISOString().slice(0, 10);

  for (const s of SERVICOS_FICTICIOS) {
    await inserir(p, Servicos, { codigo: s.codigo, nome: s.nome, unidade: s.unidade, area: s.area, vagas: s.vagas, inicio: '2026-01-01', fim: null }, autor);
  }

  let atendidos = 0;
  for (const s of SERVICOS_FICTICIOS) {
    for (let i = 0; i < s.atendidos; i++) {
      const atendido = await inserir(
        p,
        Pessoas,
        {
          nome: f.person.fullName({ sex: f.helpers.arrayElement(['female', 'male'] as const) }),
          data_nascimento: data(f.date.birthdate({ min: 3, max: 80, mode: 'age', refDate: '2026-10-01' })),
          cidade: 'Batatais',
          bairro: f.location.street(),
        },
        autor,
      );
      await inserir(p, Papeis, { pessoa_id: atendido.id, papel: 'atendido' }, autor);
      await inserir(p, VinculosServico, { pessoa_id: atendido.id, servico: s.codigo, entrada: data(f.date.between({ from: '2020-01-01', to: '2026-09-30' })) }, autor);

      const familiar = await inserir(p, Pessoas, { nome: f.person.fullName(), telefone: `16 9${f.string.numeric(4)}-${f.string.numeric(4)}` }, autor);
      await inserir(p, Papeis, { pessoa_id: familiar.id, papel: 'familiar' }, autor);
      await inserir(
        p,
        VinculosFamiliares,
        { pessoa_id: atendido.id, relacionado_id: familiar.id, parentesco: f.helpers.arrayElement(PARENTESCOS), responsavel_legal: true, cuidador_principal: true },
        autor,
      );
      atendidos++;
    }
  }

  for (const u of USUARIOS_FICTICIOS) {
    const pessoa = await inserir(p, Pessoas, { nome: u.nome, email: u.email }, autor);
    await inserir(p, Papeis, { pessoa_id: pessoa.id, papel: 'colaborador' }, autor);
    await inserir(p, Usuarios, { email: u.email, pessoa_id: pessoa.id }, autor);
    const [tipo, codigo] = !u.escopo ? ['global', null] : u.escopo.startsWith('area:') ? ['area', u.escopo.slice(5)] : ['servico', u.escopo];
    await inserir(p, Atribuicoes, { usuario_email: u.email, perfil: u.perfil, escopo_tipo: tipo as 'global' | 'area' | 'servico', escopo: codigo }, autor);
  }
  return { atendidos };
}
