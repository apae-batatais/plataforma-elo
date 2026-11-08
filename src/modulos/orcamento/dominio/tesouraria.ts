/**
 * Regras puras da tesouraria (Entrega 1D.1): contas, saldos de fim de mês e
 * totais por classe. Nada aqui lê ou grava dados.
 */

export const CLASSES = ['livre_disponivel', 'reserva', 'vinculada'] as const;
export type Classe = (typeof CLASSES)[number];
export const ROTULO_CLASSE: Record<Classe, string> = {
  livre_disponivel: 'Livre disponível',
  reserva: 'Reserva',
  vinculada: 'Vinculada',
};

export const TIPOS_CONTA = ['movimento', 'aplicacao', 'caixa'] as const;
export type TipoConta = (typeof TIPOS_CONTA)[number];
export const ROTULO_TIPO: Record<TipoConta, string> = {
  movimento: 'Conta movimento',
  aplicacao: 'Aplicação',
  caixa: 'Caixa',
};

const arred = (v: number) => Math.round(v * 100) / 100;

/** Mês no formato AAAA-MM. */
export function mesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** Mês atual no horário de Brasília (UTC−3), nunca o de UTC. */
export function mesAtualBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  return m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Lê um valor digitado no formato brasileiro ("1.234,56", "-150,00", "R$ 2.000").
 * Vazio quer dizer "não informado" (null); texto que não é número é 'invalido'.
 * O resultado é arredondado em centavos.
 */
export function lerValorEmReais(texto: string): number | null | 'invalido' {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s+/g, '');
  if (limpo === '') return null;
  const m = /^([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(limpo);
  if (!m) return 'invalido';
  const numero = Number(`${m[2].replace(/\./g, '')}.${m[3] ?? '0'}`);
  if (!Number.isFinite(numero)) return 'invalido';
  // toPrecision tira o ruído binário (1.005 × 100 = 100.49999…) antes de arredondar.
  const centavos = Math.round(Number((numero * 100).toPrecision(15)));
  const valor = centavos / 100;
  return m[1] === '-' && valor !== 0 ? -valor : valor;
}

export interface DadosConta {
  banco: string;
  agencia: string;
  conta: string;
  tipo: TipoConta;
  classe: Classe;
  fonteId: string | null;
  unidade: string | null;
}

/** Devolve, nesta ordem, só as mensagens que se aplicam. Vazio = conta válida. */
export function conferirConta(c: DadosConta, fontes: { id: string; uso: 'livre' | 'restrita'; ativo: boolean }[]): string[] {
  const erros: string[] = [];
  const caixa = c.tipo === 'caixa';
  if (!c.banco.trim()) erros.push('Informe o banco.');
  if (!caixa && !c.agencia.trim()) erros.push('Informe a agência.');
  if (!caixa && !c.conta.trim()) erros.push('Informe o número da conta.');
  if (!(TIPOS_CONTA as readonly string[]).includes(c.tipo)) erros.push('Escolha o tipo da conta.');
  if (!(CLASSES as readonly string[]).includes(c.classe)) erros.push('Escolha a classe da conta.');
  if (c.classe === 'vinculada') {
    if (!c.fonteId) erros.push('Conta vinculada precisa da fonte (termo) de onde vem o recurso.');
    else {
      const fonte = fontes.find((f) => f.id === c.fonteId);
      if (fonte && !fonte.ativo) erros.push('A fonte escolhida foi excluída.');
      else if (fonte && fonte.uso !== 'restrita') erros.push('A fonte de uma conta vinculada precisa ter uso restrito.');
    }
  } else if (c.fonteId) {
    erros.push('Só conta vinculada tem fonte.');
  }
  return erros;
}

/**
 * Classe da conta num mês. Entre as mudanças da conta que começam depois do
 * mês, vale a classe anterior da que começa primeiro; sem nenhuma, vale a
 * classe atual da conta.
 */
export function classeNoMes(
  conta: { id: string; classe: Classe },
  mudancas: { conta_id: string; classe_anterior: Classe; a_partir_de: string }[],
  mes: string,
): Classe {
  let primeira: { classe_anterior: Classe; a_partir_de: string } | null = null;
  for (const m of mudancas) {
    if (m.conta_id !== conta.id || m.a_partir_de <= mes) continue;
    if (!primeira || m.a_partir_de < primeira.a_partir_de) primeira = m;
  }
  return primeira ? primeira.classe_anterior : conta.classe;
}

/**
 * Total por classe no mês: saldo de todas as contas que têm saldo naquele mês
 * (ativas ou não) mais os ajustes ativos do mês. Em centavos exatos.
 */
export function totaisPorClasse(
  contas: { id: string; classe: Classe }[],
  saldos: { conta_id: string; mes: string; saldo: number }[],
  ajustes: { conta_id: string; mes: string; valor: number; ativo: boolean }[],
  mes: string,
  mudancas: { conta_id: string; classe_anterior: Classe; a_partir_de: string }[] = [],
): Record<Classe, number> {
  const centavos: Record<Classe, number> = { livre_disponivel: 0, reserva: 0, vinculada: 0 };
  const classeDe = new Map(contas.map((c) => [c.id, classeNoMes(c, mudancas, mes)]));
  for (const s of saldos) {
    const classe = classeDe.get(s.conta_id);
    if (s.mes === mes && classe) centavos[classe] += Math.round(s.saldo * 100);
  }
  for (const a of ajustes) {
    const classe = classeDe.get(a.conta_id);
    if (a.ativo && a.mes === mes && classe) centavos[classe] += Math.round(a.valor * 100);
  }
  return {
    livre_disponivel: arred(centavos.livre_disponivel / 100),
    reserva: arred(centavos.reserva / 100),
    vinculada: arred(centavos.vinculada / 100),
  };
}

/** Ids das contas ativas que não têm saldo informado no mês. */
export function contasSemSaldo(contasAtivas: { id: string }[], saldos: { conta_id: string; mes: string }[], mes: string): string[] {
  const comSaldo = new Set(saldos.filter((s) => s.mes === mes).map((s) => s.conta_id));
  return contasAtivas.filter((c) => !comSaldo.has(c.id)).map((c) => c.id);
}
