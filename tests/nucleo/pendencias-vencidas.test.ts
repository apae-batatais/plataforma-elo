/** Anel da tela inicial: quem recebe, com dados FICTÍCIOS. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { salvarAvaliacao } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { TABELAS_AVALIACAO } from '@/modulos/avaliacao/dados/tabelas';
import { manifesto as avaliacao } from '@/modulos/avaliacao/manifesto';
import { manifesto as requisicoes } from '@/modulos/requisicoes/manifesto';
import { TABELAS_REQUISICOES } from '@/modulos/requisicoes/dados/tabelas';
import { appsComPendenciaVencida } from '@/plataforma/pendencias-vencidas';

const AGORA = new Date('2026-11-06T15:00:00Z');
let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

const ficha = (x: object) => ({
  tipo: 'Inicial', iniciais: 'jps', nascimento: '1958-03-02', sexo: 'F', prontuario: '', servico: 'ur', data_avaliacao: '2025-09-01',
  evolucao_usuario: 'Manteve', evolucao_familia: 'Manteve', cuidador: 'Filha', bpc: 'Sim', mae_solo: 'Não', rede_apoio: 'Sim',
  cuidador_idoso: 'Não', nucleo_mais_pcd: 'Não', adultos_30: 'Sim', isolamento: 'Não', enfermagem: 'Não',
  grau_deficiencia: 'Moderada', grau_dependencia: 'II', ostomia: 'Não', ostomia_tipo: '', transporte: 'Comum', barreiras: ['nenhuma'],
  observacoes: '', profissional: '', registro_profissional: '', ...x,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_assistencia', 'requisicoes']), idDe: (c) => c };
  const permissoes = [avaliacao, requisicoes].flatMap((m) => Object.entries(m.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))));
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_AVALIACAO, ...TABELAS_REQUISICOES] as never,
    perfis: [...avaliacao.perfis, ...requisicoes.perfis],
    permissoes,
  });
  await popularDadosFicticios(p);
});

describe('apps com pendência vencida na tela inicial', () => {
  it('quem avalia recebe o anel da Avaliação só quando há reavaliação atrasada que ele vê', async () => {
    const coord = await como('coord.ur@exemplo.local');
    expect((await appsComPendenciaVencida(p, coord, { agora: AGORA })).has('avaliacao')).toBe(false);
    await salvarAvaliacao(p, coord, ficha({}) as never, { agora: AGORA });
    expect((await appsComPendenciaVencida(p, coord, { agora: AGORA })).has('avaliacao')).toBe(true);
  });

  it('quem não tem acesso aos apps não recebe anel nenhum, mesmo com atraso gravado', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await salvarAvaliacao(p, coord, ficha({}) as never, { agora: AGORA });
    const semAcesso = new Autorizador('ninguem@exemplo.local', { usuarios: [], atribuicoes: [], perfilPermissoes: [], servicos: [] });
    expect([...(await appsComPendenciaVencida(p, semAcesso, { agora: AGORA }))]).toEqual([]);
  });

  it('o anel da Avaliação não aparece para quem avalia só em outro serviço', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await salvarAvaliacao(p, coord, ficha({}) as never, { agora: AGORA });
    const dir = await como('diretoria@exemplo.local');
    expect((await appsComPendenciaVencida(p, dir, { agora: AGORA })).has('avaliacao')).toBe(true);
    const outra = await como('coord.educacao@exemplo.local');
    expect((await appsComPendenciaVencida(p, outra, { agora: AGORA })).has('avaliacao')).toBe(false);
  });
});
