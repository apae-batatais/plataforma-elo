'use client';

/**
 * Formulário do pedido (novo e ajuste), na ordem em que a pessoa pensa:
 * o que publicar, para quando (com o prazo da Comunicação sempre à vista),
 * o tema do calendário (sugerido pela data e pelo tipo) e, por fim, área e vídeo.
 * A confirmação de uso de imagem aparece sempre que há link de vídeo.
 */
import { useActionState, useMemo, useState, startTransition, type FormEvent, type ReactNode } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeAtencao, IconeBusca, IconeCerto, IconeErro, IconeInfo } from '@/ui/icones';
import { Etiqueta } from '@/ui/pagina';
import type { TipoAnexo } from '../dominio/anexos';
import { NOME_TIPO_PECA, TIPOS_PECA, type TipoPeca } from '../dominio/pedido';
import { ehUrgente, somarDiasUteis } from '../dominio/prazos';
import { IconePeca } from './icones-pecas';
import { AnexosDoPedido, type AnexoNaFicha } from './anexos';
import { dataCurta, quandoCai } from './mes';
import { dataPorExtenso, distanciaDoTema, sugerirTemas } from './temas';

export interface EstadoPedido {
  erro?: string;
}

export interface ValoresPedido {
  area: string;
  calendarioId: string | null;
  /** Tema gravado no pedido (aparece mesmo que o item tenha sido desativado). */
  calendarioTema?: string | null;
  tipoPeca: TipoPeca;
  titulo: string;
  descricao: string;
  dataDesejada: string;
  linkVideo: string | null;
  /** Projeto já gravado no pedido (opcional). */
  projetoId?: string | null;
  projetoCodigo?: string | null;
}

/** Abre o envio de um arquivo (ação do servidor): devolve o endereço para onde o navegador manda o arquivo. */
export type IniciarEnvioAnexo = (a: { tipo: TipoAnexo; mime: string; tamanho: number }) => Promise<{ url?: string; erro?: string }>;

export interface ItemEscolha {
  id: string;
  tema: string;
  inicio: string;
  fim: string;
  tipos: TipoPeca[];
}

const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Nome curto no botão do tipo; o "no Instagram" vai embaixo, menor. */
const NOME_CURTO: Record<TipoPeca, [string, string?]> = {
  post_instagram: ['Post', 'no Instagram'],
  reel_instagram: ['Reel', 'no Instagram'],
  release: ['Release'],
  artigo: ['Artigo'],
  entrevista: ['Entrevista'],
};

/** Opção marcável em forma de cartão: borda e fundo na cor do app quando escolhida, contorno no foco do teclado. */
const estiloOpcao =
  'cursor-pointer rounded-xl border border-borda bg-superficie transition-colors hover:border-borda-forte has-[:checked]:border-destaque has-[:checked]:bg-destaque-suave has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-destaque';

function Bloco({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-cartao border border-borda bg-superficie p-5 sm:p-6">
      <h2 id={id} className="text-lg font-bold text-texto">
        {titulo}
      </h2>
      {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function FormularioPedido({
  acao,
  itens,
  areas,
  hoje,
  antecedencia,
  feriados = [],
  inicial,
  oculto,
  rotuloEnviar,
  iniciarEnvio,
  anexosIniciais = [],
  projetos = null,
}: {
  acao: (estado: EstadoPedido, f: FormData) => Promise<EstadoPedido>;
  itens: ItemEscolha[];
  areas: { codigo: string; nome: string }[];
  /** Dia de hoje em Brasília (AAAA-MM-DD). */
  hoje: string;
  antecedencia: number;
  /** Datas dos feriados cadastrados no Núcleo; não contam como dias úteis. */
  feriados?: string[];
  inicial?: ValoresPedido;
  oculto?: Record<string, string | number>;
  rotuloEnviar: string;
  /** Presente quando a instituição ativou a pasta de anexos; sem ele, o bloco de anexos não aparece. */
  iniciarEnvio?: IniciarEnvioAnexo;
  /** Anexos já guardados (ao ajustar um pedido devolvido). */
  anexosIniciais?: AnexoNaFicha[];
  /** Projetos que a pessoa pode escolher (L20); `null` = Projetos não está ativo e o campo não aparece. */
  projetos?: { id: string; codigo: string; titulo: string }[] | null;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  // Envio sem "action" no formulário: o React não limpa os campos quando o servidor devolve um erro.
  const enviarSemLimpar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(() => enviar(f));
  };
  const [tipo, setTipo] = useState<TipoPeca | ''>(inicial?.tipoPeca ?? '');
  const [data, setData] = useState(inicial?.dataDesejada ?? '');
  const [tema, setTema] = useState(inicial?.calendarioId ?? '');
  const [verTodos, setVerTodos] = useState(false);
  const [busca, setBusca] = useState('');
  const [link, setLink] = useState(inicial?.linkVideo ?? '');
  const [anexos, setAnexos] = useState<AnexoNaFicha[]>(anexosIniciais);
  const enviandoArquivo = anexos.some((a) => !a.arquivoId && !a.erro);
  const temFoto = anexos.some((a) => a.tipo === 'foto' && a.arquivoId);

  // O tema já gravado no pedido continua na lista, mesmo desativado ou encerrado.
  const lista = useMemo(() => {
    const base = [...itens];
    if (inicial?.calendarioId && !base.some((i) => i.id === inicial.calendarioId))
      base.unshift({ id: inicial.calendarioId, tema: inicial.calendarioTema ?? 'Tema do pedido', inicio: '', fim: '', tipos: [] });
    return base;
  }, [itens, inicial]);

  const setFeriados = useMemo(() => new Set(feriados), [feriados]);
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const passado = dataOk && data < hoje;
  const urgente = dataOk && !passado && ehUrgente(data, hoje, antecedencia, setFeriados);
  const limite = somarDiasUteis(hoje, antecedencia, setFeriados);

  const sugeridos = sugerirTemas(lista, { data, tipo, hoje });
  const escolhido = lista.find((i) => i.id === tema);
  // O tema escolhido continua à vista mesmo quando não está entre os sugeridos.
  const curtos = escolhido && !sugeridos.includes(escolhido) ? [escolhido, ...sugeridos] : sugeridos;
  const temas = verTodos ? lista.filter((i) => normal(i.tema).includes(normal(busca.trim()))) : curtos;

  return (
    <form onSubmit={enviarSemLimpar} className="space-y-5">
      {Object.entries(oculto ?? {}).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      {/* Um único campo leva o tema: a lista na tela pode estar resumida ou filtrada pela busca. */}
      <input type="hidden" name="calendario_id" value={tema} />
      {/* Só os arquivos já enviados; sem a pasta de anexos ativa, o campo não existe e os anexos ficam como estão. */}
      {iniciarEnvio && (
        <input type="hidden" name="anexos" value={JSON.stringify(anexos.filter((a) => a.arquivoId).map((a) => ({ arquivoId: a.arquivoId, tipo: a.tipo, nome: a.nome })))} />
      )}
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível enviar">
          {estado.erro}
        </Aviso>
      )}

      <Bloco id="bloco-o-que" titulo="O que você quer publicar">
        <fieldset>
          <legend className="text-sm font-semibold text-texto">
            Tipo de peça
            <span className="ml-0.5 text-erro" aria-hidden="true">
              *
            </span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TIPOS_PECA.map((t) => {
              const [nome, complemento] = NOME_CURTO[t];
              return (
                <label key={t} className={`${estiloOpcao} flex min-h-24 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center last:col-span-2 sm:last:col-span-1`}>
                  <input type="radio" name="tipo_peca" value={t} required checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                  <span className={tipo === t ? 'text-destaque' : 'text-texto-suave'}>
                    <IconePeca tipo={t} tamanho={28} />
                  </span>
                  <span className="text-sm leading-tight">
                    <span className="block font-semibold text-texto" aria-hidden="true">
                      {nome}
                    </span>
                    {complemento && (
                      <span className="block text-xs text-texto-suave" aria-hidden="true">
                        {complemento}
                      </span>
                    )}
                    <span className="sr-only">{NOME_TIPO_PECA[t]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Campo rotulo="Título" obrigatorio dica="Uma frase curta que identifique o pedido. Ex.: Convite para a Festa da Família.">
          <input type="text" name="titulo" required maxLength={140} defaultValue={inicial?.titulo} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="O que deve ser publicado" obrigatorio dica="Conte o assunto, as informações que precisam aparecer e o que for importante para a Comunicação.">
          <textarea name="descricao" required rows={5} defaultValue={inicial?.descricao} className={estiloEntrada} />
        </Campo>
      </Bloco>

      <Bloco id="bloco-quando" titulo="Para quando">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <Campo rotulo="Data desejada para a publicação" obrigatorio>
            <input type="date" name="data_desejada" required value={data} min={hoje} onChange={(e) => setData(e.target.value)} className={`${estiloEntrada} w-48`} />
          </Campo>
          {dataOk && !passado && <p className="pb-2 text-sm font-semibold text-texto">{dataPorExtenso(data)}</p>}
        </div>
        <Prazo passado={passado} urgente={urgente} dataOk={dataOk} antecedencia={antecedencia} limite={limite} />
      </Bloco>

      <Bloco
        id="bloco-tema"
        titulo="Tema do calendário"
        descricao={
          dataOk && !passado
            ? 'Temas perto da data escolhida. Se nenhum combinar, escolha “Fora do calendário”.'
            : 'Temas dos próximos dias. Escolha a data acima para ver os temas daquela época.'
        }
      >
        <fieldset>
          <legend className="sr-only">Tema do calendário</legend>
          {verTodos && (
            <label className="relative mb-3 block text-sm">
              <span className="sr-only">Buscar tema</span>
              <IconeBusca tamanho={18} className="pointer-events-none absolute top-1/2 left-3 mt-[3px] -translate-y-1/2 text-texto-suave" />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tema pelo nome" className={`${estiloEntrada} pl-10`} />
            </label>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {temas.map((i) => {
              const naData = dataOk && !passado && i.inicio !== '' && distanciaDoTema(i, data) === 0;
              return (
                <label key={i.id} className={`${estiloOpcao} flex min-h-11 items-start gap-3 px-3 py-2.5 text-sm`}>
                  <input type="radio" name="tema_escolha" checked={tema === i.id} onChange={() => setTema(i.id)} className="mt-1 accent-destaque" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-texto">{i.tema}</span>
                    {i.inicio && <span className="block text-texto-suave">{quandoCai(i)}</span>}
                    {naData && (
                      <span className="mt-1 block">
                        <Etiqueta tipo="info">Inclui a data escolhida</Etiqueta>
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            <label className={`${estiloOpcao} flex min-h-11 items-start gap-3 px-3 py-2.5 text-sm`}>
              <input type="radio" name="tema_escolha" checked={tema === ''} onChange={() => setTema('')} className="mt-1 accent-destaque" />
              <span>
                <span className="block font-semibold text-texto">Fora do calendário</span>
                <span className="block text-texto-suave">O assunto não está em nenhum tema</span>
              </span>
            </label>
          </div>
          {!verTodos && temas.length === 0 && <p className="mt-3 text-sm text-texto-suave">Nenhum tema do calendário perto dessa data.</p>}
          {verTodos && temas.length === 0 && <p className="mt-3 text-sm text-texto-suave">Nenhum tema com esse nome.</p>}
          {(verTodos || lista.length > curtos.length) && (
            <button
              type="button"
              onClick={() => {
                setVerTodos(!verTodos);
                setBusca('');
              }}
              aria-expanded={verTodos}
              className="mt-3 min-h-11 rounded-md px-1 text-sm font-semibold text-destaque hover:underline"
            >
              {verTodos ? 'Mostrar só os temas sugeridos' : `Ver todos os temas (${lista.length})`}
            </button>
          )}
        </fieldset>
      </Bloco>

      {iniciarEnvio && <AnexosDoPedido anexos={anexos} mudar={setAnexos} iniciar={iniciarEnvio} />}

      <Bloco id="bloco-area" titulo="Área e vídeo">
        <Campo rotulo="Área" obrigatorio dica="A área de onde vem o assunto.">
          <select name="area" required defaultValue={inicial?.area ?? ''} className={`${estiloEntrada} sm:max-w-sm`}>
            <option value="" disabled>
              Escolha…
            </option>
            {areas.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        {projetos ? (
          <Campo rotulo="Projeto" dica="Opcional. Escolha o projeto ou o evento que este pedido ajuda a divulgar.">
            <select name="projeto_id" defaultValue={inicial?.projetoId ?? ''} className={`${estiloEntrada} sm:max-w-md`}>
              <option value="">Nenhum projeto</option>
              {inicial?.projetoId && !projetos.some((x) => x.id === inicial.projetoId) && <option value={inicial.projetoId}>{inicial.projetoCodigo ?? 'Projeto do pedido'}</option>}
              {projetos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} · {x.titulo}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          inicial?.projetoId && <input type="hidden" name="projeto_id" value={inicial.projetoId} />
        )}
        <Campo rotulo="Link da pasta do vídeo" dica="Opcional. Cole o link completo da pasta do Drive (começando com https://).">
          <input type="url" name="link_video" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={estiloEntrada} />
        </Campo>
        {(link.trim() || temFoto) && (
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-aviso/40 bg-aviso-fundo p-3 text-sm">
            <input type="checkbox" name="imagem_confirmada" className="mt-0.5 accent-destaque" />
            <span>
              <span className="font-semibold text-texto">As pessoas que aparecem têm autorização de uso de imagem</span>
              <span className="block text-texto-suave">Obrigatório quando há foto ou link de vídeo, a cada envio e reenvio. O Elo guarda quando e por quem foi confirmado.</span>
            </span>
          </label>
        )}
      </Bloco>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <BotaoEnviar enviando="Enviando…" pendente={enviando} disabled={enviandoArquivo}>
          {rotuloEnviar}
        </BotaoEnviar>
        {enviandoArquivo && <p className="text-sm text-texto-suave">Aguarde o envio dos arquivos terminar.</p>}
        {urgente && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-aviso">
            <IconeAtencao tamanho={16} /> Vai como urgente
          </p>
        )}
      </div>
    </form>
  );
}

/** Faixa do prazo: antes da data, diz qual é o prazo; depois, se o pedido vai como urgente. */
function Prazo({ passado, urgente, dataOk, antecedencia, limite }: { passado: boolean; urgente: boolean; dataOk: boolean; antecedencia: number; limite: string }) {
  const desde = `${dataPorExtenso(limite)} (${dataCurta(limite)})`;
  const [classe, Icone, titulo, texto] = passado
    ? (['border-erro bg-erro-fundo text-erro', IconeErro, 'Essa data já passou', 'Escolha hoje ou um dia depois.'] as const)
    : urgente
      ? ([
          'border-aviso bg-aviso-fundo text-aviso',
          IconeAtencao,
          'Pedido urgente',
          `A Comunicação pede ${antecedencia} dias úteis de antecedência. Para não ser urgente, escolha a partir de ${desde}.`,
        ] as const)
      : dataOk
        ? (['border-sucesso bg-sucesso-fundo text-sucesso', IconeCerto, 'Dentro do prazo', `A data respeita a antecedência mínima de ${antecedencia} dias úteis.`] as const)
        : (['border-destaque bg-destaque-suave text-destaque', IconeInfo, 'Prazo da Comunicação', `${antecedencia} dias úteis de antecedência. Sem urgência a partir de ${desde}.`] as const);
  return (
    <div role={passado ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border-l-4 px-4 py-3 text-sm ${classe}`}>
      <Icone className="mt-0.5 shrink-0" />
      <p>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-texto">{texto}</span>
      </p>
    </div>
  );
}
