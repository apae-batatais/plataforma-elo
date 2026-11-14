import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCedentes } from '@/modulos/orcamento/aplicacao/cedidos';
import { ROTULO_TIPO_CEDENTE, TIPOS_CEDENTE } from '@/modulos/orcamento/dominio/cedidos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Secao, tabela } from '@/ui/pagina';
import { acaoEncerrarCedente, acaoSalvarCedente } from '../../acoes';

export const metadata: Metadata = { title: 'Quem cede' };

export default async function QuemCede() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const r = await listarCedentes(app.planilhas, a);
  return (
    <div className="max-w-4xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Quem cede' }]}
        titulo="Quem cede"
        descricao="Poder público, empresas com cota de aprendiz ou de PcD e outros que cedem profissionais à instituição."
      />
      {!r.podeEditar && (
        <div className="mb-6">
          <Aviso tipo="info">Você pode consultar, sem alterar.</Aviso>
        </div>
      )}
      {r.cedentes.length === 0 ? (
        <EstadoVazio titulo="Ninguém cadastrado ainda">{r.podeEditar ? "Use 'Adicionar quem cede' abaixo para começar." : undefined}</EstadoVazio>
      ) : (
        <div className={`${tabela.moldura} mb-6`}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Quem cede profissionais</caption>
            <thead className={tabela.cabeca}>
              <tr>
                {['Nome', 'Tipo', 'Cedidos ativos', ''].map((t, i) => (
                  <th key={i} scope="col" className={tabela.th}>
                    {t || <span className="sr-only">Ações</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.cedentes.map((c) => (
                <tr key={c.id} className={tabela.linha}>
                  <th scope="row" className={`${tabela.td} text-left`}>
                    {c.nome}
                    {c.observacao && <span className="block text-xs font-normal text-texto-suave">{c.observacao}</span>}
                  </th>
                  <td className={tabela.td}>{c.tipoRotulo}</td>
                  <td className={`${tabela.td} tabular-nums`}>{c.cedidosAtivos}</td>
                  <td className={`${tabela.td} text-right`}>
                    {r.podeEditar && (
                      <FormularioConfirmado
                        acao={acaoEncerrarCedente}
                        campos={{ id: c.id, versao: c.versao }}
                        rotulo="Encerrar"
                        variante="secundario"
                        pequeno
                        titulo={`Encerrar ${c.nome}?`}
                        mensagem={c.cedidosAtivos > 0 ? `${c.cedidosAtivos} profissional(is) cedido(s) ainda está(ão) ativo(s). Encerre as cessões antes.` : 'O cadastro deixa de aparecer nas escolhas. O histórico fica guardado.'}
                        confirmar="Encerrar"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.podeEditar && (
        <Secao titulo="Adicionar quem cede">
          <form action={acaoSalvarCedente} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" obrigatorio>
              <input name="nome" required className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Tipo" obrigatorio>
              <select name="tipo" required defaultValue="" className={estiloEntrada}>
                <option value="" disabled>
                  Escolha…
                </option>
                {TIPOS_CEDENTE.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_CEDENTE[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Observação" className="sm:col-span-2">
              <input name="observacao" className={estiloEntrada} />
            </Campo>
            <div className="sm:col-span-2">
              <BotaoEnviar enviando="Salvando…">Adicionar quem cede</BotaoEnviar>
            </div>
          </form>
        </Secao>
      )}
    </div>
  );
}
