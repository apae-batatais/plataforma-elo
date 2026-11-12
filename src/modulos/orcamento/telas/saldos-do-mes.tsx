'use client';

/**
 * Saldos do mês: uma linha por conta, agrupada por classe. Os totais mudam
 * enquanto a pessoa digita (conta feita no navegador, só para acompanhar);
 * o total oficial é o que o servidor calcula depois de salvar.
 *
 * Os campos ficam fora do <form> e se ligam a ele pelo atributo `form`:
 * assim os formulários de ajuste, que também são formulários, cabem nas linhas.
 */
import { useEffect, useRef, useState } from 'react';
import { estiloBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { Etiqueta, tabela } from '@/ui/pagina';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { CLASSES, lerValorEmReais, ROTULO_CLASSE, ROTULO_TIPO, type Classe, type TipoConta } from '../dominio/tesouraria';
import { reais } from './formato';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export interface AjusteTela {
  id: string;
  versao: number;
  valor: number;
  motivo: string;
}

export interface LinhaTela {
  contaId: string;
  descricao: string;
  tipo: TipoConta;
  classe: Classe;
  fonte: string | null;
  excluida: boolean;
  saldo: number | null;
  versao: number | null;
  saldoAnterior: number | null;
  ajustes: AjusteTela[];
}

type Acao = (f: FormData) => void | Promise<void>;

const MSG_VALOR = 'Use números, como 1.234,56.';
const ID_FORM = 'form-saldos';
const emCentavos = (v: number) => Math.round(v * 100);
const textoInicial = (v: number | null) => (v === null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }));

export function SaldosDoMes({
  mes,
  rotuloMes,
  rotuloMesAnterior,
  linhas,
  totaisAnterior,
  podeEditar,
  salvouAgora,
  salvar,
  incluirAjuste,
  tirarAjuste,
}: {
  mes: string;
  rotuloMes: string;
  rotuloMesAnterior: string;
  linhas: LinhaTela[];
  totaisAnterior: Record<Classe, number>;
  podeEditar: boolean;
  /** A página acabou de voltar de um salvamento que deu certo: o rascunho não vale mais. */
  salvouAgora: boolean;
  salvar: Acao;
  incluirAjuste: Acao;
  tirarAjuste: Acao;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(linhas.map((l) => [l.contaId, textoInicial(l.saldo)])));
  const [enviando, setEnviando] = useState(false);
  const [recuperado, setRecuperado] = useState(false);
  /** Contas cujo rascunho foi descartado porque o saldo gravado mudou depois da digitação. */
  const [alteradas, setAlteradas] = useState<Set<string>>(() => new Set());
  const chaveRascunho = `elo:orcamento:saldos:${mes}`;
  // O aviso fica guardado à parte: a página pode ser montada de novo (redirect) antes de a pessoa vê-lo.
  const chaveAvisos = `${chaveRascunho}:avisos`;
  const iniciais = useRef(textos);

  // Rascunho do que foi digitado e ainda não foi salvo: sobrevive à recarga da página
  // (erro ao salvar, ajuste adicionado ou tirado). Guarda só os campos editados, cada um
  // com o saldo gravado que a pessoa via ao digitar (`base`). Sem armazenamento, a tela funciona igual.
  useEffect(() => {
    try {
      if (salvouAgora || !podeEditar) {
        sessionStorage.removeItem(chaveRascunho);
        sessionStorage.removeItem(chaveAvisos);
        return;
      }
      const bruto = sessionStorage.getItem(chaveRascunho);
      const rascunho = bruto ? (JSON.parse(bruto) as Record<string, { texto?: unknown; base?: unknown } | null>) : null;
      const avisosGuardados = JSON.parse(sessionStorage.getItem(chaveAvisos) ?? '[]') as unknown;
      const descartados = new Set<string>(Array.isArray(avisosGuardados) ? avisosGuardados.filter((x): x is string => typeof x === 'string') : []);
      if (!rascunho || typeof rascunho !== 'object') {
        setAlteradas(new Set(linhas.filter((l) => descartados.has(l.contaId)).map((l) => l.contaId)));
        return;
      }
      const mantidos: Record<string, string> = {};
      for (const l of linhas) {
        const campo = rascunho[l.contaId];
        if (!campo || typeof campo.texto !== 'string') continue;
        if ((campo.base ?? null) === l.saldo) mantidos[l.contaId] = campo.texto;
        else descartados.add(l.contaId);
      }
      if (Object.keys(mantidos).length > 0) {
        setTextos((atual) => ({ ...atual, ...mantidos }));
        setRecuperado(true);
      } else {
        sessionStorage.removeItem(chaveRascunho);
      }
      if (descartados.size > 0) sessionStorage.setItem(chaveAvisos, JSON.stringify([...descartados]));
      setAlteradas(new Set(linhas.filter((l) => descartados.has(l.contaId)).map((l) => l.contaId)));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
    // roda só ao abrir a tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Primeira passagem (textos ainda é o objeto inicial): não mexe no rascunho antes de restaurar.
    if (textos === iniciais.current || !podeEditar) return;
    try {
      const editados: Record<string, { texto: string; base: number | null }> = {};
      for (const l of linhas) {
        const t = textos[l.contaId] ?? '';
        if (lerValorEmReais(t) !== lerValorEmReais(iniciais.current[l.contaId] ?? '')) editados[l.contaId] = { texto: t, base: l.saldo };
      }
      const avisos = JSON.parse(sessionStorage.getItem(chaveAvisos) ?? '[]') as string[];
      const restantes = avisos.filter((id) => !(id in editados));
      if (restantes.length > 0) sessionStorage.setItem(chaveAvisos, JSON.stringify(restantes));
      else sessionStorage.removeItem(chaveAvisos);
      if (Object.keys(editados).length > 0) sessionStorage.setItem(chaveRascunho, JSON.stringify(editados));
      else sessionStorage.removeItem(chaveRascunho);
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  }, [textos, linhas, chaveRascunho, chaveAvisos, podeEditar]);

  const lido = (l: LinhaTela) => lerValorEmReais(textos[l.contaId] ?? '');
  const algumInvalido = podeEditar && linhas.some((l) => lido(l) === 'invalido');

  // Valor vazio não apaga o saldo já gravado (o servidor ignora), então conta o gravado.
  const contribuicao = (l: LinhaTela) => {
    const v = lido(l);
    const saldo = typeof v === 'number' ? v : (l.saldo ?? 0);
    return emCentavos(saldo) + l.ajustes.reduce((s, a) => s + emCentavos(a.valor), 0);
  };
  const totais = Object.fromEntries(CLASSES.map((c) => [c, linhas.filter((l) => l.classe === c).reduce((s, l) => s + contribuicao(l), 0) / 100])) as Record<Classe, number>;
  const geral = CLASSES.reduce((s, c) => s + emCentavos(totais[c]), 0) / 100;
  const geralAnterior = CLASSES.reduce((s, c) => s + emCentavos(totaisAnterior[c]), 0) / 100;

  return (
    <div className="space-y-6">
      <form
        id={ID_FORM}
        action={async (f) => {
          setEnviando(true);
          try {
            await salvar(f);
          } finally {
            setEnviando(false);
          }
        }}
        onSubmit={(e) => {
          if (algumInvalido) e.preventDefault();
        }}
      >
        <input type="hidden" name="mes" value={mes} />
      </form>

      <section aria-labelledby="titulo-totais" className={`${tabela.moldura}`}>
        <table className={`${tabela.tabela} min-w-[28rem]`}>
          <caption id="titulo-totais" className="px-4 py-3 text-left text-base font-bold">
            Totais de {rotuloMes}
          </caption>
          <thead className={tabela.cabeca}>
            <tr>
              <th className={tabela.th}>Classe</th>
              <th className={`${tabela.th} text-right`}>{rotuloMes}</th>
              <th className={`${tabela.th} text-right`}>{rotuloMesAnterior}</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((c) => (
              <tr key={c} className={tabela.linha}>
                <th scope="row" className={`${tabela.td} font-semibold`}>
                  {ROTULO_CLASSE[c]}
                </th>
                <td className={`${tabela.td} ${tabela.numero}`}>{reais(totais[c])}</td>
                <td className={`${tabela.td} ${tabela.numero} text-texto-suave`}>{reais(totaisAnterior[c])}</td>
              </tr>
            ))}
            <tr className="bg-superficie-2 font-bold">
              <th scope="row" className={tabela.td}>
                Total geral
              </th>
              <td className={`${tabela.td} ${tabela.numero}`}>{reais(geral)}</td>
              <td className={`${tabela.td} ${tabela.numero} text-texto-suave`}>{reais(geralAnterior)}</td>
            </tr>
          </tbody>
        </table>
        {podeEditar && <p className="border-t border-borda px-4 py-2 text-sm text-texto-suave">Os totais mudam enquanto você digita. O total oficial é calculado pelo Elo quando você salva.</p>}
      </section>

      {recuperado && (
        <p role="status" className="rounded-md border border-borda bg-superficie-2 px-4 py-2 text-sm">
          Recuperamos os valores que você digitou e ainda não salvou.
        </p>
      )}

      {linhas.length === 0 && <p className="text-texto-suave">Nenhuma conta cadastrada. Cadastre em Contas.</p>}

      {CLASSES.map((classe) => {
        const daClasse = linhas.filter((l) => l.classe === classe);
        if (daClasse.length === 0) return null;
        return (
          <section key={classe} aria-labelledby={`classe-${classe}`}>
            <h2 id={`classe-${classe}`} className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-lg font-bold">
              <span>{ROTULO_CLASSE[classe]}</span>
              <span className="text-base font-semibold text-texto-suave">
                Total em {rotuloMes}: <span className="tabular-nums text-texto">{reais(totais[classe])}</span>
              </span>
            </h2>
            <div className={tabela.moldura}>
              <table className={`${tabela.tabela} min-w-[44rem]`}>
                <thead className={tabela.cabeca}>
                  <tr>
                    <th className={tabela.th}>Conta</th>
                    <th className={`${tabela.th} text-right`}>Saldo de {rotuloMesAnterior}</th>
                    <th className={tabela.th}>Saldo de {rotuloMes}</th>
                    <th className={tabela.th}>Ajustes de {rotuloMes}</th>
                  </tr>
                </thead>
                <tbody>
                  {daClasse.map((l) => {
                    const v = lido(l);
                    const invalido = v === 'invalido';
                    const idCampo = `saldo-${l.contaId}`;
                    return (
                      <PiscaOndeMudou key={l.contaId} chave={`saldo:${l.contaId}`} como="tr" className={tabela.linha}>
                        <th scope="row" className={`${tabela.td} font-normal`}>
                          <span className="font-semibold">{l.descricao}</span>
                          <span className="mt-0.5 block text-xs text-texto-suave">
                            {ROTULO_TIPO[l.tipo]}
                            {l.fonte ? ` · ${l.fonte}` : ''}
                          </span>
                          {l.excluida && (
                            <span className="mt-1 inline-block">
                              <Etiqueta tipo="neutro">Conta excluída</Etiqueta>
                            </span>
                          )}
                        </th>
                        <td className={`${tabela.td} ${tabela.numero} text-texto-suave`}>{l.saldoAnterior === null ? '—' : reais(l.saldoAnterior)}</td>
                        <td className={tabela.td}>
                          {podeEditar ? (
                            <>
                              <label htmlFor={idCampo} className="sr-only">
                                Saldo de {l.descricao} em {rotuloMes}
                              </label>
                              <input
                                id={idCampo}
                                form={ID_FORM}
                                name={`saldo_${l.contaId}`}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Não informado"
                                value={textos[l.contaId] ?? ''}
                                onChange={(e) => setTextos((t) => ({ ...t, [l.contaId]: e.target.value }))}
                                aria-invalid={invalido || undefined}
                                aria-describedby={invalido ? `${idCampo}-erro` : undefined}
                                className={`${estiloEntrada} !mt-0 min-w-36 text-right tabular-nums ${invalido ? '!border-erro' : ''}`}
                              />
                              {l.versao !== null && <input type="hidden" form={ID_FORM} name={`versao_${l.contaId}`} value={l.versao} />}
                              {alteradas.has(l.contaId) && lido(l) === (lerValorEmReais(textoInicial(l.saldo)) ?? null) && (
                                <p role="status" className="mt-1 text-sm text-aviso">
                                  O saldo desta conta foi alterado por outra pessoa depois que você digitou. Confira antes de salvar.
                                </p>
                              )}
                              {invalido && (
                                <p id={`${idCampo}-erro`} role="alert" className="mt-1 text-sm text-erro">
                                  {MSG_VALOR}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className={`${tabela.numero} block`}>{l.saldo === null ? 'Não informado' : reais(l.saldo)}</span>
                          )}
                        </td>
                        <td className={tabela.td}>
                          <ul className="space-y-1">
                            {l.ajustes.map((a) => (
                              <li key={a.id} className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold tabular-nums">{reais(a.valor)}</span>
                                <span className="text-texto-suave">{a.motivo}</span>
                                {podeEditar && (
                                  <FormularioConfirmado
                                    acao={tirarAjuste}
                                    campos={{ id: a.id, versao: a.versao, mes }}
                                    rotulo="Tirar"
                                    variante="fantasma"
                                    pequeno
                                    titulo="Tirar este ajuste?"
                                    mensagem={`O ajuste de ${reais(a.valor)} (${a.motivo}) deixa de entrar nos totais de ${rotuloMes}. Ele não é apagado: fica registrado.`}
                                    confirmar="Tirar ajuste"
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                          {podeEditar && !l.excluida && (
                            <div className={l.ajustes.length ? 'mt-2' : ''}>
                              <JanelaFormulario
                                rotulo={
                                  <>
                                    <IconeMais tamanho={14} /> Adicionar ajuste
                                  </>
                                }
                                variante="fantasma"
                                className="!min-h-8 !px-2 !py-1 !text-sm"
                                titulo={`Adicionar ajuste em ${l.descricao}`}
                                descricao={`Ajuste de conciliação de ${rotuloMes}. Use valor negativo para diminuir. Os saldos digitados e ainda não salvos voltam depois de gravar o ajuste.`}
                              >
                                <form action={incluirAjuste} className="space-y-4">
                                  <input type="hidden" name="mes" value={mes} />
                                  <input type="hidden" name="conta_id" value={l.contaId} />
                                  <Campo rotulo="Valor do ajuste" obrigatorio dica="Ex.: 150,00 ou -150,00.">
                                    <input name="valor" required inputMode="decimal" autoComplete="off" className={estiloEntrada} />
                                  </Campo>
                                  <Campo rotulo="Motivo" obrigatorio>
                                    <input name="motivo" required className={estiloEntrada} />
                                  </Campo>
                                  <BotaoEnviar enviando="Salvando…" className="w-full">
                                    Adicionar ajuste
                                  </BotaoEnviar>
                                </form>
                              </JanelaFormulario>
                            </div>
                          )}
                          {!podeEditar && l.ajustes.length === 0 && <span className="text-texto-suave">—</span>}
                        </td>
                      </PiscaOndeMudou>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {podeEditar && linhas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" form={ID_FORM} disabled={algumInvalido || enviando} aria-busy={enviando || undefined} className={estiloBotao('primario')}>
            {enviando ? 'Salvando…' : 'Salvar saldos do mês'}
          </button>
          {algumInvalido && <span className="text-sm text-erro">{MSG_VALOR} Corrija os campos marcados para salvar.</span>}
        </div>
      )}
    </div>
  );
}
