import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import type { ItemDaAgenda } from '@/nucleo/modulos/agenda-busca';
import { diaLimite } from '@/modulos/requisicoes/dominio/sla';
import { diasDoMes, ehVencido, lerAgenda, montarAgenda, somarMeses } from '@/plataforma/agenda';
import { buscarTudo } from '@/plataforma/busca';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

const AGORA = new Date('2026-11-14T15:00:00Z');
let p: Planilhas;

async function como(email: string): Promise<Autorizador> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

const item = (o: Partial<ItemDaAgenda>): ItemDaAgenda => ({
  app: 'projetos', tipo: 'Fim previsto', titulo: 'Item', data: '2026-11-20', ate: null, mes: null, servico: null, href: '/x', vencivel: true, ...o,
});

describe('Agenda: composição (regras 4 a 7)', () => {
  const hoje = '2026-11-14';
  it('vencido é prazo vencível no passado; tema, início e parcela nunca vencem', () => {
    expect(ehVencido(item({ data: '2026-11-01' }), hoje)).toBe(true);
    expect(ehVencido(item({ data: '2026-11-14' }), hoje)).toBe(false);
    expect(ehVencido(item({ data: '2026-11-01', vencivel: false }), hoje)).toBe(false);
    expect(ehVencido(item({ data: null, mes: '2026-10' }), hoje)).toBe(false);
  });

  it('vencidos aparecem em qualquer mês e saem da lista do mês', () => {
    const a = montarAgenda([item({ data: '2026-10-05', titulo: 'Velho' }), item({ data: '2026-11-03', titulo: 'Atrasado' })], { mes: '2026-12' }, hoje);
    expect(a.vencidos.map((i) => i.titulo)).toEqual(['Velho', 'Atrasado']);
    expect(a.doMes).toEqual([]);
    const b = montarAgenda([item({ data: '2026-11-03', titulo: 'Atrasado' })], { mes: '2026-11' }, hoje);
    expect(b.doMes).toEqual([]);
    expect(b.naGrade.map((i) => i.titulo)).toEqual(['Atrasado']);
  });

  it('item só com mês vai para "Neste mês", e período aparece em cada dia mas uma vez na lista', () => {
    const tema = item({ app: 'comunicacao', titulo: 'Tema', data: '2026-11-28', ate: '2026-12-02', vencivel: false });
    const parcela = item({ titulo: 'Parcela', data: null, mes: '2026-11', vencivel: false });
    const a = montarAgenda([tema, parcela], { mes: '2026-11' }, hoje);
    expect(a.soMes.map((i) => i.titulo)).toEqual(['Parcela']);
    expect(a.doMes).toHaveLength(1);
    expect(a.porDia.get('2026-11-28')).toHaveLength(1);
    expect(a.porDia.get('2026-11-30')).toHaveLength(1);
    expect(a.porDia.get('2026-11-27')).toHaveLength(0);
    const dez = montarAgenda([tema], { mes: '2026-12' }, hoje);
    expect(dez.porDia.get('2026-12-02')).toHaveLength(1);
    expect(dez.porDia.get('2026-12-03')).toHaveLength(0);
  });

  it('ordena por data, depois app (ordem do menu), depois título', () => {
    const a = montarAgenda(
      [
        item({ app: 'projetos', titulo: 'B', data: '2026-11-20' }),
        item({ app: 'parcerias', titulo: 'Z', data: '2026-11-20' }),
        item({ app: 'projetos', titulo: 'A', data: '2026-11-20' }),
        item({ app: 'projetos', titulo: 'C', data: '2026-11-18' }),
      ],
      { mes: '2026-11' },
      hoje,
    );
    expect(a.doMes.map((i) => i.titulo)).toEqual(['C', 'Z', 'A', 'B']);
  });

  it('filtros combinam; item sem serviço só aparece com "todos os serviços"', () => {
    const itens = [item({ titulo: 'Com', servico: 'ur' }), item({ titulo: 'Sem', servico: null }), item({ titulo: 'Outro', app: 'parcerias', servico: 'ur' })];
    expect(montarAgenda(itens, { mes: '2026-11', servico: 'ur' }, '2026-11-14').doMes.map((i) => i.titulo).sort()).toEqual(['Com', 'Outro']);
    expect(montarAgenda(itens, { mes: '2026-11', servico: 'ur', app: 'projetos' }, '2026-11-14').doMes.map((i) => i.titulo)).toEqual(['Com']);
    const vazio = montarAgenda(itens, { mes: '2026-11', app: 'comunicacao' }, '2026-11-14');
    expect(vazio.semItensNoMes).toBe(true);
    expect(vazio.filtroEsvaziou).toBe(true);
    expect(montarAgenda([], { mes: '2026-11' }, '2026-11-14').filtroEsvaziou).toBe(false);
  });

  it('calcula meses e dias', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(diasDoMes('2026-02')).toHaveLength(28);
  });
});

describe('Prazo de requisição em dia limite', () => {
  it('conta horas úteis, pulando fim de semana e feriado', () => {
    // sexta 2026-11-13 10h Brasília = 13h UTC; 8h úteis (expediente 8-17): 7h na sexta, 1h na segunda.
    expect(diaLimite('2026-11-13T13:00:00Z', 8)).toBe('2026-11-16');
    expect(diaLimite('2026-11-13T13:00:00Z', 8, { inicio: 8, fim: 17, feriados: new Set(['2026-11-16']) })).toBe('2026-11-17');
    expect(diaLimite('2026-11-13T13:00:00Z', 4)).toBe('2026-11-13');
  });
});

describe('Agenda: o que cada perfil vê (regra 2)', () => {
  it('a Diretoria vê itens dos apps com permissão, nunca do Orçamento', async () => {
    const a = await lerAgenda(p, await como('diretoria@exemplo.local'), { agora: AGORA });
    expect(a.falhas).toEqual([]);
    const apps = new Set(a.itens.map((i) => i.app));
    expect(apps.has('orcamento')).toBe(false);
    expect(apps.size).toBeGreaterThanOrEqual(3);
    for (const i of a.itens) expect(i.href.startsWith('/')).toBe(true);
  });

  it('parcela não traz valor', async () => {
    const a = await lerAgenda(p, await como('diretoria@exemplo.local'), { agora: AGORA });
    for (const i of a.itens.filter((x) => x.tipo === 'Parcela')) expect(i.titulo).not.toMatch(/R\$|\d+,\d{2}/);
  });

  it('coordenação de um serviço não vê itens com serviço de outro', async () => {
    const a = await lerAgenda(p, await como('coord.ur@exemplo.local'), { agora: AGORA });
    for (const i of a.itens) if (i.servico) expect(i.servico).toBe('ur');
    const todos = await lerAgenda(p, await como('diretoria@exemplo.local'), { agora: AGORA });
    expect(a.itens.length).toBeLessThanOrEqual(todos.itens.length);
  });

  it('funcionário não recebe Parcerias nem Avaliação e vê em Projetos só o que já vê (os seus)', async () => {
    const a = await lerAgenda(p, await como('funcionario@exemplo.local'), { agora: AGORA });
    const apps = new Set(a.itens.map((i) => i.app));
    for (const id of ['parcerias', 'avaliacao']) expect(apps.has(id)).toBe(false);
    const todos = await lerAgenda(p, await como('diretoria@exemplo.local'), { agora: AGORA });
    expect(a.itens.filter((i) => i.app === 'projetos').length).toBeLessThan(todos.itens.filter((i) => i.app === 'projetos').length);
  });

  it('app desligado some, e app que falha vira aviso sem derrubar os outros', async () => {
    const quem = await como('diretoria@exemplo.local');
    const sem = await lerAgenda(p, quem, { agora: AGORA, desligados: new Set(['parcerias']) });
    expect(sem.itens.some((i) => i.app === 'parcerias')).toBe(false);
    expect(sem.falhas).toEqual([]);
  });
});

describe('Busca única (regras 9 a 13)', () => {
  it('exige 2 letras e não lê nada com menos', async () => {
    const r = await buscarTudo(p, await como('diretoria@exemplo.local'), ' a ', { agora: AGORA });
    expect(r.estado).toBe('curto');
    expect(r.grupos).toEqual([]);
  });

  it('ignora maiúsculas e acentos e agrupa por app', async () => {
    const quem = await como('diretoria@exemplo.local');
    const a = await buscarTudo(p, quem, 'PRJ', { agora: AGORA });
    expect(a.estado).toBe('ok');
    expect(a.grupos.map((g) => g.app)).toContain('projetos');
    const g = a.grupos.find((x) => x.app === 'projetos')!;
    expect(g.resultados.length).toBeLessThanOrEqual(20);
    expect(g.resultados[0].href).toMatch(/^\/projetos\//);
  });

  it('acha requisição pelo número e termo pelo número', async () => {
    const quem = await como('diretoria@exemplo.local');
    const req = await buscarTudo(p, quem, 'req-', { agora: AGORA });
    expect(req.grupos.find((g) => g.app === 'requisicoes')?.resultados[0].href).toMatch(/^\/requisicoes\//);
    const com = await buscarTudo(p, quem, 'com-', { agora: AGORA });
    expect(com.grupos.find((g) => g.app === 'comunicacao')?.resultados[0].href).toMatch(/^\/comunicacao\//);
  });

  it('não busca avaliação (dado sensível) nem nome de solicitante', async () => {
    const quem = await como('diretoria@exemplo.local');
    const [aval] = (await lerTabelas(p, [(await import('@/modulos/avaliacao/dados/tabelas')).Avaliacoes] as const)).map((t) => t.ativos());
    const r = await buscarTudo(p, quem, aval[0].iniciais.toLowerCase() + 'zz', { agora: AGORA });
    expect(r.grupos.some((g) => g.app === 'avaliacao')).toBe(false);
  });

  it('pessoa encontrada grava leitura na auditoria sem o termo', async () => {
    const quem = await como('diretoria@exemplo.local');
    const antes = (await lerTabelas(p, [RegistrosAuditoria] as const))[0].todos().length;
    const nomes = (await import('@/nucleo/pessoas/servico')).listarPessoasVisiveis;
    const alguem = (await nomes(p, quem))[0];
    const termo = alguem.nome.split(' ')[0];
    const r = await buscarTudo(p, quem, termo, { agora: AGORA });
    const grupo = r.grupos.find((g) => g.app === 'nucleo');
    expect(grupo).toBeDefined();
    const regs = (await lerTabelas(p, [RegistrosAuditoria] as const))[0].todos();
    expect(regs.length).toBe(antes + 1);
    const ultimo = regs[regs.length - 1];
    expect(ultimo.acao).toBe('leitura');
    expect(ultimo.entidade).toBe('pessoas');
    expect(ultimo.usuario).toBe('diretoria@exemplo.local');
    expect(ultimo.detalhes).toContain('"origem":"busca"');
    expect(ultimo.detalhes!.toLowerCase()).not.toContain(termo.toLowerCase());
  });

  it('sem permissão de pessoas não há grupo "Pessoas" nem auditoria', async () => {
    const quem = await como('funcionario@exemplo.local');
    const antes = (await lerTabelas(p, [RegistrosAuditoria] as const))[0].todos().length;
    const nomes = (await import('@/nucleo/pessoas/servico')).listarPessoasVisiveis;
    const alguem = (await nomes(p, await como('diretoria@exemplo.local')))[0];
    const r = await buscarTudo(p, quem, alguem.nome.split(' ')[0], { agora: AGORA });
    expect(r.grupos.some((g) => g.app === 'nucleo')).toBe(false);
    expect((await lerTabelas(p, [RegistrosAuditoria] as const))[0].todos().length).toBe(antes);
  });

  it('coordenação só encontra pessoas do seu serviço', async () => {
    const diretoria = await como('diretoria@exemplo.local');
    const coord = await como('coord.ur@exemplo.local');
    const visiveis = new Set((await (await import('@/nucleo/pessoas/servico')).listarPessoasVisiveis(p, coord)).map((x) => x.nome));
    const todas = (await (await import('@/nucleo/pessoas/servico')).listarPessoasVisiveis(p, diretoria)).map((x) => x.nome);
    const fora = todas.find((n) => !visiveis.has(n));
    if (fora) {
      const r = await buscarTudo(p, coord, fora, { agora: AGORA });
      expect(r.grupos.find((g) => g.app === 'nucleo')?.resultados.some((x) => x.titulo === fora) ?? false).toBe(false);
    }
  });
});
