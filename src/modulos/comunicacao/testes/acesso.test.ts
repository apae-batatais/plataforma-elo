/**
 * Comunicação (abas, perfis e dados fictícios): quem pode o quê no manifesto,
 * sigilo das colunas pessoais e a demonstração gravada na planilha.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import {
  AnexosComunicacao,
  CalendarioComunicacao,
  ContatoGruposComunicacao,
  ContatosComunicacao,
  GruposComunicacao,
  HistoricoComunicacao,
  PedidosComunicacao,
  TABELAS_COMUNICACAO,
} from '../dados/tabelas';
import { popularComunicacaoFicticia } from '../dados/ficticios';
import { conferirTransicao, SITUACOES, type Acao } from '../dominio/pedido';
import { manifesto } from '../manifesto';

let p: Planilhas;

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'comunicacao']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_COMUNICACAO] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
});

describe('manifesto', () => {
  it('perfis e permissões do manifesto', () => {
    const pp = manifesto.permissoesPorPerfil;
    expect(pp.funcionario).toEqual(['comunicacao.acessar', 'comunicacao.solicitar']);
    expect(pp.comunicacao).toContain('comunicacao.revisar');
    expect(pp.comunicacao).not.toContain('comunicacao.aprovar');
    expect(pp.coordenacao_comunicacao).toEqual(
      expect.arrayContaining(['comunicacao.aprovar', 'comunicacao.configurar', 'comunicacao.indicadores']),
    );
    expect(new Set(pp.diretoria)).toEqual(new Set(pp.coordenacao_comunicacao));
  });

  it('todo perfil do Requisições pede e acompanha os próprios pedidos', () => {
    for (const perfil of ['administrador_plataforma', 'financeiro', 'coordenacao_servico', 'tecnico_avaliador', 'leitura', 'departamento_pessoal', 'compras', 'almoxarifado', 'informatica', 'patrimonio', 'manutencao', 'cozinha']) {
      expect(manifesto.permissoesPorPerfil[perfil]).toEqual(['comunicacao.acessar', 'comunicacao.solicitar']);
    }
  });

  it('só usa permissões declaradas', () => {
    const declaradas = Object.keys(manifesto.permissoes);
    for (const lista of Object.values(manifesto.permissoesPorPerfil)) for (const x of lista) expect(declaradas).toContain(x);
  });
});

describe('abas', () => {
  it('o histórico só recebe inclusões e as colunas pessoais têm sigilo', () => {
    expect(HistoricoComunicacao.modo).toBe('somente_inclusao');
    expect(PedidosComunicacao.sigilo).toMatchObject({ solicitante: 'pessoal', solicitante_nome: 'pessoal', imagem_confirmada_por: 'pessoal' });
    expect(ContatosComunicacao.sigilo).toMatchObject({ nome: 'pessoal', email: 'pessoal' });
    expect(HistoricoComunicacao.sigilo).toMatchObject({ usuario: 'pessoal' });
    expect(AnexosComunicacao.sigilo).toMatchObject({ arquivo_id: 'sensivel', nome: 'pessoal' });
  });
});

describe('demonstração', () => {
  it('grava calendário, contatos, grupos e 8 pedidos com histórico coerente', async () => {
    await popularComunicacaoFicticia(p);
    const [cal, grupos, contatos, ligacoes, pedidos, hist] = await lerTabelas(p, [
      CalendarioComunicacao,
      GruposComunicacao,
      ContatosComunicacao,
      ContatoGruposComunicacao,
      PedidosComunicacao,
      HistoricoComunicacao,
    ] as const);
    expect(cal.todos()).toHaveLength(6);
    expect(new Set(cal.todos().map((i) => i.tipo_data))).toEqual(new Set(['exata', 'periodo']));
    expect(grupos.todos()).toHaveLength(2);
    expect(contatos.todos()).toHaveLength(4);
    expect(contatos.todos().every((c) => c.email.endsWith('.com.br') || c.email.endsWith('.local'))).toBe(true);
    expect(ligacoes.todos().length).toBeGreaterThan(0);
    const ps = pedidos.todos();
    expect(ps).toHaveLength(8);
    expect(new Set(ps.map((x) => x.situacao)).size).toBeGreaterThanOrEqual(5);
    for (const x of ps) {
      expect(SITUACOES).toContain(x.situacao);
      const h = hist.todos().filter((r) => r.pedido_id === x.id);
      expect(h.length).toBeGreaterThan(0);
      expect(h[h.length - 1].para).toBe(x.situacao);
      for (const r of h.slice(1)) expect(conferirTransicao(r.de as never, r.acao as Acao, x.tipo_peca)).toBe(r.para);
    }
  });
});
