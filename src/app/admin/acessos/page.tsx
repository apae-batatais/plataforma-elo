import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { painelDeAcessos } from '@/nucleo/acesso/gestao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoAtribuirPerfil, acaoCadastrarUsuario, acaoDesativarUsuario, acaoEncerrarAtribuicao } from '../acoes';

export const metadata: Metadata = { title: 'Acessos' };

export default async function Acessos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.acessos.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const painel = await painelDeAcessos(app.planilhas, usuario.autorizador);
  const dominio = app.config.modo === 'producao' ? app.config.dominio : null;
  const ativos = painel.usuarios.filter((u) => u.ativo);
  const inativos = painel.usuarios.filter((u) => !u.ativo);

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Acessos' }]}
        titulo="Acessos"
        descricao="Quem pode entrar na plataforma e o que cada pessoa pode fazer. Um perfil vale para toda a instituição ou só para uma unidade, área ou serviço."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Secao titulo={`Pessoas com acesso (${ativos.length})`} id="t-pessoas">
          {ativos.length === 0 ? (
            <EstadoVazio titulo="Ninguém cadastrado ainda">Use o formulário “Dar acesso” para cadastrar a primeira pessoa.</EstadoVazio>
          ) : (
            <ul className="-my-3 divide-y divide-borda">
              {ativos.map((u) => {
                const vigentes = u.atribuicoes.filter((x) => x.vigente);
                return (
                  <li key={u.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{u.nome}</p>
                        <p className="truncate text-sm text-texto-suave">{u.email}</p>
                      </div>
                      {u.email !== usuario.email && (
                        <FormularioConfirmado
                          acao={acaoDesativarUsuario}
                          campos={{ id: u.id, versao: u.versao }}
                          rotulo="Desativar acesso"
                          variante="fantasma"
                          pequeno
                          titulo={`Desativar o acesso de ${u.nome}?`}
                          mensagem="A pessoa deixa de entrar na plataforma imediatamente. O cadastro e o histórico são mantidos, e o acesso pode ser reativado cadastrando o mesmo e-mail."
                          confirmar="Desativar acesso"
                        />
                      )}
                    </div>
                    {vigentes.length === 0 ? (
                      <p className="mt-2">
                        <Etiqueta tipo="atencao">Sem perfil: não vê nenhum app</Etiqueta>
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {vigentes.map((x) => (
                          <li key={x.id} className="flex items-center gap-1 rounded-lg border border-borda bg-superficie-2 py-1 pl-3 pr-1 text-sm">
                            <span>
                              <span className="font-semibold">{x.perfil}</span>
                              <span className="text-texto-suave"> · {x.escopo}</span>
                            </span>
                            <FormularioConfirmado
                              acao={acaoEncerrarAtribuicao}
                              campos={{ id: x.id, versao: x.versao }}
                              rotulo={<span aria-label={`Retirar ${x.perfil}`}>Retirar</span>}
                              variante="fantasma"
                              pequeno
                              titulo={`Retirar o perfil ${x.perfil}?`}
                              mensagem={`${u.nome} perde as permissões deste perfil (${x.escopo}) a partir de hoje. O registro fica no histórico.`}
                              confirmar="Retirar perfil"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {inativos.length > 0 && (
            <details className="mt-6 border-t border-borda pt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-texto-suave">Acessos desativados ({inativos.length})</summary>
              <ul className="mt-2 space-y-1 text-texto-suave">
                {inativos.map((u) => (
                  <li key={u.id}>
                    {u.nome} · {u.email}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Secao>

        <div className="space-y-6 xl:sticky xl:top-6">
          <Secao titulo="Dar acesso" descricao="A pessoa entra com a conta Google institucional." id="t-dar">
            <form action={acaoCadastrarUsuario} className="space-y-4">
              <Campo rotulo="Nome completo" obrigatorio>
                <input name="nome" required autoComplete="off" className={estiloEntrada} />
              </Campo>
              <Campo rotulo="E-mail" obrigatorio dica={dominio ? `Precisa terminar em @${dominio}.` : undefined}>
                <input name="email" type="email" required autoComplete="off" className={estiloEntrada} />
              </Campo>
              <BotaoEnviar enviando="Cadastrando…" className="w-full">
                Dar acesso
              </BotaoEnviar>
            </form>
          </Secao>

          <Secao titulo="Atribuir perfil" descricao="Define o que a pessoa vê e onde." id="t-perfil">
            <form action={acaoAtribuirPerfil} className="space-y-4">
              <Campo rotulo="Pessoa" obrigatorio>
                <select name="email" required className={estiloEntrada}>
                  {ativos.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Perfil" obrigatorio>
                <select name="perfil" required className={estiloEntrada}>
                  {painel.perfis.map((x) => (
                    <option key={x.codigo} value={x.codigo}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vale para" obrigatorio dica="Escolha uma área para a coordenação ver os totais da folha daquela área.">
                <select name="escopo" required className={estiloEntrada}>
                  <option value="global:">Toda a instituição</option>
                  {(['unidade', 'area', 'servico'] as const).map((tipo) => (
                    <optgroup key={tipo} label={{ unidade: 'Unidades', area: 'Áreas', servico: 'Serviços' }[tipo]}>
                      {painel.escopos
                        .filter((e) => e.tipo === tipo)
                        .map((e) => (
                          <option key={`${tipo}:${e.codigo}`} value={`${tipo}:${e.codigo}`}>
                            {e.nome}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Campo>
              <BotaoEnviar enviando="Atribuindo…" className="w-full" disabled={ativos.length === 0}>
                Atribuir perfil
              </BotaoEnviar>
            </form>
          </Secao>
        </div>
      </div>
    </div>
  );
}
