'use client';

/**
 * Formulário da publicação (nova ou edição). Fica na própria página: em erro, mostra a frase e mantém
 * tudo o que foi digitado (o envio não recarrega a página).
 */
import { useState, useTransition } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { LIMITES, TESTE, type PerguntaEntrada } from '../dominio/publicacao';
import { CampoAnexo } from './campo-anexo';

export interface ValorPublicacao {
  id: string;
  versao: number;
  titulo: string;
  categoria: string;
  resumo: string | null;
  corpo: string | null;
  publicoTipo: 'todos' | 'perfil' | 'area';
  publicoValor: string | null;
  exigeCiencia: boolean;
  temTeste: boolean;
  perguntas: PerguntaEntrada[];
  situacao: 'rascunho' | 'publicada' | 'arquivada';
  anexoNome: string | null;
  comCiencia: number;
  comTentativas: number;
}

const novaPergunta = (): PerguntaEntrada => ({ texto: '', opcoes: ['', ''], correta: 0 });

export function FormularioPublicacao({
  acao,
  iniciarEnvio,
  categorias,
  perfis,
  areas,
  valor,
}: {
  acao: (f: FormData) => Promise<{ erro: string } | undefined>;
  iniciarEnvio: (a: { mime: string; tamanho: number }) => Promise<{ url?: string; erro?: string }>;
  categorias: { codigo: string; nome: string }[];
  perfis: { codigo: string; nome: string }[];
  areas: { codigo: string; nome: string }[];
  valor?: ValorPublicacao;
}) {
  const [pendente, iniciar] = useTransition();
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [publicoTipo, setPublicoTipo] = useState(valor?.publicoTipo ?? 'todos');
  const [corpo, setCorpo] = useState(valor?.corpo ?? '');
  const [temTeste, setTemTeste] = useState(valor?.temTeste ?? false);
  const [perguntas, setPerguntas] = useState<PerguntaEntrada[]>(valor?.perguntas.length ? valor.perguntas : [novaPergunta()]);
  const corpoMudou = Boolean(valor) && corpo.trim() !== (valor?.corpo ?? '').trim();
  const testeMudou =
    Boolean(valor) && (temTeste !== valor!.temTeste || (temTeste && JSON.stringify(perguntas) !== JSON.stringify(valor!.perguntas.length ? valor!.perguntas : [novaPergunta()])));
  const registros = (valor?.comCiencia ?? 0) + (valor?.comTentativas ?? 0);
  const pedeEscolha = (corpoMudou || testeMudou) && registros > 0;
  const publicada = valor?.situacao === 'publicada';

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setErro(null);
    iniciar(async () => {
      const r = await acao(dados);
      if (r?.erro) {
        setErro(r.erro);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5 rounded-cartao border border-borda bg-superficie p-5 sm:p-6">
      {valor && <input type="hidden" name="id" value={valor.id} />}
      {valor && <input type="hidden" name="versao" value={valor.versao} />}
      {erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      <Campo rotulo="Título" obrigatorio>
        <input name="titulo" required maxLength={LIMITES.titulo} defaultValue={valor?.titulo} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Categoria" obrigatorio>
        <select name="categoria" required defaultValue={valor?.categoria ?? ''} className={estiloEntrada}>
          <option value="" disabled>
            Escolha a categoria
          </option>
          {categorias.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Resumo" dica="Uma ou duas frases que aparecem na lista.">
        <textarea name="resumo" rows={2} maxLength={LIMITES.resumo} defaultValue={valor?.resumo ?? ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Texto" dica="Escreva o texto aqui, envie um anexo, ou os dois.">
        <textarea name="corpo" rows={10} maxLength={LIMITES.corpo} value={corpo} onChange={(e) => setCorpo(e.target.value)} className={estiloEntrada} />
      </Campo>
      {pedeEscolha && (
        <fieldset className="space-y-2 rounded-lg border border-borda-forte bg-superficie-2 p-4">
          <legend className="px-1 text-sm font-semibold">
            {corpoMudou ? 'O texto' : 'O teste'} mudou e {valor!.comCiencia} {valor!.comCiencia === 1 ? 'pessoa já deu' : 'pessoas já deram'} ciência ({valor!.comTentativas} {valor!.comTentativas === 1 ? 'tentativa' : 'tentativas'} no teste). O que fazer?
          </legend>
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input type="radio" name="tipo_edicao" value="pequena" required className="mt-1 size-4" />
            <span>
              <span className="font-semibold">Correção pequena.</span> As ciências e aprovações já dadas continuam valendo.
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input type="radio" name="tipo_edicao" value="nova" required className="mt-1 size-4" />
            <span>
              <span className="font-semibold">Nova versão.</span> Todos precisam dar ciência de novo.
            </span>
          </label>
        </fieldset>
      )}
      <CampoAnexo nomeAtual={valor?.anexoNome ?? null} iniciar={iniciarEnvio} aoMudarEnvio={setEnviandoAnexo} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          Quem deve ler<span className="ml-0.5 text-erro" aria-hidden="true">*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Público">
            <select name="publico_tipo" value={publicoTipo} onChange={(e) => setPublicoTipo(e.target.value as typeof publicoTipo)} className={estiloEntrada}>
              <option value="todos">Todos</option>
              <option value="perfil">Um perfil</option>
              <option value="area">Uma área</option>
            </select>
          </Campo>
          {publicoTipo === 'perfil' && (
            <Campo rotulo="Perfil" obrigatorio>
              <select name="publico_valor" required defaultValue={valor?.publicoTipo === 'perfil' ? (valor.publicoValor ?? '') : ''} className={estiloEntrada}>
                <option value="" disabled>
                  Escolha o perfil
                </option>
                {perfis.map((x) => (
                  <option key={x.codigo} value={x.codigo}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {publicoTipo === 'area' && (
            <Campo rotulo="Área" obrigatorio>
              <select name="publico_valor" required defaultValue={valor?.publicoTipo === 'area' ? (valor.publicoValor ?? '') : ''} className={estiloEntrada}>
                <option value="" disabled>
                  Escolha a área
                </option>
                {areas.map((x) => (
                  <option key={x.codigo} value={x.codigo}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" name="exige_ciencia" defaultChecked={valor?.exigeCiencia ?? true} className="mt-1 size-4" />
        <span>
          <span className="font-semibold">Exige ciência.</span> <span className="text-texto-suave">A pessoa confirma que leu e está de acordo.</span>
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" name="tem_teste" checked={temTeste} onChange={(e) => setTemTeste(e.target.checked)} className="mt-1 size-4" />
        <span>
          <span className="font-semibold">Tem teste de compreensão.</span> <span className="text-texto-suave">A pessoa precisa acertar todas as perguntas.</span>
        </span>
      </label>
      {temTeste && <EditorDePerguntas perguntas={perguntas} aoMudar={setPerguntas} />}
      <div className="flex flex-wrap gap-3 border-t border-borda pt-4">
        {valor?.situacao !== 'publicada' && (
          <BotaoEnviar name="intencao" value="rascunho" variante="secundario" pendente={pendente || enviandoAnexo} enviando="Salvando…">
            Salvar rascunho
          </BotaoEnviar>
        )}
        <BotaoEnviar name="intencao" value="publicar" pendente={pendente || enviandoAnexo} enviando="Salvando…">
          {publicada ? 'Salvar alterações' : 'Publicar'}
        </BotaoEnviar>
      </div>
    </form>
  );
}

/** Editor das perguntas (regra 12): de 1 a 10, cada uma com 2 a 5 opções e uma certa. Vai ao servidor em JSON. */
function EditorDePerguntas({ perguntas, aoMudar }: { perguntas: PerguntaEntrada[]; aoMudar: (p: PerguntaEntrada[]) => void }) {
  const mudar = (i: number, q: Partial<PerguntaEntrada>) => aoMudar(perguntas.map((x, k) => (k === i ? { ...x, ...q } : x)));
  return (
    <fieldset className="space-y-4 rounded-lg border border-borda-forte bg-superficie-2 p-4">
      <legend className="px-1 text-sm font-semibold">Perguntas do teste</legend>
      <input type="hidden" name="perguntas" value={JSON.stringify(perguntas)} />
      <p className="text-sm text-texto-suave">
        De 1 a {TESTE.maxPerguntas} perguntas, cada uma com {TESTE.minOpcoes} a {TESTE.maxOpcoes} opções e uma resposta certa marcada. A resposta certa não aparece para quem faz o teste.
      </p>
      {perguntas.map((q, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-borda bg-superficie p-3">
          <Campo rotulo={`Pergunta ${i + 1}`} obrigatorio>
            <input value={q.texto} maxLength={TESTE.textoPergunta} onChange={(e) => mudar(i, { texto: e.target.value })} className={estiloEntrada} />
          </Campo>
          <div role="radiogroup" aria-label={`Opção certa da pergunta ${i + 1}`} className="space-y-2">
            {q.opcoes.map((o, j) => (
              <div key={j} className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" checked={q.correta === j} onChange={() => mudar(i, { correta: j })} className="size-4" />
                  <span className="whitespace-nowrap">{q.correta === j ? 'Certa' : 'Marcar como certa'}</span>
                </label>
                <input
                  aria-label={`Opção ${j + 1} da pergunta ${i + 1}`}
                  value={o}
                  maxLength={TESTE.textoOpcao}
                  onChange={(e) => mudar(i, { opcoes: q.opcoes.map((x, k) => (k === j ? e.target.value : x)) })}
                  className={`${estiloEntrada} min-w-0 flex-1`}
                />
                {q.opcoes.length > TESTE.minOpcoes && (
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm font-semibold underline"
                    onClick={() => mudar(i, { opcoes: q.opcoes.filter((_, k) => k !== j), correta: q.correta === j ? 0 : q.correta > j ? q.correta - 1 : q.correta })}
                  >
                    Remover opção
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {q.opcoes.length < TESTE.maxOpcoes && (
              <button type="button" className="min-h-11 text-sm font-semibold underline" onClick={() => mudar(i, { opcoes: [...q.opcoes, ''] })}>
                Adicionar opção
              </button>
            )}
            {perguntas.length > 1 && (
              <button type="button" className="min-h-11 text-sm font-semibold underline" onClick={() => aoMudar(perguntas.filter((_, k) => k !== i))}>
                Remover pergunta
              </button>
            )}
          </div>
        </div>
      ))}
      {perguntas.length < TESTE.maxPerguntas && (
        <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-borda-forte bg-superficie px-4 text-sm font-semibold" onClick={() => aoMudar([...perguntas, novaPergunta()])}>
          Adicionar pergunta
        </button>
      )}
    </fieldset>
  );
}
