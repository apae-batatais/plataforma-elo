import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarLimites } from '@/modulos/orcamento/aplicacao/sustentabilidade';
import { NOME_INDICADOR } from '@/modulos/orcamento/dominio/sustentabilidade';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoRemoverLimite, acaoSalvarLimite } from '../acoes';

export const metadata: Metadata = { title: 'Limites do painel' };

export default async function Limites() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.sustentabilidade.ver')) redirect('/');
  const { planilhas } = await obterAplicacao();
  const { limites, servicos, podeEditar } = await listarLimites(planilhas, usuario.autorizador);
  const formulario = (
    <form action={acaoSalvarLimite} className="space-y-4">
      <input type="hidden" name="indicador" value="peso_aporte" />
      <Campo rotulo="Serviço" dica="Deixe em branco para o limite da instituição. Para um serviço, vale o aporte dele sozinho.">
        <select name="servico" defaultValue="" className={estiloEntrada}>
          <option value="">Toda a instituição</option>
          {servicos.map((s) => (
            <option key={s.codigo} value={s.codigo}>{s.nome}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Limite (%)" dica="Alertar quando o aporte passar de X% da receita livre do ano. Entre 0 e 100.">
        <input name="valor" inputMode="decimal" required className={estiloEntrada} />
      </Campo>
      <BotaoEnviar enviando="Salvando…" className="w-full">Salvar limite</BotaoEnviar>
    </form>
  );
  return (
    <div className="space-y-4">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Limites do painel' }]}
        titulo="Limites do painel"
        descricao="Quem define quando o painel de sustentabilidade alerta é a instituição: o Elo não impõe régua. Sem limite, o painel mostra o número e não alerta."
        acoes={podeEditar ? <JanelaFormulario rotulo="Adicionar limite" titulo="Adicionar limite">{formulario}</JanelaFormulario> : undefined}
      />
      {limites.length === 0 ? (
        <EstadoVazio titulo="Nenhum limite definido">{podeEditar ? 'Use "Adicionar limite" para definir quando o painel deve alertar.' : 'O Financeiro define os limites.'}</EstadoVazio>
      ) : (
        <TabelaDados
          legenda="Limites de alerta"
          colunas={[
            { chave: 'indicador', rotulo: 'Indicador' },
            { chave: 'servico', rotulo: 'Serviço' },
            { chave: 'valor', rotulo: 'Limite (%)', tipo: 'numero' },
            ...(podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-28' }] : []),
          ]}
          linhas={limites.map((l) => ({
            id: l.id,
            valores: { indicador: NOME_INDICADOR[l.indicador] ?? l.indicador, servico: l.servicoNome ?? 'Toda a instituição', valor: l.valor },
            celulas: {
              acoes: (
                <FormularioConfirmado
                  acao={acaoRemoverLimite}
                  campos={{ id: l.id }}
                  rotulo="Remover"
                  titulo="Remover limite"
                  mensagem="O painel deixa de alertar por este limite. Você pode adicioná-lo de novo quando quiser."
                  confirmar="Remover limite"
                  pequeno
                />
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
