import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { abrirPessoa, podeCadastrarPessoa, servicosParaVincular, type PessoaAberta } from '@/nucleo/pessoas/gravacao';
import { listarPessoasVisiveis } from '@/nucleo/pessoas/servico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { estiloBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeBusca, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';
import { acaoCorrigirPessoa, acaoEncerrarVinculo, acaoVincularPessoa } from './acoes';
import { CamposPessoa } from './campos-pessoa';
import { FormularioCadastro } from './formulario-cadastro';

export const metadata: Metadata = { title: 'Pessoas' };

const PAPEIS: Record<string, string> = {
  atendido: 'Atendido',
  familiar: 'Familiar',
  colaborador: 'Colaborador',
  voluntario: 'Voluntário',
  doador: 'Doador',
  parceiro: 'Parceiro',
};

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function Pessoas({ searchParams }: { searchParams: Promise<{ busca?: string; papel?: string; abrir?: string; erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const app = await obterAplicacao();
  const { busca = '', papel = '', abrir = '', erro = '' } = await searchParams;
  const podeCadastrar = podeCadastrarPessoa(usuario.autorizador);
  const servicosDoEscopo = podeCadastrar || abrir ? await servicosParaVincular(app.planilhas, usuario.autorizador) : [];
  let aberta: PessoaAberta | null = null;
  if (abrir) {
    try {
      aberta = await abrirPessoa(app.planilhas, usuario.autorizador, abrir);
    } catch (e) {
      if (!(e instanceof ErroPermissao)) throw e;
      redirect(`/nucleo/pessoas?erro=${encodeURIComponent(e.message)}`);
    }
  }
  const papeisParaEscolher = Object.entries(PAPEIS).map(([valor, rotulo]) => ({ valor, rotulo }));

  // A camada de aplicação filtra pelo perfil: cada um recebe só quem pode ver.
  const todas = await listarPessoasVisiveis(app.planilhas, usuario.autorizador);
  const termo = semAcento(busca.trim());
  const pessoas = todas.filter((p) => (!termo || semAcento(p.nome).includes(termo)) && (!papel || p.papeis.includes(papel)));
  const contagem = (x: string) => todas.filter((p) => p.papeis.includes(x)).length;
  const filtros = [{ valor: '', rotulo: 'Todas', n: todas.length }, ...Object.entries(PAPEIS).map(([valor, rotulo]) => ({ valor, rotulo, n: contagem(valor) }))].filter(
    (f) => f.valor === '' || f.n > 0,
  );
  const link = (valor: string) => {
    const q = new URLSearchParams({ ...(busca ? { busca } : {}), ...(valor ? { papel: valor } : {}) });
    return `/nucleo/pessoas${q.size ? `?${q}` : ''}`;
  };

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Pessoas' }]}
        titulo="Pessoas"
        descricao="Atendidos, familiares e equipe que o seu perfil permite ver. Quem não aparece está fora do seu escopo de acesso."
        acoes={
          podeCadastrar && (
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Cadastrar pessoa
                </>
              }
              titulo="Cadastrar pessoa"
              descricao="Só o nome é obrigatório. Escolha o serviço para a pessoa já aparecer para avaliar."
            >
              <FormularioCadastro servicos={servicosDoEscopo} papeis={papeisParaEscolher} />
            </JanelaFormulario>
          )
        }
      />

      {aberta && (
        <JanelaFormulario rotulo={null} abrirAoCarregar larga voltarPara="/nucleo/pessoas" titulo={aberta.dados.nomeSocial ?? aberta.dados.nome ?? 'Pessoa'}>
          <PessoaAbertaConteudo pessoa={aberta} servicos={servicosDoEscopo} erro={erro} />
        </JanelaFormulario>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form className="flex min-w-0 flex-1 gap-2 sm:max-w-md" role="search">
          {papel && <input type="hidden" name="papel" value={papel} />}
          <label className="sr-only" htmlFor="busca">
            Buscar pelo nome
          </label>
          <div className="relative flex-1">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-texto-suave" tamanho={18} />
            <input id="busca" name="busca" defaultValue={busca} placeholder="Buscar pelo nome" className={`${estiloEntrada} pl-10`} />
          </div>
          <button className={estiloBotao('secundario', 'mt-1.5')}>Buscar</button>
        </form>
      </div>
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar por papel">
        {filtros.map((f) => (
          <li key={f.valor}>
            <Link
              href={link(f.valor)}
              aria-current={papel === f.valor ? 'true' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                papel === f.valor ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie hover:bg-destaque-suave'
              }`}
            >
              {f.rotulo}
              <span className="tabular-nums opacity-80">{f.n}</span>
            </Link>
          </li>
        ))}
      </ul>

      {pessoas.length === 0 ? (
        <EstadoVazio
          titulo={todas.length === 0 ? 'Nenhuma pessoa visível para o seu perfil' : 'Ninguém encontrado'}
          acao={
            todas.length === 0 && podeCadastrar ? undefined : todas.length > 0 ? (
              <Link href="/nucleo/pessoas" className={estiloBotao('secundario')}>
                Limpar busca
              </Link>
            ) : undefined
          }
        >
          {todas.length === 0 ? (podeCadastrar ? 'Cadastre a primeira pessoa e vincule-a a um serviço.' : 'Se você deveria ver atendidos de um serviço, peça à administração para ajustar o seu perfil.') : 'Confira a grafia ou tente só o primeiro nome.'}
        </EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">{pessoas.length} pessoas</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Nome</th>
                <th scope="col" className={tabela.th}>Papel</th>
                <th scope="col" className={tabela.th}>Serviço</th>
                <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <PiscaOndeMudou key={p.id} chave={`pessoa:${p.id}`} como="tr" className={tabela.linha}>
                  <td className={`${tabela.td} font-semibold`}>{p.nome}</td>
                  <td className={tabela.td}>
                    <span className="flex flex-wrap gap-1">
                      {p.papeis.map((x) => (
                        <Etiqueta key={x} tipo={x === 'atendido' ? 'info' : 'neutro'}>
                          {PAPEIS[x] ?? x}
                        </Etiqueta>
                      ))}
                    </span>
                  </td>
                  <td className={`${tabela.td} text-texto-suave`}>{p.servicos.join(', ') || '—'}</td>
                  <td className={tabela.td}>
                    <Link href={`/nucleo/pessoas?abrir=${p.id}`} className={estiloBotao('secundario', pequeno)} aria-label={`Abrir ${p.nome}`}>
                      Abrir
                    </Link>
                  </td>
                </PiscaOndeMudou>
              ))}
            </tbody>
          </table>
          <p className="border-t border-borda px-4 py-2.5 text-sm text-texto-suave">
            {pessoas.length === todas.length ? `${todas.length} pessoas` : `${pessoas.length} de ${todas.length} pessoas`}
          </p>
        </div>
      )}
    </div>
  );
}

const dataBR = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

function PessoaAbertaConteudo({ pessoa, servicos, erro }: { pessoa: PessoaAberta; servicos: { codigo: string; nome: string }[]; erro: string }) {
  const d = pessoa.dados;
  const hoje = new Date().toISOString().slice(0, 10);
  const dados: [string, string | null][] = [
    ['Nome completo', d.nome],
    ['Nome social', d.nomeSocial],
    ['Nascimento', d.dataNascimento ? dataBR(d.dataNascimento) : null],
    ['CPF', d.cpf],
    ['NIS', d.nis],
    ['E-mail', d.email],
    ['Telefone', d.telefone],
    ['Cidade', d.cidade],
    ['Bairro', d.bairro],
  ];
  const ativos = pessoa.vinculos.filter((v) => !v.saida).map((v) => v.servico);
  const livres = servicos.filter((s) => !ativos.includes(s.codigo));
  return (
    <div className="space-y-6">
      {erro && (
        <Aviso tipo="erro" titulo="Não foi possível concluir">
          {erro}
        </Aviso>
      )}
      <section aria-labelledby="dados-pessoa" className="space-y-3">
        <h3 id="dados-pessoa" className="font-bold">
          Dados
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {dados
            .filter(([, v]) => v)
            .map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-texto-suave">{rotulo}</dt>
                <dd className="font-semibold">{valor}</dd>
              </div>
            ))}
        </dl>
        {pessoa.podeCorrigir && (
          <details className="rounded-lg border border-borda">
            <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold">Corrigir dados</summary>
            <form action={acaoCorrigirPessoa} className="space-y-4 border-t border-borda p-3">
              <input type="hidden" name="id" value={pessoa.id} />
              <input type="hidden" name="versao" value={pessoa.versao} />
              <CamposPessoa valor={d} maisDadosAberto />
              <BotaoEnviar enviando="Salvando…" className="w-full">
                Salvar correção
              </BotaoEnviar>
            </form>
          </details>
        )}
      </section>

      <section aria-labelledby="vinculos-pessoa" className="space-y-3">
        <h3 id="vinculos-pessoa" className="font-bold">
          Serviços
        </h3>
        {pessoa.vinculos.length === 0 ? (
          <p className="text-sm text-texto-suave">Esta pessoa ainda não está em nenhum serviço.</p>
        ) : (
          <ul className="divide-y divide-borda rounded-lg border border-borda">
            {pessoa.vinculos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-semibold">
                    {v.servicoNome} <Etiqueta tipo={v.saida ? 'neutro' : 'sucesso'}>{v.saida ? 'Encerrado' : 'Ativo'}</Etiqueta>
                  </p>
                  <p className="text-texto-suave">
                    Entrada {dataBR(v.entrada)}
                    {v.saida && ` · Saída ${dataBR(v.saida)}${v.motivo ? ` · ${v.motivo}` : ''}`}
                  </p>
                </div>
                {v.podeEncerrar && (
                  <FormularioConfirmado
                    acao={acaoEncerrarVinculo}
                    campos={{ vinculoId: v.id, versao: v.versao, pessoaId: pessoa.id }}
                    rotulo="Encerrar vínculo"
                    variante="secundario"
                    pequeno
                    titulo={`Encerrar vínculo com ${v.servicoNome}?`}
                    mensagem="A pessoa deixa de aparecer para avaliar neste serviço a partir desta data. O histórico fica guardado e ela pode voltar com um novo vínculo."
                    confirmar="Encerrar vínculo"
                  >
                    <Campo rotulo="Motivo" obrigatorio>
                      <input name="motivo" required maxLength={200} autoComplete="off" className={estiloEntrada} />
                    </Campo>
                    <Campo rotulo="Data de saída">
                      <input name="saida" type="date" min={v.entrada ?? undefined} max={hoje} defaultValue={hoje} className={estiloEntrada} />
                    </Campo>
                  </FormularioConfirmado>
                )}
              </li>
            ))}
          </ul>
        )}
        {livres.length > 0 && (
          <form action={acaoVincularPessoa} className="space-y-3 rounded-lg border border-borda p-3">
            <input type="hidden" name="pessoaId" value={pessoa.id} />
            <h4 className="text-sm font-semibold">Vincular a serviço</h4>
            <Campo rotulo="Serviço" obrigatorio>
              <select name="servico" required className={estiloEntrada}>
                {livres.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Entrada" dica="Pode ser uma data passada, para quem já é atendido.">
              <input name="entrada" type="date" max={hoje} defaultValue={hoje} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…" className="w-full">
              Vincular
            </BotaoEnviar>
          </form>
        )}
        {servicos.length === 0 && <p className="text-sm text-texto-suave">Você ainda não tem serviço no seu escopo. Peça à administração.</p>}
      </section>
    </div>
  );
}
