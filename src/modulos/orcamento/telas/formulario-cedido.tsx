'use client';

/** Cadastro e alteração de um profissional cedido: dados, valor (só na inclusão) e lotação por serviço. */
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { FichaCedido } from '../aplicacao/cedidos';
import { ROTULO_TIPO_VALOR, TIPOS_VALOR, validarLotacao } from '../dominio/cedidos';
import { dividirIgualmente, type LinhaRateio } from '../dominio/folha';
import { GridRateio } from './grid-rateio';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

const numero = (t: string) => {
  const s = t.trim().replace(/\s|R\$/g, '');
  if (s === '') return NaN;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};

export function FormularioCedido({ ficha, acao }: { ficha: FichaCedido; acao: Acao }) {
  const { cedido, opcoes, podeEditar } = ficha;
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [colaborador, setColaborador] = useState(cedido?.colaborador ?? '');
  const [funcao, setFuncao] = useState(cedido?.funcao ?? '');
  const [carga, setCarga] = useState(cedido?.cargaHoraria ? String(cedido.cargaHoraria) : '');
  const [cedenteId, setCedenteId] = useState(cedido?.cedenteId ?? '');
  const [inicio, setInicio] = useState(cedido?.inicio ?? '');
  const [fim, setFim] = useState(cedido?.fimPrevisto ?? '');
  const [observacao, setObservacao] = useState(cedido?.observacao ?? '');
  const [valor, setValor] = useState('');
  const [tipoValor, setTipoValor] = useState<string>('informado');
  const [lotacao, setLotacao] = useState<LinhaRateio[]>(ficha.lotacao);

  const valorNumero = numero(valor);
  const errosLotacao = validarLotacao(lotacao);
  const pronto =
    funcao.trim().length > 1 && cedenteId !== '' && inicio !== '' && errosLotacao.length === 0 && (cedido ? true : Number.isFinite(valorNumero) && valorNumero > 0);

  const dados = JSON.stringify({
    id: cedido?.id,
    versao: cedido?.versao,
    colaborador: colaborador.trim() || null,
    funcao,
    cargaHoraria: carga ? Number(carga) : null,
    cedenteId,
    inicio,
    fimPrevisto: fim || null,
    observacao: observacao.trim() || null,
    lotacao,
    ...(cedido ? {} : { valorMensal: valorNumero, tipoValor }),
  });

  return (
    <form action={enviar} className="max-w-4xl space-y-6">
      <input type="hidden" name="dados" value={dados} />
      <fieldset disabled={!podeEditar} className="min-w-0 space-y-6">
        <legend className="sr-only">Dados do profissional cedido</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome ou descrição da vaga cedida" dica="Dado pessoal: aparece só para quem vê a folha por pessoa.">
            <input value={colaborador} onChange={(e) => setColaborador(e.target.value)} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Função" obrigatorio>
            <input value={funcao} onChange={(e) => setFuncao(e.target.value)} required className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Quem cede" obrigatorio>
            <select value={cedenteId} onChange={(e) => setCedenteId(e.target.value)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {opcoes.cedentes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Carga horária" dica="Horas por mês, ex.: 160">
            <input value={carga} onChange={(e) => setCarga(e.target.value)} inputMode="numeric" className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Início da cessão" obrigatorio>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Fim previsto" dica="Deixe vazio se não há data.">
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={estiloEntrada} />
          </Campo>
        </div>

        {!cedido && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor mensal" dica="Valor em reais por mês." obrigatorio>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" required className={`${estiloEntrada} text-right tabular-nums`} />
            </Campo>
            <Campo rotulo="Tipo do valor" obrigatorio>
              <select value={tipoValor} onChange={(e) => setTipoValor(e.target.value)} className={estiloEntrada}>
                {TIPOS_VALOR.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_VALOR[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <p className="text-sm text-texto-suave sm:col-span-2">
              O Elo não calcula o custo equivalente; digite o valor que a instituição gastaria com um funcionário da mesma função.
            </p>
          </div>
        )}

        <section aria-labelledby="lotacao-cedido">
          <h2 id="lotacao-cedido" className="text-lg font-bold">
            Lotação por serviço
          </h2>
          <p className="text-sm text-texto-suave">Em quais serviços a pessoa trabalha, em percentual. Precisa somar 100%.</p>
          <GridRateio
            linhas={lotacao}
            onChange={setLotacao}
            centros={opcoes.servicos}
            custoMensal={cedido ? (ficha.valor?.valorMensal ?? 0) : Number.isFinite(valorNumero) ? valorNumero : 0}
            onDividir={() => setLotacao(dividirIgualmente(lotacao.map((l) => l.centro).filter(Boolean)))}
          />
        </section>

        <Campo rotulo="Observação">
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={estiloEntrada} />
        </Campo>
      </fieldset>

      {podeEditar ? (
        <BotaoEnviar pendente={enviando} disabled={!pronto} enviando="Salvando…">
          {cedido ? 'Salvar alterações' : 'Adicionar cedido'}
        </BotaoEnviar>
      ) : (
        <Aviso tipo="info">Você pode consultar, sem alterar.</Aviso>
      )}
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {estado.erro}
        </Aviso>
      )}
    </form>
  );
}
