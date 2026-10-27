import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cadastros } from '@/modulos/orcamento/aplicacao/folha';
import { PARAMETROS } from '@/modulos/orcamento/dominio/folha';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoSalvarParametros } from '../acoes';

export const metadata: Metadata = { title: 'Parâmetros da folha' };

const GRUPOS = [
  { titulo: 'Ano da folha', chaves: ['ano'] },
  {
    titulo: 'Provisões e encargos',
    texto: 'Percentuais sobre a remuneração (salário base, adicional, hora atividade, insalubridade, periculosidade e gratificação). Benefícios não entram na conta.',
    chaves: ['ferias', 'terco_ferias', 'decimo_terceiro', 'abono', 'fgts', 'indenizacoes'],
  },
  { titulo: 'Reajuste', texto: 'Aplicado à remuneração a partir do mês indicado. Os meses anteriores não mudam.', chaves: ['reajuste_percentual', 'reajuste_mes'] },
];

export default async function Parametros() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const c = await cadastros(app.planilhas, usuario.autorizador);
  const def = new Map(PARAMETROS.map((p) => [p.chave as string, p]));
  const sufixo = (k: string) => (k === 'ano' || k === 'reajuste_mes' ? '' : '%');

  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Parâmetros' }]}
        titulo="Parâmetros da folha"
        descricao="Definidos pelo Financeiro. Valem para o cálculo do custo de todos os postos."
      />
      {!c.podeEditar && (
        <div className="mb-6">
          <Aviso tipo="info">Você pode consultar os parâmetros, sem alterar.</Aviso>
        </div>
      )}
      <form action={acaoSalvarParametros}>
        <fieldset disabled={!c.podeEditar} className="min-w-0 space-y-6">
          <legend className="sr-only">Parâmetros</legend>
          {GRUPOS.map((g) => (
            <Secao key={g.titulo} titulo={g.titulo} descricao={g.texto}>
              <div className="grid gap-4 sm:grid-cols-3">
                {g.chaves.map((k) => (
                  <Campo key={k} rotulo={def.get(k)!.nome.replace(' (%)', '')}>
                    <div className="relative">
                      <input
                        name={k}
                        required
                        inputMode="decimal"
                        defaultValue={String(c.parametros[k as keyof typeof c.parametros]).replace('.', ',')}
                        className={`${estiloEntrada} text-right tabular-nums ${sufixo(k) ? 'pr-8' : ''}`}
                      />
                      {sufixo(k) && <span className="pointer-events-none absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-texto-suave">%</span>}
                    </div>
                  </Campo>
                ))}
              </div>
            </Secao>
          ))}
          {c.podeEditar && <BotaoEnviar enviando="Salvando…">Salvar parâmetros</BotaoEnviar>}
        </fieldset>
      </form>
    </div>
  );
}
