/** Resumo diário por e-mail de Requisições (entrega 7): quem recebe, o que diz, uma vez por dia. Dados FICTÍCIOS. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, Feriados, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { EnviadorMemoria, type MensagemEmail } from '@/nucleo/email/email';
import { decidirRequisicao, enviarRequisicao, type DadosRequisicao } from '../aplicacao/requisicoes';
import { rodarResumoDiario } from '../aplicacao/resumo';
import { Requisicoes, ResumosEnviados, TABELAS_REQUISICOES, TiposRequisicao } from '../dados/tabelas';
import { conteudoDoResumo } from '../dominio/resumo';
import { manifesto } from '../manifesto';

let p: Planilhas;
let tipoId: string;
const URL = 'https://elo.exemplo.local';
const dia = (d: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, d, h + 3, m)); // novembro de 2026, horário de Brasília

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const ficha = (): DadosRequisicao & { nomeRequisitante: string } => ({
  nomeRequisitante: 'Pessoa (fictícia)',
  tipoId,
  area: 'educacao',
  centros: [{ servico: 'escola', percentual: 100 }],
  itens: [{ quantidade: 10, unidade: 'resma', descricao: 'Papel sulfite' }],
  detalhes: { entrega: { modo: 'retirada', horario: '08:10', local: 'Almoxarifado', responsavel: 'Ana' } },
});
const para = (e: EnviadorMemoria) => e.enviadas.map((m) => m.para?.[0]).sort();

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'requisicoes']), idDe: (c) => c };
  const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
  await prepararEstrutura(p, { tabelas: [...TABELAS_REQUISICOES] as never, perfis: manifesto.perfis, permissoes });
  await popularDadosFicticios(p);
  const t = await inserir(p, TiposRequisicao, { nome: 'Material pedagógico', categoria: 'material', formulario: 'materiais', perfil_responsavel: 'almoxarifado', prazo_aprovacao: 8, prazo_atendimento: 16, descricao: null }, { email: 'teste' });
  tipoId = t.id;
  // Uma requisição enviada em 2/11 (segunda) às 9h, ainda sem decisão: na segunda seguinte está atrasada.
  await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha(), { agora: dia(2, 9) });
});

describe('resumo diário de Requisições', () => {
  it('manda um e-mail individual a quem tem algo: aprovar e atrasada para a coordenação; nada a quem não tem', async () => {
    const e = new EnviadorMemoria('nao-responda@exemplo.local');
    const r = await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(9, 7, 5));
    expect(r.enviados).toBeGreaterThan(0);
    expect(para(e)).toContain('coord.educacao@exemplo.local');
    expect(para(e)).not.toContain('financeiro@exemplo.local'); // quem pediu não tem nada a fazer
    expect(para(e)).not.toContain('almoxarifado@exemplo.local'); // ainda não foi aprovada
    for (const m of e.enviadas) {
      expect(m.cco).toBeUndefined();
      expect(m.para).toHaveLength(1);
    }
    const coord = e.enviadas.find((m) => m.para?.[0] === 'coord.educacao@exemplo.local')!;
    expect(coord.texto).toContain('1 requisição aguarda a sua aprovação');
    expect(coord.texto).toContain('1 requisição está atrasada');
    expect(coord.texto).toContain(`${URL}/requisicoes`);
    // Sem dado do pedido, de quem pediu nem número da requisição.
    const tudo = JSON.stringify(e.enviadas);
    expect(tudo).not.toMatch(/REQ-2026|Papel|fictícia|financeiro@/);
  });

  it('devolvida aparece para quem pediu; atrasada de atendimento, para o setor', async () => {
    const [reqs] = await lerTabelas(p, [Requisicoes] as const);
    const id = reqs.ativos()[0].id;
    const v = (await lerTabela(p, Requisicoes)).porId(id)!.versao;
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), id, v, 'devolver', 'Ajustar a quantidade', { agora: dia(2, 10) });
    const e = new EnviadorMemoria('nao-responda@exemplo.local');
    await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(9, 7));
    expect(para(e)).toEqual(['financeiro@exemplo.local']);
    expect(e.enviadas[0].texto).toContain('1 requisição sua foi devolvida');
    expect(e.enviadas[0].texto).not.toContain('atrasada');
  });

  it('só uma vez por dia por instituição, e grava o dia na aba ResumosEnviados com auditoria', async () => {
    const e = new EnviadorMemoria('nao-responda@exemplo.local');
    await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(9, 7));
    const total = e.enviadas.length;
    expect(await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(9, 7, 15))).toEqual({ enviados: 0, falhas: 0 });
    expect(await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(9, 9))).toEqual({ enviados: 0, falhas: 0 });
    expect(e.enviadas).toHaveLength(total);
    const linhas = (await lerTabela(p, ResumosEnviados)).ativos();
    expect(linhas.map((l) => [l.dia, l.pessoas])).toEqual([['2026-11-09', total]]);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'ResumosEnviados');
    expect(aud).toHaveLength(1);
    // No dia seguinte, sai de novo.
    await rodarResumoDiario(p, { email: e, urlBase: URL }, dia(10, 7));
    expect(e.enviadas.length).toBe(total * 2);
  });

  it('não envia antes das 7h, depois do meio-dia, no fim de semana, em feriado, sem remetente ou sem endereço do Elo', async () => {
    const e = new EnviadorMemoria('nao-responda@exemplo.local');
    const meios = { email: e, urlBase: URL };
    await rodarResumoDiario(p, meios, dia(9, 6, 45));
    await rodarResumoDiario(p, meios, dia(9, 12));
    await rodarResumoDiario(p, meios, dia(14, 8)); // sábado
    await rodarResumoDiario(p, meios, dia(15, 8)); // domingo
    await rodarResumoDiario(p, { email: null, urlBase: URL }, dia(9, 8));
    await rodarResumoDiario(p, { email: e, urlBase: null }, dia(9, 8));
    await inserir(p, Feriados, { data: '2026-11-10', nome: 'Feriado de teste' }, { email: 'teste' });
    await rodarResumoDiario(p, meios, dia(10, 8));
    expect(e.enviadas).toHaveLength(0);
    expect((await lerTabela(p, ResumosEnviados)).ativos()).toHaveLength(0);
  });

  it('falha ao enviar para uma pessoa não impede as demais', async () => {
    const [reqs] = await lerTabelas(p, [Requisicoes] as const);
    const id = reqs.ativos()[0].id;
    const v = (await lerTabela(p, Requisicoes)).porId(id)!.versao;
    await decidirRequisicao(p, await como('coord.educacao@exemplo.local'), id, v, 'devolver', 'Ajustar', { agora: dia(2, 10) });
    await enviarRequisicao(p, await como('financeiro@exemplo.local'), ficha(), { agora: dia(9, 6) });
    const enviadas: MensagemEmail[] = [];
    const enviador = {
      remetente: 'nao-responda@exemplo.local',
      async enviar(m: MensagemEmail) {
        if (m.para?.[0] === 'financeiro@exemplo.local') throw new Error('falhou');
        enviadas.push(m);
      },
    };
    const r = await rodarResumoDiario(p, { email: enviador, urlBase: URL }, dia(9, 7));
    expect(r.falhas).toBe(1);
    expect(r.enviados).toBe(enviadas.length);
    expect(enviadas.map((m) => m.para?.[0])).toContain('coord.educacao@exemplo.local');
  });
});

describe('texto do resumo', () => {
  it('só as contagens maiores que zero, no singular e no plural', () => {
    const t = conteudoDoResumo({ aprovar: 2, devolvidas: 0, atrasadas: 1 }, URL).texto;
    expect(t).toContain('2 requisições aguardam a sua aprovação');
    expect(t).toContain('1 requisição está atrasada');
    expect(t).not.toContain('devolvida');
  });
});
