import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { parametrosDaFolha } from '@/modulos/orcamento/aplicacao/folha';
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
  { titulo: 'Reajuste', texto: 'O reajuste de cada funcionário fica na ficha dele. Aqui ficam o padrão para novos cadastros e o mês em que o reajuste começa a valer.', chaves: ['reajuste_padrao', 'reajuste_mes'] },
  { titulo: 'Hora atividade', texto: 'Percentual sobre o salário base de quem recebe hora atividade.', chaves: ['hora_atividade'] },
  {
    titulo: 'Encargos',
    texto: 'Calculados no Resumo da folha sobre o total da remuneração salarial. A aposentadoria especial incide sobre salário base + insalubridade de quem tem insalubridade.',
    chaves: ['fgts', 'inss', 'terceiros', 'fap', 'aposentadoria_especial', 'pis'],
  },
];

export default async function Parametros() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const c = await parametrosDaFolha(app.planilhas, usuario.autorizador);
  const def = new Map(PARAMETROS.map((p) => [p.chave as string, p]));
  const sufixo = (k: string) => (k === 'ano' || k === 'reajuste_mes' ? '' : '%');

  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Parâmetros' }]}
        titulo="Parâmetros da folha"
        descricao="Definidos pelo Financeiro. Valem para o cálculo da folha de todos os funcionários."
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
                  <Campo key={k} rotulo={def.get(k)!.nome.replace(' (%)', '').replace(' (% do salário base)', '')}>
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
