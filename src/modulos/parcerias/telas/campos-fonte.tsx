import { Campo, estiloEntrada } from '@/ui/campo';

/** Campos de uma fonte (usados no novo termo e em "Adicionar fonte"). */
export function CamposFonte({ comNome = true }: { comNome?: boolean }) {
  return (
    <div className="space-y-4">
      {comNome && (
        <Campo rotulo="Nome da fonte" obrigatorio dica="Ex.: Fundo municipal, cofinanciamento estadual.">
          <input name="fonte_nome" required className={estiloEntrada} />
        </Campo>
      )}
      <Campo rotulo="Como o valor é informado" obrigatorio>
        <select name="forma" defaultValue="global" className={estiloEntrada}>
          <option value="global">Valor global (digito o valor)</option>
          <option value="per_capita">Per capita (valor × vagas custeadas × meses)</option>
        </select>
      </Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Valor inicial (global)" dica="Só na forma global.">
          <input name="valor_inicial" inputMode="decimal" className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Per capita" dica="Só na forma per capita.">
          <input name="per_capita" inputMode="decimal" className={estiloEntrada} />
        </Campo>
        <Campo rotulo="O per capita é">
          <select name="periodicidade" defaultValue="mensal" className={estiloEntrada}>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="Cronograma de desembolso" obrigatorio dica="Partes iguais: o Elo divide o valor pelos meses. Digitado: você informa cada parcela.">
        <select name="cronograma" defaultValue="iguais" className={estiloEntrada}>
          <option value="iguais">Partes iguais nos meses abaixo</option>
          <option value="digitado">Digitado mês a mês</option>
        </select>
      </Campo>
      <Campo rotulo="Meses de recebimento (partes iguais)" dica="Formato AAAA-MM, separados por vírgula. Ex.: 2026-03, 2026-06, 2026-09, 2026-12.">
        <input name="meses" className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Parcelas digitadas" dica="Uma por linha: mês e valor. Ex.: 2026-02 12000,00. A soma deve bater com o valor da fonte; se não bater, a ficha avisa.">
        <textarea name="parcelas" rows={3} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Plano de aplicação (opcional)" dica="Uma categoria por linha, com o valor no fim. Ex.: Pessoal 70000,00.">
        <textarea name="categorias" rows={3} className={estiloEntrada} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Recursos próprios previstos da fonte (opcional)" dica="Contrapartida prometida no plano.">
          <input name="recursos_proprios_fonte" inputMode="decimal" className={estiloEntrada} />
        </Campo>
        <label className="flex items-start gap-2 pt-7 text-sm">
          <input type="checkbox" name="permite_remanejar" value="sim" className="mt-0.5" />
          <span className="font-semibold">Permite remanejar entre categorias</span>
        </label>
      </div>
    </div>
  );
}
