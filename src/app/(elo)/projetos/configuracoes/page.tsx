import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerConfigComVersoes } from '@/modulos/projetos/aplicacao/configuracoes';
import { NOME_PARECER, NOME_PORTE, PORTES, TIPOS_PARECER } from '@/modulos/projetos/dominio/projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoSalvarConfig } from '../acoes';

export const metadata: Metadata = { title: 'Configurações de Projetos' };

const PAPEIS = [
  { papel: 'tecnico', rotulo: 'Pareceristas técnicos' },
  { papel: 'financeiro', rotulo: 'Pareceristas financeiros' },
  { papel: 'juridico', rotulo: 'Pareceristas jurídicos' },
  { papel: 'alcada', rotulo: 'Presidência ou Conselho (decisão acima do limite)' },
] as const;

export default async function Configuracoes() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('projetos.configurar')) redirect('/projetos');
  const { planilhas } = await obterAplicacao();
  const { config, versoes } = await lerConfigComVersoes(planilhas);
  return (
    <div className="max-w-3xl space-y-6">
      <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Configurações' }]} titulo="Configurações" descricao="Como a sua instituição quer decidir sobre as ideias de projeto." />
      <form action={acaoSalvarConfig} className="space-y-6">
        <input type="hidden" name="versoes" value={JSON.stringify(versoes)} />
        <Secao id="t-pareceres" titulo="Pareceres exigidos na porta 1" descricao="Marque quais pareceres a porta pede, para cada porte. Quem não tem parecer exigido segue direto para a decisão.">
          <div className="grid gap-5 sm:grid-cols-2">
            {PORTES.map((porte) => (
              <fieldset key={porte} className="space-y-2">
                <legend className="font-semibold">Porte {NOME_PORTE[porte].toLowerCase()}</legend>
                {TIPOS_PARECER.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`pareceres_${porte}`} value={t} defaultChecked={config.pareceresPorta1[porte].includes(t)} className="size-4" />
                    Parecer {NOME_PARECER[t].toLowerCase()}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </Secao>
        <Secao id="t-alcada" titulo="Alçada" descricao="Acima deste valor, o “seguir” da Diretoria espera a decisão da Presidência ou do Conselho.">
          <Campo rotulo="Limite de alçada (R$)" dica="Deixe em branco para não ter alçada.">
            <input name="limite" inputMode="decimal" defaultValue={config.limiteAlcada ?? ''} className={`${estiloEntrada} max-w-48`} />
          </Campo>
        </Secao>
        <Secao id="t-tolerancias" titulo="Tolerâncias sugeridas no Termo de Abertura" descricao="O Termo já vem com estes valores; o responsável pode mudá-los em cada projeto. Zero significa nenhuma margem.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Custo por linha do orçamento (%)" dica="ex.: 10">
              <input name="tol_custo_linha" inputMode="decimal" defaultValue={config.tolerancias.custoLinhaPct} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Custo no total (%)" dica="ex.: 5">
              <input name="tol_custo_total" inputMode="decimal" defaultValue={config.tolerancias.custoTotalPct} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Atraso no fim do projeto (dias)" dica="ex.: 15">
              <input name="tol_prazo_fim" inputMode="numeric" defaultValue={config.tolerancias.prazoFimDias} className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Atraso em cada marco (dias)" dica="ex.: 7">
              <input name="tol_prazo_marco" inputMode="numeric" defaultValue={config.tolerancias.prazoMarcoDias} className={estiloEntrada} />
            </Campo>
          </div>
        </Secao>
        <Secao id="t-banca" titulo="Quem dá parecer e quem decide pela alçada" descricao="E-mails, separados por vírgula. A pessoa precisa ter acesso ao Elo.">
          <div className="space-y-4">
            {PAPEIS.map((x) => (
              <Campo key={x.papel} rotulo={x.rotulo}>
                <textarea name={`designados_${x.papel}`} rows={2} defaultValue={config.designados[x.papel].join(', ')} className={estiloEntrada} />
              </Campo>
            ))}
          </div>
        </Secao>
        <Secao id="t-conflito" titulo="Conflito de interesse">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="proponente_decide" value="sim" defaultChecked={config.proponenteDecide} className="mt-0.5 size-4" />
            <span>Quem propôs a ideia pode decidir a própria porta. Por padrão, não pode.</span>
          </label>
        </Secao>
        <BotaoEnviar enviando="Salvando…">Salvar configurações</BotaoEnviar>
      </form>
    </div>
  );
}
