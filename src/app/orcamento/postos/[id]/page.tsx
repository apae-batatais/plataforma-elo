import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ErroValidacaoFolha, fichaDoPosto } from '@/modulos/orcamento/aplicacao/folha';
import { data } from '@/modulos/orcamento/telas/formato';
import { FormularioPosto } from '@/modulos/orcamento/telas/formulario-posto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloCampo, Mensagem } from '../../../admin/mensagem';
import { acaoEncerrarPosto, acaoSalvarPosto } from '../../acoes';

export default async function FichaDoPosto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const novo = id === 'novo';
  if (!usuario.autorizador.temPermissao(novo ? 'orcamento.folha.editar' : 'orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  let ficha;
  try {
    ficha = await fichaDoPosto(app.planilhas, usuario.autorizador, novo ? null : id);
  } catch (erro) {
    if (erro instanceof ErroValidacaoFolha) redirect('/orcamento/postos');
    throw erro;
  }
  const { ok, erro } = await searchParams;
  const p = ficha.posto;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orcamento/postos" className="text-sm text-destaque hover:underline">
          ← Postos
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{novo ? 'Cadastrar posto' : (p?.colaborador ?? 'Vaga prevista')}</h2>
        {p?.desligamento && <p className="mt-1 text-texto-suave">Desligado em {data(p.desligamento)}.</p>}
      </div>
      <Mensagem ok={ok} erro={erro} />
      {ficha.cadastros.cargos.length === 0 || ficha.cadastros.centros.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-6">
          Antes de cadastrar postos, é preciso ter cargos e centros de custo.{' '}
          <Link href="/orcamento/cadastros" className="font-semibold text-destaque underline">
            Ver cargos e centros de custo
          </Link>{' '}
          ou{' '}
          <Link href="/orcamento/importar" className="font-semibold text-destaque underline">
            importar a planilha da folha
          </Link>
          .
        </p>
      ) : (
        <FormularioPosto key={`${p?.id}-${p?.versao}`} ficha={ficha} acao={acaoSalvarPosto} />
      )}

      {p && ficha.podeEditar && !p.desligamento && (
        <section className="rounded-lg border border-borda bg-superficie p-5">
          <h3 className="text-lg font-semibold">Desligamento</h3>
          <p className="mt-1 text-sm text-texto-suave">
            O posto deixa de contar no custo a partir do mês seguinte ao desligamento. Nada é apagado.
          </p>
          <form action={acaoEncerrarPosto} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="versao" value={p.versao} />
            <label className="text-sm">
              Data de desligamento
              <input type="date" name="desligamento" required className={estiloCampo} />
            </label>
            <button className="rounded-md border border-borda px-4 py-2 text-sm hover:bg-aviso-fundo">Registrar desligamento</button>
          </form>
        </section>
      )}
    </div>
  );
}
