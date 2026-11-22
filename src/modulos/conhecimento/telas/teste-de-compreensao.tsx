'use client';

/**
 * Teste de compreensão (regras 12 a 14): uma opção por pergunta; o resultado aparece na mesma tela,
 * com as perguntas erradas e sem a resposta certa. As respostas marcadas permanecem se o envio falhar.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';

interface Resultado {
  acertos: number;
  total: number;
  aprovada: boolean;
  erradas: number[];
}

export function TesteDeCompreensao({
  id,
  perguntas,
  enviar,
  cienciaDepois,
}: {
  id: string;
  perguntas: { ordem: number; texto: string; opcoes: string[] }[];
  enviar: (id: string, respostas: (number | null)[]) => Promise<{ erro: string } | Resultado>;
  /** A publicação também exige ciência: o aviso de sucesso manda confirmá-la. */
  cienciaDepois: boolean;
}) {
  const roteador = useRouter();
  const [respostas, setRespostas] = useState<(number | null)[]>(() => perguntas.map(() => null));
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await enviar(id, respostas);
      if ('erro' in r) return setErro(r.erro);
      setResultado(r);
      if (r.aprovada) roteador.refresh();
    });
  }

  function tentarDeNovo() {
    setResultado(null);
    setRespostas(perguntas.map(() => null));
  }

  if (resultado?.aprovada)
    return (
      <Aviso tipo="sucesso" titulo="Você acertou todas">
        {cienciaDepois ? 'Agora confirme que leu e está de acordo.' : 'Você está em dia com este documento.'}
      </Aviso>
    );

  if (resultado)
    return (
      <div className="space-y-3" role="status">
        <Aviso tipo="info" titulo={`Você acertou ${resultado.acertos} de ${resultado.total}`}>
          Revise {resultado.erradas.length === 1 ? 'a pergunta' : 'as perguntas'} {resultado.erradas.join(', ')} e tente de novo. Pode tentar quantas vezes quiser.
        </Aviso>
        <Botao type="button" onClick={tentarDeNovo}>
          Tentar de novo
        </Botao>
      </div>
    );

  return (
    <form onSubmit={submeter} className="space-y-5">
      {erro && (
        <Aviso tipo="erro" titulo="Não foi possível enviar">
          {erro}
        </Aviso>
      )}
      {perguntas.map((q, i) => (
        <fieldset key={q.ordem} className="space-y-1">
          <legend className="mb-1 font-semibold">
            {q.ordem}. {q.texto}
          </legend>
          {q.opcoes.map((o, j) => (
            <label key={j} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-superficie-2">
              <input
                type="radio"
                name={`pergunta-${q.ordem}`}
                checked={respostas[i] === j}
                onChange={() => setRespostas((r) => r.map((v, k) => (k === i ? j : v)))}
                className="size-4"
              />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <Botao type="submit" disabled={pendente || respostas.some((r) => r === null)}>
        {pendente ? 'Enviando…' : 'Enviar respostas'}
      </Botao>
      {respostas.some((r) => r === null) && <p className="text-sm text-texto-suave">Responda todas as perguntas para enviar.</p>}
    </form>
  );
}
