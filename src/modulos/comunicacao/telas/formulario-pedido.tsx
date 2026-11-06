'use client';

/**
 * Formulário do pedido (novo e ajuste): tema com busca e "Fora do calendário", tipo de peça,
 * título, descrição, data desejada com aviso imediato de urgência e link do vídeo com a
 * confirmação de uso de imagem sempre visível quando há link.
 */
import { useActionState, useMemo, useState, startTransition, type FormEvent } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeAtencao, IconeCerto } from '@/ui/icones';
import { NOME_TIPO_PECA, TIPOS_PECA, type TipoPeca } from '../dominio/pedido';
import { ehUrgente, somarDiasUteis } from '../dominio/prazos';
import { dataCurta, quandoCai } from './mes';

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
}

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

export function FormularioPedido({
  acao,
  itens,
  areas,
  hoje,
  antecedencia,
  inicial,
  oculto,
  rotuloEnviar,
}: {
  acao: (estado: EstadoPedido, f: FormData) => Promise<EstadoPedido>;
  itens: ItemEscolha[];
  areas: { codigo: string; nome: string }[];
  /** Dia de hoje em Brasília (AAAA-MM-DD). */
  hoje: string;
  antecedencia: number;
  inicial?: ValoresPedido;
  oculto?: Record<string, string | number>;
  rotuloEnviar: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  // Envio sem "action" no formulário: o React não limpa os campos quando o servidor devolve um erro.
  const enviarSemLimpar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(() => enviar(f));
  };
  const [busca, setBusca] = useState('');
  const [tema, setTema] = useState(inicial?.calendarioId ?? '');
  const [data, setData] = useState(inicial?.dataDesejada ?? '');
  const [link, setLink] = useState(inicial?.linkVideo ?? '');

  // O tema já gravado no pedido continua na lista, mesmo desativado ou encerrado.
  const lista = useMemo(() => {
    const base = [...itens];
    if (inicial?.calendarioId && !base.some((i) => i.id === inicial.calendarioId))
      base.unshift({ id: inicial.calendarioId, tema: inicial.calendarioTema ?? 'Tema do pedido', inicio: '', fim: '', tipos: [] });
    return base;
  }, [itens, inicial]);
  const visiveis = lista.filter((i) => normal(i.tema).includes(normal(busca.trim())));

  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const passado = dataOk && data < hoje;
  const urgente = dataOk && !passado && ehUrgente(data, hoje, antecedencia);
  const limite = somarDiasUteis(hoje, antecedencia);

  return (
    <form onSubmit={enviarSemLimpar} className="space-y-6">
      {Object.entries(oculto ?? {}).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível enviar">
          {estado.erro}
        </Aviso>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Tema do calendário</legend>
        <p className="text-sm text-texto-suave">Escolha o tema a que o pedido se liga, ou &ldquo;Fora do calendário&rdquo;.</p>
        <label className="block text-sm">
          <span className="sr-only">Buscar tema</span>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tema" className={estiloEntrada} />
        </label>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-borda p-2">
          <label className="flex min-h-11 items-center gap-2 rounded px-2 text-sm hover:bg-superficie-2">
            <input type="radio" name="calendario_id" value="" checked={tema === ''} onChange={() => setTema('')} />
            <span className="font-semibold">Fora do calendário</span>
          </label>
          {visiveis.map((i) => (
            <label key={i.id} className="flex min-h-11 items-start gap-2 rounded px-2 py-2 text-sm hover:bg-superficie-2">
              <input type="radio" name="calendario_id" value={i.id} checked={tema === i.id} onChange={() => setTema(i.id)} className="mt-0.5" />
              <span>
                <span className="font-semibold">{i.tema}</span>
                {i.inicio && <span className="block text-texto-suave">{quandoCai(i)}</span>}
              </span>
            </label>
          ))}
          {visiveis.length === 0 && <p className="px-2 py-2 text-sm text-texto-suave">Nenhum tema com esse nome.</p>}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo de peça" obrigatorio>
          <select name="tipo_peca" required defaultValue={inicial?.tipoPeca ?? ''} className={estiloEntrada}>
            <option value="" disabled>
              Escolha
            </option>
            {TIPOS_PECA.map((t) => (
              <option key={t} value={t}>
                {NOME_TIPO_PECA[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Área" obrigatorio>
          <select name="area" required defaultValue={inicial?.area ?? ''} className={estiloEntrada}>
            <option value="" disabled>
              Escolha
            </option>
            {areas.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo rotulo="Título" obrigatorio>
        <input type="text" name="titulo" required maxLength={140} defaultValue={inicial?.titulo} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="O que deve ser publicado" obrigatorio dica="Conte o assunto, as informações que precisam aparecer e o que for importante para a Comunicação.">
        <textarea name="descricao" required rows={5} defaultValue={inicial?.descricao} className={estiloEntrada} />
      </Campo>

      <div className="space-y-2">
        <Campo rotulo="Data desejada para a publicação" obrigatorio>
          <input type="date" name="data_desejada" required value={data} min={hoje} onChange={(e) => setData(e.target.value)} className={`${estiloEntrada} max-w-48`} />
        </Campo>
        {passado && (
          <p className="flex items-center gap-2 text-sm text-erro" role="alert">
            <IconeAtencao tamanho={16} /> Essa data já passou. Escolha hoje ou um dia depois.
          </p>
        )}
        {urgente && (
          <p className="flex items-center gap-2 text-sm font-semibold text-aviso" role="status">
            <IconeAtencao tamanho={16} /> Pedido urgente: a Comunicação pede {antecedencia} dias úteis de antecedência (a partir de {dataCurta(limite)}).
          </p>
        )}
        {dataOk && !passado && !urgente && (
          <p className="flex items-center gap-2 text-sm text-sucesso" role="status">
            <IconeCerto tamanho={16} /> Dentro da antecedência mínima de {antecedencia} dias úteis.
          </p>
        )}
      </div>

      <Campo rotulo="Link da pasta do vídeo" dica="Opcional. Cole o link completo da pasta do Drive (começando com https://).">
        <input type="url" name="link_video" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={estiloEntrada} />
      </Campo>
      {link.trim() && (
        <label className="flex min-h-11 items-start gap-2 rounded-lg border border-borda p-3 text-sm">
          <input type="checkbox" name="imagem_confirmada" className="mt-0.5" />
          <span>
            <span className="font-semibold">As pessoas que aparecem têm autorização de uso de imagem</span>
            <span className="block text-texto-suave">Obrigatório quando há link de vídeo, a cada envio e reenvio. O Elo guarda quando e por quem foi confirmado.</span>
          </span>
        </label>
      )}

      <BotaoEnviar enviando="Enviando…" pendente={enviando}>{rotuloEnviar}</BotaoEnviar>
    </form>
  );
}
