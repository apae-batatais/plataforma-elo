'use client';

/**
 * Gráficos simples em SVG, sem biblioteca: barras agrupadas, barras
 * horizontais, linhas e barras 100%. Regras: um eixo só, cores fixas por
 * série (var(--serie-N)), legenda sempre que houver mais de uma série,
 * gráfico de uma série só na cor do app aberto (var(--destaque)),
 * valores ao passar o mouse (ou tocar) e "Ver os números" em tabela.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type Formato = 'moeda' | 'pct' | 'numero';
export interface Serie {
  nome: string;
  valores: number[];
  /**
   * Índice da cor categórica (1 a 4), um ano na escala de exercícios ('ano-1' mais antigo … 'ano-3' atual)
   * ou 'destaque' (a cor do app). Gráfico com uma série só de cor categórica passa a usar a cor do app.
   */
  cor: number | 'ano-1' | 'ano-2' | 'ano-3' | 'destaque';
}

/** Uma série só não precisa diferenciar cores: usa a cor do app aberto (identidade visual). */
export function naCorDoApp(series: Serie[]): Serie[] {
  return series.length === 1 && typeof series[0].cor === 'number' ? [{ ...series[0], cor: 'destaque' }] : series;
}

const cor = (n: Serie['cor']) => (typeof n === 'string' ? `var(--${n})` : `var(--serie-${Math.min(Math.max(n, 1), 4)})`);
/** Cor do texto escrito sobre uma área pintada com a cor da série (contraste garantido nos dois temas). */
const sobre = (n: Serie['cor']) => (typeof n === 'string' ? `var(--sobre-${n})` : '#ffffff');

export function formatarValor(v: number, formato: Formato, curto = false): string {
  if (formato === 'pct') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (formato === 'numero') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!curto) return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Escala "bonita": topo arredondado e 4 linhas de grade. */
function escala(maximo: number, minimo = 0) {
  const amplitude = Math.max(maximo - minimo, 1e-9);
  const passoBruto = amplitude / 4;
  const mag = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= passoBruto) ?? passoBruto;
  const topo = Math.ceil(maximo / passo) * passo;
  const base = Math.min(0, Math.floor(minimo / passo) * passo);
  const marcas: number[] = [];
  for (let v = base; v <= topo + passo / 2; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
  return { topo, base, marcas };
}

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
      {series.map((s) => (
        <li key={s.nome} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: cor(s.cor) }} aria-hidden="true" />
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

function TabelaDoGrafico({ categorias, series, formato, rotuloCategoria }: { categorias: string[]; series: Serie[]; formato: Formato; rotuloCategoria: string }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-texto-suave hover:text-texto">Ver os números</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-texto-suave">
            <tr>
              <th scope="col" className="py-1 pr-3 font-semibold">{rotuloCategoria}</th>
              {series.map((s) => (
                <th key={s.nome} scope="col" className="py-1 pr-3 text-right font-semibold">{s.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categorias.map((c, i) => (
              <tr key={c} className="border-t border-borda">
                <th scope="row" className="py-1 pr-3 font-normal">{c}</th>
                {series.map((s) => (
                  <td key={s.nome} className="py-1 pr-3 text-right tabular-nums">{formatarValor(s.valores[i] ?? 0, formato)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Caixa de valores ao passar o mouse; `pct` é a posição horizontal (0 a 100). */
function Dica({ pct, children }: { pct: number; children: ReactNode }) {
  const esquerda = pct > 60;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-borda bg-superficie px-3 py-2 text-xs shadow-lg"
      style={esquerda ? { right: `calc(${100 - pct}% + 12px)` } : { left: `calc(${pct}% + 12px)` }}
    >
      {children}
    </div>
  );
}

function LinhasDaDica({ titulo, itens, formato }: { titulo: string; itens: { nome: string; valor: number; cor: Serie['cor'] }[]; formato: Formato }) {
  return (
    <>
      <p className="mb-1 font-semibold">{titulo}</p>
      {itens.map((i) => (
        <p key={i.nome} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-texto-suave">
            <span className="inline-block size-2 rounded-sm" style={{ background: cor(i.cor) }} aria-hidden="true" />
            {i.nome}
          </span>
          <span className="font-semibold tabular-nums">{formatarValor(i.valor, formato)}</span>
        </p>
      ))}
    </>
  );
}

/** Largura real do quadro, para desenhar em pixels (textos sempre do mesmo tamanho). */
function useLargura(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(Math.round(el.getBoundingClientRect().width), 280));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}
const MARGEM = { topo: 12, dir: 12, base: 28, esq: 64 };

/** Barras verticais agrupadas: categorias no eixo X, uma barra por série. */
export function BarrasAgrupadas({ categorias, series, formato, altura = 240, rotuloCategoria = 'Ano', descricao }: {
  categorias: string[]; series: Serie[]; formato: Formato; altura?: number; rotuloCategoria?: string; descricao: string;
}) {
  series = naCorDoApp(series);
  const [foco, setFoco] = useState<number | null>(null);
  const id = useId();
  const [quadro, L] = useLargura();
  const todos = series.flatMap((s) => s.valores);
  const { topo, base, marcas } = escala(Math.max(...todos, 0), Math.min(...todos, 0));
  const h = altura - MARGEM.topo - MARGEM.base;
  const w = L - MARGEM.esq - MARGEM.dir;
  const y = (v: number) => MARGEM.topo + ((topo - v) / (topo - base)) * h;
  const faixa = w / categorias.length;
  const largBarra = Math.min(40, (faixa * 0.7) / series.length);
  const xGrupo = (i: number) => MARGEM.esq + faixa * i + (faixa - largBarra * series.length - 2 * (series.length - 1)) / 2;

  return (
    <figure className="space-y-2">
      <Legenda series={series} />
      <div ref={quadro} className="relative" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${L} ${altura}`} width={L} height={altura} className="block max-w-full" role="img" aria-labelledby={id}>
          <title id={id}>{descricao}</title>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(m)} y2={y(m)} stroke="var(--grade)" strokeWidth={m === 0 ? 1.5 : 1} />
              <text x={MARGEM.esq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-texto-suave text-[11px]">
                {formatarValor(m, formato, true)}
              </text>
            </g>
          ))}
          {categorias.map((c, i) => (
            <g key={c} onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} tabIndex={0} aria-label={c}>
              <rect x={MARGEM.esq + faixa * i} y={MARGEM.topo} width={faixa} height={h} fill={foco === i ? 'var(--superficie-2)' : 'transparent'} />
              {series.map((s, k) => {
                const v = s.valores[i] ?? 0;
                const y0 = y(Math.max(v, 0));
                const alt = Math.max(Math.abs(y(v) - y(0)), v ? 1 : 0);
                return <rect key={s.nome} x={xGrupo(i) + k * (largBarra + 2)} y={y0} width={largBarra} height={alt} rx={3} fill={cor(s.cor)} />;
              })}
              <text x={MARGEM.esq + faixa * i + faixa / 2} y={altura - 8} textAnchor="middle" className="fill-texto-suave text-[11px]">
                {c}
              </text>
            </g>
          ))}
        </svg>
        {foco !== null && (
          <Dica pct={((MARGEM.esq + faixa * foco + faixa / 2) / L) * 100}>
            <LinhasDaDica titulo={categorias[foco]} itens={series.map((s) => ({ nome: s.nome, valor: s.valores[foco] ?? 0, cor: s.cor }))} formato={formato} />
          </Dica>
        )}
      </div>
      <TabelaDoGrafico categorias={categorias} series={series} formato={formato} rotuloCategoria={rotuloCategoria} />
    </figure>
  );
}

/** Linhas: categorias no eixo X (meses ou anos), com linhas de referência opcionais. */
export function Linhas({ categorias, series, formato, altura = 240, referencias = [], rotuloCategoria = 'Mês', descricao, minimo, maximo }: {
  categorias: string[]; series: Serie[]; formato: Formato; altura?: number; referencias?: { valor: number; rotulo: string }[];
  rotuloCategoria?: string; descricao: string; minimo?: number; maximo?: number;
}) {
  series = naCorDoApp(series);
  const [foco, setFoco] = useState<number | null>(null);
  const id = useId();
  const [quadro, L] = useLargura();
  const todos = [...series.flatMap((s) => s.valores), ...referencias.map((r) => r.valor)];
  const { topo, base, marcas } = escala(maximo ?? Math.max(...todos, 0), minimo ?? Math.min(...todos, 0));
  const h = altura - MARGEM.topo - MARGEM.base;
  const w = L - MARGEM.esq - MARGEM.dir;
  const y = (v: number) => MARGEM.topo + ((topo - v) / (topo - base)) * h;
  const folga = categorias.length <= 6 ? 28 : 10;
  const x = (i: number) => MARGEM.esq + folga + (categorias.length === 1 ? (w - 2 * folga) / 2 : ((w - 2 * folga) * i) / (categorias.length - 1));

  return (
    <figure className="space-y-2">
      <Legenda series={series} />
      <div ref={quadro} className="relative" onMouseLeave={() => setFoco(null)}>
        <svg
          viewBox={`0 0 ${L} ${altura}`}
          width={L}
          height={altura}
          className="block max-w-full"
          role="img"
          aria-labelledby={id}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * L;
            const i = Math.round(((px - MARGEM.esq - folga) / (w - 2 * folga)) * (categorias.length - 1));
            setFoco(Math.min(Math.max(i, 0), categorias.length - 1));
          }}
        >
          <title id={id}>{descricao}</title>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(m)} y2={y(m)} stroke="var(--grade)" />
              <text x={MARGEM.esq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-texto-suave text-[11px]">
                {formatarValor(m, formato, true)}
              </text>
            </g>
          ))}
          {referencias.map((r, k) => (
            <g key={r.rotulo}>
              <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(r.valor)} y2={y(r.valor)} stroke="var(--referencia)" strokeDasharray="5 4" strokeWidth={1.5} />
              <text x={L - MARGEM.dir} y={y(r.valor) + (k % 2 ? 14 : -5)} textAnchor="end" className="fill-[var(--referencia)] text-[11px] font-semibold">
                {r.rotulo}
              </text>
            </g>
          ))}
          {categorias.map((c, i) => (
            <text key={c} x={x(i)} y={altura - 8} textAnchor="middle" className="fill-texto-suave text-[11px]">
              {c}
            </text>
          ))}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={MARGEM.topo} y2={MARGEM.topo + h} stroke="var(--borda-forte)" />}
          {series.map((s) => (
            <g key={s.nome}>
              <polyline points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={cor(s.cor)} strokeWidth={2} strokeLinejoin="round" />
              {s.valores.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={foco === i ? 5 : categorias.length <= 6 ? 4 : 0} fill={cor(s.cor)} stroke="var(--superficie)" strokeWidth={2} />
              ))}
            </g>
          ))}
        </svg>
        {foco !== null && (
          <Dica pct={(x(foco) / L) * 100}>
            <LinhasDaDica titulo={categorias[foco]} itens={series.map((s) => ({ nome: s.nome, valor: s.valores[foco] ?? 0, cor: s.cor }))} formato={formato} />
          </Dica>
        )}
      </div>
      <TabelaDoGrafico categorias={categorias} series={series} formato={formato} rotuloCategoria={rotuloCategoria} />
    </figure>
  );
}

/** Barras horizontais agrupadas: bom para muitas categorias (áreas, grupos). */
export function BarrasHorizontais({ categorias, series, formato, rotuloCategoria, descricao, notas }: {
  categorias: string[]; series: Serie[]; formato: Formato; rotuloCategoria: string; descricao: string;
  /** Observação curta embaixo do nome de cada categoria (opcional). */
  notas?: (ReactNode | null)[];
}) {
  series = naCorDoApp(series);
  const maximo = Math.max(...series.flatMap((s) => s.valores), 1);
  return (
    <figure className="space-y-3" aria-label={descricao}>
      <Legenda series={series} />
      <ul className="space-y-3">
        {categorias.map((c, i) => (
          <li key={c} className="grid items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,15rem)_1fr]">
            <span className="min-w-0">
              <span className="block truncate text-texto" title={c}>
                {c}
              </span>
              {notas?.[i] && <span className="mt-0.5 block text-xs text-texto-suave">{notas[i]}</span>}
            </span>
            <span className="space-y-1">
              {series.map((s) => {
                const v = s.valores[i] ?? 0;
                return (
                  <span key={s.nome} className="flex items-center gap-2" title={`${s.nome}: ${formatarValor(v, formato)}`}>
                    <span className="h-2.5 rounded-r" style={{ width: `${Math.max((v / maximo) * 82, v ? 0.8 : 0)}%`, background: cor(s.cor) }} aria-hidden="true" />
                    <span className="whitespace-nowrap text-xs tabular-nums text-texto-suave">
                      <span className="sr-only">{s.nome}: </span>
                      {formatarValor(v, formato, true)}
                    </span>
                  </span>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
      <TabelaDoGrafico categorias={categorias} series={series} formato={formato} rotuloCategoria={rotuloCategoria} />
    </figure>
  );
}

/** Barras 100%: a composição de cada categoria (ex.: receita pública × própria por ano). */
export function Barras100({ categorias, series, rotuloCategoria, descricao }: { categorias: string[]; series: Serie[]; rotuloCategoria: string; descricao: string }) {
  series = naCorDoApp(series);
  return (
    <figure className="space-y-3" aria-label={descricao}>
      <Legenda series={series} />
      <ul className="space-y-2.5">
        {categorias.map((c, i) => {
          const total = series.reduce((s, x) => s + (x.valores[i] ?? 0), 0) || 1;
          return (
            <li key={c} className="grid grid-cols-[3.5rem_1fr] items-center gap-3 text-sm">
              <span className="font-semibold tabular-nums">{c}</span>
              <span className="flex h-6 overflow-hidden rounded-md">
                {series.map((s, k) => {
                  const p = ((s.valores[i] ?? 0) / total) * 100;
                  return (
                    <span
                      key={s.nome}
                      title={`${s.nome}: ${formatarValor(p, 'pct')}`}
                      className={`flex items-center justify-center text-[11px] font-semibold ${k > 0 ? 'border-l-2 border-superficie' : ''}`}
                      style={{ width: `${p}%`, background: cor(s.cor), color: sobre(s.cor) }}
                    >
                      {p >= 9 ? formatarValor(p, 'pct') : ''}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <TabelaDoGrafico categorias={categorias} series={series} formato="moeda" rotuloCategoria={rotuloCategoria} />
    </figure>
  );
}

/**
 * Indicadores com referência (gráfico de "meta"): uma barra de 0 a 100% com o
 * valor do ano, o limite de referência tracejado e marcas dos anos anteriores.
 * A situação vem sempre escrita (nunca só pela cor).
 */
export interface Indicador {
  nome: string;
  valor: number | null;
  explicacao: string;
  /** Limite de referência: "ate" = o bom é ficar abaixo; "desde" = o bom é ficar acima. */
  referencia?: { valor: number; sentido: 'ate' | 'desde' };
  anteriores: { rotulo: string; valor: number | null }[];
}

export function Indicadores({ itens }: { itens: Indicador[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      {itens.map((i) => {
        const v = i.valor;
        const fora = v !== null && i.referencia ? (i.referencia.sentido === 'ate' ? v > i.referencia.valor : v < i.referencia.valor) : false;
        const anteriores = i.anteriores.filter((a) => a.valor !== null) as { rotulo: string; valor: number }[];
        const limite = (x: number) => Math.min(Math.max(x, 0), 100);
        return (
          <li key={i.nome} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">{i.nome}</span>
              <span className="text-2xl font-bold tabular-nums">{v === null ? '—' : formatarValor(v, 'pct')}</span>
            </div>
            <div className="relative h-3 rounded-full bg-superficie-2 ring-1 ring-inset ring-borda" role="img" aria-label={`${i.nome}: ${v === null ? 'sem dado' : formatarValor(v, 'pct')}${i.referencia ? `; referência ${i.referencia.sentido === 'ate' ? 'até' : 'a partir de'} ${i.referencia.valor}%` : ''}`}>
              {v !== null && (
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${limite(v)}%`, background: fora ? 'var(--negativo)' : 'var(--destaque)' }} />
              )}
              {anteriores.map((a) => (
                <span
                  key={a.rotulo}
                  title={`${a.rotulo}: ${formatarValor(a.valor, 'pct')}`}
                  className="absolute -top-1 h-5 w-0.5 rounded bg-texto/60"
                  style={{ left: `calc(${limite(a.valor)}% - 1px)` }}
                />
              ))}
              {i.referencia && (
                <span className="absolute -inset-y-2 border-l-2 border-dashed border-[var(--referencia)]" style={{ left: `${limite(i.referencia.valor)}%` }} />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-texto-suave">
              <span>
                {anteriores.length > 0 ? `Antes: ${anteriores.map((a) => `${a.rotulo} ${formatarValor(a.valor, 'pct')}`).join(', ')}` : 'Sem anos anteriores'}
              </span>
              {i.referencia && (
                <span className={`font-semibold ${fora ? 'text-erro' : 'text-sucesso'}`}>
                  <span aria-hidden="true">{fora ? '▲ ' : '✓ '}</span>
                  {fora ? 'Fora' : 'Dentro'} da referência ({i.referencia.sentido === 'ate' ? 'até' : 'a partir de'} {i.referencia.valor}%)
                </span>
              )}
            </div>
            <p className="text-xs text-texto-suave">{i.explicacao}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Resultado de cada mês (receita − despesa): barras para cima (sobra) e para
 * baixo (falta), com o saldo acumulado no ano na dica e na tabela.
 */
export function ResultadoMensal({ categorias, receita, despesa, descricao }: { categorias: string[]; receita: number[]; despesa: number[]; descricao: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  const id = useId();
  const [quadro, L] = useLargura();
  const resultado = categorias.map((_, i) => Math.round(((receita[i] ?? 0) - (despesa[i] ?? 0)) * 100) / 100);
  const acumulado = resultado.reduce<number[]>((acc, v, i) => [...acc, (acc[i - 1] ?? 0) + v], []);
  const altura = 220;
  const { topo, base, marcas } = escala(Math.max(...resultado, 0), Math.min(...resultado, 0));
  const h = altura - MARGEM.topo - MARGEM.base;
  const w = L - MARGEM.esq - MARGEM.dir;
  const y = (v: number) => MARGEM.topo + ((topo - v) / (topo - base)) * h;
  const faixa = w / categorias.length;
  const larg = Math.min(28, faixa * 0.6);
  const series: Serie[] = [
    { nome: 'Receita', valores: receita, cor: 1 },
    { nome: 'Despesa', valores: despesa, cor: 2 },
    { nome: 'Resultado do mês', valores: resultado, cor: 1 },
    { nome: 'Saldo acumulado', valores: acumulado, cor: 1 },
  ];
  return (
    <figure className="space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--positivo)' }} aria-hidden="true" />
          Sobra no mês
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--negativo)' }} aria-hidden="true" />
          Falta no mês
        </li>
      </ul>
      <div ref={quadro} className="relative" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${L} ${altura}`} width={L} height={altura} className="block max-w-full" role="img" aria-labelledby={id}>
          <title id={id}>{descricao}</title>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={m === 0 ? 'var(--borda-forte)' : 'var(--grade)'} strokeWidth={m === 0 ? 1.5 : 1} />
              <text x={MARGEM.esq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-texto-suave text-[11px]">
                {formatarValor(m, 'moeda', true)}
              </text>
            </g>
          ))}
          {categorias.map((c, i) => {
            const v = resultado[i];
            const cx = MARGEM.esq + faixa * i + faixa / 2;
            return (
              <g key={c} onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} tabIndex={0} aria-label={`${c}: ${formatarValor(v, 'moeda')}`}>
                <rect x={MARGEM.esq + faixa * i} y={MARGEM.topo} width={faixa} height={h} fill={foco === i ? 'var(--superficie-2)' : 'transparent'} />
                <rect x={cx - larg / 2} y={y(Math.max(v, 0))} width={larg} height={Math.max(Math.abs(y(v) - y(0)), v ? 1 : 0)} rx={3} fill={v < 0 ? 'var(--negativo)' : 'var(--positivo)'} />
                <text x={cx} y={altura - 8} textAnchor="middle" className="fill-texto-suave text-[11px]">
                  {c}
                </text>
              </g>
            );
          })}
        </svg>
        {foco !== null && (
          <Dica pct={((MARGEM.esq + faixa * foco + faixa / 2) / L) * 100}>
            <p className="mb-1 font-semibold">{categorias[foco]}</p>
            {[
              ['Receita', receita[foco] ?? 0],
              ['Despesa', despesa[foco] ?? 0],
              [resultado[foco] < 0 ? 'Falta no mês' : 'Sobra no mês', resultado[foco]],
              ['Saldo acumulado', acumulado[foco]],
            ].map(([n, v]) => (
              <p key={n as string} className="flex justify-between gap-3">
                <span className="text-texto-suave">{n}</span>
                <span className={`font-semibold tabular-nums ${(v as number) < 0 ? 'text-erro' : ''}`}>{formatarValor(v as number, 'moeda')}</span>
              </p>
            ))}
          </Dica>
        )}
      </div>
      <TabelaDoGrafico categorias={categorias} series={series} formato="moeda" rotuloCategoria="Mês" />
    </figure>
  );
}
