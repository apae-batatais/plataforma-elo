import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatarDocumento } from '@/nucleo/encarregado/documento';
import { lerEncarregadoAdmin } from '@/nucleo/encarregado/encarregado';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { JanelaFormulario } from '@/ui/janela';
import { pequeno } from '@/ui/botao';
import { CabecalhoPagina } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoCadastrarEncarregado, acaoCorrigirEncarregado, acaoTrocarEncarregado } from './acoes';
import { FormularioEncarregado } from './formulario';

export const metadata: Metadata = { title: 'Encarregado de dados' };

const TIPO = { fisica: 'Pessoa física', juridica: 'Pessoa jurídica' } as const;
const data = (d: string | null) => (d ? d.split('-').reverse().join('/') : '');

export default async function EncarregadoAdmin() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.dpo.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const { atual, historico } = await lerEncarregadoAdmin(app.planilhas, usuario.autorizador);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Encarregado de dados' }]}
        titulo="Encarregado de dados"
        descricao="A LGPD pede que a instituição indique quem cuida dos dados pessoais e recebe pedidos dos titulares."
        acoes={
          atual ? undefined : (
            <JanelaFormulario rotulo="Cadastrar encarregado" titulo="Cadastrar encarregado">
              <FormularioEncarregado acao={acaoCadastrarEncarregado} rotuloEnviar="Cadastrar encarregado" />
            </JanelaFormulario>
          )
        }
      />

      {atual ? (
        <section aria-label="Encarregado atual" className="mb-6 rounded-cartao border border-borda bg-superficie p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-texto-suave">Nome</dt>
                <dd className="font-semibold">{atual.nome}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">Tipo</dt>
                <dd>{TIPO[atual.tipo]}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">{atual.tipo === 'fisica' ? 'CPF' : 'CNPJ'}</dt>
                <dd>{formatarDocumento(atual.documento)}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">E-mail</dt>
                <dd>{atual.email}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">Desde</dt>
                <dd>{data(atual.inicio)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <JanelaFormulario rotulo="Corrigir dados" variante="secundario" className={pequeno} titulo="Corrigir dados do encarregado">
                <FormularioEncarregado
                  acao={acaoCorrigirEncarregado}
                  inicial={{ tipo: atual.tipo, nome: atual.nome, documento: atual.documento, email: atual.email }}
                  registro={{ id: atual.id, versao: atual.versao }}
                  rotuloEnviar="Salvar alterações"
                />
              </JanelaFormulario>
              <JanelaFormulario rotulo="Trocar encarregado" className={pequeno} titulo="Trocar encarregado">
                <FormularioEncarregado
                  acao={acaoTrocarEncarregado}
                  registro={{ id: atual.id, versao: atual.versao }}
                  comData
                  hoje={hoje}
                  rotuloEnviar="Trocar encarregado"
                  confirmacao="O encarregado atual será encerrado nesta data e o novo passa a valer. O histórico fica guardado."
                />
              </JanelaFormulario>
            </div>
          </div>
        </section>
      ) : (
        <p className="mb-6 rounded-cartao border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Nenhum encarregado cadastrado. Cadastre quem a instituição indicou para a LGPD.
        </p>
      )}

      {historico.length > 0 && (
        <TabelaDados
          legenda="Histórico de encarregados"
          vazio="Sem histórico."
          colunas={[
            { chave: 'nome', rotulo: 'Nome' },
            { chave: 'tipo', rotulo: 'Tipo' },
            { chave: 'de', rotulo: 'De' },
            { chave: 'ate', rotulo: 'Até' },
          ]}
          linhas={historico.map((h) => ({
            id: h.id,
            valores: { nome: h.nome, tipo: TIPO[h.tipo], de: data(h.inicio), ate: data(h.fim) },
          }))}
        />
      )}
    </div>
  );
}
