/**
 * Casos de uso do passivo trabalhista (P2 da #126).
 *
 * Quem vê o quê:
 * - orcamento.folha.ver: passivo por serviço e por fonte (só o escopo de cada um), sem nomes.
 * - orcamento.folha.ver_individual: valor por pessoa; abrir a lista registra auditoria de leitura.
 * - orcamento.folha.editar: férias já tiradas e extrato do FGTS (auditoria com colunas, nunca valores).
 * Cedidos não entram: só postos da aba Funcionarios com código (ficha).
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { centavos, calcularLinha, distribuir, situacaoRateio, type LinhaRateio } from '../dominio/folha';
import { calcularPassivo, validarFeriasTiradas, validarSaldoFgts, type PassivoDaPessoa } from '../dominio/passivo';
import { FeriasTiradas, Fontes, FontesFolha, SaldoFGTS, type RegPosto } from '../dados/tabelas';
import { ErroValidacaoFolha, lerFolha, type FolhaLida } from './folha';
import { fontesDaFolhaVigentes } from './previsao';

const PERM = { ver: 'orcamento.folha.ver', individual: 'orcamento.folha.ver_individual', editar: 'orcamento.folha.editar' } as const;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SEM_LOTACAO = '__sem_lotacao__';
const SEM_FONTE = '__sem_fonte__';

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

interface Pessoa {
  posto: RegPosto;
  passivo: PassivoDaPessoa;
  /** Lotação vigente na data; vazia = sem lotação válida. */
  rateio: LinhaRateio[];
}
interface Calculo {
  pessoas: Pessoa[];
  semDados: RegPosto[];
}

type Ajustes = { ferias: Map<string, { inicio: string; dias: number }[]>; saldos: Map<string, { referencia: string; valor: number }> };

/** Passivo de todos os postos com código ativos na data. Dado ausente vai para `semDados`, nunca vira zero. */
function calcularTodos(f: FolhaLida, aj: Ajustes, data: string): Calculo {
  const [ano, mes] = data.split('-').map(Number);
  const mesRef = ano === f.parametros.ano ? mes : ano < f.parametros.ano ? 1 : 12;
  const pessoas: Pessoa[] = [];
  const semDados: RegPosto[] = [];
  for (const posto of f.postos) {
    if (!posto.ficha) continue;
    if (posto.inicio > data || (posto.desligamento && posto.desligamento < data)) continue;
    const c = f.componentesEm(posto.id, ano < f.parametros.ano ? f.parametros.ano : ano, mesRef) ?? f.componentes(posto.id);
    if (!c) {
      semDados.push(posto);
      continue;
    }
    const calc = calcularLinha(c, posto.carga_horaria, f.parametros, mesRef === 1 && ano < f.parametros.ano ? 0 : mesRef);
    const remuneracao = calc.salarioBase + c.adicional_salarial + calc.horaAtividade + c.insalubridade + c.periculosidade + c.gratificacao_funcao;
    if (remuneracao <= 0) {
      semDados.push(posto);
      continue;
    }
    const baseDoMes = (a: number, m: number) => {
      const cm = f.componentesEm(posto.id, a, m) ?? c;
      const l = calcularLinha(cm, posto.carga_horaria, f.parametros, a === f.parametros.ano ? m : a < f.parametros.ano ? 0 : 12);
      return l.salarioBase + cm.adicional_salarial + l.horaAtividade + cm.insalubridade + l.tercoFerias + l.decimoTerceiro;
    };
    const passivo = calcularPassivo({
      inicio: posto.inicio,
      ate: data,
      remuneracao,
      gozadas: aj.ferias.get(posto.id) ?? [],
      decimoCalendario: f.calendario.decimo,
      fgts: { baseDoMes, aliquota: f.parametros.fgts, extrato: aj.saldos.get(posto.id) },
      parametros: f.parametros,
    });
    const rateio = f.rateio(posto.id, mesRef);
    pessoas.push({ posto, passivo, rateio: situacaoRateio(rateio) === 'ok' ? rateio! : [] });
  }
  return { pessoas, semDados };
}

async function lerAjustes(p: Planilhas): Promise<Ajustes> {
  const [ferias, saldos] = await lerTabelas(p, [FeriasTiradas, SaldoFGTS] as const);
  const mf = new Map<string, { inicio: string; dias: number }[]>();
  for (const x of ferias.ativos()) mf.set(x.posto_id, [...(mf.get(x.posto_id) ?? []), { inicio: x.inicio, dias: x.dias }]);
  const ms = new Map<string, { referencia: string; valor: number; criado_em: string }>();
  for (const x of saldos.ativos()) {
    const atual = ms.get(x.posto_id);
    if (!atual || x.referencia > atual.referencia || (x.referencia === atual.referencia && x.criado_em > atual.criado_em)) ms.set(x.posto_id, { referencia: x.referencia, valor: x.valor, criado_em: x.criado_em });
  }
  return { ferias: mf, saldos: ms };
}

export interface LinhaPassivoPessoa {
  id: string;
  nome: string;
  cargo: string;
  total: number;
  ferias: number;
  decimo: number;
  aviso: number;
  multa: number;
  emDobro: boolean;
}

export interface ResultadoSimulacao {
  tipo: 'servico' | 'fonte';
  codigo: string;
  nome: string;
  data: string;
  /** Parcela do passivo atribuída ao serviço ou à fonte (passivo de cada pessoa × percentual). */
  parcela: number;
  total: number;
  pessoasInteiras: number;
  pessoasEmParte: number;
  /** Só com valor individual. */
  pessoas: { nome: string; percentual: number; valor: number }[] | null;
}

export interface PainelPassivo {
  data: string;
  total: number;
  composicao: { ferias: number; decimo: number; aviso: number; multa: number };
  pessoasCalculadas: number;
  porServico: { codigo: string; nome: string; valor: number }[];
  porFonte: { id: string; nome: string; valor: number }[];
  pendencias: { semDados: number; emDobro: number; pessoas: { id: string; nome: string; motivo: 'sem_dados' | 'em_dobro' }[] | null };
  pessoas: LinhaPassivoPessoa[] | null;
  opcoes: { servicos: { codigo: string; nome: string }[]; fontes: { id: string; nome: string }[] };
  simulacao: ResultadoSimulacao | null;
  erroSimulacao: string | null;
  podeVerIndividual: boolean;
  podeEditar: boolean;
}

export interface PedidoSimulacao {
  tipo: 'servico' | 'fonte';
  codigo: string;
  data: string;
}

export async function painelDePassivo(p: Planilhas, quem: Autorizador, pedido?: PedidoSimulacao | null): Promise<PainelPassivo> {
  if (!quem.temPermissaoAlgumEscopo(PERM.ver)) throw new ErroPermissao();
  const [f, aj, fontesT, fontesFolhaT] = await Promise.all([lerFolha(p), lerAjustes(p), lerTabelas(p, [Fontes] as const), lerTabelas(p, [FontesFolha] as const)]);
  const [fontes] = fontesT;
  const [fontesFolha] = fontesFolhaT;
  const todas = quem.temPermissao(PERM.ver);
  const individual = quem.temPermissao(PERM.individual);
  const ve = (servico: string) => (servico === SEM_LOTACAO ? todas : todas || quem.temPermissao(PERM.ver, { tipo: 'servico', codigo: servico }));
  const nomeServico = new Map(f.todosCentros.map((c) => [c.codigo, c.nome]));
  const nomeFonte = new Map(fontes.todos().map((x) => [x.id, x.nome]));
  const fonteDe = new Map(fontesDaFolhaVigentes(fontesFolha.ativos().filter((x) => x.ano === f.parametros.ano)).map((x) => [x.servico, x.fonte_id ?? SEM_FONTE]));

  const data = hojeBrasilia();
  const calculo = calcularTodos(f, aj, data);
  const partesVisiveis = (pe: Pessoa) => {
    const linhas = pe.rateio.length ? pe.rateio : [{ centro: SEM_LOTACAO, percentual: 100 }];
    return distribuir(pe.passivo.total, linhas);
  };

  const porServico = new Map<string, number>();
  const porFonte = new Map<string, number>();
  const composicao = { ferias: 0, decimo: 0, aviso: 0, multa: 0 };
  let total = 0;
  let calculadas = 0;
  const lista: LinhaPassivoPessoa[] = [];
  const pendentes: { id: string; nome: string; motivo: 'sem_dados' | 'em_dobro' }[] = [];
  let emDobro = 0;
  for (const pe of calculo.pessoas) {
    const partes = partesVisiveis(pe);
    let visivel = 0;
    for (const [servico, valor] of partes) {
      if (!ve(servico)) continue;
      visivel += valor;
      porServico.set(servico, (porServico.get(servico) ?? 0) + valor);
      const fonte = servico === SEM_LOTACAO ? SEM_FONTE : (fonteDe.get(servico) ?? SEM_FONTE);
      porFonte.set(fonte, (porFonte.get(fonte) ?? 0) + valor);
    }
    if (visivel <= 0) continue;
    calculadas += 1;
    total += visivel;
    const peso = pe.passivo.total > 0 ? visivel / pe.passivo.total : 0;
    composicao.ferias += pe.passivo.valorFerias * peso;
    composicao.decimo += pe.passivo.decimo * peso;
    composicao.aviso += pe.passivo.aviso * peso;
    composicao.multa += pe.passivo.multaFgts * peso;
    if (pe.passivo.ferias.emDobro) {
      emDobro += 1;
      pendentes.push({ id: pe.posto.id, nome: pe.posto.colaborador ?? 'Sem nome', motivo: 'em_dobro' });
    }
    if (individual) {
      lista.push({
        id: pe.posto.id,
        nome: pe.posto.colaborador ?? 'Sem nome',
        cargo: pe.posto.cargo,
        total: pe.passivo.total,
        ferias: pe.passivo.valorFerias,
        decimo: pe.passivo.decimo,
        aviso: pe.passivo.aviso,
        multa: pe.passivo.multaFgts,
        emDobro: pe.passivo.ferias.emDobro,
      });
    }
  }
  // Sem dados: pessoa sem lotação conhecida só entra na contagem de quem vê tudo.
  const semDados = todas ? calculo.semDados : [];
  for (const x of semDados) pendentes.push({ id: x.id, nome: x.colaborador ?? 'Sem nome', motivo: 'sem_dados' });

  const arred = (m: Map<string, number>) => [...m].map(([k, v]) => [k, centavos(v)] as const).sort((a, b) => b[1] - a[1]);
  const opcoes = {
    servicos: f.centros.filter((c) => ve(c.codigo)).map((c) => ({ codigo: c.codigo, nome: c.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    fontes: fontes.ativos().map((x) => ({ id: x.id, nome: x.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };

  let simulacao: ResultadoSimulacao | null = null;
  let erroSimulacao: string | null = null;
  if (pedido) {
    if (!DATA.test(pedido.data)) erroSimulacao = 'Informe a data de término.';
    else if (pedido.tipo === 'servico' && !opcoes.servicos.some((s) => s.codigo === pedido.codigo)) erroSimulacao = 'Escolha um serviço da lista.';
    else if (pedido.tipo === 'fonte' && !opcoes.fontes.some((x) => x.id === pedido.codigo)) erroSimulacao = 'Escolha um termo ou fonte da lista.';
    else {
      const sim = calcularTodos(f, aj, pedido.data);
      const peso = (pe: Pessoa) =>
        pe.rateio.reduce((s, l) => {
          if (!ve(l.centro)) return s;
          const alvo = pedido.tipo === 'servico' ? l.centro === pedido.codigo : (fonteDe.get(l.centro) ?? SEM_FONTE) === pedido.codigo;
          return alvo ? s + l.percentual : s;
        }, 0);
      let parcela = 0;
      let totalSim = 0;
      let inteiras = 0;
      let partes = 0;
      const detalhe: NonNullable<ResultadoSimulacao['pessoas']> = [];
      for (const pe of sim.pessoas) {
        const w = peso(pe);
        const visivelTotal = pe.rateio.reduce((s, l) => (ve(l.centro) ? s + l.percentual : s), 0);
        if (!pe.rateio.length ? todas : visivelTotal > 0) totalSim += (pe.passivo.total * (pe.rateio.length ? visivelTotal : 100)) / 100;
        if (w <= 0) continue;
        const valor = centavos((pe.passivo.total * w) / 100);
        parcela += valor;
        if (w >= 99.995) inteiras += 1;
        else partes += 1;
        detalhe.push({ nome: pe.posto.colaborador ?? 'Sem nome', percentual: w, valor });
      }
      simulacao = {
        tipo: pedido.tipo,
        codigo: pedido.codigo,
        nome: (pedido.tipo === 'servico' ? nomeServico.get(pedido.codigo) : nomeFonte.get(pedido.codigo)) ?? pedido.codigo,
        data: pedido.data,
        parcela: centavos(parcela),
        total: centavos(totalSim),
        pessoasInteiras: inteiras,
        pessoasEmParte: partes,
        pessoas: individual ? detalhe.sort((a, b) => b.valor - a.valor) : null,
      };
    }
  }

  if (individual) await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'Passivo', detalhes: { lista: true } });
  return {
    data,
    total: centavos(total),
    composicao: { ferias: centavos(composicao.ferias), decimo: centavos(composicao.decimo), aviso: centavos(composicao.aviso), multa: centavos(composicao.multa) },
    pessoasCalculadas: calculadas,
    porServico: arred(porServico).map(([codigo, valor]) => ({ codigo, nome: codigo === SEM_LOTACAO ? 'Sem lotação' : (nomeServico.get(codigo) ?? codigo), valor })),
    porFonte: arred(porFonte).map(([id, valor]) => ({ id, nome: id === SEM_FONTE ? 'A definir' : (nomeFonte.get(id) ?? id), valor })),
    pendencias: { semDados: semDados.length, emDobro, pessoas: individual ? pendentes : null },
    pessoas: individual ? lista.sort((a, b) => b.total - a.total) : null,
    opcoes,
    simulacao,
    erroSimulacao,
    podeVerIndividual: individual,
    podeEditar: quem.temPermissao(PERM.editar),
  };
}

// ---------------------------------------------------------------------------
// Ajustes por pessoa (férias já tiradas e extrato do FGTS)
// ---------------------------------------------------------------------------

export interface AjustesDaPessoa {
  ferias: { id: string; versao: number; inicio: string; dias: number; observacao: string | null }[];
  saldo: { referencia: string; valor: number } | null;
  podeEditar: boolean;
}

export async function ajustesDaPessoa(p: Planilhas, quem: Autorizador, postoId: string): Promise<AjustesDaPessoa> {
  if (!quem.temPermissao(PERM.individual)) throw new ErroPermissao();
  const [ferias, saldos] = await lerTabelas(p, [FeriasTiradas, SaldoFGTS] as const);
  const aj = await lerAjustes(p);
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'SaldoFGTS', registroId: postoId });
  const s = aj.saldos.get(postoId);
  void saldos;
  return {
    ferias: ferias
      .ativos()
      .filter((x) => x.posto_id === postoId)
      .sort((a, b) => b.inicio.localeCompare(a.inicio))
      .map((x) => ({ id: x.id, versao: x.versao, inicio: x.inicio, dias: x.dias, observacao: x.observacao })),
    saldo: s ? { referencia: s.referencia, valor: s.valor } : null,
    podeEditar: quem.temPermissao(PERM.editar),
  };
}

async function admissaoDe(p: Planilhas, postoId: string): Promise<string> {
  const f = await lerFolha(p);
  const posto = f.postos.find((x) => x.id === postoId);
  if (!posto) throw new ErroValidacaoFolha('Funcionário não encontrado.');
  return posto.inicio;
}

export async function registrarFeriasTiradas(p: Planilhas, quem: Autorizador, d: { postoId: string; inicio: string; dias: number; observacao?: string | null }): Promise<void> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  const erros = validarFeriasTiradas(d, await admissaoDe(p, d.postoId));
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' '));
  const r = await inserir(p, FeriasTiradas, { posto_id: d.postoId, inicio: d.inicio, dias: d.dias, observacao: d.observacao?.trim() || null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'FeriasTiradas', registroId: r.id, detalhes: { colunas: ['inicio', 'dias'] } });
}

/** Remover encerra o registro (ativo = FALSE); nada é apagado. */
export async function removerFeriasTiradas(p: Planilhas, quem: Autorizador, id: string, versao: number): Promise<void> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  await atualizar(p, FeriasTiradas, id, versao, { ativo: false }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'encerramento', entidade: 'FeriasTiradas', registroId: id, detalhes: { colunas: ['ativo'] } });
}

export async function registrarSaldoFgts(p: Planilhas, quem: Autorizador, d: { postoId: string; referencia: string; valor: number; observacao?: string | null }): Promise<void> {
  if (!quem.temPermissao(PERM.editar)) throw new ErroPermissao();
  const erros = validarSaldoFgts(d, await admissaoDe(p, d.postoId));
  if (erros.length) throw new ErroValidacaoFolha(erros.join(' '));
  const r = await inserir(p, SaldoFGTS, { posto_id: d.postoId, referencia: d.referencia, valor: d.valor, observacao: d.observacao?.trim() || null }, { email: quem.email });
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'SaldoFGTS', registroId: r.id, detalhes: { colunas: ['referencia', 'valor'] } });
}
