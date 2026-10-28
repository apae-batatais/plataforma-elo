'use client';

/**
 * Importação da planilha da folha em quatro passos:
 * 1. escolher o arquivo; 2. dizer em qual aba estão os dados e o DE-PARA das
 * colunas (folha e lotação); 3. conferir o relatório; 4. confirmar.
 * Nada é gravado antes do passo 4.
 */
import { startTransition, useActionState, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { IconeEnviar } from '@/ui/icones';
import type { Analise } from '../aplicacao/importacao';
import {
  CAMPOS_FOLHA, sugerirColunasFolha, sugerirColunasLotacao,
  type AbaResumida, type CampoFolha, type Mapeamento, type MapeamentoLotacao,
} from '../dominio/importacao';
import { percentual, reais } from './formato';

type EstadoAnalise = { erro?: string; analise?: Analise };
type EstadoArquivo = { erro?: string; abas?: AbaResumida[]; sugestao?: Mapeamento | null };
type Acao<E> = (estado: E, f: FormData) => Promise<E>;

const quem = (x: { ficha: string | null; colaborador: string | null }) =>
  `${x.colaborador ?? 'Vaga prevista'}${x.ficha ? ` (ficha ${x.ficha})` : ''}`;

/** 0 → A, 25 → Z, 26 → AA. */
const letra = (j: number): string => (j < 26 ? String.fromCharCode(65 + j) : letra(Math.floor(j / 26) - 1) + letra(j % 26));

const ocupado = (rotulo: string) => (
  <>
    <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
    {rotulo}
  </>
);

/** Colunas da linha de cabeçalho escolhida, com um exemplo da linha de baixo. */
function colunasDe(aba: AbaResumida | undefined, cabecalho: number) {
  if (!aba) return [];
  const cab = aba.linhas[cabecalho - 1] ?? [];
  const ex = aba.linhas[cabecalho] ?? [];
  return cab.map((titulo, j) => ({ j, titulo, exemplo: ex[j] ?? '' })).filter((c) => c.titulo);
}

const resumoLinha = (l: string[]) => l.filter(Boolean).slice(0, 6).join(' · ') || '(vazia)';

export function ImportarFolha({
  lerArquivo,
  analisar,
  confirmar,
}: {
  lerArquivo: Acao<EstadoArquivo>;
  analisar: Acao<EstadoAnalise>;
  confirmar: Acao<EstadoAnalise>;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, despacharLeitura, lendo] = useActionState(lerArquivo, {});
  const [analise, despacharAnalise, analisando] = useActionState(analisar, {});
  const [confirmacao, enviarConfirmacao, gravando] = useActionState(confirmar, {});
  const [m, setM] = useState<Mapeamento | null>(null);
  const [analisadoCom, setAnalisadoCom] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (leitura.abas?.length) {
      const primeira = leitura.abas[0];
      setM(
        leitura.sugestao ?? {
          folha: { aba: primeira.nome, cabecalho: primeira.cabecalhoSugerido, colunas: {} },
          lotacao: { modo: 'nenhuma' },
        },
      );
      setAnalisadoCom(null);
      setEscolhas({});
    }
  }, [leitura]);

  const comArquivo = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    if (arquivo) f.set('arquivo', arquivo);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  const ler = (novo: File | null) => {
    setArquivo(novo);
    setM(null);
    setAnalisadoCom(null);
    if (!novo) return;
    const f = new FormData();
    f.set('arquivo', novo);
    startTransition(() => despacharLeitura(f));
  };
  const textoM = m ? JSON.stringify(m) : '';
  const rodarAnalise = () => {
    setAnalisadoCom(textoM);
    setEscolhas({});
    startTransition(() => despacharAnalise(comArquivo({ mapeamento: textoM })));
  };

  const a = analisadoCom === textoM && !analisando ? analise.analise : undefined;
  const servicos = a ? a.proposta.servicos.map((x) => ({ ...x, servico: escolhas[x.nome] ?? x.servico })) : [];
  const faltam = servicos.filter((x) => !x.servico).length;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-arquivo">
        <h2 id="t-arquivo" className="text-lg font-bold">1. Escolher o arquivo</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          No Google Drive, abra a planilha da folha e use Arquivo › Fazer download › Microsoft Excel (.xlsx). No passo seguinte você diz em qual
          aba estão os dados e qual coluna corresponde a cada campo. Nada é gravado antes da sua confirmação.
        </p>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Arquivo .xlsx da folha"
          onChange={(e) => ler(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-dashed border-borda-forte bg-superficie-2 p-4 text-sm file:mr-3 file:rounded-md file:border file:border-borda-forte file:bg-superficie file:px-3 file:py-2 file:font-semibold"
        />
        {lendo && <p className="flex items-center gap-2 text-sm text-texto-suave">{ocupado('Lendo as abas do arquivo…')}</p>}
        {leitura.erro && !lendo && (
          <Aviso tipo="erro" titulo="Não deu para ler o arquivo">
            {leitura.erro}
          </Aviso>
        )}
      </section>

      {m && leitura.abas && !lendo && (
        <DePara abas={leitura.abas} m={m} setM={setM}>
          <div className="space-y-3 border-t border-borda pt-4">
            <Botao type="button" onClick={rodarAnalise} disabled={analisando || !arquivo || faltando(m).length > 0}>
              {analisando ? ocupado('Lendo com este DE-PARA…') : (
                <>
                  <IconeEnviar tamanho={18} />
                  Ler a planilha com este DE-PARA
                </>
              )}
            </Botao>
            {faltando(m).length > 0 && <p className="text-sm text-aviso">Falta: {faltando(m).join('; ')}.</p>}
            {analise.erro && analisadoCom === textoM && !analisando && (
              <Aviso tipo="erro" titulo="Não deu para ler com este DE-PARA">
                {analise.erro}
              </Aviso>
            )}
            {analise.analise && analisadoCom !== null && analisadoCom !== textoM && (
              <p className="text-sm text-texto-suave">Você mudou o DE-PARA. Leia a planilha de novo para atualizar o resultado.</p>
            )}
          </div>
        </DePara>
      )}

      {a && <Relatorio analise={a} />}

      {a && (
        <form action={enviarConfirmacao} className="space-y-4 rounded-xl border border-borda bg-superficie p-5">
          <h2 className="text-lg font-bold">4. Confirmar</h2>
          {servicos.length > 0 && (
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-sm">
                Confira a qual <strong>Serviço</strong> corresponde cada lotação da planilha. Os que o app reconheceu já vêm preenchidos.
              </legend>
              {servicos.map((x) => (
                <label key={x.nome} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_20rem]">
                  <span className={x.servico ? '' : 'font-semibold'}>{x.nome}</span>
                  <select
                    required
                    value={x.servico ?? ''}
                    onChange={(e) => setEscolhas({ ...escolhas, [x.nome]: e.target.value })}
                    className={`${estiloEntrada} !mt-0 ${x.servico ? '' : 'border-aviso'}`}
                  >
                    <option value="">Escolha o serviço…</option>
                    {[...new Set(a.opcoes.map((o) => o.area))].map((area) => (
                      <optgroup key={area} label={area}>
                        {a.opcoes
                          .filter((o) => o.area === area)
                          .map((o) => (
                            <option key={o.codigo} value={o.codigo}>
                              {o.nome}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ))}
              {a.opcoes.length === 0 && (
                <Aviso tipo="atencao">Nenhum serviço cadastrado. Cadastre os serviços em Administração › Serviços antes de importar.</Aviso>
              )}
            </fieldset>
          )}
          <input type="hidden" name="proposta" value={JSON.stringify({ ...a.proposta, servicos })} />
          <BotaoEnviar pendente={gravando} disabled={a.proposta.postos.length === 0 || faltam > 0} enviando="Importando…">
            Importar {a.proposta.postos.length} {a.proposta.postos.length === 1 ? 'funcionário' : 'funcionários'}
          </BotaoEnviar>
          {faltam > 0 && (
            <p className="text-sm text-aviso">
              Falta escolher o serviço de {faltam} {faltam === 1 ? 'lotação' : 'lotações'}.
            </p>
          )}
          {confirmacao.erro && (
            <Aviso tipo="erro" titulo="A importação não foi feita">
              {confirmacao.erro}
            </Aviso>
          )}
        </form>
      )}
    </div>
  );
}

/** O que falta escolher no DE-PARA para poder ler. */
function faltando(m: Mapeamento): string[] {
  const f: string[] = [];
  for (const c of CAMPOS_FOLHA.filter((x) => x.obrigatorio)) if (m.folha.colunas[c.chave] === undefined) f.push(`coluna de ${c.rotulo}`);
  if (m.folha.colunas.ficha === undefined && m.folha.colunas.colaborador === undefined) f.push('coluna do Código ou do Nome');
  const l = m.lotacao;
  if (l.modo === 'coluna' && m.folha.colunas.lotacao === undefined) f.push('coluna de Lotação na folha');
  if ((l.modo === 'linhas' || l.modo === 'colunas') && l.funcionario < 0) f.push('coluna do funcionário na lotação');
  if (l.modo === 'linhas' && l.servico < 0) f.push('coluna do serviço na lotação');
  if (l.modo === 'colunas' && l.servicos.length === 0) f.push('colunas de serviço na lotação');
  return f;
}

const GRUPOS = [
  { id: 'identificacao', titulo: 'Identificação' },
  { id: 'valores', titulo: 'Valores' },
  { id: 'conferencia', titulo: 'Conferência' },
] as const;

function EscolhaCabecalho({ aba, valor, aoMudar, id }: { aba: AbaResumida | undefined; valor: number; aoMudar: (n: number) => void; id: string }) {
  if (!aba) return null;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="font-semibold">Linha do cabeçalho</span>
      <span className="block text-texto-suave">A linha com os títulos das colunas.</span>
      <select id={id} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} className={estiloEntrada}>
        {aba.linhas.map((l, i) => (
          <option key={i} value={i + 1}>
            Linha {i + 1}: {resumoLinha(l).slice(0, 90)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SeletorColuna({
  colunas,
  valor,
  aoMudar,
  vazio,
  id,
}: {
  colunas: ReturnType<typeof colunasDe>;
  valor: number | null | undefined;
  aoMudar: (j: number | null) => void;
  vazio: string;
  id?: string;
}) {
  const exemplo = colunas.find((c) => c.j === valor)?.exemplo;
  return (
    <div className="min-w-0">
      <select id={id} value={valor ?? ''} onChange={(e) => aoMudar(e.target.value === '' ? null : Number(e.target.value))} className={`${estiloEntrada} !mt-0`}>
        <option value="">{vazio}</option>
        {colunas.map((c) => (
          <option key={c.j} value={c.j}>
            {letra(c.j)} · {c.titulo}
          </option>
        ))}
      </select>
      {exemplo ? <span className="mt-0.5 block truncate text-xs text-texto-suave">ex.: {exemplo}</span> : null}
    </div>
  );
}

function DePara({ abas, m, setM, children }: { abas: AbaResumida[]; m: Mapeamento; setM: (m: Mapeamento) => void; children: ReactNode }) {
  const abaFolha = abas.find((a) => a.nome === m.folha.aba);
  const colsFolha = useMemo(() => colunasDe(abaFolha, m.folha.cabecalho), [abaFolha, m.folha.cabecalho]);
  const l = m.lotacao;
  const abaLot = l.modo === 'linhas' || l.modo === 'colunas' ? abas.find((a) => a.nome === l.aba) : undefined;
  const colsLot = useMemo(() => (l.modo === 'linhas' || l.modo === 'colunas' ? colunasDe(abaLot, l.cabecalho) : []), [abaLot, l]);

  const mudarFolha = (aba: string, cabecalho: number) => {
    const x = abas.find((a) => a.nome === aba);
    setM({ ...m, folha: { aba, cabecalho, colunas: sugerirColunasFolha(x?.linhas[cabecalho - 1] ?? []) } });
  };
  const mudarColuna = (campo: CampoFolha, j: number | null) => {
    const colunas = { ...m.folha.colunas };
    if (j === null) delete colunas[campo];
    else colunas[campo] = j;
    setM({ ...m, folha: { ...m.folha, colunas } });
  };
  const lotacaoDaAba = (aba: string, cabecalho: number, formato: 'linhas' | 'colunas'): MapeamentoLotacao => {
    const x = abas.find((a) => a.nome === aba);
    const s = sugerirColunasLotacao(x?.linhas[cabecalho - 1] ?? []);
    return formato === 'linhas'
      ? { modo: 'linhas', aba, cabecalho, funcionario: s.funcionario ?? -1, servico: s.servico ?? -1, percentual: s.percentual }
      : { modo: 'colunas', aba, cabecalho, funcionario: s.funcionario ?? -1, servicos: s.servicos.filter((j) => j !== s.funcionario) };
  };
  const setLot = (lotacao: MapeamentoLotacao) => setM({ ...m, lotacao });
  const outraAba = abas.find((a) => a.nome !== m.folha.aba) ?? abas[0];

  return (
    <section className="space-y-6 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-depara">
      <div>
        <h2 id="t-depara" className="text-lg font-bold">2. Onde estão os dados (DE-PARA)</h2>
        <p className="max-w-2xl text-sm text-texto-suave">
          O app já sugeriu as escolhas pelos títulos das colunas. Confira e mude o que for preciso. Campos que não existem na sua planilha ficam como
          “não importar” e entram zerados.
        </p>
      </div>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-base font-bold">Folha de pagamento</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Aba com os funcionários</span>
            <span className="block text-texto-suave">Uma linha por funcionário ou vaga.</span>
            <select value={m.folha.aba} onChange={(e) => mudarFolha(e.target.value, abas.find((a) => a.nome === e.target.value)?.cabecalhoSugerido ?? 1)} className={estiloEntrada}>
              {abas.map((a) => (
                <option key={a.nome} value={a.nome}>
                  {a.nome} ({a.totalLinhas} linhas)
                </option>
              ))}
            </select>
          </label>
          <EscolhaCabecalho id="cab-folha" aba={abaFolha} valor={m.folha.cabecalho} aoMudar={(n) => mudarFolha(m.folha.aba, n)} />
        </div>

        <div className="overflow-hidden rounded-lg border border-borda">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">DE-PARA das colunas da folha</caption>
            <thead className="bg-superficie-2 text-texto-suave">
              <tr>
                <th scope="col" className="w-1/2 px-3 py-2 font-semibold">Campo do cadastro (PARA)</th>
                <th scope="col" className="px-3 py-2 font-semibold">Coluna da planilha (DE)</th>
              </tr>
            </thead>
            {GRUPOS.map((g) => (
              <tbody key={g.id}>
                <tr className="border-t border-borda bg-destaque-suave/60">
                  <th scope="rowgroup" colSpan={2} className="px-3 py-1.5 font-bold">
                    {g.titulo}
                  </th>
                </tr>
                {CAMPOS_FOLHA.filter((c) => c.grupo === g.id).map((c) => {
                  const id = `col-${c.chave}`;
                  const falta = c.obrigatorio && m.folha.colunas[c.chave] === undefined;
                  return (
                    <tr key={c.chave} className="border-t border-borda align-top">
                      <th scope="row" className="px-3 py-2 font-normal">
                        <label htmlFor={id} className="font-semibold">
                          {c.rotulo}
                          {c.obrigatorio && <span className="text-erro"> *</span>}
                        </label>
                        {c.dica && <span className="block text-xs text-texto-suave">{c.dica}</span>}
                      </th>
                      <td className={`px-3 py-2 ${falta ? 'bg-aviso-fundo' : ''}`}>
                        <SeletorColuna id={id} colunas={colsFolha} valor={m.folha.colunas[c.chave]} aoMudar={(j) => mudarColuna(c.chave, j)} vazio="— não importar —" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-base font-bold">Lotação (rateio por serviço)</legend>
        <div className="space-y-2 text-sm">
          {(
            [
              ['coluna', 'Coluna “Lotação” da própria folha', '100% no serviço escrito na coluna escolhida acima.'],
              ['aba', 'Outra aba, com os rateios', 'Quando um funcionário é dividido entre serviços.'],
              ['nenhuma', 'Não importar lotação agora', 'Você distribui depois, na tela Lotação.'],
            ] as const
          ).map(([v, rotulo, dica]) => {
            const marcado = v === 'aba' ? l.modo === 'linhas' || l.modo === 'colunas' : l.modo === v;
            return (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${marcado ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}>
                <input
                  type="radio"
                  name="modo-lotacao"
                  checked={marcado}
                  onChange={() => setLot(v === 'aba' ? lotacaoDaAba(outraAba.nome, outraAba.cabecalhoSugerido, 'linhas') : { modo: v })}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">{rotulo}</span>
                  <span className="block text-texto-suave">{dica}</span>
                </span>
              </label>
            );
          })}
        </div>

        {(l.modo === 'linhas' || l.modo === 'colunas') && (
          <div className="space-y-4 rounded-lg border border-borda p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold">Aba com os rateios</span>
                <select
                  value={l.aba}
                  onChange={(e) => setLot(lotacaoDaAba(e.target.value, abas.find((a) => a.nome === e.target.value)?.cabecalhoSugerido ?? 1, l.modo))}
                  className={estiloEntrada}
                >
                  {abas.map((a) => (
                    <option key={a.nome} value={a.nome}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
              <EscolhaCabecalho id="cab-lot" aba={abaLot} valor={l.cabecalho} aoMudar={(n) => setLot(lotacaoDaAba(l.aba, n, l.modo))} />
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">Como os rateios estão na aba</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="formato-lotacao" checked={l.modo === 'linhas'} onChange={() => setLot(lotacaoDaAba(l.aba, l.cabecalho, 'linhas'))} />
                  Uma linha por serviço (Funcionário, Serviço, Percentual)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="formato-lotacao" checked={l.modo === 'colunas'} onChange={() => setLot(lotacaoDaAba(l.aba, l.cabecalho, 'colunas'))} />
                  Uma coluna para cada serviço
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm" htmlFor="lot-func">
                <span className="font-semibold">
                  Funcionário <span className="text-erro">*</span>
                </span>
                <span className="block text-texto-suave">Código (ficha) ou nome, igual à folha.</span>
                <SeletorColuna id="lot-func" colunas={colsLot} valor={l.funcionario < 0 ? null : l.funcionario} aoMudar={(j) => setLot({ ...l, funcionario: j ?? -1 })} vazio="Escolha a coluna…" />
              </label>
              {l.modo === 'linhas' && (
                <>
                  <label className="block text-sm" htmlFor="lot-serv">
                    <span className="font-semibold">
                      Serviço <span className="text-erro">*</span>
                    </span>
                    <span className="block text-texto-suave">Nome ou código do serviço.</span>
                    <SeletorColuna id="lot-serv" colunas={colsLot} valor={l.servico < 0 ? null : l.servico} aoMudar={(j) => setLot({ ...l, servico: j ?? -1 })} vazio="Escolha a coluna…" />
                  </label>
                  <label className="block text-sm" htmlFor="lot-perc">
                    <span className="font-semibold">Percentual</span>
                    <span className="block text-texto-suave">Aceita 60, 60% ou 0,6.</span>
                    <SeletorColuna id="lot-perc" colunas={colsLot} valor={l.percentual} aoMudar={(j) => setLot({ ...l, percentual: j })} vazio="— sem coluna: 100% —" />
                  </label>
                </>
              )}
            </div>

            {l.modo === 'colunas' && (
              <fieldset className="min-w-0 text-sm">
                <legend className="font-semibold">Colunas que são serviços</legend>
                <p className="text-texto-suave">Cada célula tem o percentual do funcionário naquele serviço.</p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {colsLot
                    .filter((c) => c.j !== l.funcionario)
                    .map((c) => (
                      <label key={c.j} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={l.servicos.includes(c.j)}
                          onChange={(e) => setLot({ ...l, servicos: e.target.checked ? [...l.servicos, c.j].sort((x, y) => x - y) : l.servicos.filter((j) => j !== c.j) })}
                        />
                        <span className="truncate">
                          {letra(c.j)} · {c.titulo}
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
          </div>
        )}
      </fieldset>

      {children}
    </section>
  );
}

function Relatorio({ analise }: { analise: Analise }) {
  const r = analise.relatorio;
  const problemas = r.lotacoesForaDe100.length + r.semLotacao.length;
  return (
    <section className="space-y-4 rounded-xl border border-borda bg-superficie p-5" aria-labelledby="t-relatorio">
      <h2 id="t-relatorio" className="text-lg font-bold">3. Conferir o que será importado</h2>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-texto-suave">Funcionários</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.total}</dd>
          <dd className="text-texto-suave">{r.postos.vagas} {r.postos.vagas === 1 ? 'vaga prevista' : 'vagas previstas'}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Com lotação válida</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.postos.comLotacao}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Lotações reconhecidas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{r.servicos.reconhecidos}</dd>
          <dd className="text-texto-suave">{r.servicos.aEscolher} para você escolher</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Custo mensal calculado</dt>
          <dd className="text-2xl font-semibold tabular-nums">{reais(r.custoMensalApp)}</dd>
          {r.custoMensalPlanilha !== null && <dd className="text-texto-suave">Na planilha: {reais(r.custoMensalPlanilha)}</dd>}
        </div>
      </dl>

      {problemas > 0 && (
        <div className="rounded-md bg-aviso-fundo p-4 text-sm text-aviso">
          <p className="font-semibold">
            {problemas} {problemas === 1 ? 'funcionário vai' : 'funcionários vão'} entrar sem lotação e precisarão de ajuste depois, na tela Lotação.
          </p>
          {r.lotacoesForaDe100.length > 0 && (
            <>
              <p className="mt-2">Lotação que não soma 100% (não é gravada):</p>
              <ul className="ml-5 list-disc">
                {r.lotacoesForaDe100.map((x, i) => (
                  <li key={i}>
                    {quem(x)}: soma {percentual(x.soma)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.semLotacao.length > 0 && (
            <>
              <p className="mt-2">Sem lotação na planilha:</p>
              <ul className="ml-5 list-disc">
                {r.semLotacao.map((x, i) => (
                  <li key={i}>{quem(x)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {r.lotacaoSemFuncionario.length > 0 && (
        <Aviso tipo="atencao" titulo="Lotação de quem não está na folha">
          A aba de lotação cita {r.lotacaoSemFuncionario.length === 1 ? 'um funcionário que não aparece' : `${r.lotacaoSemFuncionario.length} funcionários que não aparecem`} na
          aba da folha: {r.lotacaoSemFuncionario.slice(0, 20).join(', ')}
          {r.lotacaoSemFuncionario.length > 20 ? '…' : ''}. Essas linhas são ignoradas. Confira se a coluna do funcionário é a certa.
        </Aviso>
      )}

      {r.diferencasCusto.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            {r.diferencasCusto.length} {r.diferencasCusto.length === 1 ? 'funcionário tem' : 'funcionários têm'} custo diferente do total da planilha
          </summary>
          <p className="mt-2 text-texto-suave">
            O app calcula provisões e encargos pelos parâmetros da folha. Diferenças grandes podem indicar parâmetro ou componente a conferir.
          </p>
          <table className="mt-2 text-left">
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="pr-4 font-medium">Posto</th>
                <th scope="col" className="pr-4 text-right font-medium">Planilha</th>
                <th scope="col" className="text-right font-medium">App</th>
              </tr>
            </thead>
            <tbody>
              {r.diferencasCusto.slice(0, 30).map((d, i) => (
                <tr key={i}>
                  <td className="pr-4">{quem(d)}</td>
                  <td className="pr-4 text-right tabular-nums">{reais(d.planilha)}</td>
                  <td className="text-right tabular-nums">{reais(d.app)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Detalhes da leitura</summary>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Aba da folha: {r.abas.estudo ?? '—'}. Lotação: {r.abas.rateio ? `aba ${r.abas.rateio}` : 'coluna da folha ou nenhuma'}.
          </li>
          {r.fichasJaCadastradas.length > 0 && <li>Códigos já cadastrados, ignorados: {r.fichasJaCadastradas.join(', ')}.</li>}
          {r.vagasJaCadastradas > 0 && <li>{r.vagasJaCadastradas} vagas previstas já cadastradas, ignoradas.</li>}
          {r.semAdmissao > 0 && <li>{r.semAdmissao} funcionários sem data de admissão: entram com 1º de janeiro.</li>}
          {r.colunasCalculadas.length > 0 && <li>Colunas calculadas pelo app, não importadas: {r.colunasCalculadas.join(', ')}.</li>}
          {r.colunasIgnoradas.map((c) => (
            <li key={c.aba}>
              Colunas da aba {c.aba} que não serão importadas: {c.colunas.join(', ')}.
            </li>
          ))}
          {r.avisos.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
