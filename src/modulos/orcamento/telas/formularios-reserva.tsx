'use client';

/**
 * Formulários da tela Reserva (1D.2): pedir uso da reserva e propor política. O erro aparece junto do
 * formulário e o que a pessoa digitou fica; ao gravar, o formulário volta ao estado limpo.
 */
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { Faixas } from '../dominio/reserva';

type Estado = { erro?: string; ok?: string; valores?: Record<string, string> };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

export function FormularioPedirUso({ acao, meses }: { acao: Acao; meses: { valor: string; rotulo: string }[] }) {
  const [estado, enviar] = useActionState(acao, {});
  // Depois de gravar, a chave muda e os campos voltam em branco.
  const [chave, setChave] = useState(0);
  const [ultimoOk, setUltimoOk] = useState<string | undefined>();
  if (estado.ok && estado.ok !== ultimoOk) {
    setUltimoOk(estado.ok);
    setChave((k) => k + 1);
  }
  return (
    <form key={chave} action={enviar} className="space-y-4" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="sucesso">{estado.ok}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Valor (R$)" obrigatorio dica="Como 1.500,00. Não passa do saldo da reserva.">
          <input name="valor" inputMode="decimal" required className={`${estiloEntrada} text-right tabular-nums`} defaultValue={estado.valores?.valor} />
        </Campo>
        <Campo rotulo="Recompor até (mês)" obrigatorio dica="Mês/ano em que o valor volta para a reserva.">
          <select name="prazo" required defaultValue={estado.valores?.prazo ?? ''} className={estiloEntrada}>
            <option value="" disabled>
              Escolha…
            </option>
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Motivo" obrigatorio dica="Por que a reserva precisa ser usada.">
        <textarea name="motivo" required rows={2} defaultValue={estado.valores?.motivo} className={estiloEntrada} />
      </Campo>
      <BotaoEnviar enviando="Gravando…">Pedir uso da reserva</BotaoEnviar>
    </form>
  );
}

const CAMPOS: { chave: keyof Faixas; rotulo: string; dica: string }[] = [
  { chave: 'meses_minimo', rotulo: 'Meses de folha na reserva', dica: 'Mínimo da reserva = esses meses × a folha média mensal do ano.' },
  { chave: 'livre_ok', rotulo: 'Livre disponível: ok a partir de (meses)', dica: 'Saldo livre ÷ gasto médio mensal com recurso livre.' },
  { chave: 'livre_atencao', rotulo: 'Livre disponível: atenção a partir de (meses)', dica: 'Abaixo disso é crítico.' },
  { chave: 'fim_ok', rotulo: 'Fim do ano: ok a partir de (R$)', dica: 'Folga em dezembro; de zero até esse valor é atenção, abaixo de zero é crítico.' },
  { chave: 'exec_atencao', rotulo: 'Execução: atenção até (% da receita prevista)', dica: 'Abaixo de zero até esse percentual negativo é atenção.' },
  { chave: 'folha_ok', rotulo: 'Folha sobre a receita: ok até (%)', dica: 'RH e encargos ÷ receita no ano.' },
  { chave: 'folha_atencao', rotulo: 'Folha sobre a receita: atenção até (%)', dica: 'Acima disso é crítico.' },
  { chave: 'gasto_ok', rotulo: 'Gasto com recurso livre: ok até (pontos)', dica: 'Variação do gasto livre menos a da receita livre.' },
  { chave: 'gasto_atencao', rotulo: 'Gasto com recurso livre: atenção até (pontos)', dica: 'Acima disso é crítico.' },
  { chave: 'reserva_ok', rotulo: 'Reserva: ok a partir de (% do mínimo)', dica: 'Saldo da reserva ÷ mínimo aprovado.' },
  { chave: 'reserva_atencao', rotulo: 'Reserva: atenção a partir de (% do mínimo)', dica: 'Abaixo disso é crítico.' },
];

const texto = (v: number) => String(v).replace('.', ',');

export function FormularioProporPolitica({ acao, atuais }: { acao: Acao; atuais: Faixas }) {
  const [estado, enviar] = useActionState(acao, {});
  return (
    <form action={enviar} className="space-y-4" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="sucesso">{estado.ok}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <Campo key={c.chave} rotulo={c.rotulo} dica={c.dica} obrigatorio>
            <input name={c.chave} inputMode="decimal" required defaultValue={estado.valores?.[c.chave] ?? texto(atuais[c.chave])} className={`${estiloEntrada} text-right tabular-nums`} />
          </Campo>
        ))}
      </div>
      <BotaoEnviar enviando="Gravando…">Propor política</BotaoEnviar>
    </form>
  );
}
