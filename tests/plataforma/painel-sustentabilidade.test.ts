import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { painelSustentabilidade } from '@/modulos/orcamento';
import { catalogoDeParcerias } from '@/plataforma/ligacoes';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

let p: Planilhas;
const AGORA = new Date('2026-11-14T15:00:00Z');

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

describe('painel de sustentabilidade com os termos de Parcerias da demonstração', () => {
  it('cobertura por termo e origem sugerida pelo tipo de instrumento', async () => {
    const painel = await painelSustentabilidade(p, await como('financeiro@exemplo.local'), catalogoDeParcerias(p, { agora: AGORA }), { ano: 2026, agora: AGORA });
    const escola = painel.servicos.find((s) => s.codigo === 'escola')!;
    const cer = painel.servicos.find((s) => s.codigo === 'cer_reabilitacao')!;
    expect(escola.origem.origem).toBe('contratado');
    expect(cer.origem.origem).toBe('contratado'); // convênio
    expect(escola.repasse).toBeGreaterThan(0);
    expect(escola.vagas).toBe(100);
    expect(cer.repasse).toBe(276000);
    expect(painel.peso!.peso).not.toBeNull();
  });

  it('Parcerias desligado entrega só o custo', async () => {
    expect(catalogoDeParcerias(p, { desligados: new Set(['parcerias']) })).toBeNull();
  });
});
