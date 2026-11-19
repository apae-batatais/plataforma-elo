import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarFeriados } from '@/nucleo/feriados/feriados';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeLixeira } from '@/ui/icones';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoIncluirFeriado, acaoIncluirFeriadosNacionais, acaoTirarFeriado } from './acoes';

export const metadata: Metadata = { title: 'Feriados' };

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export default async function FeriadosAdmin({ searchParams }: { searchParams: Promise<{ ano?: string; data?: string; nome?: string }> }) {
  const { ano: anoPedido, data: dataDigitada, nome: nomeDigitado } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.feriados.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const todos = await listarFeriados(app.planilhas, usuario.autorizador);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const anoAtual = Number(hoje.slice(0, 4));
  const anos = [...new Set([anoAtual, anoAtual + 1, ...todos.map((f) => Number(f.data.slice(0, 4)))])].sort((a, b) => a - b);
  const ano = anos.includes(Number(anoPedido)) ? Number(anoPedido) : anoAtual;
  const doAno = todos.filter((f) => f.data.startsWith(`${ano}-`));

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Feriados' }]}
        titulo="Feriados"
        descricao="Estes dias não contam como úteis nos prazos dos apps: Requisições e Comunicação."
      />

      <Secao titulo="Incluir feriados" id="t-incluir">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
          <form action={acaoIncluirFeriadosNacionais} className="flex flex-wrap items-end gap-3">
            <Campo rotulo="Ano" dica="Inclui os nacionais e o 9 de julho (estadual).">
              <select name="ano" defaultValue={anoAtual} className={`${estiloEntrada} w-28`}>
                {[anoAtual, anoAtual + 1].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Campo>
            <BotaoEnviar variante="secundario" enviando="Incluindo…">
              Incluir feriados nacionais
            </BotaoEnviar>
          </form>
          <form action={acaoIncluirFeriado} className="flex flex-wrap items-end gap-3">
            <Campo rotulo="Data" obrigatorio>
              <input name="data" type="date" required defaultValue={dataDigitada} className={`${estiloEntrada} w-44`} />
            </Campo>
            <Campo rotulo="Nome" obrigatorio dica="Por exemplo: feriado municipal, ponto facultativo.">
              <input name="nome" required defaultValue={nomeDigitado} className={`${estiloEntrada} w-72`} />
            </Campo>
            <BotaoEnviar enviando="Incluindo…">Incluir feriado</BotaoEnviar>
          </form>
        </div>
      </Secao>

      <nav aria-label="Ano da lista" className="mb-3 flex flex-wrap gap-2 text-sm">
        {anos.map((a) => (
          <a
            key={a}
            href={`/admin/feriados?ano=${a}`}
            aria-current={a === ano ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${a === ano ? 'border-destaque bg-destaque-suave font-semibold' : 'border-borda'}`}
          >
            {a}
          </a>
        ))}
      </nav>

      <TabelaDados
        legenda={`Feriados de ${ano}`}
        vazio={
          todos.length === 0
            ? 'Nenhum feriado cadastrado: hoje todos os dias de segunda a sexta contam como úteis.'
            : `Nenhum feriado em ${ano}.`
        }
        colunas={[
          { chave: 'data', rotulo: 'Data' },
          { chave: 'dia', rotulo: 'Dia da semana' },
          { chave: 'nome', rotulo: 'Nome' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={doAno.map((f) => ({
          id: f.id,
          valores: { data: dataBr(f.data), dia: SEMANA[new Date(`${f.data}T12:00:00Z`).getUTCDay()], nome: f.nome },
          celulas: {
            acoes: (
              <div className="flex justify-end">
                <FormularioConfirmado
                  acao={acaoTirarFeriado}
                  campos={{ id: f.id, versao: f.versao }}
                  rotulo={<IconeLixeira tamanho={16} />}
                  rotuloAcessivel={`Tirar ${f.nome}`}
                  variante="icone-perigo"
                  titulo={`Tirar “${f.nome}” da lista?`}
                  mensagem="Os prazos voltam a contar este dia como útil. Pedidos já enviados não são recalculados."
                  confirmar="Tirar feriado"
                />
              </div>
            ),
          },
        }))}
      />
    </div>
  );
}
