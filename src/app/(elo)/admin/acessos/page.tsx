import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { painelDeAcessos } from '@/nucleo/acesso/gestao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { situacaoDaEstrutura } from '@/plataforma/estrutura';
import { Aviso } from '@/ui/aviso';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { LinkBotao, pequeno } from '@/ui/botao';
import { IconeChave, IconeFechar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import { PERFIL_PADRAO } from '@/nucleo/acesso/gestao';
import {
  acaoAtribuirPerfil,
  acaoCadastrarUsuario,
  acaoCadastrarUsuariosEmLote,
  acaoConferirUsuariosEmLote,
  acaoDesativarUsuario,
  acaoEncerrarAtribuicao,
} from '../acoes';
import { CadastroDeUsuariosEmLote } from './cadastro-em-lote';

export const metadata: Metadata = { title: 'Acessos' };

export default async function Acessos({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { perfil: perfilPara } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.acessos.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const [painel, est] = await Promise.all([painelDeAcessos(app.planilhas, usuario.autorizador), situacaoDaEstrutura()]);
  const dominio = app.config.modo === 'producao' ? app.config.dominio : null;
  const ativos = painel.usuarios.filter((u) => u.ativo);
  const inativos = painel.usuarios.filter((u) => !u.ativo);

  const temPadrao = painel.perfis.some((x) => x.codigo === PERFIL_PADRAO);
  const pessoaDoPerfil = perfilPara ? ativos.find((u) => u.id === perfilPara) : undefined;

  const FormPerfil = ({ email }: { email?: string }) => (
    <form action={acaoAtribuirPerfil} className="space-y-4">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Campo rotulo="Pessoa" obrigatorio>
          <select name="email" required className={estiloEntrada}>
            {ativos.map((u) => (
              <option key={u.id} value={u.email}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}
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
  );

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Administração' }, { rotulo: 'Acessos' }]}
        titulo="Acessos"
        descricao="Quem pode entrar na plataforma e o que cada pessoa pode fazer. Um perfil vale para toda a instituição ou só para uma unidade, área ou serviço."
        acoes={
          <>
            <JanelaFormulario
              rotulo="Cadastrar em lote"
              variante="fantasma"
              className={pequeno}
              larga
              titulo="Dar acesso a várias pessoas de uma vez"
              descricao="Cole uma lista copiada da planilha (nome, e-mail, perfil e onde vale), confira e confirme."
            >
              <CadastroDeUsuariosEmLote conferir={acaoConferirUsuariosEmLote} cadastrar={acaoCadastrarUsuariosEmLote} dominio={dominio} />
            </JanelaFormulario>
            <JanelaFormulario
              rotulo="Atribuir perfil"
              variante="fantasma"
              className={pequeno}
              titulo="Atribuir perfil"
              descricao="Define o que a pessoa vê e onde."
            >
              <FormPerfil />
            </JanelaFormulario>
            <JanelaFormulario
              rotulo={
                <>
                  <IconeMais tamanho={16} /> Dar acesso
                </>
              }
              className={pequeno}
              titulo="Dar acesso"
              descricao="A pessoa entra com a conta Google institucional."
            >
              <form action={acaoCadastrarUsuario} className="space-y-4">
                <Campo rotulo="Nome completo" obrigatorio>
                  <input name="nome" required autoComplete="off" className={estiloEntrada} />
                </Campo>
                <Campo rotulo="E-mail" obrigatorio dica={dominio ? `Precisa terminar em @${dominio}.` : undefined}>
                  <input name="email" type="email" required autoComplete="off" className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Perfil" dica="Vale para toda a instituição. Para um perfil só de uma unidade, área ou serviço, use depois “Atribuir perfil”.">
                  <select name="perfil" defaultValue={temPadrao ? PERFIL_PADRAO : ''} className={estiloEntrada}>
                    <option value="">Sem perfil por enquanto</option>
                    {painel.perfis.map((x) => (
                      <option key={x.codigo} value={x.codigo}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <BotaoEnviar enviando="Cadastrando…" className="w-full">
                  Dar acesso
                </BotaoEnviar>
              </form>
            </JanelaFormulario>
          </>
        }
      />

      {pessoaDoPerfil && (
        <JanelaFormulario
          rotulo={null}
          abrirAoCarregar
          voltarPara="/admin/acessos"
          titulo={`Atribuir perfil a ${pessoaDoPerfil.nome}`}
          descricao="Define o que a pessoa vê e onde."
        >
          <FormPerfil email={pessoaDoPerfil.email} />
        </JanelaFormulario>
      )}

      {est?.desatualizada && (
        <Aviso
          tipo="atencao"
          titulo="Perfis ou permissões novos ainda não valem"
          acao={
            <LinkBotao href="/admin/estrutura" variante="secundario">
              Preparar estrutura
            </LinkBotao>
          }
        >
          A versão publicada trouxe mudanças de perfis e permissões. Enquanto ninguém rodar Preparar estrutura, quem tem esses perfis pode não ver todos os
          itens do menu, mesmo com o perfil atribuído aqui.
        </Aviso>
      )}

      <TabelaDados
        legenda="Pessoas com acesso"
        vazio="Ninguém cadastrado ainda. Use “Dar acesso”."
        colunas={[
          { chave: 'nome', rotulo: 'Pessoa' },
          { chave: 'email', rotulo: 'E-mail' },
          { chave: 'perfis', rotulo: 'Perfis' },
          { chave: 'acoes', rotulo: '', fixa: true, largura: 'w-20' },
        ]}
        linhas={ativos.map((u) => {
          const vigentes = u.atribuicoes.filter((x) => x.vigente);
          return {
            id: u.id,
            valores: { nome: u.nome, email: u.email, perfis: vigentes.map((x) => `${x.perfil} ${x.escopo}`).join(' · ') || 'Sem perfil' },
            celulas: {
              nome: <span className="font-semibold">{u.nome}</span>,
              email: <span className="text-texto-suave">{u.email}</span>,
              perfis:
                vigentes.length === 0 ? (
                  <Etiqueta tipo="atencao">Sem perfil: não vê nenhum app</Etiqueta>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {vigentes.map((x) => (
                      <li key={x.id} className="flex items-center gap-0.5 rounded-md border border-borda bg-superficie-2 py-0.5 pl-2 text-xs">
                        <span>
                          <span className="font-semibold">{x.perfil}</span>
                          <span className="text-texto-suave"> · {x.escopo}</span>
                        </span>
                        <FormularioConfirmado
                          acao={acaoEncerrarAtribuicao}
                          campos={{ id: x.id, versao: x.versao }}
                          rotulo={<IconeFechar tamanho={12} />}
                          rotuloAcessivel={`Retirar ${x.perfil}`}
                          variante="icone-perigo"
                          titulo={`Retirar o perfil ${x.perfil}?`}
                          mensagem={`${u.nome} perde as permissões deste perfil (${x.escopo}) a partir de hoje. O registro fica no histórico.`}
                          confirmar="Retirar perfil"
                        />
                      </li>
                    ))}
                  </ul>
                ),
              acoes: (
                <div className="flex justify-end gap-1">
                  <LinkBotao
                    href={`/admin/acessos?perfil=${u.id}`}
                    scroll={false}
                    variante="icone"
                    aria-label={`Atribuir perfil a ${u.nome}`}
                    title="Atribuir perfil"
                  >
                    <IconeChave tamanho={16} />
                  </LinkBotao>
                  {u.email !== usuario.email && (
                    <FormularioConfirmado
                      acao={acaoDesativarUsuario}
                      campos={{ id: u.id, versao: u.versao }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Desativar o acesso de ${u.nome}`}
                      variante="icone-perigo"
                      titulo={`Desativar o acesso de ${u.nome}?`}
                      mensagem="A pessoa deixa de entrar na plataforma imediatamente. O cadastro e o histórico são mantidos, e o acesso pode ser reativado cadastrando o mesmo e-mail."
                      confirmar="Desativar acesso"
                    />
                  )}
                </div>
              ),
            },
          };
        })}
      />

      {inativos.length > 0 && (
        <details className="mt-6 rounded-cartao border border-borda bg-superficie text-sm">
          <summary className="cursor-pointer select-none px-5 py-3 font-semibold">Acessos desativados ({inativos.length})</summary>
          <ul className="divide-y divide-borda border-t border-borda text-texto-suave">
            {inativos.map((u) => (
              <li key={u.id} className="px-5 py-2">
                {u.nome} · {u.email}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
